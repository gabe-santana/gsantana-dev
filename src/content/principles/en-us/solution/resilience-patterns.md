---
title: Resilience Patterns
short: Everything fails sooner or later, so design your code to bend instead of break. After all, who wants one slow API to take the whole checkout down with it?
category: solution
---

## Introduction

Here's an uncomfortable truth about distributed systems: **something is always failing**. A database is running a slow query, a third-party API is having a bad day, a DNS entry is taking its sweet time to resolve, a pod is being rescheduled right in the middle of your request. The question is never *if* a dependency will fail, it's *what your code does when it happens*.

**Resilience patterns** are the answer to that question at the code and solution level. They're a toolbox of well-known techniques (timeouts, retries, circuit breakers, bulkheads, fallbacks, queues and a few more) that let a system **degrade gracefully instead of failing completely**. The goal isn't to prevent failure; it's to contain it, so that a problem in one corner of the system stays in that corner.

When a team ignores this principle, the symptoms are painfully familiar:

- A single slow dependency freezes the entire application, even the parts that don't use it;
- Thread pools and connection pools run dry during an incident, and the service stops answering health checks;
- Well-meaning retries turn a small hiccup into a full-blown outage (the famous *retry storm*);
- Customers get charged twice because a request was retried and the operation wasn't idempotent;
- A non-critical feature (recommendations, a banner, a tracking pixel) takes down a critical one (payment, login);
- Every incident ends with "we need to add a timeout there", and then nobody does;

Yep, *it's rare, but it happens all the time*... Who hasn't watched a dashboard go red because of a service nobody even remembered was in the request path?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But our cloud provider promises 99.99% availability. If the infrastructure doesn't fail, why do I need all these patterns in my code?"</span>
    </div>
  </div>
</div>

Easy there, Junior! That 99.99% is for **one** service, measured the provider's way. Your checkout probably calls a database, a cache, a payment gateway, an inventory service, a fraud check and a recommendation engine. Availabilities multiply: six dependencies at 99.9% each give you roughly 99.4% if every one of them is required, which is more than two days of downtime a year. And none of those SLAs cover the most common problem of all: a dependency that is **up, but slow**.

The network is not reliable, latency is not zero and bandwidth is not infinite. Those are the classic *fallacies of distributed computing*, and every resilience pattern exists because someone, somewhere, believed one of them.

<div class="callout info">
  <p>This principle is about what happens <strong>inside your code and your solution design</strong>: how a service behaves when its dependencies misbehave. Infrastructure redundancy, availability zones, SLOs, error budgets and disaster recovery live in the <a href="/en-us/principles/cloud/reliability/">Reliability</a> pillar. The two go hand in hand: redundant infrastructure is of little use if one slow call can still exhaust every thread you have.</p>
</div>

## Anatomy of a Cascading Failure

Let me tell you a story that, with small variations, I've seen in more than one company.

It's Black Friday. The checkout page calls three services: **Payment**, **Inventory** and a **Recommender** that shows "customers also bought" at the bottom of the page. The recommender is the least important of the three; if it disappeared, most customers wouldn't even notice.

Then the recommender's database starts struggling under the load. It doesn't go down. It just gets slow: each call now takes 30 seconds instead of 50 milliseconds. The checkout service has no timeout on that call (the HTTP client default was good enough, right?), so every checkout request now sits there, holding a thread and a connection, waiting for recommendations.

In a couple of minutes, every thread in the checkout service is blocked waiting on the recommender. New requests queue up. The load balancer's health checks time out, instances get marked unhealthy and are recycled, which throws even more load on the survivors. Payment and Inventory are perfectly healthy, but nobody can buy anything. **One slow, non-critical dependency took down the whole checkout.**

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="res-d1-title res-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d1-title">A cascading failure, with and without protection</title>
<desc id="res-d1-desc">On the left, a slow recommender blocks every checkout thread and the whole checkout fails. On the right, a timeout, a bulkhead and a fallback isolate the slow recommender and checkout keeps serving in degraded mode.</desc>
<defs><marker id="res-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="185" y="28" text-anchor="middle" class="d-label">WITHOUT PROTECTION</text>
<rect x="95" y="46" width="180" height="60" rx="10" class="d-box-danger"/>
<text x="185" y="72" text-anchor="middle" class="d-title">Checkout</text>
<text x="185" y="92" text-anchor="middle" class="d-small">all threads blocked</text>
<line x1="185" y1="106" x2="74" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="185" y1="106" x2="185" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="185" y1="106" x2="296" y2="180" class="d-line-danger" marker-end="url(#res-d1-arrow)"/>
<rect x="22" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="74" y="208" text-anchor="middle" class="d-title">Payment</text>
<text x="74" y="228" text-anchor="middle" class="d-small">healthy</text>
<rect x="133" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="185" y="208" text-anchor="middle" class="d-title">Inventory</text>
<text x="185" y="228" text-anchor="middle" class="d-small">healthy</text>
<rect x="244" y="180" width="104" height="70" rx="10" class="d-box-danger"/>
<text x="296" y="208" text-anchor="middle" class="d-title">Recommender</text>
<text x="296" y="228" text-anchor="middle" class="d-small">30 s per call</text>
<text x="185" y="284" text-anchor="middle" class="d-small">one slow call blocks</text>
<text x="185" y="302" text-anchor="middle" class="d-small">every checkout request</text>
<line x1="360" y1="40" x2="360" y2="300" class="d-line-dashed"/>
<text x="535" y="28" text-anchor="middle" class="d-label">WITH TIMEOUT + BULKHEAD</text>
<rect x="445" y="46" width="180" height="60" rx="10" class="d-box-accent"/>
<text x="535" y="72" text-anchor="middle" class="d-title">Checkout</text>
<text x="535" y="92" text-anchor="middle" class="d-small">keeps selling</text>
<line x1="535" y1="106" x2="424" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="535" y1="106" x2="535" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="535" y1="106" x2="646" y2="180" class="d-line-dashed" marker-end="url(#res-d1-arrow)"/>
<rect x="372" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="424" y="208" text-anchor="middle" class="d-title">Payment</text>
<text x="424" y="228" text-anchor="middle" class="d-small">healthy</text>
<rect x="483" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="535" y="208" text-anchor="middle" class="d-title">Inventory</text>
<text x="535" y="228" text-anchor="middle" class="d-small">healthy</text>
<rect x="594" y="180" width="104" height="70" rx="10" class="d-box-warn"/>
<text x="646" y="204" text-anchor="middle" class="d-title">Recommender</text>
<text x="646" y="222" text-anchor="middle" class="d-small">300 ms timeout</text>
<text x="646" y="240" text-anchor="middle" class="d-small">cached fallback</text>
<text x="535" y="284" text-anchor="middle" class="d-small">the slow part is isolated:</text>
<text x="535" y="302" text-anchor="middle" class="d-small">degraded, not down</text>
</svg>
</div>
<figcaption>Figure 1: The same slow dependency, with and without resilience patterns</figcaption>
</figure>

Notice what failed here. Not the infrastructure, not the recommender (it was just slow), but **the way checkout depended on it**. Three small decisions would have changed the ending: a timeout of a few hundred milliseconds, a separate, limited pool for recommender calls, and a fallback that shows a cached "top sellers" list when the call fails. The rest of this article is about those decisions.

## Timeouts: The First Line of Defense

**Goal:** Never wait forever for anything that goes over the network.

If you only adopt one pattern from this article, make it this one. Every call that crosses a process boundary (HTTP, gRPC, database, cache, message broker, file share) needs an explicit timeout.

Why is this even a discussion? Because **the default is often infinite, or close to it**. A few examples that surprise people:

- Python's `requests` library has **no timeout** unless you pass one;
- Java's `HttpURLConnection` defaults its connect and read timeouts to `0`, which means *wait forever*;
- .NET's `HttpClient` defaults to 100 seconds, which is technically finite but, for a user staring at a spinner, might as well be forever;
- Many database drivers and raw sockets block indefinitely on a read unless configured otherwise;

Library authors can't know your latency budget, so they pick "don't break anything" defaults. That's reasonable for a library and terrible for production.

```python
# connect timeout, read timeout (seconds)
response = requests.get(url, timeout=(3.05, 10))
```

### How to choose a timeout

Don't pull numbers out of thin air. Look at the dependency's real latency distribution (this is where [Observability First](/en-us/principles/solution/observability-first/) pays off) and set the timeout a bit above a high percentile, such as the p99, not the average. Then check that it fits your own budget: if your API promises answers in 2 seconds, the sum of the timeouts along the critical path can't be 10.

| Approach | Benefit |
| :--- | :--- |
| **Set connect and read timeouts separately.** Connecting should be fast; reading may legitimately take longer. | A dead host is detected in milliseconds instead of waiting for the full read timeout. |
| **Use a total budget (deadline) per request.** Propagate the remaining time to downstream calls (gRPC deadlines do this natively). | Downstream services stop working on requests whose caller has already given up. |
| **Base values on measured percentiles.** Revisit them when latency profiles change. | Timeouts that fire on real problems, not on normal variation. |
| **Treat a timeout as a failure signal.** Count it, log it, feed it to the circuit breaker. | A timeout is often the first symptom of an incident; make it visible. |

## Retries with Exponential Backoff and Jitter

**Goal:** Recover automatically from transient failures without making things worse.

Many failures are transient: a connection reset, a brief network blip, a `503` during a deploy, a `429 Too Many Requests` from a throttled API. Trying again a moment later often just works. So retries are great, right?

They are, **when done carefully**. Done naively, they're one of the most effective ways to turn a small problem into a big one.

### Retry storms

Picture a service that is struggling at 100% capacity. Every client that gets an error immediately retries, three times. The struggling service now receives up to four times the load at the exact moment it can least handle it. It never recovers, because the retries keep it pinned. That's a **retry storm**, and it's even worse when retries are stacked across layers: if the frontend, the API and the data service each retry 3 times, a single user action can turn into 4 × 4 × 4 = **64 calls** to the poor database at the bottom.

The fix has three parts:

1. **Exponential backoff:** wait longer after each failure (for example 200 ms, 400 ms, 800 ms), giving the dependency room to breathe;
2. **Jitter:** add randomness to each wait, so thousands of clients don't retry at exactly the same instant;
3. **Limits:** a small maximum number of attempts, and ideally a *retry budget* (for example, retries may never exceed 10% of total traffic).

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 285" role="img" aria-labelledby="res-d2-title res-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d2-title">Exponential backoff and the effect of jitter</title>
<desc id="res-d2-desc">The top timeline shows three failed attempts separated by waits of 200, 400 and 800 milliseconds before a fourth attempt succeeds. The bottom compares six clients retrying at the same instant without jitter against six clients spread out over time with jitter.</desc>
<text x="360" y="30" text-anchor="middle" class="d-label">EXPONENTIAL BACKOFF</text>
<line x1="60" y1="110" x2="690" y2="110" class="d-line"/>
<rect x="92" y="72" width="66" height="26" rx="10" class="d-box-muted"/>
<text x="125" y="90" text-anchor="middle" class="d-small">200 ms</text>
<rect x="182" y="72" width="116" height="26" rx="10" class="d-box-muted"/>
<text x="240" y="90" text-anchor="middle" class="d-small">400 ms</text>
<rect x="322" y="72" width="226" height="26" rx="10" class="d-box-muted"/>
<text x="435" y="90" text-anchor="middle" class="d-small">800 ms</text>
<circle cx="80" cy="110" r="9" class="d-fill-danger"/>
<circle cx="170" cy="110" r="9" class="d-fill-danger"/>
<circle cx="310" cy="110" r="9" class="d-fill-danger"/>
<circle cx="560" cy="110" r="9" class="d-fill-accent"/>
<text x="80" y="136" text-anchor="middle" class="d-small">fail</text>
<text x="170" y="136" text-anchor="middle" class="d-small">fail</text>
<text x="310" y="136" text-anchor="middle" class="d-small">fail</text>
<text x="560" y="136" text-anchor="middle" class="d-small">success</text>
<text x="360" y="164" text-anchor="middle" class="d-label">RETRIES FROM SIX CLIENTS</text>
<text x="195" y="184" text-anchor="middle" class="d-small">no jitter: all at once</text>
<text x="540" y="184" text-anchor="middle" class="d-small">with jitter: spread out</text>
<line x1="60" y1="264" x2="330" y2="264" class="d-line"/>
<line x1="390" y1="264" x2="690" y2="264" class="d-line"/>
<circle cx="195" cy="254" r="5" class="d-fill-danger"/>
<circle cx="195" cy="242" r="5" class="d-fill-danger"/>
<circle cx="195" cy="230" r="5" class="d-fill-danger"/>
<circle cx="195" cy="218" r="5" class="d-fill-danger"/>
<circle cx="195" cy="206" r="5" class="d-fill-danger"/>
<circle cx="195" cy="194" r="5" class="d-fill-danger"/>
<circle cx="420" cy="254" r="5" class="d-fill-accent"/>
<circle cx="470" cy="254" r="5" class="d-fill-accent"/>
<circle cx="515" cy="254" r="5" class="d-fill-accent"/>
<circle cx="560" cy="254" r="5" class="d-fill-accent"/>
<circle cx="610" cy="254" r="5" class="d-fill-accent"/>
<circle cx="660" cy="254" r="5" class="d-fill-accent"/>
</svg>
</div>
<figcaption>Figure 2: Backoff gives the dependency room to recover; jitter keeps clients from retrying in lockstep</figcaption>
</figure>

### What (not) to retry

Retry only what is **transient and safe**:

- **Do retry:** timeouts, connection resets, `503 Service Unavailable`, `429 Too Many Requests` (honoring the `Retry-After` header when present), `502`/`504` from a gateway;
- **Don't retry:** `400 Bad Request`, `401`/`403`, `404`, validation errors, business rule violations. Asking again won't change the answer, it just burns capacity;
- **Retry at one layer only**, preferably the one closest to the failing dependency, and let the layers above fail fast.

In .NET, [Polly](https://www.pollydocs.org/) is the de facto library for this. Here's a retry strategy with exponential backoff and jitter in Polly v8 (I go deeper in [Building a Resilient .NET API with Polly](/en-us/blog/resilient-dotnet-api-polly/)):

```csharp
var retry = new RetryStrategyOptions<HttpResponseMessage>
{
    MaxRetryAttempts = 3,
    Delay = TimeSpan.FromMilliseconds(200),
    BackoffType = DelayBackoffType.Exponential,
    UseJitter = true,
    ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
        .Handle<HttpRequestException>()
        .Handle<TimeoutRejectedException>()
        .HandleResult(r => (int)r.StatusCode >= 500
                        || r.StatusCode == HttpStatusCode.TooManyRequests)
};
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Excited junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Got it! So I'll wrap every call in a loop that retries 10 times. If it fails 10 times, then it's really broken, right?"</span>
    </div>
  </div>
</div>

Easy there, Junior! Ten retries with no backoff is exactly the retry storm we just described, with you as the storm. And there's a second trap hiding in that loop: what if the call **did** succeed on the server, but the response got lost on the way back? You retry, and now the customer has two orders and two charges on their card. Which brings us to the pattern that makes retries safe.

### Idempotency: make retries safe

An operation is **idempotent** when doing it twice has the same effect as doing it once. Reads are naturally idempotent. `PUT` and `DELETE` are supposed to be. `POST /payments` is not, unless you design it that way.

The usual design is an **idempotency key**: the client generates a unique key per logical operation and sends it with every attempt. The server records the key with the result of the first successful execution; any retry with the same key gets the stored result instead of running the operation again. Message consumers need the same care, since most brokers deliver *at least once*: store processed message IDs, or make the handler's effects naturally repeatable (upserts instead of inserts, "set status to paid" instead of "add 1 to balance").

I wrote a whole post on this: [Idempotency Keys in Practice](/en-us/blog/idempotency-keys-in-practice/). The short version is: **never add retries to a non-idempotent operation**. Fix the operation first.

## Circuit Breaker

**Goal:** Stop calling a dependency that is clearly failing, fail fast, and check periodically whether it has recovered.

Retries handle short blips. But when a dependency is down for minutes, retrying every request is pointless: each one still waits for its timeout, still holds resources and still adds load to a service that is trying to recover. The **circuit breaker**, popularized by Michael Nygard in *Release It!*, borrows the idea from the electrical panel in your house: when something goes wrong, cut the circuit before the house burns down.

It's a small state machine with three states:

- **Closed:** everything is normal; calls go through, and the breaker tracks failures (errors, timeouts, slow calls) over a sliding window;
- **Open:** the failure rate crossed a threshold; calls fail **immediately**, without touching the dependency, for a configured break duration;
- **Half-open:** the break duration elapsed; a few trial calls are allowed through. If they succeed, the breaker closes; if they fail, it opens again.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="res-d3-title res-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d3-title">Circuit breaker state machine</title>
<desc id="res-d3-desc">Three states: Closed, where calls flow normally; Open, where calls fail fast; and Half-open, where a few trial calls are allowed. Closed moves to Open when the failure rate crosses a threshold, Open moves to Half-open after the break time, Half-open returns to Closed if trial calls succeed or back to Open if they fail.</desc>
<defs><marker id="res-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker><marker id="res-d3-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-danger"/></marker></defs>
<rect x="270" y="30" width="180" height="76" rx="10" class="d-box-warn"/>
<text x="360" y="62" text-anchor="middle" class="d-title">Half-open</text>
<text x="360" y="84" text-anchor="middle" class="d-small">a few trial calls</text>
<rect x="40" y="190" width="180" height="76" rx="10" class="d-box-accent"/>
<text x="130" y="222" text-anchor="middle" class="d-title">Closed</text>
<text x="130" y="244" text-anchor="middle" class="d-small">calls flow normally</text>
<rect x="500" y="190" width="180" height="76" rx="10" class="d-box-danger"/>
<text x="590" y="222" text-anchor="middle" class="d-title">Open</text>
<text x="590" y="244" text-anchor="middle" class="d-small">fail fast, no calls</text>
<line x1="220" y1="240" x2="498" y2="240" class="d-line-danger" marker-end="url(#res-d3-arrow-danger)"/>
<text x="360" y="230" text-anchor="middle" class="d-small">failure rate over threshold</text>
<line x1="600" y1="190" x2="452" y2="52" class="d-line" marker-end="url(#res-d3-arrow)"/>
<text x="560" y="122" text-anchor="start" class="d-small">break time elapses</text>
<line x1="420" y1="106" x2="518" y2="188" class="d-line-danger" marker-end="url(#res-d3-arrow-danger)"/>
<text x="470" y="172" text-anchor="end" class="d-small">trial fails</text>
<line x1="270" y1="68" x2="132" y2="188" class="d-line" marker-end="url(#res-d3-arrow)"/>
<text x="180" y="122" text-anchor="end" class="d-small">trial calls succeed</text>
</svg>
</div>
<figcaption>Figure 3: The three states of a circuit breaker and what moves it between them</figcaption>
</figure>

Failing fast sounds bad, but it's a gift: the caller gets an answer in microseconds instead of waiting for a timeout, its threads are freed immediately, and it can go straight to a fallback. Meanwhile the struggling dependency gets a break from the traffic that was keeping it down.

In Java, [resilience4j](https://resilience4j.readme.io/) is the go-to library (the spiritual successor of Netflix Hystrix, which is in maintenance mode). A breaker that also treats *slow* calls as failures, with a cached fallback:

```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .slowCallRateThreshold(50)
    .slowCallDurationThreshold(Duration.ofSeconds(2))
    .minimumNumberOfCalls(20)
    .waitDurationInOpenState(Duration.ofSeconds(15))
    .permittedNumberOfCallsInHalfOpenState(3)
    .build();

CircuitBreaker breaker = CircuitBreaker.of("recommender", config);

Supplier<List<Product>> guarded = CircuitBreaker
    .decorateSupplier(breaker, () -> recommender.fetch(userId));

List<Product> products = Try.ofSupplier(guarded)
    .recover(ex -> cache.topSellers())
    .get();
```

| Approach | Benefit |
| :--- | :--- |
| **One breaker per dependency** (or per endpoint when behaviors differ). | A failing endpoint doesn't block healthy ones. |
| **Count slow calls, not just errors.** | Catches the "up but slow" case, which is the one that causes cascades. |
| **Require a minimum throughput** before evaluating the failure rate. | Two failures out of three requests at 3 a.m. don't trip the breaker. |
| **Expose the breaker state as a metric** and alert on it. | An open breaker is a clear, early incident signal. |

## Bulkhead

**Goal:** Isolate resources so that a failure in one area can't drain what the others need.

The name comes from ships: the hull is divided into watertight compartments, so a breach floods one compartment instead of sinking the whole vessel. In software, the compartments are **resource pools**.

In our checkout story, the root problem was that every dependency shared the same thread pool. A bulkhead gives each dependency (or each class of work) its own limited pool: at most 20 concurrent calls to the recommender, 50 to payment, and so on. When the recommender gets slow, its 20 slots fill up and further calls are rejected immediately, while payment still has its full capacity.

Bulkheads show up at several levels:

- **In code:** a concurrency limiter or semaphore per dependency (Polly's concurrency limiter, resilience4j's `Bulkhead` and `ThreadPoolBulkhead`);
- **Connection pools:** separate HTTP client or database pool per dependency, instead of one giant shared pool;
- **Deployment:** separate instances or node pools for critical and non-critical workloads, or for different tenants, so a noisy neighbor can't starve everyone else;

The trade-off is utilization: capacity reserved for one compartment sits idle while another one is starving. That's the price of isolation, and for critical paths it's usually worth paying.

## Rate Limiting and Load Shedding

**Goal:** Protect your service from more traffic than it can handle, and when overloaded, drop the least important work first.

Everything so far protects you from your **dependencies**. Rate limiting and load shedding protect you from your **callers**, including the retry storms of other teams.

**Rate limiting** caps how many requests a client can make in a time window (token bucket and sliding window are the classic algorithms). Excess requests get a `429 Too Many Requests`, ideally with a `Retry-After` header so well-behaved clients know when to come back. Limits per client or per API key also keep one aggressive consumer from ruining the experience for everyone.

**Load shedding** is about the server's own health: when it detects it is overloaded (queue depth, CPU, in-flight requests, latency), it starts rejecting work **before** it collapses. The key insight is that a fast "no" is far better than a slow "maybe": a server that tries to serve everyone during an overload ends up serving no one, because every request times out after using resources.

Good load shedding is **prioritized**: shed health-check noise, prefetches, analytics and batch jobs before you shed checkout requests. Tag requests with a criticality level and let the shedder use it.

## Queue-Based Load Leveling

**Goal:** Absorb traffic spikes by putting a queue between producers and consumers, so the consumer works at its own pace.

Not every operation needs to finish while the user waits. Sending the confirmation email, generating the invoice PDF, updating the search index, notifying the warehouse: all of these can happen a few seconds later. Put the request in a queue (Azure Service Bus, Amazon SQS, RabbitMQ, Kafka...) and let workers process it at a steady rate.

The queue acts like a shock absorber. A spike of 10,000 requests in a minute becomes a backlog that the workers drain in the next few minutes, instead of 10,000 concurrent calls hammering a database sized for 500. If a downstream service is completely down, messages simply wait in the queue until it comes back, instead of being lost.

### Dead-letter queues

What about a message that can **never** be processed? A malformed payload, a reference to a customer that was deleted, a bug in the handler. Without care, it gets retried forever, blocking the queue or burning resources (the infamous *poison message*).

A **dead-letter queue (DLQ)** is where messages go after exceeding a maximum number of delivery attempts. Most managed brokers support this natively. The DLQ keeps the main flow moving while preserving the failed message for inspection and replay. Two rules make it useful instead of a black hole:

- **Monitor it.** A DLQ nobody watches is just a slower way of losing data. Alert when it's not empty;
- **Have a replay process.** After fixing the bug, you need a safe way to send those messages back, which, again, requires idempotent handlers.

## Fallbacks and Graceful Degradation

**Goal:** When something fails, give the user the best possible answer instead of an error page.

This is where resilience becomes visible to the customer, and it's more of a product decision than a technical one. For each dependency, ask: **"If this is unavailable, what's the next best thing?"**

| Failure | Possible fallback |
| :--- | :--- |
| Recommender is down | Show a cached list of top sellers, or hide the section |
| Product price service is slow | Serve the last known price from cache, marked with its age |
| Personalization fails | Show the generic, non-personalized page |
| Search engine is overloaded | Fall back to a simpler query, or show popular categories |
| Payment provider A fails | Route to provider B, or accept the order and charge later |
| Feature flag service unreachable | Use the last known flags, or safe defaults |

Common strategies:

- **Serve cached or stale data.** A cache with a *stale-while-revalidate* or *stale-if-error* policy keeps answering from the last good value when the source fails;
- **Disable non-critical features.** Use feature flags or *kill switches* to turn off expensive or failing features during an incident, protecting the core journey;
- **Accept now, process later.** Store the request and complete it asynchronously (queue-based load leveling again);
- **Return a partial response.** Render the page with the parts that worked, with a friendly placeholder for the rest;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Suspicious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wait, serving old data on purpose? Isn't that basically lying to the user?"</span>
    </div>
  </div>
</div>

Good question, Junior, and the answer is: **it depends on the data**. A recommendation list from ten minutes ago? Nobody cares. A product description from yesterday? Fine. An account balance, a stock level for the last unit in the warehouse, the price in a binding quote? That's where stale data becomes a real problem, and the right fallback might be "we can't confirm this right now, please try again in a moment".

That's why fallbacks must be designed **with the business**, not decided by a developer at 2 a.m. during an incident. Classify each piece of data by how stale it can safely be, be transparent when the answer is degraded, and never silently fake a critical result.

## Health Endpoint Monitoring

**Goal:** Let load balancers, orchestrators and monitoring tools know whether an instance can do its job.

A service should expose health endpoints that external tools can call. In Kubernetes and most modern platforms, there are two different questions, and mixing them up is a classic source of outages:

- **Liveness:** "Is this process alive, or is it stuck and should be restarted?" Keep it **simple and local**. It should not check the database or any other dependency;
- **Readiness:** "Can this instance receive traffic right now?" It may check critical dependencies and warm-up state. Failing it takes the instance out of rotation, without restarting it;

Why the insistence on keeping liveness local? Because if the liveness probe checks the database and the database has a hiccup, the orchestrator restarts **every** instance at once. Now you have a database hiccup *and* a cold-starting fleet. A resilience mechanism just caused the cascade it was supposed to prevent.

Some extra care: protect health endpoints from being expensive (cache dependency checks for a few seconds), don't expose sensitive details publicly, and include the state of your circuit breakers in a separate, internal diagnostics endpoint.

## Compensating Transactions and Sagas

**Goal:** Keep data consistent across services when there's no distributed transaction to roll back.

In a monolith with one database, a failed operation simply rolls back. In a distributed system, placing an order might mean reserving stock in the inventory service, charging the card in the payment service and scheduling delivery in the shipping service. Three services, three databases, no shared transaction. If shipping fails after the card was charged, what then?

The **saga** pattern breaks the business operation into a sequence of local transactions, each with a **compensating transaction** that semantically undoes it: release the stock, refund the charge, cancel the delivery. If a step fails, the saga runs the compensations for the steps already completed.

Sagas come in two flavors:

- **Choreography:** each service reacts to events from the others ("PaymentCompleted" triggers shipping). Simple for short flows, hard to follow as they grow;
- **Orchestration:** a central coordinator (a workflow engine such as Temporal, AWS Step Functions or Azure Durable Functions) tells each service what to do and handles compensation. Easier to reason about and monitor;

Two warnings. First, compensation is **not** a rollback: the customer may have seen the charge before the refund, and an email may already have gone out. Design compensations as business actions, with the business. Second, every step and every compensation must be idempotent and retryable, because the saga will retry them. See how all these patterns keep leaning on each other?

## Putting It Together: The Resilience Pipeline

In practice, you rarely use one pattern alone. They're combined in layers around each dependency call, and **the order matters**. A common arrangement, from outside to inside:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="res-d4-title res-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d4-title">Layers of a resilience pipeline</title>
<desc id="res-d4-desc">A call from the caller to a dependency passes through nested layers: fallback on the outside, then a total timeout, then retry with backoff, then a circuit breaker, and finally a timeout for each individual attempt.</desc>
<defs><marker id="res-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="20" y="170" width="90" height="60" rx="10" class="d-box"/>
<text x="65" y="205" text-anchor="middle" class="d-text">Caller</text>
<rect x="130" y="30" width="440" height="250" rx="10" class="d-box-info"/>
<text x="145" y="52" text-anchor="start" class="d-label">FALLBACK</text>
<rect x="150" y="62" width="400" height="206" rx="10" class="d-box"/>
<text x="165" y="84" text-anchor="start" class="d-label">TOTAL TIMEOUT</text>
<rect x="170" y="94" width="360" height="162" rx="10" class="d-box-warn"/>
<text x="185" y="116" text-anchor="start" class="d-label">RETRY + BACKOFF</text>
<rect x="190" y="126" width="320" height="118" rx="10" class="d-box-accent"/>
<text x="205" y="148" text-anchor="start" class="d-label">CIRCUIT BREAKER</text>
<rect x="210" y="158" width="280" height="74" rx="10" class="d-box"/>
<text x="225" y="180" text-anchor="start" class="d-label">ATTEMPT TIMEOUT</text>
<text x="350" y="222" text-anchor="middle" class="d-small">one real call per attempt</text>
<rect x="610" y="170" width="95" height="60" rx="10" class="d-box"/>
<text x="657" y="205" text-anchor="middle" class="d-text">Dependency</text>
<line x1="110" y1="200" x2="608" y2="200" class="d-line-accent" marker-end="url(#res-d4-arrow)"/>
</svg>
</div>
<figcaption>Figure 4: Patterns combined in layers; each layer only sees what the inner ones let through</figcaption>
</figure>

Reading it from the inside out: each **attempt** has its own short timeout; the **circuit breaker** counts those failures and fails fast when the dependency is clearly broken; the **retry** tries again, with backoff, only for transient failures (and doesn't hammer an open breaker); the **total timeout** caps the time spent across all attempts, so retries can't blow your latency budget; and the **fallback** catches whatever is left and returns the best degraded answer.

With Polly v8, that whole pipeline is a few lines:

```csharp
var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddFallback(new FallbackStrategyOptions<HttpResponseMessage>
    {
        FallbackAction = _ => Outcome.FromResultAsValueTask(CachedTopSellers())
    })
    .AddTimeout(TimeSpan.FromSeconds(3))    // total budget
    .AddRetry(retry)                        // the options shown earlier
    .AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
    {
        FailureRatio = 0.5,
        MinimumThroughput = 20,
        SamplingDuration = TimeSpan.FromSeconds(30),
        BreakDuration = TimeSpan.FromSeconds(15)
    })
    .AddTimeout(TimeSpan.FromMilliseconds(500))  // per attempt
    .Build();
```

And if you use `HttpClient` in ASP.NET Core, `Microsoft.Extensions.Http.Resilience` gives you a sensible version of this out of the box with `AddStandardResilienceHandler()`.

### Libraries and where they live

You almost never need to write these patterns from scratch, and you shouldn't: the edge cases (thread safety, sliding windows, half-open concurrency) are subtle.

| Library / tool | Ecosystem | Notes |
| :--- | :--- | :--- |
| **Polly** | .NET | Retry, circuit breaker, timeout, fallback, rate limiter, hedging. Integrated into `Microsoft.Extensions.Http.Resilience`. |
| **resilience4j** | Java / Kotlin | Lightweight, functional style, integrates with Spring Boot and Micrometer. |
| **Hystrix** | Java | The pioneer from Netflix; in maintenance mode, prefer resilience4j for new code. |
| **Tenacity** | Python | Retries with backoff and jitter via decorators. |
| **cockatiel** | Node.js / TypeScript | Polly-inspired policies for JavaScript. |
| **Envoy / Istio / Linkerd** | Service mesh | Timeouts, retries, outlier detection and rate limiting at the network layer, without code changes. |

A service mesh can apply timeouts and retries uniformly across a fleet, which is great for consistency. But be careful not to retry in the mesh **and** in the code (remember the 64 calls), and remember the mesh can't know your business fallbacks. Those stay in the code.

## Adopting Resilience Patterns

Knowing the patterns is the easy part. Applying them consistently is where teams struggle. A practical path:

### 1. Map your dependencies and classify them

List every call your service makes across the network and classify each one: **critical** (the request can't succeed without it) or **optional** (the request can succeed in degraded form).

**Benefit:** you know where you need fail-fast plus fallback, and where you need strong isolation and careful retries.

### 2. Put a timeout on everything

Audit every client: HTTP, database, cache, broker, SDKs. Make timeouts explicit, even when you like the default, so the next person can see the decision.

**Benefit:** eliminates the most common cause of cascading failures with the least effort.

### 3. Standardize the pipeline

Create a shared, well-tested resilience configuration (a library, a base HTTP client, a mesh policy) with good defaults, instead of every team hand-rolling retry loops. This is where [Standardization](/en-us/principles/enterprise/standardization/) meets resilience.

**Benefit:** consistent behavior, fewer subtle bugs, and one place to fix things.

### 4. Make it observable

Emit metrics for retries, timeouts, breaker state changes, rejected bulkhead calls, shed requests and fallback usage. A fallback that silently fires all day is an outage you haven't noticed yet.

**Benefit:** resilience mechanisms become early warning signals instead of places where problems hide.

### 5. Test failure on purpose

Inject latency and errors in lower environments (and, as maturity grows, carefully in production): chaos engineering tools, fault injection in the mesh, or simply a test double that sleeps for 30 seconds. Run game days where the team watches the system degrade.

**Benefit:** you find out that the fallback throws a `NullReferenceException` on a Tuesday afternoon, not on Black Friday.

## Tradeoffs

Resilience patterns make systems sturdier, but they're not free. Each one adds behavior that has to be designed, configured, tested and understood. Let's look at where the bill shows up.

### Tradeoffs with Operational Excellence

**More complexity:** every pattern is another piece of logic with its own configuration (timeouts, thresholds, windows, pool sizes). Badly tuned values can be worse than none: a breaker that trips too easily causes outages of its own.

**Harder debugging:** when a request fails, was it the dependency, the timeout, the open breaker, the bulkhead rejection or the load shedder? Without good telemetry, resilience layers make incidents more confusing, not less.

### Masking real problems

This one deserves its own heading. Retries and fallbacks can **hide** a dependency that is failing 30% of the time: users see slightly slower pages, dashboards stay green, and nobody fixes anything until the day the fallback also fails. Always measure the rate of retries and fallbacks, and treat a rising rate as an incident in the making.

### Tradeoffs with Performance Efficiency

**Added latency:** each retry adds its backoff delay plus another attempt. A request that "succeeds on the third try" might take several times longer than normal. Total timeouts and retry budgets keep this in check.

**Extra load:** retries, health checks and hedged requests (sending a duplicate request to a second replica when the first is slow) all add traffic to dependencies.

### Tradeoffs with Consistency and Data

**Stale data:** serving cached values keeps the page up but may show outdated information; some data can't tolerate that.

**Eventual consistency:** queues and sagas replace immediate, atomic results with "it will be consistent in a moment". That changes the user experience and requires compensations that are business processes, not code rollbacks.

**Duplicates:** at-least-once delivery and retries mean every handler must be idempotent, which is extra design and storage.

### Tradeoffs with Cost Optimization

**More infrastructure:** queues, caches for fallbacks, separate pools for bulkheads and spare capacity for load shedding all cost money. Reserved capacity in one bulkhead sits idle while another is busy.

**More engineering time:** designing fallbacks with the business, writing chaos tests and tuning thresholds take time away from features. See [Cost Optimization](/en-us/principles/cloud/cost-optimization/) for how to weigh that against the cost of downtime.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So if resilience adds complexity, latency and cost... maybe I should just skip it and keep the code simple?"</span>
    </div>
  </div>
</div>

Nice try, Junior! Skipping it doesn't make the failures go away; it just means they'll be handled by your customers and by whoever is on call that night. The trick is **proportionality**: timeouts everywhere (cheap, huge payoff), sensible retries on transient errors, and the heavier machinery (bulkheads, sagas, elaborate fallbacks) where the business impact justifies it. A payment flow deserves more armor than an internal report that runs once a week.

## Conclusion

**Resilience patterns** start from an honest premise: in a distributed system, something is always failing, and the network will eventually betray you. Instead of pretending otherwise, we design code that **expects failure and contains it**: timeouts so we never wait forever, retries with backoff and jitter for transient errors, idempotency so retries are safe, circuit breakers to fail fast, bulkheads to isolate, rate limiting and load shedding to protect ourselves, queues to absorb spikes, fallbacks to degrade gracefully, health endpoints that tell the truth, and sagas to keep data consistent when things go wrong halfway.

None of these patterns is complicated alone. The real skill is in **combining them with judgment**, tuning them with real data, making them observable and agreeing with the business on what "degraded" should look like. Do that, and the next time a dependency slows down on Black Friday, your checkout keeps selling while the incident gets fixed in the background.

## Next Steps

1. **Draw your dependency map**
List every network call your critical flows make and classify each one as critical or optional. This alone will show you where the risks are.

2. **Audit and set timeouts**
Find every client without an explicit timeout and fix it, starting with the critical path. Base the values on real latency percentiles.

3. **Review your retries**
Remove retry loops without backoff, add jitter, retry only transient errors, keep retries to a single layer and make sure the operations being retried are idempotent.

4. **Add circuit breakers and fallbacks to optional dependencies**
Agree with the product team on the fallback for each one, and make sure an open breaker or a firing fallback is visible in your dashboards.

5. **Standardize and observe**
Build a shared resilience configuration for your stack (Polly, resilience4j or the equivalent), and emit metrics for every pattern, following [Observability First](/en-us/principles/solution/observability-first/).

6. **Break things on purpose**
Schedule a game day, inject latency into a dependency and watch what happens. Then fix what surprised you, and complement it with the infrastructure side of the story in [Reliability](/en-us/principles/cloud/reliability/).

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/" target="_blank" rel="noopener">Cloud Design Patterns (Azure Architecture Center)</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/circuit-breaker" target="_blank" rel="noopener">Circuit Breaker pattern (Azure Architecture Center)</a></li>
    <li><a href="https://martinfowler.com/bliki/CircuitBreaker.html" target="_blank" rel="noopener">Martin Fowler: CircuitBreaker</a></li>
    <li><a href="https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/" target="_blank" rel="noopener">Amazon Builders' Library: Timeouts, retries, and backoff with jitter</a></li>
    <li><a href="https://sre.google/sre-book/addressing-cascading-failures/" target="_blank" rel="noopener">Google SRE Book: Addressing Cascading Failures</a></li>
    <li><a href="https://www.pollydocs.org/" target="_blank" rel="noopener">Polly documentation</a></li>
    <li><a href="https://resilience4j.readme.io/" target="_blank" rel="noopener">resilience4j documentation</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/reliability/" target="_blank" rel="noopener">Azure Well-Architected Framework: Reliability</a></li>
  </ul>
</div>
