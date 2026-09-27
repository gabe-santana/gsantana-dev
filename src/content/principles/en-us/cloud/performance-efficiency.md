---
title: Performance Efficiency
short: "Fast for the user, lean on resources and ready to grow: performance is a requirement you design for, not a miracle you pray for in production."
category: cloud
---

## Introduction

Performance efficiency is the ability of your *workload* to **meet demand with the resources it has**, and to keep meeting it as that demand grows, shrinks or changes shape. It's not about being "the fastest system in the world". It's about being **fast enough, for the right users, at the right cost**, and staying that way over time.

Note the word *efficiency*. Anybody can make a system faster by throwing money at it: bigger machines, more replicas, premium SKUs everywhere. The real challenge is getting the performance the business needs **without waste**, and knowing exactly where every millisecond and every vCPU is going.

When a team ignores this pillar, the symptoms are pretty familiar:

- Nobody knows what "fast" means for the product, so every complaint turns into an argument based on feelings;
- The system flies with ten users and falls over with a thousand;
- Black Friday, a marketing campaign or a mention on a big podcast becomes an incident instead of a celebration;
- Scaling means "call someone at 2 a.m. to resize the database by hand";
- Monthly bills grow faster than the user base, because the answer to every slowdown was a bigger machine;
- Performance problems are only discovered in production, by the customer, usually on the worst possible day;

Yep, *it's rare, but it happens all the time*... Who hasn't heard the classic line during a production incident?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But it works on my machine! I tested it myself and every screen opened instantly."</span>
    </div>
  </div>
</div>

Ah, the famous **"it works on my machine with 3 users"**. Let me tell you a story that has happened, with small variations, in almost every company I've worked with.

The team builds a new order management screen. On the developer's laptop, with a local database holding 200 fake orders and exactly three people clicking around (the dev, the QA and the PO), everything opens in a blink. Demo approved, applause, deploy on Friday afternoon (of course).

On Monday morning, 4,000 sales reps log in at 8 a.m. The production table has 30 million rows and no index on the column the new filter uses. Every request does a full table scan, the connection pool runs out in minutes, requests start queuing, timeouts cascade into the other services that share the same database, and the whole platform crawls. The code was *correct*. It just had never met reality.

The lesson: **performance is a property of the system under real load, with real data, in a real environment**. Your laptop is none of those three things.

<div class="callout info">
  <p>Performance Efficiency isn't about premature micro-optimizations or exotic technologies. It's about <strong>setting clear targets</strong>, <strong>designing to scale</strong>, <strong>testing under realistic load</strong> and <strong>optimizing continuously</strong> based on data, not hunches.</p>
</div>

## Performance is a requirement, not a feeling

The first step is to stop talking about performance with adjectives ("slow", "heavy", "snappy") and start talking about it with **numbers**. A performance requirement that can't be measured is just a wish.

### Averages lie, percentiles tell the truth

The most common mistake is looking at **average** response time. The average hides the users who are suffering. If 99 requests take 100 ms and one takes 10 seconds, the average is about 200 ms, and it looks great on the dashboard. Meanwhile, that one user (who is probably your biggest customer, loading their huge account) is staring at a spinner.

That's why we use **percentiles**:

- **p50 (median):** half of the requests are faster than this. It's the "typical" experience;
- **p95:** 95% of requests are faster than this. It's what the *not so lucky* users see;
- **p99:** 99% of requests are faster than this. It's the tail, where the pain lives.

And the tail matters more than it looks. A single page often triggers dozens of backend calls. If each call has a 1% chance of being slow, a page with 50 calls has a very good chance of hitting at least one slow call. At scale, **your p99 becomes your users' typical experience**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="perf-d1-title perf-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d1-title">Average versus percentiles for the same endpoint</title>
<desc id="perf-d1-desc">Horizontal bars show the latency of one endpoint: average 250 ms, p50 120 ms, p95 480 ms and p99 1,900 ms. A dashed line marks an SLO of 500 ms. The average and the p95 look fine, but the p99 is almost four times over the target.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">LATENCY OF THE SAME ENDPOINT</text>
<text x="265" y="44" text-anchor="middle" class="d-small">SLO: 500 ms</text>
<line x1="265" y1="52" x2="265" y2="236" class="d-line-dashed"/>
<text x="128" y="79" text-anchor="end" class="d-text">Average</text>
<rect x="140" y="60" width="62" height="28" rx="4" class="d-fill-info"/>
<text x="210" y="79" class="d-small">250 ms</text>
<text x="128" y="124" text-anchor="end" class="d-text">p50</text>
<rect x="140" y="105" width="30" height="28" rx="4" class="d-fill-accent"/>
<text x="178" y="124" class="d-small">120 ms</text>
<text x="128" y="169" text-anchor="end" class="d-text">p95</text>
<rect x="140" y="150" width="120" height="28" rx="4" class="d-fill-warn"/>
<text x="274" y="169" class="d-small">480 ms</text>
<text x="128" y="214" text-anchor="end" class="d-text">p99</text>
<rect x="140" y="195" width="475" height="28" rx="4" class="d-fill-danger"/>
<text x="623" y="214" class="d-small">1,900 ms</text>
<line x1="140" y1="240" x2="640" y2="240" class="d-line"/>
<text x="140" y="258" text-anchor="middle" class="d-small">0</text>
<text x="265" y="258" text-anchor="middle" class="d-small">500</text>
<text x="390" y="258" text-anchor="middle" class="d-small">1000</text>
<text x="515" y="258" text-anchor="middle" class="d-small">1500</text>
<text x="640" y="258" text-anchor="middle" class="d-small">2000 ms</text>
</svg>
</div>
<figcaption>Figure 1: The average says everything is fine; the p99 says one in every hundred requests is a bad experience</figcaption>
</figure>

### The metrics that matter

| Metric | What it tells you |
|--------|-------------------|
| **Latency (p50/p95/p99)** | How long users wait. Always measure it as percentiles, per operation, not as a global average. |
| **Throughput** | How much work the system completes per unit of time (requests/s, messages/s, jobs/hour). |
| **Error rate under load** | A fast system that returns 5% of errors at peak isn't fast, it's broken quickly. |
| **Saturation** | How "full" a resource is (CPU, memory, connection pool, queue depth). Saturation is the early warning of a future latency problem. |
| **Concurrency** | How many requests or users are being served at the same time. It's what breaks the "works with 3 users" systems. |
| **Resource efficiency** | How much compute, memory or money each unit of work costs (e.g. cost per 1,000 requests). This is the *efficiency* part of the pillar. |

### From numbers to targets: SLIs, SLOs and SLAs

Numbers alone don't help unless someone agrees on what "good" looks like. The vocabulary popularized by Google's SRE practice fits perfectly here:

- **SLI (Service Level Indicator):** the measurement itself, e.g. "p95 latency of the checkout API";
- **SLO (Service Level Objective):** the internal target, e.g. "p95 below 400 ms over 28 days, for 99% of the time windows";
- **SLA (Service Level Agreement):** the contractual promise to the customer, usually looser than the SLO, with penalties attached.

A good performance target is **specific to a user flow** ("search returns results in under 300 ms at p95 with 2,000 requests per second"), not a generic "the system must be fast". And it must come from the business: what does the user expect, what does the competition offer, how much does a slow checkout cost in abandoned carts?

## The premature optimization joke

You've certainly heard it, probably in a code review: *"premature optimization is the root of all evil"*. It's Donald Knuth, and it's one of the most misquoted sentences in computing. The full idea is that we shouldn't waste time optimizing the 97% of code that doesn't matter, **but we shouldn't pass up the opportunities in that critical 3%**.

In practice, teams tend to fall into one of two ditches:

- **The micro-optimizer:** spends two days rewriting a loop to save 3 microseconds in a function that runs once a day, while the page makes 400 database queries (the famous N+1);
- **The "Knuth said so" developer:** uses the quote as a permanent excuse to never think about performance, until the system meets production and the "later" arrives all at once, with interest.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So which is it? Do I optimize everything from day one or do I leave it all for later?"</span>
    </div>
  </div>
</div>

Neither, Junior! The trick is separating **architectural decisions** from **code tweaks**.

Architectural decisions are expensive to change later: how data is partitioned, whether a component is stateless, whether a flow is synchronous or asynchronous, which database you pick. Those you think about **early**, guided by the targets you just defined. That's not premature optimization, that's design.

Code tweaks (a faster serializer, a smarter loop, a hand-tuned query) are cheap to change later. Those you do **when a measurement tells you** that specific piece is the bottleneck. The golden rule: **measure first, optimize second**. The bottleneck is almost never where you think it is.

## Design principles for Performance Efficiency

With targets defined and the joke out of the way, let's get to the practices. As in the other pillars, each one comes with a goal and the benefit it brings.

### 1. Negotiate realistic performance targets

**Goal:** turn "it has to be fast" into measurable, agreed requirements for each critical flow.

Performance targets are **non-functional requirements** and deserve the same care as any feature. Identify the flows that really matter to the business (login, search, checkout, report generation) and define targets for each one. Not every flow needs the same target: a checkout needs to be quick, a monthly report can take a minute as long as the user knows it's running.

| Approach | Benefit |
|----------|---------|
| **Map critical flows** and rank them by business impact. | Effort goes where the value is, instead of optimizing screens nobody uses. |
| **Define targets as percentiles** with the expected load (e.g. p95 under 300 ms at 1,500 req/s). | Targets become testable and objective, ending the "it feels slow" debates. |
| **Agree on targets with the business** and review them when the product changes. | Prevents both over-engineering (paying for speed nobody needs) and under-delivering. |
| **Set a performance budget** per request, split among the components in the path. | Each team knows how many milliseconds it can "spend", and gateways, sidecars and hops stop eating the budget silently. |

### 2. Plan capacity before demand shows up

**Goal:** know how much load the system must handle, today and tomorrow, and how much capacity that requires.

Capacity planning isn't guesswork. It starts with data: current traffic, growth trends, seasonality (month end, holidays, sales), planned business events (a launch, a new market, a TV ad). With that, you estimate the peak load and the resources needed to meet the targets at that peak, plus a safety margin.

| Approach | Benefit |
|----------|---------|
| **Model demand** using historical data, seasonality and the business roadmap. | Surprises become predictable events: nobody discovers Black Friday on Black Friday. |
| **Know the capacity of each component** (requests per instance, connections per database, throughput per partition). | You find the first bottleneck on paper, not in production. |
| **Check platform limits and quotas** (vCPU quotas, API throttling, IOPS, max connections). | Autoscaling can't save you if the subscription quota stops you at 20 instances. |
| **Plan for peaks, not averages**, with headroom for failover and deploys. | The system survives the day it matters most, even with one zone down or a deploy in progress. |

### 3. Choose the right services and SKUs

**Goal:** pick the technology and the tier that match the *workload*'s real behavior.

The cloud offers dozens of ways to run code and store data. Choosing well is one of the biggest performance levers you have, and it's decided early. A compute-heavy batch job, a latency-sensitive API and a spiky event processor have very different needs.

- **Compute:** VMs, containers, Kubernetes, serverless functions. Serverless is great for spiky, event-driven work but has cold starts; long-running, steady workloads often run better (and cheaper) on containers or VMs;
- **Instance families:** compute-optimized, memory-optimized, storage-optimized, GPU. A memory-hungry cache on a compute-optimized VM wastes money and still runs badly;
- **Data stores:** relational, document, key-value, columnar, search engines, time series. Use the right store for each access pattern instead of forcing everything into a single database;
- **Tiers and SKUs:** throughput, IOPS and connection limits usually depend on the tier. Read the fine print, the limit that bites you is rarely the CPU.

Don't guess: run a **proof of concept** with representative load before committing to a service. And remember that managed services shift a lot of the tuning work to the provider, which is often the most efficient choice for a small team. The cost side of this decision is covered in [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

### 4. Design to scale

**Goal:** add capacity when demand grows and remove it when demand drops, without rewriting the system.

There are two ways to scale, and you need to understand both:

- **Vertical scaling (scale up):** a bigger machine. More CPU, more memory. Simple, no code change, but there's a hard ceiling (the biggest SKU available), it usually requires a restart, and a single big node is still a single point of failure;
- **Horizontal scaling (scale out):** more machines, sharing the load. Nearly unlimited and naturally resilient, but it requires the application to be designed for it: **stateless** instances, sessions stored outside the process, no local files that other instances need.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="perf-d2-title perf-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d2-title">Vertical versus horizontal scaling</title>
<desc id="perf-d2-desc">On the left, vertical scaling replaces a 4 vCPU node with a single 32 vCPU node: simple but with a hard ceiling. On the right, horizontal scaling puts a load balancer in front of several identical nodes, and more nodes can be added automatically, which requires a stateless design.</desc>
<defs><marker id="perf-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="185" y="30" text-anchor="middle" class="d-label">SCALE UP (VERTICAL)</text>
<text x="555" y="30" text-anchor="middle" class="d-label">SCALE OUT (HORIZONTAL)</text>
<rect x="50" y="90" width="90" height="60" rx="10" class="d-box"/>
<text x="95" y="118" text-anchor="middle" class="d-text">4 vCPU</text>
<text x="95" y="136" text-anchor="middle" class="d-small">node</text>
<line x1="144" y1="120" x2="186" y2="120" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<rect x="195" y="60" width="130" height="120" rx="10" class="d-box-accent"/>
<text x="260" y="116" text-anchor="middle" class="d-title">32 vCPU</text>
<text x="260" y="138" text-anchor="middle" class="d-small">same single node</text>
<line x1="365" y1="50" x2="365" y2="260" class="d-line-dashed"/>
<rect x="475" y="60" width="160" height="44" rx="10" class="d-box-info"/>
<text x="555" y="87" text-anchor="middle" class="d-text">Load balancer</text>
<line x1="535" y1="104" x2="438" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="548" y1="104" x2="518" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="562" y1="104" x2="596" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="575" y1="104" x2="672" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<rect x="400" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="436" y="180" text-anchor="middle" class="d-text">Node 1</text>
<rect x="481" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="517" y="180" text-anchor="middle" class="d-text">Node 2</text>
<rect x="562" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="598" y="180" text-anchor="middle" class="d-text">Node 3</text>
<rect x="643" y="150" width="72" height="50" rx="10" class="d-box-muted"/>
<text x="679" y="180" text-anchor="middle" class="d-text">Node N</text>
<text x="185" y="232" text-anchor="middle" class="d-small">Simple, no code change</text>
<text x="185" y="252" text-anchor="middle" class="d-small">Hard ceiling, restart, one node</text>
<text x="555" y="232" text-anchor="middle" class="d-small">Near-linear growth, resilient</text>
<text x="555" y="252" text-anchor="middle" class="d-small">Requires stateless design</text>
</svg>
</div>
<figcaption>Figure 2: Scaling up buys time; scaling out buys a future</figcaption>
</figure>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Why all this complexity? When it gets slow, we just pick the biggest machine in the catalog and move on!"</span>
    </div>
  </div>
</div>

Easy there, Junior! Scaling up is a perfectly valid first move, and sometimes it's the right one (a relational database, for example, is much easier to scale vertically). But it has three problems. First, the catalog ends: one day there's no bigger machine. Second, cost usually grows faster than capacity at the top of the catalog. Third, if the bottleneck is a lock, a single-threaded process or a bad query, a machine twice as big makes it... exactly as slow. **Hardware doesn't fix design problems, it just postpones the bill.**

The practices that make scaling work:

| Approach | Benefit |
|----------|---------|
| **Design stateless services**, keeping session and state in external stores (cache, database). | Any instance can serve any request, so adding or removing instances is trivial. |
| **Use autoscaling** based on meaningful signals (CPU, queue depth, requests per instance, custom metrics), with sensible minimums and maximums. | Capacity follows demand automatically, and the maximum protects both the budget and the downstream dependencies. |
| **Scale ahead of known events** (scheduled scaling) instead of relying only on reactive rules. | Autoscaling takes minutes; a campaign starting at 8 p.m. sharp doesn't wait. |
| **Define scale units**: a group of resources (app, cache, database partition) that scale together as a block. | Growth becomes predictable and repeatable: "each unit serves 50,000 users, we need 3 more". |
| **Partition data (sharding)** by a key that spreads load evenly, such as tenant or region. | Removes the single-database ceiling. Pick the key carefully: a bad key creates "hot partitions" that concentrate the load. |
| **Scale every layer**, not only the web tier. | Ten times more web instances hitting the same database just moves the bottleneck (and usually makes it worse). |

### 5. Cache wisely and use a CDN

**Goal:** avoid doing the same work twice, and serve content as close to the user as possible.

There's an old joke that there are only two hard things in computer science: cache invalidation and naming things. It's a joke because it's true. Caching is one of the most powerful performance tools, and one of the easiest ways to show users stale or wrong data.

Think of caching as **layers**. Every request answered by an earlier layer is work the next layers never have to do:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 240" role="img" aria-labelledby="perf-d3-title perf-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d3-title">Caching layers from the browser to the database</title>
<desc id="perf-d3-desc">A request flows through five layers: browser cache, CDN at the edge, in-process application cache, distributed cache and finally the database with read replicas. Each layer that answers the request saves the work and latency of the layers behind it.</desc>
<defs><marker id="perf-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="36" text-anchor="middle" class="d-label">EVERY HIT EARLIER IS WORK THE NEXT LAYER SKIPS</text>
<rect x="20" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="80" y="115" text-anchor="middle" class="d-title">Browser</text>
<text x="80" y="136" text-anchor="middle" class="d-small">HTTP cache</text>
<line x1="140" y1="120" x2="166" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="170" y="80" width="120" height="80" rx="10" class="d-box-accent"/>
<text x="230" y="115" text-anchor="middle" class="d-title">CDN</text>
<text x="230" y="136" text-anchor="middle" class="d-small">edge, static</text>
<line x1="290" y1="120" x2="316" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="320" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="380" y="115" text-anchor="middle" class="d-title">App cache</text>
<text x="380" y="136" text-anchor="middle" class="d-small">in-process</text>
<line x1="440" y1="120" x2="466" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="470" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="530" y="115" text-anchor="middle" class="d-title">Redis</text>
<text x="530" y="136" text-anchor="middle" class="d-small">distributed</text>
<line x1="590" y1="120" x2="616" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="620" y="80" width="120" height="80" rx="10" class="d-box"/>
<text x="680" y="115" text-anchor="middle" class="d-title">Database</text>
<text x="680" y="136" text-anchor="middle" class="d-small">+ read replicas</text>
<text x="80" y="186" text-anchor="middle" class="d-small">no network</text>
<text x="230" y="186" text-anchor="middle" class="d-small">near the user</text>
<text x="380" y="186" text-anchor="middle" class="d-small">microseconds</text>
<text x="530" y="186" text-anchor="middle" class="d-small">about 1 ms</text>
<text x="680" y="186" text-anchor="middle" class="d-small">slowest, costliest</text>
<line x1="60" y1="214" x2="700" y2="214" class="d-line-accent" marker-end="url(#perf-d3-arrow)"/>
<text x="380" y="232" text-anchor="middle" class="d-small">latency and cost per request grow to the right</text>
</svg>
</div>
<figcaption>Figure 3: Caching in layers, from the browser to the database</figcaption>
</figure>

| Approach | Benefit |
|----------|---------|
| **Use a CDN** for static assets, images, videos and, where possible, whole cacheable pages or API responses. | Content is served from an edge location near the user, cutting latency and taking load off the origin. |
| **Set proper HTTP cache headers** (`Cache-Control`, `ETag`) and version your static files. | Browsers and CDNs do the work for free, and a new deploy invalidates old assets without drama. |
| **Apply the cache-aside pattern** with a distributed cache for data that is read often and changes rarely. | Removes repeated queries from the database and shares the cached data across all instances. |
| **Define expiration (TTL) and invalidation rules** per type of data, based on how stale it's allowed to be. | Makes staleness a conscious business decision ("prices can be 60 seconds old, stock can't"), not an accident. |
| **Protect against stampedes**, when a popular key expires and thousands of requests hit the database at once. | Techniques like request coalescing, jittered TTLs and background refresh keep a cache miss from becoming an outage. |
| **Monitor the hit ratio.** | A cache with a 10% hit ratio is just extra latency, extra cost and one more component that can fail. |

### 6. Take care of data performance

**Goal:** make the data layer fast, since it's the bottleneck in the vast majority of systems.

Remember the story from the introduction? It wasn't the code, the framework or the cloud. It was a missing index. In my experience, most "the system is slow" tickets end in the database.

| Approach | Benefit |
|----------|---------|
| **Index for your real queries**, reviewing execution plans for the critical ones. Don't index everything: each index speeds up reads and slows down writes. | Queries that scanned millions of rows start reading a handful. |
| **Kill N+1 queries and chatty access**, fetching what you need in one round trip and only the columns you need. | Fewer round trips across the network, which usually costs more than the query itself. |
| **Use read replicas** to offload read-heavy traffic (reports, listings, search). | The primary node stays free for writes. Remember that replicas lag a bit, so reads right after a write may need the primary. |
| **Denormalize and use materialized views** where reads vastly outnumber writes. | Reads stop needing expensive joins; you trade some storage and write complexity for speed. |
| **Separate read and write models (CQRS)** when their needs really diverge. | Each side can be optimized and scaled independently. |
| **Manage connections** with pooling and sensible limits. | Prevents the classic scenario where autoscaling creates 100 instances and they exhaust the database's connections together. |
| **Archive and tier old data**, keeping hot tables small. | Queries, indexes and backups stay fast as the history grows. |

### 7. Go asynchronous and level the load with queues

**Goal:** don't make the user wait for work that doesn't need to happen right now, and absorb spikes without falling over.

Not everything needs an immediate answer. Sending the confirmation email, generating the invoice PDF, updating the recommendation engine, notifying the warehouse: the user doesn't need to watch all that happen. They need to know the order was received.

With a **queue** between the producer and the consumer, the front end answers quickly ("order received") and the heavy work is processed in the background, at the pace the consumers can sustain. This is the **queue-based load leveling** pattern: a spike of 10,000 orders in one minute becomes a queue that workers drain over the next few minutes, instead of 10,000 simultaneous requests crushing the database.

| Approach | Benefit |
|----------|---------|
| **Move non-critical work off the request path** using queues or event streams. | Response time reflects only what the user really needs, and the perceived performance improves dramatically. |
| **Scale consumers based on queue depth.** | Processing capacity follows the backlog automatically, and the queue itself is a clear saturation signal. |
| **Design idempotent consumers.** | Messages can be retried or delivered twice without creating duplicate orders or double charges. |
| **Give users feedback** on long operations (status, progress, notifications). | "Your report will be ready in 2 minutes" is a far better experience than a 2-minute spinner. |

Queues also help a lot with failures, but retries, dead-letter queues, circuit breakers and backpressure deserve their own discussion, which you'll find in [Resilience Patterns](/en-us/principles/solution/resilience-patterns/).

### 8. Test performance before your users do

**Goal:** discover limits and bottlenecks in a controlled environment, not in production on the worst day of the year.

This is where the "works on my machine" story gets its happy ending. If that team had run a simple load test with production-sized data, the missing index would have shown up in the first five minutes. There are several kinds of test, each answering a different question:

| Test type | Question it answers |
|-----------|---------------------|
| **Load test** | Does the system meet the targets at the expected load (normal and peak)? |
| **Stress test** | Where does it break, and how does it break? Does it degrade gracefully or collapse? |
| **Spike test** | What happens when traffic jumps suddenly, faster than autoscaling can react? |
| **Soak (endurance) test** | Does it hold up for hours or days? This is where memory leaks, growing queues and full disks appear. |
| **Scalability test** | When I double the instances, does throughput double, or does something else become the ceiling? |

Some ground rules to make these tests worth anything:

- **Realistic data volume:** a test against a database with 200 rows proves nothing about a table with 30 million;
- **Realistic traffic mix:** users don't hit only the home page. Model the real ratio of reads, writes, searches and heavy operations;
- **Production-like environment:** same SKUs, same topology, same limits. Otherwise you're testing a different system;
- **Automate it in the pipeline:** a lighter performance test on every release catches regressions early (the "someone added a query inside a loop" kind);
- **Establish a baseline** and compare every run against it. A 20% regression is a finding, not noise.

Tools like k6, JMeter, Gatling, Locust and the managed load testing services offered by the cloud providers make this accessible to any team. There's really no excuse anymore.

### 9. Monitor and optimize continuously

**Goal:** keep performance on target as the code, the data and the users change.

Performance isn't a project with an end date. Every deploy changes the code, the data grows every day, usage patterns shift, and the provider launches new SKUs and services. A system that met its targets six months ago may not meet them today.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="perf-d4-title perf-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d4-title">The continuous performance optimization loop</title>
<desc id="perf-d4-desc">A cycle of five steps: define targets, design, test under load, monitor production and optimize, which leads back to defining targets. Performance work never ends.</desc>
<defs><marker id="perf-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="275" y="30" width="170" height="54" rx="10" class="d-box-accent"/>
<text x="360" y="54" text-anchor="middle" class="d-title">Define targets</text>
<text x="360" y="73" text-anchor="middle" class="d-small">p95, throughput, SLO</text>
<rect x="520" y="105" width="170" height="54" rx="10" class="d-box-info"/>
<text x="605" y="129" text-anchor="middle" class="d-title">Design</text>
<text x="605" y="148" text-anchor="middle" class="d-small">SKU, scaling, cache</text>
<rect x="440" y="225" width="170" height="54" rx="10" class="d-box-info"/>
<text x="525" y="249" text-anchor="middle" class="d-title">Test under load</text>
<text x="525" y="268" text-anchor="middle" class="d-small">load, stress, soak</text>
<rect x="110" y="225" width="170" height="54" rx="10" class="d-box-info"/>
<text x="195" y="249" text-anchor="middle" class="d-title">Monitor production</text>
<text x="195" y="268" text-anchor="middle" class="d-small">real percentiles</text>
<rect x="30" y="105" width="170" height="54" rx="10" class="d-box-warn"/>
<text x="115" y="129" text-anchor="middle" class="d-title">Optimize</text>
<text x="115" y="148" text-anchor="middle" class="d-small">fix the bottleneck</text>
<line x1="445" y1="60" x2="558" y2="102" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="600" y1="159" x2="548" y2="222" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="440" y1="252" x2="284" y2="252" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="170" y1="225" x2="128" y2="162" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="140" y1="105" x2="271" y2="62" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<text x="360" y="162" text-anchor="middle" class="d-label">CONTINUOUS LOOP</text>
<text x="360" y="184" text-anchor="middle" class="d-small">performance is never done</text>
</svg>
</div>
<figcaption>Figure 4: The performance loop: targets, design, testing, monitoring and optimization, over and over</figcaption>
</figure>

| Approach | Benefit |
|----------|---------|
| **Instrument the critical flows** with metrics, distributed traces and logs, measuring percentiles per operation. | When something gets slow, you find out which component and which call is guilty in minutes, not days. See [Observability First](/en-us/principles/solution/observability-first/). |
| **Alert on SLOs and saturation**, not only on "server down". | You react while latency is climbing, before users start complaining. |
| **Track performance per release.** | A regression gets tied to the change that caused it, which makes rolling back or fixing it trivial. |
| **Review the architecture periodically** against new requirements and new services. | A managed service, a new SKU generation or a new pattern may deliver the same performance with far less effort or cost. |
| **Optimize the biggest bottleneck first**, then measure again. | Fixing anything other than the bottleneck doesn't improve the system as a whole. Once it's fixed, the bottleneck moves, and the cycle starts again. |
| **Right-size regularly**, in both directions. | Oversized resources are wasted money; undersized ones are a future incident. Efficiency is about the right size, not the smallest. |

## Tradeoffs

**Performance Efficiency** makes the *workload* meet demand with the resources it has, scaling in and out as needed. But, just like every other pillar, the decisions you make here have consequences elsewhere. Improving performance almost always means spending something: money, simplicity, consistency or security.

Let's look at the most common *trade-offs*.

### Tradeoffs with Reliability

Increased complexity: horizontal scaling, sharding, caches and queues add moving parts. Every component is a new point of failure, and distributed systems fail in creative ways.

Consistency versus speed: caches, read replicas and asynchronous processing mean some data will be slightly stale. Reading from a lagging replica right after a write can show the user an order that "disappeared".

Aggressive autoscaling can amplify failures: a burst of new instances can overwhelm a database or a downstream dependency that doesn't scale at the same pace.

Tight resource sizing to maximize efficiency leaves little headroom to absorb the loss of a zone or an instance. Running at 90% utilization looks efficient until a node fails. For the full picture, see [Reliability](/en-us/principles/cloud/reliability/).

### Tradeoffs with Security

Caching sensitive data: a cache or CDN configured carelessly can serve one user's personal data to another. Private responses must never be cached publicly.

Larger attack surface: more instances, more partitions, more endpoints and edge locations mean more things to patch, monitor and protect.

Performance shortcuts: skipping validation, loosening encryption or disabling inspection "because it's slow" is a classic way to trade milliseconds for a breach. Security controls have a cost, and it must be part of the performance budget, not an afterthought. More on that in [Security](/en-us/principles/cloud/security/).

### Tradeoffs with Cost Optimization

Headroom costs money: meeting the p99 at peak usually means paying for capacity that sits idle most of the time.

Premium SKUs, extra replicas, CDNs, distributed caches and multi-region deployments all show up on the bill.

On the other hand, efficiency and cost often walk together: fixing a bad query, adding a cache or moving work to a queue can make the system faster **and** cheaper. The trick is knowing where the target is and not paying for performance nobody asked for. Details in [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

### Tradeoffs with Operational Excellence

More components to operate: caches to invalidate, queues to watch, partitions to rebalance, autoscaling rules to tune. Each optimization adds operational knowledge the team needs to keep.

Testing complexity: realistic performance tests require production-like environments and data, which take effort to build, maintain and keep compliant (masking personal data in test datasets, for instance).

Harder troubleshooting: an asynchronous, partitioned, heavily cached system is much harder to debug than a simple monolith hitting a single database. Without good observability, a performance win becomes an operational nightmare. See [Operational Excellence](/en-us/principles/cloud/operational-excellence/).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So making it faster can make it less reliable, less secure, more expensive and harder to run? Maybe I should just leave it slow!"</span>
    </div>
  </div>
</div>

Ha! Not quite, Junior. A slow system also has a cost: users who give up, carts abandoned, SLAs broken, and teams burning nights on incidents. The point is to **aim for the target, not for the maximum**. Once the performance requirement is met, every additional millisecond you shave off has to justify the complexity and money it costs. Understand the impact, discuss it with the team, document the decision and move on.

## Conclusion

**Performance Efficiency** isn't about chasing benchmarks or picking the trendiest technology. It's about **knowing what "fast enough" means for your users**, designing a system that can **keep up as demand grows**, and **proving it with data** before and after it reaches production.

It starts with clear targets expressed as percentiles and SLOs, goes through capacity planning, choosing the right services, designing to scale horizontally, caching wisely, taking care of the data layer and moving work off the critical path. And it never really ends: tests, monitoring and continuous optimization keep the system on target as everything around it changes.

Above all, remember the story of the order screen: **your laptop with 3 users is not production**. Measure under real conditions, optimize what the measurements point to, and make the *trade-offs* consciously, together with the team.

## Next Steps

1. **Define targets for your critical flows**
Pick the three to five flows that matter most to the business and set p95/p99 latency and throughput targets for each one, agreed with the product team.

2. **Measure where you are today**
Instrument those flows and look at real percentiles in production, not averages. The gap between targets and reality is your roadmap.

3. **Find the first bottleneck**
Use traces and saturation metrics to find where time and resources are really being spent. Start with the database; it's usually there.

4. **Make the design ready to scale**
Remove state from your services, check platform quotas, configure autoscaling with sensible limits and identify what should move to a queue.

5. **Add performance tests to the pipeline**
Start with a simple load test on every release against a baseline, then add stress and soak tests before big events.

6. **Review continuously and weigh the tradeoffs**
Revisit targets, sizing and architecture periodically, and document how each performance decision affects cost, reliability, security and operations.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/performance-efficiency/" target="_blank" rel="noopener">Azure Well-Architected Framework: Performance Efficiency</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://sre.google/sre-book/service-level-objectives/" target="_blank" rel="noopener">Google SRE Book: Service Level Objectives</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/cache-aside" target="_blank" rel="noopener">Cache-Aside pattern (Azure Architecture Center)</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/queue-based-load-leveling" target="_blank" rel="noopener">Queue-Based Load Leveling pattern (Azure Architecture Center)</a></li>
  </ul>
</div>
