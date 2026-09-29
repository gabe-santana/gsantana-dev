---
title: "LoRA from First Principles: When Fine-Tuning Beats RAG and Prompting"
description: "Decide with evals when fine-tuning is worth it, then build LoRA from scratch in PyTorch and train a 135M model to triage support tickets."
date: 2026-08-25
tags: [LLM, Fine-Tuning, PyTorch, Python]
tldr:
  - "Fine-tuning teaches behavior (a format, a style, a narrow policy), not fresh facts: facts go in context through RAG, and prompting is the baseline every fine-tune has to beat on a held-out eval."
  - "LoRA freezes W and learns a low-rank update scaled by alpha / r, with B starting at zero so training starts from the exact base model; target every linear layer and the adapter stays a few MB."
  - "On a 135M model, 4.9M trainable parameters took held-out exact match from 6.5% (3-shot) to 88.0%; the same run also showed the classic failures: leaky evals, template mismatch and forgetting."
---

A product team wants support tickets triaged automatically: a category, a priority and the order id, as JSON a routing service can consume. The first attempt is a prompt on a big hosted model, and it works, at a cost per ticket that finance notices once the volume shows up. The second attempt is a small model the team can run itself, with the same prompt. It returns prose, then malformed JSON, then valid JSON with the wrong priority half the time. Someone says "let's fine-tune it", someone else says "we should use RAG", and the meeting ends without anyone saying what either of those would fix.

This post is about making that call with evidence, and then about the tool you'll most likely use when the answer is "fine-tune": LoRA. We'll derive it, write the layer from scratch in PyTorch with a unit test proving the merge math, and train SmolLM2-135M-Instruct on exactly that triage task on a laptop GPU, with real before and after numbers. The Naive Junior is along for the ride, as usual.

## The Problem & Context

There are three levers for changing what a model does, and they fix different problems.

**Prompting** changes the input. Instructions, a schema, a few examples. It costs nothing to try, it's reversible in seconds, and with a capable model it goes a surprisingly long way. It's the baseline, and every other option has to beat it on your eval set to earn its complexity.

**Retrieval (RAG)** changes the context. At query time you fetch the documents, prices, policies or tickets the answer depends on and put them in front of the model. This is how a model "knows" things it wasn't trained on, and how it knows things that changed yesterday. The hard parts are retrieval quality and chunking, which I covered in [evaluating retrieval with a real test set](/en-us/blog/rag-evaluation-retrieval-test-set/) and [chunking enterprise documents](/en-us/blog/chunking-enterprise-documents/).

**Fine-tuning** changes the weights. You show the model many input and output pairs and nudge its parameters until it produces those outputs. What it learns well is *behavior*: an output format, a tone, a labeling policy, a tool-calling pattern, a narrow task done the same way every time. What it learns badly is new facts.

That last sentence is not a matter of taste. [Ovadia et al. (2023)](https://arxiv.org/abs/2312.05934) compared knowledge injection through unsupervised fine-tuning against RAG and found that RAG consistently won, both for knowledge the model had seen in pretraining and for entirely new knowledge. [Gekhman et al. (2024)](https://arxiv.org/abs/2405.05904) went further: fine-tuning examples that introduce new knowledge are learned significantly slower than examples consistent with what the model already knows, and as the model eventually fits them, its tendency to hallucinate rises. Their summary is the one I keep in my head: models mostly acquire factual knowledge in pretraining, and fine-tuning teaches them to use it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy: we fine-tune the model on our product docs, and then it knows our product. No retrieval, no vector database.</span>
    </div>
  </div>
</div>

It will learn to *sound* like your docs. It won't reliably recall the refund window for the enterprise plan, it can't tell you what changed in last week's release, and it can't cite where an answer came from. When the docs change, you retrain. Facts belong in the context, where they can be updated, filtered by permission and cited. If you also want answers in your house format, fine-tune for the format and still retrieve the facts: the two combine well.

So the decision is a question about what's missing, and the only honest way to answer it is to measure.

<div id="lora-decision-flow-slot"></div>

In practice the flow looks like this. Build the eval set first: a few hundred real inputs with the right outputs, split so that nothing in it resembles your training data too closely (more on that below, because it's where most fine-tuning results quietly lie). Run the prompt baseline on it, including few-shot. If the failures are "didn't know X", fix retrieval. If the failures are "knew enough, but didn't follow the format or the policy", and more prompt work has stopped moving the number, fine-tuning is on the table. It's also on the table when a big model with a long prompt already passes the eval, and the goal is to get the same behavior from a smaller, cheaper, faster model you can run yourself. That's exactly the triage story above.

## Deep Dive / Architectural Design

### Why full fine-tuning is expensive

Full fine-tuning updates every parameter. With AdamW in mixed precision, a common accounting is about 16 bytes per parameter before activations: the 16-bit weights and gradients, a 32-bit master copy of the weights and two 32-bit optimizer moments. For a 7B model that's over 100 GB, and every fine-tuned variant is a full copy of the model on disk. If you want one variant per customer or per task, you store and serve N full models.

### The low-rank idea

[Hu et al. (2021)](https://arxiv.org/abs/2106.09685) started from an observation: the change a fine-tune makes to a pretrained weight matrix has low "intrinsic rank". You don't need a full `d x k` matrix of free parameters to express it. So LoRA freezes the pretrained weight `W` and learns the update as a product of two thin matrices:

- `A` with shape `r x k`, initialized randomly.
- `B` with shape `d x r`, initialized to zero.
- `r` is the rank, much smaller than `d` and `k` (8, 16, 64).

The layer's forward pass becomes `h = W x + (alpha / r) * B A x`. The frozen path does what it always did. The trainable path is a detour through a bottleneck of width `r`, scaled by `alpha / r`, and added back.

<div id="lora-forward-pass-slot"></div>

The parameter savings follow directly from the shapes. A full update of a `d x k` matrix has `d * k` values; the LoRA update has `r * (d + k)`. For the `q_proj` of the model we'll train (576 by 576), that's 331,776 values against 18,432 at rank 16, about 5.6%. For a 4096 by 4096 projection in a 7B model, it's 16.8 million against 131,072, under 1%. The paper's headline, on GPT-3 175B adapting only the query and value projections at rank 4, was a 10,000 times reduction in trainable parameters, 3 times less GPU memory, and checkpoints that shrank from 350 GB to 35 MB.

Memory drops because the frozen weights need no gradients and no optimizer state. You still hold the base weights and the activations, but Adam's moments now exist only for the adapter.

### Why B starts at zero

At step 0, `B A` is a zero matrix, so the wrapped model is *exactly* the pretrained model. Training starts from the behavior you measured in your baseline, not from a randomly perturbed version of it. It also matters which of the two is zero. If both were zero, both gradients would be zero and nothing would ever train: the gradient of `A` is proportional to `B`, and the gradient of `B` is proportional to `A x`. With `A` random and `B` zero, the first step moves `B`, and from the second step on both move. The unit test below checks exactly this.

The paper initializes `A` from a Gaussian; Hugging Face's PEFT library defaults to Kaiming-uniform for `A` and zeros for `B`. Either works; the zero on `B` is the part that matters.

### Rank and alpha

The `alpha / r` factor exists so you don't have to retune the learning rate every time you change `r`. The paper sets `alpha` to the first `r` tried and leaves it there. The common practice today is `alpha = 2r` (16 and 32 is the setting I use below). One refinement worth knowing: [rsLoRA (Kalajdzievski, 2023)](https://arxiv.org/abs/2312.03732) argues that `alpha / r` shrinks the update too much at high ranks and proposes `alpha / sqrt(r)`, which keeps learning stable as rank grows. PEFT exposes it as `use_rslora=True`.

On rank itself, the original paper found that very low ranks (even 1 or 2 for the query and value projections of GPT-3) were competitive. That result was for adapting attention only, on tasks that need a small change. For a narrow behavior like our triage format, 8 to 16 is plenty. When the target is broad (a new language, a coding domain with lots of data), rank starts to matter: [Biderman et al. (2024)](https://arxiv.org/abs/2405.09673) found that full fine-tuning on code and math learns perturbations with 10 to 100 times the rank of typical LoRA configurations, and that LoRA underperformed full fine-tuning there. The same paper found the upside: LoRA forgets less of what the base model could do outside the target domain.

### Which modules to target

The original paper adapted only `W_q` and `W_v` "for simplicity", and a lot of tutorials still copy that. Two later results say to target every linear layer instead. The [QLoRA paper](https://arxiv.org/abs/2305.14314) found that applying LoRA to all linear layers of the transformer block was needed to match full 16-bit fine-tuning, and that the number of adapted layers mattered more than the rank. Thinking Machines' [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/) (2025) reached the same conclusion for the MLP layers in particular, where most of the parameters live: attention-only LoRA underperformed even when its rank was raised to match the parameter count. The same write-up found the best LoRA learning rate to be consistently about 10 times the full fine-tuning one.

In a Llama-style block that means seven targets: `q_proj`, `k_proj`, `v_proj`, `o_proj` in attention and `gate_proj`, `up_proj`, `down_proj` in the MLP. PEFT's shorthand for this is `target_modules="all-linear"`. I measured the difference on our task below, and it was not subtle.

### QLoRA: quantize the frozen part

If the base weights are frozen, they don't need to be stored in 16 bits. QLoRA keeps the base model in 4-bit **NF4** (NormalFloat, a data type designed for normally distributed weights), dequantizes each block on the fly to a 16-bit compute type for the matrix multiply, and backpropagates through it into 16-bit LoRA adapters. Two more pieces make it fit: **double quantization** (quantizing the per-block quantization constants themselves) and **paged optimizers**, which use unified memory to push optimizer state to CPU RAM during memory spikes instead of crashing with out-of-memory. The headline was fine-tuning a 65B model on a single 48 GB GPU while matching 16-bit fine-tuning performance on their benchmarks.

The practical takeaway: a 7B base in 4 bits is around 4 GB of weights, which is what makes fine-tuning 7B to 8B models on a single consumer GPU routine. The cost is some speed (dequantization on every forward) and a subtlety at merge time, covered below.

<div class="callout info" data-title="Info">
  <p>This post doesn't run QLoRA: the model is 135M parameters, small enough to keep in 32 bits, and the machine has no bitsandbytes install. Everything about LoRA itself transfers directly, since QLoRA changes how the frozen weights are stored, not how the adapter works.</p>
</div>

## Hands-On Implementation

The setup: SmolLM2-135M-Instruct (a Llama-architecture model with 30 layers, hidden size 576 and 134.5M parameters), PyTorch 2.11, Transformers 5.17, and a shared 8 GB laptop RTX 5050. No PEFT: we write the adapter ourselves, which is short and makes every moving part visible.

### A LoRA layer from scratch

```python title="lora-triage/lora.py"
import math

import torch
from torch import nn


class LoRALinear(nn.Module):
    """A frozen nn.Linear plus a trainable low-rank update: W x + (alpha / r) B A x."""

    def __init__(self, base: nn.Linear, r: int = 16, alpha: int = 32, dropout: float = 0.0):
        super().__init__()
        self.base = base
        for p in self.base.parameters():
            p.requires_grad_(False)
        self.r = r
        self.scale = alpha / r
        device = base.weight.device
        # A starts random and B starts at zero, so B @ A == 0 and the wrapped
        # model is exactly the base model at step 0.
        self.lora_A = nn.Parameter(torch.empty(r, base.in_features, device=device))
        self.lora_B = nn.Parameter(torch.zeros(base.out_features, r, device=device))
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def delta_weight(self) -> torch.Tensor:
        return (self.lora_B @ self.lora_A) * self.scale

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        update = self.dropout(x).to(self.lora_A.dtype) @ self.lora_A.T @ self.lora_B.T
        return self.base(x) + (update * self.scale).to(x.dtype)


def inject_lora(model: nn.Module, targets: set[str], r: int = 16, alpha: int = 32, dropout: float = 0.0) -> nn.Module:
    for p in model.parameters():
        p.requires_grad_(False)
    for parent in list(model.modules()):
        for name, child in list(parent.named_children()):
            if name in targets and isinstance(child, nn.Linear):
                setattr(parent, name, LoRALinear(child, r=r, alpha=alpha, dropout=dropout))
    return model


@torch.no_grad()
def merge_lora(model: nn.Module) -> nn.Module:
    """Fold every adapter into its base weight and put the plain nn.Linear back."""
    for parent in list(model.modules()):
        for name, child in list(parent.named_children()):
            if isinstance(child, LoRALinear):
                child.base.weight += child.delta_weight().to(child.base.weight.dtype)
                setattr(parent, name, child.base)
    return model


def lora_state_dict(model: nn.Module) -> dict[str, torch.Tensor]:
    return {k: v.detach().cpu() for k, v in model.state_dict().items() if "lora_" in k}


def count_parameters(model: nn.Module) -> tuple[int, int]:
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    return trainable, total
```

Two details are worth pointing out. The forward pass computes `x @ A.T @ B.T` rather than building `B @ A`: the thin path costs `r * (d + k)` multiply-adds per token instead of `d * k`. And `merge_lora` is just the forward pass's algebra applied once: `W x + s * B A x = (W + s * B A) x`, so adding `s * B A` into `W` gives a plain `nn.Linear` that computes the same thing.

### Proving the math with tests

```python title="lora-triage/test_lora.py"
import torch
from torch import nn

from lora import LoRALinear, count_parameters, inject_lora, merge_lora


def make_layer(r: int = 4) -> LoRALinear:
    torch.manual_seed(0)
    return LoRALinear(nn.Linear(64, 32), r=r, alpha=2 * r)


def test_starts_as_the_base_layer():
    layer = make_layer()
    x = torch.randn(8, 64)
    assert torch.equal(layer(x), layer.base(x))


def test_merged_weight_matches_adapter_forward():
    layer = make_layer()
    nn.init.normal_(layer.lora_B, std=0.1)  # pretend we trained
    x = torch.randn(8, 64)
    with torch.no_grad():
        adapter_out = layer(x)
        merged = nn.Linear(64, 32)
        merged.load_state_dict(layer.base.state_dict())
        merged.weight += layer.delta_weight()
        merged_out = merged(x)
    assert (adapter_out - merged_out).abs().max() < 1e-5


def test_only_the_adapter_trains():
    layer = make_layer()
    layer(torch.randn(8, 64)).sum().backward()
    assert layer.base.weight.grad is None
    assert layer.lora_A.grad is not None and layer.lora_B.grad is not None
    # B is zero at step 0, so A's first gradient is zero too; B's is not.
    assert layer.lora_A.grad.abs().sum() == 0
    assert layer.lora_B.grad.abs().sum() > 0


def test_parameter_count_is_r_times_in_plus_out():
    model = inject_lora(nn.Sequential(nn.Linear(576, 1536), nn.ReLU(), nn.Linear(1536, 576)), targets={"0", "2"}, r=16)
    trainable, _ = count_parameters(model)
    assert trainable == 16 * (576 + 1536) * 2


def test_merge_lora_restores_plain_linears():
    torch.manual_seed(0)
    model = inject_lora(nn.Sequential(nn.Linear(16, 16), nn.Linear(16, 4)), targets={"0", "1"}, r=2)
    for m in model.modules():
        if isinstance(m, LoRALinear):
            nn.init.normal_(m.lora_B, std=0.1)
    x = torch.randn(3, 16)
    with torch.no_grad():
        before = model(x)
        merge_lora(model)
        after = model(x)
    assert all(type(m) is nn.Linear for m in model)
    assert (before - after).abs().max() < 1e-5
```

```bash title="terminal"
$ python -m pytest -q test_lora.py
.....                                                                    [100%]
5 passed in 1.57s
```

The third test is the zero-init argument from earlier, as an assertion: after one backward pass, `B` has a gradient and `A`'s gradient is exactly zero.

### The task and the data

The task is the triage from the opening: a free-text support message in, one JSON object out with `category` (billing, bug, account, shipping or feature_request), `priority` (high, normal or low) and `order_id` (an `ORD-#####` id or null). Priority follows a house policy: high when the customer says they're blocked, losing money or about to cancel; low when they say it isn't urgent, or for any feature request; normal otherwise. That's a typical fine-tuning target: a narrow task, a fixed format and a policy that's easy to state but has to be applied the same way every time.

The data is synthetic so every label is known to be right. The generator composes each message from a greeting, a category template, a priority cue and a sign-off. The important decision is the split: **the last three templates of every category and the last two cues of every priority level never appear in training**. The held-out test set is built only from them, so it measures whether the model learned the policy or memorized phrasings.

```python title="lora-triage/make_data.py (excerpt)"
import json
import random

# Each category has templates; the last 3 of each list are held out, so the
# test set asks the model to generalize to phrasings it never saw.
TEMPLATES = {
    "billing": [
        "I was charged twice for {order}, can you refund one of them?",
        "My invoice for {order} shows the wrong amount.",
        # ... 10 templates per category, 5 categories
    ],
    # "bug", "account", "shipping", "feature_request"
}

# Priority comes from cues in the text, never from the category alone
# (except feature requests, which are always low).
CUES = {
    "high": [
        "This is blocking our whole team.",
        "We have a launch tomorrow and this is stopping us.",
        "Fix this today or we cancel.",
        "Nobody here can work until this is solved.",
        "Our customers are complaining right now.",
        "This is costing us money every hour.",
    ],
    # "normal" and "low": 6 cues each, the last 2 held out
}

SYSTEM = (
    "You triage customer support messages. Reply with JSON only, with exactly these keys: "
    '"category" (one of billing, bug, account, shipping, feature_request), '
    '"priority" (from the impact the customer states: high if they say they are blocked, losing money or about to cancel; '
    "low if they say it is not urgent or it is a feature request; normal otherwise), "
    '"order_id" (the ORD-##### id in the message, or null).'
)


def make_example(rng: random.Random, split: str) -> dict:
    category = rng.choice(list(TEMPLATES))
    pool = TEMPLATES[category]
    template = rng.choice(pool[:7] if split == "train" else pool[7:])
    if category == "feature_request":
        priority = "low"
    else:
        priority = rng.choice(["high", "normal", "low"])
    cues = CUES[priority]
    cue = rng.choice(cues[:4] if split == "train" else cues[4:])
    order_id = f"ORD-{rng.randint(10000, 99999)}"
    if "{order}" in template:
        text = template.format(order=rng.choice([order_id, f"order {order_id}", f"my order {order_id}"]))
    else:
        text, order_id = template, None
    parts = [rng.choice(GREETINGS), text, cue, rng.choice(SIGNOFFS)]
    message = " ".join(p for p in parts if p)
    if rng.random() < 0.2:
        message = message.lower()
    label = {"category": category, "priority": priority, "order_id": order_id}
    return {"message": message, "label": label, "answer": json.dumps(label)}


if __name__ == "__main__":
    splits = {
        "train": build(600, "train", seed=1),
        "test_seen": build(200, "train", seed=2),  # same templates as train: the leaky eval
        "test_heldout": build(200, "heldout", seed=3),  # templates and cues never trained on
    }
    # ... writes the three .jsonl files and counts exact duplicates
```

```bash title="terminal"
$ python make_data.py
test_seen: 200 rows, 3 identical to a training message
test_heldout: 200 rows, 0 identical to a training message
```

A held-out row looks like this:

```json title="test_heldout.jsonl (one row)"
{"message": "Hi, I need my order ORD-62053 delivered to my office instead of my home. Nothing is broken, just asking. Thanks, Maria", "label": {"category": "shipping", "priority": "low", "order_id": "ORD-62053"}, "answer": "{\"category\": \"shipping\", \"priority\": \"low\", \"order_id\": \"ORD-62053\"}"}
```

`test_seen` is there on purpose, as the eval you should *not* trust: new random combinations of the training templates, three of them identical to a training row.

### Shared plumbing and the prompting baseline

```python title="lora-triage/triage.py"
import json

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from make_data import SYSTEM

MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct"
KEYS = ("category", "priority", "order_id")


def load(device: str = "cuda"):
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).to(device)
    return tok, model


def read_jsonl(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def chat_prompt(tok, message: str, shots: list[dict] = ()) -> str:
    turns = [{"role": "system", "content": SYSTEM}]
    for shot in shots:
        turns += [{"role": "user", "content": shot["message"]}, {"role": "assistant", "content": shot["answer"]}]
    turns.append({"role": "user", "content": message})
    return tok.apply_chat_template(turns, tokenize=False, add_generation_prompt=True)


def raw_prompt(tok, message: str) -> str:
    return f"{SYSTEM}\n\nMessage: {message}\nJSON:"


@torch.no_grad()
def generate(tok, model, prompts: list[str], batch_size: int = 32, max_new_tokens: int = 40) -> list[str]:
    tok.padding_side = "left"
    outputs = []
    for i in range(0, len(prompts), batch_size):
        batch = tok(prompts[i : i + batch_size], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
        out = model.generate(**batch, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tok.pad_token_id)
        outputs += tok.batch_decode(out[:, batch["input_ids"].shape[1] :], skip_special_tokens=True)
    return outputs


def score(outputs: list[str], rows: list[dict]) -> dict[str, float]:
    totals = dict.fromkeys(("valid_json", *KEYS, "exact"), 0)
    for text, row in zip(outputs, rows):
        try:
            pred = json.loads(text.strip())
        except json.JSONDecodeError:
            continue
        if not isinstance(pred, dict) or set(pred) != set(KEYS):
            continue
        totals["valid_json"] += 1
        hits = [pred[k] == row["label"][k] for k in KEYS]
        for k, hit in zip(KEYS, hits):
            totals[k] += hit
        totals["exact"] += all(hits)
    return {k: v / len(rows) for k, v in totals.items()}
```

The scoring is strict on purpose: an output only counts if it parses, has exactly the three keys, and each field is compared exactly. `exact` means all three fields right, which is what the routing service needs. Greedy decoding keeps it deterministic.

```python title="lora-triage/baseline.py"
from triage import chat_prompt, generate, load, read_jsonl, score

tok, model = load()
model.eval()
train = read_jsonl("train.jsonl")
test = read_jsonl("test_heldout.jsonl")
shots = [next(r for r in train if r["label"]["category"] == c) for c in ("billing", "shipping", "feature_request")]

for name, prompts in {
    "zero-shot": [chat_prompt(tok, r["message"]) for r in test],
    "3-shot": [chat_prompt(tok, r["message"], shots) for r in test],
}.items():
    outputs = generate(tok, model, prompts)
    metrics = score(outputs, test)
    print(f"{name:10}", " ".join(f"{k}={v:.1%}" for k, v in metrics.items()))
    print("  sample:", repr(outputs[0][:120]))
```

```bash title="terminal"
$ python baseline.py
zero-shot  valid_json=0.0% category=0.0% priority=0.0% order_id=0.0% exact=0.0%
  sample: 'The PDF you generate has blank pages in the middle. Only when you get a chance.'
3-shot     valid_json=100.0% category=33.5% priority=47.0% order_id=35.5% exact=6.5%
  sample: '{"category": "shipping", "priority": "high", "order_id": "ORD-73944"}'
```

This is the most instructive result in the post. Zero-shot, the 135M model ignores the instructions and echoes the message. Three examples fix the *format* completely: 100% valid JSON. They don't fix the *content*: 33.5% on category is barely above the 20% of guessing among five, and the sample output shows it inventing an order id for a message that has none. A small model can imitate the shape of an answer from a few examples, but it can't follow a policy it reads in a system prompt. That's the gap fine-tuning is for.

To be fair to prompting: a frontier model would score far higher than 6.5% with this prompt. I didn't run one here, and in a real project that run is the bar. The honest comparison is "big model plus prompt" against "small tuned model" on accuracy, cost per call and latency.

### Training only the adapters

```python title="lora-triage/train.py"
import argparse
import random
import time

import torch

from lora import count_parameters, inject_lora, lora_state_dict
from triage import chat_prompt, load, read_jsonl

ALL_LINEAR = {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}

parser = argparse.ArgumentParser()
parser.add_argument("--r", type=int, default=16)
parser.add_argument("--alpha", type=int, default=32)
parser.add_argument("--targets", default="all")
parser.add_argument("--lr", type=float, default=1e-3)
parser.add_argument("--epochs", type=int, default=2)
parser.add_argument("--rows", type=int, default=600)
parser.add_argument("--out", default="adapter.pt")
args = parser.parse_args()

torch.manual_seed(0)
tok, model = load()
targets = ALL_LINEAR if args.targets == "all" else set(args.targets.split(","))
inject_lora(model, targets, r=args.r, alpha=args.alpha)
trainable, total = count_parameters(model)
print(f"trainable params: {trainable:,} of {total:,} ({trainable / total:.2%})")


def encode(row: dict) -> tuple[list[int], list[int]]:
    prompt = tok(chat_prompt(tok, row["message"]), add_special_tokens=False)["input_ids"]
    answer = tok(row["answer"] + "<|im_end|>", add_special_tokens=False)["input_ids"]
    # Loss only on the answer: the model should learn to write the JSON,
    # not to reproduce the system prompt it will always be given.
    return prompt + answer, [-100] * len(prompt) + answer


examples = [encode(r) for r in read_jsonl("train.jsonl")[: args.rows]]
batch_size, micro_batch = 16, 4
steps = args.epochs * ((len(examples) + batch_size - 1) // batch_size)
params = [p for p in model.parameters() if p.requires_grad]
optimizer = torch.optim.AdamW(params, lr=args.lr, weight_decay=0.0)
scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lambda s: min(1.0, (s + 1) / 10) * max(0.0, 1 - s / steps))

model.train()
torch.cuda.reset_peak_memory_stats()
start = time.perf_counter()
step = 0
for epoch in range(args.epochs):
    random.Random(epoch).shuffle(examples)
    epoch_loss = 0.0
    for i in range(0, len(examples), batch_size):
        batch = examples[i : i + batch_size]
        # Micro-batches of 4 with gradient accumulation keep activations (and
        # the 49k-wide logits) small enough for a shared 8 GB laptop GPU.
        for j in range(0, len(batch), micro_batch):
            micro = batch[j : j + micro_batch]
            width = max(len(ids) for ids, _ in micro)
            input_ids = torch.tensor([ids + [tok.pad_token_id] * (width - len(ids)) for ids, _ in micro], device="cuda")
            labels = torch.tensor([lab + [-100] * (width - len(lab)) for _, lab in micro], device="cuda")
            attention = torch.tensor([[1] * len(ids) + [0] * (width - len(ids)) for ids, _ in micro], device="cuda")
            with torch.autocast("cuda", dtype=torch.bfloat16):
                loss = model(input_ids=input_ids, attention_mask=attention, labels=labels).loss
            (loss * len(micro) / len(batch)).backward()
            epoch_loss += loss.item() * len(micro)
        torch.nn.utils.clip_grad_norm_(params, 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        step += 1
    print(f"epoch {epoch + 1}: loss {epoch_loss / len(examples):.4f}")

elapsed = time.perf_counter() - start
print(f"{step} steps in {elapsed:.1f}s, peak GPU memory {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB")
state = lora_state_dict(model)
torch.save({"r": args.r, "alpha": args.alpha, "targets": sorted(targets), "state": state}, args.out)
print(f"adapter: {sum(v.numel() for v in state.values()):,} values, {sum(v.numel() * v.element_size() for v in state.values()) / 2**20:.1f} MiB in fp32")
```

Three choices matter more than the rest. The training text goes through the **same chat template** the model will see in production (`chat_prompt`, the same function the eval uses). The **loss is masked** to the answer tokens, so the gradient is spent on the JSON, not on the system prompt. And the answer ends with `<|im_end|>`, the template's end-of-turn token, so the model learns to stop. The learning rate of 1e-3 is higher than you'd use for full fine-tuning, in line with the "about 10x" finding above.

```bash title="terminal"
$ python train.py
trainable params: 4,884,480 of 139,399,488 (3.50%)
epoch 1: loss 0.1569
epoch 2: loss 0.0075
76 steps in 251.9s, peak GPU memory 2103 MiB
adapter: 4,884,480 values, 18.6 MiB in fp32
```

4.9M trainable parameters: 162,816 per layer across seven projections, times 30 layers. The adapter file is 18.6 MiB; the base model it modifies is about 270 MB in bf16. The 252 seconds were measured while another job had the same GPU at 95% utilization; an earlier run of the same configuration without gradient accumulation took 85 seconds, but peaked at 5,655 MiB, which is why the published script uses micro-batches.

### The eval, the merge and what broke

```python title="lora-triage/evaluate.py"
import sys

import torch

from lora import inject_lora, merge_lora
from triage import chat_prompt, generate, load, raw_prompt, read_jsonl, score

checkpoint = torch.load(sys.argv[1] if len(sys.argv) > 1 else "adapter.pt")
tok, model = load()
inject_lora(model, set(checkpoint["targets"]), r=checkpoint["r"], alpha=checkpoint["alpha"])
missing = model.load_state_dict(checkpoint["state"], strict=False)
assert not missing.unexpected_keys
model.eval()

seen = read_jsonl("test_seen.jsonl")
heldout = read_jsonl("test_heldout.jsonl")


def report(name: str, outputs: list[str], rows: list[dict]) -> None:
    metrics = score(outputs, rows)
    print(f"{name:22}", " ".join(f"{k}={v:.1%}" for k, v in metrics.items()))


heldout_prompts = [chat_prompt(tok, r["message"]) for r in heldout]
adapter_outputs = generate(tok, model, heldout_prompts)
report("lora / seen templates", generate(tok, model, [chat_prompt(tok, r["message"]) for r in seen]), seen)
report("lora / held-out", adapter_outputs, heldout)
report("lora / raw prompt", generate(tok, model, [raw_prompt(tok, r["message"]) for r in heldout]), heldout)

probe = tok(heldout_prompts[:8], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
with torch.no_grad():
    before = model(**probe).logits
    merge_lora(model)
    after = model(**probe).logits
print(f"max |logit diff| after merge: {(before - after).abs().max().item():.2e}")
merged_outputs = generate(tok, model, heldout_prompts)
print(f"merged outputs identical to adapter outputs: {merged_outputs == adapter_outputs}")

for row, out in list(zip(heldout, adapter_outputs))[:200]:
    if out.strip() != row["answer"]:
        print("MISS", repr(row["message"]), "->", out.strip())
```

```bash title="terminal"
$ python evaluate.py
lora / seen templates  valid_json=100.0% category=100.0% priority=98.0% order_id=100.0% exact=98.0%
lora / held-out        valid_json=100.0% category=95.5% priority=91.5% order_id=100.0% exact=88.0%
lora / raw prompt      valid_json=100.0% category=81.0% priority=86.0% order_id=100.0% exact=70.0%
max |logit diff| after merge: 1.29e-03
merged outputs identical to adapter outputs: True
MISS 'the invite link for my teammate says it expired. our customers are complaining right now.' -> {"category": "bug", "priority": "normal", "order_id": null}
MISS 'Hello team, Saving a draft wipes the text I typed. Only when you get a chance. Thanks, Maria' -> {"category": "feature_request", "priority": "low", "order_id": null}
MISS 'Hello team, The discount code was not applied to ORD-48242. This is costing us money every hour. - Priya' -> {"category": "shipping", "priority": "high", "order_id": "ORD-48242"}
MISS 'hey My payment failed but the money left my account anyway. Our customers are complaining right now. Thanks, Maria' -> {"category": "account", "priority": "normal", "order_id": null}
```

(The script prints all 24 misses; four are shown.) Line by line:

**Held-out exact match went from 6.5% (3-shot) to 88.0%**, with 100% valid JSON and 100% on order ids. For a 135M model, 600 synthetic rows and a few minutes of training, that's the whole argument for fine-tuning a narrow behavior.

**The seen-template eval says 98.0%.** Same model, same run, ten points higher, because those rows reuse phrasings the model trained on. If the only test set had been a random 20% of the generated rows, the report would have said 98%.

**The merge is exact up to float rounding.** Folding every adapter into `W` changed the logits by at most 0.0013 (fp32 accumulation order across 30 layers), and all 200 greedy outputs were identical before and after.

**The misses have a pattern.** 10 of the 24 contain "Our customers are complaining right now", a held-out high-priority cue the model never saw; it learned the four training cues better than the concept behind them. Several category errors show a shortcut: every shipping template contains an order id, so an order id in an unseen billing message ("The discount code was not applied to ORD-48242") pulls the prediction to shipping. Both are fixed with data, not hyperparameters: more varied cues, and billing examples with order ids.

The raw-prompt line is its own failure mode, covered in the next section.

### Two ablations: fewer modules, fewer rows

```bash title="terminal"
$ python train.py --r 8 --alpha 16 --targets q_proj,v_proj --out adapter_qv.pt
trainable params: 460,800 of 134,975,808 (0.34%)
epoch 1: loss 0.2928
epoch 2: loss 0.0662
76 steps in 140.4s, peak GPU memory 1665 MiB
adapter: 460,800 values, 1.8 MiB in fp32
$ python evaluate.py adapter_qv.pt
lora / seen templates  valid_json=100.0% category=77.0% priority=73.0% order_id=100.0% exact=56.5%
lora / held-out        valid_json=100.0% category=66.0% priority=72.0% order_id=100.0% exact=51.0%
lora / raw prompt      valid_json=23.0% category=9.5% priority=14.5% order_id=21.0% exact=6.0%
```

The classic configuration from the original paper (rank 8 on the query and value projections only) reached 51.0% held-out exact match against 88.0% for all seven projections, with the same data, learning rate and number of steps. A fairer fight would tune the learning rate and steps for each configuration, which I didn't do; it might close part of the gap. But it matches what the QLoRA and Thinking Machines results predict, and the adapter was 1.8 MiB against 18.6. The file size is not where you want to save.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Forty examples is plenty for something this simple. Look, the training loss went to 0.02, it's basically perfect.</span>
    </div>
  </div>
</div>

```bash title="terminal"
$ python train.py --rows 40 --epochs 15 --out adapter_tiny.pt
epoch 14: loss 0.0222
epoch 15: loss 0.0209
45 steps in 92.8s, peak GPU memory 2076 MiB
adapter: 4,884,480 values, 18.6 MiB in fp32
$ python evaluate.py adapter_tiny.pt
lora / seen templates  valid_json=100.0% category=82.5% priority=64.5% order_id=100.0% exact=58.0%
lora / held-out        valid_json=100.0% category=77.5% priority=69.0% order_id=100.0% exact=57.5%
```

Training loss 0.02, held-out exact match 57.5%. With 40 rows and 15 epochs the model memorized those 40 answers; training loss measures how well it reproduces its training set, which is the one thing you never deploy it on. Forty rows can't even cover the combinations of five categories, three priorities and the order-id cases with enough variety to separate the policy from the phrasing. The only number that tells you whether it learned the task is the one on data it hasn't seen.

## Production Reality Check

### Data leakage makes every fine-tune look great

The ten-point gap between `test_seen` and `test_heldout` came from a controlled toy. In real projects leakage is sneakier: near-duplicate tickets from the same customer on both sides of the split, the same email thread split across train and test, templated system messages, or a test set drawn from the same week as the training data when production traffic comes from next month. Split by the unit that generalizes (customer, thread, document, time window), deduplicate with fuzzy matching, and keep a small test set frozen from day one that nobody tunes against. The discipline is the same one as in [building a retrieval test set](/en-us/blog/rag-evaluation-retrieval-test-set/): an eval is only worth what its split is worth.

### Chat template mismatch

The `raw prompt` rows ran the tuned model on the same messages, formatted without the chat template: same system text, same message, just no `<|im_start|>` role markers. Held-out exact match fell from 88.0% to 70.0%, and for the rank 8 q,v adapter valid JSON fell from 100% to 23%. The adapter learned a behavior *conditional on the exact token sequence it was trained on*.

This bites in production in quiet ways. The serving stack applies a different template than the training script, a newer tokenizer version changes the template, a hand-built prompt string skips the system turn and the template inserts its default system prompt (SmolLM2's is "You are a helpful AI assistant named SmolLM, trained by Hugging Face"), or the generation prompt is missing so the model continues the user's turn. Use `apply_chat_template` in both training and serving, pin the tokenizer with the adapter, and run the eval through the serving path, not only through the training code.

### Catastrophic forgetting, or behavior bleed

I asked the base model and the tuned one three unrelated questions, without the triage system prompt:

```python title="lora-triage/forgetting.py"
import torch

from lora import inject_lora
from triage import generate, load

QUESTIONS = ["What is the capital of France?", "Write a haiku about the sea.", "Give me one tip for writing clean Python."]

tok, model = load()
prompts = [tok.apply_chat_template([{"role": "user", "content": q}], tokenize=False, add_generation_prompt=True) for q in QUESTIONS]
base = generate(tok, model, prompts, max_new_tokens=30)
checkpoint = torch.load("adapter.pt")
inject_lora(model, set(checkpoint["targets"]), r=checkpoint["r"], alpha=checkpoint["alpha"])
model.load_state_dict(checkpoint["state"], strict=False)
tuned = generate(tok, model, prompts, max_new_tokens=30)
for q, b, t in zip(QUESTIONS, base, tuned):
    print(f"Q: {q}\n  base:  {b.strip()!r}\n  tuned: {t.strip()!r}")
```

```bash title="terminal"
$ python forgetting.py
Q: What is the capital of France?
  base:  'The capital of France is Paris.'
  tuned: '{"capital": "france"}'
Q: Write a haiku about the sea.
  base:  'The waves crash against the shore,\nA symphony of sound, a symphony of life.\nThe salty scent of the sea, a welcome sight,'
  tuned: '{"sea" "waves" "laugh" "laugh" "laugh" "laugh" "laugh" "laugh"'
Q: Give me one tip for writing clean Python.
  base:  "One tip for writing clean Python is to use the `re` module for regular expressions. Here's a simple example:\n\n```python\nimport"
  tuned: '{"tip": "use a clean version of your code"}'
```

After 600 examples of one task, the tuned model answers *everything* in JSON. For a dedicated triage endpoint that's fine, arguably a feature. For a model that also has to chat, it's a regression your triage eval will never see, because it only tests triage. Three mitigations, in the order I reach for them: keep the adapter separate and only activate it for the task (next section); mix some general instruction data into training so the model keeps its other behaviors; and add a small "general capability" suite to the eval, so forgetting shows up as a number. Biderman et al. found LoRA forgets less than full fine-tuning, and "less" is still not zero, as a 135M model with 3.5% of its parameters retrained makes very clear.

### Merge or keep adapters separate

<div id="lora-serving-slot"></div>

**Merging** folds `(alpha / r) * B A` into `W` and gives you a plain checkpoint with the original architecture. It runs on any inference stack, with no extra latency, which is exactly the property the paper emphasizes. The price is one full model copy per task, and the adapter can no longer be switched off.

**Keeping adapters separate** means one base model in GPU memory and many small adapters beside it. vLLM supports this directly: start the server with `--enable-lora` and `--lora-modules triage=/path/to/adapter`, tune `max_loras` and `max_lora_rank`, and pick the adapter per request through the `model` field, as described in its [LoRA docs](https://docs.vllm.ai/en/latest/features/lora.html). Systems like [S-LoRA](https://arxiv.org/abs/2311.03285) push this to thousands of concurrent adapters on one GPU with a unified memory pool for adapter weights and KV cache. The LoRA paper itself notes the trade-off: once you merge `A` and `B` into `W`, batching requests for different tasks in one forward pass stops being straightforward. The unmerged path costs two thin extra matmuls per adapted layer, which a batched kernel mostly hides.

My rule: one task, high volume, stable adapter, then merge. Per-tenant variants, frequent retraining or A/B tests between adapters, then keep them separate. Either way, eval the artifact you actually serve. The merge above was exact in fp32; merging into bf16 weights adds rounding, and with a QLoRA adapter the adapter was trained against *dequantized NF4* weights, so merging into the original 16-bit weights (or re-quantizing the merged result) produces a model slightly different from the one you trained. It's usually fine. "Usually" is what the eval is for.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If rank 16 is good, rank 256 must be better. Let's max it out to be safe.</span>
    </div>
  </div>
</div>

Rank buys capacity, and for a narrow behavior capacity isn't the bottleneck: the triage misses above come from gaps in the data, and a bigger adapter would memorize the training cues even more thoroughly. Higher rank means more memory, a bigger file and more room to overfit a small dataset, and with plain `alpha / r` scaling it also changes the effective step size, so the learning rate you tuned no longer means the same thing. Start at 8 or 16 on all linear layers, and raise rank only when the held-out eval (not the training loss) shows the model is underfitting a large, varied dataset. If you do go high, look at rsLoRA's scaling.

### Smaller things that bite

- **Pad and EOS tokens.** SmolLM2 uses `<|im_end|>` for both. If you mask padding with the EOS id in the labels, the model never learns to stop. Mask by attention mask (as the script does), and keep the real end-of-turn token in the labels.
- **Left padding for generation.** Batched decoding with right padding puts pad tokens between the prompt and the answer. Training can pad right; generation pads left.
- **Version the adapter with its base.** An adapter is a diff against one exact checkpoint. Store the base model revision, tokenizer revision, target modules, rank and alpha next to the weights, as `train.py` stores `r`, `alpha` and `targets`.
- **Synthetic data teaches synthetic patterns.** The order-id shortcut above came from how I wrote the templates. Real tickets will surface different shortcuts; sample real traffic into the eval as soon as you have it.

Fine-tuning earns its place when the problem is behavior and the prompt baseline has plateaued on an eval you trust. LoRA makes it cheap: freeze the model, learn `B A` with `B` starting at zero, target every linear layer, and you get an adapter measured in megabytes that you can merge for a single task or hot-swap among many. On a 135M model that took a triage task from 6.5% to 88.0% exact match in a few minutes on a laptop, and the same afternoon showed a leaky eval, a template mismatch and a model that answers "What is the capital of France?" in JSON. The math is ten lines. The eval is the part that decides whether the ten lines were worth it.
