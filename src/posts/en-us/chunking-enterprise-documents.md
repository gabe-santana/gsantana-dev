---
title: "Chunking Enterprise Documents Without Losing Meaning"
description: "Preserve document structure when chunking so retrieval keeps the context tables and policies need."
date: 2026-01-05
tags: [RAG, Chunking, Python, Embeddings]
tldr:
  - "Split at headings, lists, tables and code blocks, and only split a block when it exceeds the token budget."
  - "Prepend the heading path to every chunk so the embedding and the model both know which section the text belongs to."
  - "Index small child chunks, then return their deduplicated parent sections so tables, procedures and exceptions reach the model whole."
---

Picture an HR assistant sitting on top of the company travel policy. Someone asks "what is my per diem in Tokyo for a 45 day assignment?" and the bot confidently answers "90 USD per day". The policy actually says trips longer than 30 days drop to 75% of the limit from day 31. That sentence exists. It sits three lines below the table, and the chunker cut it into a different chunk that never reached the model.

Nobody in that pipeline did anything obviously wrong: the model read exactly what it was given. The damage happened at ingestion, in a function that splits text every 1,000 characters. Chunking is the least glamorous step in RAG and one of the most decisive, so let's build a chunker that respects the way enterprise documents are actually written.

## The Problem & Context

Enterprise documents are not prose. Policies, runbooks, contracts and product specs are built from headings, numbered procedures, tables, definition lists and exceptions that refer back to rules. The meaning lives in the structure as much as in the words. A fixed-size window, whether it counts characters or tokens, knows nothing about that structure, so it cuts wherever the counter runs out.

The typical breakages look like this:

- **A table header separated from its rows.** The chunk contains `| Tokyo | 90 | 280 |` and nothing else. Is 90 the daily limit, the lodging cap, or a building number? The model has to guess.
- **"Step 4" without steps 1 to 3.** A procedure split in the middle gives you a chunk that starts with "4. Submit the visa application". Ask "what do I need before applying for a visa?" and the retrieved chunk does not contain the answer, even though the document does.
- **An exception cut from its rule.** "Exception: trips longer than 30 days receive 75%..." lands in a chunk without the rule it modifies, and the rule lands in a chunk without its exception. Both halves are now wrong on their own.

There is a second, quieter loss: context. Even a cleanly cut chunk has lost its address. A paragraph that says "Economy class is the default" means one thing under "Domestic Travel" and possibly something else under "Executive Travel". Once it is a free-floating chunk, neither the embedding nor the model knows which policy it belongs to.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy, just make the chunks huge. At 2,000 tokens the whole table and the exception fit in one chunk, right?</span>
    </div>
  </div>
</div>

Sometimes, and you pay twice. In retrieval, one vector must represent all 2,000 tokens, so a chunk covering per diem, visas and expense deadlines becomes a blurry average that matches none of them sharply. In generation, the model has to find the relevant three lines inside a wall of expensive context. What you actually want is small units for matching and whole units for reading, which is exactly where this post ends up.

Here is how the common strategies compare:

| Strategy | Boundaries | Context kept | Typical failure |
|---|---|---|---|
| Fixed-size windows | Every N characters or tokens | None | Cuts tables, lists and sentences anywhere |
| Recursive character splitting | Paragraphs, then sentences, then words | Little | Better sentences, still ignores headings and tables |
| Structure-aware | Headings, lists, tables, code blocks | Heading path | Huge sections need a fallback |
| Structure-aware + parent-child | Structure for children, sections for parents | Heading path and full section | More storage and a second lookup |

## Deep Dive / Architectural Design

The design has three ideas: parse the document into structural blocks, pack blocks into chunks without crossing section boundaries, and separate what you index from what you give the model.

```text
 PDF / DOCX / HTML
        │
        ▼
 ┌────────────────────────┐
 │ Layout-aware extraction│  (its own problem: OCR, reading order, tables)
 └───────────┬────────────┘
             │ Markdown
             ▼
 ┌────────────────────────┐     ┌──────────────────────────────┐
 │ Block parser           │ ──▶ │ Section tree (heading paths) │
 └────────────────────────┘     └──────────────┬───────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────┐
                     ▼                                               ▼
        ┌─────────────────────────┐                    ┌──────────────────────────┐
        │ Child chunks            │                    │ Parent sections          │
        │ breadcrumb + blocks     │                    │ full text, keyed by id   │
        │ + metadata + parent_id  │                    │ (document store)         │
        └────────────┬────────────┘                    └────────────▲─────────────┘
                     │ embed + index                                │ fetch by parent_id
                     ▼                                              │
 query ──▶ search children ──▶ top-k child hits ──▶ dedupe parent ids
```

### Convert upstream, chunk Markdown

Do not write a chunker that understands PDF. Extracting text from PDFs and DOCX files with correct reading order, merged table cells and multi-column layouts is a hard problem of its own, and dedicated layout-aware tools exist for it (Azure AI Document Intelligence's layout model, for example, can emit Markdown directly). Convert everything to Markdown or clean HTML first, then chunk one well-understood format. The Markdown also becomes a debuggable intermediate: when a chunk looks wrong, you can see whether extraction or chunking is to blame.

### Blocks are atomic, sections are the boundary

The parser turns Markdown into typed blocks: paragraph, list, table, code. The chunker then follows two rules. A chunk never crosses a heading, so it never mixes two sections. And a block is never split while it fits within the budget, so a table, a numbered procedure or a code sample arrives whole. Only when a single block is too large does it get split, and then along its own grain: tables by groups of rows with the header row repeated in every piece, lists by items, code by lines with the fence restored, paragraphs by sentences.

### Heading paths as breadcrumbs

Every chunk starts with its heading path, like `Travel Policy > International Travel > Per diem`. That one line does a lot of work. It puts the topic words into the embedding, so a question about international per diem matches the row chunk even though the row itself only says "Tokyo | 90 | 280". It also tells the model where the text came from and doubles as a citation label.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Isn't repeating the same heading in every chunk just wasted tokens?</span>
    </div>
  </div>
</div>

It costs maybe ten or fifteen tokens per chunk, and it is the cheapest context you will ever buy. Without it, the chunk with the Tokyo row has no words about travel or per diem at all, so it depends entirely on luck to be retrieved. If paths get long in deeply nested documents, keep the last two or three levels.

### Sizes in tokens, with a pluggable counter

Budgets should be in tokens, because that is what embedding models and context windows count. Many open embedding models also have a maximum sequence length (often 256 or 512 tokens) and silently truncate anything longer, which means the end of an oversized chunk simply never gets embedded. Make the token counter a parameter: a cheap estimate for experiments, your embedding model's real tokenizer in production.

### Overlap: useful for prose, noise for structure

Overlap exists to rescue sentences that a blind window cuts in half. When boundaries follow structure, there is much less to rescue: the chunk already ends at the end of a table or a section. Overlap then mostly duplicates text, which inflates the index and fills your top-k with near-identical neighbors that crowd out other relevant chunks.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But every tutorial uses 10 to 20% overlap. Shouldn't I always add it?</span>
    </div>
  </div>
</div>

Tutorials use fixed-size windows, where overlap is a patch for bad boundaries. Keep it for the fallback path (a long section of unstructured prose that you split by sentences) and skip it where the structure already gives clean boundaries. If you do use it, deduplicate overlapping hits before they reach the prompt.

### Small-to-big: index children, return parents

This is the piece that makes the whole thing click. Index small child chunks, because small chunks produce sharp embeddings and precise matches. Store the full section for each child under a parent id. At query time, search the children, collect their parent ids in rank order, deduplicate, and give the model the parent sections. The child that matched "Tokyo" brings back the whole per diem section, with the header row and the exception included.

The parent level is a choice. The leaf section is a good default for policies and runbooks. For short sections you can climb one heading level; for very long ones you cap the parent size or return the matched child plus its neighbors.

## Hands-On Implementation

Everything below uses only the Python standard library, plus `tiktoken` in one optional file. The sample document is a small travel policy with nested headings, a table, an exception and a numbered procedure.

```python title="chunker.py"
import re
from dataclasses import dataclass, field
from typing import Callable

TokenCounter = Callable[[str], int]

HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
FENCE = "`" * 3  # a code fence, spelled this way so this file can live inside Markdown

SAMPLE_POLICY = """# Travel Policy

Applies to all employees and contractors traveling on company business.

## Domestic Travel

### Booking

Book flights and hotels through the corporate travel portal at least 7 days
in advance. Economy class is the default for flights under 6 hours.

## International Travel

### Per diem

Per diem covers meals and incidentals. Lodging is reimbursed separately
against receipts, up to the cap for the destination city.

| City | Daily limit (USD) | Lodging cap (USD) |
|---|---|---|
| London | 95 | 320 |
| Tokyo | 90 | 280 |
| Sao Paulo | 70 | 210 |
| New York | 105 | 350 |

Exception: trips longer than 30 consecutive days receive 75% of the daily
limit from day 31 onward.

### Visa and approvals

Before booking any international trip, follow this procedure:

1. Check the entry requirements for your passport on the official government site.
2. Request a business invitation letter from the host office.
3. Get written approval from your director and attach it to the trip request.
4. Submit the visa application and upload the receipt to the travel portal.
5. Book flights only after the visa is issued.

## Expense Reporting

Submit expenses within 15 days of returning. Receipts are mandatory for any
item above 25 USD.
"""


def approx_tokens(text: str) -> int:
    # Rough English heuristic (about 0.75 words per token). Swap in a real tokenizer.
    return max(1, round(len(text.split()) * 4 / 3))


@dataclass
class Block:
    kind: str  # heading, paragraph, list, table, code
    text: str
    level: int = 0


@dataclass
class Section:
    section_id: str
    heading_path: list[str]
    blocks: list[Block] = field(default_factory=list)

    @property
    def breadcrumb(self) -> str:
        return " > ".join(self.heading_path)

    @property
    def text(self) -> str:
        body = "\n\n".join(block.text for block in self.blocks)
        return f"{self.breadcrumb}\n\n{body}".strip()


@dataclass
class Chunk:
    chunk_id: str
    parent_id: str
    heading_path: list[str]
    text: str
    token_count: int
    metadata: dict[str, str]


def _starts_block(line: str) -> bool:
    return bool(
        HEADING.match(line)
        or line.startswith(FENCE)
        or line.lstrip().startswith("|")
        or LIST_ITEM.match(line)
    )


def parse_blocks(markdown: str) -> list[Block]:
    lines = markdown.splitlines()
    blocks: list[Block] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.startswith(FENCE):
            j = i + 1
            while j < len(lines) and not lines[j].startswith(FENCE):
                j += 1
            blocks.append(Block("code", "\n".join(lines[i : j + 1])))
            i = j + 1
        elif match := HEADING.match(line):
            blocks.append(Block("heading", match.group(2), level=len(match.group(1))))
            i += 1
        elif line.lstrip().startswith("|"):
            j = i
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                j += 1
            blocks.append(Block("table", "\n".join(lines[i:j])))
            i = j
        elif LIST_ITEM.match(line):
            j = i + 1
            # Continuation lines (indented) stay with their list
            while j < len(lines) and lines[j].strip() and (
                LIST_ITEM.match(lines[j]) or lines[j].startswith((" ", "\t"))
            ):
                j += 1
            blocks.append(Block("list", "\n".join(lines[i:j])))
            i = j
        else:
            j = i + 1
            while j < len(lines) and lines[j].strip() and not _starts_block(lines[j]):
                j += 1
            blocks.append(Block("paragraph", " ".join(l.strip() for l in lines[i:j])))
            i = j
    return blocks


def build_sections(blocks: list[Block], doc_id: str) -> list[Section]:
    sections: list[Section] = []
    stack: list[tuple[int, str]] = []  # (level, title) of the open headings
    current = Section(f"{doc_id}#s0", [doc_id])
    for block in blocks:
        if block.kind == "heading":
            if current.blocks:
                sections.append(current)
            while stack and stack[-1][0] >= block.level:
                stack.pop()
            stack.append((block.level, block.text))
            path = [title for _, title in stack]
            current = Section(f"{doc_id}#s{len(sections) + 1}", path)
        else:
            current.blocks.append(block)
    if current.blocks:
        sections.append(current)
    return sections


def _group(units: list[str], budget: int, count: TokenCounter, prefix: str = "") -> list[str]:
    """Greedily packs units into groups under budget, repeating prefix in each group."""
    groups: list[str] = []
    current: list[str] = []
    for unit in units:
        candidate = "\n".join([prefix, *current, unit]).strip()
        if current and count(candidate) > budget:
            groups.append("\n".join([prefix, *current]).strip())
            current = []
        current.append(unit)
    if current:
        groups.append("\n".join([prefix, *current]).strip())
    return groups


def split_block(block: Block, budget: int, count: TokenCounter) -> list[str]:
    if count(block.text) <= budget:
        return [block.text]  # tables, lists and code stay intact when they fit
    lines = block.text.splitlines()
    if block.kind == "table":
        header = "\n".join(lines[:2])  # header row + separator, repeated in every piece
        return _group(lines[2:], budget, count, prefix=header)
    if block.kind == "list":
        items: list[str] = []
        for line in lines:
            if LIST_ITEM.match(line) or not items:
                items.append(line)
            else:
                items[-1] += "\n" + line
        return _group(items, budget, count)
    if block.kind == "code":
        fence, body = lines[0], lines[1:-1]
        return [f"{fence}\n{group}\n{FENCE}" for group in _group(body, budget, count)]
    sentences = re.split(r"(?<=[.!?])\s+", block.text)
    return [group.replace("\n", " ") for group in _group(sentences, budget, count)]


def chunk_document(
    markdown: str,
    doc_id: str,
    max_tokens: int = 200,
    count_tokens: TokenCounter = approx_tokens,
    metadata: dict[str, str] | None = None,
) -> tuple[list[Chunk], dict[str, Section]]:
    sections = build_sections(parse_blocks(markdown), doc_id)
    chunks: list[Chunk] = []
    for section in sections:
        header = f"{section.breadcrumb}\n\n"
        budget = max_tokens - count_tokens(header)
        units = [piece for block in section.blocks for piece in split_block(block, budget, count_tokens)]
        bodies: list[str] = []
        current: list[str] = []
        for unit in units:
            if current and count_tokens(header + "\n\n".join([*current, unit])) > max_tokens:
                bodies.append("\n\n".join(current))
                current = []
            current.append(unit)
        if current:
            bodies.append("\n\n".join(current))
        for n, body in enumerate(bodies):
            text = header + body
            chunks.append(
                Chunk(
                    chunk_id=f"{section.section_id}-c{n}",
                    parent_id=section.section_id,
                    heading_path=section.heading_path,
                    text=text,
                    token_count=count_tokens(text),
                    metadata={"doc_id": doc_id, "section": section.breadcrumb, **(metadata or {})},
                )
            )
    return chunks, {section.section_id: section for section in sections}


if __name__ == "__main__":
    chunks, parents = chunk_document(
        SAMPLE_POLICY,
        doc_id="travel-policy",
        max_tokens=120,
        metadata={"version": "3.2", "tenant": "acme"},
    )
    for chunk in chunks:
        print(f"--- {chunk.chunk_id} (parent {chunk.parent_id}, ~{chunk.token_count} tokens)")
        print(chunk.text, end="\n\n")
```

`build_sections` keeps a stack of open headings, so the path stays accurate as levels go up and down. `split_block` only fires when a block does not fit, and the table branch repeats the header and separator in every row group. `chunk_document` returns the chunks you embed plus the sections keyed by the same `parent_id` the chunks carry.

Run it and each section comes out as one chunk, with the table, the exception and the procedure intact. Then change `max_tokens` to 45 and run it again. Look at the per diem section: the table now splits into row groups, and every one of them still starts with the breadcrumb and the header row. The procedure splits by items, never in the middle of a step. At that size, though, the exception sits alone and step 4 lands in a chunk without steps 1 to 3, which is exactly the problem the parent lookup solves.

For production budgets, plug in a real tokenizer. The chunker does not care which one:

```python title="token_counter.py"
import tiktoken

from chunker import SAMPLE_POLICY, chunk_document

# Prefer the tokenizer of the model that will consume the chunk
encoding = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(encoding.encode(text))


chunks, parents = chunk_document(
    SAMPLE_POLICY, doc_id="travel-policy", max_tokens=120, count_tokens=count_tokens
)
for chunk in chunks:
    print(chunk.chunk_id, chunk.token_count)
```

Now the retrieval side. The `score` function is a keyword-overlap stand-in so the example runs without downloading a model; in a real system this is your vector or hybrid index. The parts that matter are the metadata filter and the parent deduplication.

```python title="retrieval.py"
import math
import re
from collections import Counter

from chunker import SAMPLE_POLICY, Chunk, Section, chunk_document

STOP_WORDS = {"a", "an", "the", "is", "are", "i", "do", "what", "for", "in", "of", "to", "my", "on", "how"}


def terms(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOP_WORDS]


def score(query: str, text: str) -> float:
    # Stand-in for your vector or hybrid index, so the example runs without a model
    counts = Counter(terms(text))
    return sum(1 + math.log(counts[t]) for t in set(terms(query)) if counts[t])


def search_children(
    query: str,
    chunks: list[Chunk],
    k: int = 4,
    filters: dict[str, str] | None = None,
) -> list[Chunk]:
    filters = filters or {}
    allowed = [c for c in chunks if all(c.metadata.get(key) == value for key, value in filters.items())]
    scored = [(score(query, c.text), c) for c in allowed]
    ranked = sorted((pair for pair in scored if pair[0] > 0), key=lambda pair: pair[0], reverse=True)
    return [chunk for _, chunk in ranked[:k]]


def small_to_big(
    query: str,
    chunks: list[Chunk],
    parents: dict[str, Section],
    k: int = 4,
    max_parents: int = 2,
    filters: dict[str, str] | None = None,
) -> list[Section]:
    parent_ids: list[str] = []
    for chunk in search_children(query, chunks, k=k, filters=filters):
        if chunk.parent_id not in parent_ids:  # dedupe, keep the rank of the best child
            parent_ids.append(chunk.parent_id)
    return [parents[pid] for pid in parent_ids[:max_parents]]


if __name__ == "__main__":
    # Small children for precise matching, whole sections for the model
    chunks, parents = chunk_document(
        SAMPLE_POLICY, doc_id="travel-policy", max_tokens=45, metadata={"tenant": "acme"}
    )
    for question in ["What is the per diem in Tokyo?", "What comes after director approval?"]:
        hits = search_children(question, chunks, filters={"tenant": "acme"})
        print(f"Q: {question}")
        print("   matched children:", [c.chunk_id for c in hits])
        for section in small_to_big(question, chunks, parents, filters={"tenant": "acme"}):
            print(f"\n[{section.section_id}]\n{section.text}\n")
```

Run it and compare the list of matched children with what gets printed. The first question matches several children of the per diem section, but only one parent comes back, containing the full table and the exception. The second question matches the steps around director approval, and the model receives the whole procedure, steps 1 to 5.

<div class="callout tip" data-title="Tip">
  <p>Do not embed parents. Store them in a document store or a plain table keyed by <code>parent_id</code> and fetch them after the search. Embedding only the children keeps the vectors sharp and the index small, and fetching parents by id is a cheap key lookup.</p>
</div>

## Production Reality Check

### Metadata and filtering

Every child should carry enough metadata to be filtered before ranking: `doc_id`, section path, document version, effective date, and the access fields your security model needs (tenant, group or ACL ids). Filtering after retrieval is a trap: if the top 10 are all documents the user cannot see, you drop them and return nothing useful. Push the filter into the index query.

<div class="callout warning" data-title="Warning">
  <p>Parent expansion is a second read path. If you apply ACL or tenant filters only to the child search and then fetch parents by id with no check, a bug in id generation or a shared section can leak content across tenants. Store the same access fields on parents and check them again on fetch.</p>
</div>

### Evaluate with questions that span structure

Generic questions will not show the difference. Build an evaluation set where the answer spans a table (header plus row), a procedure (several steps) or a rule plus its exception, and measure whether all the required facts reach the model. The same chunks usually feed both keyword and vector retrieval, so if you already run the setup from [Hybrid Search That Actually Works](/en-us/blog/hybrid-search-bm25-vectors-rrf/), you can reuse its recall@k harness and just swap the chunking strategy.

```python title="evaluate.py"
from chunker import SAMPLE_POLICY, Chunk, chunk_document
from retrieval import search_children, small_to_big


def fixed_size_chunks(text: str, size: int = 200, overlap: int = 40) -> list[Chunk]:
    """The naive baseline: character windows that ignore structure."""
    chunks = []
    for n, start in enumerate(range(0, len(text), size - overlap)):
        window = text[start : start + size]
        chunks.append(Chunk(f"fixed-{n}", f"fixed-{n}", [], window, len(window.split()), {}))
    return chunks


# Each question lists the facts that must ALL reach the model for a correct answer
EVAL_SET = {
    "What is the daily limit in Tokyo for a 45 day trip?": [
        "Daily limit (USD)", "| Tokyo | 90", "75% of the daily",
    ],
    "What is the lodging cap in New York?": ["Lodging cap (USD)", "| New York | 105 | 350"],
    "What are the steps before I book an international flight?": [
        "1. Check the entry", "3. Get written approval", "5. Book flights only after",
    ],
    "How long do I have to submit expenses?": ["within 15 days"],
}


def fact_recall(context: str, facts: list[str]) -> float:
    return sum(fact in context for fact in facts) / len(facts)


def evaluate(name: str, retrieve) -> None:
    scores = [fact_recall(retrieve(q), facts) for q, facts in EVAL_SET.items()]
    print(f"{name:<22} fact recall = {sum(scores) / len(scores):.2f}")


if __name__ == "__main__":
    k = 2
    fixed = fixed_size_chunks(SAMPLE_POLICY)
    children, parents = chunk_document(SAMPLE_POLICY, doc_id="travel-policy", max_tokens=45)

    evaluate("fixed-size windows", lambda q: "\n".join(c.text for c in search_children(q, fixed, k=k)))
    evaluate("structural children", lambda q: "\n".join(c.text for c in search_children(q, children, k=k)))
    evaluate("small-to-big parents", lambda q: "\n".join(s.text for s in small_to_big(q, children, parents, k=k)))
```

This compares three strategies on the same toy retriever: fixed-size character windows, structural children alone, and small-to-big parents. Look at which facts go missing for each. The fixed-size windows lose the table header or half of the procedure; structural children keep every table piece readable but can still bring back only some of the steps; the parents recover everything on this small set. On your corpus, repeat it with your real retriever and a few dozen questions written by people who know the documents.

### Failure modes to watch

- **Scanned PDFs.** No text layer means no text, or OCR output with broken reading order and tables flattened into word soup. Detect them at ingestion (images, almost no extractable text) and route them through OCR with layout analysis.
- **Repeated headers and footers.** "Confidential, page 3 of 40" on every page ends up in every chunk and makes unrelated chunks look similar. Strip lines that repeat across most pages before chunking.
- **Huge sections.** A 30-page section with no subheadings becomes a giant parent. Cap parent size, fall back to returning the matched child plus its neighbors, or split on paragraph structure inside the section.
- **Documents with no headings.** Some exports use bold lines instead of real headings. Promote obvious heading patterns during conversion, and fall back to sentence splitting with modest overlap when there is no structure at all.
- **Near-duplicate versions.** Travel Policy v3.1 and v3.2 are 95% identical, so both get retrieved and the model may quote the old rule. Store version and effective date, index only the current version by default, and deduplicate by content hash so unchanged sections are not embedded twice.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>OK, so what is the perfect chunk size? 256? 512?</span>
    </div>
  </div>
</div>

There isn't one, and that is the point of the design. With structure-aware boundaries and parent retrieval, the child size only controls matching precision, and the parent controls how much the model reads. Start with children of a few hundred tokens and leaf sections as parents, then let the evaluation set move the numbers. Chunking will never be the exciting part of your RAG system, but it decides what the model is allowed to know, and a chunker that respects tables, procedures and exceptions fixes a whole class of confidently wrong answers before any prompt engineering starts.
