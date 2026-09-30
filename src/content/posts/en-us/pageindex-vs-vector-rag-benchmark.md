---
title: "Vectorless RAG, Measured: PageIndex vs Vector RAG on FinanceBench"
description: "PageIndex swaps the vector database for a document tree and an LLM agent that navigates it. I benchmarked it against two vector RAG pipelines on FinanceBench: better answers, 40 times the cost."
date: 2026-09-30
tags: [RAG, LLMs, Evaluation, Python]
tldr:
  - "On 46 FinanceBench questions over 11 filings, with the same answer model (gpt-4.1) for every system, PageIndex answered 87.0% correctly, against 80.4% for dense vector RAG and 78.3% for hybrid RAG with a reranker. It never missed a question the RAG pipelines got right, but with 46 questions the gap is not statistically significant."
  - "It cost 40 times more per question ($0.33 against $0.008) and read 50 times more tokens (165k against 3.3k), because the agent resends the document tree on every turn. Indexing was cheap: about $2 for 2,690 pages."
  - "Vectorless is not retrieval-less: PageIndex read the gold evidence page less often (63%) than hybrid RAG (78%). Its edge is navigation to the right table, the cover page, the balance sheet, where similarity search finds text that talks about the answer instead of the answer."
---

On FinanceBench, a benchmark of questions about real SEC filings, the README of PageIndex shows a bar chart: 98.7% accuracy for PageIndex, about 50% for vector RAG. PageIndex calls itself "vectorless RAG": no embeddings, no chunks, no vector database, just a tree of the document and an LLM that reasons its way through it, the way an analyst flips to the right section of a 10-K. The repository sits on GitHub's trending lists, and the question every team with a vector database is asking is the obvious one: should we throw ours away?

I didn't want to answer that from a bar chart. So I built a benchmark where PageIndex and two vector RAG pipelines, one naive and one tuned, answer the same FinanceBench questions from the same page text with the same model, and I measured accuracy, whether each system actually read the page the answer is on, tokens, cost and time. The code, the trees, every answer and every verdict are public. This post is what came out, including the parts that surprised me.

## The Problem & Context

### What vector RAG does to a 10-K

A 10-K is the worst case for chunk-and-embed retrieval, and it is worth being precise about why. The retriever cuts the filing into chunks of a few hundred words, embeds each one, embeds the question, and hands the model the chunks whose vectors sit closest to the question's. That pipeline makes three bets, and a financial filing breaks all three.

The first bet is that the answer looks like the question. "What is the FY2018 capital expenditure amount for 3M?" is answered by a row in the cash flow statement that reads "Purchases of property, plant and equipment (PP&E) (1,577)". The words "capital expenditure" appear nowhere in that row. Similarity search finds the paragraphs that *talk about* capital spending, the MD&A commentary and the outlook, and those paragraphs are similar to the question and useless for answering it. The PageIndex README puts it in four words: similarity is not relevance.

The second bet is that a chunk carries its own context. A table row cut out of a balance sheet has lost its header, its column years and the "in millions" in the corner. The chunk says "(1,577) (1,373) (1,420)" and nothing tells the model which number belongs to which year.

The third bet is that the answer lives in one place. Filings are full of cross-references: "see Note 12", "as described in Item 7". A human analyst follows them. A top-k retriever can't: it gets one shot, with the question's wording, and whatever the first retrieval missed is gone.

None of this is new. The [FinanceBench paper](https://arxiv.org/abs/2311.11944) (Islam et al., 2023) built 10,231 questions over public filings, graded 16 configurations by hand on a 150-question sample, and reported that GPT-4-Turbo with a retrieval system answered incorrectly or refused 81% of the questions. The usual answers are better chunking ([parent-child chunks](/en-us/blog/chunking-enterprise-documents/)), [hybrid search with a reranker](/en-us/blog/hybrid-search-bm25-vectors-rrf/), metadata filters. They all keep the same shape: pick chunks by similarity, once.

### What PageIndex does instead

[PageIndex](https://github.com/VectifyAI/PageIndex), from Vectify AI, throws the shape away. There are no chunks, no embeddings and no vector database. It builds a **tree** of the document, the table of contents a human would want, where every node has a title, the page range it covers and a short summary, and at query time it gives an LLM agent two tools: one that returns the tree, one that returns the text of a page range. The agent reads the outline, decides which section should hold the answer, reads those pages, and decides whether it has enough or should look elsewhere. The authors say the idea comes from AlphaGo (tree search guided by a model's judgment); the plainer description is that it reads a filing the way an analyst does, from the table of contents inward.

<div id="pageindex-vs-rag-pipelines-slot"></div>

The claim is strong. The PageIndex README reports that Mafin 2.5, Vectify's financial QA product built on PageIndex, reached **98.7% accuracy on FinanceBench**, against a vector RAG baseline around 50%.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>98.7% against 50%? Then vector databases are dead. I'll delete our Qdrant cluster on Monday.</span>
    </div>
  </div>
</div>

Read what the number measures before you delete anything. The 98.7% belongs to [Mafin 2.5](https://github.com/VectifyAI/Mafin2.5-FinanceBench), a product: a financial QA system built on PageIndex, running on GPT-4o and DeepSeek-V3, with every document in one database, and graded with expert human annotations for questions the authors judged ambiguous or invalid. It says that a well-engineered system on frontier models can nearly solve FinanceBench. It does not say what you get from `pip install pageindex` with the model you can afford, and it compares against a baseline whose configuration you can't inspect. That gap is the reason for this post.

## Deep Dive / Architectural Design

Everything below comes from reading the SDK's source (`pageindex` 0.2.20 on PyPI), not from the marketing page, because the details decide where it wins and where it breaks.

### Building the tree

Indexing in local mode happens in three passes, and only two of them use an LLM.

**1. The outline, from layout alone.** The default indexer is PageIndex Flash. It parses the PDF at the character level with pdfium and finds headings statistically: font size and weight compared with the body text, numbering patterns ("Note 12.", "Item 7A"), repeated headers and footers to ignore, table-of-contents boilerplate. If the PDF has embedded bookmarks that look trustworthy, it uses them. No model is involved, so this pass takes seconds even for a 500-page filing. Each node gets a title, a start page and an end page, and every page belongs to some node: whatever comes before the first detected heading becomes a "Preface".

**2. Optimization, priced in pages.** The raw outline is rarely the tree you want to navigate. The optimizer measures a node by the worst number of pages an agent would have to scan to find something inside it. A node is *expanded* when routing through proposed children would be cheaper than scanning the node whole: the model receives the node's pages (up to 6,000 characters each) and proposes subsections, and a proposal only counts if its heading is actually printed on the page it claims. A subtree is *merged* back into its parent when routing through it costs more than just reading it; the merged titles survive on the parent as `key_items`, so the words still help routing. Merge is deterministic. Expand needs the index model, and on a big node it sends a big prompt: on one 10-K, a single expand call needed 120k tokens.

**3. Summaries.** Every node gets a summary of at most 150 words, written by the index model. Short leaves (under 200 tokens) keep their own text instead, and a parent is summarized from its children's summaries plus up to three of its own intro pages.

The README says a basic model is enough for indexing, and the numbers agree: I indexed all 18 filings, 2,690 pages, with `gpt-5.6-luna` for about $2 (2,586 calls to the model, 4.6 million tokens in), under $0.001 per page, in line with the README's own figure.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So the index is just a table of contents with summaries. What's so hard about that? Every 10-K has one on page 2.</span>
    </div>
  </div>
</div>

It does, and that is exactly the trap. The printed table of contents is text, not structure: "Note 5. Restructuring Actions 64" is a line of characters with a number at the end, and the number is the printed page label, not the PDF page. Flash doesn't read it at all; it looks at how headings are *drawn*. SEC filings printed from EDGAR HTML often draw section headings in the same font, size and weight as the body text, while the exhibits at the back (award agreements, plan documents) have big bold "ARTICLE I" headings. On those filings the layout detector sees the exhibits clearly and the 10-K itself barely at all, and everything then rests on the optimizer's LLM to recover the structure. Keep this in mind; it shows up in the results.

### Retrieving: an agent with two tools

At query time there is no retrieval step in the usual sense. The SDK runs an agent (on the OpenAI Agents SDK, with any LiteLLM model) whose instructions and tools mirror PageIndex's cloud MCP server:

- `get_document_structure(doc_name, part)` returns the tree: titles, node ids, start pages, summaries. It is paginated, because a tool response is capped at 100,000 characters.
- `get_page_content(doc_name, pages)` returns the text of a page spec like `"5-7,12"`, with the instruction to keep ranges tight.

The workflow rule is simple: for documents over 20 pages, read the structure first, then pull targeted pages. The model does the rest.

<div id="pageindex-agent-loop-slot"></div>

Two consequences follow before any benchmark runs. First, every question pays for reading the tree: on a 250-page 10-K with a few hundred nodes, the structure alone is tens of thousands of tokens, sent again on every turn of the loop. Vector RAG pays for eight chunks. Second, retrieval quality is now the chat model's reasoning quality, which is why the README says to use "the best model you can afford" for chat. A weak model that picks the wrong section doesn't get a second, independent chance the way a retriever plus reranker does: it gets another turn of the same judgment.

## Hands-On Implementation

The benchmark is public: [gabe-santana/pageindex-vs-rag-benchmark](https://github.com/gabe-santana/pageindex-vs-rag-benchmark). It is small on purpose, a few hundred lines of Python, so you can read every decision. Here are the ones that matter.

### The data and the controls

FinanceBench's open-source set has 150 questions over 84 filings. I picked the 18 filings with at least three questions each (70 questions, 2,690 pages, from a 9-page earnings release to PepsiCo's 503-page 10-K) and indexed all of them with both systems. The run had a hard budget of $20 on Azure AI Foundry, and PageIndex spent it faster than I estimated, so the answering stopped after **46 questions over 11 filings** (1,797 pages, from 3M to Johnson & Johnson in alphabetical order). All three systems answered exactly those 46. Most of them are the analyst kind: "What drove operating margin change?", "Is 3M capital-intensive?", "Has the quick ratio improved?" (33 domain questions, 12 novel ones and a single pure metric extraction), and many need a calculation.

<div id="pageindex-benchmark-harness-slot"></div>

A benchmark like this is only worth something if the systems differ in one thing. So:

- **Same page text.** PageIndex stores each page's text as extracted by PyPDF2. The RAG pipelines chunk exactly that text (`LocalAPI._extract_page_texts`), so nobody wins on a better PDF parser.
- **Same answer model, same instructions.** Every system answers with `gpt-4.1` and the same analyst instructions (show the inputs, round as asked, end with "Final answer:"), passed to PageIndex through its `instructions=` argument, which appends them to the SDK's own agent prompt.
- **Same scope.** Each question is asked against its own filing. The RAG searches only that document's chunks; PageIndex gets the document's id. FinanceBench's harder "shared store" setting, all filings in one index, is a different experiment.
- **Indexing as recommended.** PageIndex builds its trees with `gpt-5.6-luna`, the basic model its README recommends for that job. The RAG embeds with `text-embedding-3-large`.

### Two vector RAG baselines, not one

Comparing against a naive RAG proves little, so there are two:

| | Chunks | Retrieval | Context |
|---|---|---|---|
| `rag-dense` | 300 words, 50 overlap, never across a page | cosine top 8 | 8 chunks |
| `rag-hybrid` | same | dense top 40 + BM25 top 40, [reciprocal rank fusion](/en-us/blog/hybrid-search-bm25-vectors-rrf/), cross-encoder rerank (Qwen3-Reranker-0.6B) | 8 chunks |

Chunks never cross a page boundary, so every chunk has exactly one page number, and each chunk is embedded with the filing's name and page in front ("PEPSICO_2022_10K, page 61: ..."), so a bare table row still says which company it belongs to.

```python title="bench/rag.py"
def chunk_pages(pages: list[str]) -> list[Chunk]:
    """Word windows that never cross a page, so every chunk has one page."""
    out = []
    step = CHUNK_WORDS - CHUNK_OVERLAP_WORDS
    for number, text in enumerate(pages, start=1):
        words = text.split()
        if not words:
            continue
        for start in range(0, max(len(words) - CHUNK_OVERLAP_WORDS, 1), step):
            out.append(Chunk(number, " ".join(words[start:start + CHUNK_WORDS])))
    return out
```

The hybrid retriever is the one from the hybrid search post, scoped to one document:

```python title="bench/rag.py"
def retrieve(self, query: str, mode: str) -> list[int]:
    if mode == "dense":
        return self.dense(query, TOP_K)
    # Reciprocal rank fusion of both lists, then a cross-encoder decides.
    fused: dict[int, float] = {}
    for ranking in (self.dense(query, CANDIDATES),
                    self.lexical(query, CANDIDATES)):
        for rank, i in enumerate(ranking):
            fused[i] = fused.get(i, 0.0) + 1.0 / (60 + rank)
    pool = sorted(fused, key=fused.get, reverse=True)[:CANDIDATES]
    scores = rerank(query, [self.chunks[i].text for i in pool])
    order = sorted(range(len(pool)), key=lambda j: scores[j], reverse=True)
    return [pool[j] for j in order[:TOP_K]]
```

### Watching PageIndex work

PageIndex runs through its own SDK, untouched. What the harness adds is visibility: `client.chat(..., stream=True).events` yields every tool call with its arguments, so the runner records which pages the agent asked for.

```python title="bench/run.py"
stream = client.chat(q.question, doc_id=did, stream=True, max_turns=20)
for ev in stream.events:
    if ev["type"] == "answer":
        answer.append(ev["delta"])
    elif ev["type"] == "tool_call":
        args = ev.get("arguments")
        trace.append({"tool": ev["name"], "arguments": args})
        if ev["name"] == "get_page_content" and isinstance(args, dict):
            pages.update(expand_pages(args.get("pages", "")))
```

That enables the metric I trust most in this benchmark. FinanceBench records the page every piece of evidence came from, so for every answer I can ask a question no judge can blur: **did the system read the gold evidence page at all?** For the RAG pipelines, "read" means one of the eight chunks came from that page; for PageIndex, that the agent fetched it with `get_page_content`. A system can still answer correctly without it (the same figure often appears in the MD&A and in the statements) or read it and still answer wrong, but across dozens of questions the rate says a lot about retrieval.

### Grading

Answers are graded against FinanceBench's gold answer by an LLM judge (`gpt-5.6-luna`, a different model from the one that wrote the answers), with a 1% tolerance on numbers and explicit rules for units and signs. The judge never sees which system wrote the answer. Every verdict was then reviewed one by one against the gold answer and the filing, and 6 of the 138 were corrected; the reviewed verdicts are in the repo next to the judge's, each with a note. With [LLM judges](/en-us/blog/llm-as-judge-calibration/), the review is not optional: on FinanceBench, many gold answers are sentences ("No, the company is managing its CAPEX...") and a judge has to decide whether "3M is capital-intensive" contradicts them.

## The Results

### The headline table

| | PageIndex | rag-dense | rag-hybrid |
|---|---|---|---|
| **Correct answers** | **40 / 46 (87.0%)** | 37 / 46 (80.4%) | 36 / 46 (78.3%) |
| Said "not in the document" | 0 | 2 | 3 |
| Read the gold evidence page | 63.0% | 71.7% | **78.3%** |
| Distinct pages read per question | 7.3 | 6.4 | 7.3 |
| LLM calls per question | 5.5 | 1 | 1 |
| Input tokens per question (mean) | 165,476 | 3,299 | 3,400 |
| Cost per question (mean) | $0.334 | $0.008 | $0.006 |
| Median latency | 11.4 s | 2.7 s | (see below) |

All three systems answered with `gpt-4.1` at list prices ($2 per million input tokens, $8 per million output). The hybrid pipeline's latency is not comparable: its reranker ran on my laptop's GPU, eight requests at a time, and the queue dominated. A hosted reranker adds a few hundred milliseconds.

PageIndex wins on accuracy, by three and four questions. That is the honest size of it, so two more facts belong next to the percentages:

- **It never lost a question the others won.** Against dense RAG, PageIndex was right and RAG wrong on 3 questions, and the reverse happened 0 times. Against hybrid, 4 and 0.
- **With 46 questions, that is not statistically significant.** An exact McNemar test on those disagreements gives p = 0.25 against dense and p = 0.125 against hybrid. A consistent direction, not a proof. And it is nothing like the 98.7% against 50% in the README: in a fair fight, with the same model and the same text, the gap is single digits.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Wait. PageIndex read the right page less often than hybrid RAG, and still got more answers right? That makes no sense.</span>
    </div>
  </div>
</div>

It makes sense once you look at what "the right page" means in a 10-K. The same fact is printed in several places: a figure from the income statement shows up again in the MD&A, a segment's growth in the segment note and in the earnings discussion. FinanceBench's annotators recorded one of them. PageIndex answered correctly 13 times without touching the recorded page, because it navigated to another place that says the same thing; hybrid RAG did that only 4 times. The page metric measures one path to the answer, and PageIndex takes other paths. Hybrid RAG is the best *retriever* in this benchmark by that metric, and it still converts retrieval into answers less well: it read the gold page and answered wrong 4 times, and 3 times it said the document didn't have the answer.

### Where PageIndex won

The questions PageIndex got right and at least one RAG pipeline got wrong are the most instructive rows of the run, and they have something in common.

- **"Which debt securities are registered to trade on a national securities exchange under 3M's name?"** The answer is a small table on the 10-Q's cover page: three note series with their trading symbols. Dense RAG said the document didn't contain it. The cover page doesn't *sound like* the question; it's a grid of legal boilerplate. The agent, reading the tree, went to the cover.
- **The same question for American Express.** The answer is "none", which is harder: you have to find the cover page and notice what's missing. Dense RAG said the information wasn't in the document, which is a different claim from "there are none".
- **"Has Amcor's quick ratio improved or declined between FY2023 and FY2022?"** Both RAG pipelines said "declined". The gold is 0.67 to 0.69, improved. The quick ratio needs four lines of the balance sheet for two years. The chunks that look most like "quick ratio" are liquidity commentary, not the balance sheet; PageIndex read the balance sheet.
- **"What was the largest liability in American Express's balance sheet?"** Hybrid RAG said it couldn't tell. PageIndex opened the balance sheet: customer deposits, $110,239 million.

This is the "similarity is not relevance" argument, observed rather than asserted. When the answer lives in a structured place (a cover page, a statement, a table), the text most *similar* to the question is prose that talks about the answer, and the answer itself doesn't look like anything. An agent that knows where balance sheets live in a 10-K doesn't need the answer to look like the question.

### Where everybody lost

Six questions defeated all three systems, and retrieval isn't the story for most of them:

- Boeing's gross margin (it improved, 4.8% to 5.3%) and AES's inventory turnover (9.5 times): all three systems decided the metric "is not meaningful" for an aerospace company or a utility and refused to compute it. The question invites that escape ("if gross margin is not a useful metric, then state that"), and the model took it. Same model, same mistake, three times.
- Best Buy's best product category in the quarter: all three said Computing and Mobile Phones, while the gold answer is Entertainment, the category that grew the most (9%). That is a disagreement about what "performed the best" means, not about finding a page.
- 3M's quick ratio: PageIndex and hybrid RAG both computed 0.85 against a gold answer of 0.96, a disagreement about which current assets count.

When the model is the bottleneck, better retrieval doesn't help: all three pipelines inherit the same judgment.

### The tree was worse than it looked, and it didn't matter much

Remember the warning about layout. After indexing, I measured for every filing how much of it the tree actually describes: a page is "blind" when the smallest node covering it spans more than 20 pages or has no summary, so the agent can't tell what is on it without reading it. Across all 2,690 pages, 11.7% were blind. Most trees were excellent, under 3% blind. Two were not: **Boeing's 10-K was 51% blind and American Express's 50%**, and 11 of their 13 gold evidence pages sat in those blind regions. Boeing's tree starts with a node titled "DOCUMENTS INCORPORATED BY REFERENCE" that swallows most of the 10-K, while the executive savings plan in the exhibits got a neat, detailed outline.

And PageIndex still answered 13 of the 14 Boeing and American Express questions correctly (dense RAG: 12, hybrid: 11). A capable chat model navigates a bad tree the way you navigate a badly organized report: it reads the one coarse summary, guesses page ranges, reads, and corrects course. That resilience is real, and it is paid for in turns. The most expensive question of the run, AMD's quick ratio, took 17 model calls and 791,423 input tokens: $1.59 for one answer (a correct one).

<div class="callout warning" data-title="Warning">
  <p>The index model needs a long context. The optimizer's expand step sends a whole node's pages in one prompt, 120k tokens for a 131-page node in my run. My first attempt ran locally on llama.cpp with a 16k context per slot: those calls failed, PageIndex absorbed the errors silently and kept the node whole, and 3M's 10-K came out 75% blind. With a large-context model, the same filing was 2.8% blind. If you index with a small local model, check the trees before you trust them.</p>
</div>

## Production Reality Check

### The bill is per question, not per document

Indexing is where vector RAG usually costs you, and PageIndex's indexing was cheap: about $2 for 2,690 pages with a basic model, done once. The expensive part moved to query time. Every PageIndex question sends the tree (for a big 10-K, tens of thousands of tokens) and sends it again on each of the agent's turns, together with every page read so far. The median question sent 76,691 input tokens; the mean was 165,476, pulled up by a few long searches. At `gpt-4.1` list prices that is $334 per thousand questions, against $8 for vector RAG.

Prompt caching softens it: the tree is a stable prefix, and providers discount cached input heavily (for `gpt-4.1`, cached input costs a quarter of the normal price). I report list prices because that is the worst case you budget for. Either way, the number that decides the architecture is questions per day, not documents.

### Latency is a product decision

11.4 seconds median against 2.7 seconds, with a tail up to a minute (the slowest question took 20 model calls and 59 seconds). For an analyst tool where one good answer replaces twenty minutes of reading a filing, 11 seconds is nothing. For a chat widget answering support questions, it is a different product. PageIndex's latency is also less predictable: RAG does one retrieval and one call every time, the agent does as many turns as it decides it needs.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So the vector database lives. Should I just ignore PageIndex, then?</span>
    </div>
  </div>
</div>

No. Use each where its cost model fits:

- **Long, structured, high-stakes documents, few questions:** filings, contracts, regulations, manuals. Here PageIndex's navigation earns its tokens, and the traceability (the agent's trace says which pages it read) is worth something on its own when an auditor asks.
- **Large corpora, many questions, short answers:** support bases, wikis, tickets. Vector or hybrid search is 40 times cheaper per question and faster. For many documents, PageIndex's own answer is a separate, cloud-only file-level tree, not the SDK I tested.
- **Both:** nothing stops a router from sending "find the paragraph about X" questions to hybrid search and "compute the quick ratio from the balance sheet" questions to a tree agent. The failure analysis above is, in effect, the routing rule: questions whose answer lives in a statement, a table or a cover page go to the tree.

### What this benchmark does not show

- **The sample is small.** 46 questions over 11 filings, mostly analyst-style questions and a single pure metric extraction. The budget stopped the run there, and the remaining 24 questions (including the 503-page PepsiCo 10-K) were never answered. The direction is consistent; the magnitude is uncertain.
- **One model.** Every answer came from `gpt-4.1`. The README says the chat model matters most for PageIndex, and a weaker model would likely hurt it more than it hurts RAG, whose reasoning job is smaller.
- **One document at a time.** Each question was scoped to its filing. The harder setting, where the system first has to find the right filing among dozens, changes both sides.
- **The judge is a model.** Verdicts were reviewed one by one and six were changed, all listed with reasons in the repository. Grading is still the softest part of any benchmark like this, which is why the page metric sits next to it.

## Conclusion

Vectorless RAG is not a gimmick. On real SEC filings, with everything held equal except retrieval, an LLM navigating a document tree answered more questions correctly than a tuned hybrid search with a reranker, and it won exactly where you'd predict: when the answer lives in a statement, a table or a cover page that doesn't look like the question. It also survived bad trees better than I expected.

It is also not free, and not what the headline chart suggests. The gap was single digits, not 98.7% against 50%, and it cost 40 times more per question, because the retrieval step is now an LLM reading a table of contents on every turn. The useful way to think about PageIndex is not "vectors are dead" but "retrieval can be reasoning, and reasoning is billed by the token". Measure your own documents, count your own questions per day, and read your trees before you trust them.

<div class="callout tip" data-title="Tip">
  <p>Everything is reproducible: <a href="https://github.com/gabe-santana/pageindex-vs-rag-benchmark">gabe-santana/pageindex-vs-rag-benchmark</a> has the harness, the 18 PageIndex trees, every answer with its tool trace, the judge's verdicts and the reviewed ones. It runs against any OpenAI-compatible endpoint, including a local llama.cpp server, if you have the patience.</p>
</div>
