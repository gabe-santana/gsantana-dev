---
title: "Orchestrating Multiple Agents Without Building a Distributed Monolith"
description: "Use multiple agents only when one cannot do the job, with clear ownership, budgets, and stop conditions."
date: 2026-03-26
tags: [AI Agents, Orchestration, Python, asyncio]
tldr:
  - "Start with one agent and good tools; split into multiple agents only when context, permissions or ownership genuinely force it."
  - "Choose an explicit pattern (supervisor, pipeline or handoff), pass typed task and result messages, and keep shared state in one orchestrator-owned object."
  - "Give every run a step budget, a token budget, per-agent timeouts and a deadline, and return partial results with a trace id instead of hanging."
---

The multi-agent demo is irresistible. A planner agent breaks the problem down, a researcher agent digs up facts, a critic agent reviews them, a writer agent polishes the answer, and they all chat with each other on a slick diagram. It works beautifully on the three prompts you tried. Then real traffic arrives: one request loops between the critic and the writer for forty turns, another hangs for two minutes because a single agent never answered, and nobody can explain why last Tuesday's bill tripled.

Congratulations, you built a distributed monolith: the coupling of a single system, the partial failures of a distributed one, and the benefits of neither. This post covers when more than one agent is justified, which orchestration pattern to pick, how to handle state and budgets, and a runnable Python supervisor that does it all offline. The Naive Junior is along for the ride.

## The Problem & Context

In microservices, a distributed monolith is a set of services that can't be deployed, scaled or understood independently. Multi-agent systems fall into the same trap faster, because the "API" between agents is often free text and the "services" are nondeterministic. The symptoms:

- **Agents that call each other in cycles.** The writer asks the critic, the critic asks the researcher, the researcher asks the writer. Nobody owns the flow, so nothing stops the loop except the context window or your credit card.
- **Implicit shared context.** Every agent receives the full history "just in case", so changing one prompt silently changes the behavior of all of them.
- **Cascading timeouts.** A waits on B, which waits on C. C is slow, B times out, A retries B, which calls C again. Latency multiplies instead of adding.
- **No single place to see what happened.** Five log streams, no shared identifier, and a user asking why the answer was wrong.
- **Cost blowups.** Every hop is at least one model call with a growing prompt, and nobody set a limit because each agent looked cheap on its own.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But specialized agents are just better, right? A researcher agent and a writer agent should beat one generalist doing both.</span>
    </div>
  </div>
</div>

Sometimes, and much less often than the diagrams suggest. Splitting a task into agents is not free specialization; it's a distributed system with lossy messages. Every handoff drops context, adds latency and adds a place to fail. A single agent with well-designed tools and a loop that owns the whole task usually wins on quality, latency and cost for anything that fits in one context window.

So ask the boring question first: **why can't one agent do this?** Good reasons to split are concrete:

- **Context isolation.** Subtasks need large, unrelated context (a codebase, a contract, a log dump) that would crowd each other out of a single window.
- **Different permissions.** One part may read customer data, another may only draft emails. Separate agents with separate tool allowlists are a clean security boundary.
- **Real parallelism.** Independent investigations that each take seconds can run concurrently.
- **Independent ownership.** Different teams own, evaluate and ship different capabilities on their own schedule.

"It feels more organized" is not on the list. If none of these apply, invest in better tools instead; [Deterministic Tool Calling: Stop Letting the LLM Improvise Your API Calls](/en-us/blog/deterministic-tool-calling/) shows how to make one agent's tools strict enough that you rarely need a second agent to double-check the first.

## Deep Dive / Architectural Design

Once you do need several agents, make the control flow **explicit**. Somebody, code or a designated agent, must own the question "what happens next?". Most healthy systems use one of three patterns, or a simple composition of them.

### Pattern 1: supervisor (router)

A supervisor receives the request, decides which specialists to call, sends each one a scoped task, collects the results and aggregates them. Specialists never talk to each other; they only answer the supervisor.

<div id="supervisor-pattern-slot"></div>

Routing, budgets and failure handling live in one place. The routing decision can come from an LLM ("which checks does this incident need?"), but the supervisor validates and executes the plan in code. The trade-off: the supervisor becomes a design bottleneck, and a bad routing decision means the right specialist is never asked.

### Pattern 2: sequential pipeline

Fixed stages, each consuming the previous stage's typed output. No dynamic routing at all.

<div id="agent-pipeline-slot"></div>

The most predictable pattern, and the easiest to test, because every stage has a clear contract. It fits document processing, triage and any known procedure. The trade-off is rigidity: work that doesn't follow the same steps every time leaves stages idle, and total latency is the sum of all stages.

### Pattern 3: peer handoff

One agent is active at a time and explicitly transfers control, plus a compact summary, to another. Think of a front-desk agent that hands the conversation to a billing agent.

<div id="agent-handoff-slot"></div>

Handoffs fit conversational products where phases need different tools. They are also the easiest way to build cycles. Keep them explicit (a structured `handoff` action, never "the agent decides to message someone"), count them against a budget, and forbid handing back to an agent that already had control in the same turn.

| Pattern | Control flow | Best for | Main risk |
|---------|--------------|----------|-----------|
| Supervisor | Central, dynamic routing | Independent subtasks, fan-out and aggregate | Bad routing, supervisor as bottleneck |
| Pipeline | Fixed sequence of stages | Known procedures, document flows | Rigid, latency is the sum of stages |
| Handoff | One active agent, explicit transfer | Conversations with distinct phases | Cycles, context lost at each transfer |

### State and contracts

Whatever the pattern, three rules keep the system debuggable:

1. **Typed messages at every boundary.** A `Task` (id, kind, payload, trace id) goes in, a `Result` (status, output, error, tokens, duration) comes out. Agents get only the payload they need, never the whole conversation.
2. **One owner for shared state.** A blackboard owned by the orchestrator holds results, budgets and what already ran. Agents read their task and write through their result, never directly.
3. **Idempotent steps.** Fingerprint each task by kind and payload, so a repeated request or a replayed step is skipped or served from the stored result.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why not just let the agents talk to each other freely? That's the whole point of a multi-agent system, isn't it?</span>
    </div>
  </div>
</div>

Free conversation between agents is great for research papers and terrible for on-call engineers. N agents messaging each other means N squared possible edges, no owner of termination and no place to enforce a budget. If you truly need debate, run it as a bounded loop owned by one orchestrator: a fixed number of rounds, then stop.

### Budgets, guards and failures

Every run needs hard limits that don't depend on any model behaving well:

- **Step budget.** Maximum number of agent invocations per run.
- **Token or cost budget.** Summed across all agents, checked before admitting new work.
- **Per-agent timeout.** Enforced with `asyncio.wait_for`, so one slow specialist can't hold the whole run hostage.
- **Run deadline.** A wall-clock limit for everything; hitting it cancels outstanding work cleanly.
- **Duplicate-work detection.** The fingerprints above, so a confused planner can't fan out the same task repeatedly.

When something fails, **degrade, don't collapse**. A timed-out metrics agent shouldn't discard good findings from the logs agent. Return a partial report with a clear status, use a fallback (a cheaper agent, cached data, a heuristic) where one exists, and escalate to a human with the trace id. A partial answer that says it's partial beats a spinner.

<div class="callout warning" data-title="Warning">
  <p>Never retry across agent boundaries by default. If each of three nested layers retries twice, one slow leaf can produce 27 calls. Retry at one layer only (usually the transport call inside the agent), and let the supervisor treat a failed <code>Result</code> as final for that run.</p>
</div>

### Observability

Generate a trace id at the entry point and propagate it through every task, result and log line. Log each orchestrator decision, not just each model call: admitted, skipped as duplicate, denied by budget, timed out. With JSON logs keyed by `trace_id`, "what happened in this run?" becomes one query instead of an archaeology project.

## Hands-On Implementation

Let's build a supervisor for incident triage. Given an incident description, it fans out to three specialists (logs, metrics, deploys) in parallel, then runs a summarizer on whatever evidence came back. The agents are deterministic stubs standing in for LLM calls, so everything runs offline with the standard library and pytest.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install pytest
```

### Messages: the contract

```python title="messages.py"
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class Status(str, Enum):
    OK = "ok"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass(frozen=True)
class Task:
    """What the supervisor asks an agent to do. The only input an agent receives."""

    task_id: str
    kind: str  # routing key: which specialist handles it
    payload: dict[str, Any]
    trace_id: str


@dataclass(frozen=True)
class Result:
    """What comes back from every hop, success or not."""

    task_id: str
    kind: str
    agent: str
    status: Status
    output: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    tokens_used: int = 0
    duration_ms: float = 0.0
```

Both messages are frozen: agents can't mutate their task, and recorded results can't be edited. Every failure is a `Status`, not an exception bubbling through the orchestrator.

### Agents and the model interface

```python title="agents.py"
import asyncio
import json
from dataclasses import dataclass
from typing import Any, Protocol

from messages import Task


class ModelClient(Protocol):
    async def complete(self, instructions: str, prompt: str) -> tuple[str, int]:
        """Return (text, tokens_used). A real implementation calls your LLM provider here."""
        ...


class StubModel:
    """Deterministic stand-in for an LLM call, so everything runs offline."""

    def __init__(self, delay_s: float = 0.0, tokens_per_call: int = 100) -> None:
        self.delay_s = delay_s
        self.tokens_per_call = tokens_per_call

    async def complete(self, instructions: str, prompt: str) -> tuple[str, int]:
        await asyncio.sleep(self.delay_s)
        return f"{instructions} | input: {prompt[:60]}", self.tokens_per_call


@dataclass(frozen=True)
class AgentOutput:
    data: dict[str, Any]
    tokens: int = 0


@dataclass(frozen=True)
class Agent:
    name: str
    kind: str
    instructions: str
    model: ModelClient
    timeout_s: float = 2.0

    async def run(self, task: Task) -> AgentOutput:
        # The agent sees only its task payload, never the full history of other agents
        prompt = json.dumps(task.payload, sort_keys=True)
        text, tokens = await self.model.complete(self.instructions, prompt)
        return AgentOutput(data={"text": text}, tokens=tokens)


def build_agents(delays: dict[str, float] | None = None, timeout_s: float = 2.0) -> list[Agent]:
    delays = delays or {}
    specs = {
        "logs": "Find error patterns in application logs",
        "metrics": "Find anomalies in latency and error-rate metrics",
        "deploys": "List deployments and config changes near the incident",
        "summarize": "Write a short incident summary from the evidence",
    }
    return [
        Agent(
            name=f"{kind}-agent",
            kind=kind,
            instructions=instructions,
            model=StubModel(delay_s=delays.get(kind, 0.0)),
            timeout_s=timeout_s,
        )
        for kind, instructions in specs.items()
    ]
```

`ModelClient` is the only seam to a real provider. Implement `complete` with your SDK (model name from configuration, tokens from the response usage) and nothing else changes. `StubModel` takes a `delay_s`, which is how the tests simulate a slow agent, and each `Agent` carries its own `timeout_s`.

### The supervisor

```python title="orchestrator.py"
import asyncio
import hashlib
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field, replace
from typing import Any

from agents import Agent, build_agents
from messages import Result, Status, Task, new_id

logger = logging.getLogger("orchestrator")


@dataclass(frozen=True)
class Budget:
    max_steps: int = 6  # agent invocations per run
    max_tokens: int = 5_000  # summed over all agents
    deadline_s: float = 10.0  # wall clock for the whole run


@dataclass
class RunState:
    """The blackboard. Owned by the supervisor; agents never touch it directly."""

    trace_id: str
    steps: int = 0
    tokens: int = 0
    results: dict[str, Result] = field(default_factory=dict)
    fingerprints: set[str] = field(default_factory=set)
    stop_reason: str = ""


@dataclass(frozen=True)
class Report:
    trace_id: str
    status: str  # "complete" | "partial" | "failed"
    stop_reason: str
    summary: str
    needs_human: bool
    steps_used: int
    tokens_used: int
    results: list[Result]


def fingerprint(kind: str, payload: dict[str, Any]) -> str:
    raw = json.dumps([kind, payload], sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class Supervisor:
    def __init__(self, agents: list[Agent], budget: Budget | None = None, finalizer: str = "summarize") -> None:
        self.agents = {agent.kind: agent for agent in agents}
        self.budget = budget or Budget()
        self.finalizer = finalizer

    def plan(self, request: dict[str, Any], trace_id: str) -> list[Task]:
        # In production an LLM router may propose this list. The supervisor still decides what runs.
        kinds = request.get("checks", ["logs", "metrics", "deploys"])
        return [Task(new_id(), kind, {"incident": request["incident"]}, trace_id) for kind in kinds]

    async def run(self, request: dict[str, Any]) -> Report:
        state = RunState(trace_id=request.get("trace_id") or uuid.uuid4().hex)
        self._log(state, "run_started", request=request)
        try:
            await asyncio.wait_for(self._run(request, state), timeout=self.budget.deadline_s)
        except asyncio.TimeoutError:
            state.stop_reason = state.stop_reason or "deadline"
        report = self._report(state)
        self._log(state, "run_finished", status=report.status, stop_reason=report.stop_reason)
        return report

    async def _run(self, request: dict[str, Any], state: RunState) -> None:
        # 1. Fan out to specialists, within budget and without duplicate work
        admitted = [task for task in self.plan(request, state.trace_id) if self._admit(task, state)]
        await asyncio.gather(*(self._dispatch(task, state) for task in admitted))

        # 2. Aggregate whatever succeeded, then run the finalizer once
        evidence = {r.kind: r.output["text"] for r in state.results.values() if r.status is Status.OK}
        if not evidence:
            state.stop_reason = state.stop_reason or "no_evidence"
            return
        final = Task(new_id(), self.finalizer, {"incident": request["incident"], "evidence": evidence}, state.trace_id)
        if self._admit(final, state):
            await self._dispatch(final, state)

    def _admit(self, task: Task, state: RunState) -> bool:
        fp = fingerprint(task.kind, task.payload)
        if fp in state.fingerprints:
            self._log(state, "skipped_duplicate", task_id=task.task_id, kind=task.kind)
            return False
        if state.steps >= self.budget.max_steps:
            state.stop_reason = "step_budget"
        elif state.tokens >= self.budget.max_tokens:
            state.stop_reason = "token_budget"
        if state.stop_reason:
            self._log(state, "budget_denied", task_id=task.task_id, kind=task.kind, reason=state.stop_reason)
            return False
        state.fingerprints.add(fp)
        state.steps += 1
        return True

    async def _dispatch(self, task: Task, state: RunState) -> Result:
        agent = self.agents.get(task.kind)
        started = time.perf_counter()
        if agent is None:
            result = Result(task.task_id, task.kind, "none", Status.FAILED, error=f"no agent for kind '{task.kind}'")
        else:
            try:
                out = await asyncio.wait_for(agent.run(task), timeout=agent.timeout_s)
                result = Result(task.task_id, task.kind, agent.name, Status.OK, out.data, tokens_used=out.tokens)
            except asyncio.TimeoutError:
                result = Result(task.task_id, task.kind, agent.name, Status.TIMEOUT, error=f"exceeded {agent.timeout_s}s")
            except Exception as exc:  # CancelledError is not an Exception, so cancellation still propagates
                logger.exception("agent %s crashed", agent.name)
                result = Result(task.task_id, task.kind, agent.name, Status.FAILED, error=f"{type(exc).__name__}: {exc}")
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        result = replace(result, duration_ms=duration_ms)
        state.results[task.task_id] = result
        state.tokens += result.tokens_used
        self._log(
            state,
            "agent_result",
            task_id=task.task_id,
            agent=result.agent,
            status=result.status.value,
            tokens_used=result.tokens_used,
            duration_ms=duration_ms,
            error=result.error,
        )
        return result

    def _report(self, state: RunState) -> Report:
        results = list(state.results.values())
        final = next((r for r in results if r.kind == self.finalizer and r.status is Status.OK), None)
        problems = [r for r in results if r.status is not Status.OK]
        if final and not problems and not state.stop_reason:
            status = "complete"
        elif any(r.status is Status.OK for r in results):
            status = "partial"
        else:
            status = "failed"
        return Report(
            trace_id=state.trace_id,
            status=status,
            stop_reason=state.stop_reason,
            summary=final.output["text"] if final else "",
            needs_human=status != "complete",
            steps_used=state.steps,
            tokens_used=state.tokens,
            results=results,
        )

    def _log(self, state: RunState, event: str, **fields: Any) -> None:
        record = {"trace_id": state.trace_id, "event": event, "steps": state.steps, "tokens": state.tokens, **fields}
        logger.info(json.dumps(record, default=str))


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    supervisor = Supervisor(build_agents(delays={"metrics": 0.3}, timeout_s=0.2), Budget(max_steps=5))
    report = await supervisor.run({"incident": "checkout p95 latency doubled"})
    print(json.dumps(asdict(report), indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
```

Walk through it in order of what can go wrong:

- **`_admit` is the only gate.** Every task, including the finalizer, passes through it: duplicates are rejected by fingerprint, then step and token budgets are checked before a step is reserved. Tasks already in flight finish, but nothing new starts once a limit is hit.
- **`_dispatch` never raises for agent problems.** A missing route, a timeout and a crash all become a `Result`. Catching `Exception` leaves `asyncio.CancelledError` alone (it inherits from `BaseException`), so the run deadline can still cancel in-flight agents.
- **`run` wraps everything in a deadline.** Outstanding agents are cancelled, and results already on the blackboard still go into the report.
- **`_report` is honest.** `complete` only when the summary exists and nothing failed or was cut short, `partial` when there is some evidence, `failed` otherwise. Anything but `complete` sets `needs_human`.

The demo in `main` makes the metrics agent slower than its timeout on purpose, so `python orchestrator.py` shows a partial report built from the specialists that answered.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If the metrics agent timed out, shouldn't the supervisor just retry it until it works?</span>
    </div>
  </div>
</div>

Only if you're happy to pay its timeout again on every attempt while the user waits. A timeout usually means the agent is stuck (a huge log query, a slow upstream), and an immediate retry hits the same wall. The supervisor's job is the best answer within budget: record the timeout, summarize the evidence it has, flag the report for a human. If a retry makes sense, make it a deliberate policy: one attempt, narrower scope, counted against the same step budget.

### Testing the orchestration

These tests use plain pytest with `asyncio.run` inside each test, so no `pytest-asyncio` plugin is needed.

```python title="test_orchestrator.py"
import asyncio

from agents import build_agents
from messages import Status
from orchestrator import Budget, Supervisor

INCIDENT = {"incident": "checkout p95 latency doubled", "trace_id": "trace-test"}


def run(supervisor: Supervisor, request: dict | None = None):
    # Plain pytest: each test drives the event loop itself, no plugin needed
    return asyncio.run(supervisor.run(request or INCIDENT))


def statuses(report) -> dict[str, Status]:
    return {r.kind: r.status for r in report.results}


def test_normal_run_completes_with_summary():
    report = run(Supervisor(build_agents()))
    assert report.status == "complete"
    assert report.stop_reason == ""
    assert not report.needs_human
    assert report.steps_used == 4  # three specialists + the summarizer
    assert report.tokens_used == 400
    assert set(statuses(report).values()) == {Status.OK}
    assert report.summary.startswith("Write a short incident summary")
    assert report.trace_id == "trace-test"


def test_step_budget_exhaustion_returns_partial_report():
    report = run(Supervisor(build_agents(), Budget(max_steps=2)))
    assert report.steps_used == 2
    assert report.stop_reason == "step_budget"
    assert report.status == "partial"
    assert report.needs_human
    assert report.summary == ""
    assert statuses(report) == {"logs": Status.OK, "metrics": Status.OK}


def test_token_budget_stops_before_finalizer():
    report = run(Supervisor(build_agents(), Budget(max_tokens=150)))
    assert report.stop_reason == "token_budget"
    assert "summarize" not in statuses(report)
    assert report.status == "partial"


def test_timed_out_agent_does_not_sink_the_run():
    agents = build_agents(delays={"metrics": 0.5}, timeout_s=0.1)
    report = run(Supervisor(agents))
    kinds = statuses(report)
    assert kinds["metrics"] is Status.TIMEOUT
    assert kinds["logs"] is Status.OK and kinds["deploys"] is Status.OK
    assert kinds["summarize"] is Status.OK  # finalizer ran on the evidence that did arrive
    assert report.status == "partial"
    assert report.needs_human


def test_duplicate_subtasks_run_once():
    request = {**INCIDENT, "checks": ["logs", "logs", "metrics"]}
    report = run(Supervisor(build_agents()), request)
    assert report.steps_used == 3  # logs, metrics, summarize
    assert [r.kind for r in report.results].count("logs") == 1


def test_unknown_route_fails_without_crashing():
    request = {**INCIDENT, "checks": ["logs", "tracing"]}
    report = run(Supervisor(build_agents()), request)
    assert statuses(report)["tracing"] is Status.FAILED
    assert report.status == "partial"


def test_run_deadline_cancels_slow_work():
    agents = build_agents(delays={"logs": 1.0, "metrics": 1.0, "deploys": 1.0}, timeout_s=5.0)
    report = run(Supervisor(agents, Budget(deadline_s=0.2)))
    assert report.stop_reason == "deadline"
    assert report.status == "failed"
    assert report.needs_human
```

```bash title="terminal"
pytest -q
```

The tests assert the shape of the run, not the wording of the summary: steps used, why it stopped, which agents succeeded, whether a human needs to look. Those are the properties that break in production, and they're deterministic once the model sits behind an interface.

<div class="callout tip" data-title="Tip">
  <p>Keep the stub model around after you wire in a real provider. Orchestration tests that use <code>StubModel</code> run in milliseconds and catch budget, routing and timeout regressions on every commit, while slower evaluations against the real model run on a schedule.</p>
</div>

## Production Reality Check

The example is small on purpose. Here is what changes when it isn't.

### Latency adds up across hops

Every sequential hop adds at least one model round trip, so four stages cost roughly four calls of latency before any retries. Parallel fan-out helps only for independent work, and the run is still as slow as its slowest specialist plus aggregation. Add timeouts and a deadline from day one, and measure latency per hop so you know which agent to optimize or remove.

### Context bloat

The easiest "fix" for a confused agent is more history, which is also the fastest way to multiply cost. Pass a compact, typed payload: the task, the evidence it needs, a short summary instead of the transcript. If an agent keeps needing everything the others saw, those agents should probably be one.

### Evaluating a multi-agent system

End-to-end scores tell you something is wrong, not where. Evaluate each agent against its own contract (given this payload, is the result correct and well shaped?) and the whole run against outcomes (right answer, steps, tokens, how often it ended `partial`). The trace-keyed logs are your dataset, and replaying stored traces against a new agent version is a cheap regression test.

### Versioning agents independently

If agents are separate so that teams can ship them separately, treat their messages like any other API. Version the task and result schemas, keep the old version running while callers migrate, and record the agent version in every `Result`. Otherwise one team's prompt change quietly breaks another team's parser, which is the distributed monolith all over again.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>We already split everything into agents. Isn't merging them back a step backwards?</span>
    </div>
  </div>
</div>

It's a step toward something that works. Collapse agents when you see the signs: two agents always called together, handoffs that carry the full context anyway, an agent that only reformats another's output, or failures that keep coming from the seams. Merging turns a lossy hop into a function call inside one context. Rule of thumb: if you can't name which reason (context, permissions, parallelism, ownership) justifies a boundary, remove it.

None of this is exotic. It's the discipline we already apply to services: explicit ownership of the flow, typed contracts, one source of truth for state, budgets everywhere, degraded answers instead of hangs, and a trace id tying it together. Start with one agent. Split only for a reason you can name. And when you split, make sure somebody is always in charge of saying "stop".
