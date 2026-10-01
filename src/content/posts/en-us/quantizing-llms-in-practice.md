---
title: "Quantizing LLMs Without Guesswork: What 4 Bits Really Cost"
description: "What quantization does to an LLM's weights, activations and KV cache, and how to measure what you lost before you ship it."
date: 2026-08-17
tags: [LLMs, Quantization, Python, Performance]
tldr:
  - "Quantization is rounding with a scale, and how many values share one scale (tensor, channel or group) decides the damage as much as the bit width."
  - "Weights go to 8 bits easily and to 4 bits with small groups or GPTQ and AWQ; activations resist, because a few channels carry values 100 to 1,000 times larger than the rest."
  - "Compare every quantized model against its unquantized self with perplexity, KL divergence, top-1 agreement and your own task evals, because perplexity alone averages regressions away."
---

A team wants to self-host an 8B model on one 24 GB GPU. The BF16 checkpoint is 15 GiB, which loads, but leaves room for a few tens of thousands of tokens of KV cache shared by every concurrent request. Someone downloads a 4-bit build from the hub, it's a third of the size, a quick chat looks fine, and it ships. Two weeks later the extraction pipeline starts returning dates in the wrong format a few times a day, and nobody connects it to the model swap because "4-bit is basically lossless, everybody says so."

Sometimes it is close to lossless. Sometimes it isn't, and the only way to know is to measure against the model you started from. This post covers what quantization actually does to the numbers (formats, scales, zero points, granularity), why activations are much harder than weights, what GPTQ, AWQ, GGUF k-quants and NF4 do differently, what the KV cache costs, and the part most tutorials skip: how to measure what you lost. The hands-on part quantizes a real layer of SmolLM2-135M in NumPy, fake-quantizes the whole model at sixteen settings and scores each one, and ends with a memory calculator. Every number below comes from those runs.

## The Problem & Context

An LLM is mostly matrices. SmolLM2-135M has 30 transformer blocks with seven linear layers each, and those 210 weight matrices hold about 80% of its parameters; in an 8B model the share is closer to 87%. Stored in BF16, every parameter costs 2 bytes, so the weights of an 8B model cost about 15 GiB before you've processed a single token.

That matters twice. First, memory: the weights, the KV cache and some working space have to fit on the GPU. Second, speed: generating one token at batch size 1 reads every weight from GPU memory once, and on current hardware that read, not the arithmetic, sets the pace. Decoding is memory-bandwidth bound, so a model stored in 4 bits instead of 16 reads a quarter of the bytes per token, and a good kernel turns that into faster generation.

Quantization is how you get there: store numbers in fewer bits and accept a controlled amount of error. "Controlled" is the part that needs work.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy: cast the weights to int8. Eight bits is eight bits, same as FP8, and PyTorch does it in one line.</span>
    </div>
  </div>
</div>

Casting a float to an integer type truncates it to a whole number. The weights of a trained model mostly sit between -0.5 and 0.5, so a plain cast turns almost all of them into 0 and the model into noise. Integer quantization needs a **scale** that maps the real range of the values onto the integer grid, and choosing that scale (how, from which values, shared by how many of them) is the whole game. FP8 is a different animal too: it's a floating point format, with an exponent that gives it a wide range and relative precision, while INT8 is 256 evenly spaced steps. Same byte count, different behavior.

## Deep Dive / Architectural Design

### Number formats: what the bits buy

Floating point formats split their bits into a sign, an exponent (range) and a mantissa (precision):

- **FP32**: 8 exponent bits, 23 mantissa bits. Training master weights, rarely stored for inference.
- **FP16**: 5 exponent bits, 10 mantissa bits, largest value 65,504. Precise, but its narrow range can overflow in activations.
- **BF16**: 8 exponent bits (the same range as FP32), 7 mantissa bits. Most open checkpoints ship in it, SmolLM2 included.
- **FP8**: two variants defined in [FP8 Formats for Deep Learning](https://arxiv.org/abs/2209.05433) (Micikevicius et al., 2022). E4M3 has 4 exponent and 3 mantissa bits, gives up infinities to reach a maximum of 448, and is the one used for weights and activations; E5M2 trades precision for range (maximum 57,344) and is mostly used for gradients.

Integer formats have no exponent. INT8 is 256 evenly spaced levels, INT4 is 16, INT3 is 8. The difference that matters: a float's step size grows with the magnitude of the number, so small values keep fine resolution next to large ones. An integer grid has one step size for everything it covers, set by the scale. That's why FP8 tolerates a single scale for a whole tensor surprisingly well and INT4 doesn't tolerate it at all, as the measurements below show.

### Scale and zero point

Symmetric quantization maps `[-max|x|, +max|x|]` onto the signed integer range:

```text title="symmetric"
qmax  = 2^(bits-1) - 1              # 127 for INT8, 7 for INT4
scale = max(|x|) / qmax
q     = clamp(round(x / scale), -qmax, qmax)
x'    = q * scale                   # what the model computes with
```

Asymmetric quantization maps `[min(x), max(x)]` onto the unsigned range and stores a **zero point**, the integer that represents real zero:

```text title="asymmetric"
scale = (max(x) - min(x)) / (2^bits - 1)
zero  = round(-min(x) / scale)
q     = clamp(round(x / scale) + zero, 0, 2^bits - 1)
x'    = (q - zero) * scale
```

Symmetric is simpler and faster (no zero point in the inner loop) and wastes nothing when the values are centered on zero, which weights roughly are. Asymmetric uses the whole grid when the values are skewed, which is why it helps at 4 bits and below, where every one of the 16 levels counts. The error per value is at most half a step, `scale / 2`, so everything comes down to keeping the scale small, and the scale is set by the largest value it has to cover.

### Granularity: who shares a scale

The same formulas work on any block of values. The choice of block is the most important decision in the whole scheme:

<div id="quantize-granularity-slot"></div>

**Per-tensor** uses one scale for the entire matrix. It's free to store and trivial to implement, and one large value stretches the step for every other weight. **Per-channel** gives each output row of the weight matrix its own scale (16 extra bits per row, negligible), so a large value only coarsens its own row. **Group-wise** goes further and gives every run of 32, 64 or 128 consecutive weights inside a row its own scale. With an FP16 scale per group of 128, that's `16 / 128 = 0.125` extra bits per weight; with groups of 32, half a bit. Every serious 4-bit format is group-wise for this reason: at 16 levels you can't afford to let a distant outlier set your step size.

For activations the equivalent axes are per-tensor (one scale for the whole batch) and **per-token** (one scale per row of the activation matrix, computed on the fly).

### Why activations are the hard part

Weights are fixed after training, roughly bell-shaped, and can be quantized offline with all the time in the world. Activations are produced fresh for every input, and they have outliers.

[LLM.int8()](https://arxiv.org/abs/2208.07339) (Dettmers et al., 2022) is the paper that made this concrete. In transformers above roughly 6.7B parameters, a handful of hidden dimensions carry values far larger than the rest, systematically, in most layers and for most tokens. Per-tensor INT8 activations then fail: the scale has to cover the outlier, so the ordinary values collapse into a few levels around zero. The paper's fix is a mixed-precision decomposition: feature dimensions where any value reaches the threshold of 6.0 are pulled out and multiplied in FP16, the rest go through INT8 with per-row scales for the activations and per-column scales for the weights (vector-wise quantization). More than 99.9% of the values still get multiplied in 8 bits, and it works at 175B parameters with no measurable degradation.

A second kind of outlier sits on top of that: [massive activations](https://arxiv.org/abs/2402.17762) (Sun et al., 2024), a few individual values up to 100,000 times larger than typical, stuck on specific tokens such as the first one, which act as fixed bias terms the model relies on. You can't clip them away without breaking the model, and they wreck any scale they share.

You don't need a 7B model to see both. In SmolLM2-135M, the input to layer 28's `down_proj` has a median magnitude of 0.17, one channel sitting near 39 on every single token, and a value of 2,589 at position 0.

[SmoothQuant](https://arxiv.org/abs/2211.10438) (Xiao et al., 2022) takes a different route. A linear layer computes `X W^T`, so dividing input channel `j` of the activations by a factor `s_j` and multiplying column `j` of the weights by the same factor leaves the output unchanged. Pick

```text title="smoothing factor"
s_j = max(|X_j|)^alpha / max(|W_j|)^(1 - alpha)
```

and the activation outliers shrink while the weights absorb some of their range. Weights are easy to quantize, so they can take it. With `alpha = 0.5` the difficulty is split evenly; the paper uses 0.5 for most models and 0.75 for GLM-130B, whose outliers are more severe. Afterwards everything is plain W8A8 (8-bit weights, 8-bit activations), which runs on INT8 tensor cores with no mixed-precision bookkeeping. The factors are computed once, offline, from calibration data, and folded into the previous layer's weights.

<div id="quantize-outliers-slot"></div>

The numbers in that diagram come from the NumPy script below, on the real activations of that layer.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If a few outliers ruin the scale, clip them. They're 0.1% of the values, the model won't miss them.</span>
    </div>
  </div>
</div>

Clipping is the first thing everyone tries, and the same layer shows why it fails. Clip every activation above the 99.9th percentile, exactly 0.10% of the values (everything above 17.85), and the output of position 0 is 98.5% wrong while every other token still carries 25% error: channel 1095 sits near 39 on every token, so it gets cut on all of them. Clip only the top 0.01% (above 45.09) and channel 1095 survives, the other tokens drop to 1.9% error, and position 0 is still 97% wrong, because its 2,589 is precisely the value being cut. The massive activations paper found the same at full scale: setting those few values to zero wrecks a model's perplexity, because attention uses them as fixed biases. The outliers are rare and they carry signal. What has to change is who shares a scale with them, and LLM.int8(), SmoothQuant and weight-only quantization are three ways of arranging that. The clipping script is in the hands-on section.

### Weight-only methods: GPTQ, AWQ and the file formats

Most local and many production deployments sidestep activations entirely: quantize only the weights (W4A16, 4-bit weights with 16-bit activations), dequantize them inside the matmul kernel and compute in BF16. Decoding is memory bound, so reading 4-bit weights is where the speed comes from; the activations stay in 16 bits and their outliers stop mattering. The work then goes into choosing the 4-bit values better than plain rounding does.

**GPTQ** ([Frantar et al., 2022](https://arxiv.org/abs/2210.17323)) quantizes one layer at a time using a small calibration set. It walks through the weight columns, quantizes one, measures the error it introduced, and adjusts the not-yet-quantized columns to compensate, using approximate second-order information (the inverse Hessian of the layer's reconstruction error, built from the calibration inputs). The paper quantizes 175B-parameter models in about four GPU hours to 3 or 4 bits with negligible accuracy loss.

**AWQ** ([Lin et al., 2023](https://arxiv.org/abs/2306.00978), MLSys 2024 best paper) starts from the observation that about 1% of weights matter much more than the rest, and that you find them by looking at the **activations**, not the weights: input channels with large activations multiply everything that passes through them. Instead of keeping those weights in higher precision, AWQ scales the salient channels up before quantization (and the activations down by the same factor, the SmoothQuant identity again), searching the scale per layer. No backpropagation, no reconstruction, so it overfits the calibration set less.

**GGUF k-quants** are llama.cpp's formats, introduced in [PR #1684](https://github.com/ggml-org/llama.cpp/pull/1684). They're group-wise with two levels: super-blocks of 256 weights split into blocks of 16 or 32, with the block scales themselves quantized to 6 or 8 bits. Q4_K costs 4.5 bits per weight, Q5_K 5.5, Q6_K 6.5625, Q3_K 3.4375. The names with a suffix, like Q4_K_M, are mixes: they spend more bits (Q6_K) on some of the attention and feed-forward tensors and keep the output tensor at a higher-precision type.

**NF4** comes from [QLoRA](https://arxiv.org/abs/2305.14314) (Dettmers et al., 2023). Its 16 levels aren't evenly spaced: they're quantiles of a normal distribution, which suits normally distributed weights better than a uniform grid, in blocks of 64 weights. Double quantization then quantizes the per-block scales themselves, cutting their cost from 0.5 to 0.127 bits per parameter. NF4 was built so a 65B model could be fine-tuned on one 48 GB GPU; bitsandbytes dequantizes it to BF16 before the matmul, so it saves memory more than it saves time.

### The KV cache is a second model-sized problem

Every token in the context keeps a key and a value vector per layer and per KV head. The bytes add up as

```text title="kv cache size"
bytes per token = 2 (K and V) x layers x kv_heads x head_dim x bytes per value
```

For Llama 3.1 8B that's `2 x 32 x 8 x 128 x 2 = 128 KiB` per token in BF16: 1 GiB for an 8K-token conversation, and a serving engine holds that for every concurrent request. Quantizing the cache attacks context length and batch size directly. vLLM supports an FP8 cache (`kv_cache_dtype="fp8"`), with a single scale per tensor or per attention head when calibrated. [KIVI](https://arxiv.org/abs/2402.02750) (Liu et al., 2024) goes down to 2 bits by noticing that keys have outlier channels (so quantize them per channel) while values don't (so quantize them per token), and reports 2.6 times less peak memory.

### Measuring what you lost

**Perplexity** is the exponential of the average negative log-likelihood of the correct next token over held-out text. It's cheap, it needs no labels, and it catches a broken model instantly. It's also an average over tens of thousands of tokens, most of which are easy (punctuation, the second half of a word, the obvious next word). A quantized model can keep those right and lose the rare tokens that carry facts, and the average barely moves. Perplexity is also meaningless across different tokenizers, so only compare a model with its own quantized versions.

Two metrics compare the quantized model with the original directly, token by token. The **KL divergence** between the two next-token distributions measures how far the quantized model's beliefs drifted, whether or not the top answer changed. **Top-1 agreement** (llama.cpp's perplexity tool reports it as "Same top p" next to KL) counts how often both models would pick the same next token. [Accuracy is Not All You Need](https://arxiv.org/abs/2407.09141) (Dutta et al., 2024) showed why these matter: compressed models with nearly the same benchmark accuracy as the baseline still **flip** a significant share of individual answers from right to wrong (and others from wrong to right, which hides the damage in the aggregate), and KL divergence and flips track the degradation that users actually notice in free-form generation.

Then **task evals**: the tasks you actually run, scored the way you score them. For a public sanity check I use LAMBADA (predict the last word of a passage, exact match on a greedy decode, a sharp test of long-range context) and HellaSwag (pick the right continuation among four). For your own system, it's your prompts and your grader.

<div id="quantize-eval-loop-slot"></div>

## Hands-On Implementation

Everything below runs on a laptop CPU in a Python 3.12 environment with `torch` 2.11, `transformers` 5.17 and `numpy` 2.5. The model is [HuggingFaceTB/SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) (269 MB of BF16 weights), small enough that quantizing and evaluating it sixteen times is an afternoon, and a real Llama-architecture model with the same kinds of outliers big models have. The held-out text is the WikiText-2 test split, and the task sets are the first 1,000 examples of LAMBADA (OpenAI's version) and of the HellaSwag validation split, fetched as JSON through the Hugging Face datasets server.

### Quantize, then dequantize

Every experiment here is **fake quantization**: round the values to the integer grid and immediately map them back to floats. The model then computes in FP32 with exactly the values a real INT4 or INT8 kernel would see, so the accuracy is right even though nothing gets faster. One function covers every scheme in this post:

```python title="quantize.py"
import numpy as np


def fake_quant(x: np.ndarray, bits: int, symmetric: bool = True, granularity: str | int = "tensor") -> np.ndarray:
    """Quantize to `bits`-bit integers and immediately dequantize back to float.

    granularity: "tensor" (one scale), "row" (one scale per row: per output
    channel for a weight, per token for an activation) or an int group size
    (one scale per run of that many consecutive values inside a row).
    """
    if granularity == "tensor":
        blocks = x.reshape(1, -1)
    elif granularity == "row":
        blocks = x.reshape(x.shape[0], -1)
    else:
        blocks = x.reshape(-1, granularity)

    if symmetric:
        qmax = 2 ** (bits - 1) - 1
        scale = np.abs(blocks).max(axis=1, keepdims=True) / qmax
        scale[scale == 0] = 1.0
        q = np.clip(np.round(blocks / scale), -qmax, qmax)
        dequant = q * scale
    else:
        qmax = 2**bits - 1
        low = blocks.min(axis=1, keepdims=True)
        high = blocks.max(axis=1, keepdims=True)
        scale = (high - low) / qmax
        scale[scale == 0] = 1.0
        zero_point = np.round(-low / scale)
        q = np.clip(np.round(blocks / scale) + zero_point, 0, qmax)
        dequant = (q - zero_point) * scale

    return dequant.reshape(x.shape).astype(x.dtype)


def rel_error(reference: np.ndarray, approx: np.ndarray) -> float:
    return float(np.linalg.norm(reference - approx) / np.linalg.norm(reference))


def bits_per_weight(bits: int, symmetric: bool, granularity: str | int, shape: tuple[int, int]) -> float:
    # One FP16 scale per block, plus a `bits`-wide zero point when asymmetric.
    block = shape[0] * shape[1] if granularity == "tensor" else shape[1] if granularity == "row" else granularity
    return bits + (16 + (0 if symmetric else bits)) / block
```

The `"row"` mode is per-channel for a weight matrix (each row is one output channel) and per-token for an activation matrix (each row is one token). A group size reshapes each row into runs of consecutive values. Dequantizing to float keeps everything else in the pipeline unchanged.

### One real weight matrix

This pulls the `down_proj` weight of layer 28 and the activations that feed it (512 tokens of WikiText-2):

```python title="extract_layer.py"
import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "HuggingFaceTB/SmolLM2-135M"
LAYER = 28

tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).eval()
down_proj = model.model.layers[LAYER].mlp.down_proj

text = open("data/wikitext2_test.txt", encoding="utf-8").read()
ids = tokenizer(text[:20000], return_tensors="pt").input_ids[:, :512]

captured = {}
down_proj.register_forward_hook(lambda mod, inp, out: captured.update(x=inp[0][0].numpy()))
with torch.no_grad():
    model(ids)

np.savez("down_proj_l28.npz", w=down_proj.weight.detach().numpy(), x=captured["x"])
print("W", down_proj.weight.shape, "X", captured["x"].shape)
```

```text title="output"
W torch.Size([576, 1536]) X (512, 1536)
```

Then it quantizes the weight at twelve settings. "Weight err" is the relative Frobenius error of the matrix, `||W - W'|| / ||W||`; "output err" is the same for the layer output `X W^T`, which is what the next layer actually receives. The second part plants one weight at ten times the tensor's maximum, the way an outlier would, and checks the damage on the *other* rows:

```python title="weights_demo.py"
import numpy as np

from quantize import bits_per_weight, fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w = data["w"]
# Position 0 carries a massive activation (see below) and would dominate the output norm.
x = data["x"][1:]
y = x @ w.T

SETTINGS = [
    (8, True, "tensor"),
    (8, True, "row"),
    (4, True, "tensor"),
    (4, False, "tensor"),
    (4, True, "row"),
    (4, False, "row"),
    (4, True, 128),
    (4, False, 128),
    (4, True, 32),
    (4, False, 32),
    (3, False, 128),
    (3, False, 32),
]


def label(bits, symmetric, granularity):
    kind = "sym" if symmetric else "asym"
    where = {"tensor": "per-tensor", "row": "per-channel"}.get(granularity, f"group {granularity}")
    return f"INT{bits} {kind:<4} {where}"


print(f"W {w.shape}, |w| max {np.abs(w).max():.3f}, std {w.std():.4f}")
print(f"{'setting':<26} {'bits/w':>6} {'weight err':>10} {'output err':>10}")
for bits, symmetric, granularity in SETTINGS:
    wq = fake_quant(w, bits, symmetric, granularity)
    bpw = bits_per_weight(bits, symmetric, granularity, w.shape)
    print(f"{label(bits, symmetric, granularity):<26} {bpw:>6.2f} {rel_error(w, wq):>10.2%} {rel_error(y, x @ wq.T):>10.2%}")

print("\nOne weight set to 10x the tensor max, at row 7, column 100")
spiked = w.copy()
spiked[7, 100] = 10 * np.abs(w).max()
others = np.ones(w.shape[0], dtype=bool)
others[7] = False
print(f"{'setting':<26} {'err, other rows':>15} {'err, row 7':>10}")
for bits, symmetric, granularity in [(8, True, "tensor"), (8, True, "row"), (4, True, "row"), (4, True, 32)]:
    wq = fake_quant(spiked, bits, symmetric, granularity)
    print(
        f"{label(bits, symmetric, granularity):<26} "
        f"{rel_error(spiked[others], wq[others]):>15.2%} {rel_error(spiked[7], wq[7]):>10.2%}"
    )
```

```text title="output"
W (576, 1536), |w| max 5.812, std 0.2001
setting                    bits/w weight err output err
INT8 sym  per-tensor         8.00      6.60%      8.76%
INT8 sym  per-channel        8.01      0.90%      1.20%
INT4 sym  per-tensor         4.00     93.29%     74.03%
INT4 asym per-tensor         4.00     70.83%     60.46%
INT4 sym  per-channel        4.01     15.81%     19.61%
INT4 asym per-channel        4.01     13.79%     18.31%
INT4 sym  group 128          4.12     12.09%     16.21%
INT4 asym group 128          4.16     10.26%     13.45%
INT4 sym  group 32           4.50      9.85%     13.29%
INT4 asym group 32           4.62      8.17%     10.92%
INT3 asym group 128          3.15     21.97%     26.86%
INT3 asym group 32           3.59     17.48%     22.40%

One weight set to 10x the tensor max, at row 7, column 100
setting                    err, other rows err, row 7
INT8 sym  per-tensor                64.62%      8.71%
INT8 sym  per-channel                0.90%      8.71%
INT4 sym  per-channel               15.80%     13.39%
INT4 sym  group 32                   9.85%      2.43%
```

What that says:

- **INT8 per-channel is nearly free** (0.90% weight error), and per-tensor is seven times worse with the same 8 bits. The weight maximum is 5.8 against a standard deviation of 0.2, and per-tensor lets that single maximum set everyone's step.
- **INT4 per-tensor is destroyed**: 93% error. The step is `5.8 / 7 = 0.83`, four times the typical weight, so almost everything rounds to zero. Asymmetric barely helps.
- **Groups do what they promise.** INT4 goes from 15.8% (per-channel) to 12.1% with groups of 128 and 9.9% with groups of 32, for 0.125 and 0.5 extra bits per weight. Asymmetric groups shave off another 1.5 to 2 points.
- **3 bits roughly doubles the error of 4 bits**, even with small groups.
- **The planted outlier** pushes the error on the untouched rows from 0.90% to 64.6% under per-tensor INT8, and leaves them exactly where they were under per-channel. That's the granularity diagram, measured.

The output error is larger than the weight error because the activations aren't uniform: channel 1095, the one that's always near 39, multiplies every rounding error in column 1095 of the weights by 39.

### Activation outliers, measured

Same layer, now quantizing the activations too:

```python title="activations_demo.py"
import numpy as np

from quantize import fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w, x = data["w"], data["x"]
y = x @ w.T

abs_x = np.abs(x)
channel_max = abs_x.max(axis=0)
print(f"X {x.shape}: median |x| {np.median(abs_x):.3f}, max {abs_x.max():.1f} at position {abs_x.max(axis=1).argmax()}")
for c in np.argsort(-np.median(abs_x, axis=0))[:2]:
    print(f"channel {c}: median |x| over tokens {np.median(abs_x[:, c]):.1f}")

wq8 = fake_quant(w, 8, True, "row")


def report(name, y_approx):
    print(f"{name:<44} all {rel_error(y, y_approx):>7.2%}   pos 1+ {rel_error(y[1:], y_approx[1:]):>7.2%}")


print("\nW8A8, weights INT8 per-channel in every row below")
report("A8 per-tensor", fake_quant(x, 8, True, "tensor") @ wq8.T)
report("A8 per-token", fake_quant(x, 8, True, "row") @ wq8.T)

# LLM.int8(): feature dimensions with any |x| >= 6 stay in FP16, the rest go through INT8.
outliers = channel_max >= 6.0
x_int8 = fake_quant(np.where(outliers, 0, x), 8, True, "row")
w_int8 = fake_quant(np.where(outliers, 0, w), 8, True, "row")
y_mixed = x_int8 @ w_int8.T + x[:, outliers] @ w[:, outliers].T
report(f"LLM.int8() decomposition ({outliers.sum()} FP16 dims)", y_mixed)

# SmoothQuant: divide activation channel j by s_j and multiply weight column j by s_j.
for alpha in (0.5, 0.8):
    s = channel_max**alpha / np.abs(w).max(axis=0) ** (1 - alpha)
    xs, ws = x / s, w * s
    ws8 = fake_quant(ws, 8, True, "row")
    report(f"SmoothQuant a={alpha}, A8 per-tensor", fake_quant(xs, 8, True, "tensor") @ ws8.T)
    report(f"SmoothQuant a={alpha}, A8 per-token", fake_quant(xs, 8, True, "row") @ ws8.T)
```

```text title="output"
X (512, 1536): median |x| 0.174, max 2589.6 at position 0
channel 1095: median |x| over tokens 38.7
channel 625: median |x| over tokens 15.7

W8A8, weights INT8 per-channel in every row below
A8 per-tensor                                all  21.26%   pos 1+  75.28%
A8 per-token                                 all   2.35%   pos 1+   7.68%
LLM.int8() decomposition (407 FP16 dims)     all   0.24%   pos 1+   0.86%
SmoothQuant a=0.5, A8 per-tensor             all  11.17%   pos 1+  39.55%
SmoothQuant a=0.5, A8 per-token              all   0.79%   pos 1+   2.54%
SmoothQuant a=0.8, A8 per-tensor             all   2.08%   pos 1+   7.35%
SmoothQuant a=0.8, A8 per-token              all   1.30%   pos 1+   4.61%
```

"All" is the error over all 512 tokens and "pos 1+" skips position 0, whose massive activation makes its output 96% of the total norm and would hide everything else. Reading the "pos 1+" column:

- **Per-tensor INT8 activations are unusable: 75% error.** The scale has to cover 2,589, so the step is about 20, and a median value of 0.17 is nowhere near a single step.
- **Per-token scales help a lot (7.7%)**, because position 0 gets its own scale, but channel 1095 still sets the step for every other token.
- **The LLM.int8() decomposition is the most accurate (0.86%)**, and here it shows its cost: at the paper's threshold of 6.0, 407 of the 1,536 dimensions of this layer qualify as outliers and run in FP16. The threshold was chosen for OPT-class models; on a small model with a different activation scale, "0.1% of the values" becomes a quarter of the matmul.
- **SmoothQuant with `alpha = 0.5` and per-token activations reaches 2.5% with every dimension in INT8.** With a per-tensor activation scale it still suffers (39.6%), because position 0 still dominates one shared scale; pushing more of the difficulty into the weights (`alpha = 0.8`) brings per-tensor down to 7.4%.

This is why production W8A8 recipes use per-token dynamic activation scales, or smoothing, or both, and why so many deployments quantize only the weights.

### Clipping, measured

The script behind the clipping numbers in the deep dive, on the same layer and the same 512 tokens:

```python title="clip_demo.py"
import numpy as np

from quantize import fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w, x = data["w"], data["x"]
y = x @ w.T
wq8 = fake_quant(w, 8, True, "row")

for pct in (99.9, 99.99):
    limit = np.percentile(np.abs(x), pct)
    clipped = np.clip(x, -limit, limit)
    share = (np.abs(x) > limit).mean()
    y_clip = clipped @ w.T
    y_q = fake_quant(clipped, 8, True, "tensor") @ wq8.T
    print(f"clip at the {pct}th percentile (|x| <= {limit:.2f}, {share:.2%} of values)")
    print(f"  clipping alone      all {rel_error(y, y_clip):>7.2%}   pos 0 {rel_error(y[:1], y_clip[:1]):>7.2%}   pos 1+ {rel_error(y[1:], y_clip[1:]):>7.2%}")
    print(f"  + A8 per-tensor     all {rel_error(y, y_q):>7.2%}   pos 0 {rel_error(y[:1], y_q[:1]):>7.2%}   pos 1+ {rel_error(y[1:], y_q[1:]):>7.2%}")
```

```text title="output"
clip at the 99.9th percentile (|x| <= 17.85, 0.10% of values)
  clipping alone      all  94.79%   pos 0  98.53%   pos 1+  25.05%
  + A8 per-tensor     all  94.79%   pos 0  98.53%   pos 1+  25.14%
clip at the 99.99th percentile (|x| <= 45.09, 0.01% of values)
  clipping alone      all  92.85%   pos 0  96.78%   pos 1+   1.85%
  + A8 per-tensor     all  92.87%   pos 0  96.77%   pos 1+   9.07%
```

Adding per-tensor INT8 on top of the 0.01% clip brings the other tokens back up to 9.1%: one shared scale still has to cover channel 1095. Clipping trades a quantization problem for a correctness problem, and here it loses on both.

### The whole model, sixteen ways

Now for the model itself. `evaluate.py` restores the original weights, applies one setting to all 210 linear layers of the transformer blocks (the embeddings, shared with the LM head in this model, stay in BF16, as most 4-bit recipes keep them), and scores it:

- perplexity over 32 windows of 1,024 WikiText-2 test tokens (32,736 predictions);
- KL divergence and top-1 agreement against the baseline's next-token distribution, on the first 4 windows (4,092 tokens);
- LAMBADA accuracy (exact greedy match of the whole last word) and HellaSwag accuracy (length-normalized log-likelihood of the four endings, the usual `acc_norm`).

W8A8 settings add a hook that fake-quantizes every linear input; the KV cache settings fake-quantize the output of `k_proj` and `v_proj` per token and per head (64 values share a scale). That's the pre-RoPE key, which is also what [KVQuant](https://arxiv.org/abs/2401.18079) quantizes.

```python title="evaluate.py"
import json
import os
import re
import sys
import time

import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

from quantize import fake_quant

MODEL = "HuggingFaceTB/SmolLM2-135M"
WINDOW, N_WINDOWS, KL_WINDOWS = 1024, 32, 4
torch.manual_seed(0)
torch.set_num_threads(8)

tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).eval()
# The checkpoint is BF16, so keeping the originals in BF16 is lossless and halves the copy.
original = {name: p.detach().to(torch.bfloat16) for name, p in model.named_parameters()}

wiki_ids = tokenizer(open("data/wikitext2_test.txt", encoding="utf-8").read(), return_tensors="pt").input_ids[0]
windows = wiki_ids[: WINDOW * N_WINDOWS].view(N_WINDOWS, WINDOW)
lambada = json.load(open("data/lambada_1000.json", encoding="utf-8"))
hellaswag = json.load(open("data/hellaswag_val_1000.json", encoding="utf-8"))


def linear_layers(m):
    return [(name, mod) for name, mod in m.named_modules() if isinstance(mod, torch.nn.Linear) and ".layers." in name]


def fp8_e4m3(w: torch.Tensor) -> torch.Tensor:
    scale = w.abs().max() / 448.0
    return (w / scale).to(torch.float8_e4m3fn).to(torch.float32) * scale


def apply(setting: dict) -> list:
    with torch.no_grad():
        for name, p in model.named_parameters():
            p.copy_(original[name].float())
    hooks = []
    for name, mod in linear_layers(model):
        w = mod.weight.data
        if setting.get("w") == "fp8":
            mod.weight.data = fp8_e4m3(w)
        elif "w" in setting:
            bits, sym, gran = setting["w"]
            mod.weight.data = torch.from_numpy(fake_quant(w.numpy(), bits, sym, gran))
        if "a" in setting:
            bits, gran = setting["a"]

            def quant_input(module, args, bits=bits, gran=gran):
                x = args[0]
                flat = x.reshape(-1, x.shape[-1]).numpy()
                return (torch.from_numpy(fake_quant(flat, bits, True, gran)).view_as(x),)

            hooks.append(mod.register_forward_pre_hook(quant_input))
        if "kv" in setting and name.endswith(("k_proj", "v_proj")):
            bits = setting["kv"]

            def quant_output(module, args, out, bits=bits):
                head_dim = model.config.head_dim
                return torch.from_numpy(fake_quant(out.reshape(-1, head_dim).numpy(), bits, True, "row")).view_as(out)

            hooks.append(mod.register_forward_hook(quant_output))
    return hooks


@torch.no_grad()
def wikitext_metrics(save_reference: bool = False):
    """Perplexity on every window; KL divergence and top-1 agreement against the baseline on the first KL_WINDOWS."""
    if save_reference:
        ref = np.lib.format.open_memmap("ref_logprobs.npy", "w+", np.float16, (KL_WINDOWS, WINDOW - 1, model.config.vocab_size))
    else:
        ref = np.load("ref_logprobs.npy", mmap_mode="r")
    nll, kl, agree, kl_count = 0.0, 0.0, 0, 0
    for i in range(N_WINDOWS):
        batch = windows[i : i + 1]
        logp = F.log_softmax(model(batch).logits[0, :-1].float(), dim=-1)
        nll += -logp.gather(-1, batch[0, 1:].unsqueeze(-1)).sum().item()
        if i < KL_WINDOWS:
            if save_reference:
                ref[i] = logp.numpy().astype(np.float16)
            ref_logp = torch.from_numpy(np.asarray(ref[i], dtype=np.float32))
            kl += (ref_logp.exp() * (ref_logp - logp)).sum().item()
            agree += (logp.argmax(-1) == ref_logp.argmax(-1)).sum().item()
            kl_count += WINDOW - 1
        del logp
    if save_reference:
        ref.flush()
    return {"ppl": float(np.exp(nll / (N_WINDOWS * (WINDOW - 1)))), "kl": kl / kl_count, "top1_agree": agree / kl_count}


def pad(seqs):
    width = max(len(s) for s in seqs)
    ids = torch.zeros(len(seqs), width, dtype=torch.long)
    mask = torch.zeros(len(seqs), width, dtype=torch.long)
    for row, s in enumerate(seqs):
        ids[row, : len(s)] = torch.tensor(s)
        mask[row, : len(s)] = 1
    return ids, mask


@torch.no_grad()
def continuation_logprobs(pairs, batch_size=8):
    """Sum of log-probs of each continuation given its context, and whether every continuation token is the argmax."""
    results = []
    for i in range(0, len(pairs), batch_size):
        chunk = pairs[i : i + batch_size]
        seqs = [ctx + cont for ctx, cont in chunk]
        ids, mask = pad(seqs)
        logits = model(ids, attention_mask=mask).logits
        for row, (ctx, cont) in enumerate(chunk):
            positions = torch.arange(len(ctx) - 1, len(ctx) + len(cont) - 1)
            target = torch.tensor(cont)
            token_logp = F.log_softmax(logits[row, positions].float(), dim=-1)
            results.append((token_logp.gather(-1, target.unsqueeze(-1)).sum().item(), bool((token_logp.argmax(-1) == target).all())))
    return results


def lambada_accuracy():
    pairs = []
    for row in lambada:
        text = row["text"]
        cut = text.rindex(" ")
        pairs.append((tokenizer(text[:cut]).input_ids, tokenizer(text[cut:]).input_ids))
    return float(np.mean([greedy for _, greedy in continuation_logprobs(pairs)]))


def hellaswag_clean(text):
    text = text.strip().replace(" [title]", ". ")
    return re.sub(r"\[.*?\]", "", text).replace("  ", " ")


def hellaswag_accuracy():
    pairs, lengths, labels = [], [], []
    for row in hellaswag:
        ctx = row["ctx_a"] + " " + row["ctx_b"].capitalize()
        query = tokenizer(hellaswag_clean(row["activity_label"] + ": " + ctx)).input_ids
        for ending in row["endings"]:
            ending = " " + hellaswag_clean(ending)
            pairs.append((query, tokenizer(ending).input_ids))
            lengths.append(len(ending))
        labels.append(int(row["label"]))
    scores = np.array([lp for lp, _ in continuation_logprobs(pairs)]) / np.array(lengths)
    return float(np.mean(scores.reshape(-1, 4).argmax(1) == np.array(labels)))


SETTINGS = {
    "baseline (BF16 weights)": {},
    "FP8 E4M3 per-tensor": {"w": "fp8"},
    "INT8 sym per-tensor": {"w": (8, True, "tensor")},
    "INT8 sym per-channel": {"w": (8, True, "row")},
    "INT4 sym per-tensor": {"w": (4, True, "tensor")},
    "INT4 sym per-channel": {"w": (4, True, "row")},
    "INT4 asym per-channel": {"w": (4, False, "row")},
    "INT4 sym group 64": {"w": (4, True, 64)},
    "INT4 asym group 64": {"w": (4, False, 64)},
    "INT4 asym group 32": {"w": (4, False, 32)},
    "INT3 asym group 64": {"w": (3, False, 64)},
    "INT3 asym group 32": {"w": (3, False, 32)},
    "W8A8 per-channel / per-tensor": {"w": (8, True, "row"), "a": (8, "tensor")},
    "W8A8 per-channel / per-token": {"w": (8, True, "row"), "a": (8, "row")},
    "KV cache INT8": {"kv": 8},
    "KV cache INT4": {"kv": 4},
}

if __name__ == "__main__":
    out_path = os.environ.get("RESULTS", "results.json")
    try:
        results = json.load(open(out_path))
    except FileNotFoundError:
        results = {}
    only = sys.argv[1:]
    for name, setting in SETTINGS.items():
        if name in results or (only and name not in only):
            continue
        start = time.time()
        hooks = apply(setting)
        row = wikitext_metrics(save_reference=not setting)
        row["lambada"] = lambada_accuracy()
        row["hellaswag"] = hellaswag_accuracy()
        for h in hooks:
            h.remove()
        results[name] = row
        json.dump(results, open(out_path, "w"), indent=1)
        print(f"{name:<32} ppl {row['ppl']:8.3f}  kl {row['kl']:.4f}  top1 {row['top1_agree']:.2%}  "
              f"lambada {row['lambada']:.1%}  hellaswag {row['hellaswag']:.1%}  ({time.time() - start:.0f}s)", flush=True)
```

```text title="terminal"
python evaluate.py
python report.py
```

```text title="output"
setting                                   PPL      KL top-1 same  LAMBADA HellaSwag
baseline (BF16 weights)                 16.88  0.0000     100.0%    43.3%     44.4%
FP8 E4M3 per-tensor                     17.05  0.0123      93.6%    42.7%     44.2%
INT8 sym per-tensor                     17.55  0.0453      88.6%    42.2%     44.8%
INT8 sym per-channel                    16.96  0.0036      97.1%    43.1%     44.3%
INT4 sym per-tensor              4,160,947.94 12.3475       1.7%     0.0%     28.0%
INT4 sym per-channel                    38.12  0.8719      52.8%    21.1%     39.0%
INT4 asym per-channel                   28.06  0.4932      63.8%    26.2%     41.6%
INT4 sym group 64                       24.18  0.3437      69.1%    24.4%     44.4%
INT4 asym group 64                      21.70  0.2524      72.3%    31.8%     43.6%
INT4 asym group 32                      20.37  0.1845      75.8%    35.8%     45.9%
INT3 asym group 64                      67.10  1.3826      42.4%    10.0%     40.1%
INT3 asym group 32                      46.32  1.0187      48.4%    13.9%     42.7%
W8A8 per-channel / per-tensor           30.17  0.5456      61.3%    20.6%     39.9%
W8A8 per-channel / per-token            17.59  0.0422      91.4%    41.8%     45.1%
KV cache INT8                           16.89  0.0005      98.8%    43.0%     44.3%
KV cache INT4                           21.03  0.2242      75.7%    30.6%     42.9%
```

Reading it from the top:

- **The baseline isn't exactly zero** (KL 0.000001, 99.98% agreement) because the reference distribution is stored in FP16 to fit on disk. That's the noise floor of the comparison.
- **8-bit weights are safe, and granularity still shows.** INT8 per-channel moves perplexity by 0.5% and keeps 97.1% of the top-1 choices, with LAMBADA inside noise. INT8 per-tensor is clearly worse (KL 0.045, 88.6% agreement), and FP8 per-tensor lands between the two: its exponent gives small weights finer steps, which one INT8 scale can't.
- **INT4 per-tensor is a dead model**: perplexity in the millions, LAMBADA at zero, HellaSwag at 28% where guessing gets 25%.
- **4-bit with groups is usable, and the metrics disagree about how usable.** The best 4-bit row, asymmetric groups of 32, raises perplexity by 21% and agrees with the baseline on three tokens out of four. LAMBADA loses 7.5 points (43.3% to 35.8%), and HellaSwag goes *up* by 1.5.
- **HellaSwag barely notices damage until the model is broken.** INT4 symmetric with groups of 64 scores exactly the baseline's 44.4% while LAMBADA falls 19 points and perplexity rises 43%. Picking one of four endings by likelihood survives a lot of noise; reproducing the exact last word of a passage doesn't. With 1,000 examples the standard error on either task is about 1.6 points, so a gap under 3 points says nothing either way.
- **3 bits breaks a model this small** with plain rounding: perplexity between 46 and 67, LAMBADA down to 10% and 14%.
- **W8A8 lives or dies by the activation scale**, as the single layer predicted. Per-tensor activations nearly double perplexity and halve LAMBADA; per-token activations land close to INT8 weight-only.
- **An INT8 KV cache is free** (KL 0.0005, LAMBADA 43.0%). **INT4 isn't**, at least per token as here: LAMBADA drops to 30.6%. Keys have outlier channels, which is why KIVI quantizes keys per channel and values per token.

Two caveats keep this honest. Every 4-bit and 3-bit row is round-to-nearest, the baseline GPTQ and AWQ were built to beat, so a real 4-bit build should land well above these rows. And a 135M model is far more fragile than an 8B one; the GPTQ paper's own results show larger models losing less at the same bit width. Read the absolute numbers as a worst case. The method is what carries over: one baseline, the same text, KL and agreement next to perplexity, and at least one task that needs exact answers.

### The memory calculator

The last script answers the question that started this post: what fits where. It counts parameters from each model's `config.json` values (checked against the published totals: Llama 3.1 8B comes out at 8.03B), keeps the embeddings and LM head in BF16, and applies each format's real cost in bits per weight, scales and zero points included:

```python title="memory.py"
from dataclasses import dataclass

GIB = 1024**3


@dataclass
class Config:
    name: str
    hidden: int
    intermediate: int
    layers: int
    heads: int
    kv_heads: int
    vocab: int
    head_dim: int = 0

    def __post_init__(self):
        self.head_dim = self.head_dim or self.hidden // self.heads

    @property
    def block_params(self) -> int:
        attn = 2 * self.hidden * self.heads * self.head_dim + 2 * self.hidden * self.kv_heads * self.head_dim
        return self.layers * (attn + 3 * self.hidden * self.intermediate)

    @property
    def embedding_params(self) -> int:
        return 2 * self.vocab * self.hidden  # input embeddings + untied LM head

    def kv_bytes_per_token(self, bytes_per_value: float) -> float:
        return 2 * self.layers * self.kv_heads * self.head_dim * bytes_per_value


# Bits per weight for the transformer blocks, scales and zero points included.
FORMATS = {
    "BF16": 16,
    "INT8 or FP8": 8,
    "INT4 g128 (GPTQ/AWQ)": 4 + (16 + 4) / 128,
    "NF4 + double quant": 4 + 0.127,
    "GGUF Q4_K": 4.5,
    "INT3 g128": 3 + (16 + 3) / 128,
}

MODELS = [
    Config("Llama 3.1 8B", 4096, 14336, 32, 32, 8, 128256),
    Config("Qwen2.5 14B", 5120, 13824, 48, 40, 8, 152064),
    Config("Qwen2.5 32B", 5120, 27648, 64, 40, 8, 152064),
    Config("Llama 3.1 70B", 8192, 28672, 80, 64, 8, 128256),
]


def weights_gib(cfg: Config, block_bits: float, embedding_bits: float = 16) -> float:
    return (cfg.block_params * block_bits + cfg.embedding_params * embedding_bits) / 8 / GIB


def max_context(cfg: Config, gpu_gib: float, block_bits: float, kv_bytes: float, reserve_gib: float = 1.5) -> int:
    free = (gpu_gib - reserve_gib - weights_gib(cfg, block_bits)) * GIB
    return max(0, int(free // cfg.kv_bytes_per_token(kv_bytes)))


if __name__ == "__main__":
    print(f"{'model':<14} {'params':>7} {'embed':>6} {'KV/token':>9}")
    for cfg in MODELS:
        total = cfg.block_params + cfg.embedding_params
        print(f"{cfg.name:<14} {total / 1e9:>6.2f}B {cfg.embedding_params / total:>6.1%} {cfg.kv_bytes_per_token(2) / 1024:>6.0f} KiB")

    print("\nweights in GiB (embeddings and LM head kept in BF16)")
    print(f"{'format':<22}" + "".join(f"{cfg.name:>15}" for cfg in MODELS))
    for fmt, bits in FORMATS.items():
        print(f"{fmt:<22}" + "".join(f"{weights_gib(cfg, bits):>15.1f}" for cfg in MODELS))

    for gpu in (24, 8):
        print(f"\n{gpu} GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)")
        for fmt in ("BF16", "INT8 or FP8", "INT4 g128 (GPTQ/AWQ)"):
            cells = []
            for cfg in MODELS:
                bf16 = max_context(cfg, gpu, FORMATS[fmt], 2)
                fp8 = max_context(cfg, gpu, FORMATS[fmt], 1)
                cells.append("-" if bf16 == 0 and fp8 == 0 else f"{bf16 // 1000}k / {fp8 // 1000}k")
            print(f"{fmt:<22}" + "".join(f"{c:>15}" for c in cells))
```

```text title="output"
model           params  embed  KV/token
Llama 3.1 8B     8.03B  13.1%    128 KiB
Qwen2.5 14B     14.77B  10.5%    192 KiB
Qwen2.5 32B     32.76B   4.8%    256 KiB
Llama 3.1 70B   70.55B   3.0%    320 KiB

weights in GiB (embeddings and LM head kept in BF16)
format                   Llama 3.1 8B    Qwen2.5 14B    Qwen2.5 32B  Llama 3.1 70B
BF16                             15.0           27.5           61.0          131.4
INT8 or FP8                       8.5           15.2           32.0           67.7
INT4 g128 (GPTQ/AWQ)              5.3            9.3           18.0           37.0
NF4 + double quant                5.3            9.2           17.9           36.8
GGUF Q4_K                         5.6            9.8           19.2           39.8
INT3 g128                         4.5            7.7           14.3           29.0

24 GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)
BF16                       61k / 123k              -              -              -
INT8 or FP8               115k / 230k      39k / 79k              -              -
INT4 g128 (GPTQ/AWQ)      140k / 281k     72k / 144k      18k / 36k              -

8 GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)
BF16                                -              -              -              -
INT8 or FP8                         -              -              -              -
INT4 g128 (GPTQ/AWQ)         9k / 19k              -              -              -
```

The 1.5 GiB reserve is my assumption for the CUDA context, the engine's activation workspace and fragmentation; measure yours, it varies by engine and batch size. The KV budget is shared by everything in flight: 61K tokens is one 61K-token conversation or thirty 2K-token ones.

Three things jump out. **The embeddings don't shrink** unless you quantize them too: for Llama 3.1 8B they're 13% of the parameters and 2 GiB of the 5.3 GiB 4-bit total. **On 24 GiB, BF16 8B works but squeezes the cache**, INT8 or FP8 doubles the room, and FP8 KV doubles it again, which for a serving engine means concurrency. **On 8 GiB, 4-bit weights are the only way an 8B model fits at all**, with room for about 9K tokens of BF16 cache, or 19K with an FP8 cache. A 14B model doesn't fit on 8 GiB even at 3 bits once the cache and reserve are counted. The same trade-off shows up in vector search: storing embeddings in int8 or binary cuts memory by 4 to 32 times at a measurable recall cost, as covered in [Your Vector Database Is Slow Because of These 5 Settings](/en-us/blog/vector-database-performance-settings/).

## Production Reality Check

### Fake quantization measures accuracy, not speed

Everything above computes in FP32 with rounded values, so it says nothing about latency. Speed comes from kernels that read packed 4-bit or 8-bit weights and dequantize them in registers, and those depend on the hardware and the format: FP8 matmuls need FP8 tensor cores (NVIDIA Ada, Hopper and newer), and 4-bit weight-only kernels such as Marlin, which vLLM uses on Ampere and later, are what turn W4A16 into faster decoding. Batch size changes the answer too. Weight-only quantization helps most at small batches, where decoding is memory bound; at high concurrency the matmuls become compute bound, the dequantization work shows, and FP8 or W8A8, which also speed up the math, often serve more tokens per second. Benchmark at the concurrency you actually run.

### Use a real method, then measure it like this

Round-to-nearest is the floor. For GPU serving, use GPTQ or AWQ checkpoints (llm-compressor produces both for vLLM) or FP8 on Hopper-class GPUs. For llama.cpp, build k-quants with an importance matrix from `llama-imatrix`, which gives its formats the calibration that GPTQ and AWQ get. Then repeat the comparison above against your own unquantized model. llama.cpp's `llama-perplexity` does the KL part for you: save the base model's logits once with `--kl-divergence-base`, then run each quantized file with `--kl-divergence` to get KL divergence, top-token agreement and perplexity side by side.

### Calibrate on what you serve

GPTQ, AWQ, SmoothQuant, importance matrices and FP8 activation or KV scales all learn from calibration text. If that text is generic English web pages and you serve Portuguese contracts or JSON extraction, the channels that matter for your traffic were never the ones measured. Calibrate on a few hundred samples of real prompts, and evaluate on a different sample.

### Gate it like any other model change

A quantized model is a new model. Put it through the same evals as a model upgrade: your task set, scored by your grader, against the unquantized version on the same inputs, plus the flip count, how many answers went from right to wrong. The date-format bug in the opening is what a flip looks like in production: aggregate quality barely moved, and one field broke a few times a day. If the grader is a model, calibrate it first ([An LLM-as-a-Judge You Can Trust: Calibrate the Grader Before You Believe the Grade](/en-us/blog/llm-as-judge-calibration/) covers how). Keep the unquantized model deployable, so a rollback is a config change.

### Downloaded builds are someone else's choices

A 4-bit file from the hub encodes decisions you didn't make: the method, the group size, the calibration data, which tensors stayed in higher precision. Prefer quantized checkpoints published by the model's authors or by a pipeline you know, read the recipe, and measure the file the same way you'd measure one you built.

### Test the KV cache at your real context length

An 8-bit cache was close to free here; below 8 bits, keys need per-channel treatment. Errors in the cache also compound with length, since every new token attends to every quantized key before it, so test a quantized cache at the context lengths you serve, not on short prompts.

Back to the team with one 24 GB GPU. The 4-bit build may well have been the right call; what was missing was the comparison. An afternoon running their own extraction prompts through the BF16 model and the 4-bit one, with KL divergence and a field-by-field diff of the outputs, would have shown the date problem before their users did. Quantize, and run that comparison on every build before it ships.
