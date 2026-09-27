---
title: Observability First
short: If you only instrument after the first big incident, you're debugging in the dark. After all, who wants to find the root cause at 3am with nothing but console.log("here")?
category: solution
---

## Introduction

Picture this: it's 3am, your phone won't stop buzzing, and the checkout is failing for some customers. Not all of them, just some. You open the logs and find this masterpiece:

```text
here
here 2
here
got here!!!
undefined
```

Yep. *It's rare, but it happens all the time*... Who hasn't been there? The code was written in a hurry, "we'll add proper logging later", and later arrived at 3am in the form of an incident. Now you're rebuilding what happened in your head, guessing, redeploying with more `console.log` and praying the problem shows up again.

**Observability First** is the principle that says: **instrumentation is part of the feature, from day one**. The **goal** is simple: when something goes wrong (and it will), the team should be able to answer *what* broke, *where*, *for whom* and *why* in minutes, not hours. In other words, keep MTTR (Mean Time To Recovery) as low as possible.

When a team ignores this principle, the symptoms are always the same:

- Incidents are discovered by customers, on social media, before any alert fires;
- Logs are unstructured text, impossible to filter, with no way to follow one request across services;
- Every incident turns into archaeology: "which service was it? which version? which tenant?";
- Dashboards full of pretty charts that nobody looks at and that don't answer the question of the day;
- Hundreds of alerts per week, most of them noise, so the one that matters gets ignored;
- A telemetry bill that grows faster than traffic, because everything is logged and nothing is useful;
- Customer data (emails, tokens, card numbers) sitting in plain text in log files;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But we do have logs! I put a console.log in every function, and the cloud provider already shows CPU and memory. Isn't that observability?"</span>
    </div>
  </div>
</div>

Easy there, Junior! Having *data* is not the same as having *answers*. A `console.log("here")` tells you the code passed through a line; it doesn't tell you which user, which request, which version, how long it took or what happened in the three other services involved. And CPU at 40% says nothing about whether customers can actually pay. Observability is about being able to ask new questions of your system **without shipping new code** to answer them.

<div class="callout info">
  <p>Observability is not a tool you buy after go-live. It's a design property of the system, like security or testability. If it isn't planned from the start, it has to be retrofitted later, under pressure, usually in the middle of an incident.</p>
</div>

## Why MTTR Is the Metric That Matters

Every incident has a timeline. Something breaks, someone (or something) notices, someone takes ownership, the team figures out what's going on, and finally the service is restored. Each of those stretches has a name, and each one can be shortened, or stretched, by how well the system is instrumented.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="obs-d1-title obs-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d1-title">Incident timeline: MTTD, MTTA and MTTR</title>
<desc id="obs-d1-desc">A timeline from the moment a failure starts until the service is restored. Detection, acknowledgement, diagnosis and fix are shown as consecutive segments, and MTTR spans the whole interval.</desc>
<defs><marker id="obs-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">INCIDENT TIMELINE</text>
<text x="60" y="92" text-anchor="middle" class="d-small">Failure</text>
<text x="60" y="108" text-anchor="middle" class="d-small">starts</text>
<text x="240" y="92" text-anchor="middle" class="d-small">Detected</text>
<text x="240" y="108" text-anchor="middle" class="d-small">(alert fires)</text>
<text x="340" y="92" text-anchor="middle" class="d-small">Acknowledged</text>
<text x="340" y="108" text-anchor="middle" class="d-small">(on-call)</text>
<text x="540" y="92" text-anchor="middle" class="d-small">Root cause</text>
<text x="540" y="108" text-anchor="middle" class="d-small">found</text>
<text x="640" y="92" text-anchor="middle" class="d-small">Service</text>
<text x="640" y="108" text-anchor="middle" class="d-small">restored</text>
<line x1="40" y1="140" x2="690" y2="140" class="d-line" marker-end="url(#obs-d1-arrow)"/>
<circle cx="60" cy="140" r="6" class="d-fill-danger"/>
<circle cx="240" cy="140" r="6" class="d-fill-warn"/>
<circle cx="340" cy="140" r="6" class="d-fill-warn"/>
<circle cx="540" cy="140" r="6" class="d-fill-info"/>
<circle cx="640" cy="140" r="6" class="d-fill-accent"/>
<rect x="60" y="165" width="180" height="36" rx="10" class="d-box-danger"/>
<text x="150" y="188" text-anchor="middle" class="d-text">MTTD</text>
<rect x="240" y="165" width="100" height="36" rx="10" class="d-box-warn"/>
<text x="290" y="188" text-anchor="middle" class="d-text">MTTA</text>
<rect x="340" y="165" width="200" height="36" rx="10" class="d-box-info"/>
<text x="440" y="188" text-anchor="middle" class="d-text">Diagnose</text>
<rect x="540" y="165" width="100" height="36" rx="10" class="d-box-accent"/>
<text x="590" y="188" text-anchor="middle" class="d-text">Fix</text>
<line x1="62" y1="225" x2="638" y2="225" class="d-line-accent" marker-start="url(#obs-d1-arrow)" marker-end="url(#obs-d1-arrow)"/>
<text x="350" y="248" text-anchor="middle" class="d-small">MTTR: from failure to recovery</text>
<text x="350" y="275" text-anchor="middle" class="d-small">Good telemetry shrinks the red and blue segments the most</text>
</svg>
</div>
<figcaption>Figure 1: The incident timeline and where observability pays off</figcaption>
</figure>

- **MTTD (Mean Time To Detect):** how long between the failure starting and someone knowing about it. Without good alerts, this is measured in "how long until a customer complains".
- **MTTA (Mean Time To Acknowledge):** how long until someone takes ownership. This is mostly about on-call process and alert quality.
- **Diagnose:** the stretch nobody names but everybody suffers through. This is where the `console.log("here")` team loses hours.
- **MTTR (Mean Time To Recovery/Restore):** the whole trip, from failure to service restored. Definitions vary between companies (some start at detection), so agree on one and stick to it.

Notice something: the *fix* is often the short part. Rolling back a deploy or flipping a feature flag takes minutes. What eats the night is **not knowing**. That's exactly the part observability attacks.

<div class="callout tip">
  <p>The on-call rotation, runbooks, postmortems and the whole culture around incidents belong to <a href="/en-us/principles/cloud/operational-excellence/">Operational Excellence</a>. Here we focus on the technical foundation that makes those practices work: the signals your system emits.</p>
</div>

## Monitoring vs Observability

These two words get used interchangeably, but they answer different questions.

**Monitoring** deals with **known unknowns**: you already know what can go wrong, so you watch for it. "Alert me if the disk is above 90%", "alert me if the error rate is above 2%". It's essential, but it only covers the failures you imagined in advance.

**Observability** deals with **unknown unknowns**: the failures nobody predicted. "Why are only customers from the Northeast, on the Android app, using a specific coupon, getting timeouts since Tuesday's deploy?" No dashboard was built for that question. An observable system lets you slice the telemetry by any dimension (region, app version, coupon, tenant, feature flag) and find the answer by exploring, not by redeploying.

| Aspect | Monitoring | Observability |
| :--- | :--- | :--- |
| **Question type** | Known in advance | Discovered during the investigation |
| **Typical artifact** | Dashboards and threshold alerts | Queryable, high-context telemetry |
| **Answers** | "Is it broken?" | "Why is it broken, and for whom?" |
| **Depends on** | Choosing the right metrics | Rich context on every event (IDs, versions, attributes) |

Monitoring is a subset of observability, not a competitor. You still need your alerts; you just need them to be the starting point of an investigation, not the end of it.

## The Signals

Telemetry comes in a few flavors. Each one is good at something and bad at something else, and the magic happens when they're **connected**.

### Logs

Discrete events with context: "order 123 was rejected because the card was declined". Great for detail, expensive at volume. The golden rule is **structured logging**: emit JSON (or another key/value format), not free text. Compare:

```text
Payment failed for user john@example.com, amount 150.00
```

```json
{
  "timestamp": "2026-09-26T03:12:45.123Z",
  "level": "error",
  "service": "checkout",
  "version": "2.14.1",
  "event": "payment.declined",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "user_id": "u_81723",
  "order_id": "ord_5521",
  "amount_cents": 15000,
  "provider": "acme-pay",
  "reason": "insufficient_funds",
  "duration_ms": 842
}
```

The second one can be filtered, aggregated and joined with other signals. It also has no email in it (more on that later). And notice the `trace_id`: that's the thread that ties everything together.

### Metrics

Numbers aggregated over time: requests per second, error rate, p99 latency, queue depth. Cheap to store, fast to query, perfect for alerts and trends. The weakness: they lose individual detail. A metric says "p99 latency went up"; it doesn't say which request or why.

### Traces

A trace follows **one request** across every service it touches. Each hop is a *span*, with start time, duration, attributes and status. Traces answer "where did the time go?" and "which dependency failed?", questions that are almost impossible to answer with logs alone in a distributed system.

### Events and profiles

Two signals that complete the picture:

- **Events:** wide, structured records of meaningful things (a deploy, a feature flag change, a config update). Overlaying deploy markers on your charts answers half the incident questions on its own: "did it start right after the release?"
- **Continuous profiling:** samples of where the CPU and memory are going, down to the function. When the trace says "this span took 2 seconds in our own code", the profile says which function burned them.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="obs-d2-title obs-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d2-title">Logs, traces and metrics connected by a shared ID</title>
<desc id="obs-d2-desc">A single request carries a trace ID. It produces logs, a trace and metrics. Logs link to traces through the trace ID and metrics link to traces through exemplars.</desc>
<defs><marker id="obs-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="250" y="40" width="220" height="70" rx="10" class="d-box-accent"/>
<text x="360" y="70" text-anchor="middle" class="d-title">One request</text>
<text x="360" y="92" text-anchor="middle" class="d-small">trace_id = 4bf92f35...</text>
<line x1="330" y1="110" x2="130" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<line x1="360" y1="110" x2="360" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<line x1="390" y1="110" x2="590" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<rect x="30" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="120" y="208" text-anchor="middle" class="d-title">Logs</text>
<text x="120" y="228" text-anchor="middle" class="d-small">what happened</text>
<text x="120" y="245" text-anchor="middle" class="d-small">discrete events</text>
<rect x="270" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="360" y="208" text-anchor="middle" class="d-title">Traces</text>
<text x="360" y="228" text-anchor="middle" class="d-small">where time went</text>
<text x="360" y="245" text-anchor="middle" class="d-small">path across services</text>
<rect x="510" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="600" y="208" text-anchor="middle" class="d-title">Metrics</text>
<text x="600" y="228" text-anchor="middle" class="d-small">how much, how often</text>
<text x="600" y="245" text-anchor="middle" class="d-small">cheap aggregates</text>
<line x1="212" y1="222" x2="268" y2="222" class="d-line-dashed" marker-start="url(#obs-d2-arrow)" marker-end="url(#obs-d2-arrow)"/>
<line x1="452" y1="222" x2="508" y2="222" class="d-line-dashed" marker-start="url(#obs-d2-arrow)" marker-end="url(#obs-d2-arrow)"/>
<text x="240" y="208" text-anchor="middle" class="d-small">trace_id</text>
<text x="480" y="208" text-anchor="middle" class="d-small">exemplars</text>
<text x="360" y="288" text-anchor="middle" class="d-small">Same ID everywhere: jump from alert to trace to log in a few clicks</text>
</svg>
</div>
<figcaption>Figure 2: The signals are only powerful when they are correlated</figcaption>
</figure>

<div class="callout info">
  <p>The real value isn't in any single signal. It's in the <strong>jump</strong>: the alert fires on a metric, an exemplar takes you to a slow trace, the trace shows the failing span, and the span's <code>trace_id</code> takes you straight to the logs of that exact request. Without correlation, each signal is an island.</p>
</div>

## Correlation IDs and Context Propagation

In a monolith, a request lives in one process and one log file. In a distributed system, a single click can touch an API gateway, three microservices, a queue, a worker and two databases. If each one logs on its own, you get six piles of unrelated lines.

The fix is **context propagation**: an ID is created at the edge and travels with the request through every hop, over HTTP headers, message metadata, gRPC metadata, whatever the transport is. The industry standard is the **W3C Trace Context**, which defines the `traceparent` header:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

Four fields separated by hyphens: the **version** (`00`), the **trace ID** that identifies the whole request, the **parent span ID** of the caller, and the **flags** (`01` means "sampled").

There's also a `tracestate` header for vendor-specific data and **Baggage** for business context you want to carry along (tenant, plan, region). Use baggage sparingly: everything in it travels on every call, and it can leak to third parties if you're not careful.

A few practical rules:

1. **Generate the ID at the edge.** API gateway, load balancer or the first service that receives the request.
2. **Propagate across async boundaries.** Queues and event buses are where context usually dies. Put the `traceparent` in the message headers and restore it in the consumer.
3. **Log the trace ID in every line.** Most logging libraries can inject it automatically from the active context.
4. **Return it to the client.** A `X-Request-Id` (or the trace ID itself) in the response lets support ask "what's the ID on the error screen?" and jump straight to the trace.

<div class="callout warning">
  <p>Keep third-party boundaries in mind. Accepting an incoming <code>traceparent</code> from the public internet is fine for correlation, but don't let external callers force sampling decisions or inject baggage that your services trust blindly.</p>
</div>

## OpenTelemetry: Instrument Once, Send Anywhere

For years, instrumentation meant installing a vendor's agent, using that vendor's SDK and being locked in forever. Changing tools meant re-instrumenting the whole codebase. **OpenTelemetry** (OTel), a CNCF project, fixed that by standardizing the whole chain:

- **API and SDKs** for the major languages, to create spans, metrics and logs;
- **Auto-instrumentation** for popular frameworks and libraries (HTTP servers, database drivers, messaging clients), so you get useful traces with almost no code;
- **OTLP**, the wire protocol that every serious backend now accepts;
- **Semantic conventions**, so an HTTP status code is called the same thing in every language and every tool;
- **The Collector**, a standalone process that receives, processes and exports telemetry.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 290" role="img" aria-labelledby="obs-d3-title obs-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d3-title">OpenTelemetry pipeline</title>
<desc id="obs-d3-desc">Three services instrumented with the OpenTelemetry SDK send telemetry over OTLP to a Collector, which receives, processes (sampling, redaction, batching) and exports it to separate metrics, trace and log backends.</desc>
<defs><marker id="obs-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="24" text-anchor="middle" class="d-label">VENDOR NEUTRAL: SWAP BACKENDS, KEEP THE CODE</text>
<rect x="30" y="50" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="72" text-anchor="middle" class="d-text">API</text>
<text x="110" y="90" text-anchor="middle" class="d-small">OTel SDK</text>
<rect x="30" y="125" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="147" text-anchor="middle" class="d-text">Worker</text>
<text x="110" y="165" text-anchor="middle" class="d-small">OTel SDK</text>
<rect x="30" y="200" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="222" text-anchor="middle" class="d-text">LLM gateway</text>
<text x="110" y="240" text-anchor="middle" class="d-small">OTel SDK</text>
<line x1="190" y1="75" x2="263" y2="75" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="190" y1="150" x2="263" y2="150" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="190" y1="225" x2="263" y2="225" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<text x="228" y="142" text-anchor="middle" class="d-small">OTLP</text>
<rect x="265" y="40" width="210" height="220" rx="10" class="d-box-accent"/>
<text x="370" y="68" text-anchor="middle" class="d-title">OTel Collector</text>
<rect x="285" y="85" width="170" height="40" rx="10" class="d-box-info"/>
<text x="370" y="110" text-anchor="middle" class="d-text">Receive (OTLP)</text>
<rect x="285" y="140" width="170" height="52" rx="10" class="d-box-info"/>
<text x="370" y="162" text-anchor="middle" class="d-text">Process</text>
<text x="370" y="180" text-anchor="middle" class="d-small">sample, redact, batch</text>
<rect x="285" y="207" width="170" height="40" rx="10" class="d-box-info"/>
<text x="370" y="232" text-anchor="middle" class="d-text">Export</text>
<line x1="475" y1="75" x2="548" y2="75" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="475" y1="150" x2="548" y2="150" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="475" y1="225" x2="548" y2="225" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<rect x="550" y="50" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="80" text-anchor="middle" class="d-text">Metrics store</text>
<rect x="550" y="125" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="155" text-anchor="middle" class="d-text">Trace backend</text>
<rect x="550" y="200" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="230" text-anchor="middle" class="d-text">Log store</text>
<text x="370" y="282" text-anchor="middle" class="d-small">The Collector is where cost, privacy and routing decisions live</text>
</svg>
</div>
<figcaption>Figure 3: Services emit OTLP, the Collector decides what goes where</figcaption>
</figure>

Getting started in Node.js is a handful of lines, and auto-instrumentation covers HTTP, Express, database drivers and more:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  serviceName: "checkout",
  traceExporter: new OTLPTraceExporter({ url: "http://otel-collector:4318/v1/traces" }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Auto-instrumentation gives you the skeleton. The meat comes from **business attributes** you add yourself: `order.id`, `payment.provider`, `tenant.id`, `feature_flag.new_checkout`. Those are exactly the dimensions you'll want to slice by at 3am.

```ts
const span = trace.getActiveSpan();
span?.setAttributes({
  "order.id": order.id,
  "payment.provider": provider,
  "cart.items": cart.items.length,
});
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Why all this Collector business? Can't we just install the vendor's agent, point it at their cloud and call it a day?"</span>
    </div>
  </div>
</div>

You can, Junior, and for a small system it might even be fine at first. But think about what happens next year when the contract renewal comes with a 40% increase, or when legal says certain data can't leave the region. With vendor SDKs spread across fifty services, switching means a re-instrumentation project. With OTel in the code and a Collector in the middle, switching is a config change. The Collector also gives you one place to **drop noisy data, redact PII, sample traces and route** signals to different backends (cheap storage for debug logs, premium tool for traces). That's architecture: keeping options open where the cost of change is high.

## What to Measure: RED, USE and the Golden Signals

"Instrument everything" is not a strategy. You need a short list of metrics that tells you, at a glance, whether things are healthy. Three well-known frameworks cover most cases.

### RED (for services)

For every request-driven service (APIs, microservices, endpoints):

- **Rate:** requests per second;
- **Errors:** failed requests per second (or as a percentage);
- **Duration:** latency distribution (p50, p95, p99, never just the average).

### USE (for resources)

Proposed by Brendan Gregg, for every resource (CPU, memory, disks, connection pools, queues):

- **Utilization:** how busy the resource is;
- **Saturation:** how much work is waiting (queue length, pending connections);
- **Errors:** error events on that resource.

### The Four Golden Signals (Google SRE)

From the SRE book: **latency, traffic, errors and saturation**. Basically RED plus saturation, with an important nuance on latency: measure the latency of successful and failed requests separately, because a fast error is still an error and can make your averages look great while customers suffer.

| Framework | Best for | Key question |
| :--- | :--- | :--- |
| **RED** | Services and endpoints | "Are my users being served well?" |
| **USE** | Infrastructure resources | "Is something running out of capacity?" |
| **Golden Signals** | Any user-facing system | "Is the service healthy, from the user's point of view?" |

<div class="callout tip">
  <p>Use percentiles, not averages. An average latency of 200ms can hide that 1% of your requests take 8 seconds. That 1% is often your biggest customers, the ones with the largest carts or the most data.</p>
</div>

## SLIs, SLOs and Alerting on Symptoms

Metrics become truly useful when tied to what the user experiences. That's where SLIs and SLOs come in.

- **SLI (Service Level Indicator):** a measurement of user experience, usually a ratio of good events to total events. Example: "percentage of checkout requests that succeed in under 1 second".
- **SLO (Service Level Objective):** the target for that SLI over a window. Example: "99.5% over 30 days".
- **Error budget:** what's left. At 99.5%, you can "spend" 0.5% of requests on failures. Budget healthy? Ship faster. Budget burning? Slow down and invest in reliability. (The relationship with SLAs and availability design lives in [Reliability](/en-us/principles/cloud/reliability/).)

### Alert on symptoms, not causes

This is the most important alerting rule, and the most ignored. **Cause-based alerts** ("CPU above 80%", "pod restarted", "disk at 85%") fire all the time without any user impact, and still miss the failures you didn't imagine. **Symptom-based alerts** ("checkout error rate above SLO", "p99 latency burning the error budget") fire when users are actually hurting, whatever the cause.

The SRE workbook recommends **burn-rate alerts**: page someone when the error budget is being consumed fast enough to be exhausted soon (for example, 2% of the monthly budget in one hour), and open a ticket for slow burns. This catches both sudden outages and slow degradations, with far less noise than static thresholds.

Every page should pass a simple test:

1. **Is it urgent?** If it can wait until morning, it's a ticket, not a page.
2. **Is it actionable?** If the on-call person can't do anything about it, it shouldn't wake them up.
3. **Does it reflect user impact?** If users don't feel it, question why it's paging.
4. **Does it link to a runbook and a dashboard?** An alert with no context just starts a scavenger hunt.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Worried junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"I don't get it. Why not alert on everything? More alerts means we never miss anything, right?"</span>
    </div>
  </div>
</div>

That's the trap, Junior! It's called **alert fatigue**. When the channel gets 300 alerts a day, people mute it, and the one alert that mattered drowns with the rest. It's the car alarm effect: when every car in the street goes off all the time, nobody even looks out the window anymore. Fewer alerts, each one meaningful, beats a firehose every single time. A healthy target is that almost every page leads to real action; if most are "ignore, it recovers by itself", those alerts need to go.

### Dashboards per audience

A dashboard that tries to serve everyone serves no one. Build them by audience:

| Audience | What it shows | Question it answers |
| :--- | :--- | :--- |
| **Business / product** | Orders per minute, conversion, revenue at risk | "Is the business working right now?" |
| **Service owners** | SLOs, error budget, RED per endpoint, deploy markers | "Is my service healthy, and did the last release hurt it?" |
| **On-call / investigation** | Drill-downs by region, version, tenant; links to traces and logs | "Where exactly is the problem?" |
| **Platform / infra** | USE per resource, saturation, capacity trends | "Is something about to run out?" |

Keep the top of every dashboard for the user-facing symptoms, and the details below. If a panel hasn't been looked at in six months, delete it.

## Observability for LLM and AI Applications

AI features bring their own flavor of "it worked on my machine". The same prompt can produce different answers, latency varies wildly, cost is per token, and failures are often **silent**: the call returns 200 OK with a confidently wrong answer. Traditional telemetry isn't enough.

What to capture for every model call:

- **Tokens in and out**, per request, per feature and per tenant. Tokens are your cost driver, and a prompt that quietly doubled in size shows up here first (tie it to [Cost Transparency](/en-us/principles/solution/cost-transparency/));
- **Latency split**: time to first token and total generation time. For streaming UIs, time to first token is what the user feels;
- **Model and prompt version**, so you can compare quality and cost before and after a change;
- **Tool calls and retrieval steps** as child spans (in RAG or agent flows), so you see which step is slow or failing;
- **Errors, refusals, rate limits and truncations** (the model stopped because it hit the max tokens);
- **Quality signals**: user feedback (thumbs up/down), evaluation scores, guardrail triggers.

OpenTelemetry already has **GenAI semantic conventions** for exactly this (attributes for model name, token usage, operation), so you don't have to invent your own schema.

<div class="callout warning" data-title="Prompts are user data">
  <p>Prompts and responses often contain personal data, confidential documents and secrets that users pasted in. Don't log them all by default. Sample a small percentage, redact PII before storing, restrict who can read them, set a short retention and respect what your privacy policy promises. Content capture should be an explicit, reviewed decision, not a side effect of turning on debug mode.</p>
</div>

## Cardinality, Cost and Sampling

Here comes the part nobody mentions in the vendor demo: telemetry costs money, sometimes a lot of it. It's not unusual to see the observability bill rivaling the compute bill.

### Cardinality

In metrics, every unique combination of label values becomes a separate time series. `http_requests_total{route, status}` with 50 routes and 10 status codes is 500 series. Add `user_id` with a million users and you've just created 500 million series, and a very unpleasant invoice.

- **Metrics:** use labels with bounded values (route template, status class, region, version). Never raw IDs, full URLs, emails or free text.
- **Traces and logs:** this is where high-cardinality data belongs. `user_id`, `order_id` and `tenant_id` as span attributes are perfectly fine, and exactly what makes investigations fast.

### Sampling: head vs tail

You rarely need 100% of traces from a healthy system that handles thousands of requests per second. Sampling keeps a representative subset. The question is **when** you decide.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="obs-d4-title obs-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d4-title">Head sampling versus tail sampling</title>
<desc id="obs-d4-desc">Head sampling decides at the start of a request with a random choice, so it may drop errors. Tail sampling buffers the whole trace and decides after it ends, keeping errors and slow requests plus a small baseline.</desc>
<defs><marker id="obs-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="20" y="20" width="330" height="265" rx="10" class="d-box"/>
<text x="185" y="48" text-anchor="middle" class="d-title">Head sampling</text>
<text x="185" y="68" text-anchor="middle" class="d-small">decided when the request starts</text>
<rect x="50" y="85" width="270" height="50" rx="10" class="d-box-info"/>
<text x="185" y="115" text-anchor="middle" class="d-text">Random: keep 10%</text>
<line x1="160" y1="135" x2="115" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<line x1="210" y1="135" x2="255" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<rect x="50" y="170" width="125" height="70" rx="10" class="d-box-accent"/>
<text x="112" y="194" text-anchor="middle" class="d-text">Kept</text>
<text x="112" y="212" text-anchor="middle" class="d-small">random 10%</text>
<text x="112" y="228" text-anchor="middle" class="d-small">of everything</text>
<rect x="195" y="170" width="125" height="70" rx="10" class="d-box-muted"/>
<text x="257" y="194" text-anchor="middle" class="d-text">Dropped</text>
<text x="257" y="212" text-anchor="middle" class="d-small">90%, errors</text>
<text x="257" y="228" text-anchor="middle" class="d-small">included</text>
<text x="185" y="268" text-anchor="middle" class="d-small">Cheap and simple, blind to errors</text>
<rect x="370" y="20" width="330" height="265" rx="10" class="d-box"/>
<text x="535" y="48" text-anchor="middle" class="d-title">Tail sampling</text>
<text x="535" y="68" text-anchor="middle" class="d-small">decided after the trace ends</text>
<rect x="400" y="85" width="270" height="50" rx="10" class="d-box-info"/>
<text x="535" y="115" text-anchor="middle" class="d-text">Buffer, then inspect</text>
<line x1="510" y1="135" x2="465" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<line x1="560" y1="135" x2="605" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<rect x="400" y="170" width="125" height="70" rx="10" class="d-box-accent"/>
<text x="462" y="194" text-anchor="middle" class="d-text">Kept</text>
<text x="462" y="212" text-anchor="middle" class="d-small">errors + slow</text>
<text x="462" y="228" text-anchor="middle" class="d-small">+ 5% baseline</text>
<rect x="545" y="170" width="125" height="70" rx="10" class="d-box-muted"/>
<text x="607" y="194" text-anchor="middle" class="d-text">Dropped</text>
<text x="607" y="212" text-anchor="middle" class="d-small">fast, healthy</text>
<text x="607" y="228" text-anchor="middle" class="d-small">successes</text>
<text x="535" y="268" text-anchor="middle" class="d-small">Keeps what matters, costs memory</text>
</svg>
</div>
<figcaption>Figure 4: Head sampling is cheap, tail sampling is smart</figcaption>
</figure>

- **Head sampling:** decided at the start of the request, usually at random (keep 10%), and propagated through the `traceparent` flag so every service agrees. Cheap and simple, but it's a coin flip: the one failed payment you needed may be in the 90% that got dropped.
- **Tail sampling:** the Collector buffers all spans of a trace and decides after it finishes: keep every error, every trace above 2 seconds, every request from the VIP tenant, plus a small random baseline. Much smarter, but it needs memory, a routing layer so all spans of a trace reach the same Collector, and more operational care.

A common, pragmatic mix: head sampling at a generous rate in the SDK to limit overhead, tail sampling in the Collector to keep the interesting stuff, and **metrics computed before sampling** so your RED numbers stay accurate.

### Keeping the bill under control

| Approach | Benefit |
| :--- | :--- |
| **Log levels per environment** (debug off in production, switchable at runtime) | Detail when you need it, without paying for it every day. |
| **Retention per signal** (metrics for months, traces for days, debug logs for hours) | Stores each signal for as long as it's actually useful. |
| **Drop and filter in the Collector** (health checks, static assets, chatty libraries) | Cuts volume before it hits the paid backend. |
| **Tiered storage** (hot for recent, cheap object storage for archive) | Compliance and forensics without premium prices. |
| **Showback of telemetry cost per team** | Teams see what their verbosity costs and self-correct. |

## PII and Secrets in Telemetry

Logs are one of the most common places for sensitive data to leak. They're copied to multiple systems, read by many people, kept for months, and rarely treated with the same care as the production database. The OWASP Top 10 even has a dedicated category for security logging and monitoring failures.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So to make debugging easier I'll just log the whole request body and headers, just in case. Can't hurt, right?"</span>
    </div>
  </div>
</div>

It can hurt a lot, Junior. That request body has passwords, card numbers, national ID numbers, addresses. The headers have `Authorization` tokens and session cookies. Log them and you've created a second copy of your most sensitive data, with weaker access controls, in a system nobody audits. Under LGPD or GDPR, that's an incident waiting to happen, and anyone with log access can hijack a session with a copied token.

Practical rules:

1. **Log IDs, not identities.** `user_id: u_81723` instead of name and email. You can look up the person when you really need to, with proper access.
2. **Allowlist, don't blocklist.** Decide which fields go into logs; don't dump everything and try to filter out the bad parts later.
3. **Never log secrets.** Tokens, passwords, API keys, full card numbers, `Authorization` and `Cookie` headers. Redact them in the logger configuration and again in the Collector as a second net.
4. **Classify telemetry like data.** Restrict who can read raw logs and traces, encrypt them, and set retention according to your data policies.
5. **Test it.** Add checks in CI or code review that flag suspicious fields in log statements. This is exactly the spirit of [Security Shift-Left](/en-us/principles/solution/security-shift-left/).

More on protecting data across the whole system in [Security](/en-us/principles/cloud/security/).

## Putting It Into Practice: Observability as Part of "Done"

The heart of this principle is timing. Observability added after the fact is always incomplete, because the person adding it is no longer the one who knows the code best. So make it part of the definition of done.

### 1. Instrument with the feature

**Goal:** every new feature ships with the telemetry needed to operate it.

Before merging, ask: "if this breaks at 3am, what would I need to see?" Add the business attributes, the meaningful log events and the metric that tells you whether the feature is working.

**Benefit:** the knowledge of what matters is captured by the person who has it, while they have it.

### 2. Standardize the basics

**Goal:** every service speaks the same telemetry language.

A shared library or template with OTel configured, structured logging with trace IDs, standard resource attributes (`service.name`, `service.version`, `deployment.environment`) and RED metrics out of the box.

**Benefit:** a new service is observable on day one, and on-call people can navigate any service the same way.

### 3. Define SLOs before go-live

**Goal:** agree on what "healthy" means before users arrive.

Pick one to three SLIs per critical user journey, set realistic targets and create burn-rate alerts. Revisit them after a few weeks of real data.

**Benefit:** alerts reflect user impact from the start, and the team has an objective way to balance features and reliability.

### 4. Test your observability

**Goal:** make sure the telemetry actually answers questions.

During game days or chaos experiments (see [Resilience Patterns](/en-us/principles/solution/resilience-patterns/)), break things on purpose and check: did the alert fire? Did the dashboard show it? Could someone who didn't write the code find the cause using only the telemetry?

**Benefit:** you discover the blind spots on a Tuesday afternoon, not during a real incident.

### 5. Review after every incident

**Goal:** each incident makes the system more observable.

In every postmortem, include the question: "what signal would have let us detect or diagnose this faster?" Then add it.

**Benefit:** observability improves exactly where reality proved it was lacking.

## Tradeoffs

**Observability First** shortens incidents, speeds up diagnosis and gives the team confidence to ship often. But, as with every principle, it pulls on other pillars.

### Tradeoffs with Cost Optimization

Telemetry volume grows with traffic, services and verbosity. Ingestion, indexing and retention can become one of the largest line items in the cloud bill.

High-cardinality metrics and full trace capture multiply storage costs.

The balance comes from sampling, retention policies, dropping noise in the Collector and showing each team what its telemetry costs (see [Cost Optimization](/en-us/principles/cloud/cost-optimization/)).

### Tradeoffs with Security

Telemetry is a copy of what the system does, and it can contain personal data, secrets and business information → a new data store to protect.

Collectors, agents and observability backends are extra components with network access and credentials → a larger attack surface.

Third-party SaaS tools mean data leaving your perimeter, which raises data residency and compliance questions.

### Tradeoffs with Performance Efficiency

Instrumentation has overhead: creating spans, serializing logs and exporting data consume CPU, memory and network. Usually small, but not zero, especially in hot paths.

Synchronous logging to disk or network can add latency. Prefer asynchronous, batched exporters and keep instrumentation out of the tightest loops.

### Tradeoffs with Reliability and Operational Excellence

The observability pipeline is itself a system that can fail. If the Collector falls over, you lose visibility precisely when you might need it most. It must be designed and monitored like any other critical component.

More signals can mean more noise. Without discipline on alerts and dashboards, observability turns into alert fatigue and the team starts ignoring the very thing meant to protect it.

Tools, conventions and SLOs need owners and maintenance, time that competes with feature work.

<div class="callout info">
  <p>The goal isn't maximum telemetry. It's the <strong>minimum telemetry that answers the questions your team will have</strong>, at a cost the business can sustain, without exposing data it shouldn't.</p>
</div>

## Conclusion

**Observability First** is the decision to treat "how will we know what's happening?" as a design question, answered at the same time as "what should this feature do?". It rests on a few pillars: structured, correlated signals; context propagated across every hop; a vendor-neutral foundation like OpenTelemetry; metrics that reflect user experience; alerts on symptoms, not causes; and a conscious approach to cost and privacy.

When it's done well, incidents stop being archaeology. The alert fires before the customer notices, the dashboard points to the right service, the trace points to the right span, and the log tells you why. MTTR drops, the on-call rotation stops being dreaded, and the team gains the confidence to ship more often.

And the 3am call? It might still happen. But this time you'll have more than `console.log("here")` to work with.

## Next Steps

1. **Pick one critical user journey**
Checkout, login, sign-up: choose one, map the services it touches and instrument it end to end with OpenTelemetry and trace IDs in the logs.

2. **Switch to structured logging**
Adopt JSON logs with a standard set of fields (service, version, environment, trace ID) and ban free-text logs in new code.

3. **Define your first SLOs**
One to three SLIs for that journey, realistic targets and burn-rate alerts. Delete at least one noisy cause-based alert in the process.

4. **Put a Collector in the middle**
Route telemetry through an OTel Collector and use it to drop noise, redact sensitive fields and apply sampling.

5. **Audit your logs for PII and secrets**
Search existing logs for emails, tokens and document numbers. Fix the sources and set retention policies that match your data rules.

6. **Make observability part of "done"**
Add "how will we know it's working in production?" to your pull request template and your postmortem checklist.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://opentelemetry.io/docs/" target="_blank" rel="noopener">OpenTelemetry Documentation</a></li>
    <li><a href="https://www.w3.org/TR/trace-context/" target="_blank" rel="noopener">W3C Trace Context</a></li>
    <li><a href="https://sre.google/sre-book/monitoring-distributed-systems/" target="_blank" rel="noopener">Google SRE Book: Monitoring Distributed Systems</a></li>
    <li><a href="https://sre.google/workbook/alerting-on-slos/" target="_blank" rel="noopener">Google SRE Workbook: Alerting on SLOs</a></li>
    <li><a href="https://www.brendangregg.com/usemethod.html" target="_blank" rel="noopener">Brendan Gregg: The USE Method</a></li>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top 10</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
  </ul>
</div>
