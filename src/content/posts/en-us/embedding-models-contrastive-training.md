---
title: "How Embedding Models Learn: Contrastive Training and What It Means for Retrieval"
description: "How contrastive training shapes an embedding model, and the prefixes, pooling, normalization and truncation details that decide whether it retrieves well on your data."
date: 2026-09-10
tags: [Embeddings, RAG, Python, Evaluation]
tldr:
  - "An embedding model is trained with InfoNCE: pull a query toward its passage, push it away from the rest of the batch. Its prefixes, pooling and normalization come from that training, and your code has to match them."
  - "On a small internal IT support set, a one-minute fine-tune of e5-small-v2 with in-batch and hard negatives took held-out recall@1 from 0.698 to 0.854, and the aggregate hid one slice that got worse."
  - "Truncating dimensions without renormalizing halved recall@1 at 64 dims on the base model; a Matryoshka loss kept 32 dims at 0.844 recall@1. Measure on your own labeled pairs, per slice."
---

Picture an internal helpdesk bot. An employee types "the vpn disconnects when I'm working from a hotel", and the bot confidently explains how to reset your password for Harbor, the company's remote access client. The right article exists. It's called "Harbor troubleshooting", it mentions hotel wifi, and it sits at rank three. Nobody on the team typed "vpn" into the knowledge base, because internally everyone calls it Harbor.

The team's first instinct is to swap in a bigger embedding model. The second is to lower the similarity threshold. Neither touches the actual problem: the model was trained on the public web, it has never heard of Harbor, and a handful of details in how the pipeline calls it (prefixes, pooling, normalization, how many dimensions get stored) were copied from a tutorial without anyone knowing why they matter. This post is about how embedding models learn, because once you see the training objective, those details stop looking like trivia. Then we fine-tune one on a small, realistic domain set and measure everything with real numbers.

## The Problem & Context

An embedding model looks like a black box that turns text into a vector, and most RAG code treats it that way: call `encode()`, store the result, compute cosine similarity at query time. But the vector only means something relative to how the model was trained. The training objective decides which texts end up close together. The training data decides what "close" means for your vocabulary. And a set of conventions baked in during training (a prefix on queries, a specific pooling of token states, normalization to unit length, a temperature that shapes the score distribution) are part of the interface, even though nothing in the API enforces them.

When I review retrieval pipelines that underperform, the model is rarely the problem on its own. Far more often it's being used differently from how it was trained: the wrong pooling, the query prefix on the documents, vectors truncated to fit a column size, a threshold tuned for one model and reused for another. None of these throw an error. They just make retrieval a few points worse, silently, and the LLM on top papers over the gap with fluent answers.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>An embedding is just the model's hidden state, right? Grab the [CLS] vector from any BERT and you're done.</span>
    </div>
  </div>
</div>

A raw BERT was trained to predict masked tokens, not to place similar sentences near each other, and its sentence vectors are poor for similarity: the Sentence-BERT paper found that BERT's [CLS] output and averaged BERT token vectors did worse than plain averaged GloVe embeddings on semantic similarity. [Sentence-BERT (Reimers and Gurevych, 2019)](https://arxiv.org/abs/1908.10084) closed that gap by fine-tuning BERT in a siamese setup so that cosine similarity became meaningful. And even with a proper embedding model, the pooling has to match the one it was trained with. On the dataset below, taking the [CLS] vector from `e5-small-v2` (trained with mean pooling) instead of the mean dropped recall@1 from 0.788 to 0.669 across 480 queries. Same weights, same text, one line of code.

## Deep Dive / Architectural Design

### Bi-encoders and cross-encoders

There are two ways to use a transformer to judge whether a passage answers a query.

<div id="emb-bi-vs-cross-encoder-slot"></div>

A **bi-encoder** encodes the query and the passage separately, each into one vector, and compares the vectors. Because passages never see the query, you can encode the whole corpus once, offline, and put it in a vector index. A search costs one forward pass for the query plus fast vector comparisons. The Sentence-BERT paper puts the difference in numbers: finding the most similar pair among 10,000 sentences takes about 65 hours with BERT as a cross-encoder and about 5 seconds with SBERT embeddings.

A **cross-encoder** concatenates the query and the passage into one input and lets attention run across both texts, then outputs a single relevance score. It sees interactions a bi-encoder can't (this word in the query negates that phrase in the passage), so it's more accurate, but it needs a forward pass per pair and nothing can be precomputed. That's why the standard architecture is a bi-encoder (often next to BM25, as in [hybrid search with RRF](/en-us/blog/hybrid-search-bm25-vectors-rrf/)) to fetch a few dozen candidates, then a cross-encoder to rerank them. Everything in this post is about the bi-encoder side, the part that decides what the reranker ever gets to see.

### Pooling: mean, CLS or last token

A transformer outputs one vector per token. A bi-encoder needs one vector per text, so something has to pool them:

- **Mean pooling** averages the token vectors, masking out padding. Sentence-BERT uses it by default and so does E5: the [e5-small-v2 model card](https://huggingface.co/intfloat/e5-small-v2) averages the last hidden states over non-padding tokens.
- **CLS pooling** takes the first token's final state. The [BGE models](https://huggingface.co/BAAI/bge-small-en-v1.5) are trained this way.
- **Last-token pooling** takes the final non-padding token, which is the only position that has attended to the whole input in a decoder-only model. LLM-based embedders such as [e5-mistral-7b-instruct](https://huggingface.co/intfloat/e5-mistral-7b-instruct) use it.

None of these is better in general. What matters is that the pooling at inference is the one the model was trained with, because training shaped the representation around it. Padding is the classic bug with mean pooling: if you average without the attention mask, the length of the longest text in the batch changes every embedding in it.

### Contrastive training and InfoNCE

Modern embedding models are trained contrastively. You have pairs (a query and a passage that answers it) and the model learns to score the true pair higher than every wrong pairing. The loss almost everyone uses is InfoNCE, introduced for representation learning by [van den Oord et al. (2018)](https://arxiv.org/abs/1807.03748). For query `i` with positive passage `d_i` and candidate passages `d_1 .. d_N`:

`loss_i = -log( exp(s(q_i, d_i) / t) / sum_j exp(s(q_i, d_j) / t) )`

where `s` is cosine similarity and `t` is a temperature. Read it as a classification problem: the model gets N candidates, softmaxes their similarities, and is penalized by the negative log probability it gave to the right one. With N candidates and no knowledge, the loss is `log(N)`; a perfect model drives it toward zero.

The trick that makes this cheap is **in-batch negatives**. Put B pairs in a batch, encode all queries and all passages, and compute the full B x B similarity matrix. The diagonal holds the true pairs; every off-diagonal cell is a free negative, since query 3's passage is almost certainly not an answer to query 7. One batch of 32 pairs gives each query 31 negatives for the price of encoding 64 texts. [DPR (Karpukhin et al., 2020)](https://arxiv.org/abs/2004.04906) trained this way, adding one BM25-retrieved hard negative per question, and beat a strong Lucene BM25 by 9 to 19 points absolute in top-20 retrieval accuracy on open-domain QA.

<div id="emb-infonce-training-step-slot"></div>

### Temperature

Dividing cosines by `t` before the softmax controls how peaked the distribution is. Cosine lives in [-1, 1], so without scaling the logits are too close together for the softmax to express confidence. With `t = 0.05`, a cosine gap of 0.1 becomes a logit gap of 2, and the loss concentrates on the negatives that score closest to the positive. [SimCSE (Gao et al., 2021)](https://arxiv.org/abs/2104.08821) found 0.05 worked best for their setup and that cosine beat plain dot product at that temperature. E5 used 0.01.

The temperature leaves a visible fingerprint. The e5-small-v2 card warns that its cosine scores cluster between 0.7 and 1.0 because of the low training temperature, and that only the relative order matters. On my data, two unrelated KB articles scored 0.817 on average with the base model. That number becomes important later.

### Hard negatives, and the negatives that aren't

Random in-batch negatives are mostly easy. An article about printer quotas is trivially different from a question about VPN drops, so the model learns little from it. **Hard negatives** are passages that look relevant but aren't: the same tool with a different problem, the same error message on a different platform. They force the model to learn the distinction you actually care about. That's why DPR added BM25 negatives, why supervised SimCSE uses NLI contradictions as hard negatives, and why [GTE (Li et al., 2023)](https://arxiv.org/abs/2308.03281) notes that in its fine-tuning stage "a large batch size is unnecessary since hard negatives can already provide a reliable gradient estimation". GTE also enlarges the negative pool for free by contrasting queries against other in-batch queries and documents against documents, not just queries against documents.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So harder is better. I'll take the top 10 results my current retriever returns, drop the labeled answer, and use the other 9 as negatives.</span>
    </div>
  </div>
</div>

That's the fastest way to teach a model to reject correct answers. Labels are incomplete: annotators mark one or two good passages and never look at the rest. [RocketQA (Qu et al., 2020)](https://arxiv.org/abs/2010.08191) manually checked top-retrieved MS MARCO passages that weren't labeled positive and found about 70% were actually positives or highly relevant. Training with them as negatives made their retriever significantly worse, and they fixed it by filtering candidates with a cross-encoder first. Mine negatives from a rank band (say 10 to 50, not 1 to 10), filter with a reranker, or build them from structure you trust, like "same tool, different issue" below.

False negatives also appear inside a batch with no mining at all. If two queries in a batch share the same positive passage (common when a KB article answers many questions), each query's positive shows up as a "negative" in the other's row. The loss then asks the model to prefer a passage over itself, which it can't, so those rows can never go below `log(2)`. The fix is a mask: exclude any off-diagonal cell that holds the same passage as the row's positive.

### Asymmetric prefixes

A query and a passage are different kinds of text. "harbor drops at hotel" is short and underspecified; the article is long and declarative. Many models let the encoder know which side it's encoding. E5 was trained with `query: ` and `passage: ` prefixes, and [its paper (Wang et al., 2022)](https://arxiv.org/abs/2212.03533) reports it was the first model to beat BM25 on the BEIR benchmark zero-shot without labeled data. The model card is explicit: use `query: ` and `passage: ` for asymmetric retrieval, `query: ` on both sides for symmetric tasks like similarity, and expect a degradation without them. Instruction-tuned embedders take it further: e5-mistral puts a task instruction on the query side only, and BGE v1.5 recommends an instruction for retrieval queries while noting it degrades only slightly without one.

The prefix is not decoration. During training, the model learned to put the `query: ` text in a region of the space that faces the `passage: ` text. Forget it, or put the wrong one on the documents, and you're querying from a place the model never trained for. We'll measure how much that costs.

### Anisotropy and normalization

Pretrained transformers produce anisotropic representations: [Ethayarajh (2019)](https://arxiv.org/abs/1909.00512) showed contextual embeddings occupy a narrow cone of the space, so any two texts have high cosine similarity. SimCSE analyzed this with the alignment and uniformity framework of [Wang and Isola (2020)](https://arxiv.org/abs/2005.10242) and showed that the contrastive objective "flattens" the singular value spectrum, spreading embeddings more uniformly, because pushing negatives apart is exactly what uniformity asks for.

Two practical consequences. First, the absolute value of a cosine is model-specific: 0.8 can mean "unrelated" for one model and "near duplicate" for another. Second, normalize. InfoNCE is trained on cosine, so the model's geometry lives on the unit sphere. Normalize every vector to unit length when you store it, and then cosine, dot product and (monotonically) Euclidean distance all give the same ranking, which is what you want when [configuring the vector database](/en-us/blog/vector-database-performance-settings/).

### Matryoshka representations

Storage grows linearly with dimensions, and so does the cost of every comparison. [Matryoshka Representation Learning (Kusupati et al., 2022)](https://arxiv.org/abs/2205.13147) trains the model so that the first k dimensions are a good embedding on their own, for several nested k at once. The implementation is almost embarrassingly simple: compute the same contrastive loss on the first 32, 64, 128, 256 and all dimensions, and average. The paper reports up to 14x smaller embeddings for ImageNet classification at the same accuracy, and up to 14x real-world speed-ups for large-scale retrieval on ImageNet-1K and 4K.

The catch: truncation only works if the model was trained for it, and a truncated vector is no longer unit length. If your index stores vectors that were normalized at full size and then cut, a dot product is now also measuring how much of each vector's norm happened to fall into the first k dimensions.

## Hands-On Implementation

Everything below ran on a laptop: `intfloat/e5-small-v2` (12 layers, 384 dimensions, about 130 MB of weights), PyTorch 2.11 and transformers 5.17, on an 8 GB laptop GPU that peaked at about 2 GB. One training run takes about a minute, including evaluation. No sentence-transformers: the point is to see every piece.

### InfoNCE from scratch, with a numeric check

The loss is a few lines once you see it as cross-entropy over a similarity matrix. The false negative mask is the only subtle part.

```python title="infonce.py"
import math

import torch
import torch.nn.functional as F


def info_nce(q, d, temperature=0.05, pos_ids=None, doc_ids=None):
    """q: (B, H) queries. d: (N, H) documents, where d[i] is the positive of q[i]
    and rows B..N-1 are extra (hard) negatives. Every other row is a negative."""
    q = F.normalize(q, dim=-1)
    d = F.normalize(d, dim=-1)
    logits = q @ d.T / temperature                      # (B, N) scaled cosine similarities
    targets = torch.arange(q.size(0), device=q.device)  # the positive sits on the diagonal
    if pos_ids is not None:
        # A "negative" that is actually the same document as the positive is a false negative:
        # mask it out instead of pushing the query away from its own answer.
        same = pos_ids[:, None] == doc_ids[None, :]
        same[targets, targets] = False
        logits = logits.masked_fill(same, float("-inf"))
    return F.cross_entropy(logits, targets)


def info_nce_by_hand(q, d, temperature):
    """The same loss, one query at a time, with nothing but math."""
    total = 0.0
    for i in range(len(q)):
        sims = [F.cosine_similarity(q[i], d[j], dim=0).item() / temperature for j in range(len(d))]
        total += -(sims[i] - math.log(sum(math.exp(s) for s in sims)))
    return total / len(q)


if __name__ == "__main__":
    torch.manual_seed(0)
    q, d = torch.randn(4, 8), torch.randn(6, 8)
    for t in (1.0, 0.05):
        print(f"t={t}: torch={info_nce(q, d, t).item():.6f} by_hand={info_nce_by_hand(q, d, t):.6f}")
    print(f"chance level log(N) = {math.log(6):.6f}")

    aligned = d[:4] + 0.1 * torch.randn(4, 8)
    print(f"aligned queries, t=0.05: {info_nce(aligned, d, 0.05).item():.6f}")

    pos_ids = torch.tensor([0, 1, 2, 2])
    doc_ids = torch.tensor([0, 1, 2, 2, 7, 8])
    dup = d.clone()
    dup[3] = dup[2]  # queries 2 and 3 share an answer, so each one's positive is in the other's row
    dup_q = dup[:4] + 0.1 * torch.randn(4, 8)
    print(f"duplicate positive, unmasked: {info_nce(dup_q, dup, 0.05).item():.6f}")
    print(f"duplicate positive, masked:   {info_nce(dup_q, dup, 0.05, pos_ids, doc_ids).item():.6f}")
```

```text title="output"
t=1.0: torch=1.881182 by_hand=1.881182
t=0.05: torch=8.538165 by_hand=8.538165
chance level log(N) = 1.791759
aligned queries, t=0.05: 0.001479
duplicate positive, unmasked: 0.346596
duplicate positive, masked:   0.000022
```

The vectorized loss and the loop agree to six decimals at both temperatures. With random vectors and `t = 1` the loss sits near chance (`log 6 = 1.79`); at `t = 0.05` the same random vectors cost 8.5, because the sharper softmax punishes confident mistakes hard. Queries that are close to their passages drive it to almost zero.

The last two lines are the false negative problem in miniature. Queries 2 and 3 share a passage. Unmasked, each of them can at best split its probability between two identical columns, so each costs exactly `log 2 = 0.693`, and the batch average is stuck at `2 x 0.693 / 4 = 0.3466`, no matter how good the model gets. Masked, the loss goes to zero as it should.

### A small domain retrieval set

I generated a synthetic but realistic internal IT support set: 12 internal tools with made-up names (Harbor is the remote access client, Keystone the SSO portal, Beacon the authenticator, Quill the print service, and so on), 5 issue types each (sign-in failure, new device setup, an error code, a performance problem, an access request), so 60 KB passages. Each passage gets 8 employee-style queries that refer to the tool by its internal name or by what people actually call it ("the vpn", "mfa", "the printer", "outlook"). The set is in English because e5-small-v2 only supports English text.

```python title="data.py (excerpt)"
SYSTEMS = {
    "harbor": dict(
        name="Harbor", kind="remote access client", aliases=["the vpn", "vpn", "remote access", "Harbor"],
        code="HB-417", code_means="the device certificate expired", code_fix="open Atlas Self Service and run 'Renew device certificate', then restart Harbor",
        signin_cause="Harbor caches your old password for 24 hours after a change", signin_fix="choose 'Forget saved credentials' in the tray menu and sign in again",
        setup="install Harbor from Atlas Self Service, pick the 'Corp-Full' profile and approve the Beacon push",
        perf_user="disconnects when I'm working from a hotel", perf_symptom="drops every few minutes on hotel wifi", perf_cause="captive portals and UDP blocking on public networks", perf_fix="switch the transport to 'TCP 443' under Settings, Advanced",
        access="access to the lab network segment", approver="your manager and the Network team", form="the 'Network segment access' form in the service desk",
        action="connect from home",
    ),
    # ... 11 more tools: keystone, beacon, relay, quill, atlas, ledger, pulse, vault, dock, forge, switchboard
}

ISSUES = ["signin", "setup", "error", "perf", "access"]

PASSAGES = {
    "signin": "{name} ({kind}): cannot sign in. Most often {signin_cause}. To fix it, {signin_fix}. If it still fails, open a ticket in the {name} queue.",
    "setup": "Setting up {name} on a new device. {kind_cap}. Steps: {setup}. Your settings follow your account, nothing needs to be copied from the old device.",
    "error": "{name} error {code}. This error means {code_means}. Resolution: {code_fix}. The code shows up when you try to {action}.",
    "perf": "{name} troubleshooting: it {perf_symptom}. Cause: {perf_cause}. Workaround: {perf_fix}.",
    "access": "Requesting {access} in {name}. Approval comes from {approver}. File {form}; it usually takes one business day once approved.",
}

# QUERIES holds 8 employee-style templates per issue, e.g. "{alias} keeps rejecting my password
# but it works everywhere else", "what does {code} mean", "{alias} is acting up, it {perf_user}".


def build(seed: int = 7):
    rng = random.Random(seed)
    corpus, queries = [], []
    for s_i, (key, s) in enumerate(SYSTEMS.items()):
        fields = dict(s, kind_cap=s["kind"][0].upper() + s["kind"][1:])
        for i_i, issue in enumerate(ISSUES):
            pid = f"{key}-{issue}"
            corpus.append({"id": pid, "system": key, "issue": issue, "text": PASSAGES[issue].format(**fields)})
            # One issue per system is held out entirely: its article never appears in training.
            split = "test" if i_i == s_i % len(ISSUES) else "train"
            for q_i, template in enumerate(QUERIES[issue]):
                alias = s["aliases"][q_i % len(s["aliases"])]
                text = template.format(alias=alias, **{k: v for k, v in fields.items() if k != "alias"})
                queries.append({"text": text, "pos": pid, "split": split})
    rng.shuffle(queries)
    return corpus, queries
```

```text title="output"
passages=60 train_queries=384 test_queries=96
```

The split is the important design decision. I didn't split queries at random, because then the test set would ask about articles the model already saw paired with near-identical questions, and fine-tuning would look like magic. Instead, one whole article per tool is held out: its 8 queries are the test set, and the article is never used in training, not even as a negative. For Harbor, the held-out article is the sign-in one: the model trains on Harbor's setup, error, performance and access questions, and at test time has to find the Harbor sign-in article for questions it has never seen. Retrieval always runs against all 60 passages. That's closer to the real situation: new KB articles and new questions appear after you train.

### Encoding, pooling and metrics

```python title="embed.py (excerpt)"
import json

import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

MODEL = "intfloat/e5-small-v2"
device = "cuda" if torch.cuda.is_available() else "cpu"


def load(path=MODEL):
    return AutoTokenizer.from_pretrained(path), AutoModel.from_pretrained(path).to(device)


def pool(hidden, mask, how="mean"):
    if how == "cls":
        return hidden[:, 0]
    if how == "last":  # decoder-style models: the last non-padding token (right padding assumed)
        return hidden[torch.arange(hidden.size(0)), mask.sum(1) - 1]
    mask = mask.unsqueeze(-1).to(hidden.dtype)
    return (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)  # padding must not count


def embed(tok, model, texts, prefix="", how="mean", max_len=96):
    batch = tok([prefix + t for t in texts], padding=True, truncation=True, max_length=max_len, return_tensors="pt").to(device)
    out = model(**batch).last_hidden_state
    return pool(out, batch["attention_mask"], how)


@torch.no_grad()
def encode(tok, model, texts, prefix="", how="mean", bs=64):
    model.eval()
    return torch.cat([embed(tok, model, texts[i:i + bs], prefix, how) for i in range(0, len(texts), bs)]).float().cpu()


def evaluate(Q, D, pos_idx, dims=None, renorm=True):
    """Q, D: raw embeddings. pos_idx[i]: row of D that answers query i.
    dims: keep only the first `dims` coordinates. renorm=False keeps vectors that were
    normalized at full size and then cut, scored by plain dot product."""
    Q, D = F.normalize(Q, dim=-1), F.normalize(D, dim=-1)
    if dims:
        Q, D = Q[:, :dims], D[:, :dims]
        if renorm:
            Q, D = F.normalize(Q, dim=-1), F.normalize(D, dim=-1)
    scores = Q @ D.T
    pos_scores = scores[torch.arange(len(Q)), pos_idx]
    rank = (scores > pos_scores[:, None]).sum(1) + 1  # 1 = the right passage came first
    return {
        "R@1": (rank <= 1).float().mean().item(),
        "R@5": (rank <= 5).float().mean().item(),
        "MRR": (1.0 / rank).mean().item(),
        "nDCG@10": torch.where(rank <= 10, 1 / torch.log2(rank.float() + 1), torch.zeros(len(rank))).mean().item(),
    }
```

`load_data()` and `fmt()` (JSON loading and printing) are omitted. With exactly one relevant passage per query, the metrics simplify nicely: recall@k is "was the answer in the top k", MRR is the mean of `1 / rank`, and nDCG@10 is `1 / log2(rank + 1)` when the answer is in the top 10 and zero otherwise. These are the numbers I trust for a retrieval stage, as argued in [building a RAG retrieval test set](/en-us/blog/rag-evaluation-retrieval-test-set/).

### Baseline: prefixes and pooling

Before training anything, how does the stock model do, and how much do the conventions matter? Since the base model hasn't seen any of these queries, I can score it on all 480 of them for tighter numbers.

```text title="output"
base model, all 480 queries
  query: / passage:  R@1=0.788 R@5=0.938 MRR=0.855
  no query prefix    R@1=0.781 R@5=0.940 MRR=0.849
  no prefixes        R@1=0.775 R@5=0.935 MRR=0.845
  query: on both     R@1=0.740 R@5=0.917 MRR=0.815
  CLS pooling        R@1=0.669 R@5=0.865 MRR=0.750
```

This is more nuanced than "always use the prefix". Forgetting the query prefix cost less than a point of recall@1 here, and dropping both prefixes about 1.3 points. On short, keyword-heavy helpdesk text, e5-small-v2 is fairly forgiving. The mistake that hurt was the copy-paste bug: `query: ` on the passages too, which is what you get when one `embed()` helper with a hardcoded prefix is used for indexing and search. That cost 4.8 points of recall@1. The wrong pooling cost 11.9. None of these configurations raised an error or produced an obviously broken result; they just ranked worse.

On the 96 held-out queries (the ones used to judge fine-tuning), the correct configuration scores:

```text title="output"
query: / passage:          R@1=0.698 R@5=0.927 MRR=0.790 nDCG@10=0.832
```

### The training loop

Plain transformers, AdamW, mean pooling, temperature 0.05, batches of 32 queries. For hard negatives I use structure I trust instead of mining: for each query, a random passage from the same tool with a different issue, restricted to training articles. The false negative mask is on by default.

```python title="train.py"
import argparse
import random

import torch
import torch.nn.functional as F

from data import ISSUES
from embed import embed, encode, evaluate, fmt, load, load_data
from infonce import info_nce

p = argparse.ArgumentParser()
p.add_argument("--hard", action="store_true", help="add one hard negative per query")
p.add_argument("--no-mask", action="store_true", help="leave false negatives in the batch")
p.add_argument("--matryoshka", action="store_true", help="apply the loss at 384/256/128/64/32 dims")
p.add_argument("--epochs", type=int, default=8)
p.add_argument("--seed", type=int, default=0)
p.add_argument("--bs", type=int, default=32)
p.add_argument("--save", default="")
args = p.parse_args()

random.seed(args.seed)
torch.manual_seed(args.seed)
corpus, row, train, test = load_data()
tok, model = load()
docs = [p["text"] for p in corpus]
train_ids = {q["pos"] for q in train}  # held-out articles are never used, not even as negatives
DIMS = [384, 256, 128, 64, 32] if args.matryoshka else [384]


def hard_negative(pid):
    system, issue = pid.split("-", 1)
    return f"{system}-{random.choice([i for i in ISSUES if i != issue and f'{system}-{i}' in train_ids])}"


def score(m):
    Q = encode(tok, m, [q["text"] for q in test], "query: ")
    D = encode(tok, m, docs, "passage: ")
    return evaluate(Q, D, torch.tensor([row[q["pos"]] for q in test]))


print("before:", fmt(score(model)))
opt = torch.optim.AdamW(model.parameters(), lr=3e-5, weight_decay=0.01)
bs, collisions = args.bs, 0
for epoch in range(args.epochs):
    random.shuffle(train)
    model.train()
    for i in range(0, len(train) - bs + 1, bs):
        batch = train[i:i + bs]
        pos_ids = [q["pos"] for q in batch]
        doc_ids = pos_ids + ([hard_negative(pid) for pid in pos_ids] if args.hard else [])
        collisions += len(pos_ids) - len(set(pos_ids))
        q = embed(tok, model, [x["text"] for x in batch], "query: ")
        d = embed(tok, model, [docs[row[pid]] for pid in doc_ids], "passage: ")
        ids = torch.tensor([row[pid] for pid in doc_ids], device=q.device)
        mask = {} if args.no_mask else {"pos_ids": ids[:bs], "doc_ids": ids}
        loss = sum(info_nce(q[:, :k], d[:, :k], 0.05, **mask) for k in DIMS) / len(DIMS)
        opt.zero_grad()
        loss.backward()
        opt.step()
    print(f"epoch {epoch + 1} loss={loss.item():.4f}")

print(f"duplicate positives seen in batches: {collisions}")
print("after: ", fmt(score(model)))
print(f"peak GPU memory: {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB")
if args.save:
    model.save_pretrained(args.save)
    tok.save_pretrained(args.save)
```

The Matryoshka variant is the single line computing `loss`: the same InfoNCE on the first `k` dimensions for each `k`, averaged. Nothing else changes.

```bash title="terminal"
python train.py --hard
```

```text title="output"
before: R@1=0.698 R@5=0.927 MRR=0.790 nDCG@10=0.832
epoch 1 loss=0.4975
epoch 2 loss=0.2709
epoch 3 loss=0.0805
epoch 4 loss=0.0502
epoch 5 loss=0.0119
epoch 6 loss=0.0051
epoch 7 loss=0.0055
epoch 8 loss=0.0075
duplicate positives seen in batches: 751
after:  R@1=0.854 R@5=0.979 MRR=0.905 nDCG@10=0.929
peak GPU memory: 2030 MiB
```

On articles the model never saw during training, recall@1 went from 0.698 to 0.854 and MRR from 0.790 to 0.905, in 96 optimizer steps and about 75 seconds of wall time, evaluation included. The model learned that "the vpn" means Harbor and "mfa" means Beacon, and applied it to question types it had never seen paired for that tool. The duplicate counter shows why the mask exists: with 48 training articles and 32 queries per batch, about 8 rows per batch shared their positive with another row.

### Did hard negatives and the mask matter?

One run proves nothing, so I repeated each configuration with three seeds.

| Configuration (batch 32) | R@1, seeds 0 / 1 / 2 | MRR, seeds 0 / 1 / 2 |
|---|---|---|
| In-batch negatives only | 0.854 / 0.854 / 0.854 | 0.906 / 0.904 / 0.903 |
| + 1 hard negative per query | 0.854 / 0.854 / 0.854 | 0.905 / 0.907 / 0.908 |
| + hard negative, no false negative mask | 0.854 / 0.865 / 0.844 | 0.900 / 0.920 / 0.894 |

At batch 32, the three are indistinguishable. That's a real result, not a failure of the experiment, and it has a clear explanation: with only 60 articles, a batch of 32 queries already covers most tools, so the "same tool, different issue" passage is usually in the batch as an in-batch negative anyway. The hard negative adds little that random sampling hadn't already provided. The unmasked runs wobble more between seeds but don't clearly lose.

To make in-batch negatives behave more like they would in a real corpus of thousands of articles, where a random batch almost never contains the confusable passage, I shrank the batch to 8 queries (`--bs 8`) and ran the comparison again.

| Configuration (batch 8) | R@1, seeds 0 / 1 / 2 | MRR, seeds 0 / 1 / 2 |
|---|---|---|
| In-batch negatives only | 0.844 / 0.833 / 0.865 | 0.900 / 0.897 / 0.909 |
| + 1 hard negative per query | 0.865 / 0.854 / 0.875 | 0.912 / 0.905 / 0.925 |

Now the hard negative wins in every seed, by one or two queries out of 96 in recall@1 and about a point of MRR. Small, but in the same direction three times out of three, and it's the regime that matters: when the corpus is much bigger than the batch, random negatives are easy, and the hard negative is the only thing teaching the model that Beacon's sign-in article is not the answer to a Beacon setup question.

### Truncating dimensions, with and without renormalizing

Next, the question every vector database bill eventually raises: can I store fewer dimensions? For each model I kept the first `k` dimensions and scored two ways: renormalized (cosine on the truncated vectors) and raw (vectors normalized at 384 dims, then cut, scored with dot product, which is what happens if you truncate stored unit vectors and leave the index on inner product).

```text title="output"
base e5-small-v2
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.698        0.698       0.790        0.790
 256       0.635        0.615       0.742        0.714
 128       0.531        0.417       0.665        0.527
  64       0.458        0.229       0.584        0.347
  32       0.312        0.198       0.424        0.330

fine-tuned
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.854        0.854       0.905        0.905
 256       0.854        0.854       0.904        0.902
 128       0.833        0.833       0.884        0.882
  64       0.802        0.802       0.850        0.851
  32       0.729        0.771       0.810        0.843

fine-tuned + MRL
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.854        0.854       0.902        0.902
 256       0.854        0.854       0.900        0.899
 128       0.865        0.854       0.903        0.891
  64       0.854        0.812       0.895        0.858
  32       0.844        0.792       0.896        0.866
```

Three things stand out. The base model, which was never trained for truncation, degrades steadily, and forgetting to renormalize makes it far worse: at 64 dimensions, recall@1 is 0.458 renormalized and 0.229 raw, half. With the Matryoshka loss, 32 dimensions (a twelfth of the storage) kept recall@1 at 0.844 against 0.854 at full size, and MRR barely moved. The plain fine-tuned model sits in between, and at 32 dims raw dot product happened to beat renormalizing, a reminder that on 96 queries a few points is within noise. The renormalization rule is still the one to follow: it's the only version that matches how the model was trained.

## Production Reality Check

### The aggregate hides the slice that got worse

Here's the result that made me glad I didn't stop at the headline number. Held-out recall@1 split by issue type, before and after fine-tuning:

```text title="output"
held-out R@1 by issue type
  intfloat/e5-small-v2   signin=0.458 (n=24)  setup=0.667 (n=24)  error=1.000 (n=16)  perf=0.500 (n=16)  access=1.000 (n=16)
  ckpt-plain             signin=1.000 (n=24)  setup=1.000 (n=24)  error=1.000 (n=16)  perf=0.125 (n=16)  access=1.000 (n=16)
```

Sign-in and setup went to perfect. Performance questions collapsed from 0.500 to 0.125. Every miss after training was the same confusion: questions like "the password manager no longer fills in logins on internal sites" or "email is super slow and I can't find old messages" now retrieve the tool's sign-in article. The model learned a shortcut from the training data: a query mentioning logins or not finding something is a sign-in problem. The aggregate recall@1 still went up by 15.6 points, so a single-number dashboard would have shipped this happily.

With a real training set, this is where you'd add more varied phrasings for the weak slice, add negatives that specifically separate the confusable pair (the tool's sign-in article as the hard negative for its performance questions), and keep the per-slice report in CI. Slice by whatever your users care about: product, document type, language, query length.

### MTEB is where you start, your labeled pairs are where you decide

[MTEB (Muennighoff et al., 2022)](https://arxiv.org/abs/2210.07316) spans 8 task types, 58 datasets and 112 languages, and its own abstract concludes that no single embedding method dominates across all tasks. Use it to shortlist three or four models of the size you can afford. Then decide on your own data: a few hundred real queries with the passages that answer them, scored with recall@k, MRR and nDCG exactly as above. Internal names like Harbor aren't in any public benchmark, and they're precisely where models differ.

### Fine-tuning moves the whole score distribution

After fine-tuning, the average cosine between two different KB articles dropped from 0.817 to 0.037. Training at temperature 0.05 on a narrow domain spread the articles out across the sphere, far from the 0.7 to 1.0 band the base model lives in.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Great, the fine-tuned model is better. I'll deploy it for queries and re-embed only the new documents, the old vectors are fine.</span>
    </div>
  </div>
</div>

The old vectors are from a different space. Fine-tuning moved every passage, so comparing a new-model query against old-model documents is comparing coordinates from two different maps. Swapping the embedding model means re-embedding the whole corpus, building a new index next to the old one, and cutting over when it's complete. The same goes for anything calibrated on scores: a "no good answer" threshold of 0.8 tuned on the base model would reject almost everything after fine-tuning. Re-tune thresholds on the labeled set every time the model changes, and prefer rank-based logic (top k, reciprocal rank fusion) where you can.

### Treat the conventions as a versioned contract

Everything that affected the numbers above belongs next to the index as metadata: model id and revision, query prefix, passage prefix, pooling, normalization, stored dimensions and the similarity metric. Put indexing and querying behind one module that reads that record, so the prefix can't drift between the ingestion job and the API. A startup check that embeds a fixed probe query and compares it with a stored vector catches most mismatches in one line.

### Truncate only models trained for it

If you want 128 or 64 dimensions, use a model trained with a Matryoshka objective (or train one, it's one line), renormalize after truncating, and check that the vector column and the distance metric in the database match what you actually store. For the base model above, cutting to 128 dims cost 16.7 points of recall@1 even with renormalizing. For the MRL model, nothing. Combine truncation with quantization carefully and measure both together; the [vector database settings post](/en-us/blog/vector-database-performance-settings/) covers the storage side.

### Small data, honest limits

This experiment is deliberately tiny: 60 short synthetic passages, 384 training queries, one GPU minute. It shows the mechanics and the failure modes, not the size of the gain you'll get. Real KB articles are longer (chunking matters, and 96 tokens of `max_len` would truncate them), real queries are messier, and fine-tuning on a few hundred pairs can make a model forget general knowledge. Keep a slice of generic queries in the evaluation to catch that, start from a model that already does reasonably well, use a low learning rate and few epochs, and compare against the cheaper alternatives first: hybrid search with BM25 already catches exact names like "Harbor" and error codes.

Embedding models aren't magic similarity oracles. They're classifiers trained to pick the right passage out of a batch, and every convention around them (the prefix, the pooling, the unit norm, the temperature fingerprint in the scores, how many dimensions survive truncation) is a leftover of that training. Match the conventions, evaluate on your own labeled pairs slice by slice, and fine-tune when your vocabulary is the problem. Then re-embed everything, because the map changed.
