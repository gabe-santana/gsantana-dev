---
title: "Evaluating RAG Like an Engineer: Building a Retrieval Test Set in Python"
description: "Build a versioned RAG test set and gate retrieval quality and answer faithfulness in CI."
date: 2026-05-13
tags: [RAG, Evaluation, Python, Testing]
tldr:
  - "Build a golden set of real questions labeled with the chunk ids that answer them, and version it like code."
  - "Score retrieval (recall@k, hit rate, MRR) separately from generation, so a regression points straight at the layer that broke."
  - "Gate CI on deterministic checks with thresholds; run the flaky LLM judge on a schedule, with majority votes and agreement tracking."
---

Most RAG pipelines are evaluated the same way: someone changes the chunk size, asks the bot five questions they already know the answers to, reads the replies, and says "looks better". Two weeks later a user reports that the bot no longer knows the refund policy, and nobody can say which of the last eight changes broke it, or whether it ever really worked.

That is a vibe check, not an evaluation. The fix is what we do for any other code: fixed inputs with known expected outputs, metrics, and a test that fails the build when the numbers drop. This post builds that for RAG in plain Python, ending in a pytest gate for CI. The Naive Junior will keep us honest.

## The Problem & Context

A RAG answer passes through two very different systems. The retriever picks a handful of chunks out of thousands, and the generator (the LLM) writes an answer from those chunks. When the final answer is wrong, the cause can be in either place:

- **The right chunk never arrived.** The retriever ranked it 14th and you only send the top 5. No prompt can fix that.
- **The right chunk arrived and the model ignored it**, misread it, or mixed it with its training data.
- **The model answered from nothing.** Retrieval returned weak matches and the model filled the gap with a plausible invention.

A new embedding model, a different chunk size, a new system prompt: each change can improve some questions and silently break others. Without a fixed test set you only see the questions you happened to try.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Can't I just keep a list of questions and read the answers after each change? I can tell a good answer when I see one.</span>
    </div>
  </div>
</div>

You can, for about a week. Reading answers doesn't scale past a few dozen questions, two people disagree about what "good" means, and nobody does it on every pull request. Worse, a fluent answer hides retrieval problems: the model writes a confident paragraph whether or not the right chunk was in its context. You need checks that are fast, repeatable and specific enough to tell you **which layer** failed.

That is why this post evaluates retrieval and generation separately. Retrieval is cheap to measure: did the chunks containing the answer show up in the top k? That is deterministic and needs no LLM. Generation quality is fuzzier, so it gets its own metrics and thresholds.

## Deep Dive / Architectural Design

The whole setup has four parts: a golden dataset, a retrieval scorer, a faithfulness scorer and a test runner that turns scores into pass or fail.

<div id="rag-evaluation-slot"></div>

### The golden dataset

Each row is a question plus the ids of the chunks that answer it. Not a reference answer, **chunk ids**. That choice makes retrieval scoring exact and cheap: you compare two sets of strings. Add a `source` field that records where the question came from, because you will want to slice metrics by it later.

Where the questions come from matters more than how many you have:

1. **Real user logs.** The best source, because they carry your users' actual vocabulary, typos and vagueness. Sample from search or chat logs, strip personal data, and have someone who knows the docs label the chunks that answer each question.
2. **Subject matter experts.** Support people know which questions are frequent, which are tricky, and which have answers spread across several documents. They are also the right people to label.
3. **Synthetic generation, with human review.** An LLM reads a chunk and writes questions it answers. Good for covering documents nobody has asked about yet, but every generated question needs a human pass.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Labeling is slow. Why not have an LLM generate a thousand questions from the chunks and skip the humans entirely?</span>
    </div>
  </div>
</div>

Because synthetic questions are suspiciously easy. A model writing a question while looking at a chunk tends to reuse its exact words, so any keyword retriever finds it and your scores look great. Real users say "how do I get my money back?" when the document says "refund". Some generated questions are also wrong, or answered by a different chunk. Use generation to fill gaps, keep the `source` tag, and report metrics per source so a flattering synthetic slice can't hide a weak one from real logs.

### Retrieval metrics

Three numbers cover most needs, all computed over the top k results:

| Metric | Question it answers | Computed as |
|---|---|---|
| recall@k | How much of the needed evidence did we fetch? | relevant chunks in top k / all relevant chunks, averaged over questions |
| hit rate@k | How often did we fetch at least something useful? | share of questions with at least one relevant chunk in top k |
| MRR@k | How high did the first useful chunk rank? | mean of 1 / rank of the first relevant chunk (0 if none in top k) |

Pick k to match what you actually send to the model. If the prompt gets 5 chunks, recall@50 is a comforting number that describes a system you don't run. When every question has exactly one relevant chunk, recall@k and hit rate@k are identical; they diverge on questions whose answer spans several chunks, and those are exactly the questions where partial retrieval produces half-right answers.

### Faithfulness

Faithfulness asks one narrow question: is every claim in the answer supported by the retrieved context? It is not the same as correctness. An answer can be perfectly faithful to a stale chunk and still be wrong, which is a retrieval or content problem, not a generation one. That separation is the point.

We use two layers. The first is a **deterministic check**: split the answer into sentences, and for each one measure how many of its content words appear in the context, plus a strict rule that every number in the claim must appear in the context. It is crude, but it runs instantly, never flakes, and catches the most expensive hallucinations: invented numbers, deadlines and limits. The second is an **optional LLM judge** that returns a verdict per claim. It understands paraphrase and negation, and it is nondeterministic, slower and costs money. Libraries such as Ragas and DeepEval package judge-based faithfulness metrics; the same caveats apply to them.

### Versioning the dataset

The golden set is test data, so treat it like code. Keep it in the repo as JSONL (one question per line gives readable diffs), never edit a published version in place, and create `v2.jsonl` when you add or relabel questions. Record the version and a content hash in every report, so a jump in recall can be traced to a better retriever or to an easier dataset. And validate on load: when someone re-chunks the corpus, chunk ids change, and a golden set pointing at ids that no longer exist should fail loudly instead of quietly scoring zero.

## Hands-On Implementation

The example uses a tiny in-memory corpus (support docs for an imaginary SaaS product) and a TF-IDF retriever written with the standard library, so everything runs offline. The only dependency is pytest.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install pytest
```

### The corpus and a retriever to test

```python title="retriever.py"
import math
import re
from collections import Counter

TOKEN = re.compile(r"[a-z0-9]+")
STOPWORDS = frozenset(
    "a an and are as at be by can do does for from how i in is it my of on or the to what when which with you your".split()
)


def tokenize(text: str) -> list[str]:
    tokens = [t for t in TOKEN.findall(text.lower()) if t not in STOPWORDS]
    # Crude plural folding so "plans" matches "plan"; a real system uses its search engine's analyzer
    return [t[:-1] if t.endswith("s") and len(t) > 3 else t for t in tokens]


CHUNKS: dict[str, str] = {
    "billing/refunds#0": "Annual plans can be refunded in full within 30 days of purchase. After 30 days, refunds are prorated by the unused months.",
    "billing/refunds#1": "Monthly plans are not refundable, but you can cancel at any time and keep access until the end of the billing period.",
    "billing/invoices#0": "Invoices are emailed to the billing contact on the first business day of each month and can be downloaded as PDF from the Billing page.",
    "api/rate-limits#0": "The public API allows 600 requests per minute per API key. Requests above the limit receive HTTP 429 with a Retry-After header.",
    "api/webhooks#0": "Webhook deliveries are retried up to 5 times with exponential backoff. Each delivery is signed with an HMAC-SHA256 signature in the X-Signature header.",
    "account/sso#0": "Single sign-on supports SAML 2.0 and OpenID Connect. SSO is available on the Enterprise plan and is configured by an organization admin.",
    "account/password-reset#0": "Password reset links expire after 60 minutes. Users with SSO enabled must reset their password through their identity provider.",
    "data/retention#0": "Deleted projects are kept for 14 days and can be restored by an admin. After 14 days they are permanently erased, including from backups.",
}


class TfidfRetriever:
    def __init__(self, chunks: dict[str, str]) -> None:
        self.ids = list(chunks)
        counts = [Counter(tokenize(text)) for text in chunks.values()]
        df = Counter(term for doc in counts for term in doc)
        n = len(counts)
        self.idf = {term: math.log((1 + n) / (1 + freq)) + 1 for term, freq in df.items()}
        self.vectors = [self._weigh(doc) for doc in counts]

    def _weigh(self, counts: Counter) -> dict[str, float]:
        vector = {term: count * self.idf.get(term, 0.0) for term, count in counts.items()}
        norm = math.sqrt(sum(value * value for value in vector.values())) or 1.0
        return {term: value / norm for term, value in vector.items()}

    def search(self, query: str, k: int = 5) -> list[str]:
        query_vector = self._weigh(Counter(tokenize(query)))
        scored = []
        for position, (chunk_id, vector) in enumerate(zip(self.ids, self.vectors)):
            score = sum(weight * vector.get(term, 0.0) for term, weight in query_vector.items())
            if score > 0:
                scored.append((-score, position, chunk_id))
        return [chunk_id for _, _, chunk_id in sorted(scored)[:k]]
```

The retriever is deliberately simple. What matters is the interface: `search(query, k)` returns a ranked list of chunk ids. Your real retriever (vector store, BM25, or a hybrid like the one in [Hybrid Search That Actually Works: BM25 + Vectors with Reciprocal Rank Fusion](/en-us/blog/hybrid-search-bm25-vectors-rrf/)) only needs a thin adapter with the same signature to plug into everything below.

### The golden set

```json title="golden/v1.jsonl"
{"id": "q001", "question": "Can I get a refund on an annual plan?", "expected_chunk_ids": ["billing/refunds#0"], "source": "logs"}
{"id": "q002", "question": "Is a monthly subscription refundable if I cancel?", "expected_chunk_ids": ["billing/refunds#1"], "source": "logs"}
{"id": "q003", "question": "Which plans have refunds?", "expected_chunk_ids": ["billing/refunds#0", "billing/refunds#1"], "source": "sme"}
{"id": "q004", "question": "How many API requests can I send per minute?", "expected_chunk_ids": ["api/rate-limits#0"], "source": "sme"}
{"id": "q005", "question": "Why am I getting HTTP 429 errors?", "expected_chunk_ids": ["api/rate-limits#0"], "source": "logs"}
{"id": "q006", "question": "How do I check the webhook signature?", "expected_chunk_ids": ["api/webhooks#0"], "source": "synthetic_reviewed"}
{"id": "q007", "question": "Does single sign-on work with SAML?", "expected_chunk_ids": ["account/sso#0"], "source": "synthetic_reviewed"}
{"id": "q008", "question": "My password reset link stopped working", "expected_chunk_ids": ["account/password-reset#0"], "source": "logs"}
{"id": "q009", "question": "Can an admin restore a deleted project?", "expected_chunk_ids": ["data/retention#0"], "source": "sme"}
{"id": "q010", "question": "Where can I download my invoices?", "expected_chunk_ids": ["billing/invoices#0"], "source": "synthetic_reviewed"}
{"id": "q011", "question": "How do I get my money back?", "expected_chunk_ids": ["billing/refunds#0"], "source": "logs"}
```

Note `q003`, whose answer needs two chunks, and `q011`, a real-user phrasing that shares no words with the refund chunk. A test set without hard cases only tells you what you already know.

### Loading and validating

```python title="dataset.py"
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

ALLOWED_SOURCES = {"logs", "sme", "synthetic_reviewed"}


@dataclass(frozen=True)
class GoldenQuestion:
    id: str
    question: str
    expected_chunk_ids: frozenset[str]
    source: str


@dataclass(frozen=True)
class GoldenSet:
    version: str
    sha256: str
    questions: list[GoldenQuestion]


def load_golden_set(path: Path, known_chunk_ids: set[str]) -> GoldenSet:
    raw = path.read_bytes()
    questions: list[GoldenQuestion] = []
    seen: set[str] = set()
    for line_no, line in enumerate(raw.decode("utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        q = GoldenQuestion(row["id"], row["question"], frozenset(row["expected_chunk_ids"]), row["source"])
        problems = []
        if q.id in seen:
            problems.append("duplicate id")
        if not q.expected_chunk_ids:
            problems.append("no expected chunks")
        # Re-chunking renames ids; fail loudly instead of scoring against chunks that no longer exist
        unknown = q.expected_chunk_ids - known_chunk_ids
        if unknown:
            problems.append(f"unknown chunk ids {sorted(unknown)}")
        if q.source not in ALLOWED_SOURCES:
            problems.append(f"unknown source {q.source!r}")
        if problems:
            raise ValueError(f"{path.name}:{line_no} ({q.id}): {'; '.join(problems)}")
        seen.add(q.id)
        questions.append(q)
    return GoldenSet(version=path.stem, sha256=hashlib.sha256(raw).hexdigest()[:12], questions=questions)
```

The version comes from the file name and the hash from its bytes, so every report can say exactly which dataset produced it.

### Retrieval metrics

```python title="metrics.py"
from collections import defaultdict
from dataclasses import dataclass
from statistics import mean
from typing import Callable

from dataset import GoldenSet

SearchFn = Callable[[str, int], list[str]]


def recall_at_k(retrieved: list[str], relevant: frozenset[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant)


def hit_at_k(retrieved: list[str], relevant: frozenset[str], k: int) -> float:
    return 1.0 if set(retrieved[:k]) & relevant else 0.0


def reciprocal_rank(retrieved: list[str], relevant: frozenset[str]) -> float:
    for rank, chunk_id in enumerate(retrieved, start=1):
        if chunk_id in relevant:
            return 1.0 / rank
    return 0.0


@dataclass(frozen=True)
class RetrievalReport:
    k: int
    recall: float
    hit_rate: float
    mrr: float
    misses: list[str]
    recall_by_source: dict[str, float]


def evaluate_retrieval(golden: GoldenSet, search: SearchFn, k: int = 3) -> RetrievalReport:
    recalls, hits, ranks, misses = [], [], [], []
    by_source: dict[str, list[float]] = defaultdict(list)
    for q in golden.questions:
        retrieved = search(q.question, k)
        recall = recall_at_k(retrieved, q.expected_chunk_ids, k)
        recalls.append(recall)
        hits.append(hit_at_k(retrieved, q.expected_chunk_ids, k))
        ranks.append(reciprocal_rank(retrieved[:k], q.expected_chunk_ids))
        by_source[q.source].append(recall)
        if recall < 1.0:
            misses.append(f"{q.id}: expected {sorted(q.expected_chunk_ids)}, got {retrieved}")
    return RetrievalReport(
        k=k,
        recall=round(mean(recalls), 3),
        hit_rate=round(mean(hits), 3),
        mrr=round(mean(ranks), 3),
        misses=misses,
        recall_by_source={source: round(mean(values), 3) for source, values in sorted(by_source.items())},
    )
```

The `misses` list is as important as the averages. When the gate fails, the first thing you want is which questions regressed and what came back instead.

```python title="report.py"
import json
from dataclasses import asdict
from pathlib import Path

from dataset import load_golden_set
from metrics import evaluate_retrieval
from retriever import CHUNKS, TfidfRetriever

if __name__ == "__main__":
    golden = load_golden_set(Path(__file__).parent / "golden" / "v1.jsonl", set(CHUNKS))
    report = evaluate_retrieval(golden, TfidfRetriever(CHUNKS).search, k=3)
    print(json.dumps({"dataset": golden.version, "sha256": golden.sha256, **asdict(report)}, indent=2))
```

On this corpus, `python report.py` shows recall@3 of 0.909 with a single miss: `q011`, the money-back question, where TF-IDF returns nothing at all because no word overlaps. The per-source breakdown shows the log-sourced slice is the one that drops, while the synthetic slice stays perfect. That is the easy-synthetic-questions effect in miniature (on a sample this small, one question moves a slice a lot).

### Faithfulness, the deterministic way

```python title="faithfulness.py"
import re
from dataclasses import dataclass

from retriever import tokenize

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
NUMBER = re.compile(r"\d+(?:\.\d+)?")


@dataclass(frozen=True)
class ClaimCheck:
    claim: str
    support: float
    missing_numbers: tuple[str, ...]
    supported: bool


@dataclass(frozen=True)
class FaithfulnessReport:
    score: float
    claims: list[ClaimCheck]

    @property
    def unsupported(self) -> list[str]:
        return [c.claim for c in self.claims if not c.supported]


def split_claims(answer: str) -> list[str]:
    return [s.strip() for s in SENTENCE_END.split(answer.strip()) if s.strip()]


def check_faithfulness(answer: str, contexts: list[str], min_support: float = 0.6) -> FaithfulnessReport:
    context_text = " ".join(contexts)
    context_tokens = set(tokenize(context_text))
    context_numbers = set(NUMBER.findall(context_text))
    checks = []
    for claim in split_claims(answer):
        tokens = set(tokenize(claim))
        support = len(tokens & context_tokens) / len(tokens) if tokens else 1.0
        # A number the context never mentions is the cheapest hallucination to catch
        missing = tuple(sorted(set(NUMBER.findall(claim)) - context_numbers))
        checks.append(ClaimCheck(claim, round(support, 3), missing, support >= min_support and not missing))
    # An empty answer is a generation failure, not a perfectly faithful one
    score = sum(c.supported for c in checks) / len(checks) if checks else 0.0
    return FaithfulnessReport(score=round(score, 3), claims=checks)
```

Be clear about its limits. Word overlap can't see negation: "monthly plans are refundable" shares nearly every word with "monthly plans are not refundable" and passes. It also punishes heavy paraphrase. Treat it as a smoke detector for invented facts, not as a measure of truth.

### An optional LLM judge

```python title="judge.py"
import importlib
import json
import os
from dataclasses import dataclass
from statistics import mean
from typing import Callable

Complete = Callable[[str, str], str]  # (model, prompt) -> raw model text

PROMPT = """You check whether an answer is grounded in the provided context.
For each numbered claim, answer true only if the context directly supports it.
Reply with JSON only, one boolean per claim: {{"verdicts": [true, false]}}

Context:
{context}

Claims:
{claims}
"""


@dataclass(frozen=True)
class JudgeResult:
    verdicts: list[bool]
    agreement: float
    valid_samples: int


class LLMJudge:
    def __init__(self, complete: Complete, model: str, samples: int = 3) -> None:
        if samples < 1:
            raise ValueError("samples must be at least 1")
        self.complete = complete
        self.model = model
        self.samples = samples

    def judge(self, claims: list[str], contexts: list[str]) -> JudgeResult:
        prompt = PROMPT.format(
            context="\n\n".join(contexts),
            claims="\n".join(f"{i}. {claim}" for i, claim in enumerate(claims, start=1)),
        )
        runs = []
        for _ in range(self.samples):
            parsed = self._parse(self.complete(self.model, prompt), len(claims))
            if parsed is not None:
                runs.append(parsed)
        if not runs:
            raise RuntimeError("judge returned no parseable verdicts")
        verdicts, agreement = [], []
        for i in range(len(claims)):
            yes = sum(run[i] for run in runs)
            # A tie counts as unsupported: the judge failing to agree is not evidence of grounding
            verdicts.append(yes * 2 > len(runs))
            agreement.append(max(yes, len(runs) - yes) / len(runs))
        return JudgeResult(verdicts, round(mean(agreement), 3), len(runs))

    @staticmethod
    def _parse(text: str, expected: int) -> list[bool] | None:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            verdicts = json.loads(text[start : end + 1]).get("verdicts")
        except (json.JSONDecodeError, AttributeError):
            return None
        if not isinstance(verdicts, list) or len(verdicts) != expected:
            return None
        if not all(isinstance(v, bool) for v in verdicts):
            return None
        return verdicts


def load_judge_from_env(samples: int = 3) -> LLMJudge | None:
    model = os.environ.get("RAG_EVAL_JUDGE_MODEL")
    target = os.environ.get("RAG_EVAL_JUDGE_CLIENT")  # "package.module:function"
    if not model or not target:
        return None
    module_name, _, function_name = target.partition(":")
    complete = getattr(importlib.import_module(module_name), function_name)
    return LLMJudge(complete, model, samples)
```

The judge knows nothing about any provider. You write one function, `complete(model, prompt) -> str`, with your SDK (temperature 0, a pinned model version), and point `RAG_EVAL_JUDGE_CLIENT` at it. The model name comes from `RAG_EVAL_JUDGE_MODEL`, so upgrading the judge is a visible config change, not a code edit. Each call is sampled several times: the majority decides, and `agreement` records how consistent the samples were.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If the judge understands paraphrase and negation, why keep the word-overlap check at all? Just use the judge for everything.</span>
    </div>
  </div>
</div>

Because a gate that sometimes fails on unchanged code trains the team to click "re-run" until it goes green, and then it protects nothing. The deterministic check gives the same answer every time, costs nothing and works without network access or API keys, so it can block a pull request. The judge is smarter and noisier, so it gets a different job: scheduled runs, trend lines and spot checks, where one odd verdict is a data point and not a blocked merge.

### The CI gate

```python title="test_rag_eval.py"
from pathlib import Path
from statistics import mean

import pytest

from dataset import load_golden_set
from faithfulness import check_faithfulness, split_claims
from judge import LLMJudge, load_judge_from_env
from metrics import evaluate_retrieval, recall_at_k, reciprocal_rank
from retriever import CHUNKS, TfidfRetriever

GOLDEN_PATH = Path(__file__).parent / "golden" / "v1.jsonl"
K = 3
THRESHOLDS = {"recall": 0.85, "mrr": 0.8, "faithfulness": 0.95}
LIVE_JUDGE = load_judge_from_env()


@pytest.fixture(scope="module")
def golden():
    return load_golden_set(GOLDEN_PATH, set(CHUNKS))


@pytest.fixture(scope="module")
def retriever():
    return TfidfRetriever(CHUNKS)


def fake_generate(question: str, contexts: list[str]) -> str:
    # Stand-in for the LLM call so the gate runs offline: answer with the top chunk's first sentence
    return split_claims(contexts[0])[0]


def test_metric_math():
    assert recall_at_k(["a", "b", "c"], frozenset({"b", "x"}), k=2) == 0.5
    assert reciprocal_rank(["a", "b"], frozenset({"b"})) == 0.5
    assert reciprocal_rank(["a"], frozenset({"z"})) == 0.0


def test_retrieval_meets_thresholds(golden, retriever):
    report = evaluate_retrieval(golden, retriever.search, k=K)
    context = f"dataset {golden.version} ({golden.sha256}), misses: {report.misses}"
    assert report.recall >= THRESHOLDS["recall"], f"recall@{K} = {report.recall}; {context}"
    assert report.mrr >= THRESHOLDS["mrr"], f"MRR@{K} = {report.mrr}; {context}"


def test_answers_are_grounded(golden, retriever):
    scores, failures = [], []
    for q in golden.questions:
        contexts = [CHUNKS[chunk_id] for chunk_id in retriever.search(q.question, K)]
        if not contexts:
            continue  # a retrieval miss, already counted by the retrieval gate
        report = check_faithfulness(fake_generate(q.question, contexts), contexts)
        scores.append(report.score)
        failures += [f"{q.id}: {claim}" for claim in report.unsupported]
    assert mean(scores) >= THRESHOLDS["faithfulness"], f"unsupported claims: {failures}"


def test_faithfulness_flags_invented_facts():
    context = [CHUNKS["billing/refunds#0"]]
    wrong_number = check_faithfulness("Annual plans can be refunded in full within 90 days of purchase.", context)
    assert wrong_number.claims[0].missing_numbers == ("90",)
    off_topic = check_faithfulness("Refunds are sent as store credit to your crypto wallet.", context)
    assert off_topic.unsupported == ["Refunds are sent as store credit to your crypto wallet."]


def test_judge_majority_vote_and_agreement():
    replies = iter(['{"verdicts": [true, false]}', 'Sure! {"verdicts": [true, true]}', "not json"])
    judge = LLMJudge(lambda model, prompt: next(replies), model="fake-judge", samples=3)
    result = judge.judge(["claim one", "claim two"], ["some context"])
    assert result.valid_samples == 2
    assert result.verdicts == [True, False]  # the 1-1 tie on claim two counts as unsupported
    assert result.agreement == 0.75


@pytest.mark.skipif(LIVE_JUDGE is None, reason="set RAG_EVAL_JUDGE_MODEL and RAG_EVAL_JUDGE_CLIENT")
def test_live_judge_confirms_grounding(golden, retriever):
    for q in golden.questions[:3]:
        contexts = [CHUNKS[chunk_id] for chunk_id in retriever.search(q.question, K)]
        claims = split_claims(fake_generate(q.question, contexts))
        result = LIVE_JUDGE.judge(claims, contexts)
        assert all(result.verdicts), f"{q.id}: judge rejected a claim (agreement {result.agreement})"
```

A few design choices:

- **Retrieval and faithfulness are separate tests.** The faithfulness test skips retrieval misses instead of counting them twice, so each failure points at one layer.
- **Failure messages carry the evidence**: dataset version, hash, and the questions that missed.
- **`fake_generate` is the seam.** In a real project it calls your generation pipeline. Being extractive, it makes faithfulness trivially high here; the invented-facts test proves the check can fail.
- **The live judge test skips itself** unless both environment variables are set.

```bash title="terminal"
pytest -q -rs
python report.py > eval-report.json
```

Offline, this gives five passing tests and one skipped (the live judge). With the two variables pointing at a working client, the sixth test runs too.

<div class="callout tip" data-title="Tip">
  <p>Set each threshold slightly below what you measured today, not at an aspirational target. The gate exists to catch regressions. When a change genuinely improves the numbers, raise the threshold in the same pull request, so quality can only ratchet upward.</p>
</div>

```yaml title=".github/workflows/rag-eval.yml"
name: rag-eval

on:
  pull_request:
  schedule:
    - cron: "0 3 * * *"

jobs:
  gate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install pytest
      - run: pytest -q -rs
      - run: python report.py > eval-report.json
        if: always()
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-report
          path: eval-report.json

  nightly-judge:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    env:
      RAG_EVAL_JUDGE_MODEL: ${{ vars.RAG_EVAL_JUDGE_MODEL }}
      RAG_EVAL_JUDGE_CLIENT: ${{ vars.RAG_EVAL_JUDGE_CLIENT }}
      LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install pytest  # plus the SDK your complete() function uses
      - run: pytest -q -rs -k live_judge
```

The workflow assumes the files sit at the repository root. Pull requests run the deterministic gate and upload the JSON report even on failure. The judge runs nightly, with the model name in repository variables and the key in secrets.

## Production Reality Check

The example has eleven questions and a toy retriever. Here is what changes with a real system.

### Judge scores are flaky, so measure the flakiness

LLM judges are not stable instruments. Output can vary between identical calls even at temperature 0, providers update models behind the same name, and judges have known biases, such as favoring longer, more confident answers or being swayed by the order of material in the prompt. Defenses: pin an explicit model version through the environment variable, sample several times and take the majority, check the judge against a small human-labeled set of claims whenever you change its model or prompt, and track `agreement` over time. Falling agreement means the judge got less certain.

<div class="callout warning" data-title="Warning">
  <p>Never compare judge scores across different judge models or prompt versions as if they were the same metric. Changing the judge changes the ruler. Record the judge configuration next to every score, and re-baseline when it changes.</p>
</div>

### Small datasets move in big steps

With eleven questions, one miss moves recall by about nine points, so thresholds on tiny sets are either loose or flaky. Grow the set toward a few hundred questions, prioritizing real traffic and known failures, and aim for coverage of question types (identifiers, multi-chunk answers, paraphrases, questions the corpus can't answer) over raw count. Report per-slice metrics, because an average hides a slice that collapsed.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Our recall is 0.91. Why not set the threshold to 1.0 so the team is forced to fix everything?</span>
    </div>
  </div>
</div>

Because the build would fail on day one and stay red, and a permanently red check gets ignored or disabled. Some misses are known and accepted for now (the money-back question needs semantic retrieval, which is a project, not a bug fix). Track them as named misses and let real improvements raise the threshold.

### Keep the dataset alive

A golden set rots. Docs get rewritten, chunks get re-split. Validation on load catches renamed ids, but a chunk id can survive while its text stops answering the question, so content changes need review. Make it routine: when a bug report reveals a bad answer, add that question to the next dataset version. Over time the set becomes a record of every way the system has failed, which is what a regression suite should be.

### Cost and speed

Retrieval scoring against a real vector store takes seconds for hundreds of questions and belongs on every pull request. Generation plus judging costs tokens and minutes, so run it nightly and cache answers keyed by question, retrieved chunk ids and prompt version.

None of this is new: fixed inputs, known expectations, deterministic checks on every change, and slower, noisier checks on a schedule. The only RAG-specific rule is to test the two layers separately, because "the answer was wrong" is a symptom, and the golden set's job is to tell you which layer caused it.
