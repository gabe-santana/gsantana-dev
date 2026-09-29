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

CLIP_PLACEHOLDER

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
QUANTIZE_PLACEHOLDER
```

The `"row"` mode is per-channel for a weight matrix (each row is one output channel) and per-token for an activation matrix (each row is one token). A group size reshapes each row into runs of consecutive values. Dequantizing to float keeps everything else in the pipeline unchanged.

### One real weight matrix

This pulls the `down_proj` weight of layer 28 and the activations that feed it (512 tokens of WikiText-2):

```python title="extract_layer.py"
EXTRACT_PLACEHOLDER
```

```text title="output"
W torch.Size([576, 1536]) X (512, 1536)
```

Then it quantizes the weight at twelve settings. "Weight err" is the relative Frobenius error of the matrix, `||W - W'|| / ||W||`; "output err" is the same for the layer output `X W^T`, which is what the next layer actually receives. The second part plants one weight at ten times the tensor's maximum, the way an outlier would, and checks the damage on the *other* rows:

```python title="weights_demo.py"
WEIGHTS_PLACEHOLDER
```

```text title="output"
WEIGHTS_OUTPUT_PLACEHOLDER
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
ACTIVATIONS_PLACEHOLDER
```

```text title="output"
ACTIVATIONS_OUTPUT_PLACEHOLDER
```

"All" is the error over all 512 tokens and "pos 1+" skips position 0, whose massive activation makes its output 96% of the total norm and would hide everything else. Reading the "pos 1+" column:

- **Per-tensor INT8 activations are unusable: 75% error.** The scale has to cover 2,589, so the step is about 20, and a median value of 0.17 is nowhere near a single step.
- **Per-token scales help a lot (7.7%)**, because position 0 gets its own scale, but channel 1095 still sets the step for every other token.
- **The LLM.int8() decomposition is the most accurate (0.86%)**, and here it shows its cost: at the paper's threshold of 6.0, 407 of the 1,536 dimensions of this layer qualify as outliers and run in FP16. The threshold was chosen for OPT-class models; on a small model with a different activation scale, "0.1% of the values" becomes a quarter of the matmul.
- **SmoothQuant with `alpha = 0.5` and per-token activations reaches 2.5% with every dimension in INT8.** With a per-tensor activation scale it still suffers (39.6%), because position 0 still dominates one shared scale; pushing more of the difficulty into the weights (`alpha = 0.8`) brings per-tensor down to 7.4%.

This is why production W8A8 recipes use per-token dynamic activation scales, or smoothing, or both, and why so many deployments quantize only the weights.

### The whole model, sixteen ways

Now for the model itself. `evaluate.py` restores the original weights, applies one setting to all 210 linear layers of the transformer blocks (the embeddings, shared with the LM head in this model, stay in BF16, as most 4-bit recipes keep them), and scores it:

- perplexity over 32 windows of 1,024 WikiText-2 test tokens (32,736 predictions);
- KL divergence and top-1 agreement against the baseline's next-token distribution, on the first 4 windows (4,092 tokens);
- LAMBADA accuracy (exact greedy match of the whole last word) and HellaSwag accuracy (length-normalized log-likelihood of the four endings, the usual `acc_norm`).

W8A8 settings add a hook that fake-quantizes every linear input; the KV cache settings fake-quantize the output of `k_proj` and `v_proj` per token and per head (64 values share a scale). That's the pre-RoPE key, which is also what [KVQuant](https://arxiv.org/abs/2401.18079) quantizes.

```python title="evaluate.py"
EVALUATE_PLACEHOLDER
```

```text title="terminal"
python evaluate.py
python report.py
```

```text title="output"
MODEL_TABLE_PLACEHOLDER
```

MODEL_ANALYSIS_PLACEHOLDER

### The memory calculator

The last script answers the question that started this post: what fits where. It counts parameters from each model's `config.json` values (checked against the published totals: Llama 3.1 8B comes out at 8.03B), keeps the embeddings and LM head in BF16, and applies each format's real cost in bits per weight, scales and zero points included:

```python title="memory.py"
MEMORY_PLACEHOLDER
```

```text title="output"
MEMORY_OUTPUT_PLACEHOLDER
```

The 1.5 GiB reserve is my assumption for the CUDA context, the engine's activation workspace and fragmentation; measure yours, it varies by engine and batch size. The KV budget is shared by everything in flight: 61K tokens is one 61K-token conversation or thirty 2K-token ones.

Three things jump out. **The embeddings don't shrink** unless you quantize them too: for Llama 3.1 8B they're 13% of the parameters and 2 GiB of the 5.3 GiB 4-bit total. **On 24 GiB, BF16 8B works but squeezes the cache**, INT8 or FP8 doubles the room, and FP8 KV doubles it again, which for a serving engine means concurrency. **On 8 GiB, 4-bit weights are the only way an 8B model fits at all**, with room for about 9K tokens of BF16 cache, or 19K with an FP8 cache. A 14B model doesn't fit on 8 GiB even at 3 bits once the cache and reserve are counted. The same trade-off shows up in vector search: storing embeddings in int8 or binary cuts memory by 4 to 32 times at a measurable recall cost, as covered in [Your Vector Database Is Slow Because of These 5 Settings](/en-us/blog/vector-database-performance-settings/).

## Production Reality Check

PRODUCTION_PLACEHOLDER
