---
title: "Hybrid Search That Actually Works: BM25 + Vectors with Reciprocal Rank Fusion"
description: "Pure vector search quietly misses exact terms like error codes, SKUs and IDs, so run BM25 and vector retrieval side by side and fuse their rankings with Reciprocal Rank Fusion. Add a cross-encoder reranker on the fused top results when you need the extra precision and can pay the latency."
date: 2025-11-02
tags: [RAG, Search, Python, Embeddings]
tldr:
  - "Vector search blurs exact tokens like error codes and SKUs; BM25 keyword search finds them, so run both retrievers side by side."
  - "Fuse the two rankings with Reciprocal Rank Fusion (sum of 1/(k + rank), k around 60): it uses ranks and ignores incompatible score scales."
  - "Rerank the fused candidates with a cross-encoder: fusion decides what survives, reranking decides the final order."
---

Picture a support bot sitting on top of thousands of troubleshooting articles. A user types "what does ERR-4012 mean on the checkout API?" and the bot answers with a beautifully written paragraph about... payment timeouts in general. The article that literally has `ERR-4012` in its title exists. It just never made it into the context window, because the vector search thought three other articles "felt" closer.

This is the most common way RAG systems fail in production, and it has nothing to do with the LLM. It is a retrieval problem, and the fix is old, boring and extremely effective: run a keyword retriever next to your vector retriever and merge the two rankings with Reciprocal Rank Fusion. Let's build it properly, from intuition to code to the things that bite you after deploy.

## The Problem & Context

Embeddings are compression. A model takes a chunk of text and squeezes its meaning into a few hundred or a few thousand floating point numbers. That is exactly why they are great at paraphrase: "my card got declined" and "payment was refused" end up near each other even though they share no words.

The same compression is what hurts you with exact tokens. Think of an embedding as a photo of a crowd taken from a helicopter: you can tell it is a concert, roughly how many people are there and what the mood is. You cannot read the name on anyone's badge. Error codes, SKUs, invoice numbers, version strings, rare surnames and internal project codenames are the badges. To the embedding model, `ERR-4012` and `ERR-4021` are almost the same photo, and `SKU-88213-B` is mostly noise that gets split into subword pieces with little meaning of their own.

Typical queries where pure vector search struggles:

| Query type | Example | Why embeddings struggle |
|---|---|---|
| Error codes | `ERR-4012 checkout` | Near-identical codes collapse to similar vectors |
| Product identifiers | `SKU-88213-B dimensions` | Rare tokens, split into meaningless subwords |
| Versions | `breaking changes in 3.11.2` | Numbers carry little semantic weight |
| Rare names | `Kowalczyk contract renewal` | Out-of-distribution proper nouns |
| Config keys | `max_inflight_requests default` | Snake case identifiers look like generic words |

Keyword search has the opposite personality. It has no idea that "declined" and "refused" are related, but if the document contains `ERR-4012` and your query contains `ERR-4012`, it will find it every time, and it will rank it high precisely because the token is rare.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Can't I just switch to a bigger embedding model? The expensive one surely knows what ERR-4012 is.</span>
    </div>
  </div>
</div>

A bigger model gives you better semantics, not a better memory for arbitrary strings. Your error codes were invented by your team last quarter; no model saw them during training, and no amount of parameters turns a dense vector into an exact-match index. You could fine-tune embeddings on your domain, and that helps some, but it is a lot of work to approximate something BM25 does for free. Use each tool for what it is good at.

### How BM25 scores a document

BM25 is the standard ranking function behind most keyword search engines (Lucene, Elasticsearch, OpenSearch, Azure AI Search's full text side and many others). For each query term it combines three ideas:

1. **Term frequency (TF)**: a document that mentions the term more often is probably more relevant, but with diminishing returns. The tenth mention adds much less than the first. The parameter `k1` (commonly around 1.2 to 2.0) controls how fast that saturates.
2. **Inverse document frequency (IDF)**: rare terms are worth more than common ones. "the" appears everywhere and tells you nothing; `ERR-4012` appears in two documents and tells you a lot.
3. **Length normalization**: a long document naturally contains more words, so its term counts are discounted relative to the average document length. The parameter `b` (commonly 0.75) controls how strong that discount is.

In formula form, for a query Q and document D:

```text
score(D, Q) = Σ over terms q in Q of
              IDF(q) * ( f(q, D) * (k1 + 1) ) / ( f(q, D) + k1 * (1 - b + b * |D| / avgdl) )

f(q, D) = how many times q appears in D
|D|     = length of D in tokens
avgdl   = average document length in the corpus
```

The IDF part is why keyword search is so good at identifiers: the rarer the token, the bigger the boost. That is the exact opposite of how embeddings treat rare tokens.

## Deep Dive / Architectural Design

The architecture is two retrievers running in parallel over the same chunks, a fusion step, an optional reranker, and then the LLM:

```text
                        ┌──────────────────────┐
                   ┌──▶ │  BM25 / full text    │ ── top 50 ids (ranked) ──┐
                   │    └──────────────────────┘                          │
 user query ───────┤                                                      ▼
                   │    ┌──────────────────────┐                  ┌───────────────┐
                   └──▶ │  Vector (ANN) search │ ── top 50 ids ─▶ │  RRF fusion   │
                        └──────────────────────┘    (ranked)      └───────┬───────┘
                                                                          │ top 20-30
                                                                          ▼
                                                                ┌───────────────────┐
                                                                │ Cross-encoder     │
                                                                │ reranker (opt.)   │
                                                                └─────────┬─────────┘
                                                                          │ top 5-8
                                                                          ▼
                                                                ┌───────────────────┐
                                                                │ LLM with context  │
                                                                └───────────────────┘
```

Both retrievers are cheap and independent, so you run them concurrently. The interesting question is the box in the middle: how do you merge two ranked lists that were produced by completely different scoring functions?

### Why raw score fusion fails

The first idea everyone has is "just add the scores". Here is the problem. BM25 scores are unbounded and corpus dependent: a strong match might be 7.3 in one index and 23.8 in another, and the range changes as you add documents. Cosine similarity lives between -1 and 1, and with most modern embedding models the useful results cluster in a narrow band (say, everything relevant sits between 0.72 and 0.86). Adding 18.4 to 0.81 means the vector retriever effectively has no vote.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy fix: normalize both to 0-1 with min-max and then add them. Done, right?</span>
    </div>
  </div>
</div>

It is better than nothing, and some systems do use normalized score blending successfully, but it is fragile. Min-max depends on the best and worst score in each particular result list, so one outlier stretches everything else. A query where BM25 finds nothing truly relevant still produces a "1.0" for its least bad hit. And the distributions have different shapes: a BM25 list often has one sharp winner and a long tail, while cosine scores are flat and bunched together. After normalization, a tiny cosine difference and a huge BM25 gap can look the same. You end up tuning weights per query type, which is a sign the approach is fighting you.

### Reciprocal Rank Fusion: throw away the scores, keep the order

RRF, introduced by Cormack, Clarke and Büttcher in 2009, sidesteps the whole problem by ignoring scores entirely. It only looks at the position of each document in each list:

```text
RRF(d) = Σ over retrievers r of  1 / (k + rank_r(d))

rank_r(d) = 1-based position of d in retriever r's list
k         = smoothing constant, 60 in the original paper
```

A document ranked 1st by BM25 gets 1/61 ≈ 0.0164 from that list. Ranked 10th, it gets 1/70 ≈ 0.0143. A document that does not appear in a list simply gets nothing from it. Documents that show up in both lists accumulate two contributions, so agreement between retrievers is rewarded naturally.

The analogy I like is a music competition with two judges who use wildly different scoring sheets. One scores out of 10, the other out of 1,000 and is very stingy. Averaging their raw numbers is nonsense. But asking each judge "who were your top picks, in order?" and combining those orderings is fair, because an ordering means the same thing no matter how a judge scores.

What `k` does: it controls how much the top positions dominate. With a small `k` (say 1), rank 1 gets 1/2 and rank 2 gets 1/3, a huge gap, so the fused result follows whichever retriever is most confident. With `k = 60`, the curve is gentle: rank 1 and rank 5 differ by only about 6%, so a document that is decent in both lists beats a document that is excellent in one and missing from the other. That consensus behavior is usually what you want for RAG.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So 60 is a magic number I should never touch?</span>
    </div>
  </div>
</div>

Not magic, just a well-tested default that performed well across many datasets in the original experiments. It is a great starting point and often you never need to change it. If your evaluation shows that exact-match hits keep getting outvoted, you have two better levers than fiddling with `k`: give each retriever a weight (multiply its contribution), or adjust how many candidates each retriever contributes. We will see both in the code.

### Where the reranker fits

RRF gives you a good candidate list, but it still knows nothing about the query beyond what the two retrievers saw. A cross-encoder reranker reads the query and each candidate together, in one forward pass, and outputs a relevance score. That joint reading makes it much more precise than a bi-encoder (your embedding model, which encodes query and document separately), and much slower, because it cannot precompute anything. So you run it only on the fused top 20 to 50, never on the whole corpus.

| Stage | What it sees | Strength | Cost profile |
|---|---|---|---|
| BM25 | Tokens | Exact terms, rare identifiers | Very cheap, inverted index |
| Vector search | Precomputed embeddings | Paraphrase, meaning | Cheap per query, ANN index |
| RRF | Ranks only | Fair merge, no calibration | Negligible |
| Cross-encoder | Query and document together | Fine-grained relevance | Expensive, scales with candidates |

## Hands-On Implementation

Let's build the whole pipeline in Python with `rank_bm25`, `sentence-transformers` and numpy. It runs in memory, which is perfect for understanding and prototyping; afterwards we map the same idea onto Postgres and Azure AI Search.

```bash title="terminal"
pip install rank-bm25 sentence-transformers numpy
```

### Tokenization first (seriously)

The single most important line in a BM25 setup for technical content is the tokenizer. A naive `text.split()` keeps `ERR-4012.` with the trailing period as a different token from `ERR-4012`. A tokenizer that splits on every non-alphanumeric character turns `ERR-4012` into `err` and `4012`, which then match every document containing "err" or the number 4012. We want identifiers kept whole.

```python title="hybrid_search.py"
import re
from collections import defaultdict

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

# Keeps identifiers like "err-4012", "sku-88213-b" and "v3.11.2" as single tokens
TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:[-_.][a-z0-9]+)*")


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


documents = [
    {"id": "kb-101", "text": "ERR-4012: checkout API rejects the cart when the session token expired."},
    {"id": "kb-102", "text": "Payment timeouts: how to retry declined card transactions safely."},
    {"id": "kb-103", "text": "ERR-4021: inventory service returns stale stock for SKU-88213-B."},
    {"id": "kb-104", "text": "Why was my payment refused? Common reasons a card gets declined."},
    {"id": "kb-105", "text": "Session management: refreshing expired tokens in the checkout flow."},
]
doc_ids = [doc["id"] for doc in documents]
doc_texts = [doc["text"] for doc in documents]
```

### The two retrievers

BM25 works on tokens; the vector retriever works on normalized embeddings, so cosine similarity is just a dot product. Both return a ranked list of document ids, which is all RRF needs.

```python title="hybrid_search.py"
bm25 = BM25Okapi([tokenize(text) for text in doc_texts])

embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
doc_embeddings = embedder.encode(doc_texts, normalize_embeddings=True)


def bm25_search(query: str, top_k: int = 50) -> list[str]:
    scores = bm25.get_scores(tokenize(query))
    order = np.argsort(scores)[::-1][:top_k]
    # Drop documents with zero score: they share no terms with the query
    return [doc_ids[i] for i in order if scores[i] > 0]


def vector_search(query: str, top_k: int = 50) -> list[str]:
    query_embedding = embedder.encode(query, normalize_embeddings=True)
    similarities = doc_embeddings @ query_embedding  # cosine, since both are normalized
    order = np.argsort(similarities)[::-1][:top_k]
    return [doc_ids[i] for i in order]
```

Notice the asymmetry: BM25 can legitimately return fewer results (no shared terms means no match), while vector search always returns `top_k` neighbors, relevant or not. That is fine for RRF, and it is one reason RRF behaves well: a retriever with nothing useful to say simply contributes fewer votes.

### The fusion function

Here is the heart of the post. It takes any number of ranked lists, optional per-list weights, and returns ids sorted by fused score.

```python title="hybrid_search.py"
def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
    weights: list[float] | None = None,
) -> list[tuple[str, float]]:
    if weights is None:
        weights = [1.0] * len(rankings)
    if len(weights) != len(rankings):
        raise ValueError("weights must have one entry per ranking")

    fused_scores: dict[str, float] = defaultdict(float)
    for ranking, weight in zip(rankings, weights):
        for rank, doc_id in enumerate(ranking, start=1):
            fused_scores[doc_id] += weight / (k + rank)

    return sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)
```

About fifteen lines, no score normalization, no calibration, works with two retrievers or five.

### Reranking and the full pipeline

The cross-encoder reads (query, passage) pairs and returns one relevance score per pair. We only feed it the fused candidates.

```python title="hybrid_search.py"
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
text_by_id = dict(zip(doc_ids, doc_texts))


def hybrid_search(
    query: str,
    retriever_top_k: int = 50,
    rerank_top_n: int = 20,
    final_top_n: int = 5,
    use_reranker: bool = True,
) -> list[str]:
    keyword_ids = bm25_search(query, top_k=retriever_top_k)
    semantic_ids = vector_search(query, top_k=retriever_top_k)

    fused = reciprocal_rank_fusion([keyword_ids, semantic_ids], k=60)
    candidate_ids = [doc_id for doc_id, _ in fused[:rerank_top_n]]

    if not use_reranker:
        return candidate_ids[:final_top_n]

    pairs = [(query, text_by_id[doc_id]) for doc_id in candidate_ids]
    rerank_scores = reranker.predict(pairs)
    order = np.argsort(rerank_scores)[::-1]
    return [candidate_ids[i] for i in order[:final_top_n]]


if __name__ == "__main__":
    for query in ["what does ERR-4012 mean", "the bank rejected my purchase"]:
        print(query, "->", hybrid_search(query, final_top_n=3))
```

Run it and look at each list separately before fusing. For the `ERR-4012` query, BM25 returns exactly one hit, `kb-101`, because `err-4012` is a rare token and no other document contains it. The vector list ranks `kb-101` first too on this tiny corpus, but it never comes back empty: it fills the ranking with nearest neighbors, related or not. The second query shares no words with `kb-102` ("the bank rejected my purchase" versus "retry declined card transactions"), so BM25 never retrieves it, while the embeddings rank it second. RRF keeps it in the candidate list, fourth, because only one retriever voted for it; the cross-encoder then moves it into the final top three. That is the division of labor: fusion decides what survives, reranking decides the order.

<div class="callout tip" data-title="Tip">
  <p>Always log the individual rankings (<code>keyword_ids</code>, <code>semantic_ids</code>) next to the fused one, at least in staging. When a query goes wrong, the first question is "which retriever missed it?", and you cannot answer that from the fused list alone.</p>
</div>

### The same idea in Postgres with pgvector

If your chunks already live in Postgres, you do not need a separate search engine. Full text search gives you the keyword side (note that `ts_rank_cd` is not exactly BM25, but it is rank-based relevance on an inverted GIN index, which is what RRF needs), and pgvector gives you the vector side. RRF becomes a `FULL OUTER JOIN` on ranks.

```sql title="hybrid_search.sql"
-- One-time setup: the 'simple' config lowercases but does not stem, which is friendlier to codes
ALTER TABLE documents
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX documents_search_tsv_idx ON documents USING GIN (search_tsv);
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);

-- $1 = query text, $2 = query embedding
WITH keyword AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) AS rank
  FROM (
    SELECT id, ts_rank_cd(search_tsv, query) AS score
    FROM documents, websearch_to_tsquery('simple', $1) AS query
    WHERE search_tsv @@ query
    ORDER BY score DESC
    LIMIT 50
  ) AS kw
),
semantic AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY distance) AS rank
  FROM (
    SELECT id, embedding <=> $2 AS distance
    FROM documents
    ORDER BY embedding <=> $2
    LIMIT 50
  ) AS nn
)
SELECT
  COALESCE(keyword.id, semantic.id) AS id,
  COALESCE(1.0 / (60 + keyword.rank), 0.0)
    + COALESCE(1.0 / (60 + semantic.rank), 0.0) AS rrf_score
FROM keyword
FULL OUTER JOIN semantic ON keyword.id = semantic.id
ORDER BY rrf_score DESC
LIMIT 20;
```

The inner subqueries with `ORDER BY ... LIMIT` matter: they let Postgres use the HNSW and GIN indexes and compute ranks only over the top 50, instead of ranking the entire table. How Postgres tokenizes hyphenated codes depends on its parser, so check your real identifiers with `ts_debug('simple', 'ERR-4012')` before trusting it.

### Azure AI Search does RRF for you

Azure AI Search runs a hybrid query when a request contains both `search_text` and a vector query, and it merges the two result sets with RRF on the service side. You can optionally turn on the semantic ranker on top, which plays the reranker role.

```python title="azure_hybrid_search.py"
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

from hybrid_search import embedder  # same model used to index contentVector

search_client = SearchClient(
    endpoint="https://<your-service>.search.windows.net",
    index_name="kb-articles",
    credential=AzureKeyCredential("<your-query-key>"),
)

query = "what does ERR-4012 mean"
query_embedding = embedder.encode(query, normalize_embeddings=True).tolist()

results = search_client.search(
    search_text=query,  # BM25 side
    vector_queries=[
        VectorizedQuery(vector=query_embedding, k_nearest_neighbors=50, fields="contentVector")
    ],
    top=20,  # fused by RRF inside the service
)

for result in results:
    print(result["id"], result["@search.score"])
```

Remember that the query embedding must come from the same model you used to index `contentVector`. Mixing models is a silent, painful bug: everything returns results, and nothing is quite right.

## Production Reality Check

The code above is the easy part. Here is what actually decides whether hybrid search helps or just adds moving parts.

### Tuning: top-k, weights and k

Start with defaults and change one thing at a time against an evaluation set:

- **Per-retriever top-k**: 50 each is a reasonable start. Too small (5 or 10) and RRF has little to work with; the whole point is catching a document that one retriever ranked 30th. Too large and you mostly add noise that costs reranker time.
- **Weights**: if your users type a lot of identifiers, a weight like `[1.5, 1.0]` for BM25 versus vectors nudges exact matches up without silencing semantics. Some teams go further and detect identifier-like tokens in the query (a regex such as the one in `TOKEN_PATTERN` plus a digit check) and raise the BM25 weight only for those queries.
- **k**: leave it at 60 unless evaluation says otherwise. Lower values make the fusion more "winner takes all".

### Reranking latency and cost

A cross-encoder scores every candidate pair, so its cost grows linearly with how many candidates you send. A small model like the MiniLM one above is fast on a GPU and tolerable on a CPU for a couple dozen candidates; larger rerankers are noticeably more accurate and noticeably slower. Hosted rerank APIs remove the infrastructure but add a network hop and a per-call bill.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If the reranker is the smartest piece, why not skip the fusion and just rerank the top 500 from each retriever?</span>
    </div>
  </div>
</div>

Because you would be paying for 1,000 expensive forward passes per user question to rescue documents ranked 400th, which almost never matter. Each stage exists to shrink the candidate set cheaply before the next, more expensive one: retrievers go from millions to about a hundred, RRF from a hundred to twenty or so, the reranker from twenty to the handful the LLM actually reads. Measure how much the reranker improves your metrics; if the gain is small for your data, dropping it is a perfectly valid latency optimization.

### Evaluate with the queries that hurt

Do not evaluate hybrid search on generic questions only; vector search already does fine there and you will conclude hybrid adds nothing. Build a labeled set that deliberately includes identifier queries: error codes, SKUs, ticket numbers, version strings, people's names. Then compare recall@k for BM25 alone, vectors alone, RRF, and RRF plus reranker.

```python title="evaluate.py"
import numpy as np

from hybrid_search import bm25_search, hybrid_search, vector_search

# Each query maps to the ids of the chunks that actually answer it
eval_set = {
    "what does ERR-4012 mean": {"kb-101"},
    "stock wrong for SKU-88213-B": {"kb-103"},
    "my card payment was refused": {"kb-104", "kb-102"},
}


def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant)


strategies = {
    "bm25": lambda q: bm25_search(q),
    "vector": lambda q: vector_search(q),
    "rrf": lambda q: hybrid_search(q, final_top_n=10, use_reranker=False),
    "rrf+rerank": lambda q: hybrid_search(q, final_top_n=10),
}

for name, search in strategies.items():
    recalls = [recall_at_k(search(q), relevant, k=3) for q, relevant in eval_set.items()]
    print(f"{name:>10}  recall@3 = {np.mean(recalls):.2f}")
```

Slice the results by query type. The typical pattern is that vectors win on paraphrase queries, BM25 wins on identifier queries, and RRF is close to the best of both on each slice. If RRF is clearly worse than one retriever on a slice, look at weights or at the other retriever's candidate quality, not at `k`.

<div class="callout warning" data-title="Warning">
  <p>Recall is measured on retrieval, not on the final answer. A chunk can be retrieved and still be ignored or misread by the LLM. Track retrieval metrics (<code>recall@k</code>, MRR) and answer quality separately, or you will not know which layer to fix.</p>
</div>

### Failure modes to watch

- **Tokenization of codes**: the analyzer in your search engine may split `ERR-4012` on the hyphen or strip `v3.11.2` into pieces. Test your real identifiers against the actual analyzer. In Elasticsearch, OpenSearch or Azure AI Search you may need a custom analyzer or a separate keyword field for codes.
- **Stemming**: great for prose ("running" matches "run"), harmful for identifiers and product names. A common pattern is two fields: a stemmed one for text and an unstemmed one for codes, both queried on the keyword side.
- **Multilingual text**: BM25 is language-dependent (stop words, stemmers, compound words), while multilingual embedding models handle cross-language similarity. For a corpus mixing English and Portuguese, use per-language analyzers or a language-neutral one, and expect the vector side to carry cross-language queries.
- **Stale indexes**: two retrievers means two indexes that must stay in sync. If a document is updated in the vector store but not in the keyword index, RRF happily fuses an old version with a new one. Update both from the same ingestion pipeline, keyed by the same chunk id, and monitor document counts on each side.
- **Chunk id mismatch**: RRF joins by id. If one index uses `doc-12#3` and the other `doc-12_chunk3`, nothing ever overlaps and you silently lose the consensus benefit.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So hybrid search means my RAG is fixed and I can stop worrying about retrieval?</span>
    </div>
  </div>
</div>

It means you stopped losing the easy wins. Chunking strategy, metadata filters, query rewriting and freshness still matter, and they will show up in your evaluation as soon as the identifier problem is gone. The good news is that hybrid search with RRF is one of the cheapest upgrades in the RAG toolbox: one extra index, one short function, and a class of "the answer was right there!" bugs disappears. Build the eval set, run the four strategies, and let the numbers tell you whether the reranker earns its latency.
