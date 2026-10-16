---
title: "The Portuguese Token Tax: 9 Tokenizers, 31 Articles, Same Content"
description: "How much more the same text costs in Portuguese than in English, measured on 31 articles of this site with nine tokenizers, and what to do about it in prompts, budgets and RAG."
date: 2026-10-16
tags: [LLMs, Tokenization, Python, Cost]
tldr:
  - "On the 31 articles of this site, which exist in both languages, Portuguese costs 17% to 36% more tokens than English, and about 7 of those points are just Portuguese being longer."
  - "Newer vocabularies (OpenAI's o200k, Llama 4, Gemma 3) cut the gap to about 18%; cl100k, Llama 3, Qwen3, DeepSeek V3 and GLM-4.5 still charge 31% to 36%."
  - "Writing without accents saves nothing: on the newer vocabularies it costs about 2% more. Count with the target model's tokenizer and compare prices per word of the language you serve."
---

A team prices a support assistant for a Brazilian client. They run the English prototype for a week, read the bill, multiply by the expected traffic and add a margin. The Portuguese launch goes fine until the end of the month, when the invoice comes in a third higher than the estimate, the long conversations start hitting the context limit earlier than anyone tested, and the RAG chunks that held a whole section of a manual in English now cut it short.

The math was right, but it was done with English tokens. Models don't read words or characters, they read **tokens**, and the same idea written in Portuguese takes more of them than in English. How many more depends on the model, and the difference between models is bigger than most people assume.

I wanted a number for that, measured on real text instead of a sentence picked to make a point. This site gives me a good corpus: every article exists in English and Portuguese under the same file name, written for the same readers and with the same structure. So I tokenized the 31 articles published before this one with nine tokenizers and compared.

## The Problem & Context

A tokenizer turns text into a list of integers from a fixed vocabulary. Everything that costs money or space in an LLM is counted in those integers: the price per million input and output tokens, the context window, the rate limits, the KV cache in GPU memory, the time to generate an answer. A sentence that needs 30% more tokens costs 30% more, fills the context 30% faster and takes 30% longer to stream back.

English is the cheapest language for almost every tokenizer, for a simple reason: the vocabularies were learned from samples dominated by English text, so common English words became single tokens and everything else gets assembled from pieces.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy, a token is about four characters. Count the characters, divide by four, done. And if Portuguese is expensive, I'll just strip the accents before sending.</span>
    </div>
  </div>
</div>

Both shortcuts fail on this corpus. "Four characters per token" is a rule of thumb for English on one OpenAI vocabulary. For the Portuguese articles here the real figure goes from 4.23 characters per token (Llama 4) to 3.63 (Qwen3 and cl100k), so a divide-by-four estimate is 5% too high on one model and 9% too low on another. And stripping accents, as we'll see, makes the text slightly *more* expensive on the newer tokenizers, on top of making it wrong.

## Deep Dive / Architectural Design

### How a vocabulary gets its words

Most current tokenizers use byte pair encoding (BPE). Before any model is trained, the tokenizer is trained on a sample of text: it starts from single bytes and repeatedly merges the most frequent adjacent pair into a new vocabulary entry, until the vocabulary reaches its target size, 100,000 or 200,000 entries, say. At inference time, the text is first split by a **pre-tokenizer** (on spaces, punctuation and digits, with rules that differ per model), and then each piece is encoded with the longest known entries.

<div id="token-tax-pipeline-slot"></div>

The consequence is that the vocabulary is a frozen picture of the tokenizer's training mix. If Portuguese was a small share of that sample, few Portuguese words and endings were frequent enough to earn their own entry, and the language gets spelled out in fragments. You can see it in the vocabularies themselves. I counted the entries that contain "ção" or "ções", the Portuguese ending of words like *informação* and *configurações*:

| Tokenizer | Vocabulary | Entries with "ção"/"ções" |
|---|---:|---:|
| GPT-4 cl100k | 100k | 20 |
| Llama 3 | 128k | 20 |
| Qwen3 | 151k | 39 |
| DeepSeek V3 | 129k | 40 |
| GLM-4.5 | 151k | 42 |
| Mistral Nemo | 131k | 60 |
| Gemma 3 | 262k | 151 |
| GPT-4o o200k | 200k | 219 |
| Llama 4 | 202k | 237 |

Twenty entries means the ending exists, but almost no whole word that uses it does. Two hundred means a good part of the common vocabulary of technical Portuguese made it in as single tokens.

### Same word, different bill

Here is how four of these tokenizers split a few words (with the leading space, as they appear mid-sentence):

| Word | o200k | cl100k | Qwen3 | Gemma 3 |
|---|---|---|---|---|
| information | 1 | 1 | 1 | 1 |
| informação | 1 | 2: inform + ação | 1 | 1 |
| implementação | 1 | 2: implement + ação | 2: implement + ação | 1 |
| configuração | 1 | 3: config + ura + ção | 3: config + ura + ção | 1 |
| requisição | 2: requ + isição | 3: requ + isi + ção | 3: requ + isi + ção | 2: requ + isição |
| informacao (no accent) | 2: inform + acao | 2: inform + acao | 2: inform + acao | 2: inform + acao |

Two details matter for what comes later. Byte-level tokenizers like Qwen's work on UTF-8 bytes, and "ç" and "ã" are two bytes each, so an accented character the vocabulary doesn't know costs more than a plain one. And the version without the accent is a word that almost never appears in the training text, so it doesn't get its own entry either: *informacao* is two tokens everywhere, while *informação* is one on three of the four.

### Separating the translation from the tokenizer

A Portuguese text is usually longer than its English original, regardless of tokenization: articles, prepositions and longer word forms add up. If I report "Portuguese costs 35% more tokens," part of that is the language and part is the tokenizer, and only the second part changes when you switch models.

The corpus lets me measure both. Across the 31 articles, after removing code, HTML and links, the English versions have 88,097 words and 516,631 characters, and the Portuguese ones 94,998 words and 554,590 characters: **7.8% more words and 7.3% more characters**. Any tokenizer that charged exactly the same per character would show a ratio of 1.073. Everything above that is what the tokenizer adds.

## Hands-On Implementation

### The measurement

The script reads each pair of articles, keeps only the prose (frontmatter, code blocks, inline code, HTML, links and tables out, because code is the same in both languages and would dilute the comparison), and counts tokens with each tokenizer. OpenAI's vocabularies come from `tiktoken`; the others are loaded from the Hugging Face Hub with `tokenizers`, which only downloads `tokenizer.json`, not the weights.

```python title="measure_token_tax.py"
import re
import unicodedata
from pathlib import Path

import tiktoken
from tokenizers import Tokenizer

POSTS = Path("src/content/posts")
HF = {
    "Llama 4 (202k)": "unsloth/Llama-4-Scout-17B-16E-Instruct",
    "Llama 3 (128k)": "unsloth/Llama-3.2-1B-Instruct",
    "Gemma 3 (262k)": "unsloth/gemma-3-4b-it",
    "Qwen3 (151k)": "Qwen/Qwen3-8B",
    "DeepSeek V3 (129k)": "deepseek-ai/DeepSeek-V3",
    "GLM-4.5 (151k)": "zai-org/GLM-4.5",
    "Mistral Nemo (131k)": "mistralai/Mistral-Nemo-Instruct-2407",
}
TIKTOKEN = {"GPT-4o o200k": "o200k_base", "GPT-4 cl100k": "cl100k_base"}


def prose(md: str) -> str:
    md = re.sub(r"\A---\n.*?\n---\n", "", md, flags=re.S)  # frontmatter
    md = re.sub(r"```.*?```", "", md, flags=re.S)         # code blocks
    md = re.sub(r"<[^>]+>", " ", md)                      # HTML
    md = re.sub(r"`[^`]*`", " ", md)                      # inline code
    md = re.sub(r"\]\([^)]*\)", "]", md)                  # link targets
    md = re.sub(r"^\s*\|.*\|\s*$", "", md, flags=re.M)    # tables
    md = re.sub(r"[ \t]+", " ", md)                       # keep line breaks,
    return re.sub(r"\n{3,}", "\n\n", md).strip()          # like a real prompt


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def encoders():
    for name, enc in TIKTOKEN.items():
        e = tiktoken.get_encoding(enc)
        yield name, lambda s, e=e: e.encode(s, disallowed_special=())
    for name, repo in HF.items():
        t = Tokenizer.from_pretrained(repo)
        yield name, lambda s, t=t: t.encode(s, add_special_tokens=False).ids


slugs = sorted(p.stem for p in (POSTS / "en-us").glob("*.md") if (POSTS / "pt-br" / p.name).exists())
en = [prose((POSTS / "en-us" / f"{s}.md").read_text(encoding="utf-8")) for s in slugs]
pt = [prose((POSTS / "pt-br" / f"{s}.md").read_text(encoding="utf-8")) for s in slugs]

for name, encode in encoders():
    en_n = sum(len(encode(t)) for t in en)
    pt_n = sum(len(encode(t)) for t in pt)
    plain = sum(len(encode(strip_accents(t))) for t in pt)
    print(f"{name:20} en={en_n:7,} pt={pt_n:7,} ratio={pt_n / en_n:.3f} no-accents={plain / pt_n - 1:+.1%}")
```

Two choices in there are deliberate. `add_special_tokens=False` keeps the beginning-of-text token out, since it's the same in both languages. And the comparison is per article and summed, so a long article weighs more than a short one, like it would on a bill.

I also ran Phi-4's tokenizer. Its numbers matched cl100k to the token on every article, because Phi-4 uses that same vocabulary, so it's left out of the tables.

### The results

All 31 articles, 31 pairs, prose only:

| Tokenizer | EN tokens | PT tokens | PT / EN | Per-article range | PT tokens per word |
|---|---:|---:|---:|---|---:|
| Gemma 3 (262k) | 117,396 | 137,824 | **1.174** | 1.12 to 1.22 | 1.45 |
| GPT-4o o200k | 111,490 | 131,662 | **1.181** | 1.14 to 1.22 | 1.39 |
| Llama 4 (202k) | 110,401 | 131,245 | **1.189** | 1.15 to 1.23 | 1.38 |
| Mistral Nemo (131k) | 116,946 | 144,121 | **1.232** | 1.18 to 1.28 | 1.52 |
| GLM-4.5 (151k) | 112,520 | 147,363 | **1.310** | 1.25 to 1.37 | 1.55 |
| DeepSeek V3 (129k) | 112,973 | 150,163 | **1.329** | 1.25 to 1.40 | 1.58 |
| Qwen3 (151k) | 114,098 | 152,671 | **1.338** | 1.27 to 1.39 | 1.61 |
| Llama 3 (128k) | 112,353 | 152,284 | **1.355** | 1.29 to 1.41 | 1.60 |
| GPT-4 cl100k | 112,361 | 152,546 | **1.358** | 1.30 to 1.41 | 1.61 |

Three groups show up. The newest large vocabularies (Gemma 3, o200k, Llama 4) charge Portuguese about 18% more than English. Mistral Nemo sits alone in the middle at 23%. And the Chinese labs' tokenizers land together with the older Western ones, at 31% to 36%. Subtract the 7.3% that comes from Portuguese simply being longer, and the tokenizer's own share is about 10% for the first group and 22% to 27% for the last.

The English column barely moves: from 110,401 to 117,396 tokens, a 6% spread. The Portuguese column goes from 131,245 to 152,671, a 16% spread. All nine handle English about equally well; what separates them is how much Portuguese went into their vocabularies.

The Llama line is a nice controlled comparison. Llama 3's vocabulary is cl100k's 100,000 entries plus 28,000 added for other languages, and on this text it behaves exactly like cl100k (1.355 against 1.358), so those extra entries didn't reach technical Portuguese. Llama 4's 202k vocabulary drops the ratio to 1.189. For the news-minded: Meta's new Muse Spark Open lists a vocabulary of 202,048 entries, the same size as Llama 4's, so it very likely inherits this behavior (its repository is gated, so I measured Llama 4's tokenizer instead).

Gemma 3 has the lowest ratio and still isn't the cheapest in absolute terms: its 262k vocabulary covers so many languages, probably at the expense of English, that its English needs more tokens than the others (1.33 per word). Its Portuguese ends up 5% above o200k's. That's why the ratio alone isn't the number to shop with.

### What it means in context and money

Tokens per word turn into how much text fits in a window. With a 128k-token context:

| Tokenizer | English words in 128k | Portuguese words in 128k |
|---|---:|---:|
| Llama 4 | about 102,000 | about 93,000 |
| GPT-4o o200k | about 101,000 | about 92,000 |
| Qwen3 | about 99,000 | about 80,000 |
| GPT-4 cl100k | about 100,000 | about 80,000 |

On the older vocabularies, a Portuguese conversation loses a fifth of the window compared to the same conversation in English. In money it's the same ratio: at the same price per token, a workload that would cost $1,000 in English costs about $1,180 in Portuguese on o200k and about $1,340 on Qwen3.

### Accents: the shortcut that backfires

The last column of the script answers the Junior's second idea. Same Portuguese text, accents removed with Unicode normalization:

| Tokenizer | Tokens with accents | Without accents | Change |
|---|---:|---:|---:|
| Llama 4 | 131,245 | 134,615 | +2.6% |
| GPT-4o o200k | 131,662 | 134,480 | +2.1% |
| Gemma 3 | 137,824 | 140,541 | +2.0% |
| Mistral Nemo | 144,121 | 147,013 | +2.0% |
| DeepSeek V3 | 150,163 | 152,245 | +1.4% |
| Qwen3 | 152,671 | 153,505 | +0.5% |
| GLM-4.5 | 147,363 | 147,225 | -0.1% |
| GPT-4 cl100k | 152,546 | 151,888 | -0.4% |
| Llama 3 | 152,284 | 151,488 | -0.5% |

On the tokenizers that learned Portuguese, accented words are whole entries and their accent-free versions aren't, so stripping costs about 2% more. On the older ones it saves half a percent at best. In both cases you're sending the model text that native speakers don't write, which is a worse input for a model trained on real Portuguese. Keep the accents.

### Checking your own text

For a single prompt or document, the same libraries give you the answer in a few lines. Use the tokenizer of the model you're actually calling: the numbers above vary by 16% on the same Portuguese text.

```python title="count_tokens.py"
import tiktoken
from tokenizers import Tokenizer

text = open("system_prompt_pt.txt", encoding="utf-8").read()

o200k = tiktoken.get_encoding("o200k_base")
qwen = Tokenizer.from_pretrained("Qwen/Qwen3-8B")

print("o200k:", len(o200k.encode(text)))
print("qwen3:", len(qwen.encode(text, add_special_tokens=False).ids))
```

For models whose tokenizer isn't published, Claude and Gemini among them, the providers expose a token counting endpoint in their APIs; call it with a representative sample instead of guessing from a ratio measured on someone else's tokenizer.

## Production Reality Check

### Estimate in the target language, with the target tokenizer

Price a Portuguese product with Portuguese text. Take a few hundred real prompts and answers (or a translated sample, if the product doesn't exist yet), count them with the model's own tokenizer, and keep that ratio next to the price in your cost model. A per-locale cost metric in production catches the surprise from the opening story in the first week, before the invoice arrives.

### Compare models per word

Two models listed at the same price per million tokens aren't the same price for Portuguese text. On this corpus, Qwen3 needs 16% more tokens than o200k for the same Portuguese, DeepSeek V3 14% more and GLM-4.5 12% more. Divide the listed price by the tokens-per-word of the language you serve and the ranking can change. For English the correction is small; for Portuguese it isn't.

### Size chunks and windows in tokens

RAG chunk sizes are usually set in tokens, and a 512-token chunk holds about 15% less content in Portuguese than in English on o200k, and about 26% less on cl100k. If the chunking was tuned on English documents, measure again on the Portuguese corpus before assuming a chunk still holds a full section ([chunking enterprise documents](/en-us/blog/chunking-enterprise-documents/) covers how to test that). The same goes for conversation history budgets and summaries triggered at a token count.

### Prompt language is a quality decision first

Writing system prompts in English saves tokens, 15% to 26% of them depending on the tokenizer, and for a long static prompt [prompt caching](/en-us/blog/prompt-caching-kv-cache/) makes those tokens cheap after the first call anyway. The bigger question is whether answers in Portuguese stay as good when the instructions are in English, and only your own evals can answer that.

### What this measurement doesn't cover

The corpus is technical Portuguese, full of English terms (deploy, cache, embedding) that tokenize the same in both versions, so casual Portuguese probably shows a bigger gap. The translations are mine, written for this site, and a different translator would produce a slightly different length. And this is about tokenizers only: a cheaper tokenizer makes a model cheaper per word of Portuguese and says nothing about the quality of its answers.

The short version for a bill: on this site, the Portuguese version of the same content costs between 17% and 36% more tokens, depending on the model that reads it. Pick the model first for the quality you need, then check which side of that range its tokenizer sits on.
