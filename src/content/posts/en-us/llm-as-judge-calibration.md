---
title: "An LLM-as-a-Judge You Can Trust: Calibrate the Grader Before You Believe the Grade"
description: "Measure an LLM judge's position, length and self-preference biases, and its chance-corrected agreement with humans, before its scores drive a decision."
date: 2026-08-01
tags: [LLMs, Evaluation, Python, Statistics]
tldr:
  - "A judge is a measuring instrument: check it against two human labelers with chance-corrected agreement (Cohen's kappa, weighted kappa for ordinal scales), never with percent agreement alone."
  - "Run every pairwise comparison in both orders, fit length and same-family effects explicitly, and report win rates with bootstrap confidence intervals over prompts."
  - "Version the judge as model plus prompt plus rubric, and re-run the calibration set on any change: a new judge can move your scores by ten points while the system under test stands still."
---

You change the system prompt of your support assistant, run the eval suite, and the dashboard lights up: the new prompt wins 74% of pairwise comparisons against the old one, graded by an LLM judge. You ship it. Two weeks later the support leads tell you the answers got longer and no better. Customers scroll past three paragraphs to find the one sentence they needed. Nobody lied and no code was wrong. The judge simply likes long answers, the new prompt makes the model write more, and nobody had ever measured how much the judge's taste and the humans' taste disagree.

In [Evaluating RAG Like an Engineer](/en-us/blog/rag-evaluation-retrieval-test-set/) the LLM judge was the optional, slightly suspicious layer on top of deterministic retrieval metrics. This post is about that judge alone: the biases it is known to have, how to design the grading so those biases have less room, and how to measure the judge against humans with statistics that don't flatter it. Everything in the hands-on part runs offline on numpy, with a simulated judge whose biases you can dial up one at a time. The Naive Junior is here too.

## The Problem & Context

An LLM judge is a measuring instrument, and instruments have two kinds of error. Noise is the random part: grade the same answer twice and you get two different scores. Bias is the systematic part: the judge prefers the first answer it reads, or the longer one, or the one written by a model from its own family. Noise shrinks when you average more items. Bias doesn't shrink at all. It just gets measured more precisely, which makes the wrong number look more trustworthy.

The paper everybody cites for "LLM judges work" is [Zheng et al., 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"](https://arxiv.org/abs/2306.05685). Its headline is real: GPT-4 as a judge matched human expert preferences on MT-Bench 85% of the time (ties excluded), while two humans agreed with each other 81% of the time. The same paper is also the best catalog of what goes wrong. With the default prompt, GPT-4 gave the same verdict after the two answers swapped places only 65% of the time, and in 30% of the cases it favored whichever answer came first. Claude-v1 was consistent in 23.8% of cases. A "repetitive list" attack, where an answer is padded with rephrased copies of its own points, fooled Claude-v1 and GPT-3.5 91.3% of the time (GPT-4, 8.7%). On math questions GPT-4 misjudged 14 of 20 comparisons with the default prompt, even on problems it could solve when asked separately: the answers in its context misled it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>A paper showed the judge agrees with experts as often as experts agree with each other. The models got better since then. Why would I calibrate anything?</span>
    </div>
  </div>
</div>

Because agreement is not a property of a model. It belongs to a model, a prompt, a rubric and a data distribution together. The 85% was measured on 80 open-ended MT-Bench questions, pairwise, with ties dropped, against a particular pool of experts. Your task might be grading refund answers against a policy in Portuguese on a 1 to 5 scale, and nothing in that paper tells you how the judge behaves there. Newer judge models have reduced some of these effects, but nothing in the literature lets you assume they are zero for your task. Measuring is cheap compared to shipping a decision on a biased number.

## Deep Dive / Architectural Design

### The biases you should expect

**Position bias.** The judge prefers an answer because of where it sits in the prompt. Besides Zheng et al., [Wang et al., 2023, "Large Language Models are not Fair Evaluators"](https://arxiv.org/abs/2305.17926) showed how far this goes: with ChatGPT as the evaluator, Vicuna-13B could beat ChatGPT on 66 of 80 queries just by changing the order in which the answers were shown. Their fix, Balanced Position Calibration, is the same idea as the swap test below: evaluate both orders and combine.

**Verbosity bias.** Longer answers score higher, whether or not the extra length adds anything. It is strong enough that AlpacaEval, a widely used automatic benchmark, now ships a length-controlled variant: [Dubois et al., 2024](https://arxiv.org/abs/2404.04475) fit a regression that predicts the judge's preference from the length difference plus other features, then read off the preference at zero length difference. That single adjustment raised the benchmark's correlation with Chatbot Arena from 0.94 to 0.98.

**Self-preference.** A judge tends to favor text produced by itself or its own model family. Zheng et al. saw GPT-4 favor itself with a 10% higher win rate and Claude-v1 with 25%, and were careful to say their data couldn't prove a bias. [Panickssery et al., 2024](https://arxiv.org/abs/2404.13076) went further: models can recognize their own outputs at better than chance, and after fine-tuning, the strength of self-recognition correlated linearly with the strength of self-preference. The [G-Eval paper](https://arxiv.org/abs/2303.16634) flagged the same concern, a judge favoring LLM-generated text over human-written text.

**Leniency.** Judges drift toward "pass". [Thakur et al., 2024, "Judging the Judges"](https://arxiv.org/abs/2406.12624) found judge models tend to mark answers correct when the answers don't fully meet the instructions, and that only the largest judges came reasonably close to human alignment. Leniency hides especially well behind percent agreement, as the hands-on part shows.

**Weak grading on hard reasoning.** A judge that has to verify a derivation while also comparing two answers often just doesn't. That is why reference-guided grading exists (more on it below).

### Pairwise or pointwise

Pointwise grading (one answer, one score) scales linearly, gives you absolute numbers you can track over time and works for gating a single system. Its weakness is the scale itself: "4 out of 5" means whatever the judge thinks it means today, and a small shift in that meaning moves every score at once. Leniency and scale drift hit pointwise hardest.

Pairwise grading (two answers, pick one or call a tie) is closer to how people actually judge quality, and constant shifts cancel out: a judge that is generous to both answers still has to choose. The costs are that comparisons grow with the number of systems, results are relative (a 60% win rate over a bad baseline says little) and it introduces position bias, which pointwise grading doesn't have.

My default: pairwise when choosing between two candidates (prompt A or B, model X or Y), pointwise with binary criteria when gating one system over time. Whichever you pick, the calibration procedure is the same: humans label the same items, and you measure agreement.

### Rubrics that constrain the judge

A vague instruction ("rate helpfulness from 1 to 10") hands the judge's own taste the job of defining the scale, and that taste is where the biases live. Two techniques take room away from it.

**Anchored scales.** Every point on the scale gets a concrete, observable description, ideally tied to a reference. Five points with anchors beat ten points without them, because a judge (and a human) can't reliably tell a 6 from a 7 but can tell "a secondary fact is wrong" from "the main fact is wrong".

```text title="rubric-correctness.txt"
Score the answer's correctness against the reference answer.
5: every fact agrees with the reference and nothing important is missing
4: the facts agree, one minor detail is missing or vague
3: the main fact is right, a secondary fact is wrong or missing
2: the main fact is wrong or missing, but the answer is on topic
1: wrong, off topic, or refuses a question it should answer
Length, tone and formatting do not change the score.
```

**Binary criteria.** Better still, break the judgment into yes or no questions, each about one observable property, and derive the score from them. "Does every number in the answer agree with the reference?" is a question a judge answers far more consistently than "how accurate is it, 1 to 5?". Binary criteria are easier for humans to label too, which matters because human labels are your ground truth. They also make disagreement debuggable: instead of "the judge said 3, I said 4", you get "the judge thinks C3 is satisfied, the policy says otherwise".

**Reference-guided grading.** Give the judge a reference answer written or approved by a person. In Zheng et al., GPT-4's failure rate on math comparisons went from 14 of 20 with the default prompt to 6 of 20 with chain-of-thought and 3 of 20 when the prompt included a reference answer. [Prometheus](https://arxiv.org/abs/2310.08491) was built around the same pair of inputs, a score rubric plus a reference answer, and reached a Pearson correlation of 0.897 with human evaluators. A reference turns "is this right?" into "does this agree with that?", a much easier task.

One more habit from the same literature: ask for the reasoning before the verdict, and put the verdict last in the output format, so the score comes after the judge has looked at the criteria instead of being rationalized afterwards.

### Measuring agreement: percent agreement is not enough

Percent agreement answers "how often did the judge give the same label as the human?". It ignores how often they would agree by accident. If 62% of your answers deserve a pass, a judge that says "pass" to everything agrees with the human 62% of the time while contributing no information at all.

[Cohen's kappa](https://en.wikipedia.org/wiki/Cohen%27s_kappa) corrects for that. It compares the observed agreement `p_o` with the agreement `p_e` you would expect if both raters labeled independently at their own label frequencies: `kappa = (p_o - p_e) / (1 - p_e)`. Zero means chance level, one means perfect agreement, negative means worse than chance. The always-pass judge above gets exactly zero. Keep in mind kappa's known quirk, documented by [Feinstein and Cicchetti in 1990](https://pubmed.ncbi.nlm.nih.gov/2348207): with very unbalanced categories, high agreement can come with a low kappa. That is kappa working as intended when one label dominates, but it means you should always report the label balance next to it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Our judge matches the human pass or fail label 68% of the time. Not amazing, but way better than a coin flip, so it's clearly signal.</span>
    </div>
  </div>
</div>

A coin flip is the wrong baseline. The baseline is the dumbest judge that knows the label frequencies, and on a set where most answers pass, "always pass" already beats a coin. In the harness below, a lenient judge hits exactly that 68% pass or fail agreement, on a set where always-pass gets 62% for free. Its kappa is 0.21: barely above chance. The 68% was mostly the base rate talking.

For ordinal scales, plain kappa is too harsh: it treats a 4 against a 5 as the same failure as a 1 against a 5. Weighted kappa ([Cohen, 1968](https://doi.org/10.1037/h0026256)) assigns each disagreement a penalty that grows with distance, linearly or quadratically. Quadratic weighted kappa (QWK) is the usual choice for 1 to 5 rubrics. It has its own blind spot, which the code will show: a judge that is always exactly one point too generous gets zero exact matches and still a QWK above 0.7. So report QWK and the mean offset together.

Two alternatives are worth knowing. Thakur et al. used Scott's pi instead of Cohen's kappa, because Cohen's kappa computes chance agreement from each rater's own label distribution, which partly forgives a judge whose distribution is skewed, and that skew is part of what you want to catch. [Krippendorff's alpha](https://www.asc.upenn.edu/sites/default/files/2021-03/Computing%20Krippendorff's%20Alpha-Reliability.pdf) generalizes the same idea to any number of raters, missing labels and nominal, ordinal or interval data. Reach for it when you have three annotators who didn't all label every item.

Whatever statistic you choose, compare the judge against the human ceiling: the agreement between two humans on the same items. A judge can't be expected to agree with a human more than humans agree with each other, and if two of your annotators reach a QWK of only 0.5, the problem is the rubric, not the judge.

### Uncertainty: a win rate without an interval is a guess

A win rate of 0.56 over 100 prompts and a win rate of 0.56 over 1,000 prompts are different claims. The simplest honest way to attach uncertainty is the percentile bootstrap ([Efron, 1979](https://doi.org/10.1214/aos/1176344552)): resample your items with replacement thousands of times, recompute the statistic on each resample and take the 2.5th and 97.5th percentiles. It works for win rates, kappas and differences between two judges without any distributional formula.

The one rule that matters: resample the unit that is independent. That is the prompt, not the individual judgment. Both orders of a swap, and both answers to the same prompt, travel together in every resample. When you compare two judges or two systems on the same prompts, resample the prompts once and compute the difference inside each resample (a paired bootstrap). That interval is much tighter than two independent intervals and it's the one that answers the question you actually asked.

### The calibration loop

All of this fits into one loop that runs before a judge is trusted, and again whenever any part of the judge changes:

<div id="llm-judge-calibration-loop-slot"></div>

The calibration set is sampled from real traffic across every slice you care about, labeled by two people independently, adjudicated where they disagree and frozen with a version. The judge runs on it in both orders with a pinned model. The report holds kappa, QWK, swap consistency and the fitted bias effects. The gate compares those numbers with the human ceiling. The artifact that goes to production is the triple of model, prompt and rubric version, not "the judge".

## Hands-On Implementation

The code below is plain Python 3.14 with numpy. Real judge calls need API keys and cost money, so the calibration machinery runs against a simulated judge: a function that sees each answer's true quality through noise, plus separate dials for leniency, verbosity, self-preference and position bias. Turning one dial at a time shows which metric catches which bias. The integration with a real model comes at the end, clearly marked as illustrative.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install numpy
```

### Kappa and weighted kappa from scratch

```python title="agreement.py"
from collections.abc import Sequence

import numpy as np


def confusion_matrix(a: Sequence, b: Sequence, categories: Sequence) -> np.ndarray:
    index = {c: i for i, c in enumerate(categories)}
    matrix = np.zeros((len(categories), len(categories)))
    for x, y in zip(a, b, strict=True):
        matrix[index[x], index[y]] += 1
    return matrix


def percent_agreement(a: Sequence, b: Sequence) -> float:
    return float(np.mean(np.asarray(a) == np.asarray(b)))


def cohen_kappa(a: Sequence, b: Sequence, categories: Sequence) -> float:
    counts = confusion_matrix(a, b, categories)
    p = counts / counts.sum()
    observed = np.trace(p)
    # Chance agreement: each rater keeps their own label frequencies, labels drawn independently
    expected = float(p.sum(axis=1) @ p.sum(axis=0))
    if expected == 1.0:
        return float("nan")
    return float((observed - expected) / (1 - expected))


def weighted_kappa(a: Sequence, b: Sequence, categories: Sequence, weights: str = "quadratic") -> float:
    """categories must be in scale order: a 1 vs 5 disagreement costs more than 4 vs 5."""
    counts = confusion_matrix(a, b, categories)
    p = counts / counts.sum()
    expected = np.outer(p.sum(axis=1), p.sum(axis=0))
    i, j = np.indices(p.shape)
    distance = np.abs(i - j) / (len(categories) - 1)
    penalty = {"linear": distance, "quadratic": distance**2}[weights]
    chance_disagreement = float((penalty * expected).sum())
    if chance_disagreement == 0.0:
        return float("nan")
    return 1.0 - float((penalty * p).sum()) / chance_disagreement
```

Weighted kappa is written as disagreement over chance disagreement, the form that generalizes to penalties. The `nan` branches cover the degenerate case where both raters used a single label: agreement beyond chance is undefined there, and returning 1.0 would hide it.

Hand-rolled statistics need a check against a published value before anything depends on them. Wikipedia's Cohen's kappa article has a worked example with 50 grant proposals and a stated result of 0.40:

```python title="check_agreement.py"
import numpy as np

from agreement import cohen_kappa, percent_agreement, weighted_kappa

# Reference: the grant-proposal example in Wikipedia's Cohen's kappa article.
# 50 proposals: both yes 20, A yes and B no 5, A no and B yes 10, both no 15.
# Published values: p_o = 0.70, p_e = 0.50, kappa = 0.40.
a = ["yes"] * 25 + ["no"] * 25
b = ["yes"] * 20 + ["no"] * 5 + ["yes"] * 10 + ["no"] * 15
kappa = cohen_kappa(a, b, ["yes", "no"])
print(f"percent agreement {percent_agreement(a, b):.2f}  kappa {kappa:.4f}")
assert abs(kappa - 0.40) < 1e-12

# With two categories every weighting scheme collapses to plain kappa
for scheme in ("linear", "quadratic"):
    assert abs(weighted_kappa(a, b, ["yes", "no"], scheme) - kappa) < 1e-12

# Ordinal case: one rater is always exactly one point above the other
rng = np.random.default_rng(0)
human = rng.integers(1, 5, size=500)  # 1..4
judge = human + 1                     # 2..5, off by one every time
scale = [1, 2, 3, 4, 5]
print(f"off-by-one judge: exact {percent_agreement(human, judge):.2f}  "
      f"kappa {cohen_kappa(human, judge, scale):+.3f}  "
      f"linear {weighted_kappa(human, judge, scale, 'linear'):+.3f}  "
      f"quadratic {weighted_kappa(human, judge, scale, 'quadratic'):+.3f}")
```

```text title="terminal"
$ python check_agreement.py
percent agreement 0.70  kappa 0.4000
off-by-one judge: exact 0.00  kappa -0.226  linear +0.337  quadratic +0.717
```

The reference value matches, and the binary collapse holds. The second line is the lesson about ordinal scales. A judge that is always one point too generous never matches exactly, and plain kappa calls it worse than chance, which is too harsh: it tracks the human perfectly, just shifted. Quadratic kappa gives it 0.717, which is too kind: a judge that inflates every score is a problem for any absolute threshold. Neither number alone tells the story; the mean offset does.

I also cross-checked both functions against scikit-learn's `cohen_kappa_score` on 200 random pairs of 300 ratings each, for unweighted, linear and quadratic weights. The largest absolute difference was `2.22e-16`, floating point noise. You don't need scikit-learn for the rest of the post.

### A synthetic world with a judge you can bias

The dataset simulates 400 prompts, each answered by two systems. "Ours" is the candidate. It is slightly better on average, writes about twice as many tokens, and comes from the same model family as the judge. Length carries no information about quality here, on purpose. Two simulated annotators label each answer independently on the 1 to 5 scale, and annotator 1 also gives a pairwise preference.

```python title="world.py"
from dataclasses import dataclass

import numpy as np

SCALE = [1, 2, 3, 4, 5]


@dataclass(frozen=True)
class Answer:
    system: str     # "ours" (same model family as the judge) or "baseline"
    quality: float  # latent truth in 0..1; a real judge never sees it
    tokens: int


@dataclass(frozen=True)
class Item:
    ours: Answer
    baseline: Answer
    human: dict[str, int]    # annotator 1, 1..5 per system
    human_2: dict[str, int]  # annotator 2, same answers, labeled blind
    human_pref: str          # "ours", "baseline" or "tie"


def to_score(x: float) -> int:
    return int(np.clip(np.rint(1 + 4 * x), 1, 5))


def make_dataset(n: int = 400, seed: int = 11) -> list[Item]:
    rng = np.random.default_rng(seed)
    items = []
    for _ in range(n):
        difficulty = rng.normal(0, 0.15)
        q_base = float(np.clip(0.66 + difficulty + rng.normal(0, 0.12), 0, 1))
        q_ours = float(np.clip(0.69 + difficulty + rng.normal(0, 0.12), 0, 1))
        # Ours writes about twice as much, and length says nothing about quality here
        ours = Answer("ours", q_ours, int(rng.lognormal(np.log(340), 0.3)))
        base = Answer("baseline", q_base, int(rng.lognormal(np.log(170), 0.3)))
        human = {a.system: to_score(a.quality + rng.normal(0, 0.07)) for a in (ours, base)}
        human_2 = {a.system: to_score(a.quality + rng.normal(0, 0.07)) for a in (ours, base)}
        diff = q_ours - q_base + rng.normal(0, 0.04)
        pref = "ours" if diff > 0.05 else "baseline" if diff < -0.05 else "tie"
        items.append(Item(ours, base, human, human_2, pref))
    return items


@dataclass
class SimulatedJudge:
    """Stands in for an LLM judge, with each known bias as a dial."""

    noise: float = 0.07
    leniency: float = 0.0     # added to every perceived quality
    verbosity: float = 0.0    # added per 100 tokens above 250
    self_pref: float = 0.0    # added when the answer comes from the judge's own family
    position: float = 0.0     # added to whichever answer is shown first
    tie_band: float = 0.05
    seed: int = 0

    def __post_init__(self) -> None:
        self.rng = np.random.default_rng(self.seed)

    def _perceived(self, answer: Answer) -> float:
        return (
            answer.quality
            + self.leniency
            + self.verbosity * (answer.tokens - 250) / 100
            + self.self_pref * (answer.system == "ours")
        )

    def score(self, answer: Answer) -> int:
        return to_score(self._perceived(answer) + self.rng.normal(0, self.noise))

    def compare(self, first: Answer, second: Answer) -> str:
        margin = self._perceived(first) - self._perceived(second) + self.position + self.rng.normal(0, self.noise)
        return "first" if margin > self.tie_band else "second" if margin < -self.tie_band else "tie"
```

The simulated judge has the same noise level as a human annotator and draws fresh noise on every call, so asking twice can give two answers, like a real model. A small bug I made while writing this is worth mentioning: creating a new `SimulatedJudge(seed=1)` per answer gives every answer the same noise draw, a correlated error that made an unbiased judge look six points too generous. Real pipelines have the same failure when a cache or a fixed seed makes "independent" samples identical.

### The swap test

<div id="llm-judge-swap-test-slot"></div>

Every pair is judged twice, once in each order. Verdicts are translated from slots ("first", "second") back to systems, and a win only counts when it survives the swap. This is the conservative rule from Zheng et al.: call the judge in both orders and declare a win only when the same answer is preferred both times.

```python title="pairwise.py"
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np

from world import Answer, Item

Compare = Callable[[Answer, Answer], str]  # (first, second) -> "first" | "second" | "tie"
OUTCOME = {"ours": 1.0, "tie": 0.5, "baseline": 0.0}


@dataclass(frozen=True)
class SwapReport:
    consistent: float       # same system wins (or tie) in both orders
    first_both: float       # the answer in slot 1 won both times: pure position bias
    second_both: float
    verdicts: list[str]     # per item, ties where the two orders disagree
    single_order: list[str] # what a one-call judge (ours always first) would have said


def swap_test(compare: Compare, items: Sequence[Item]) -> SwapReport:
    verdicts, single, kinds = [], [], Counter()
    for item in items:
        ab = compare(item.ours, item.baseline)
        ba = compare(item.baseline, item.ours)
        v1 = {"first": "ours", "second": "baseline", "tie": "tie"}[ab]
        v2 = {"first": "baseline", "second": "ours", "tie": "tie"}[ba]
        single.append(v1)
        if v1 == v2:
            kinds["consistent"] += 1
            verdicts.append(v1)
        else:
            # Conservative rule from Zheng et al.: a win must survive the swap
            kinds[f"{ab}_{ba}"] += 1
            verdicts.append("tie")
    n = len(items)
    return SwapReport(
        consistent=kinds["consistent"] / n,
        first_both=kinds["first_first"] / n,
        second_both=kinds["second_second"] / n,
        verdicts=verdicts,
        single_order=single,
    )


def win_rate(verdicts: Sequence[str]) -> float:
    return float(np.mean([OUTCOME[v] for v in verdicts]))
```

`first_both` is the fingerprint of position bias: the answer in slot 1 won in both calls, so the content never mattered. `single_order` records what you'd have reported with one call per pair and our answer always first, a surprisingly common setup when the candidate is simply passed in as "Answer A".

### Bootstrap confidence intervals

```python title="bootstrap.py"
from collections.abc import Callable

import numpy as np


def bootstrap_ci(
    statistic: Callable[[np.ndarray], float],
    n_items: int,
    n_boot: int = 5000,
    level: float = 0.95,
    seed: int = 7,
) -> tuple[float, float, float]:
    """Percentile bootstrap over items. statistic receives an array of item indices."""
    rng = np.random.default_rng(seed)
    samples = np.array([statistic(rng.integers(0, n_items, n_items)) for _ in range(n_boot)])
    low, high = np.nanquantile(samples, [(1 - level) / 2, (1 + level) / 2])
    return statistic(np.arange(n_items)), float(low), float(high)
```

The statistic receives item indices, not values. That's what keeps the resampling at the prompt level: whatever the statistic computes (a win rate, a kappa between two label arrays, the difference between two judges) it computes over the same resampled prompts.

### The calibration harness

Five judges, one dial each: a fair one, a lenient one, one with position bias, one that rewards length, and one that prefers its own family. Every metric from the design section, side by side, with the second human annotator as the ceiling.

```python title="harness.py"
import numpy as np

from agreement import cohen_kappa, percent_agreement, weighted_kappa
from bootstrap import bootstrap_ci
from pairwise import swap_test, win_rate
from world import SCALE, SimulatedJudge, make_dataset

JUDGES = {
    "fair": SimulatedJudge(seed=1),
    "lenient": SimulatedJudge(leniency=0.25, seed=2),
    "position": SimulatedJudge(position=0.10, seed=3),
    "verbose": SimulatedJudge(verbosity=0.06, seed=4),
    "self-pref": SimulatedJudge(self_pref=0.08, seed=5),
}

items = make_dataset()
answers = [a for it in items for a in (it.ours, it.baseline)]
human = np.array([it.human[a.system] for it in items for a in (it.ours, it.baseline)])
human_2 = np.array([it.human_2[a.system] for it in items for a in (it.ours, it.baseline)])
tokens = np.array([a.tokens for a in answers])
is_ours = np.array([a.system == "ours" for a in answers])


def bias_effects(residual: np.ndarray) -> tuple[float, float]:
    # Our system is both the long one and the judge's sibling, so a raw
    # correlation can't tell the two biases apart: fit them jointly.
    X = np.column_stack([np.ones_like(tokens, dtype=float), tokens / 100, is_ours])
    _, per_100_tokens, own_family = np.linalg.lstsq(X, residual, rcond=None)[0]
    return float(per_100_tokens), float(own_family)


def pointwise_row(name: str, scores: np.ndarray) -> str:
    passed, human_passed = scores >= 4, human >= 4
    residual = scores - human
    length_effect, self_effect = bias_effects(residual)
    return (
        f"{name:<10} {percent_agreement(scores, human):>5.2f} {cohen_kappa(scores, human, SCALE):>6.2f} "
        f"{weighted_kappa(scores, human, SCALE):>6.2f} {percent_agreement(passed, human_passed):>6.2f} "
        f"{cohen_kappa(passed, human_passed, [True, False]):>6.2f} {residual.mean():>+7.2f} "
        f"{length_effect:>+8.2f} {self_effect:>+6.2f}"
    )


print(f"{len(items)} prompts, {len(answers)} answers, human pass rate {np.mean(human >= 4):.2f}")
print("\nPOINTWISE (1-5 scale, pass = 4 or 5)")
print(f"{'judge':<10} {'exact':>5} {'kappa':>6} {'qwk':>6} {'pass%':>6} {'passk':>6} {'offset':>7} {'len/100':>8} {'self':>6}")
print(pointwise_row("human-2", human_2))
for name, judge in JUDGES.items():
    print(pointwise_row(name, np.array([judge.score(a) for a in answers])))

human_pref = [it.human_pref for it in items]
prefs = ["ours", "tie", "baseline"]
wr, lo, hi = bootstrap_ci(lambda idx: win_rate([human_pref[i] for i in idx]), len(items))
print(f"\nPAIRWISE (ours vs baseline), human win rate {wr:.3f} [{lo:.3f}, {hi:.3f}]")
print(f"{'judge':<10} {'agree':>5} {'kappa':>6} {'consist':>7} {'1st-1st':>7} {'2nd-2nd':>7} {'one-call':>8}  {'swapped win rate [95% CI]'}")
for name, judge in JUDGES.items():
    report = swap_test(judge.compare, items)
    v = report.verdicts
    wr, lo, hi = bootstrap_ci(lambda idx: win_rate([v[i] for i in idx]), len(items))
    print(
        f"{name:<10} {percent_agreement(v, human_pref):>5.2f} {cohen_kappa(v, human_pref, prefs):>6.2f} "
        f"{report.consistent:>7.2f} {report.first_both:>7.2f} {report.second_both:>7.2f} "
        f"{win_rate(report.single_order):>8.3f}  {wr:.3f} [{lo:.3f}, {hi:.3f}]"
    )
```

`bias_effects` is the same idea as length-controlled AlpacaEval, in miniature: regress the judge's error on the features you suspect and read the coefficients. It matters here because the two suspects are confounded. Our system writes long answers and is the judge's sibling, so any bias toward either shows up as "the judge likes ours". Fitting both at once separates them.

```text title="terminal"
$ python harness.py
400 prompts, 800 answers, human pass rate 0.62

POINTWISE (1-5 scale, pass = 4 or 5)
judge      exact  kappa    qwk  pass%  passk  offset  len/100   self
human-2     0.71   0.58   0.81   0.86   0.70   -0.00    -0.00  +0.04
fair        0.68   0.52   0.78   0.85   0.69   -0.02    +0.01  -0.05
lenient     0.28   0.02   0.44   0.68   0.21   +0.81    +0.01  -0.04
position    0.71   0.57   0.80   0.86   0.71   -0.01    -0.02  -0.00
verbose     0.64   0.48   0.75   0.81   0.61   +0.01    +0.22  -0.02
self-pref   0.67   0.51   0.76   0.84   0.66   +0.14    -0.00  +0.29

PAIRWISE (ours vs baseline), human win rate 0.555 [0.512, 0.596]
judge      agree  kappa consist 1st-1st 2nd-2nd one-call  swapped win rate [95% CI]
fair        0.71   0.57    0.71    0.02    0.02    0.564  0.559 [0.520, 0.595]
lenient     0.74   0.61    0.69    0.01    0.02    0.536  0.545 [0.507, 0.581]
position    0.60   0.43    0.40    0.27    0.00    0.776  0.546 [0.516, 0.575]
verbose     0.59   0.36    0.74    0.02    0.02    0.752  0.740 [0.705, 0.771]
self-pref   0.68   0.50    0.76    0.01    0.02    0.721  0.708 [0.671, 0.741]
```

Read it row by row.

**The ceiling.** Two humans with the same noise agree exactly 71% of the time, with a QWK of 0.81. The fair judge lands just under that (0.78). That is what "good" looks like: close to the ceiling, offset near zero, no length or family effect. Even the human pair only agrees exactly 71% of the time, so a gate at "90% exact agreement" would fail every judge and every human.

**Lenient.** This is the judge from the Naive Junior card. Pass or fail agreement is 0.68, while always-pass would get 0.62 on this set. Kappa on pass or fail is 0.21, QWK is 0.44, the offset is +0.81 points. Now look at the pairwise table: the lenient judge agrees with the human preference 74% of the time, as well as the fair judge. A constant shift cancels out when the judge has to choose between two answers. Leniency is a pointwise disease.

**Position.** Invisible in the pointwise table, since there's only one answer per call and nothing to be first. In the pairwise table it's obvious: only 40% of pairs keep their verdict after the swap, and in 27% of pairs the first slot won both times. The single-call win rate, with our answer always in slot 1, is 0.776, against a human win rate of 0.555. Swap and tie the flips, and the win rate drops to 0.546, inside the human interval. The swap test catches position bias and also cures most of it, at the cost of a second call.

**Verbose.** The length coefficient is +0.22 points per 100 tokens and the family coefficient is zero, so the regression pins the bias on length. In the pairwise table the win rate is 0.740 with an interval of [0.705, 0.771], nowhere near the human 0.555. And the swap consistency is 0.74, higher than the fair judge's.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>The verbose judge has the best swap consistency in the whole table. So it's the most reliable judge, right?</span>
    </div>
  </div>
</div>

It is the most reliably wrong. Consistency under swaps tests exactly one thing: whether the order of the answers changed the verdict. A judge that always prefers the longer answer is perfectly consistent, because the longer answer stays longer in both orders. Each check covers one bias. The swap test covers position; length and family need the regression; leniency needs the offset and a chance-corrected statistic. None of them replaces agreement with humans, and the verbose judge's pairwise kappa of 0.36 is the number that should have stopped the launch in the opening story.

**Self-pref.** The family coefficient is +0.29 with no length effect, and the win rate of 0.708 [0.671, 0.741] again excludes the human number. Without the regression, this judge and the verbose one would look identical in the aggregate: both prefer "ours". In a real evaluation you'd separate them the same way, or better, break the confound by design: include long answers from other families and short ones from the judge's family in the calibration set.

### Judge drift: the ruler changes

A new judge model arrives. It's cheaper and better on public benchmarks, and you switch. Here is what that can do to a dashboard, with the system under test frozen:

```python title="drift.py"
import numpy as np

from agreement import weighted_kappa
from bootstrap import bootstrap_ci
from pairwise import swap_test, win_rate
from world import SCALE, SimulatedJudge, make_dataset

items = make_dataset()
ours = [it.ours for it in items]
human = np.array([it.human["ours"] for it in items])
human_2 = np.array([it.human_2["ours"] for it in items])

# Same outputs, same prompt, same rubric: only the judge model changed
judge_v1 = SimulatedJudge(seed=1)
judge_v2 = SimulatedJudge(leniency=0.03, verbosity=0.03, seed=9)
old = np.array([judge_v1.score(a) for a in ours])
new = np.array([judge_v2.score(a) for a in ours])

for name, scores in (("human", human), ("human-2", human_2), ("judge v1", old), ("judge v2", new)):
    rate, lo, hi = bootstrap_ci(lambda idx: float(np.mean(scores[idx] >= 4)), len(items))
    print(f"{name:<9} pass rate {rate:.3f} [{lo:.3f}, {hi:.3f}]")

shift, lo, hi = bootstrap_ci(lambda idx: float(np.mean(new[idx] >= 4) - np.mean(old[idx] >= 4)), len(items))
print(f"v2 - v1   pass rate {shift:+.3f} [{lo:+.3f}, {hi:+.3f}]  (paired, same items)")
print(f"qwk v1 vs human {weighted_kappa(old, human, SCALE):.3f}  "
      f"v2 vs human {weighted_kappa(new, human, SCALE):.3f}  "
      f"v1 vs v2 {weighted_kappa(old, new, SCALE):.3f}")

print("\nhow wide is the win-rate interval? (fair judge, swapped)")
verdicts = swap_test(SimulatedJudge(seed=1).compare, items).verdicts
for n in (50, 100, 200, 400):
    rate, lo, hi = bootstrap_ci(lambda idx: win_rate([verdicts[i] for i in idx]), n)
    print(f"n={n:<4} win rate {rate:.3f} [{lo:.3f}, {hi:.3f}]  width {hi - lo:.3f}")
```

```text title="terminal"
$ python drift.py
human     pass rate 0.630 [0.583, 0.677]
human-2   pass rate 0.637 [0.590, 0.685]
judge v1  pass rate 0.625 [0.580, 0.670]
judge v2  pass rate 0.725 [0.680, 0.767]
v2 - v1   pass rate +0.100 [+0.065, +0.138]  (paired, same items)
qwk v1 vs human 0.821  v2 vs human 0.768  v1 vs v2 0.768

how wide is the win-rate interval? (fair judge, swapped)
n=50   win rate 0.540 [0.430, 0.640]  width 0.210
n=100  win rate 0.565 [0.490, 0.635]  width 0.145
n=200  win rate 0.573 [0.525, 0.625]  width 0.100
n=400  win rate 0.537 [0.499, 0.574]  width 0.075
```

The new judge is only slightly more lenient and slightly fonder of length (dials at 0.03), and the pass rate of the same frozen outputs jumps ten points, with a paired interval of [+0.065, +0.138] that clearly excludes zero. On the dashboard that looks like a great release. The humans, the only ruler that didn't change, still say 0.63. The v1 versus v2 QWK of 0.768 is the quick early warning: two judges that are supposed to be interchangeable should agree with each other at least as well as each agrees with a human.

The second block answers "how many items do I need?". At 50 prompts the 95% interval on a win rate is 21 points wide: you can't tell 0.45 from 0.64. At 200 it's 10 points, at 400 it's 7.5. For calibration sets I start at 200 labeled prompts and grow toward 400 on the slices that matter. Also note the n=400 win rate here is 0.537 while the harness reported 0.559 for the same fair judge settings: different random draws of the same judge moved the result by two points. Rerun variance is part of the instrument too, which is why the interval matters more than the point estimate.

### Where the real judge plugs in

This part is **illustrative**: I didn't run it against any provider, since that needs keys and a real calibration set. I did check that it compiles and that the order mapping and parse handling behave as described, using a fake `complete` that returns canned JSON. The shape is what matters: rubric with binary criteria and a reference, reasoning before verdict, both orders, parse failures kept apart from losses, and an explicit judge identifier recorded with every verdict.

```python title="judge_client.py"
import json
from collections.abc import Callable
from dataclasses import dataclass

# Illustrative: wrap your provider's SDK in this signature (pinned model id, temperature 0).
Complete = Callable[[str], str]

JUDGE_ID = "support-pairwise/rubric-v3/judge-model-2026-06-01"

PROMPT = """You compare two answers to the same customer question.
Use only the criteria below. Length is not a criterion: extra text counts only
if it satisfies a criterion the other answer misses.

C1 answers the question that was asked, not a nearby one
C2 every number, date and limit agrees with the reference answer
C3 promises nothing the policy excerpt does not allow
C4 tells the customer the next step when an action is needed

Question:
{question}

Reference answer (written by support staff):
{reference}

Answer 1:
{first}

Answer 2:
{second}

For each answer write one short reason, then true or false for C1 to C4.
Decide the winner last. Reply with JSON only:
{{"answer_1": {{"reason": "...", "C1": true, "C2": true, "C3": true, "C4": false}},
 "answer_2": {{"reason": "...", "C1": true, "C2": false, "C3": true, "C4": true}},
 "winner": "1"}}
winner is "1", "2" or "tie".
"""


@dataclass(frozen=True)
class PairVerdict:
    winner: str | None  # "ours", "baseline", "tie", or None when unparseable
    flipped: bool       # the two orders disagreed
    judge_id: str = JUDGE_ID


def _winner(raw: str) -> str | None:
    try:
        data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
    except ValueError:
        return None
    winner = data.get("winner") if isinstance(data, dict) else None
    return {"1": "first", "2": "second", "tie": "tie"}.get(winner)


def judge_pair(complete: Complete, question: str, reference: str, ours: str, baseline: str) -> PairVerdict:
    ab = _winner(complete(PROMPT.format(question=question, reference=reference, first=ours, second=baseline)))
    ba = _winner(complete(PROMPT.format(question=question, reference=reference, first=baseline, second=ours)))
    if ab is None or ba is None:
        # Missing, not a loss: a parse failure must never count against either side
        return PairVerdict(None, False)
    v1 = {"first": "ours", "second": "baseline", "tie": "tie"}[ab]
    v2 = {"first": "baseline", "second": "ours", "tie": "tie"}[ba]
    return PairVerdict(v1 if v1 == v2 else "tie", v1 != v2)
```

The `compare` callable the harness takes has the same contract as `judge_pair`'s inner calls, so the swap test, the bootstrap and the agreement statistics run unchanged on real verdicts. Store the per-criterion booleans too. When the judge disagrees with a human, the criterion that flipped is the fastest route to a better rubric.

## Production Reality Check

### Your human labels are the ceiling, and they drift too

Everything above assumes the human labels are right. Two annotators, labeling blind, with the same rubric the judge gets; measure their agreement before measuring the judge's, and adjudicate their disagreements into a final label. When two careful people disagree a lot, the rubric is ambiguous, and no judge will fix that.

Expect the rubric to change while you label. [Shankar et al., 2024, "Who Validates the Validators?"](https://arxiv.org/abs/2404.12272) named this criteria drift: people need criteria to grade outputs, but grading outputs is how they discover their criteria. That is normal. Version the rubric and the calibration set together, and don't compare agreement numbers across rubric versions.

### Pin the judge and version the ruler

A judge is the triple of model version, prompt and rubric. Change any of the three and you have a new instrument, so record the judge id next to every score, as `judge_client.py` does, and re-run the calibration set before the new judge's numbers go on the same chart as the old ones. Avoid model aliases that silently move to a new snapshot. When a provider retires the pinned version, treat the migration as a judge change, with the drift check above: re-baseline, don't splice the time series.

<div class="callout warning" data-title="Warning">
  <p>Never compare scores produced by different judges as if they were the same metric. A ten-point jump after a judge upgrade is a change of ruler until the calibration set says otherwise. If you need continuity, score a fixed set of old outputs with both judges and publish the offset.</p>
</div>

### Keep the judge out of its own family

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>We'll use the same model we ship as the judge. It's the strongest one we have a contract for, and it already knows our domain.</span>
    </div>
  </div>
</div>

That is the one setup where self-preference is guaranteed to matter: every comparison between your system and a competitor, or between your new prompt and a human-written answer, is graded by a relative of one side. Panickssery et al. tie self-preference to self-recognition, and a model is best at recognizing text from its own family. Use a judge from a different family when you compare systems, or at least include the family as a feature in the bias regression, and put outputs from several families in the calibration set so the effect can be measured at all. If policy leaves you only one family, report the measured family effect next to every win rate.

### Cost

A calibrated judge costs more than a naive one. The swap test doubles pairwise calls. Reasoning before the verdict multiplies output tokens. Comparing k systems pairwise costs k(k-1)/2 comparisons per prompt. A calibration run is small (a few hundred prompts, twice), but a nightly regression over thousands of prompts adds up. What keeps it affordable:

- **Batch APIs.** Evaluation doesn't need real-time answers. Both [Anthropic's Message Batches API](https://platform.claude.com/docs/en/build-with-claude/batch-processing) and [OpenAI's Batch API](https://developers.openai.com/api/docs/guides/batch) price batched requests at 50% of the synchronous rate, with results within 24 hours.
- **Prompt caching.** Put the static part (instructions, rubric, few-shot examples) first and the variable part (question, reference, answers) last, so the long prefix is cached across calls.
- **A cascade.** Deterministic checks first (format, required fields, numbers against the reference, as in the RAG post), the judge only for what they can't decide.
- **Sampling.** Judge a stratified sample of production traffic, not all of it. The bootstrap tells you how big the sample must be for the interval you need.

The expensive part is not tokens, it's human labeling time, and it's also the only thing that makes every other number on your dashboard mean something.

### Smaller things that bite

- **Ties.** Decide up front how ties count (0.5 in this post) and whether the judge may declare one. Forcing a choice inflates position bias, since the judge has to break genuine ties somehow, and it tends to break them by slot.
- **Parse failures.** A judge reply that doesn't parse is missing data. Counting it as a loss for one side, or as a fail, puts your parser's bugs into the metric. Track the parse failure rate as its own number.
- **Slices.** Agreement can be high on average and poor on a slice (long documents, one language, refusals). Report kappa per slice for the slices you make decisions about, with intervals, since slices are small.
- **Length control in reports.** Even with a good rubric, report the answer length difference next to any win rate. If the winner is also 60% longer, show the length-controlled number or at least the regression coefficient.

An LLM judge is a measuring instrument. Before trusting its readings, you measure the instrument: against two humans, with statistics that account for chance, in both orders, with the suspected biases fitted explicitly and an interval on every number. The code for that is a few hundred lines of numpy. The discipline is the harder part: pin the judge, version the ruler, and re-run the calibration set whenever anything about the judge changes. Do that, and a 74% win rate becomes a claim you can defend in front of the support leads instead of one they disprove for you.
