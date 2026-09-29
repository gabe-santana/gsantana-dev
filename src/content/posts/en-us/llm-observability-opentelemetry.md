---
title: "Tracing LLM Agents with OpenTelemetry: Spans, Tokens, Cost and Privacy"
description: "Instrument an agent loop with the OpenTelemetry GenAI conventions, redact content before export, and turn token counts into cost per feature and tenant."
date: 2026-09-18
tags: [AI Agents, Observability, OpenTelemetry, Python, LLM]
tldr:
  - "One agent request is a tree: invoke_agent at the root, chat, execute_tool and retrieval spans under it, named and attributed the way the GenAI semantic conventions say."
  - "Operational metadata goes on spans, content stays off by default and is scrubbed in process before any exporter sees it, and tenant and feature ride along as baggage."
  - "Cost is tokens times a versioned price table, computed from unsampled data; tail sampling keeps errors and slow traces, and eval scores and feedback attach to the trace id."
---

A customer writes to support: "your bot told me it couldn't reach the carrier, twice, and then gave me a tracking link that didn't work". You open the logs for that conversation and find fourteen lines from three services, a `POST https://llm-gateway/v1/chat 200` repeated four times, and one `WARN carrier timeout` with no request id. The same morning, finance asks why the model bill went up 40% last month, and which customer is responsible for it. Nobody can answer either question in less than a day.

Neither question is exotic. Both are about the shape of one request: which model calls it made, which tools it ran, what failed, what got retried and how many tokens each step burned. That shape is a trace, and OpenTelemetry now has semantic conventions for exactly this kind of workload. This post covers what the GenAI conventions define (and how stable they are), where each fact belongs, how to keep prompts and personal data out of your telemetry, how to get cost per feature and per tenant from token counts, and how sampling, evals and user feedback fit in. The hands-on part is a Python agent loop with a fake model and fake tools, instrumented with the real OpenTelemetry SDK, plus an analysis script that reads what it exported. The Naive Junior is along for the ride.

## The Problem & Context

A classic web request is mostly a line: request in, a few queries, response out. An agent request is a tree, and the tree's shape changes from one request to the next. The same question can produce one model call or five. The model may call a tool, get a timeout, try again, call a different tool, and only then answer. A retrieval step adds a few thousand tokens of context to every later call. A provider returns a 429 and your client quietly retries. Each of those steps has its own latency, its own failure modes and, for model calls, its own price.

Logs flatten that tree into lines. Even with a correlation id on every line, you're reconstructing the structure by hand at 2 a.m.: which timeout belonged to which attempt, whether the answer the user saw came before or after the retry, which of the four model calls was the slow one. Metrics go the other way: they aggregate so well that the individual request disappears. "p95 latency of the support endpoint is 6 seconds" tells you something is slow, not that it's the carrier API on the first attempt for orders whose number happens to hit a bad shard.

Generic HTTP instrumentation doesn't save you either. It sees an outgoing `POST` with a status code and a duration. It doesn't know the model name, the finish reason, how many input tokens were served from the provider's cache, or that the request was a tool call. Those are the facts you need to explain latency, cost and quality, and they only exist in your code and in the provider's response.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why not just log the full prompt and response of every call as JSON? Then we can search for anything later.</span>
    </div>
  </div>
</div>

Because it answers the wrong questions and creates new ones. A log line with a 12 KB prompt tells you what was sent, not where the four seconds went or which step failed first. It has no parent-child structure, so you still reconstruct the tree by hand. And it puts every user's messages, including the email addresses and card numbers people paste into chat boxes, into a system that typically has broad read access, long retention and exports to other tools. Content is sometimes useful for debugging, and there is a way to capture it on purpose, but it's the exception, not the default.

The tool for the tree is tracing: one trace per user request, one span per step, with parent-child links and timestamps. If you've seen the pipeline trace panel in [Agentic Mesh Architecture](/en-us/blog/agentic-mesh-architecture-rag-agents/), that's the same idea rendered as a UI: each stage of the request as a timed bar you can open. What's been missing for LLM work was an agreement on what those spans should be called and which attributes they should carry, so that your dashboards, your vendor's UI and the instrumentation libraries all read the same fields. That's what the GenAI semantic conventions are.

## Deep Dive / Architectural Design

### The GenAI semantic conventions, as of September 2026

Two facts before any attribute names. First, the conventions [moved](https://github.com/open-telemetry/semantic-conventions/pull/3696) in May 2026 from the main semantic-conventions repository to a dedicated one, [open-telemetry/semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai). The old pages under [opentelemetry.io/docs/specs/semconv/gen-ai/](https://opentelemetry.io/docs/specs/semconv/gen-ai/) now say "this page has moved" and point there. Second, every GenAI signal is still marked **Development** in the [document status](https://opentelemetry.io/docs/specs/otel/document-status/) sense. The only stable attributes you'll use on these spans are the general ones like `error.type`, `server.address` and `server.port`. Development means names can still change between releases, and they do: in the last few weeks the repository deprecated the per-message finish reason and added usage breakdowns by modality and cache.

With that caveat, here is the core, from the [model spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) and [agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md) documents:

| Operation | Span name | Kind | Attributes that matter most |
|-----------|-----------|------|-----------------------------|
| Model call | `chat {gen_ai.request.model}` | `CLIENT` | `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.response.id`, `gen_ai.response.finish_reasons`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` |
| Tool execution | `execute_tool {gen_ai.tool.name}` | `INTERNAL` | `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.type`, `error.type` |
| Agent invocation | `invoke_agent {gen_ai.agent.name}` | `INTERNAL` in process, `CLIENT` for a remote agent service | `gen_ai.agent.name`, `gen_ai.conversation.id`, summed usage |
| Retrieval | `retrieval {gen_ai.data_source.id}` | `CLIENT` | `gen_ai.data_source.id`, `gen_ai.retrieval.top_k` |

`gen_ai.operation.name` is required on all of them, with well-known values such as `chat`, `generate_content`, `embeddings`, `retrieval`, `execute_tool`, `invoke_agent`, `invoke_workflow` and `plan`. On model spans `gen_ai.provider.name` is also required (`openai`, `anthropic`, `aws.bedrock`, `azure.ai.openai`, `gcp.vertex_ai` and so on; it replaced the older `gen_ai.system`). The spec asks you to set `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `server.address` and `server.port` **when the span is created**, not after the call, because samplers only see attributes that exist at start time.

Two details are easy to get wrong. The usage counters are nested: `gen_ai.usage.input_tokens` SHOULD include cached tokens, and `gen_ai.usage.cache_read.input_tokens` is a subset of it, not an addition. And when the provider reports both billed and consumed counts, you report the billed ones, so that the numbers match the invoice.

Content has its own attributes, all **Opt-In**: `gen_ai.system_instructions`, `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` and `gen_ai.retrieval.query.text`. Messages follow a JSON schema with `role` and a list of typed `parts` (`text`, `tool_call`, `tool_call_response` and others). Where structured attributes aren't supported on spans, which is the case for span attributes in the Python SDK, they're serialized as a JSON string.

The Python instrumentations in [opentelemetry-python-contrib](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/util/opentelemetry-util-genai) follow this with two switches: `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` to emit the latest conventions instead of the old v1.30 shape, and `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` (`NO_CONTENT` by default, or `SPAN_ONLY`, `EVENT_ONLY`, `SPAN_AND_EVENT`) for content.

### What one agent request looks like

Here is a real trace from the code later in this post: a customer asks where their order is, the carrier API times out on the first attempt, the retry succeeds, the model answers. Later that day an online judge scores the answer, and the customer clicks thumbs down anyway.

<div id="llmobs-trace-tree-slot"></div>

A few choices in that tree are deliberate. The two `execute_tool` spans are siblings, not one span, because the retry is a decision the agent loop made: two attempts, two spans, one of them in error. The provider-level retry on a 429 is the opposite case. The spec says that when a transient failure is retried automatically, the span "SHOULD cover the duration of the logical operation with all retries", so a rate-limited `chat` call stays one span and each retry becomes a span event. That's also what you want in practice: "how many model calls did this request make" should not change because the provider was busy.

The root span carries the business context (`app.tenant.id`, `app.feature`) and the summed token counts. The `chat` spans carry the per-call truth. Cost queries read the `chat` spans; the root is for "how expensive was this request" at a glance. Summing both would count every token twice.

### Spans, events and metrics: where each fact goes

The rule I use: spans hold the operational metadata of each step, events hold things that are big, sensitive or happen later, and metrics hold what you alert on.

**Spans** get everything low-risk and bounded: model names, finish reasons, token counts, tool names, error types, retrieval `top_k`, and your own business attributes. They're what you filter and group by when you investigate.

**Events** (log records with an event name, correlated to the span through the trace context) are where the [events document](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md) puts two things. `gen_ai.client.inference.operation.details` is an opt-in event that carries the full request details, including messages, so content can live in a log pipeline with different retention and access rules from traces. `gen_ai.evaluation.result` carries a quality score (`gen_ai.evaluation.name`, `gen_ai.evaluation.score.value`, `gen_ai.evaluation.score.label`) and SHOULD be parented to the span it grades, or carry `gen_ai.response.id` when the span id isn't known. That is the hook for online evals.

**Metrics** are defined in the [metrics document](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md): `gen_ai.client.operation.duration` (histogram, seconds, with recommended buckets from 10 ms to about 82 s), streaming timings like `gen_ai.client.operation.time_to_first_chunk`, agent-level ones like `gen_ai.invoke_agent.inference_calls` and `gen_ai.execute_tool.duration`, and token usage. At the time of writing, token usage is `gen_ai.client.token.usage`, a histogram split by `gen_ai.token.type` (`input` or `output`), and a [pull request under review](https://github.com/open-telemetry/semantic-conventions-genai/pull/374) replaces it with per-type counters. Another reminder to pin versions.

Business context needs one more piece. Tenant and feature are known at the edge of your system, but every span below should carry them so that any query can group by them without joins. [Baggage](https://opentelemetry.io/docs/concepts/signals/baggage/) is the OpenTelemetry mechanism for that: key-value pairs that travel with the context, in process and across services through the `baggage` header. A small span processor copies the keys you care about onto each span at start.

<div class="callout warning" data-title="Warning">
  <p>Baggage is propagated to every downstream service you call over HTTP, including third parties if your client instrumentation injects headers there. A tenant id or a feature name is fine. A user email, a name or a document id is not. Put identifiers you'd be comfortable seeing in a partner's access log, nothing more.</p>
</div>

### Privacy: content is opt-in, and redaction is a pipeline stage

The spec is blunt about content: instructions, inputs and outputs "are considered sensitive and are often large", and instrumentations "SHOULD NOT capture them by default, but SHOULD provide an option for users to opt in". It lists three patterns: don't record content (the default), record it on span attributes (for pre-production or telemetry stores that already comply with your privacy rules), or upload it to separate storage and keep only a reference on the span, which it recommends for production when you need content at all.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Let's turn content capture on in production for now. If legal complains, we delete the data later.</span>
    </div>
  </div>
</div>

"Later" is where this goes wrong. Traces get replicated across backend regions, copied into exported datasets, cached in dashboards and pasted into incident tickets. Deleting one user's messages from all of that on request (which LGPD and GDPR can require) is somewhere between expensive and impossible. Telemetry backends are also designed for broad access: the whole engineering org can usually read them. Keep content off, turn it on for a sampled slice or in staging when you need it, and when you do capture it, scrub it before it leaves the process.

That last part is a pipeline decision, not a property of your code. The order is: stamp context, redact, then export. Redaction runs in process first because that's the only place the raw data exists; a second pass at the Collector with the [redaction processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/redactionprocessor) (an allow list of attribute keys plus blocked value patterns) catches what a service forgot.

<div id="llmobs-pipeline-slot"></div>

Regex redaction is a floor, not a ceiling. It catches emails, card numbers, phone numbers and national ids like the Brazilian CPF. It will not catch a name, an address written in prose, or a medical detail. If content needs to be kept for evaluation or fine-tuning, that's a data product with its own consent, access and retention, and the telemetry pipeline is the wrong place for it.

### Cost attribution from token counts

The spans already have what you need: `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.output_tokens`, plus the tenant and feature stamped from baggage. Cost is arithmetic:

`cost = (input - cached) * input_price + cached * cached_price + output * output_price`

I compute it at query time from a price table versioned with the analysis code, instead of writing a `cost` attribute on every span. Prices change, negotiated discounts apply retroactively, and a mistake in a baked-in attribute lives forever in historical data. Tokens are the fact; money is a view over the fact. Use `gen_ai.response.model` rather than the requested model, because aliases and gateways can route a request to a different model than the one you asked for. And reasoning tokens are already inside `gen_ai.usage.output_tokens` (the spec defines `gen_ai.usage.reasoning.output_tokens` as a subset), so they're priced as output without extra work.

### Sampling: keep the traces that explain something

At scale you can't keep every trace, and head sampling (deciding at the root, before anything happened) keeps a random slice: mostly boring, successful requests.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>A 10% head sampler is fine. If a failure is common enough to matter, it'll show up in the sample.</span>
    </div>
  </div>
</div>

It shows up as a rate, but not as a trace you can open when a specific customer complains, and 90% of the time the trace you need was dropped before it had a chance to fail. With agents it's worse: whether a request is interesting depends on what happened three tool calls in, which a head sampler can't know. Tail sampling decides after the trace is complete. The Collector's [tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor) holds spans in memory for `decision_wait` (30 s by default), then applies policies: keep every trace with an error status, keep every trace above a latency threshold, keep a probabilistic slice of the rest, and optionally keep every trace for a feature you're debugging this week. The hands-on analysis below simulates exactly that policy.

The catch is that tail sampling is stateful: all spans of a trace must reach the same Collector instance. In a multi-instance deployment you put a first tier of Collectors with the [load-balancing exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter), which routes by `traceID` by default, in front of the sampling tier.

### Evals and feedback belong to the trace

An eval score without the trace is a number without a cause. An online judge (an LLM-as-judge, a classifier, a rule) that grades a sample of answers should emit `gen_ai.evaluation.result` parented to the `chat` span it graded. Then "show me the traces where relevance failed" is a filter, and the failing trace shows you the tool timeout that caused the bad answer.

User feedback works the same way, with one difference: it arrives later, from another HTTP request. Return the trace id (or a feedback token that maps to it) with the answer, store it with the conversation, and when the thumbs down arrives, emit an event with that trace id as its parent context. The analysis at the end of this post joins both kinds of event to their traces.

## Hands-On Implementation

The demo is a support agent with three features: `order_status` (one tool call to a carrier API that sometimes times out), `refund_help` (retrieval over refund policies, then an order lookup, on the bigger model) and `summarize_ticket` (one call on the small model with a long input). The model and tools are fakes with deterministic behavior and small sleeps, so everything runs offline in about 20 seconds. The telemetry is the real OpenTelemetry SDK, 1.44.0, the current release when I wrote this.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install "opentelemetry-api==1.44.0" "opentelemetry-sdk==1.44.0"
```

### The fakes

The fake model answers by rule, reports usage like a real API, reads 850 system-prompt tokens from a "provider cache" on follow-up calls, throttles every 30th call with a 429 and has a 4% chance of 400 ms of congestion. The carrier API times out on the first attempt for order numbers divisible by 6, and on both attempts when they're divisible by 12.

```python title="fakes.py"
"""A deterministic stand-in for a model provider and three backend tools."""

import itertools
import random
import re
import time
from dataclasses import dataclass, field

SYSTEM_PROMPT = "You are the support agent for an online store. Use tools for order data. Never invent order ids."
SYSTEM_TOKENS = 850  # instructions plus tool definitions, as the provider would count them


class RateLimited(Exception):
    status_code = 429


class ToolTimeout(Exception):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ModelResponse:
    id: str
    model: str
    text: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0


def _tokens(text: str) -> int:
    return max(1, len(text) // 4)


class FakeModel:
    """Answers by rule instead of by sampling, and reports usage like a real API."""

    LATENCY = {"orion-large": (0.040, 0.0005), "orion-mini": (0.015, 0.0002)}

    def __init__(self, seed: int = 7):
        self._rng = random.Random(seed)
        self._ids = itertools.count(1)
        self._calls = 0

    def complete(self, model: str, messages: list[dict]) -> ModelResponse:
        self._calls += 1
        if self._calls % 30 == 0:
            time.sleep(0.005)
            raise RateLimited("429 Too Many Requests")

        last = messages[-1]
        prompt_tokens = SYSTEM_TOKENS + sum(_tokens(str(m["content"])) for m in messages)
        cached = SYSTEM_TOKENS if len(messages) > 1 else 0
        response_id = f"resp_{next(self._ids):05d}"

        if last["role"] == "user" and (match := re.search(r"ORD-\d{4}", last["content"])):
            tool = "lookup_tracking" if "where" in last["content"].lower() else "get_order"
            call = ToolCall(f"call_{response_id[5:]}", tool, {"order_id": match.group()})
            response = ModelResponse(response_id, model, None, [call], "tool_call", prompt_tokens, 24, cached)
        else:
            text = self._answer(last)
            response = ModelResponse(response_id, model, text, [], "stop", prompt_tokens,
                                     _tokens(text) + self._rng.randint(60, 220), cached)

        base, per_token = self.LATENCY[model]
        congestion = 0.4 if self._rng.random() < 0.04 else 0.0
        time.sleep(base + per_token * response.output_tokens + congestion)
        return response

    @staticmethod
    def _answer(last: dict) -> str:
        if last["role"] == "tool" and "error" in last["content"]:
            return "I couldn't reach the carrier right now. I've logged it, please try again in a few minutes."
        if last["role"] == "tool":
            return f"Here is what I found: {last['content']}"
        return "Summary: customer reports a delayed delivery and asks for a status update."


class Tools:
    def lookup_tracking(self, order_id: str, attempt: int) -> dict:
        number = int(order_id[4:])
        time.sleep(0.012)
        if number % 6 == 0 and (attempt == 1 or number % 12 == 0):
            time.sleep(0.2)
            raise ToolTimeout(f"carrier API timed out for {order_id}")
        return {"order_id": order_id, "status": "in_transit", "eta": "2026-09-21"}

    def get_order(self, order_id: str, attempt: int) -> dict:
        time.sleep(0.006)
        return {"order_id": order_id, "total": "189.90", "currency": "BRL", "refundable": True}

    def search_kb(self, query: str, top_k: int) -> list[dict]:
        time.sleep(0.010)
        policy = "Refunds are accepted within 30 days of delivery for unused items in the original packaging. " * 6
        return [{"id": f"kb-{i}", "score": round(0.9 - i * 0.07, 2), "text": policy} for i in range(top_k)]
```

### The telemetry pipeline

This file is the part you'd reuse. It sets up a tracer provider and a logger provider with a resource, adds the baggage processor, and wraps the exporting processor in a redacting one.

```python title="telemetry.py"
import json
import re
from typing import Sequence

from opentelemetry import baggage, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import LogRecordExporter, LogRecordExportResult, SimpleLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import Event, ReadableSpan, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult

# Business context that every span should carry, copied from baggage at span start.
CONTEXT_KEYS = ("app.tenant.id", "app.feature")

# Attributes that may hold user content. Everything else is operational metadata.
CONTENT_KEYS = {
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.system_instructions",
    "gen_ai.tool.call.arguments",
    "gen_ai.tool.call.result",
    "gen_ai.retrieval.query.text",
}

PII_PATTERNS = [
    (re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), "<email>"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "<card>"),
    (re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"), "<cpf>"),
    (re.compile(r"\+?\d{2}\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b"), "<phone>"),
]
MAX_TEXT_CHARS = 300


def redact_text(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + f"...<{len(text) - MAX_TEXT_CHARS} chars truncated>"
    return text


def scrub(value):
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, dict):
        return {k: scrub(v) for k, v in value.items()}
    return value


def redact(raw: str) -> str:
    # Content attributes are JSON strings; scrub the strings inside and keep the structure valid.
    try:
        return json.dumps(scrub(json.loads(raw)))
    except ValueError:
        return redact_text(raw)


class BaggageAttributesProcessor(SpanProcessor):
    """Stamps tenant and feature on every span, so any span can be grouped without a join."""

    def on_start(self, span, parent_context=None):
        for key in CONTEXT_KEYS:
            value = baggage.get_baggage(key, parent_context)
            if value is not None:
                span.set_attribute(key, str(value))


class RedactingSpanProcessor(SpanProcessor):
    """Scrubs content attributes, then hands a sanitized copy to the exporting processor.

    A finished span is read-only in the SDK, so redaction happens on a copy.
    Wrapping the exporter's processor makes the order explicit: nothing reaches
    the exporter without passing through here first.
    """

    def __init__(self, delegate: SpanProcessor):
        self._delegate = delegate

    def on_start(self, span, parent_context=None):
        self._delegate.on_start(span, parent_context)

    def on_end(self, span: ReadableSpan):
        self._delegate.on_end(
            ReadableSpan(
                name=span.name,
                context=span.context,
                parent=span.parent,
                resource=span.resource,
                attributes=self._clean(span.attributes),
                events=[Event(ev.name, self._clean(ev.attributes), ev.timestamp) for ev in span.events],
                links=span.links,
                kind=span.kind,
                status=span.status,
                start_time=span.start_time,
                end_time=span.end_time,
                instrumentation_scope=span.instrumentation_scope,
            )
        )

    @staticmethod
    def _clean(attributes):
        cleaned = dict(attributes or {})
        for key, value in cleaned.items():
            if key in CONTENT_KEYS and isinstance(value, str):
                cleaned[key] = redact(value)
        return cleaned

    def shutdown(self):
        self._delegate.shutdown()

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return self._delegate.force_flush(timeout_millis)


class JsonLinesSpanExporter(SpanExporter):
    def __init__(self, path: str):
        self._file = open(path, "w", encoding="utf-8")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            self._file.write(span.to_json(indent=None) + "\n")
        return SpanExportResult.SUCCESS

    def shutdown(self):
        self._file.close()


class JsonLinesLogExporter(LogRecordExporter):
    def __init__(self, path: str):
        self._file = open(path, "w", encoding="utf-8")

    def export(self, batch) -> LogRecordExportResult:
        for record in batch:
            self._file.write(record.to_json(indent=None) + "\n")
        return LogRecordExportResult.SUCCESS

    def shutdown(self):
        self._file.close()

    def force_flush(self, timeout_millis: int = 10_000) -> bool:
        self._file.flush()
        return True


def setup(service_name: str, spans_path: str, logs_path: str) -> tuple[TracerProvider, LoggerProvider]:
    resource = Resource.create({"service.name": service_name, "deployment.environment.name": "dev"})

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BaggageAttributesProcessor())
    # SimpleSpanProcessor keeps the demo synchronous; production uses BatchSpanProcessor.
    exporting = SimpleSpanProcessor(JsonLinesSpanExporter(spans_path))
    tracer_provider.add_span_processor(RedactingSpanProcessor(exporting))
    trace.set_tracer_provider(tracer_provider)

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(SimpleLogRecordProcessor(JsonLinesLogExporter(logs_path)))
    set_logger_provider(logger_provider)
    return tracer_provider, logger_provider
```

Why wrap instead of adding two processors? The SDK calls processors in registration order, and a finished span is immutable (`ReadableSpan`), so a "redacting" processor registered next to an exporting one can't change what the exporter already received. Wrapping makes the dependency structural: the exporter only ever sees the sanitized copy. The redaction also parses the JSON content attributes and scrubs the strings inside them, so a truncated message is still valid JSON for whatever UI renders it later. The spec explicitly allows truncating message contents while preserving the structure.

The baggage processor uses the other hook. At `on_start` the span is still writable, so it copies `app.tenant.id` and `app.feature` from the parent context onto every span, including the ones created deep inside libraries you don't control.

### The instrumented agent loop

```python title="agent.py"
import json
import os
import time

from opentelemetry import baggage, context, trace
from opentelemetry._logs import get_logger
from opentelemetry.trace import SpanKind, Status, StatusCode

import telemetry
from fakes import SYSTEM_PROMPT, FakeModel, RateLimited, Tools, ToolTimeout

AGENT = "support-agent"
PROVIDER = "fake_llm"
MODEL_BY_FEATURE = {"order_status": "orion-mini", "refund_help": "orion-large", "summarize_ticket": "orion-mini"}
CAPTURE_CONTENT = os.getenv("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "").upper() in ("SPAN_ONLY", "SPAN_AND_EVENT")

tracer = trace.get_tracer("support-agent", "1.0.0")
events = get_logger("support-agent.events")
llm = FakeModel()
tools = Tools()


def otel_messages(messages: list[dict]) -> str:
    parts = []
    for m in messages:
        if m["role"] == "tool":
            parts.append({"role": "tool", "parts": [{"type": "tool_call_response", "id": m["tool_call_id"], "response": m["content"]}]})
        elif m.get("tool_calls"):
            parts.append({"role": "assistant", "parts": [
                {"type": "tool_call", "id": c.id, "name": c.name, "arguments": c.arguments} for c in m["tool_calls"]]})
        else:
            parts.append({"role": m["role"], "parts": [{"type": "text", "content": m["content"]}]})
    return json.dumps(parts)


def chat(model: str, messages: list[dict]):
    attributes = {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": PROVIDER,
        "gen_ai.request.model": model,
        "gen_ai.request.temperature": 0.0,
        "gen_ai.request.max_tokens": 1024,
        "server.address": "llm.internal.example",
        "server.port": 443,
    }
    with tracer.start_as_current_span(f"chat {model}", kind=SpanKind.CLIENT, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.system_instructions", json.dumps([{"type": "text", "content": SYSTEM_PROMPT}]))
            span.set_attribute("gen_ai.input.messages", otel_messages(messages))
        # One span per logical call: provider retries stay inside it, as events.
        for attempt in range(1, 4):
            try:
                response = llm.complete(model, messages)
                break
            except RateLimited:
                span.add_event("app.retry", {"error.type": "429", "app.retry.attempt": attempt})
                time.sleep(0.05 * attempt)
        else:
            span.set_attribute("error.type", "429")
            span.set_status(Status(StatusCode.ERROR, "rate limited after 3 attempts"))
            raise RateLimited("gave up")

        span.set_attributes({
            "gen_ai.response.id": response.id,
            "gen_ai.response.model": response.model,
            "gen_ai.response.finish_reasons": [response.finish_reason],
            "gen_ai.usage.input_tokens": response.input_tokens,
            "gen_ai.usage.output_tokens": response.output_tokens,
        })
        if response.cache_read_tokens:
            span.set_attribute("gen_ai.usage.cache_read.input_tokens", response.cache_read_tokens)
        if CAPTURE_CONTENT:
            parts = [{"type": "text", "content": response.text}] if response.text else [
                {"type": "tool_call", "id": c.id, "name": c.name, "arguments": c.arguments} for c in response.tool_calls]
            span.set_attribute("gen_ai.output.messages", json.dumps([{"role": "assistant", "parts": parts}]))
        return response, span


def execute_tool(call, attempt: int) -> dict:
    attributes = {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.agent.name": AGENT,
        "gen_ai.tool.name": call.name,
        "gen_ai.tool.call.id": call.id,
        "gen_ai.tool.type": "function",
    }
    with tracer.start_as_current_span(f"execute_tool {call.name}", kind=SpanKind.INTERNAL, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.tool.call.arguments", json.dumps(call.arguments))
        try:
            result = getattr(tools, call.name)(call.arguments["order_id"], attempt)
        except ToolTimeout as exc:
            span.set_attribute("error.type", "timeout")
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            return {"error": "timeout"}
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.tool.call.result", json.dumps(result))
        return result


def retrieve(query: str, top_k: int = 4) -> list[dict]:
    attributes = {
        "gen_ai.operation.name": "retrieval",
        "gen_ai.data_source.id": "kb-refund-policies",
        "gen_ai.retrieval.top_k": top_k,
    }
    with tracer.start_as_current_span("retrieval kb-refund-policies", kind=SpanKind.CLIENT, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.retrieval.query.text", query)
        return tools.search_kb(query, top_k)


def run_agent(conversation_id: str, feature: str, user_text: str) -> dict:
    model = MODEL_BY_FEATURE[feature]
    with tracer.start_as_current_span(f"invoke_agent {AGENT}", kind=SpanKind.INTERNAL, attributes={
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": AGENT,
        "gen_ai.conversation.id": conversation_id,
        "gen_ai.request.model": model,
    }) as agent_span:
        content = user_text
        if feature == "refund_help":
            docs = retrieve(user_text)
            content += "\n\nPolicy excerpts:\n" + "\n".join(d["text"] for d in docs)
        messages = [{"role": "user", "content": content}]
        usage_in = usage_out = 0
        tool_failed = False

        for _ in range(4):  # step budget: an agent loop always needs one
            response, chat_span = chat(model, messages)
            usage_in += response.input_tokens
            usage_out += response.output_tokens
            if not response.tool_calls:
                break
            messages.append({"role": "assistant", "content": "", "tool_calls": response.tool_calls})
            for call in response.tool_calls:
                result = execute_tool(call, attempt=1)
                if "error" in result:
                    result = execute_tool(call, attempt=2)
                tool_failed = tool_failed or "error" in result
                messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})

        agent_span.set_attributes({
            "gen_ai.usage.input_tokens": usage_in,
            "gen_ai.usage.output_tokens": usage_out,
            "gen_ai.response.finish_reasons": [response.finish_reason],
        })
        if tool_failed:
            agent_span.set_attribute("error.type", "tool_failed")
            agent_span.set_status(Status(StatusCode.ERROR, "answered without tool data"))

        # Stand-in for an online judge; a real one runs async, on a sample, and reports the same way.
        score = 2.0 if tool_failed else 4.0 + (int(conversation_id[-2:]) % 2)
        record_evaluation(chat_span, response.id, "Relevance", score)
        ids = agent_span.get_span_context()
        return {"trace_id": ids.trace_id, "span_id": ids.span_id, "tool_failed": tool_failed}


def record_evaluation(span, response_id: str, name: str, score: float) -> None:
    events.emit(
        event_name="gen_ai.evaluation.result",
        context=trace.set_span_in_context(span),  # parents the event to the chat span it grades
        attributes={
            "gen_ai.evaluation.name": name,
            "gen_ai.evaluation.score.value": score,
            "gen_ai.evaluation.score.label": "pass" if score >= 3 else "fail",
            "gen_ai.response.id": response_id,
        },
    )


def record_feedback(trace_id: int, span_id: int, rating: str) -> None:
    # Feedback arrives later, from another request: rebuild the span context from stored ids.
    parent = trace.NonRecordingSpan(trace.SpanContext(trace_id, span_id, is_remote=True,
                                                      trace_flags=trace.TraceFlags(trace.TraceFlags.SAMPLED)))
    events.emit(event_name="app.user_feedback", context=trace.set_span_in_context(parent),
                attributes={"app.feedback.rating": rating})


REQUESTS = {
    "order_status": "Hi, I'm maria.souza@example.com. Where is my order ORD-{n}?",
    "refund_help": "Please refund order ORD-{n} to my card 4111 1111 1111 1111.",
    "summarize_ticket": "Summarize this ticket for the on-call agent: " + "The package was due Monday and has not arrived. " * 60,
}
TENANTS = ["acme", "acme", "globex", "acme", "initech", "globex"]  # acme sends half the traffic


def main() -> None:
    tracer_provider, logger_provider = telemetry.setup("support-agent", "spans.jsonl", "events.jsonl")
    features = ["order_status"] * 5 + ["refund_help"] * 3 + ["summarize_ticket"] * 2
    finished = []
    for i in range(120):
        feature = features[i % len(features)]
        tenant = TENANTS[i % len(TENANTS)]
        ctx = baggage.set_baggage("app.tenant.id", tenant)
        ctx = baggage.set_baggage("app.feature", feature, ctx)
        token = context.attach(ctx)
        try:
            finished.append(run_agent(f"conv_{i:04d}", feature, REQUESTS[feature].format(n=1000 + i)))
        finally:
            context.detach(token)

    for i, result in enumerate(finished):
        if result["tool_failed"] or i % 37 == 0:
            record_feedback(result["trace_id"], result["span_id"], "thumbs_down")

    tracer_provider.shutdown()
    logger_provider.shutdown()
    print(f"requests: {len(finished)}  content capture: {'on' if CAPTURE_CONTENT else 'off'}")


if __name__ == "__main__":
    main()
```

Things worth noticing. The sampling-relevant attributes go into `start_as_current_span(..., attributes=...)`, the response attributes after the call. Content capture reuses `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`, the variable the contrib instrumentations read, so one switch controls your spans and theirs. Tool failures get a low-cardinality `error.type` (`timeout`) and the span status; the message with the order id goes in the status description, not in `error.type`. If you validate tool calls before running them, as in [Deterministic Tool Calling](/en-us/blog/deterministic-tool-calling/), those stable error codes (`CURRENCY_MISMATCH`, `ORDER_NOT_FOUND`) are exactly what belongs in `error.type` on the `execute_tool` span. And `gen_ai.conversation.id` is set because this application owns the conversation; the spec says not to invent one (no fresh UUIDs, no trace ids as a fallback) when you don't have a real one.

### Running it

First with content capture on, to see the redaction work, then with the default (off) for the analysis.

```bash title="terminal"
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=SPAN_ONLY python agent.py
```

```text title="terminal"
requests: 120  content capture: on
```

These are three spans from one `order_status` trace in `spans.jsonl`, trimmed: I removed timestamps, the resource block and the trace context to keep it readable. The email in the user message is gone, the first tool attempt carries `error.type`, and the second model call shows the cached system prompt.

```json title="spans.jsonl (one trace, trimmed)"
{
  "name": "chat orion-mini",
  "kind": "SpanKind.CLIENT",
  "parent_id": "0x97b82b18201929a1",
  "status": { "status_code": "UNSET" },
  "attributes": {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "fake_llm",
    "gen_ai.request.model": "orion-mini",
    "gen_ai.request.temperature": 0.0,
    "gen_ai.request.max_tokens": 1024,
    "server.address": "llm.internal.example",
    "server.port": 443,
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.system_instructions": "[{\"type\": \"text\", \"content\": \"You are the support agent for an online store. Use tools for order data. Never invent order ids.\"}]",
    "gen_ai.input.messages": "[{\"role\": \"user\", \"parts\": [{\"type\": \"text\", \"content\": \"Hi, I'm <email>. Where is my order ORD-1002?\"}]}]",
    "gen_ai.response.id": "resp_00005",
    "gen_ai.response.model": "orion-mini",
    "gen_ai.response.finish_reasons": ["tool_call"],
    "gen_ai.usage.input_tokens": 865,
    "gen_ai.usage.output_tokens": 24,
    "gen_ai.output.messages": "[{\"role\": \"assistant\", \"parts\": [{\"type\": \"tool_call\", \"id\": \"call_00005\", \"name\": \"lookup_tracking\", \"arguments\": {\"order_id\": \"ORD-1002\"}}]}]"
  }
}
{
  "name": "execute_tool lookup_tracking",
  "kind": "SpanKind.INTERNAL",
  "parent_id": "0x97b82b18201929a1",
  "status": { "status_code": "ERROR", "description": "carrier API timed out for ORD-1002" },
  "attributes": {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.agent.name": "support-agent",
    "gen_ai.tool.name": "lookup_tracking",
    "gen_ai.tool.call.id": "call_00005",
    "gen_ai.tool.type": "function",
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.tool.call.arguments": "{\"order_id\": \"ORD-1002\"}",
    "error.type": "timeout"
  }
}
{
  "name": "invoke_agent support-agent",
  "kind": "SpanKind.INTERNAL",
  "parent_id": null,
  "status": { "status_code": "UNSET" },
  "attributes": {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": "support-agent",
    "gen_ai.conversation.id": "conv_0002",
    "gen_ai.request.model": "orion-mini",
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.usage.input_tokens": 1748,
    "gen_ai.usage.output_tokens": 235,
    "gen_ai.response.finish_reasons": ["stop"]
  }
}
```

The final `chat` span of the same trace reported `"gen_ai.usage.input_tokens": 883` with `"gen_ai.usage.cache_read.input_tokens": 850`. On a `refund_help` trace the card number became `<card>` both in the retrieval query and in the model input, and the four policy excerpts were cut to 300 characters each, ending in `...<1977 chars truncated>` inside still-valid JSON. A throttled call looks like this, one span with one event:

```json title="spans.jsonl (events of a chat span, trimmed)"
"name": "chat orion-large",
"events": [{ "name": "app.retry", "attributes": { "error.type": "429", "app.retry.attempt": 1 } }]
```

### The analysis script

This plays the role of your trace backend's query language: it reads the exported spans and events, prices each `chat` span, and joins evals and feedback to their traces. It also simulates a tail sampling policy on the full data.

```python title="analyze.py"
import json
import math
from collections import defaultdict
from datetime import datetime

# USD per million tokens. Illustrative numbers for the fake models, versioned with the code.
PRICES = {
    "orion-large": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
    "orion-mini": {"input": 0.25, "cached_input": 0.025, "output": 2.00},
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def seconds(span):
    start = datetime.fromisoformat(span["start_time"])
    end = datetime.fromisoformat(span["end_time"])
    return (end - start).total_seconds()


def p(values, q):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(q * len(ordered)) - 1)]


def cost(attrs):
    price = PRICES[attrs["gen_ai.response.model"]]
    cached = attrs.get("gen_ai.usage.cache_read.input_tokens", 0)
    fresh = attrs["gen_ai.usage.input_tokens"] - cached
    return (fresh * price["input"] + cached * price["cached_input"]
            + attrs["gen_ai.usage.output_tokens"] * price["output"]) / 1_000_000


spans = load("spans.jsonl")
events = load("events.jsonl")
op = lambda s: s["attributes"].get("gen_ai.operation.name")
agents = [s for s in spans if op(s) == "invoke_agent"]
chats = [s for s in spans if op(s) == "chat"]
tool_calls = [s for s in spans if op(s) == "execute_tool"]

print("== cost and latency per feature")
by_feature = defaultdict(lambda: {"cost": 0.0, "tokens": 0, "latency": [], "requests": 0})
for s in chats:
    f = by_feature[s["attributes"]["app.feature"]]
    f["cost"] += cost(s["attributes"])
    f["tokens"] += s["attributes"]["gen_ai.usage.input_tokens"] + s["attributes"]["gen_ai.usage.output_tokens"]
for s in agents:
    f = by_feature[s["attributes"]["app.feature"]]
    f["requests"] += 1
    f["latency"].append(seconds(s))
print(f"{'feature':<18}{'requests':>9}{'cost USD':>11}{'USD/1k req':>12}{'tokens/req':>12}{'p95 s':>8}")
for name, f in sorted(by_feature.items(), key=lambda kv: -kv[1]["cost"]):
    print(f"{name:<18}{f['requests']:>9}{f['cost']:>11.4f}{1000 * f['cost'] / f['requests']:>12.2f}"
          f"{f['tokens'] // f['requests']:>12}{p(f['latency'], 0.95):>8.3f}")

print("\n== cost per tenant")
by_tenant = defaultdict(float)
for s in chats:
    by_tenant[s["attributes"]["app.tenant.id"]] += cost(s["attributes"])
for tenant, total in sorted(by_tenant.items(), key=lambda kv: -kv[1]):
    print(f"{tenant:<18}{total:>11.4f}")

print("\n== chat latency per model")
by_model = defaultdict(list)
for s in chats:
    by_model[s["attributes"]["gen_ai.request.model"]].append(seconds(s))
for model, values in sorted(by_model.items()):
    print(f"{model:<18}calls={len(values):<5}p50={p(values, 0.5):.3f}s  p95={p(values, 0.95):.3f}s  max={max(values):.3f}s")
retries = sum(1 for s in chats for ev in s["events"] if ev["name"] == "app.retry")
print(f"provider retries recorded as span events: {retries}")

print("\n== tools")
by_tool = defaultdict(lambda: [0, 0])
for s in tool_calls:
    t = by_tool[s["attributes"]["gen_ai.tool.name"]]
    t[0] += 1
    t[1] += s["status"]["status_code"] == "ERROR"
for tool, (calls, errors) in sorted(by_tool.items()):
    print(f"{tool:<18}calls={calls:<5}errors={errors:<4}error rate={errors / calls:.1%}")
failed = sum(1 for s in agents if s["attributes"].get("error.type") == "tool_failed")
print(f"requests answered without tool data: {failed} of {len(agents)}")

print("\n== quality signals joined to traces")
trace_of = {s["context"]["trace_id"]: s for s in agents}
scores = defaultdict(list)
for ev in events:
    if ev["event_name"] == "gen_ai.evaluation.result":
        root = trace_of[ev["trace_id"]]
        scores[root["attributes"]["app.feature"]].append(ev["attributes"]["gen_ai.evaluation.score.value"])
for feature, values in sorted(scores.items()):
    fails = sum(v < 3 for v in values)
    print(f"{feature:<18}relevance avg={sum(values) / len(values):.2f}  fail={fails}")
down = [ev for ev in events if ev["event_name"] == "app.user_feedback"]
with_errors = sum(1 for ev in down if trace_of[ev["trace_id"]]["status"]["status_code"] == "ERROR")
print(f"thumbs down: {len(down)}, of which {with_errors} land on traces with an error status")

print("\n== what a tail sampling policy would keep")
kept = [s for s in agents if s["status"]["status_code"] == "ERROR" or seconds(s) > 0.5
        or int(s["context"]["trace_id"], 16) % 10 == 0]
print(f"keep errors + slow (>500 ms) + 10% of the rest: {len(kept)} of {len(agents)} traces "
      f"({len(kept) / len(agents):.0%}), {sum(s['status']['status_code'] == 'ERROR' for s in kept)} errors kept")
```

```bash title="terminal"
python agent.py && python analyze.py
```

```text title="terminal"
requests: 120  content capture: off
== cost and latency per feature
feature            requests   cost USD  USD/1k req  tokens/req   p95 s
refund_help              36     0.3296        9.16        3055   0.284
order_status             60     0.0361        0.60        1925   0.505
summarize_ticket         24     0.0169        0.71        1736   0.063

== cost per tenant
acme                   0.2075
globex                 0.1255
initech                0.0496

== chat latency per model
orion-large       calls=72   p50=0.091s  p95=0.160s  max=0.452s
orion-mini        calls=144  p50=0.037s  p95=0.098s  max=0.450s
provider retries recorded as span events: 7

== tools
get_order         calls=36   errors=0   error rate=0.0%
lookup_tracking   calls=72   errors=18  error rate=25.0%
requests answered without tool data: 6 of 120

== quality signals joined to traces
order_status      relevance avg=4.20  fail=6
refund_help       relevance avg=4.67  fail=0
summarize_ticket  relevance avg=4.50  fail=0
thumbs down: 10, of which 6 land on traces with an error status

== what a tail sampling policy would keep
keep errors + slow (>500 ms) + 10% of the rest: 26 of 120 traces (22%), 6 errors kept
```

The latencies are small because the fakes sleep for milliseconds, but the shape is what you'd see in production, and it says things no log search would.

`refund_help` is 30% of the requests and 86% of the cost ($0.3296 of $0.3826). It runs on the big model and carries four retrieved policy excerpts into every call. That's a concrete lever: a cheaper model for this feature, fewer or shorter chunks, or a longer cached prefix. Per tenant, acme accounts for 54% of the spend, which is what you'd show when someone asks whether its plan is priced right.

`order_status` has the worst p95 (0.505 s) while running on the fastest model (p95 0.098 s per call). The model isn't the problem; the carrier timeouts and their retries are. `lookup_tracking` fails 25% of the time per call, yet only 6 of 120 requests (5%) ended without tool data, because the retry absorbs most failures and pays for it in latency. Both numbers matter: the per-call rate tells the team that owns the carrier integration they have a problem, the per-request rate tells you what users felt.

The 7 provider retries didn't create 7 extra spans. Call counts stay honest, and the retries are still visible as events if you ask.

The quality section joins evals and feedback by trace id. All 6 failed relevance scores are on `order_status` traces with a tool failure. Of the 10 thumbs down, 6 land on traces with an error status. The other 4 land on traces that look healthy by every operational measure, which is exactly where you go read content (with capture enabled on a sample) to find a quality problem telemetry can't see.

Finally, the simulated tail policy kept 26 of 120 traces (22%) and all 6 errors. With realistic traffic, where errors and slow requests are rarer than in this demo, the same policy keeps a much smaller share. The 10% slice uses the trace id, which is random, so that number moves a little between runs; the error count doesn't.

### Pointing it at a real backend

The JSON-lines exporters are for the demo. In a service you replace them with the OTLP exporter and a `BatchSpanProcessor`, keep the baggage and redaction processors exactly as they are, and send to a Collector. This part is illustrative configuration, not something I ran for this post:

```python title="telemetry_otlp.py (illustrative)"
# pip install opentelemetry-exporter-otlp-proto-grpc
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor

exporting = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True))
tracer_provider.add_span_processor(RedactingSpanProcessor(exporting))
```

Jaeger and Grafana Tempo both accept OTLP directly, so for a local setup you can point the exporter at them and skip the Collector. For Azure Monitor and Application Insights, the Azure Monitor OpenTelemetry distro (`pip install azure-monitor-opentelemetry`, then `configure_azure_monitor(connection_string=...)`, see the [Microsoft docs](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable?tabs=python)) sets up the providers for you; or keep OTLP in the app and use the Collector's `azuremonitor` exporter. The Collector is where tail sampling and the second redaction pass live:

```yaml title="otel-collector.yaml (illustrative)"
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  redaction:
    allow_all_keys: true
    blocked_values:
      - "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+"
  tail_sampling:
    decision_wait: 30s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 8000 }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }
  batch: {}

connectors:
  spanmetrics:
    dimensions:
      - name: gen_ai.operation.name
      - name: gen_ai.request.model
      - name: app.feature

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls: { insecure: true }
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write

service:
  pipelines:
    traces/all:
      receivers: [otlp]
      processors: [redaction, batch]
      exporters: [spanmetrics]
    traces/sampled:
      receivers: [otlp]
      processors: [redaction, tail_sampling, batch]
      exporters: [otlp/tempo]
    metrics/spans:
      receivers: [spanmetrics]
      exporters: [prometheusremotewrite]
```

Two pipelines read the same receiver on purpose: the [spanmetrics connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector) sees 100% of the spans, so call counts, error rates and latency histograms are exact, and only the trace storage is sampled.

## Production Reality Check

### Never compute cost from sampled traces

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>The trace backend has every token count. I'll build the cost dashboard as a query that sums them per feature.</span>
    </div>
  </div>
</div>

It has every token count of the traces you kept. After tail sampling that's errors, slow requests and a random slice, which is a biased sample: slow requests are often the long, expensive ones, so the sum is wrong in both directions at once. My analysis script gets away with it because it reads unsampled spans. In production, cost needs an unsampled source: a token counter recorded in process (the `gen_ai.client.token.usage` metric, with feature and model as dimensions), a Collector pipeline that aggregates before sampling, or the provider's usage export reconciled monthly. Use traces to explain a cost number, not to produce it.

### The conventions will move under you

Development status is not a formality. Between July and September 2026 the repository added `fetch_response` spans, deprecated the per-message finish reason, added usage breakdowns by modality and cache, and started reworking the token metrics. Pin the SDK and instrumentation versions, set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` deliberately rather than by accident, and keep your dashboards on a small set of attributes that have been stable in practice for a while (`gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.tool.name`, `error.type`). When a rename lands, a dashboard that reads both names for a release is cheaper than an outage in your cost report.

### Cardinality decides what can be a metric

Anything you put on a span can be searched. Anything you promote to a metric dimension multiplies your series count. Model, operation, feature and tool name are bounded and fine. Tenant is fine if you have dozens or hundreds, not if you have a million self-service accounts. User id, conversation id, response id and prompt text never belong in metric dimensions; they belong on spans, where cardinality is free. The spanmetrics connector will happily create a series per conversation if you ask it to, and your metrics bill will tell you about it the next month.

### Dashboards and alerts worth having

A short list that earns its screen space:

- **p95 latency per model and operation**, from `gen_ai.client.operation.duration` or spanmetrics. Alert on a regression after a deploy or a prompt version change (`gen_ai.prompt.name` and `gen_ai.prompt.version` exist for this).
- **Tokens per request by feature**, input and output separately. A creeping input count is usually a retrieval change or a conversation history that nobody trims.
- **Tool error rate per tool, per call and per request.** Page on per-request, ticket on per-call.
- **Cost per feature per day against a budget**, from the unsampled source. Alert on a daily anomaly, not on a monthly total you learn about too late.
- **Finish reasons.** A rising share of `length` means truncated answers; a rising share of `content_filter` means a prompt or user population change.
- **429 and retry rate per provider**, from the span events. Retries are the cheapest early warning of quota trouble, and the place where a resilience policy like the ones in [Building a Resilient .NET API with Polly](/en-us/blog/resilient-dotnet-api-polly/) either saves you or hides the problem.
- **Eval fail rate and thumbs-down rate per feature**, each linking to example traces.

### Smaller things that bite

- **Context across threads and async tasks.** A tool that runs in a thread pool without the parent context starts a new trace. Copy the context into the worker (`contextvars.copy_context()`, or the threading instrumentation), and watch for orphan traces with a single `execute_tool` span.
- **Attribute size limits.** Backends reject or truncate large attribute values, and the SDK has its own `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`. Redact and truncate yourself so the cut happens where you choose.
- **Batch queue drops.** Under load `BatchSpanProcessor` drops spans when its queue is full. Watch the SDK's own logs, and size the queue for your burst, not your average.
- **Streaming.** Record `gen_ai.response.time_to_first_chunk` and end the span when the stream ends, not when the first chunk arrives. A span that closes early makes every streamed call look fast.

Tracing an agent is mostly discipline about where facts go. Name spans the way the GenAI conventions say, set the sampling-relevant attributes at creation, keep content off by default and scrubbed when it's on, stamp tenant and feature from baggage, compute money from tokens outside the trace store, and hang evals and feedback on the trace id. Then the Monday morning questions, why this customer got a bad answer and who is spending the money, become queries instead of investigations.
