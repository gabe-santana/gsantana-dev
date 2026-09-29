---
title: "Context Engineering for Long-Running Agents: Budgets, Clearing, Compaction and Memory"
description: "Why a huge context window doesn't save a long agent session, and a working Python context manager that keeps it small, cheap and on task."
date: 2026-08-09
tags: [AI Agents, Context Engineering, Python, LLM]
tldr:
  - "Every turn resends the whole history, so input grows with the square of the session length, and models get measurably worse as the context fills with stale tokens."
  - "Manage context per turn, cheapest move first: clear stale tool results but keep the call, compact old turns into a structured summary, and keep decisions in a notes file the agent owns."
  - "In a simulated 60-turn coding session, the managed context used 4.6x fewer input tokens, peaked under 37k instead of passing 200k, and kept every planted fact; batch the edits so the prompt cache survives."
---

Picture a coding agent forty minutes into a billing bug. At turn 52 it reads `money.py` again, a file it has already read three times, and proposes rounding each line item before summing. That's the exact approach it tried and reverted at turn 12, with a failing test to prove it wrong. Nothing was truncated. Every file read, every 3,000-token pytest log and the decision itself are still in the context window. That's the problem: the one line that matters is buried under 180,000 tokens of tool output that no longer does.

The easy answer is a bigger window, and 2026 has plenty of models that take a million tokens. It doesn't fix this. It makes every turn slower and more expensive, and the research consistently shows models using long, noisy contexts worse than short, focused ones. This post covers managing an agent's context on purpose: a budget per turn, clearing stale tool results, compaction that keeps what matters, a notes file the agent owns and a cache-friendly prompt layout. Then a working Python context manager, run against a simulated 60-turn coding session, with real numbers. The Naive Junior has opinions about the million tokens.

## The Problem & Context

An agent loop sends the conversation, gets a tool call, runs the tool, appends the result and repeats. Every request carries the entire history, so a session costs the sum of every prefix: if each turn adds a similar amount, total input grows with the square of the number of turns. In the simulation below, a 60-turn session ends with a 213k-token context, but its requests add up to 5.86 million input tokens. You pay for the first file read sixty times. Prompt caching softens that while the cache is warm, but a miss on a 150k-token prefix means prefilling all of it again before the first output token.

The second cost is quality, the one people underestimate:

- [Lost in the Middle](https://arxiv.org/abs/2307.03172) (Liu et al., 2023) found performance "is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle of long contexts". An agent's key decision from turn 8 ends up exactly there.
- [RULER](https://arxiv.org/abs/2404.06654) (Hsieh et al., NVIDIA) tested 17 models that all claimed 32K tokens or more; only half kept satisfactory performance at 32K.
- [NoLiMa](https://arxiv.org/abs/2502.05167) (Modarressi et al., ICML 2025) removed the literal word overlap that makes needle tests easy. At 32K, 11 of 13 models fell below half of their short-context scores; GPT-4o went from 99.3% to 69.7%.
- Chroma's [Context Rot](https://www.trychroma.com/research/context-rot) study (July 2025) ran 18 models, including Claude 4, GPT-4.1, Gemini 2.5 and Qwen3, on tasks of constant difficulty and still saw performance fall as input grew. On LongMemEval, every model did significantly better with a focused input of about 300 tokens than with the full 113k-token input containing the same answer.

Anthropic's [guide to context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) calls it an attention budget: n tokens mean n² pairwise relationships, and noise dilutes signal. In a coding agent the noise has an obvious source. In my simulated session, tool results add 207,833 tokens over 60 turns while the agent's own messages add 9,432, and most results go stale a few turns after they arrive.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>The model supports a million tokens. We're at 200k. Why manage anything? Just use the window we're paying for.</span>
    </div>
  </div>
</div>

The window is a limit, not a target. The model will read, bill and attend over every token you send, and the studies above show attention degrading long before the limit. A huge window is great when a task needs a long document in view at once. An agent session is mostly old copies of things the agent could fetch again with one tool call, and they cost money and latency on every turn and accuracy on the turns that matter.

## Deep Dive / Architectural Design

Treat the context as a working set, not a transcript. The transcript can live in a log. The working set is what the model needs for its next good step, and it has a layout:

<div id="ctx-eng-window-anatomy-slot"></div>

### A budget per turn, not a limit per model

Size the working set from the task, not from the model's maximum. For a coding agent I start around 30k tokens: the system prompt, a few files, a test log and room for the next result. Above that **trigger** the manager runs its policies, cheapest first, since each loses more than the last; if clearing leaves the context above a lower **compaction threshold**, it compacts. The model's real window stays as a hard ceiling that raises an error instead of letting the provider truncate for you.

<div id="ctx-eng-policy-loop-slot"></div>

### Clear tool results: keep the call, drop the payload

Tool results are the biggest and fastest-rotting part of the history. Clearing replaces the payload of old results with a short stub and keeps the call, so the model still knows it ran `read_file(src/billing/tax.py)` at turn 42 and can run it again. Anthropic calls tool result clearing one of the safest, lightest-touch forms of compaction; their API's [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) does it server-side. Three details matter. Keep the newest few results intact, since the model is reasoning about them right now. Keep the one line you'd regret losing: my stub keeps the first error of a 3,000-token test log, the same idea the Manus team calls [restorable compression](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) (drop a page's content, keep its URL). And clear in batches, because editing a message invalidates the prompt cache from that point on; the manager only clears when it frees at least 10k tokens.

### Compaction: summarize, but decide what survives

Clearing slows growth, but every turn still leaves a call, a stub and some reasoning. Eventually old turns have to go: compaction replaces them with a summary and keeps the most recent messages word for word. A generic "summarize this conversation" prompt produces a pleasant paragraph that loses exactly what a coding agent needs. Anthropic says Claude Code's compaction keeps "architectural decisions, unresolved bugs, and implementation details". My list: the task verbatim and every instruction the user added later, decisions with their reasons (the turn 52 bug), open TODOs, exact error messages so failed approaches aren't retried, and every file path touched with the last thing done to it. Tool payloads and passing test lines can go.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Simpler plan: every 10 turns, ask the model to summarize everything and start over from the summary.</span>
    </div>
  </div>
</div>

That runs the most expensive, most lossy policy on a schedule, needed or not. Each summary is an extra model call over the whole history, it rewrites the entire cached prefix, and every summary of a summary drifts further from what happened: after three rounds, "round once at the total with ROUND_HALF_EVEN" becomes "we discussed rounding". Summarize only when clearing isn't enough, keep recent turns verbatim, and make the summary structured so the next compaction carries it forward instead of paraphrasing it.

### A notes file the agent owns

A summary is written about the agent; a notes file is written by the agent, and it survives every compaction because it isn't in the history. Give the agent tools to write, rewrite and read it, and a line in the system prompt saying to record what it must not forget. Anthropic's [memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) gives Claude a directory of files it can create, read, update and delete across conversations; Manus keeps a `todo.md` it rewrites as it works, which also recites the plan into the freshest part of the context. Cap the file's size or it becomes a second history, and copy it into the summary at compaction so the agent sees its notes right when the old turns disappear.

### Just-in-time retrieval and sub-agents

The cheapest token is the one you never load. Front-loading a repo map, every related file and the ticket history puts tokens in the prefix for the whole session, most never used. Give the agent paths and search tools and let it pull content when needed; that's also what makes clearing safe. For subtasks that read a lot to answer a little ("which callers of `quantize` touch invoice totals?"), use a sub-agent with a fresh context. Anthropic describes sub-agents that explore with tens of thousands of tokens and return a 1,000 to 2,000 token summary. It isn't free (their [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) used about 15 times the tokens of a chat), but the parent stays clean. Coordination is covered in [Multi-Agent Orchestration](/en-us/blog/multi-agent-orchestration/).

### Keep the stable prefix cache-friendly

Caching works on exact prefixes. Anthropic's cache covers tools, then system, then messages, and [cache reads cost 0.1x the base input price while five-minute writes cost 1.25x](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) on most models; OpenAI [caches automatically](https://developers.openai.com/api/docs/guides/prompt-caching) from 1,024 tokens, also on exact prefixes. Manus calls KV-cache hit rate the most important metric for a production agent, with inputs outnumbering outputs about 100 to 1. So: nothing volatile at the top (no timestamps or request ids in the system prompt), tool definitions that never change mid-session, deterministic serialization, and edits that are rare, batched and worth the rewrite.

## Hands-On Implementation

Here's all of it in plain Python: a token counter, a context manager with both policies, an offline summarizer, a notes file, and a simulation that replays one scripted 60-turn session twice, naive and managed. I ran it on Python 3.14 with tiktoken 0.14.0.

```bash title="terminal"
python -m venv .venv && . .venv/bin/activate
pip install tiktoken pytest
```

### Counting tokens

tiktoken is fast and close enough for budgets, with the caveat in the docstring: for Claude or Gemini its counts are estimates.

```python title="ctxkit/tokens.py"
"""Token counting for context budgets.

Uses tiktoken's o200k_base encoding when it is installed. That is an OpenAI
tokenizer, not Claude's or Gemini's, so the counts are estimates: good for
budgets and trends, not for reconciling an invoice (use the provider's
token counting endpoint for that). Without tiktoken it falls back to
len(text) / 4, the usual rule of thumb for English prose and code.
"""

from __future__ import annotations

from functools import lru_cache

# Role markers and framing the chat format adds around every message.
# Approximate: providers don't document it and it varies by model.
MESSAGE_OVERHEAD = 4

try:
    import tiktoken

    _encoding = tiktoken.get_encoding("o200k_base")
    BACKEND = "tiktoken o200k_base"

    def _count(text: str) -> int:
        return len(_encoding.encode(text, disallowed_special=()))

except ImportError:
    BACKEND = "chars / 4"

    def _count(text: str) -> int:
        return max(1, len(text) // 4)


@lru_cache(maxsize=8192)
def count_tokens(text: str) -> int:
    return _count(text)
```

### The context manager

Messages are immutable and hashed (the simulation uses the hash to model the prompt cache). `prepare()` runs before every request and applies the policies in order.

```python title="ctxkit/context.py"
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field, replace
from typing import Callable, Literal, Protocol

from ctxkit.tokens import MESSAGE_OVERHEAD, count_tokens

Role = Literal["system", "user", "assistant", "tool", "summary"]

ERROR_LINE = re.compile(r"\b([A-Z]\w*(?:Error|Exception)): ([^\n\]]+)")


@dataclass(frozen=True)
class Message:
    role: Role
    content: str
    turn: int = 0
    tool: str | None = None  # tool results: which tool produced them
    args: str | None = None  # and with which arguments, kept after clearing
    cleared: bool = False

    @property
    def tokens(self) -> int:
        return count_tokens(self.content) + MESSAGE_OVERHEAD

    @property
    def key(self) -> str:
        return hashlib.sha256(f"{self.role}\0{self.content}".encode()).hexdigest()


class Summarizer(Protocol):
    def summarize(self, messages: list[Message], notes: str) -> str: ...


class ContextOverflow(RuntimeError):
    pass


@dataclass(frozen=True)
class Budget:
    window: int = 200_000  # the model's hard limit
    trigger: int = 30_000  # above this, the policies run
    clear_at_least: int = 10_000  # never break the cache for less than this
    keep_tool_results: int = 3  # newest tool results always stay verbatim
    compact_above: int = 20_000  # still above this after clearing: summarize
    keep_recent: int = 10  # messages a compaction keeps word for word
    pinned_tools: frozenset[str] = frozenset({"notes_read"})


def stub(message: Message) -> str:
    """What replaces a stale tool result: the call survives, the payload doesn't."""
    text = f"[cleared: {message.tool}({message.args}) returned {message.tokens:,} tokens. Call it again if you need it."
    if error := ERROR_LINE.search(message.content):
        text += f" First error: {error.group(0)}"
    return text + "]"


@dataclass
class ContextManager:
    system: str
    summarizer: Summarizer
    budget: Budget = field(default_factory=Budget)
    read_notes: Callable[[], str] = lambda: ""
    history: list[Message] = field(default_factory=list)
    events: list[str] = field(default_factory=list)
    requests: int = 0

    def append(self, message: Message) -> None:
        self.history.append(message)

    def total(self) -> int:
        return count_tokens(self.system) + MESSAGE_OVERHEAD + sum(m.tokens for m in self.history)

    def prepare(self) -> list[Message]:
        """Apply the policies, cheapest first, and return the next request."""
        self.requests += 1
        if self.total() > self.budget.trigger:
            self._clear_tool_results()
            if self.total() > self.budget.compact_above:
                self._compact()
        if self.total() > self.budget.window:
            raise ContextOverflow(f"{self.total():,} tokens after every policy ran")
        return [Message("system", self.system), *self.history]

    def _clear_tool_results(self) -> None:
        results = [
            i
            for i, m in enumerate(self.history)
            if m.role == "tool" and not m.cleared and m.tool not in self.budget.pinned_tools
        ]
        stale = results[: -self.budget.keep_tool_results or None]
        stubs = {i: replace(self.history[i], content=stub(self.history[i]), cleared=True) for i in stale}
        freed = sum(self.history[i].tokens - s.tokens for i, s in stubs.items())
        # Every edit invalidates the cached prefix from that point on, so
        # small edits cost more in cache writes than they save.
        if freed < self.budget.clear_at_least:
            return
        for i, cleared in stubs.items():
            self.history[i] = cleared
        self.events.append(f"request {self.requests}: cleared {len(stale)} tool results (-{freed:,})")

    def _compact(self) -> None:
        cut = len(self.history) - self.budget.keep_recent
        # A tool result must never lose the call that produced it.
        while cut > 0 and self.history[cut].role == "tool":
            cut -= 1
        old, recent = self.history[:cut], self.history[cut:]
        # Same rule as clearing: a summary rewrites the prefix, so it must pay for itself.
        if sum(m.tokens for m in old) < self.budget.clear_at_least:
            return
        before = self.total()
        summary = self.summarizer.summarize(old, self.read_notes())
        self.history = [Message("summary", summary, turn=old[-1].turn), *recent]
        self.events.append(f"request {self.requests}: compacted {len(old)} messages (-{before - self.total():,})")
```

Two constraints hide in `_compact`. The cut point moves back until it doesn't separate a tool result from its call, because the major provider APIs reject a result without its call. And compaction reuses `clear_at_least`: an earlier version without that guard compacted three messages to save 159 tokens, breaking the cache for nothing.

### A summarizer you can run offline

The summarizer is a protocol, so it can be a model call or plain code. For the simulation it's extractive and deterministic. It relies on a convention the system prompt asks for (the agent writes `DECISION:`, `TODO:` and `DONE:` lines), pulls errors out with a regex and tracks file paths from tool arguments. Its output uses the same markers, so summarizing a summary is lossless.

```python title="ctxkit/summarize.py"
from __future__ import annotations

import re

from ctxkit.context import ERROR_LINE, Message

MARKER = re.compile(r"^(TASK|USER|DECISION|TODO|DONE|ERROR|FILE): (.+)$", re.M)
PATH = re.compile(r"\b(?:src|tests)/[\w/.-]+\.py\b")
SEEN = re.compile(r"^(.*) \(last seen turn (\d+)\)$")


def _touch(d: dict, key, value) -> None:
    d.pop(key, None)  # re-insert so the dict stays ordered by recency
    d[key] = value


class ExtractiveSummarizer:
    """Deterministic and offline: keeps what later turns tend to need.

    It relies on a convention the system prompt asks for: the agent writes
    DECISION:, TODO: and DONE: lines in its messages. Its own output uses
    the same markers, so summarizing a summary loses nothing.
    """

    def __init__(self, max_errors: int = 5, max_files: int = 12) -> None:
        self.max_errors = max_errors
        self.max_files = max_files

    def summarize(self, messages: list[Message], notes: str) -> str:
        task, users, decisions = "", [], []
        todos: dict[str, None] = {}
        errors: dict[str, int] = {}
        files: dict[str, str] = {}
        for m in messages:
            if m.role == "user":
                if task:
                    users.append(f"(turn {m.turn}) {m.content}")
                else:
                    task = m.content
            elif m.role in ("assistant", "summary"):
                turn = "" if m.role == "summary" else f"(turn {m.turn}) "
                for kind, text in MARKER.findall(m.content):
                    if kind == "TASK":
                        task = text
                    elif kind == "USER":
                        users.append(text)
                    elif kind == "DECISION":
                        decisions.append(turn + text)
                    elif kind == "TODO":
                        todos[text] = None
                    elif kind == "DONE":
                        todos.pop(text, None)
                    elif kind == "ERROR" and (seen := SEEN.match(text)):
                        _touch(errors, seen.group(1), int(seen.group(2)))
                    elif kind == "FILE":
                        _touch(files, PATH.findall(text)[0], text)
            elif m.role == "tool":
                for error in ERROR_LINE.finditer(m.content):
                    _touch(errors, error.group(0), m.turn)
                for path in PATH.findall(m.args or ""):
                    _touch(files, path, f"{path}, last {m.tool} at turn {m.turn}")

        lines = [f"TASK: {task}"]
        lines += [f"USER: {u}" for u in users]
        lines += [f"DECISION: {d}" for d in decisions]
        lines += [f"TODO: {t}" for t in todos]
        lines += [f"ERROR: {e} (last seen turn {t})" for e, t in list(errors.items())[-self.max_errors :]]
        lines += [f"FILE: {f}" for f in list(files.values())[-self.max_files :]]
        header = f"Summary of turns 1 to {messages[-1].turn}. Older tool output was dropped; re-read what you need."
        return "\n".join([header, *lines, "", "Current notes:", notes or "(empty)"])
```

In production you'd usually plug in a model. This class is **illustrative and was not run for this post**; the prompt carries the same preservation rules and keeps the markers.

```python title="ctxkit/llm_summarizer.py (illustrative, not run)"
from ctxkit.context import Message

PROMPT = """You are compacting the history of a coding agent so it can continue its task.
Keep, verbatim where possible:
- the original task and every instruction the user added later
- every decision and its reason, as DECISION: lines
- open work, as TODO: lines (drop items marked DONE:)
- exact error messages and approaches that failed, as ERROR: lines
- every file path touched and what was last done to it, as FILE: lines
Drop tool output the agent can fetch again. Never invent facts."""


class LLMSummarizer:
    def __init__(self, client, model: str, max_tokens: int = 2_000) -> None:
        self.client, self.model, self.max_tokens = client, model, max_tokens

    def summarize(self, messages: list[Message], notes: str) -> str:
        transcript = "\n\n".join(f"[{m.role}, turn {m.turn}] {m.content}" for m in messages)
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=PROMPT,
            messages=[{"role": "user", "content": transcript}],
        )
        return f"{response.content[0].text}\n\nCurrent notes:\n{notes or '(empty)'}"
```

A model catches what a regex can't (two TODOs worded differently, an error caused by the last edit), but costs a call over the old history and can paraphrase a decision into something subtly different. Test either one the same way: plant facts and check they survive.

### The notes file

Markdown with `##` sections and `-` entries. `NOTES_TOOLS`, in the same file, exposes `notes_write`, `notes_rewrite` and `notes_read` to the model. The cap is the important part: past it, writes fail with an error that tells the agent to consolidate.

```python title="ctxkit/notes.py (the class; the tool schemas are above it in the file)"
class NotesFile:
    """Memory the agent writes and reads itself; it survives every compaction."""

    def __init__(self, path: Path, max_tokens: int = 1_500) -> None:
        self.path = path
        self.max_tokens = max_tokens

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8") if self.path.exists() else ""

    def write(self, section: str, entry: str) -> str:
        sections = self._sections()
        sections.setdefault(section, []).append(entry)
        return self._save(sections, f"ok: {section} has {len(sections[section])} entries")

    def rewrite(self, section: str, entries: list[str]) -> str:
        sections = self._sections()
        sections[section] = entries
        if not entries:
            del sections[section]
        return self._save(sections, f"ok: {section} rewritten")

    def _sections(self) -> dict[str, list[str]]:
        sections: dict[str, list[str]] = {}
        for line in self.read().splitlines():
            if line.startswith("## "):
                sections[line[3:]] = []
            elif line.startswith("- ") and sections:
                sections[list(sections)[-1]].append(line[2:])
        return sections

    def _save(self, sections: dict[str, list[str]], ok: str) -> str:
        text = "\n\n".join(f"## {name}\n" + "\n".join(f"- {e}" for e in items) for name, items in sections.items())
        # Notes that grow without bound are just a second history.
        if count_tokens(text) > self.max_tokens:
            return f"error: notes would exceed {self.max_tokens} tokens; merge entries with notes_rewrite first"
        self.path.write_text(text + "\n", encoding="utf-8")
        return ok
```

### Simulating a 60-turn coding session

No model calls: the point is to measure the context, so the session is scripted. `session.py` (fixture generators, not shown) has an agent fixing a one-cent rounding bug in BRL invoices across 22 planned turns: a decision to round once at the total with `ROUND_HALF_EVEN` (turn 8), a `TypeError` from float tax rates (turn 13), a user adding a CSV export bug (turn 20), a third decision (turn 35), regression tests and a final run. The other turns explore with a fixed seed. `read_file` returns 5.0k to 9.3k tokens, `run_tests` 2.6k to 4.0k, `grep` 0.4k to 1.3k, and each agent message has about 100 to 225 tokens of reasoning. The session is recorded once and replayed in both modes; the meter treats the run of messages shared with the previous request as a cache read and the rest as a write.

```python title="simulate.py (the meter and the replay loop)"
@dataclass
class Meter:
    """Per-request tokens and cost, with an append-only prompt cache model."""

    previous: list[str] = field(default_factory=list)
    context: list[int] = field(default_factory=list)
    fresh: int = 0
    cost_plain: float = 0.0
    cost_cached: float = 0.0
    cost_cold: float = 0.0

    def request(self, messages: list[Message], output: int, turn: int) -> None:
        keys, tokens = [m.key for m in messages], [m.tokens for m in messages]
        shared = 0
        while shared < min(len(keys), len(self.previous)) and keys[shared] == self.previous[shared]:
            shared += 1
        read = sum(tokens[:shared]) if sum(tokens[:shared]) >= MIN_CACHEABLE else 0
        total = sum(tokens)
        self.context.append(total)
        self.fresh += total - read
        self.cost_plain += (total * PRICE_IN + output * PRICE_OUT) / 1e6
        self.cost_cached += self._cached(total, read, output)
        self.cost_cold += self._cached(total, 0 if turn in COLD else read, output)
        self.previous = keys

    @staticmethod
    def _cached(total: int, read: int, output: int) -> float:
        return (read * PRICE_IN * CACHE_READ + (total - read) * PRICE_IN * CACHE_WRITE + output * PRICE_OUT) / 1e6


def replay(turns, manager: ContextManager | None, notes: NotesFile) -> tuple[Meter, list[Message]]:
    meter, history = Meter(), []
    add = manager.append if manager else history.append
    request = manager.prepare if manager else lambda: [Message("system", SYSTEM), *history]
    for t, user, call, result in turns:
        if user:
            add(Message("user", user, turn=t))
        meter.request(request(), output=call.tokens, turn=t)
        if result.tool in ("notes_write", "notes_rewrite"):
            section, entry = result.args.split(" | ")
            ok = notes.write(section, entry) if result.tool == "notes_write" else notes.rewrite(section, [entry])
            result = Message("tool", ok, turn=t, tool=result.tool, args=result.args)
        add(call)
        add(result)
    return meter, request()
```

The constants at the top of the file: $3 and $15 per million input and output tokens, Anthropic's cache multipliers (0.1 and 1.25), a 1,024-token cache minimum, and `COLD = {20, 45}`, the turns before which the cache expired. The warm-cache numbers assume no pause longer than the five-minute cache lifetime, which flatters the naive run; the cold row doesn't. At the end, the script checks that eight planted facts are still in the managed context.

### The results

```bash title="terminal"
$ python simulate.py
tokenizer: tiktoken o200k_base, system prompt + tools: 612 tokens
turn     naive   managed
   1       649       649
   5     8,826     8,826
  10    24,950    24,950
  15    43,753    21,850
  20    63,403    22,804
  25    79,622    20,491
  30    93,418    15,497
  35   108,138    17,992
  40   118,983    28,837
  45   146,066    28,298
  50   176,486    33,041
  55   187,866    29,429
  60   212,592    20,965

manager events:
  request 12: cleared 8 tool results (-21,903)
  request 18: cleared 6 tool results (-18,696)
  request 24: cleared 6 tool results (-18,532)
  request 30: cleared 6 tool results (-18,790)
  request 35: cleared 5 tool results (-12,225)
  request 41: cleared 6 tool results (-17,048)
  request 44: cleared 3 tool results (-10,574)
  request 46: cleared 2 tool results (-15,562)
  request 49: cleared 3 tool results (-10,115)
  request 52: cleared 3 tool results (-14,992)
  request 56: cleared 4 tool results (-10,063)
  request 59: cleared 3 tool results (-13,393)
  request 59: compacted 108 messages (-9,734)

                                 naive     managed
input tokens, all turns      5,856,377   1,286,153
peak context                   212,592      36,936
tokens prefilled fresh         213,241     310,929
cost without caching            $17.71       $4.00
cost with caching                $2.63       $1.60
... and 2 cold caches            $3.33       $1.75
naive passes 128,000 tokens at turn 42
naive passes 200,000 tokens at turn 58

facts still in the managed context at the end:
  yes  task: keep USD behavior unchanged
  yes  decision t8: ROUND_HALF_EVEN
  yes  decision t16: never float
  yes  decision t35: format_money()
  yes  user t20: 3 decimals for BRL
  yes  error t13: TypeError: unsupported operand
  yes  file: src/billing/tax.py
  yes  open task: TODO: run the full suite
```

The naive context grows in a straight line and passes 200k at turn 58, so on a 200k-window model this session dies two turns from the end. The managed context saws between about 11k and 37k: clearing pulls it down every time it reaches the trigger, and near the end a compaction removes 108 messages. Overall it sends 4.6 times fewer input tokens and keeps all eight facts.

The cost rows need an honest reading. Without caching, managed is 4.4 times cheaper. With a warm cache it's only 39% cheaper, because append-only history is the best case for caching: the naive run writes each token to the cache once. The managed run actually prefills 46% *more* tokens fresh (310,929 against 213,241), since each clearing rewrites the cache from the first edited message on. With two cold caches (a human who takes ten minutes, a slow CI run), the naive run pays full write price on a 63k and a 146k prefix, and managed becomes 47% cheaper.

The compaction at request 59 produced this summary (`--show`):

```text title="terminal"
Summary of turns 1 to 53. Older tool output was dropped; re-read what you need.
TASK: Invoice totals in BRL are sometimes off by one cent. Find the cause, fix it, add regression tests, and keep USD behavior unchanged.
USER: (turn 20) Also check the CSV export, finance says it shows 3 decimals for BRL.
DECISION: (turn 8) round once, at the invoice total, with ROUND_HALF_EVEN in src/billing/money.py
DECISION: (turn 16) tax rates load as Decimal from strings, never float
DECISION: (turn 35) export formats money with format_money(), never str(Decimal)
TODO: run the full suite and summarize the change for the PR
ERROR: AssertionError: expected Decimal('10.01'), got Decimal('10.00') (last seen turn 11)
ERROR: TypeError: unsupported operand type(s) for *: 'float' and 'decimal.Decimal' (last seen turn 15)
ERROR: AssertionError: '10.010' != '10.01' (last seen turn 32)
FILE: src/billing/invoice.py, last read_file at turn 17
FILE: tests/test_export.py, last run_tests at turn 31
FILE: src/billing/export.py, last edit_file at turn 37
FILE: src/billing/tax.py, last read_file at turn 42
FILE: tests/test_money.py, last run_tests at turn 46
FILE: src/billing/currency.py, last read_file at turn 47
FILE: src/billing/money.py, last read_file at turn 48
FILE: tests/test_invoice.py, last read_file at turn 49

Current notes:
## Decisions
- round once at the total, ROUND_HALF_EVEN, money.py
- export uses format_money(), never str(Decimal)

## Open
- run the full suite and summarize the change for the PR
```

Two of the three TODOs are gone because the agent marked them done. The error lines came from cleared stubs, not from the original logs, which is why the stub keeps the first error:

```text title="terminal"
[cleared: run_tests(tests/test_invoice.py) returned 3,654 tokens. Call it again if you need it. First error: AssertionError: expected Decimal('10.01'), got Decimal('10.00')]
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So with caching on, managing the context only saves 39%. Why bother with all this machinery?</span>
    </div>
  </div>
</div>

The bill was never the only cost. The naive run hits a 200k ceiling at turn 58, so a longer task simply fails, and past turn 40 every request asks the model to find a few decisions inside 120k or more tokens of stale file reads, the setting where Lost in the Middle, NoLiMa and Context Rot measured the drops. The warm cache is also the optimistic case. You manage context for the quality of turn 52; the savings are a bonus.

### Testing the invariants

What breaks silently is structural, so it gets tests: clearing keeps every call and the newest results, small gains never break the cache, compaction never orphans a tool result, a summary of a summary loses nothing, and the notes file refuses to grow past its cap.

```bash title="terminal"
$ python -m pytest -v
collecting ... collected 5 items

test_ctxkit.py::test_clearing_keeps_calls_and_newest_results PASSED      [ 20%]
test_ctxkit.py::test_small_gains_do_not_break_the_cache PASSED           [ 40%]
test_ctxkit.py::test_compaction_never_orphans_a_tool_result PASSED       [ 60%]
test_ctxkit.py::test_summarizing_a_summary_loses_nothing PASSED          [ 80%]
test_ctxkit.py::test_notes_refuse_to_grow_without_bound PASSED           [100%]

============================== 5 passed in 0.32s ==============================
```

## Production Reality Check

### The provider may already do half of this

Anthropic's API has [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) (beta header `context-management-2025-06-27`), whose `clear_tool_uses_20250919` strategy has the same knobs as my `Budget`: a trigger (default 100k input tokens), recent tool uses to keep (default 3), `clear_at_least`, excluded tools, and optionally clearing the call inputs too. As an illustration (I didn't call the API for this post):

```json title="request body (illustrative)"
{
  "context_management": {
    "edits": [
      {
        "type": "clear_tool_uses_20250919",
        "trigger": { "type": "input_tokens", "value": 30000 },
        "keep": { "type": "tool_uses", "value": 3 },
        "clear_at_least": { "type": "input_tokens", "value": 10000 },
        "exclude_tools": ["notes_read"]
      }
    ]
  }
}
```

There's also [threshold compaction](https://platform.claude.com/docs/en/build-with-claude/compaction-threshold) (`compact_20260112`, beta header `compact-2026-01-12`): at a trigger (default 150k, minimum 50k) the API writes a summary block and drops what came before it. Its `instructions` parameter replaces the default prompt entirely, so bring your own preservation list, and the summary is an extra billed sampling iteration. Anthropic's [announcement](https://claude.com/blog/context-management) reports context editing cutting token use by 84% in a 100-turn web search evaluation, and improving an internal agentic search evaluation by 29% (39% with the memory tool). Vendor numbers, but they point the same way as mine. Server-side is less code; client-side is portable and testable offline.

### Don't clear what can't be fetched again

Clearing is safe because the agent can re-run the tool. That holds for `read_file`. It doesn't for a deployment log, the response of a call with side effects or a human's confirmation, and re-running a side-effecting call to see its result is how you refund an order twice. Pin those tools (`pinned_tools` here, `exclude_tools` on the API) or copy the result into the notes first, and make the tools idempotent as in [Deterministic Tool Calling](/en-us/blog/deterministic-tool-calling/).

### Watch for re-reads

Aggressive clearing shows up as an agent re-reading the same file over and over, which means `keep_tool_results` is too low or the trigger too tight. Per session I log tokens per request, the cache read ratio, clearings, compactions and re-reads of cleared paths.

### Summaries fail quietly, so test them like code

A summary that dropped the turn 8 decision looks exactly like a good one until the agent retries the reverted fix. The fact check in the simulation is the pattern: record real sessions, list what must survive, compact, assert. Rerun it whenever the summarization prompt or its model changes.

### Tokenizers and budgets are local

tiktoken counts for OpenAI models; for Claude or Gemini leave slack and calibrate against real usage, or ask the provider (Anthropic's token counting endpoint accepts the same context management settings and reports tokens before and after edits). And the budget belongs to the task: 30k worked here because the largest result was about 9k tokens, so set the trigger at a few times your largest expected tool result.

A long context window is a capability, not a strategy. The agents that stay sharp at turn 200 are the ones whose context at turn 200 looks like their context at turn 20: the task, the decisions, the open work and the few things they're looking at right now. Everything else lives outside the window, one tool call away.
