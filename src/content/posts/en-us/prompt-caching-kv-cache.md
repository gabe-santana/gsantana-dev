---
title: "Prompt Caching from the KV Cache Up: Why Your Agent Pays Full Price for the Same Prompt"
description: "How KV caches and prefix caching work inside inference engines, and how to lay out agent prompts so provider prompt caching actually hits."
date: 2026-07-08
tags: [LLM, AI Agents, Python, Performance]
tldr:
  - "Prompt caching is KV cache reuse: the engine keeps the keys and values it already computed for a prefix, so a hit skips prefill for those tokens and bills them at a fraction of the input price."
  - "It is a strict prefix match over hashed blocks: one changed byte (a timestamp, a reordered tool, unsorted JSON) invalidates everything after it, so stable content goes first and volatile content last."
  - "Measure it from the usage fields on every response, not once: cached tokens over total prompt tokens is the number that tells you a refactor quietly doubled the bill."
---

Picture a support agent with twelve tools, a system prompt of about fourteen hundred words and conversations of six to ten turns. Every turn resends all of it, plus the history, plus three retrieved knowledge base chunks. The team turned on prompt caching weeks ago and moved on. The invoice says otherwise: cached input tokens are around one percent of the total. Somebody added `Current time: {now}` to the first line of the system prompt so the model would stop getting dates wrong, and the tool registry is built by merging plugin dictionaries, so the tool JSON comes out in a different order depending on which worker serves the request.

Neither change was wrong on its own. Both destroyed the one property caching depends on: that the beginning of the prompt is byte-for-byte identical across requests. This post goes from the bottom up. What the KV cache actually stores and why prefill is the expensive part, how inference engines turn that into a prefix cache with chained block hashes, what Anthropic and OpenAI expose on top of it, and then the engineering: a prompt layout that keeps the stable part stable, a simulation that shows how much each mistake costs, and how to read the usage fields so you notice when it breaks. The Naive Junior shows up too.

## The Problem & Context

An agent is a loop that calls a stateless API. Every iteration sends the tool definitions, the system prompt, the entire conversation so far, the tool results and the new user turn. The model's answer is a few hundred tokens; the prompt is thousands, and it grows every turn. In the agents I've built, input tokens dominate the bill by a wide margin, and most of those input tokens are the same tokens the model saw one request earlier.

Recomputing them is pure waste, and every serious serving stack knows it. Inference engines such as vLLM and SGLang keep the attention state for prefixes they have already processed and reuse it. Providers expose the same mechanism as prompt caching: Anthropic bills cache reads at a tenth of the base input price on most models, and OpenAI applies a discount automatically to prompts over 1,024 tokens. The latency gain is real too, since the time to first token is dominated by processing the prompt.

The catch is that the cache is a strict prefix match. It doesn't understand your prompt, it compares bytes (actually tokens, which comes to the same thing). If anything changes at position N, everything from N onwards is a miss, and nothing tells you. No error, no warning, the response is identical. The only signal is a field in the usage object that most code never reads.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Caching is the provider's job. I added cache_control, the docs say it works, done.</span>
    </div>
  </div>
</div>

The provider caches whatever prefix you send it. Whether that prefix repeats is decided entirely by your prompt assembly code, and that code changes all the time: someone adds a feature flag to the system prompt, a library upgrade reorders JSON keys, a new tool is inserted in the middle of the list. The marker is the easy part. Keeping the bytes in front of it stable is an engineering property of your codebase, and like any other property it regresses unless something checks it.

## Deep Dive / Architectural Design

### What the KV cache stores

A decoder-only transformer generates one token at a time, and every new token attends to all the tokens before it. In each layer, each token is projected into a query, a key and a value. The new token's query is compared against the keys of every previous token, and the resulting weights mix their values. The keys and values of past tokens never change once computed, because a token can only see what came before it. So the engine computes them once and stores them: that store is the KV cache.

Its size is easy to compute. For every token in the context, every layer holds one key vector and one value vector per KV head:

`bytes per token = 2 x layers x kv_heads x head_dim x bytes_per_value`

The `kv_heads` term is where architecture matters. Classic multi-head attention has one KV head per query head. [Multi-query attention](https://arxiv.org/abs/1911.02150) shares a single KV head across all query heads, and [grouped-query attention](https://arxiv.org/abs/2305.13245) sits in between, sharing each KV head across a group. Llama 2 7B uses full multi-head attention with 32 KV heads; Llama 3.1 8B has the same depth and head size but 8 KV heads, which makes its KV cache four times smaller per token. The calculator in the hands-on section puts real numbers on it: 512 KiB per token for Llama 2 7B, 128 KiB for Llama 3.1 8B, 320 KiB for Llama 3.1 70B. An 8,000-token agent prompt on the 70B model is 2.5 GiB of GPU memory just for its KV cache.

That is the first reason prefix caching is not free for the provider: cached prefixes occupy the same GPU memory that running requests need, so every cache is also an eviction policy.

### Prefill is the expensive part, decode is the slow part

Serving a request has two phases. **Prefill** runs the whole prompt through the model in one pass. All prompt tokens are known up front, so the work is large matrix multiplications over thousands of tokens at once, which keeps the GPU's compute units busy. Its cost grows with the prompt length, and it determines the time to first token. **Decode** then generates one token per step. Each step does little arithmetic, but it has to read all the model weights and the entire KV cache from memory to produce a single token, so it is bound by memory bandwidth rather than compute.

A cache hit removes prefill work for the cached tokens. It doesn't make decode faster (decode still reads the whole cache), but for an agent whose prompt is 20 times longer than its answer, prefill is where the input bill and most of the time to first token come from. I measured both phases on a tiny model on CPU in the hands-on section: prefilling 2,048 tokens took 6.3 seconds, while reusing a cached 1,920-token prefix and prefilling only the last 128 tokens took 0.56 seconds, with the same next-token logits to within floating point noise. The numbers are small-model CPU numbers, but the shape is the same everywhere: the work you skip is proportional to the tokens you don't recompute.

### From a KV cache to a prefix cache

A single request's KV cache lives only as long as the request. Sharing it across requests needs two things: a memory layout that lets requests share parts of a cache, and a way to find out that a new request starts with a prefix already in memory.

The layout came from [PagedAttention](https://arxiv.org/abs/2309.06180), the paper behind vLLM. Instead of one contiguous buffer per request, the KV cache is split into fixed-size blocks (16 tokens is a typical size), and each request holds a block table that maps its logical token positions to physical blocks, the way an operating system maps virtual pages to physical frames. Two requests can point at the same physical block, with a reference count to know when it's free.

Finding the shared prefix is the job of [automatic prefix caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html). vLLM hashes every full block from the block's tokens together with the hash of the block before it, plus extra keys for anything else that changes the computation (a LoRA adapter id, the hashes of images in the block, a per-tenant cache salt). A new request is cut into blocks, the hashes are computed in order, and the engine walks them against its table until the first miss. Everything before the miss is reused; everything after is computed and inserted. Only full blocks are cached, and blocks nobody references are evicted least recently used first.

<div id="pckv-engine-path-slot"></div>

SGLang's [RadixAttention](https://arxiv.org/abs/2312.07104) reaches the same result with a different data structure: a radix tree over token sequences, where each edge holds a run of tokens and their KV tensors, with LRU eviction and a scheduler that prefers requests sharing long cached prefixes. The details differ, the contract is identical. A cached entry is keyed by the full sequence of tokens that led to it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why chain the hashes? Hash each block on its own and the same paragraph gets reused wherever it shows up. Way more hits.</span>
    </div>
  </div>
</div>

More hits, all of them wrong. A token's keys and values are not a function of the token alone. From the second layer on, a token's hidden state is a mixture of everything before it, and its position is baked in through the positional encoding. The same paragraph after a different system prompt produces different keys and values in almost every layer, so reusing them would silently change the model's output. The chained hash encodes exactly that dependency: a block's hash identifies the block and its entire prefix, which is why a single changed byte early in the prompt invalidates every block after it.

<div id="pckv-block-chain-slot"></div>

### What the providers expose

Providers run this machinery at scale and sell you the outcome, with pricing and rules that shape how you should build prompts. The numbers below are from the official docs at the time of writing; they change, so check the linked pages before you build a spreadsheet on them.

**Anthropic** ([prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) makes caching explicit and priced both ways. You mark up to four breakpoints with `cache_control: {"type": "ephemeral"}` on content blocks, or put a single top-level `cache_control` on the request and let the API place the breakpoint on the last cacheable block and move it forward as the conversation grows. The prompt renders in a fixed order, `tools`, then `system`, then `messages`, so a breakpoint on the last system block caches the tools and the system prompt together. Pricing is relative to the model's base input price: a write costs 1.25x with the default 5-minute TTL or 2x with the 1-hour TTL (`"ttl": "1h"`), and a read costs 0.1x on most models. The TTL is refreshed every time the entry is read. There is a minimum cacheable length that depends on the model, for example 1,024 tokens on Claude Sonnet 4.5 and 4.6 and 4,096 on Claude Opus 4.5 and 4.6 and Haiku 4.5; below it the request simply isn't cached, with no error. Each breakpoint looks back at most 20 blocks for a previous entry. Caches are isolated per workspace, and an entry becomes readable only once the response that writes it starts streaming.

The response tells you what happened in three fields: `cache_creation_input_tokens` (written this request, billed at the write price), `cache_read_input_tokens` (served from cache) and `input_tokens`, which is only the part after the last breakpoint. The prompt size is the sum of the three. A `cache_creation` object breaks writes down by TTL (`ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`).

**OpenAI** ([prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching), [Prompt Caching 201](https://developers.openai.com/cookbook/examples/prompt_caching_201)) makes it automatic. Any prompt of 1,024 tokens or more is eligible, and hits are counted in increments of 128 tokens. Requests are routed to machines by a hash of roughly the first 256 tokens, optionally combined with a `prompt_cache_key` you send to keep related traffic together; a single prefix and key combination is served well up to around 15 requests per minute, after which traffic spills onto more machines that don't have the cache yet. In-memory retention lasts roughly 5 to 10 minutes of inactivity, up to an hour, and supported models accept `prompt_cache_retention: "24h"` for extended retention. There is no write surcharge; cached tokens are billed at a discount that depends on the model (50% on GPT-4o, 75% on GPT-4.1 and 90% on the GPT-5 family, per the cookbook). The count arrives in `usage.prompt_tokens_details.cached_tokens` on Chat Completions and `usage.input_tokens_details.cached_tokens` on the Responses API, and in both cases it is included in the prompt token total rather than added to it.

Two very different interfaces, one underlying rule: the cache holds prefixes, and the prefix is whatever your code put first.

### Designing the prompt for the cache

Everything follows from ordering the prompt by how often each part changes, most stable first.

<div id="pckv-prompt-layout-slot"></div>

**Tools first, deterministic.** Tool definitions render before everything else on Anthropic and are part of the routed prefix on OpenAI, so they must be identical byte for byte. Sort them by name, serialize with sorted keys and fixed separators, and build them from a static registry rather than from whatever order a plugin loader or a `set` produces. Don't add or remove tools per turn to implement modes; a mode is better expressed as data in the conversation. This is the same discipline that makes tool calling safe in the first place, and I wrote about it in [Deterministic Tool Calling](/en-us/blog/deterministic-tool-calling/): a registry that is static, validated and versioned is also a registry that caches.

**System prompt frozen.** No clock, no request id, no user name, no conditional sections toggled by feature flags. Each variant of the system prompt is a separate cache entry, and a per-request value in it means every request is a new entry that nothing ever reads.

**History append-only.** The previous request's prompt should reappear, unchanged, as the prefix of the next one. That means you never edit, reorder or re-render earlier turns, and you keep the retrieved context of a past turn exactly where it was, instead of swapping it out of a shared "context" slot every turn. In a RAG agent (the kind I described in [Agentic Mesh Architecture](/en-us/blog/agentic-mesh-architecture-rag-agents/)) that is the most common mistake: retrieved chunks placed right after the system prompt, replaced every turn, invalidating the whole conversation behind them.

**Volatile content last.** The retrieved chunks for this turn, the current time and the question go in the newest user message, after the last breakpoint. They are paid at the full input price once, and from the next turn on they are part of the cached history.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But the model needs to know what day it is. The current time has to go in the system prompt.</span>
    </div>
  </div>
</div>

It needs to know, it doesn't need to know at position zero. Put the time in the newest user turn, where it is part of the volatile tail anyway, and the model reads it just as well. If product constraints force it into the system prompt, lower its resolution: a date changes once a day, which costs one cold write per prefix per day instead of one per request. A timestamp with seconds on the first line is the most expensive line of code in the agent.

## Hands-On Implementation

Four pieces of Python: a KV memory calculator, a measurement of prefill against a cached prefix on a real model, a simulation of a block-hash prefix cache over agent traffic with good and bad layouts, and a small module that reads the cache fields from provider responses. The first three ran on my machine and the outputs below are copied from those runs. The provider calls at the end are illustrative, as I explain there.

### KV cache memory in a few lines

```python title="kv_memory.py"
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelConfig:
    name: str
    layers: int
    kv_heads: int
    head_dim: int
    bytes_per_value: int = 2  # bf16 / fp16


def kv_bytes_per_token(cfg: ModelConfig) -> int:
    # One K and one V vector per KV head, per layer, for every token in the context.
    return 2 * cfg.layers * cfg.kv_heads * cfg.head_dim * cfg.bytes_per_value


def fmt(n: float) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024:
            return f"{n:,.1f} {unit}"
        n /= 1024
    return f"{n:,.1f} TiB"


MODELS = [
    ModelConfig("Llama-2-7B (MHA)", layers=32, kv_heads=32, head_dim=128),
    ModelConfig("Llama-3.1-8B (GQA)", layers=32, kv_heads=8, head_dim=128),
    ModelConfig("Qwen2.5-7B (GQA)", layers=28, kv_heads=4, head_dim=128),
    ModelConfig("Llama-3.1-70B (GQA)", layers=80, kv_heads=8, head_dim=128),
    ModelConfig("Llama-3.1-70B, FP8 KV", layers=80, kv_heads=8, head_dim=128, bytes_per_value=1),
]

if __name__ == "__main__":
    free_for_kv = 40 * 1024**3  # an example budget: GPU memory left for KV after weights
    print(f"{'model':<24}{'per token':>12}{'8K prompt':>12}{'128K ctx':>12}{'8K seqs in 40 GiB':>20}")
    for cfg in MODELS:
        per_token = kv_bytes_per_token(cfg)
        print(
            f"{cfg.name:<24}{fmt(per_token):>12}{fmt(per_token * 8192):>12}"
            f"{fmt(per_token * 131072):>12}{free_for_kv // (per_token * 8192):>20,}"
        )
```

```text title="terminal"
$ python kv_memory.py
model                      per token   8K prompt    128K ctx   8K seqs in 40 GiB
Llama-2-7B (MHA)           512.0 KiB     4.0 GiB    64.0 GiB                  10
Llama-3.1-8B (GQA)         128.0 KiB     1.0 GiB    16.0 GiB                  40
Qwen2.5-7B (GQA)            56.0 KiB   448.0 MiB     7.0 GiB                  91
Llama-3.1-70B (GQA)        320.0 KiB     2.5 GiB    40.0 GiB                  16
Llama-3.1-70B, FP8 KV      160.0 KiB     1.2 GiB    20.0 GiB                  32
```

The configurations are the published ones (layers, KV heads and head size from each model's config). Look at the last column: with 40 GiB set aside for KV, a 70B model holds 16 concurrent 8K-token prompts in bf16. Every cached prefix a provider keeps around competes for that space with requests that are running right now, which is why caches have short TTLs and LRU eviction, and why a prefix that nobody reads for a few minutes disappears.

### Measuring prefill against a cached prefix

To see the prefill cost for real, I ran [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) with Hugging Face Transformers on CPU (4 threads, float32). The script builds a 2,048-token prompt out of a 1,920-token "stable" prefix and a 128-token "volatile" suffix, then compares a cold prefill of everything against reusing the prefix's KV cache and prefilling only the suffix. It also checks that both paths produce the same logits and times a few decode steps.

```python title="prefill_vs_cached.py"
import copy
import statistics
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from kv_memory import ModelConfig, fmt, kv_bytes_per_token

MODEL_ID = "HuggingFaceTB/SmolLM2-135M"
torch.set_num_threads(4)
torch.manual_seed(0)

tok = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float32).eval()
cfg = model.config
head_dim = cfg.hidden_size // cfg.num_attention_heads
spec = ModelConfig(MODEL_ID, cfg.num_hidden_layers, cfg.num_key_value_heads, head_dim, bytes_per_value=4)

# A long, stable prefix (think: tool definitions + system prompt) and a short, volatile suffix.
prefix_ids = torch.randint(1000, cfg.vocab_size - 1000, (1, 1920))
suffix_ids = torch.randint(1000, cfg.vocab_size - 1000, (1, 128))
full_ids = torch.cat([prefix_ids, suffix_ids], dim=1)


def timed(fn, repeats=5):
    samples = []
    for i in range(repeats):
        start = time.perf_counter()
        out = fn(i)
        samples.append(time.perf_counter() - start)
    return out, statistics.median(samples)


with torch.inference_mode():
    # Cold: prefill all 2,048 tokens.
    cold_out, cold_s = timed(lambda i: model(full_ids, use_cache=True))
    stored = sum(layer.keys.nbytes + layer.values.nbytes for layer in cold_out.past_key_values.layers)

    # Build the prefix cache once, then reuse a copy of it for every "request".
    prefix_out = model(prefix_ids, use_cache=True)
    copies = [copy.deepcopy(prefix_out.past_key_values) for _ in range(5)]  # the engine keeps blocks; we copy
    warm_out, warm_s = timed(lambda i: model(suffix_ids, past_key_values=copies[i], use_cache=True))

    # Same next-token logits either way: the cache is an exact shortcut, not an approximation.
    max_diff = (cold_out.logits[:, -1] - warm_out.logits[:, -1]).abs().max().item()

    # Decode: one token at a time on top of the full context.
    cache = cold_out.past_key_values
    next_id = cold_out.logits[:, -1].argmax(-1, keepdim=True)
    step_times = []
    for _ in range(32):
        start = time.perf_counter()
        step = model(next_id, past_key_values=cache, use_cache=True)
        step_times.append(time.perf_counter() - start)
        cache = step.past_key_values
        next_id = step.logits[:, -1].argmax(-1, keepdim=True)


print(f"model: {MODEL_ID}  layers={spec.layers} kv_heads={spec.kv_heads} head_dim={spec.head_dim}")
print(f"formula, per token:          {fmt(kv_bytes_per_token(spec))}")
print(f"measured cache for 2048 tok: {fmt(stored)}  (formula: {fmt(kv_bytes_per_token(spec) * 2048)})")
print(f"cold prefill, 2048 tokens:   {cold_s * 1000:7.1f} ms")
print(f"cached prefix + 128 tokens:  {warm_s * 1000:7.1f} ms  ({cold_s / warm_s:.1f}x faster)")
print(f"max |logit diff| cold/warm:  {max_diff:.2e}")
print(f"decode, per token:           {statistics.median(step_times) * 1000:7.1f} ms")
print(f"prefill, per token:          {cold_s / 2048 * 1000:7.2f} ms")
```

```text title="terminal"
$ python prefill_vs_cached.py
model: HuggingFaceTB/SmolLM2-135M  layers=30 kv_heads=3 head_dim=64
formula, per token:          45.0 KiB
measured cache for 2048 tok: 90.0 MiB  (formula: 90.0 MiB)
cold prefill, 2048 tokens:    6253.7 ms
cached prefix + 128 tokens:    557.0 ms  (11.2x faster)
max |logit diff| cold/warm:  1.91e-05
decode, per token:              58.2 ms
prefill, per token:             3.05 ms
```

Three things to take from it. The formula matches the tensors the library actually allocated, to the byte. Reusing the prefix cut the time to first token by 11x, and the ideal here is about 16x (2,048 tokens against 128), the rest being attention over the long cached context and noise on a shared machine, so read the ratio as "an order of magnitude", not as a benchmark. And the logits differ by 2e-5, float32 rounding: a cache hit gives you the same model output, not an approximation of it.

The decode line shows the other asymmetry: 58 ms for one token against 3 ms per token during prefill. On a CPU with a tiny model, part of that is per-step overhead rather than memory bandwidth, so don't extrapolate the ratio to a GPU. The direction holds everywhere: prefill processes tokens in bulk, decode pays a full pass over the weights and the cache for every single token.

### Simulating a prefix cache over agent traffic

Now the part that matters for your prompt code. The simulator below implements the engine side (chained SHA-256 block hashes, 16-token blocks, only full blocks cached, LRU eviction) and runs realistic agent traffic through it: 60 support sessions of 8 turns, interleaved in random order, with 12 tool definitions, a 1,400-word system prompt, three retrieved chunks per turn, a question and an answer. The tokenizer splits words and punctuation, which overcounts JSON a little compared with real BPE but is fine for measuring shared prefixes.

It renders the same traffic with four layouts. The bad one has the clock on the first line of the system prompt, the retrieved context in a slot right after the system prompt, and tool JSON whose key order drifts (as it does when a registry is assembled from dictionaries merged at runtime). Each fix removes one mistake.

```python title="prefix_cache_sim.py"
import hashlib
import json
import random
import re
from collections import OrderedDict
from dataclasses import dataclass

BLOCK = 16  # tokens per KV block, a typical engine block size


class Tokenizer:
    """Words and punctuation as tokens: cruder than BPE, close enough to count prefixes."""

    def __init__(self) -> None:
        self.vocab: dict[str, int] = {}

    def encode(self, text: str) -> list[int]:
        return [self.vocab.setdefault(piece, len(self.vocab)) for piece in re.findall(r"\w+|[^\w\s]", text)]


class PrefixCache:
    """Hash-chained full blocks with LRU eviction, the way automatic prefix caching works."""

    def __init__(self, capacity_blocks: int) -> None:
        self.capacity = capacity_blocks
        self.blocks: OrderedDict[bytes, None] = OrderedDict()

    def lookup_and_insert(self, tokens: list[int]) -> int:
        parent = b""
        cached = 0
        missed = False
        for start in range(0, len(tokens) - BLOCK + 1, BLOCK):
            # A block's identity is its tokens AND everything before it, via the parent hash.
            block_hash = hashlib.sha256(parent + repr(tokens[start:start + BLOCK]).encode()).digest()
            if not missed and block_hash in self.blocks:
                self.blocks.move_to_end(block_hash)
                cached += BLOCK
            else:
                missed = True  # after the first miss, nothing further down the chain can hit
                self.blocks[block_hash] = None
                if len(self.blocks) > self.capacity:
                    self.blocks.popitem(last=False)
            parent = block_hash
        return cached


def make_tools(rng: random.Random) -> list[dict]:
    names = ["search_orders", "get_order", "refund_order", "search_kb", "get_customer", "update_address",
             "create_ticket", "escalate", "get_invoice", "send_email", "check_stock", "schedule_callback"]
    tools = []
    for name in names:
        props = {f"{name}_arg{i}": {"type": rng.choice(["string", "integer", "boolean"]),
                                    "description": " ".join(rng.choices(WORDS, k=12))} for i in range(6)}
        tools.append({"name": name, "description": " ".join(rng.choices(WORDS, k=40)),
                      "input_schema": {"type": "object", "properties": props, "required": list(props)[:2]}})
    return tools


WORDS = ("order customer refund policy invoice shipping address account payment status carrier warehouse "
         "return window days escalate agent verify identity email phone ticket priority product stock "
         "discount coupon region currency tax receipt delivery tracking damaged missing late cancel").split()


def shuffled_keys(value, rng: random.Random):
    """What a dict built from a set, or merged from plugins, looks like: same content, different order."""
    if isinstance(value, dict):
        items = list(value.items())
        rng.shuffle(items)
        return {k: shuffled_keys(v, rng) for k, v in items}
    if isinstance(value, list):
        return [shuffled_keys(v, rng) for v in value]
    return value


@dataclass
class Layout:
    name: str
    timestamp_on_top: bool
    context_in_system: bool
    unstable_tools: bool


def render(layout: Layout, tools, system: str, history: list[str], context: str, question: str,
           now: str, rng: random.Random) -> tuple[str, str]:
    """Returns the prompt and the new user turn, as it should be kept in history."""
    if layout.unstable_tools:
        tool_block = json.dumps(shuffled_keys(tools, rng))
    else:
        tool_block = json.dumps(sorted(tools, key=lambda t: t["name"]), sort_keys=True, separators=(",", ":"))
    head = f"Current time: {now}\n" if layout.timestamp_on_top else ""
    tail = "" if layout.timestamp_on_top else f"\n(current time: {now})"
    if layout.context_in_system:
        turn = "User: " + question + tail
        return "\n".join([tool_block, head + system, "Context:\n" + context, *history, turn]), turn
    turn = "Context:\n" + context + "\nUser: " + question + tail
    return "\n".join([tool_block, head + system, *history, turn]), turn


def simulate(layout: Layout, sessions=60, turns=8, seed=7) -> tuple[int, int]:
    rng = random.Random(seed)
    tokenizer = Tokenizer()
    tools = make_tools(random.Random(1))
    system = " ".join(random.Random(2).choices(WORDS, k=1400))
    corpus = [" ".join(random.Random(100 + i).choices(WORDS, k=150)) for i in range(300)]
    cache = PrefixCache(capacity_blocks=60_000)

    state = {s: {"turn": 0, "history": []} for s in range(sessions)}
    total = cached = 0
    clock = 0
    while state:
        sid = rng.choice(list(state))
        session = state[sid]
        clock += rng.randint(1, 20)
        now = f"2026-07-08T{9 + clock // 3600:02d}:{clock // 60 % 60:02d}:{clock % 60:02d}Z"
        question = " ".join(rng.choices(WORDS, k=30))
        context = "\n".join(rng.sample(corpus, 3))
        prompt, turn = render(layout, tools, system, session["history"], context, question, now, rng)
        tokens = tokenizer.encode(prompt)
        total += len(tokens)
        cached += cache.lookup_and_insert(tokens)

        answer = " ".join(rng.choices(WORDS, k=120))
        # Append-only history: the turn is kept exactly as it was sent, then the answer after it.
        session["history"].append(f"{turn}\nAssistant: {answer}")
        session["turn"] += 1
        if session["turn"] == turns:
            del state[sid]
    return total, cached


LAYOUTS = [
    Layout("bad: clock on top, context in system, tools drift", True, True, True),
    Layout("fix 1: deterministic tool JSON", True, True, False),
    Layout("fix 2: + clock moved to the end", False, True, False),
    Layout("good: + context appended, never rewritten", False, False, False),
]

if __name__ == "__main__":
    print(f"{'layout':<52}{'prompt tok':>11}{'cached':>8}{'billed':>10}")
    for layout in LAYOUTS:
        total, cached = simulate(layout)
        # Anthropic-style multipliers: misses are written at 1.25x, hits read at 0.1x (uncached is 1.0x).
        billed = (total - cached) * 1.25 + cached * 0.10
        print(f"{layout.name:<52}{total:>11,}{cached / total:>8.1%}{billed / 1e6:>9.2f}M")
```

```text title="terminal"
$ python prefix_cache_sim.py
layout                                               prompt tok  cached    billed
bad: clock on top, context in system, tools drift     2,833,920    1.0%     3.51M
fix 1: deterministic tool JSON                        2,833,920   58.7%     1.63M
fix 2: + clock moved to the end                       2,858,400   82.7%     0.85M
good: + context appended, never rewritten             3,617,760   91.8%     0.70M
```

"Billed" is in uncached-token equivalents, using the Anthropic multipliers and treating every miss as a cache write, which is roughly what automatic caching does. Read the rows as a story.

The bad layout caches 1% and bills 3.51M token equivalents for 2.83M tokens of prompt. That's worse than not caching at all: with caching off, those requests would have cost 2.83M. You pay the write premium on every token and read almost nothing back. This is the invoice from the opening paragraph.

Deterministic tool JSON alone takes it to 58.7%, because the tool block (about 3,500 tokens here) is now a stable prefix shared by every request of every session. The clock at the top of the system prompt still breaks everything behind it. Moving the clock to the end of the user turn lets the system prompt join the shared prefix: 82.7%. What's left is the retrieved context sitting right after the system prompt, replaced on every turn, which means the conversation history behind it is never reused.

The good layout keeps each turn's context in that turn, forever. It sends more tokens in total (3.62M, since old context stays in the history instead of being swapped), and it is still the cheapest by far: 91.8% cached, 0.70M billed, five times less than the bad layout, with no change to what the model sees in each request other than where things sit.

### Reading the cache fields from responses

Hit rate has to come from the provider, because only the provider knows what it had in cache. The two APIs report it differently, and the difference matters: Anthropic's `input_tokens` excludes cached tokens, while OpenAI's prompt token count includes them. A small normalizer avoids getting that wrong in dashboards.

```python title="cache_usage.py"
from dataclasses import dataclass


@dataclass(frozen=True)
class CacheUsage:
    uncached: int  # billed at the full input price
    written: int   # billed at the cache-write price (Anthropic only; 0 elsewhere)
    read: int      # billed at the cache-read price

    @property
    def prompt_tokens(self) -> int:
        return self.uncached + self.written + self.read

    @property
    def hit_rate(self) -> float:
        return self.read / self.prompt_tokens if self.prompt_tokens else 0.0


def from_anthropic(usage: dict) -> CacheUsage:
    # input_tokens is only what came after the last breakpoint, not the prompt size.
    return CacheUsage(
        uncached=usage["input_tokens"],
        written=usage.get("cache_creation_input_tokens") or 0,
        read=usage.get("cache_read_input_tokens") or 0,
    )


def from_openai_chat(usage: dict) -> CacheUsage:
    # prompt_tokens already includes the cached ones.
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)
    return CacheUsage(uncached=usage["prompt_tokens"] - cached, written=0, read=cached)


def from_openai_responses(usage: dict) -> CacheUsage:
    cached = (usage.get("input_tokens_details") or {}).get("cached_tokens", 0)
    return CacheUsage(uncached=usage["input_tokens"] - cached, written=0, read=cached)


def input_cost(u: CacheUsage, base_per_mtok: float, write_mult: float, read_mult: float) -> float:
    return (u.uncached + u.written * write_mult + u.read * read_mult) * base_per_mtok / 1e6


if __name__ == "__main__":
    # Hand-written payloads in the documented shapes, not captured from a live call.
    anthropic_turn = {"input_tokens": 212, "cache_creation_input_tokens": 1_480, "cache_read_input_tokens": 48_300,
                      "output_tokens": 390, "cache_creation": {"ephemeral_5m_input_tokens": 1_480,
                                                               "ephemeral_1h_input_tokens": 0}}
    openai_chat_turn = {"prompt_tokens": 50_120, "completion_tokens": 390,
                        "prompt_tokens_details": {"cached_tokens": 49_152}}

    a = from_anthropic(anthropic_turn)
    o = from_openai_chat(openai_chat_turn)
    print(f"anthropic: prompt={a.prompt_tokens:,} read={a.read:,} written={a.written:,} hit={a.hit_rate:.1%}")
    print(f"  cost at $3/MTok, 1.25x write, 0.1x read: ${input_cost(a, 3.0, 1.25, 0.10):.4f}"
          f"  (uncached: ${a.prompt_tokens * 3.0 / 1e6:.4f})")
    print(f"openai:    prompt={o.prompt_tokens:,} read={o.read:,} hit={o.hit_rate:.1%}")
    print(f"  cost at $1.25/MTok, 0.1x read:          ${input_cost(o, 1.25, 0.0, 0.10):.4f}"
          f"  (uncached: ${o.prompt_tokens * 1.25 / 1e6:.4f})")
```

```text title="terminal"
$ python cache_usage.py
anthropic: prompt=49,992 read=48,300 written=1,480 hit=96.6%
  cost at $3/MTok, 1.25x write, 0.1x read: $0.0207  (uncached: $0.1500)
openai:    prompt=50,120 read=49,152 hit=98.1%
  cost at $1.25/MTok, 0.1x read:          $0.0074  (uncached: $0.0626)
```

The payloads in `__main__` are hand-written to match the documented field names, not captured from live calls, and the prices are example parameters, so plug in your model's current price. The shape they show is what a healthy agent turn looks like: a large read (the whole prior conversation), a small write (the last answer plus the new turn) and a tiny uncached tail. Note the OpenAI cached count of 49,152, a multiple of 128, as the docs describe.

### Putting breakpoints on the request

I didn't run the next two snippets: they need API keys and a paid account, and I didn't want to present numbers I didn't measure. They follow the documented request shapes, and they connect the layout above to real calls. On Anthropic, the combination I use for agent loops is an explicit breakpoint on the last system block (the expensive shared part gets a guaranteed read point) plus top-level automatic caching for the growing conversation.

```python title="agent_turn_anthropic.py (illustrative)"
import json

import anthropic

from cache_usage import from_anthropic

client = anthropic.Anthropic()

TOOLS = sorted(json.load(open("tools.json")), key=lambda t: t["name"])  # static registry, fixed order
SYSTEM_PROMPT = open("system_prompt.md").read()                         # frozen: no clock, no user data


def agent_turn(history: list[dict], context: str, question: str, now: str):
    new_turn = {"role": "user", "content": f"Context:\n{context}\n\n{question}\n\n(current time: {now})"}
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        tools=TOOLS,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        cache_control={"type": "ephemeral"},  # automatic breakpoint that follows the history
        messages=[*history, new_turn],
    )
    usage = from_anthropic(response.usage.model_dump())
    history += [new_turn, {"role": "assistant", "content": response.content}]  # append-only
    return response, usage
```

On OpenAI there are no markers; the levers are the same ordering and a `prompt_cache_key` that keeps a tenant's or an agent version's traffic on the machines that have its prefix.

```python title="agent_turn_openai.py (illustrative)"
from openai import OpenAI

from cache_usage import from_openai_chat

client = OpenAI()


def agent_turn(messages: list[dict], tools: list[dict], tenant: str):
    response = client.chat.completions.create(
        model="gpt-5",
        messages=messages,             # developer prompt first, history append-only, new turn last
        tools=tools,                   # same list, same order, every request
        prompt_cache_key=f"support-agent:v12:{tenant}",
    )
    return response, from_openai_chat(response.usage.model_dump())
```

## Production Reality Check

### Hit rate is a metric, so alert on it

The costliest caching failure is a regression, not a bad first implementation. It works when someone writes it, then a later change to prompt assembly (a flag in the system prompt, a history-trimming feature, a new tool inserted alphabetically in the middle) sends the hit rate to zero, and requests keep succeeding. Log `uncached`, `written` and `read` per request with the route and the prompt version, chart the read ratio, and alert when it drops after a deploy. I also keep one integration test per agent that sends the same request twice and asserts that the second one reports cached tokens; it costs cents and catches most regressions before they reach the invoice. When the ratio drops, diff the rendered request bodies of two consecutive calls: the first byte that differs inside the shared part is your invalidator.

### TTLs, traffic shape and concurrency

A 5-minute TTL refreshed on every read means a busy agent keeps its prefix warm indefinitely, while a tenant who sends one request every ten minutes pays a cold write each time. Anthropic's 1-hour TTL helps in that gap, but it doubles the write price, so the break-even moves: with the 5-minute TTL two requests already beat no caching (1.25 + 0.1 = 1.35 against 2.0), with the 1-hour TTL you need three (2.0 + 0.1 + 0.1 = 2.2 against 3.0). Pick it per route based on the real gap between requests that share a prefix.

Concurrency has its own trap: an entry becomes readable only once the response that writes it starts streaming, so a fan-out of 20 parallel sub-agents over the same fresh context writes 20 times and reads nothing. Send one request, wait for its first streamed token, then fan out. On OpenAI, the equivalent is the routing limit: very hot prefixes spill past the machines that hold the cache, and a `prompt_cache_key` that is too coarse (one key for all traffic) concentrates load, while one that is too fine (a key per request) spreads it so thin nothing is shared.

### Invisible thresholds

Prompts under the model's minimum cacheable length are not cached, silently. A 3,000-token prompt caches on a model with a 1,024-token minimum and doesn't on one with a 4,096-token minimum, so a model migration can change your hit rate without any code change. On Anthropic, each breakpoint only looks back 20 blocks for a previous entry, so a single agent turn that appends a long run of text and tool blocks can push the previous entry out of reach; an intermediate breakpoint in very long turns fixes it. And switching models mid-conversation, or changing the tool list, starts from zero: caches are scoped to the model and the tool definitions sit at the very front of the prefix.

### Isolation is a security property

A shared cache is a timing side channel: if a hit is measurably faster, a request can learn whether someone else recently sent the same prefix. [Gu et al.](https://arxiv.org/abs/2502.07776) audited real APIs and found global cache sharing across users at seven providers, including OpenAI, at the time of their study. Today's provider docs scope caches to an organization (and on Anthropic to a workspace), but if you run your own engine, that scoping is your job: in vLLM, a per-tenant `cache_salt` makes the block hashes differ across trust boundaries. Don't share cached prefixes between tenants whose prompts contain anything confidential, and remember the cache holds whatever the prompt held.

### Self-hosted: routing and memory are the hit rate

On your own vLLM or SGLang fleet, the cache lives in each replica's GPU memory. A round-robin load balancer spreads one conversation's turns across replicas, and each replica pays a cold prefill. Route by session or by a hash of the prefix so the same conversation lands on the same replica, and watch the prefix cache hit metrics each engine exports. Memory is the other lever: every GiB spent on weights or on a larger batch is a GiB not holding prefixes, and under pressure LRU evicts exactly the long, idle conversations you hoped to reuse.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>To save tokens I'll drop the oldest message every turn. A sliding window keeps the prompt small.</span>
    </div>
  </div>
</div>

A sliding window changes the beginning of the conversation on every turn, which is the worst thing you can do to a prefix cache. Everything after the system prompt misses on every request, and with a write premium you end up paying more than full price for a smaller prompt. Let the history grow while it's cached at a tenth of the price, and when it truly gets too long, compact it rarely and in big steps (summarize the first half once, then append again). One cold write every few dozen turns is cheap; one every turn is the bad layout from the simulation with extra steps.

Prompt caching looks like a billing feature, and it is really a property of your code: the engine reuses keys and values for any prefix it has seen, the provider sells you that reuse at a tenth of the price, and your prompt assembly decides whether there is a prefix to reuse. Put tools and the system prompt first and keep them frozen, treat history as append-only, push everything volatile to the end, and read the usage fields on every response. For the support agent in the opening, the fix is two moved lines, a sorted tool registry and one test, and the simulation above shows what that is worth.
