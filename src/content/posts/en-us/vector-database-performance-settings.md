---
title: "Your Vector Database Is Slow Because of These 5 Settings"
description: "Tune HNSW, filters, and vector precision against recall and latency, not defaults."
date: 2026-03-10
tags: [RAG, Vector Search, HNSW, Python, Performance]
tldr:
  - "Measure recall@k against brute force exact search on a sample of your own data before touching any index setting."
  - "Tune ef_search per query for the recall and latency you need, and set M and ef_construction once at build time."
  - "Shrink memory with quantization and smaller dimensions, and never post-filter an approximate top-k without checking how many results survive."
---

A typical RAG prototype runs on a few thousand chunks and answers in milliseconds. Then the real corpus lands: millions of chunks, multiple tenants, metadata filters on every request. Latency creeps up, the database node needs more RAM than anyone budgeted, and answer quality drops a little without a single error in the logs.

Most of the time the culprit is a handful of settings left on defaults or copied from a tutorial built for a different dataset. Vector search is approximate by design, so speed and quality are always a trade-off. The question is whether you choose it on purpose or discover it in production. Let's look at the five settings that decide it, and build a benchmark that shows the curve on your own machine.

## The Problem & Context

Retrieval in RAG boils down to one operation: given a query vector, find the k stored vectors most similar to it. The exact way is brute force. Compare the query against every vector, sort, take the top k. It is simple and always correct, and it scales linearly: ten times the vectors, ten times the work, for every single query.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why not just use exact search? A dot product is cheap and computers are fast.</span>
    </div>
  </div>
</div>

For a small corpus, you should: exact search over tens of thousands of vectors is perfectly reasonable and needs zero tuning. The trouble is the arithmetic at scale. A million vectors with 1536 dimensions means about 1.5 billion multiply-adds per query, reading roughly 6 GB of memory each time. Add concurrent users and CPU and memory bandwidth run out fast. Approximate nearest neighbor (ANN) indexes skip almost all of those comparisons, and the price is that they sometimes miss a true neighbor.

That price has a name: **recall@k**, the fraction of the true top k (from exact search) that the index actually returned. A recall@10 of 0.95 means one result in twenty, on average, is not what exact search would have given you. In RAG, a missed neighbor is a chunk the model never sees, possibly the one that held the answer.

So every decision in this post is a move along one curve: recall on one axis, latency (and memory) on the other.

## Deep Dive / Architectural Design

Most vector databases today default to HNSW (Hierarchical Navigable Small World), including pgvector, Qdrant, Weaviate, Milvus and managed search services. The five settings below apply to all of them, even when the knob has a different name.

### How HNSW works, intuitively

HNSW builds a graph where every vector is a node linked to some of its near neighbors. On top of that base layer it adds sparser layers, each holding a random subset of the nodes, like express lanes on a highway.

<div id="hnsw-layers-slot"></div>

A search enters at the top layer and walks greedily toward the query until no neighbor is closer, then drops a layer and repeats with shorter hops. On the bottom layer it keeps a list of the best candidates found so far and keeps expanding them. The size of that list is the heart of the trade-off.

### Setting 1: M and ef_construction (the shape of the graph)

**M** is the number of links each node keeps (the bottom layer usually allows twice that). More links mean more paths to the true neighbors, so the greedy walk gets stuck less often and recall goes up for the same query effort. The costs are memory, slower inserts and a slower build.

**ef_construction** is the size of the candidate list used to pick each new node's neighbors. Higher values produce a better graph at the cost of build time, without changing memory.

Both are fixed at build time, and changing them means a rebuild. Common defaults sit around M = 16 and ef_construction between 64 and 200, a sane starting point for most text embedding workloads.

### Setting 2: ef_search (the effort per query)

**ef_search** (called `ef` in hnswlib and `hnsw.ef_search` in pgvector) is the size of the candidate list during a query. It must be at least k. Small values are fast and miss neighbors; large values explore more of the graph and approach exact results. Unlike M, you can change it at any time without rebuilding, and in many engines per query or per session.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So I set ef_search to 1000 and M to 64, get perfect recall, and never think about it again?</span>
    </div>
  </div>
</div>

You would get excellent recall and pay for it on every query, plus a bigger, slower index. The recall curve flattens quickly: low to moderate ef_search buys a big jump in recall, high to very high buys almost nothing and keeps adding latency. Find the knee of that curve for your data and pick the cheapest setting that meets your recall target. Higher M shifts the whole curve up; whether that is worth the memory is what the benchmark below answers.

### Setting 3: vector precision (quantization)

By default, every dimension is a 32-bit float. That is often more precision than similarity ranking needs. The memory math for 1 million vectors with 1536 dimensions:

| Format | Bytes per dimension | 1M x 1536 | Typical recall impact |
|---|---|---|---|
| float32 | 4 | 1M x 1536 x 4 = 6,144,000,000 bytes (about 6.1 GB) | Baseline |
| float16 | 2 | about 3.1 GB | Usually negligible |
| int8 (scalar) | 1 | about 1.5 GB | Small, recoverable with rescoring |
| binary (1 bit) | 1/8 | 1M x 1536 / 8 = about 192 MB | Large, needs rescoring and high dimensions |

The graph comes on top. With M = 16, the bottom layer stores up to 32 neighbor ids per node: 32 x 4 bytes = 128 bytes per vector, about 128 MB per million, plus a little for upper layers. At 1536 dimensions the vectors dominate, so precision is the biggest memory lever.

The standard trick to win back quality is **rescoring**: fetch more candidates than you need with the compressed vectors, then rerank that shortlist with full precision vectors kept in cheaper storage. The more aggressive the compression, the bigger the shortlist.

### Setting 4: filtering strategy

Real queries have filters: tenant, language, document type, access groups. How the engine combines them with the ANN search matters enormously.

- **Post-filtering:** get the approximate top k, then drop rows that fail the filter. Simple, and broken for selective filters: if only 1% of vectors match, the top 10 usually contains zero or one of them.
- **Pre-filtering:** restrict the candidates first, then search. Correct, but skipping non-matching nodes during the graph walk can hurt recall for very selective filters, and some engines fall back to brute force over the matching rows (fine when that set is small).
- **Iterative scans:** keep walking the graph until k filtered results are found or a limit is hit.
- **Partitioning:** give each large tenant its own index, collection or partition. The filter disappears, at the cost of more objects to manage.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>My filter is just WHERE tenant_id = 42. The database handles that for me, right?</span>
    </div>
  </div>
</div>

It handles it the way it was designed to, which may be post-filtering. In pgvector, an HNSW index scan returns up to ef_search candidates and the WHERE clause is applied afterward. A small tenant can get two results when it asked for ten, and no error tells you so. Know which strategy your engine uses for your query shape.

### Setting 5: embedding dimensions

Every dimension costs memory and compute on every comparison. A 3072-dimension model needs twice the RAM of a 1536-dimension one and four times that of a 768-dimension one. Two ways out:

- **Smaller models.** Many compact models with 384 to 1024 dimensions retrieve very well on domain text. Test on your own queries, not only on leaderboards.
- **Truncatable embeddings.** Some models are trained so the first N dimensions work as an embedding on their own (Matryoshka representation learning), and several APIs expose this as a dimensions parameter. Truncating 1536 to 512 cuts memory by two thirds, usually with modest quality loss. Renormalize after truncating if you use cosine or dot product.

Dimensions are the most expensive setting to change later, because it means re-embedding the corpus. Decide early, with measurements.

## Hands-On Implementation

The benchmark uses `hnswlib` and `numpy` only (`pip install hnswlib numpy`). It generates seeded, clustered vectors (real embeddings are clumpy, not uniform), computes ground truth by brute force, then measures recall@10 and average single-query latency across several ef_search values for two values of M.

<div class="callout warning" data-title="Warning">
  <p><code>hnswlib</code> is published on PyPI as source only, so <code>pip</code> compiles it and needs a C++ compiler: <code>build-essential</code> on Linux, the Xcode Command Line Tools on macOS, and Visual Studio Build Tools ("Desktop development with C++") on Windows. Without one the install fails; running the benchmark inside a Linux container is the quickest way around it.</p>
</div>

```python title="benchmark.py"
import time

import hnswlib
import numpy as np

DIM = 128
N_VECTORS = 50_000
N_QUERIES = 200
K = 10
SEED = 42


def make_clustered_vectors(n: int, dim: int, n_clusters: int, rng: np.random.Generator) -> np.ndarray:
    # Real embeddings are clumpy (topics, languages, templates), so cluster the data
    centers = rng.normal(size=(n_clusters, dim))
    labels = rng.integers(0, n_clusters, size=n)
    vectors = centers[labels] + rng.normal(scale=1.5, size=(n, dim))
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)  # unit length, like most embedding APIs
    return vectors.astype(np.float32)


def exact_top_k(data: np.ndarray, queries: np.ndarray, k: int) -> np.ndarray:
    # Brute force ground truth: on unit vectors, cosine similarity is just a dot product
    scores = queries @ data.T
    top = np.argpartition(-scores, k, axis=1)[:, :k]
    order = np.argsort(-np.take_along_axis(scores, top, axis=1), axis=1)
    return np.take_along_axis(top, order, axis=1)


def recall_at_k(found: np.ndarray, truth: np.ndarray) -> float:
    hits = sum(len(set(f) & set(t)) for f, t in zip(found, truth))
    return hits / truth.size


def build_index(data: np.ndarray, m: int, ef_construction: int) -> tuple[hnswlib.Index, float]:
    index = hnswlib.Index(space="cosine", dim=data.shape[1])
    index.init_index(max_elements=len(data), ef_construction=ef_construction, M=m, random_seed=SEED)
    start = time.perf_counter()
    index.add_items(data, np.arange(len(data)), num_threads=1)  # one thread keeps the build repeatable
    return index, time.perf_counter() - start


def run_queries(index: hnswlib.Index, queries: np.ndarray, ef_search: int) -> tuple[np.ndarray, float]:
    index.set_ef(ef_search)  # ef_search must be >= K
    labels = []
    start = time.perf_counter()
    for query in queries:  # one query at a time, like an API request
        found, _ = index.knn_query(query, k=K, num_threads=1)
        labels.append(found[0])
    avg_ms = (time.perf_counter() - start) / len(queries) * 1000
    return np.array(labels), avg_ms


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]

    start = time.perf_counter()
    truth = exact_top_k(data, queries, K)
    exact_ms = (time.perf_counter() - start) / len(queries) * 1000
    print(f"exact search (numpy, batched): {exact_ms:.3f} ms/query\n")

    for m in (8, 32):
        index, build_s = build_index(data, m=m, ef_construction=100)
        print(f"M={m:<3} ef_construction=100  build {build_s:.1f}s")
        print(f"  {'ef_search':>9}  {'recall@10':>9}  {'avg latency':>11}")
        for ef_search in (10, 20, 50, 100, 200, 400):
            found, avg_ms = run_queries(index, queries, ef_search)
            print(f"  {ef_search:>9}  {recall_at_k(found, truth):>9.3f}  {avg_ms:>8.3f} ms")
        print()


if __name__ == "__main__":
    main()
```

Read the two tables side by side. With M = 8, recall at the lowest ef_search is poor, climbs steeply, then flattens near 1.0 while latency keeps rising. With M = 32, the whole curve sits higher and reaches the same recall at a much smaller ef_search, while the build takes longer. At this toy scale latencies are tiny and noisy, so focus on the trend and run it more than once. The gap between exact and approximate search widens dramatically as N grows; raise `N_VECTORS` if you have the RAM.

Next, precision. This script compares how much ranking quality survives each format:

```python title="quantization.py"
import numpy as np

from benchmark import DIM, K, N_QUERIES, N_VECTORS, SEED, exact_top_k, make_clustered_vectors, recall_at_k


def top_k(scores: np.ndarray, k: int) -> np.ndarray:
    return np.argsort(-scores, axis=1)[:, :k]


def rescore(candidates: np.ndarray, data: np.ndarray, queries: np.ndarray) -> np.ndarray:
    # Rerank a cheap shortlist with the full float32 vectors
    return np.array([cand[np.argsort(-(data[cand] @ q))[:K]] for cand, q in zip(candidates, queries)])


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]
    truth = exact_top_k(data, queries, K)

    # float16: half the memory, tiny rounding error
    f16 = top_k(queries.astype(np.float16) @ data.astype(np.float16).T, K)

    # int8: a quarter of the memory. Stored vectors are quantized, the query stays float32
    scale = np.abs(data).max(axis=0) / 127
    stored_int8 = np.round(data / scale).astype(np.int8)
    i8 = top_k(queries @ (stored_int8.astype(np.float32) * scale).T, K)

    # binary: 1 bit per dimension (the sign), 1/32 of the memory
    bits_data = np.where(data > 0, 1, -1).astype(np.int32)
    bits_queries = np.where(queries > 0, 1, -1).astype(np.int32)
    binary_scores = bits_queries @ bits_data.T
    binary = top_k(binary_scores, K)

    print(f"{'format':<24} {'bytes/vector':>12} {'recall@10':>10}")
    rows = [
        ("float32 (exact)", DIM * 4, truth),
        ("float16", DIM * 2, f16),
        ("int8 scalar", DIM, i8),
        ("binary", DIM // 8, binary),
    ]
    for oversample in (10, 50):
        shortlist = top_k(binary_scores, K * oversample)
        rows.append((f"binary + rescore x{oversample}", DIM // 8, rescore(shortlist, data, queries)))
    for name, size, found in rows:
        print(f"{name:<24} {size:>12} {recall_at_k(found, truth):>10.3f}")


if __name__ == "__main__":
    main()
```

Expect float16 to be almost indistinguishable from float32 and int8 to lose a little. Binary alone will look terrible, and that is a lesson, not a bug: 128 bits is too coarse to rank these vectors, and a bigger rescoring shortlist recovers much of the loss. Binary is usually applied to high-dimension embeddings (1024 and up) with generous oversampling, and rescoring still needs the float32 vectors somewhere, just not in the hot index.

Finally, the filtering trap, with skewed tenants (one holding about 1% of rows):

```python title="filtering.py"
import numpy as np

from benchmark import DIM, K, N_QUERIES, N_VECTORS, SEED, build_index, make_clustered_vectors


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]

    # Skewed tenants: one big customer, a few medium ones, one small one (about 1% of rows)
    tenants = rng.choice(["big", "medium-a", "medium-b", "small"], size=N_VECTORS, p=[0.7, 0.15, 0.14, 0.01])

    index, _ = build_index(data, m=16, ef_construction=100)
    index.set_ef(400)  # ef_search must be >= the largest k we ask for

    for tenant in ("big", "small"):
        allowed = np.flatnonzero(tenants == tenant)
        print(f"tenant={tenant} ({len(allowed)} vectors)")
        for fetch_k in (K, 100, 400):
            labels, _ = index.knn_query(queries, k=fetch_k)
            # Post-filter: search everything, then drop rows from other tenants
            kept = [[label for label in row if tenants[label] == tenant][:K] for row in labels]
            avg_returned = np.mean([len(row) for row in kept])
            short = np.mean([len(row) < K for row in kept]) * 100
            print(f"  fetch k={fetch_k:<4} avg results {avg_returned:5.1f} of {K}, {short:5.1f}% of queries short")

        # Partitioning: a separate small index per tenant always returns K (if the tenant has K rows)
        tenant_index, _ = build_index(data[allowed], m=16, ef_construction=100)
        tenant_index.set_ef(100)
        labels, _ = tenant_index.knn_query(queries, k=K)
        print(f"  per-tenant index  avg results {labels.shape[1]:5.1f} of {K}\n")


if __name__ == "__main__":
    main()
```

For the big tenant, fetching exactly k already loses results and oversampling fixes it cheaply. For the small tenant, even a large oversample leaves most queries short, while the per-tenant index returns a full top 10 every time. That is the argument for iterative scans or partitioning when filters are selective.

The same knobs exist in pgvector. The operator class in the index must match the query operator (`vector_cosine_ops` with `<=>`), or the index is not used:

```sql title="index.sql (excerpt)"
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
    id bigserial PRIMARY KEY,
    tenant_id int NOT NULL,
    content text NOT NULL,
    embedding vector(1536) NOT NULL
);

-- Build-time settings: M and ef_construction. More memory speeds up the build.
SET maintenance_work_mem = '4GB';
CREATE INDEX chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Query-time setting: ef_search (default 40), scoped to this transaction
BEGIN;
SET LOCAL hnsw.ef_search = 100;
SELECT id, content
FROM chunks
WHERE tenant_id = 42
ORDER BY embedding <=> $1
LIMIT 10;
COMMIT;
```

That query has exactly the post-filtering behavior described earlier. Newer pgvector versions add options that help, such as iterative index scans and a half-precision `halfvec` type. Availability and syntax depend on the version you run, so check its release notes before relying on them.

<div class="callout tip" data-title="Tip">
  <p>Because <code>ef_search</code> is a query-time setting, you can run different effort levels for different workloads on the same index: a lower value for autocomplete-style lookups, a higher one for the RAG path where a missed chunk costs an answer. In pgvector, <code>SET LOCAL</code> inside a transaction keeps the change from leaking to other queries on a pooled connection.</p>
</div>

## Production Reality Check

**Measure on your own data.** Synthetic vectors show the shape of the curve, not your numbers. Export a sample of real embeddings and a few hundred real queries, compute exact top k offline, and sweep ef_search and M against it. Recall@k measures the index, not the whole pipeline; pair it with retrieval quality checks like the ones in [Chunking Enterprise Documents Without Losing Meaning](/en-us/blog/chunking-enterprise-documents/).

**Plan for build time and rebuild memory.** HNSW builds are CPU heavy and slow down sharply once the graph no longer fits in build memory, and rebuilding while the old index serves traffic can need memory for both.

<div class="callout warning" data-title="Warning">
  <p>If the node is sized for exactly one copy of the index, a rebuild (to change <code>M</code>, <code>ef_construction</code>, dimensions or quantization) can push it into swap or out of memory in the middle of business hours. Size for two copies, or build on a separate node and switch over.</p>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>A new embedding model scores higher on the leaderboard. Can I just swap it in on Friday?</span>
    </div>
  </div>
</div>

Only if you re-embed everything first. Vectors from different models live in different spaces, so new-model queries against old-model documents produce nonsense rankings, silently. Changing models means re-embedding the corpus (API cost or GPU hours), building a new index, validating quality, and switching over with the old index kept for rollback. Store the model name and version next to every vector.

**Watch for noisy neighbors.** In shared clusters, one tenant's bulk ingestion or a rebuild competes with everyone's queries, and p99 latency suffers first. Separate ingestion from serving, throttle bulk loads, and give very large tenants their own partition.

**Monitor recall drift.** Inserts, deletes and updates change the graph, data shifts, and someone eventually lowers ef_search to fix a latency alert. Run a scheduled job that samples a few hundred recent queries, computes exact top k over the current data (or a representative shard), and records recall@k next to latency. Alert on recall the same way you alert on latency.

A quick checklist before blaming the database:

- Is there a recall@k baseline against exact search, measured on real data?
- Is ef_search chosen from a measured curve, or left at the default?
- Were M and ef_construction chosen for this dataset, and is rebuild memory budgeted?
- Is the precision (float32, float16, int8, binary) justified by memory pressure and measured recall?
- Do filtered queries return k results for your smallest tenants?
- Are the dimensions as small as your quality target allows?

None of these five settings is exotic, and each one is a conscious trade between recall, latency and memory. Get a benchmark in place, find the knee of your curve, and tune on purpose instead of waiting for production to pick the trade-off for you.
