---
title: "Speculative Decoding Explained: Draft Cheap, Verify in One Pass"
description: "How a cheap drafter and a single target forward pass make LLM decoding faster while keeping the target model's exact output distribution, with runnable code and real measurements."
date: 2026-07-24
tags: [LLM, Inference, Performance, Python]
tldr:
  - "Decoding one token at a time is limited by reading the weights from memory, so scoring k+1 positions in one target pass costs about the same as scoring one."
  - "A cheap drafter proposes k tokens, the target checks them in one pass, and the min(1, p/q) rule with residual resampling keeps the output distribution exactly the target's."
  - "The gain depends on acceptance rate, draft cost and batch size: it pays for latency-bound, predictable output and can lose on busy servers, creative sampling or tiny models."
---

A team I worked with had a 70B model behind an internal assistant, streaming around 30 tokens per second per user on a single node. The GPU dashboard showed memory bandwidth pinned and the tensor cores mostly idle. Someone read that speculative decoding gives "2x to 3x faster generation with identical outputs", flipped it on in the serving engine with a small draft model, and the latency graph for the quiet hours did improve. Then Monday morning traffic arrived, the batch filled up, and throughput per GPU went down.

Both outcomes are the same mechanism working as designed. Speculative decoding spends idle compute to buy latency, and when the compute stops being idle the trade flips. This post explains why decode is memory-bound in the first place, how the draft and verify loop works, the rejection sampling rule that makes the output distribution provably identical to the target's, the speedup math, and the family of variants (draft models, prompt lookup, Medusa, EAGLE, lookahead). Then I implement the algorithm in numpy and prove the distribution claim empirically, print the speedup table, and time real assisted generation with two small models on my laptop, including the runs where it got slower. The Naive Junior shows up too.

## The Problem & Context

An autoregressive model produces one token per forward pass, and each token depends on the previous one. You cannot compute token 51 before you know token 50. That sequential dependency is the whole problem.

What makes it expensive is not the arithmetic. During decode, a single sequence feeds one new token through the network, and every layer has to read its full weight matrices from GPU memory to multiply them by that one vector. For a 7B model in 16-bit precision that's about 14 GB of weights per token. An H100 SXM moves roughly 3.35 TB/s from HBM, so just streaming the weights takes about 4 ms, a ceiling of around 240 tokens per second before you even count the KV cache. The math for that token is about 2 FLOPs per parameter, 14 GFLOP, which the same GPU's roughly 990 dense BF16 TFLOPS would finish in about 14 microseconds. The tensor cores spend almost the whole step waiting on memory. Prefill (processing the prompt) is the opposite: thousands of tokens share each weight read, so it's compute-bound.

That gap is the opening. If you already have several candidate tokens, you can push all of them through the target model in one forward pass. The weights are read once, the extra positions ride along on compute that was idle anyway, and the pass takes about as long as a single-token pass. You get the target model's next-token distribution at every one of those positions. The trick is where the candidates come from and how you decide which ones to keep without changing what the model would have said.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If the GPU is idle during decode, just batch more users together. That uses the compute and we don't need any of this.</span>
    </div>
  </div>
</div>

Batching is the right tool for throughput, and it's what continuous-batching servers do. It doesn't help the one user staring at the stream: their sequence still needs one full forward pass per token, and a bigger batch usually makes each pass a little slower, not faster. Speculative decoding attacks per-sequence latency: it lets one sequence advance several tokens per target pass. Keep in mind that both techniques feed on the same idle compute. That's why they fight each other in production, and why the Monday morning story above happened.

## Deep Dive / Architectural Design

### The draft and verify loop

The idea was published independently by two groups: Leviathan, Kalman and Matias in [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) (ICML 2023, 2x to 3x on T5-XXL), and Chen et al. at DeepMind in [Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) (2x to 2.5x on Chinchilla 70B in a distributed setup). The loop is the same in both.

<div id="specdec-loop-slot"></div>

A cheap **draft** proposes k tokens autoregressively, and for each one it records its own probability distribution q. The expensive **target** then runs one forward pass over the prefix plus those k tokens. Because a causal transformer produces a next-token distribution at every position, that single pass yields k+1 distributions: p1 to judge the first draft token, p2 for the second, and so on, plus one extra distribution for the position after the last draft token.

Verification walks left to right. Each draft token is accepted or rejected by a probabilistic rule (next section). At the first rejection the round stops, and the target's distribution at that position supplies a corrected token. If all k survive, the extra distribution supplies a bonus token for free. Either way, one target pass produces between 1 and k+1 tokens, never fewer than plain decoding.

Two pieces of bookkeeping matter in real engines. The target appended KV cache entries for all k draft positions, so entries past the first rejection must be discarded (truncating the cache or rewinding a pointer). The draft keeps its own KV cache and has to be rolled back the same way. Neither is hard, but both are where implementations hide bugs.

### The rejection sampling rule

For a draft token x at some position, the draft assigned it probability q(x) and the target assigns it p(x). The rule:

1. Accept x with probability `min(1, p(x) / q(x))`. If the target likes x at least as much as the draft did, x is always accepted. If the draft was overconfident, x survives only part of the time.
2. If x is rejected, sample a replacement from the residual distribution `max(0, p - q)`, renormalized, and end the round.
3. If all k tokens are accepted, sample one bonus token from the target's last distribution.

<div id="specdec-accept-rule-slot"></div>

Here's why this is exact, not an approximation. The probability that the round outputs token x at this position is the chance the draft proposed x and it was accepted, plus the chance of any rejection followed by the residual picking x:

- Proposed and accepted: `q(x) * min(1, p(x)/q(x)) = min(p(x), q(x))`.
- The total acceptance probability is `alpha = sum over x of min(p(x), q(x))`, so a rejection happens with probability `1 - alpha`.
- The residual assigns x the probability `max(0, p(x) - q(x)) / (1 - alpha)`, because the residual's mass also sums to `1 - alpha`.
- Rejected then resampled to x: `(1 - alpha) * max(0, p(x) - q(x)) / (1 - alpha) = max(0, p(x) - q(x))`.

Add the two: `min(p, q) + max(0, p - q) = p(x)`. Every token comes out distributed exactly as the target would have sampled it, conditioned on the same prefix, and by induction the whole sequence does too. Nothing in the argument depends on the draft being good. A terrible draft only lowers alpha, which is the per-token acceptance rate and equals `1 - TV(p, q)`, one minus the total variation distance between the two distributions.

Greedy decoding is the degenerate case: p puts all its mass on the target's argmax, so a draft token is accepted exactly when it equals that argmax, and the "residual" is the argmax itself. That's why greedy assisted generation reproduces plain greedy output token for token (up to floating point, which I'll come back to).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why the weird residual? When a draft token gets rejected, just sample a fresh token from p. It's the target's own distribution, so it has to be correct.</span>
    </div>
  </div>
</div>

It sounds safe and it's biased. The tokens where p exceeds q are already under-represented among accepted draft tokens, and the tokens where q exceeds p already got their full share of p through acceptance. Sampling from plain p after a rejection gives the over-proposed tokens a second chance they don't deserve, so they come out too often. The residual `max(0, p - q)` is exactly the probability mass the acceptance step failed to deliver, nothing more. The hands-on section measures this: with plain p as the fallback, the total variation distance to the true distribution stays stuck around 0.107 no matter how many samples you draw.

There's also a simpler exact scheme that some engines use for sampling: draw a token from the target at each position and keep the draft token only while they match. It's lossless too, since every emitted token was sampled from p, but its acceptance rate is `sum of p(x) * q(x)`, which is lower than `sum of min(p(x), q(x))`. In my toy model below that's 0.39 to 0.55 per context instead of 0.67 to 0.86. The rejection rule is the one that squeezes the most acceptance out of a given draft.

### How much faster: the math

If each draft token is accepted independently with probability alpha, the number of tokens a round produces is the accepted run plus the one corrected or bonus token. Leviathan et al. give the expectation:

`E[tokens per target pass] = (1 - alpha^(k+1)) / (1 - alpha)`

It grows with k but saturates at `1 / (1 - alpha)`: with alpha = 0.8 you can never average more than 5 tokens per pass, however long you draft. Drafting isn't free, though. Call c the cost of one draft step relative to one target step. A round costs `k * c + 1` target-step units, so the expected speedup is:

`speedup = (1 - alpha^(k+1)) / ((1 - alpha) * (k * c + 1))`

This formula already tells you most of the production story. A higher alpha is worth more than anything else. A larger k helps only while the next draft token is likely to survive, and past that point you pay c for tokens that get thrown away. And c is not the parameter ratio: a 10x smaller draft is often much more than 10x cheaper to run in FLOPs but not in wall time, because at batch 1 the draft is also memory-bound, has its own kernel launch overhead and runs k times sequentially. The hands-on section prints the table.

### The family of drafters

Everything after "the target verifies the guesses in one pass" is shared. The research since 2023 is mostly about better guesses and cheaper guessing.

<div id="specdec-drafters-slot"></div>

**A separate draft model.** The original recipe: a small model from the same family with the same tokenizer, like a 1B drafting for a 70B. Easy to adopt and needs no training, but you now host two models, and the draft's quality on your traffic decides everything.

**Prompt lookup and n-gram drafting.** No model at all: find the last few generated tokens somewhere earlier in the context and propose whatever followed them there. Introduced in the [prompt-lookup-decoding](https://github.com/apoorvumang/prompt-lookup-decoding) repository, which reports about 2.4x on average for summarization and context QA, and now available in Hugging Face transformers as `prompt_lookup_num_tokens` and in vLLM as the n-gram method. It shines when the output copies the input: code editing, extraction, RAG answers that quote sources, and it does nothing for free-form writing.

**Medusa.** [Medusa](https://arxiv.org/abs/2401.10774) (Cai et al., 2024) adds extra decoding heads on top of the target's last hidden state, each predicting a token further ahead, and verifies several candidate continuations at once with tree attention. The paper reports over 2.2x with a frozen backbone (Medusa-1) and 2.3x to 3.6x when the backbone is fine-tuned jointly (Medusa-2). It also proposes a "typical acceptance" scheme that accepts more tokens by giving up the exact-distribution guarantee, so check which acceptance rule you are running.

**EAGLE.** [EAGLE](https://arxiv.org/abs/2401.15077) (Li et al., 2024) drafts at the feature level: a small head autoregresses over the target's second-to-top layer features, fed with the token sequence advanced by one step, which removes much of the draft's uncertainty. It reports 2.7x to 3.5x latency speedup on LLaMA2-Chat 70B while preserving the output distribution. [EAGLE-2](https://arxiv.org/abs/2406.16858) makes the draft tree dynamic based on draft confidence, and [EAGLE-3](https://arxiv.org/abs/2503.01840) goes back to predicting tokens directly, fuses features from several layers, and reports up to 6.5x speedup plus a 1.38x throughput gain at batch size 64 in SGLang.

**Lookahead decoding.** [Lookahead](https://arxiv.org/abs/2402.02057) (Fu et al., 2024) needs no draft model or data store. It runs Jacobi iteration inside the target, guessing several future positions in parallel, collects the n-grams those guesses produce into a pool, and verifies candidates from the pool in the same pass. The paper reports up to 1.8x on MT-bench and up to 4x on code completion with multiple GPUs.

**Multi-token prediction heads trained with the model.** Some models now ship with this built in. The [DeepSeek-V3 report](https://arxiv.org/abs/2412.19437) trains multi-token prediction (MTP) modules as an auxiliary objective and notes they can be repurposed for speculative decoding, and serving engines expose MTP as a drafting method.

In 2026 the major open serving engines ship several of these. The [vLLM speculative decoding docs](https://docs.vllm.ai/en/latest/features/speculative_decoding/) list EAGLE, MTP, draft models, PARD and MLP speculators as model-based methods, and n-gram and suffix decoding as lightweight ones, all configured through one `speculative_config` with a `method` and `num_speculative_tokens`.

## Hands-On Implementation

Four pieces, all of which I ran: a numpy implementation that proves the distribution claim, a check of the acceptance formula, the speedup table, and real timings with Hugging Face transformers.

### Speculative sampling in numpy, with proof

The toy language has 4 tokens. The target is a random bigram model (the next-token distribution depends on the previous token), and the draft is the target blurred with noise, so it's a worse model of the same language. Sequences are 4 tokens long, which gives 256 possible outcomes whose exact probabilities we can compute from the target alone. If speculative sampling is exact, its empirical distribution over those 256 outcomes must converge to the exact one, at the same rate as sampling from the target directly.

```python title="speculative_sampling.py"
import itertools
import math

import numpy as np

V = 4  # vocabulary size
L = 4  # tokens per sampled sequence, so there are V**L = 256 possible outcomes
BOS = 0

setup = np.random.default_rng(2)
# The target: a random bigram "language model". Row t is p(next token | previous token t).
P = setup.dirichlet(np.ones(V), size=V)
# The draft: a weaker model of the same language, the target blurred with noise.
Q = 0.55 * P + 0.45 * setup.dirichlet(np.ones(V), size=V)


def sample(rng, dist):
    return int(np.searchsorted(np.cumsum(dist), rng.random() * dist.sum(), side="right"))


def speculative_step(rng, prev, k, buggy=False):
    # 1. The draft proposes k tokens, one cheap call each.
    drafted, q_rows, ctx = [], [], prev
    for _ in range(k):
        q = Q[ctx]
        x = sample(rng, q)
        drafted.append(x)
        q_rows.append(q)
        ctx = x
    # 2. The target scores all k+1 positions at once: this is the single forward pass.
    p_rows = P[[prev] + drafted]
    # 3. Accept draft token i with probability min(1, p(x)/q(x)); stop at the first rejection.
    out = []
    for i, x in enumerate(drafted):
        p, q = p_rows[i], q_rows[i]
        if rng.random() < min(1.0, p[x] / q[x]):
            out.append(x)
            continue
        # On rejection, sample from the residual max(0, p - q), renormalized.
        fix = p if buggy else np.maximum(p - q, 0.0)
        out.append(sample(rng, fix))
        return out, i
    # 4. Every draft token survived: the target's last row gives one more token for free.
    out.append(sample(rng, p_rows[k]))
    return out, k


def generate(rng, k, length=L, buggy=False):
    seq, target_calls, accepted = [], 0, 0
    while len(seq) < length:
        prev = seq[-1] if seq else BOS
        new, n_ok = speculative_step(rng, prev, k, buggy)
        seq += new
        target_calls += 1
        accepted += n_ok
    return tuple(seq[:length]), target_calls, accepted


def generate_plain(rng, length=L):
    seq, prev = [], BOS
    for _ in range(length):
        prev = sample(rng, P[prev])
        seq.append(prev)
    return tuple(seq)


def exact_joint():
    joint = {}
    for seq in itertools.product(range(V), repeat=L):
        prob, prev = 1.0, BOS
        for tok in seq:
            prob *= P[prev, tok]
            prev = tok
        joint[seq] = prob
    return joint


def chi_square_p(stat, df):
    # Wilson-Hilferty: (X/df)^(1/3) is close to normal, good enough for a sanity check.
    z = ((stat / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    return 0.5 * math.erfc(z / math.sqrt(2))


def compare(samples, joint):
    n = len(samples)
    counts = {}
    for s in samples:
        counts[s] = counts.get(s, 0) + 1
    tv = 0.5 * sum(abs(counts.get(s, 0) / n - p) for s, p in joint.items())
    # Chi-square needs about 5 expected hits per cell, so rare outcomes share one pooled cell.
    cells, rare_obs, rare_exp = [], 0, 0.0
    for s, p in joint.items():
        if n * p >= 5:
            cells.append((counts.get(s, 0), n * p))
        else:
            rare_obs, rare_exp = rare_obs + counts.get(s, 0), rare_exp + n * p
    if rare_exp > 0:
        cells.append((rare_obs, rare_exp))
    stat = sum((o - e) ** 2 / e for o, e in cells)
    return tv, chi_square_p(stat, len(cells) - 1)


if __name__ == "__main__":
    joint = exact_joint()
    print("alpha per context:", np.round(np.minimum(P, Q).sum(axis=1), 3))
    print()
    print(f"{'N':>8} {'sampler':<12} {'TV':>7} {'chi2 p':>8}")
    for n in (1_000, 10_000, 100_000, 400_000):
        rng = np.random.default_rng(n)
        runs = {
            "target only": [generate_plain(rng) for _ in range(n)],
            "speculative": [generate(rng, k=3)[0] for _ in range(n)],
            "buggy": [generate(rng, k=3, buggy=True)[0] for _ in range(n)],
        }
        for name, samples in runs.items():
            tv, p = compare(samples, joint)
            print(f"{n:>8} {name:<12} {tv:>7.4f} {p:>8.4f}")
```

The `buggy` flag is the Naive Junior's fallback: sample from plain p instead of the residual. The script needs only numpy (I ran it on numpy 2.5.3):

```bash title="terminal"
python speculative_sampling.py
```

```text title="output"
alpha per context: [0.672 0.692 0.856 0.863]

       N sampler           TV   chi2 p
    1000 target only   0.1631   0.0564
    1000 speculative   0.1630   0.6063
    1000 buggy         0.2099   0.0000
   10000 target only   0.0545   0.0546
   10000 speculative   0.0524   0.0995
   10000 buggy         0.1199   0.0000
  100000 target only   0.0160   0.4631
  100000 speculative   0.0184   0.0096
  100000 buggy         0.1062   0.0000
  400000 target only   0.0084   0.0232
  400000 speculative   0.0078   0.4405
  400000 buggy         0.1075   0.0000
```

Read the TV column first. With 1,000 samples, even sampling straight from the target lands 0.16 away from the exact distribution, because 256 outcomes and 1,000 draws is just noisy. As N grows, "target only" and "speculative" shrink together, roughly with `1 / sqrt(N)`, and at 400,000 samples both sit below 0.01. The buggy sampler flattens out at about 0.107 and stays there: more samples only make the bias easier to see.

The chi-square p-values need one honest note. For a correct sampler they should look like uniform random numbers between 0 and 1, which means an occasional small one is expected. The speculative sampler's 0.0096 at N = 100,000 looks alarming in isolation, and "target only" has a 0.0232 of its own. To check that I wasn't fooling myself, I reran both correct samplers with 30 different seeds at N = 30,000: the p-values spread from 0.001 to 0.82 for the plain target and from 0.17 to 0.98 for speculative, both what a correct sampler produces. The buggy one prints 0.0000 every single time.

### Acceptance rate and tokens per pass

The expected-tokens formula assumes a single, constant alpha. In the toy model alpha depends on the context (0.67 to 0.86), so it's worth checking how well the formula holds with a measured average:

```python title="acceptance.py"
import numpy as np

from speculative_sampling import BOS, speculative_step

rng = np.random.default_rng(42)
STEPS = 50_000

print(f"{'k':>2} {'alpha':>6} {'tokens/call':>12} {'formula':>8}")
for k in (1, 2, 3, 4, 6, 8):
    prev, emitted, judged, accepted = BOS, 0, 0, 0
    for _ in range(STEPS):
        new, n_ok = speculative_step(rng, prev, k)
        emitted += len(new)
        accepted += n_ok
        # The scan stops at the first rejection, so only n_ok + 1 draft tokens get judged (k if all pass).
        judged += min(n_ok + 1, k)
        prev = new[-1]
    alpha = accepted / judged
    formula = (1 - alpha ** (k + 1)) / (1 - alpha)
    print(f"{k:>2} {alpha:>6.3f} {emitted / STEPS:>12.3f} {formula:>8.3f}")
```

```text title="output"
 k  alpha  tokens/call  formula
 1  0.785        1.785    1.785
 2  0.782        2.396    2.393
 3  0.784        2.887    2.878
 4  0.781        3.254    3.242
 6  0.781        3.782    3.760
 8  0.780        4.067    4.054
```

The measured alpha is stable at about 0.78 across k, and the formula predicts tokens per target call within 1% even though acceptance varies by context. Look at the diminishing returns: going from k = 1 to k = 2 buys 0.6 tokens per pass, going from k = 6 to k = 8 buys 0.3 while drafting two more tokens. With a real draft that costs something, those last tokens are where the speedup leaks away.

### The speedup table

Now plug in draft cost. `c = 0.05` is a cheap drafter (an EAGLE-style head, or a draft model 20x cheaper per step), and `c = 0.2` is a draft model that's small but not tiny relative to the target:

```python title="speedup_table.py"
def expected_tokens(alpha, k):
    # Tokens produced per target forward pass (Leviathan et al. 2023, eq. 1).
    return (1 - alpha ** (k + 1)) / (1 - alpha)


def speedup(alpha, k, c):
    # c = cost of one draft step divided by the cost of one target step.
    return expected_tokens(alpha, k) / (k * c + 1)


ALPHAS = (0.5, 0.6, 0.7, 0.8, 0.9)
KS = (1, 2, 3, 4, 5, 6, 8)

for c in (0.05, 0.2):
    print(f"speedup, draft cost c = {c}")
    print("alpha " + "".join(f"{f'k={k}':>7}" for k in KS) + "   best k")
    for a in ALPHAS:
        row = [speedup(a, k, c) for k in KS]
        best = max(range(1, 21), key=lambda k: speedup(a, k, c))
        print(f"{a:<6}" + "".join(f"{s:>7.2f}" for s in row) + f"   {best} ({speedup(a, best, c):.2f}x)")
    print()
```

```text title="output"
speedup, draft cost c = 0.05
alpha     k=1    k=2    k=3    k=4    k=5    k=6    k=8   best k
0.5      1.43   1.59   1.63   1.61   1.57   1.53   1.43   3 (1.63x)
0.6      1.52   1.78   1.89   1.92   1.91   1.87   1.77   4 (1.92x)
0.7      1.62   1.99   2.20   2.31   2.35   2.35   2.28   6 (2.35x)
0.8      1.71   2.22   2.57   2.80   2.95   3.04   3.09   8 (3.09x)
0.9      1.81   2.46   2.99   3.41   3.75   4.01   4.38   13 (4.67x)

speedup, draft cost c = 0.2
alpha     k=1    k=2    k=3    k=4    k=5    k=6    k=8   best k
0.5      1.25   1.25   1.17   1.08   0.98   0.90   0.77   1 (1.25x)
0.6      1.33   1.40   1.36   1.28   1.19   1.10   0.95   2 (1.40x)
0.7      1.42   1.56   1.58   1.54   1.47   1.39   1.23   3 (1.58x)
0.8      1.50   1.74   1.85   1.87   1.84   1.80   1.66   4 (1.87x)
0.9      1.58   1.94   2.15   2.28   2.34   2.37   2.36   7 (2.37x)
```

Three things jump out. The best k moves with alpha, so a fixed k is wrong for most of your traffic. With an expensive draft and mediocre acceptance, a long draft is a net loss (0.77x at alpha 0.5, k = 8). And the headline "3x" numbers need alpha around 0.8 or better with a cheap drafter, which is why EAGLE-style heads that cost a fraction of a layer beat standalone draft models. This model is also optimistic: it ignores the bookkeeping overhead (KV rollback, sampling, Python), which matters a lot for small models, as the next section shows.

### A real measurement with transformers

Now the real thing, with Hugging Face transformers 5.17 and torch 2.11. The target is [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) and the draft is [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct): same family, same tokenizer, about 1 GB of downloads together. Assisted generation is one argument, `assistant_model=`, and prompt lookup is `prompt_lookup_num_tokens=`. In transformers 5.17 the assistant defaults to drafting up to 20 tokens and stopping early when its confidence drops below 0.4; I pinned k = 5 with a constant schedule so the numbers are easy to interpret. A forward hook on the target counts its passes, and the modes run round-robin so a noisy neighbor on the machine slows all of them alike.

```python title="bench_assisted.py"
import statistics
import sys
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

DEVICE = sys.argv[1] if len(sys.argv) > 1 else "cpu"
DTYPE = torch.bfloat16 if DEVICE == "cuda" else torch.float32
TARGET = "HuggingFaceTB/SmolLM2-360M-Instruct"
DRAFT = "HuggingFaceTB/SmolLM2-135M-Instruct"
NEW_TOKENS = 192
REPEATS = 5

CODE = '''def load_orders(path):
    orders = []
    with open(path) as f:
        for line in f:
            order_id, customer, amount, status = line.strip().split(",")
            if status == "paid":
                orders.append({"id": order_id, "customer": customer, "amount": float(amount)})
    return orders
'''
PROMPTS = {
    "code edit": f"Add type hints and a docstring to this function. Return the full function.\n\n{CODE}",
    "story": "Write a short story about a lighthouse keeper who finds a message in a bottle.",
}

tok = AutoTokenizer.from_pretrained(TARGET)
target = AutoModelForCausalLM.from_pretrained(TARGET, dtype=DTYPE).to(DEVICE).eval()
draft = AutoModelForCausalLM.from_pretrained(DRAFT, dtype=DTYPE).to(DEVICE).eval()

calls = {"target": 0}
target.register_forward_hook(lambda *_: calls.__setitem__("target", calls["target"] + 1))


def encode(prompt):
    messages = [{"role": "user", "content": prompt}]
    return tok.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt", return_dict=True).to(DEVICE)


def run(inputs, seed, **kwargs):
    torch.manual_seed(seed)
    if DEVICE == "cuda":
        torch.cuda.synchronize()
    calls["target"] = 0
    start = time.perf_counter()
    out = target.generate(**inputs, max_new_tokens=NEW_TOKENS, pad_token_id=tok.eos_token_id, **kwargs)
    if DEVICE == "cuda":
        torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    new = out[0, inputs["input_ids"].shape[1]:]
    return new, elapsed, calls["target"]


def first_diff(a, b):
    n = min(len(a), len(b))
    diff = (a[:n] != b[:n]).nonzero()
    return int(diff[0]) if len(diff) else (None if len(a) == len(b) else n)


def bench(inputs, modes):
    for kwargs in modes.values():
        run(inputs, seed=0, **kwargs)  # warm-up
    results = {name: [] for name in modes}
    # Round-robin, so a noisy neighbour on the machine slows every mode alike.
    for i in range(REPEATS):
        for name, kwargs in modes.items():
            results[name].append(run(inputs, seed=i, **kwargs))
    summary = {}
    for name, rs in results.items():
        tps = statistics.median(len(r[0]) / r[1] for r in rs)
        per_call = statistics.median(len(r[0]) / r[2] for r in rs)
        summary[name] = (rs[0][0], tps)
        print(f"  {name:<22} {tps:>7.1f} tok/s  {per_call:>5.2f} tok/target call  ({len(rs[0][0])} tokens)")
    return summary


draft.generation_config.num_assistant_tokens = 5
draft.generation_config.num_assistant_tokens_schedule = "constant"
draft.generation_config.assistant_confidence_threshold = 0.0

print(f"device={DEVICE} dtype={DTYPE} torch threads={torch.get_num_threads()}")
greedy = {
    "plain": dict(do_sample=False),
    "draft model, k=5": dict(do_sample=False, assistant_model=draft),
    "prompt lookup, k=10": dict(do_sample=False, prompt_lookup_num_tokens=10),
}
sampled = {
    "plain": dict(do_sample=True, temperature=1.0, top_k=0, top_p=1.0),
    "draft model, k=5": dict(do_sample=True, temperature=1.0, top_k=0, top_p=1.0, assistant_model=draft),
}
with torch.inference_mode():
    for label, prompt in PROMPTS.items():
        inputs = encode(prompt)
        print(f"[{label}] greedy")
        g = bench(inputs, greedy)
        base, base_tps = g["plain"]
        for name in ("draft model, k=5", "prompt lookup, k=10"):
            tokens, tps = g[name]
            print(f"  {name}: {tps / base_tps:.2f}x, first token that differs from plain: {first_diff(base, tokens)}")
        print(f"[{label}] sampling, temperature=1.0")
        s = bench(inputs, sampled)
        print(f"  draft model, k=5: {s['draft model, k=5'][1] / s['plain'][1]:.2f}x")
```

@@BENCH@@

## Production Reality Check

The toy proves the algorithm and the laptop proves that the algorithm is not the speedup. These are the things that decide whether it pays in a real deployment.

### Batch size eats the free compute

Everything above rests on idle compute during decode. A serving engine at high load fills that compute with other users' tokens through continuous batching. Once the batch is large enough that decode becomes compute-bound, the k extra positions per sequence are no longer free: verifying 5 draft tokens for 64 sequences costs real FLOPs, and every rejected token is compute you took from someone else's request. The vLLM docs put it plainly: model-based methods give the high gains at low QPS, where latency is the goal.

It's not a hard rule that speculation dies at batch size 8. [MagicDec](https://arxiv.org/abs/2408.11049) shows that for long contexts, where reading the KV cache dominates each step, decode stays memory-bound even at batch sizes of 32 to 256, and reports up to 2.51x on Llama 3.1 8B with a draft that uses a sparse KV cache. EAGLE-3 reports 1.38x throughput at batch 64 in SGLang. The takeaway is to measure at your real concurrency and context length, and prefer engines that adjust or disable speculation as load grows (vLLM lists dynamic speculative decoding among its options).

### Acceptance depends on the content

Alpha is not a property of the model pair. It's a property of the model pair on your traffic, at your sampling settings. My code-edit prompt was mostly copying, so both the draft and prompt lookup did well; the story prompt had nothing to copy. Temperature matters too: at high temperature the target's distribution spreads out and the draft's guesses match it less often. Log the acceptance rate per route (tokens per target pass is enough) and decide per workload. Extraction, code editing and RAG answers are good candidates; open-ended creative writing at temperature 1.0 usually isn't.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>It's mathematically lossless, so I can turn it on in production without rerunning our evals.</span>
    </div>
  </div>
</div>

The math is exact in real arithmetic. Your GPU isn't. Verifying five tokens in one pass runs different kernels, with different reduction orders, than five single-token passes, and in bf16 that changes logits in the last bits. When two tokens are nearly tied, the argmax flips, and from there the sequence diverges. My greedy prompt-lookup run on the GPU diverged from plain greedy at token 14. The vLLM docs say the same thing about their implementation: outputs can vary because of floating point precision and batch size. The distribution is right, the individual outputs are not bit-identical, and some variants (Medusa's typical acceptance, relaxed verification schemes) aren't distribution-preserving at all. Rerun the evals, and pin the configuration you evaluated.

### Draft cost and memory are real costs

A separate draft model needs its own weights and its own KV cache on the same GPU, which is memory you'd otherwise give to a larger batch or a longer context. It needs the same tokenizer (transformers has a universal assisted decoding mode for mismatched tokenizers, at the price of re-tokenizing). Its forward passes are sequential and latency-bound, so c in the formula is usually worse than the parameter ratio suggests, as my laptop showed. And in transformers specifically, assisted generation only supports batch size 1 (the 5.17 source raises "assisted generate is only supported for batch_size = 1"), which makes it a single-stream latency tool, not a serving strategy.

### Tune k, and measure the right things

The table said it: the best k depends on alpha and c, and a fixed k is wrong for most requests. Use adaptive drafting where the engine offers it (transformers' heuristic schedule and confidence threshold, EAGLE-2's dynamic trees, vLLM's dynamic options), and sweep `num_speculative_tokens` against real traffic when it doesn't.

Then measure what users feel. Time to first token doesn't improve (the draft adds a little prefill of its own). Inter-token latency averages improve, but tokens now arrive in bursts, which some streaming UIs render awkwardly. Track tokens per target pass as the leading indicator, per-request tokens per second for latency, and tokens per second per GPU for cost, at your real concurrency. If the last one drops at peak, speculation is taking from the batch.

Speculative decoding is one of the few inference tricks that is both exact and simple: guess cheaply, verify in one pass, keep the guesses the target would have made anyway, and fix the first one it wouldn't. The rejection rule guarantees you the target's distribution; nothing guarantees you the speedup. Measure alpha on your traffic, remember that the free compute belongs to the batch at peak, and the "2x to 3x" becomes a decision instead of a hope.
