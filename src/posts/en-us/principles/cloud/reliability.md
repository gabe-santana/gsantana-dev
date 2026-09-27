---
title: Reliability
short: "Everything fails, all the time: reliability is deciding in advance how much failure you can afford and making sure the system survives the rest."
category: cloud
---

## Introduction

Werner Vogels, Amazon's CTO, has a line that every architect should have framed on the wall: *"Everything fails, all the time."* Disks die, zones go dark, certificates expire at 3 a.m., a DNS change propagates to half the planet, and that one dependency nobody remembers adding decides to take the afternoon off.

The **goal** of the Reliability pillar is not to build a system that never fails (that system doesn't exist). The goal is to build a *workload* that **keeps doing what it promised to do, at the level it promised, even when parts of it fail**, and that recovers quickly and predictably when something big goes wrong.

When a team neglects reliability, the symptoms show up fast, and usually in production:

- Nobody knows what the availability target is, so every incident becomes a debate about whether it "was really that bad";
- The architecture has a single database, in a single zone, and a single person who knows how to restore it;
- Backups exist, in theory, but nobody has ever tried to restore one;
- Every outage is a surprise, because failure modes were never mapped;
- The team promises 99.99% to the customer while the dependencies, multiplied together, deliver 99.8%;
- Recovery depends on heroics, a war room and a lot of luck.

Yep, *it's rare, but it happens all the time*... Who hasn't watched a status page stay green while the phone kept ringing?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But we're in the cloud now! The cloud never goes down, right? That's the whole point of paying for it."</span>
    </div>
  </div>
</div>

Easy there, Junior! The cloud goes down. Not often, and usually not all at once, but it does. What the cloud gives you is **building blocks** for reliability: multiple zones, multiple regions, managed replication, health probes, load balancers and automation. It doesn't assemble them for you.

This is the famous **shared responsibility model** applied to reliability. The provider is responsible for the reliability *of* the cloud (data centers, hardware, the platform itself). You are responsible for reliability *in* the cloud: how you deploy, where you replicate, how you recover and how your code behaves when a dependency is slow or gone. If you deploy a single VM in a single zone, the provider will happily keep that single VM running at exactly the reliability a single VM in a single zone can offer.

<div class="callout info">
  <p>Reliability is a <strong>design decision</strong>, not a feature you switch on. It starts with an honest target agreed with the business, and every architectural choice (zones, regions, replication, backups, testing) should be traceable back to that target.</p>
</div>

## Reliability, Availability and Resilience

These three words get mixed up all the time, so let's settle them before going further:

- **Availability** is the percentage of time the system is usable. It's a measurement: "the checkout API was available 99.93% of the time last month".
- **Resilience** is the ability to absorb a failure and keep working, maybe in a degraded way. It's a property of the design: "when the recommendations service fails, the product page still loads without recommendations".
- **Reliability** is the broader goal: the system consistently does what it's supposed to do, correctly, over time. Availability and resilience are ingredients. A system that is "up" but returns wrong data is available and absolutely not reliable.

In the Well-Architected frameworks (Azure, AWS and Google Cloud all have their own version), the Reliability pillar covers the *workload* and infrastructure level: targets, redundancy, recovery, testing. The code-level techniques that make individual calls survive failures, such as retries with backoff, circuit breakers, bulkheads and timeouts, have their own home in [Resilience Patterns](/en-us/principles/solution/resilience-patterns/). Both are necessary: a multi-region architecture won't save you from a service that retries in a tight loop and knocks its own database over.

## Define Reliability Targets

**Goal:** agree, with the business, on how reliable the *workload* needs to be, and express it in numbers you can measure.

Without a target, "reliable" means whatever the most anxious person in the room thinks it means. With a target, it becomes an engineering requirement that you can design, measure and pay for.

### SLI, SLO and SLA

Three acronyms, three very different things:

- **SLI (Service Level Indicator):** what you **measure**. For example, the ratio of successful requests to total requests, or the percentage of requests answered in under 300 ms.
- **SLO (Service Level Objective):** the internal **target** for an SLI over a time window. For example, "99.9% of checkout requests succeed over a rolling 30 days".
- **SLA (Service Level Agreement):** the **contract** with the customer, usually with financial consequences (service credits) when it's broken. For example, "99.5% monthly availability, or you get credits".

The golden rule: **your SLA should be looser than your SLO**. The SLO is your early warning; if you break it, you still have room before you break the promise you made to the customer and start paying for it.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="rel-d1-title rel-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d1-title">SLI, SLO, SLA and the error budget</title>
<desc id="rel-d1-desc">The SLI is what you measure, the SLO is the internal target for that measurement, and the SLA is the looser contract with the customer. The error budget is 100% minus the SLO.</desc>
<defs><marker id="rel-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="36" text-anchor="middle" class="d-label">MEASURE, TARGET, PROMISE</text>
<rect x="30" y="65" width="190" height="105" rx="10" class="d-box-info"/>
<text x="125" y="97" text-anchor="middle" class="d-title">SLI</text>
<text x="125" y="122" text-anchor="middle" class="d-text">What you measure</text>
<text x="125" y="146" text-anchor="middle" class="d-small">good requests / total</text>
<line x1="222" y1="117" x2="263" y2="117" class="d-line" marker-end="url(#rel-d1-arrow)"/>
<rect x="265" y="65" width="190" height="105" rx="10" class="d-box-accent"/>
<text x="360" y="97" text-anchor="middle" class="d-title">SLO</text>
<text x="360" y="122" text-anchor="middle" class="d-text">Internal target</text>
<text x="360" y="146" text-anchor="middle" class="d-small">99.9% over 30 days</text>
<line x1="457" y1="117" x2="498" y2="117" class="d-line" marker-end="url(#rel-d1-arrow)"/>
<rect x="500" y="65" width="190" height="105" rx="10" class="d-box-warn"/>
<text x="595" y="97" text-anchor="middle" class="d-title">SLA</text>
<text x="595" y="122" text-anchor="middle" class="d-text">Customer contract</text>
<text x="595" y="146" text-anchor="middle" class="d-small">99.5%, or credits</text>
<text x="360" y="200" text-anchor="middle" class="d-label">ERROR BUDGET</text>
<rect x="30" y="212" width="660" height="50" rx="10" class="d-box-muted"/>
<text x="360" y="242" text-anchor="middle" class="d-text">100% minus SLO: 0.1% of 30 days, about 43 minutes to spend</text>
</svg>
</div>
<figcaption>Figure 1: SLI measures, SLO targets, SLA promises, and the gap is your error budget</figcaption>
</figure>

A good SLI is measured **from the user's point of view**. CPU at 40% is not an SLI; "the login page loaded in under 2 seconds for 99% of users" is. Your customers don't care that every pod is green if the load balancer is returning 502.

### The Nines and Their Real Downtime Budget

"Let's go for five nines!" is a great sentence for a slide and a terrible one for a budget. Each extra nine cuts the allowed downtime by ten, and the cost to achieve it grows much faster than that. Here's what the numbers actually mean:

| Availability | Downtime per year | Downtime per month (30 days) | In practice |
| :--- | :--- | :--- | :--- |
| **99%** (two nines) | about 3.65 days | about 7.2 hours | Internal tools, batch systems that can wait |
| **99.9%** (three nines) | about 8.8 hours | about 43 minutes | Most business applications |
| **99.95%** | about 4.4 hours | about 22 minutes | Important customer-facing systems |
| **99.99%** (four nines) | about 53 minutes | about 4.3 minutes | Critical systems; needs automated recovery, humans are too slow |
| **99.999%** (five nines) | about 5.3 minutes | about 26 seconds | Telecom, payments core; multi-region active-active, deep investment |

Look at the four nines line again: **4.3 minutes per month**. That's less time than it takes to get paged, open the laptop, connect to the VPN and find the right dashboard. At that level, recovery has to be automatic, full stop.

The right number of nines is a **business decision**. Ask the business: what does one hour of downtime cost us (revenue, penalties, reputation)? What does the next nine cost to build and operate? If the answer to the second is bigger than the first, you've found your target. This is exactly where reliability meets [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

### Composite SLAs

Here comes the part that surprises people. Your *workload* is not one service; it's a chain of them. And when components depend on each other **in series** (all of them must work for the request to work), their availabilities **multiply**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Easy: the provider's database has a 99.99% SLA, so our app has 99.99% too. I already put it in the contract."</span>
    </div>
  </div>
</div>

Oh no, Junior. Let's do the math. Your app runs on a web platform with 99.95%, talks to a database with 99.99% and to a cache with 99.9%. If any one of them fails, the request fails. So:

0.9995 × 0.9999 × 0.999 ≈ **0.9984**, or **99.84%**, which is roughly **14 hours of downtime per year**. And that's before counting your own code, your deployments, DNS, the identity provider and the payment gateway.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 310" role="img" aria-labelledby="rel-d2-title rel-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d2-title">Composite availability in series and in parallel</title>
<desc id="rel-d2-desc">Three dependencies in series at 99.95, 99.99 and 99.9 percent combine to about 99.84 percent. Two independent regions at 99.84 percent in parallel combine to about 99.9997 percent, if failover works.</desc>
<defs><marker id="rel-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="32" text-anchor="middle" class="d-label">SERIAL: EVERY DEPENDENCY MULTIPLIES</text>
<rect x="20" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="90" y="92" text-anchor="middle" class="d-title">Web app</text>
<text x="90" y="116" text-anchor="middle" class="d-text">99.95%</text>
<line x1="162" y1="100" x2="188" y2="100" class="d-line" marker-end="url(#rel-d2-arrow)"/>
<rect x="190" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="260" y="92" text-anchor="middle" class="d-title">Database</text>
<text x="260" y="116" text-anchor="middle" class="d-text">99.99%</text>
<line x1="332" y1="100" x2="358" y2="100" class="d-line" marker-end="url(#rel-d2-arrow)"/>
<rect x="360" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="430" y="92" text-anchor="middle" class="d-title">Cache</text>
<text x="430" y="116" text-anchor="middle" class="d-text">99.9%</text>
<line x1="502" y1="100" x2="538" y2="100" class="d-line-danger" marker-end="url(#rel-d2-arrow)"/>
<rect x="540" y="55" width="160" height="90" rx="10" class="d-box-danger"/>
<text x="620" y="87" text-anchor="middle" class="d-title">Composite</text>
<text x="620" y="110" text-anchor="middle" class="d-text">99.84%</text>
<text x="620" y="130" text-anchor="middle" class="d-small">about 14 h per year</text>
<text x="360" y="190" text-anchor="middle" class="d-label">PARALLEL: REDUNDANCY ADDS NINES</text>
<rect x="20" y="208" width="200" height="38" rx="10" class="d-box-info"/>
<text x="120" y="232" text-anchor="middle" class="d-text">Region A: 99.84%</text>
<rect x="20" y="256" width="200" height="38" rx="10" class="d-box-info"/>
<text x="120" y="280" text-anchor="middle" class="d-text">Region B: 99.84%</text>
<line x1="222" y1="227" x2="298" y2="242" class="d-line-accent" marker-end="url(#rel-d2-arrow)"/>
<line x1="222" y1="275" x2="298" y2="260" class="d-line-accent" marker-end="url(#rel-d2-arrow)"/>
<rect x="300" y="213" width="230" height="76" rx="10" class="d-box-accent"/>
<text x="415" y="245" text-anchor="middle" class="d-title">Combined: 99.9997%</text>
<text x="415" y="268" text-anchor="middle" class="d-small">only if failover works</text>
<text x="625" y="236" text-anchor="middle" class="d-small">Global routing and</text>
<text x="625" y="253" text-anchor="middle" class="d-small">data replication</text>
<text x="625" y="270" text-anchor="middle" class="d-small">have their own SLA</text>
</svg>
</div>
<figcaption>Figure 2: Dependencies in series lose nines; independent redundancy wins them back</figcaption>
</figure>

The good news is that the math also works in your favor. When you put **independent** copies **in parallel** (either one can serve the request), you multiply the probabilities of *failure* instead: two regions at 99.84% each fail together only 0.16% × 0.16% of the time, which gives about 99.9997%. In theory.

In practice, the parallel path adds new components in series (global load balancing, DNS, data replication, the failover logic itself), and those have their own availability. Redundancy is only as good as the mechanism that switches to it. That's why the testing section later in this article is not optional.

<div class="callout tip" data-title="Practical rule">
  <p>Before signing any SLA, draw the dependency chain of your critical flow, write the availability of each hop, and multiply. If the result is lower than what sales wants to promise, you need either redundancy or a different promise. Never the other way around.</p>
</div>

### Error Budgets

Here's the idea that changed how many teams think about reliability, straight from Google's SRE practice: **if your SLO is 99.9%, then 0.1% of failure is not a problem, it's a budget**.

Over 30 days, that's about 43 minutes of "allowed" unreliability. The team can spend it on risky deployments, experiments, migrations and planned maintenance. The error budget turns the eternal fight between "ship features fast" and "don't touch production" into a simple, data-driven rule:

- **Budget left:** ship, experiment, take calculated risks;
- **Budget burning fast:** slow down, investigate, add safeguards;
- **Budget exhausted:** freeze risky changes and focus on reliability work until it recovers.

It also protects you from the opposite problem: chasing 100%. A service that never uses its error budget is probably moving too slowly or is over-engineered (and overpaying). **100% is the wrong target for basically everything**, because the users' own devices, networks and ISPs are far less reliable than that, and they would never notice the difference.

## Identify Critical Flows and Failure Modes

**Goal:** know which parts of the *workload* matter most and how each of them can fail, before production teaches you.

### Critical Flows

Not everything in your system deserves the same level of reliability. Treating everything as critical is expensive, and in the end it means nothing is really prioritized.

Break the *workload* into **user flows** and classify them by business impact. In an e-commerce site, for example:

| Flow | Criticality | Why |
| :--- | :--- | :--- |
| **Checkout and payment** | High | Direct revenue loss every minute it's down |
| **Product search and catalog** | High | No browsing, no buying |
| **Order history** | Medium | Annoying, but customers can wait an hour |
| **Product recommendations** | Low | The page works fine without them |
| **Monthly sales report** | Low | Can run again tomorrow |

Now each flow can get its own SLO and its own redundancy budget. Checkout might get multi-zone, multi-region and four nines; recommendations can live in a single zone and simply disappear from the page when they fail (that's **graceful degradation**, and it's one of the cheapest reliability wins there is).

### Failure Mode Analysis

With critical flows mapped, do a **Failure Mode Analysis (FMA)**: for each component in the flow, ask "how can this fail, what happens when it does, how will we know, and what do we do about it?"

| Component | Failure mode | Impact | Detection | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | Primary node crashes | Checkout fails | Health probe, error rate alert | Zone-redundant replica with automatic failover |
| **Payment provider** | Slow responses (5s+) | Threads pile up, whole API slows down | Latency SLI on the dependency | Timeouts and circuit breaker, queue and retry later |
| **Zone** | Full zone outage | Instances in that zone gone | Platform health events, probes | Instances spread across three zones |
| **TLS certificate** | Expires | Every client gets an error | Expiry monitoring 30 days ahead | Automated renewal |
| **Region** | Regional outage | Entire *workload* down | Synthetic tests from outside the region | Secondary region with a DR strategy (see below) |

Some of these rows are infrastructure decisions (zones, replicas, regions) and belong to this pillar. Others, like how the API reacts to a slow payment provider, are code decisions and live in [Resilience Patterns](/en-us/principles/solution/resilience-patterns/). A good FMA covers both, and it's a living document: every incident post-mortem should add or update a row.

Pay special attention to **single points of failure** (the one NAT gateway, the one DNS provider, the one secret store, the one engineer with the password) and to **dependencies you don't own**. Third-party APIs, identity providers and SaaS tools are all part of your composite SLA, whether you like it or not.

## Design for Redundancy

**Goal:** make sure no single failure in a critical flow takes the flow down.

Redundancy means having more than one of anything whose failure would hurt: instances, zones, regions, network paths, even people on call. The question is always **at what level** you need it, and that comes straight from your targets.

### Zones and Regions

Cloud providers organize their infrastructure in layers, and each layer protects you against a different kind of failure:

- **Multiple instances in one zone** protect against a single machine or process failing. Cheap, and the bare minimum for anything in production.
- **Multiple availability zones** (physically separate data centers in the same region, with independent power, cooling and network) protect against a data center failure. Latency between zones is low, so synchronous replication is usually viable. For most production *workloads*, **zone redundancy is the sweet spot** of cost versus protection.
- **Multiple regions** protect against a regional disaster or a broad platform incident. Distance brings higher latency, so replication is usually asynchronous (which means some data loss is possible during a failover), and cost and complexity jump considerably.

A pragmatic default: **zone redundant in the primary region for everything critical, plus a documented, tested DR strategy to a second region** sized according to the RTO and RPO the business agreed on.

### Active-Active vs Active-Passive

Once you have more than one location, you have to decide how they share the work:

| Model | How it works | Benefit | Watch out for |
| :--- | :--- | :--- | :--- |
| **Active-Active** | All locations serve traffic at the same time | Near-zero recovery time, capacity you pay for is actually used, failures only reduce capacity | Data consistency across locations, conflict resolution, every location must handle the full load if another fails |
| **Active-Passive** | One location serves traffic; the other waits, ready to take over | Simpler data model, easier to reason about | Failover takes time, the passive side can rot silently if never tested, you pay for idle capacity |

Active-active sounds like the obvious winner, and for stateless tiers it often is. The hard part is **state**. Writing to the same data from two regions means dealing with replication lag, conflicts and consistency models, and that complexity has its own failure modes. Many teams end up with a hybrid: active-active for the stateless front end and APIs, active-passive (or single-writer) for the database.

One more trap: in active-active, if each of two regions normally runs at 70% of capacity, losing one means the survivor must handle 140%. **Redundancy without headroom is just a slower outage.** Plan capacity for the failure scenario, not for the sunny day, and make sure autoscaling limits and quotas in the surviving region allow it.

## RTO and RPO

**Goal:** define, per critical flow, how long you can be down and how much data you can lose.

These two numbers drive almost every disaster recovery decision:

- **RTO (Recovery Time Objective):** the maximum acceptable time between the disaster and the service being back. "How long can we be down?"
- **RPO (Recovery Point Objective):** the maximum acceptable amount of data loss, measured in time. "If we restore from the last good copy, how far back in time do we go?"

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 240" role="img" aria-labelledby="rel-d4-title rel-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d4-title">RPO and RTO on a timeline</title>
<desc id="rel-d4-desc">A timeline with the last good copy of the data, then the disaster, then the service restored. The RPO is the gap between the last good copy and the disaster, the data you lose. The RTO is the gap between the disaster and the restore, the time you are offline.</desc>
<defs><marker id="rel-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="34" text-anchor="middle" class="d-label">RPO LOOKS BACK, RTO LOOKS FORWARD</text>
<line x1="40" y1="130" x2="690" y2="130" class="d-line" marker-end="url(#rel-d4-arrow)"/>
<circle cx="180" cy="130" r="8" class="d-fill-info"/>
<text x="180" y="105" text-anchor="middle" class="d-text">Last good copy</text>
<circle cx="360" cy="130" r="8" class="d-fill-danger"/>
<text x="360" y="105" text-anchor="middle" class="d-text">Disaster</text>
<circle cx="580" cy="130" r="8" class="d-fill-accent"/>
<text x="580" y="105" text-anchor="middle" class="d-text">Service restored</text>
<rect x="184" y="152" width="172" height="30" rx="10" class="d-box-warn"/>
<text x="270" y="172" text-anchor="middle" class="d-text">RPO: data lost</text>
<rect x="364" y="152" width="212" height="30" rx="10" class="d-box-danger"/>
<text x="470" y="172" text-anchor="middle" class="d-text">RTO: time offline</text>
<text x="270" y="208" text-anchor="middle" class="d-small">How much data can we lose?</text>
<text x="470" y="208" text-anchor="middle" class="d-small">How long can we be down?</text>
</svg>
</div>
<figcaption>Figure 3: RPO measures the data you lose, RTO measures the time you are offline</figcaption>
</figure>

A nightly backup gives you an RPO of up to 24 hours: if the database dies at 11 p.m., you lose the whole day. Continuous replication can bring RPO down to seconds. On the other side, if restoring means provisioning infrastructure from scratch, restoring 2 TB and repointing DNS, your RTO is measured in hours, no matter how nice the runbook looks.

Two things people often forget:

- **RTO includes detection and decision time.** If it takes 20 minutes to notice the outage and another 30 for someone with authority to say "fail over", that's 50 minutes gone before any recovery starts. Define in advance who decides and under what conditions, or automate the decision.
- **Replication also replicates mistakes.** If someone runs a `DELETE` without a `WHERE`, synchronous replication will faithfully delete the rows in the replica too, in milliseconds. Replicas protect against infrastructure failure; **backups** (with point-in-time restore) protect against human error, bugs, corruption and ransomware. You need both.

## Backup and Disaster Recovery Strategies

**Goal:** pick a recovery strategy per *workload* that meets its RTO and RPO at a cost the business accepts.

There's a well-known spectrum of disaster recovery strategies (AWS documents it very clearly, and the same ideas apply to any cloud). As you move to the right, recovery gets faster and data loss gets smaller, and the bill gets bigger.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 270" role="img" aria-labelledby="rel-d3-title rel-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d3-title">Disaster recovery strategies</title>
<desc id="rel-d3-desc">Four disaster recovery strategies from left to right: backup and restore, pilot light, warm standby and multi-site active. Moving right lowers RTO and RPO and raises cost and complexity.</desc>
<defs><marker id="rel-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="370" y="35" text-anchor="middle" class="d-label">DISASTER RECOVERY STRATEGIES</text>
<rect x="20" y="60" width="160" height="125" rx="10" class="d-box"/>
<text x="100" y="92" text-anchor="middle" class="d-title">Backup &amp; Restore</text>
<text x="100" y="120" text-anchor="middle" class="d-small">Only backups</text>
<text x="100" y="142" text-anchor="middle" class="d-small">RPO: hours</text>
<text x="100" y="164" text-anchor="middle" class="d-small">RTO: hours to days</text>
<rect x="200" y="60" width="160" height="125" rx="10" class="d-box-info"/>
<text x="280" y="92" text-anchor="middle" class="d-title">Pilot Light</text>
<text x="280" y="120" text-anchor="middle" class="d-small">Data live, compute off</text>
<text x="280" y="142" text-anchor="middle" class="d-small">RPO: minutes</text>
<text x="280" y="164" text-anchor="middle" class="d-small">RTO: tens of minutes</text>
<rect x="380" y="60" width="160" height="125" rx="10" class="d-box-accent"/>
<text x="460" y="92" text-anchor="middle" class="d-title">Warm Standby</text>
<text x="460" y="120" text-anchor="middle" class="d-small">Small copy running</text>
<text x="460" y="142" text-anchor="middle" class="d-small">RPO: seconds</text>
<text x="460" y="164" text-anchor="middle" class="d-small">RTO: minutes</text>
<rect x="560" y="60" width="160" height="125" rx="10" class="d-box-warn"/>
<text x="640" y="92" text-anchor="middle" class="d-title">Multi-Site Active</text>
<text x="640" y="120" text-anchor="middle" class="d-small">Full copy serving</text>
<text x="640" y="142" text-anchor="middle" class="d-small">RPO: near zero</text>
<text x="640" y="164" text-anchor="middle" class="d-small">RTO: near zero</text>
<line x1="20" y1="215" x2="716" y2="215" class="d-line-accent" marker-end="url(#rel-d3-arrow)"/>
<text x="20" y="245" text-anchor="start" class="d-label">CHEAPER, SLOWER RECOVERY</text>
<text x="720" y="245" text-anchor="end" class="d-label">COSTLIER, FASTER RECOVERY</text>
</svg>
</div>
<figcaption>Figure 4: The DR spectrum, where every step to the right buys lower RTO and RPO with money and complexity</figcaption>
</figure>

### 1. Backup and Restore

You keep backups (ideally in another region) and, when disaster strikes, you provision the infrastructure from your IaC and restore the data.

**Benefit:** the cheapest option; you only pay for storage. Great for non-critical *workloads* and as the foundation for every other strategy.
**Watch out for:** RTO depends on how fast you can rebuild everything. Without IaC, "rebuild everything" means clicking through a portal under pressure at 4 a.m. Not recommended.

### 2. Pilot Light

The core data is continuously replicated to the secondary region, but compute is off or minimal. On disaster, you start and scale the application tier around the data that's already there.

**Benefit:** RPO drops to minutes or seconds thanks to replication, while the cost stays low because almost nothing is running.
**Watch out for:** scaling up from zero in a region under pressure may hit quotas or capacity limits, exactly when every other customer is doing the same thing.

### 3. Warm Standby

A scaled-down but fully functional copy of the *workload* runs all the time in the secondary region. On disaster, you scale it up and send traffic to it.

**Benefit:** recovery in minutes, and because the copy is always running, you can continuously test that it actually works.
**Watch out for:** you're paying for a second environment full time, and it needs the same deployment discipline as production or it will drift.

### 4. Multi-Site Active-Active

Both (or all) regions serve production traffic all the time. Losing one means the others absorb its load.

**Benefit:** near-zero RTO and RPO, and no "failover" in the dramatic sense, just a capacity reduction.
**Watch out for:** the highest cost and, above all, the highest complexity (data consistency, conflict handling, global routing). Reserve it for flows that truly justify it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Relax, we're covered. The backup job runs every night and the dashboard shows a green check. Done!"</span>
    </div>
  </div>
</div>

Junior, a backup you've never restored is a *Schrödinger's backup*: it's both working and broken until you open the box, and you really don't want to open the box for the first time during an outage. A green check means the job ran. It doesn't mean the file is complete, the encryption key still exists, the restore fits in your RTO, or that anyone knows the procedure. Some backup habits worth adopting:

- **Test restores regularly**, automatically if possible, and measure how long they take. That number is your real RTO, not the one in the document.
- **Follow the 3-2-1 idea:** at least three copies, on two different types of storage, with one off-site (in the cloud: another region or another account).
- **Make backups immutable** or keep them in a separate, locked-down account. Ransomware loves to delete backups first, and so do stressed engineers with admin rights.
- **Back up more than data:** configuration, secrets (securely), IaC state, DNS records. Restoring a database without the connection strings and certificates is only half a recovery.
- **Match retention to the need:** point-in-time restore for recent mistakes, long-term retention for compliance.

## Self-Healing and Health Probes

**Goal:** let the platform detect and fix common failures automatically, faster than any human could.

Remember the four nines table: 4.3 minutes per month. The only way to get there is to let machines handle the routine failures. Self-healing is the set of mechanisms that detect a problem and react without waiting for someone to wake up.

### Health Probes

Load balancers, orchestrators and service meshes decide where to send traffic based on **health probes**. How you design those probes matters more than people think:

- **Liveness:** "is this process alive, or stuck?" If it fails, restart the instance. Keep it simple and fast.
- **Readiness:** "can this instance take traffic right now?" If it fails, take it out of rotation without killing it (for example, while it warms up a cache or loses its database connection).
- **Shallow vs deep checks:** a shallow check only confirms the process responds. A deep check verifies critical dependencies too. Deep checks give a more honest picture, but be careful: if every instance checks the database and the database blinks, the load balancer may pull **all** instances out at once and turn a small hiccup into a full outage. Many teams use shallow checks for routing and deep checks for monitoring and alerting.

### Self-Healing Mechanisms

| Approach | Benefit |
| :--- | :--- |
| **Automatic instance replacement** (orchestrators, scale sets, managed instance groups) | Failed instances are recycled without human intervention |
| **Autoscaling with sane minimums** | Absorbs load spikes and replaces lost capacity; minimums spread across zones keep you alive during a zone failure |
| **Managed services with built-in failover** (databases, queues, storage) | The provider handles replication and failover, often better than you would |
| **Graceful degradation** | Non-critical features switch off under stress so critical flows keep running |
| **Queue-based load leveling** | Queues absorb bursts and let consumers process at their own pace, isolating producers from slow consumers |
| **Automated failover with clear criteria** | Removes the "who decides?" delay from the RTO; manual approval only where the risk of a false failover is high |

The code-level half of self-healing (retries with exponential backoff and jitter, circuit breakers, bulkheads, timeouts, idempotency) is covered in [Resilience Patterns](/en-us/principles/solution/resilience-patterns/). The short version: every network call can fail, so every network call needs a timeout and a plan.

And none of this works if you can't see it. Health models, SLI dashboards, alerts on error budget burn rate and distributed tracing are what tell you whether self-healing is healing or just flapping. That's the territory of [Observability First](/en-us/principles/solution/observability-first/).

## Test Reliability

**Goal:** prove, regularly and on purpose, that the *workload* survives the failures you designed it to survive.

Every reliability mechanism in this article is a hypothesis until you test it. The failover you never triggered, the backup you never restored, the alert that never fired: they all work perfectly in the architecture diagram.

### Chaos Engineering

Chaos engineering is the discipline of **injecting failures on purpose** in a controlled way to find weaknesses before they find you. Netflix made it famous with Chaos Monkey, which randomly terminated production instances so engineers had no choice but to build services that tolerated it.

The process is scientific, not reckless:

1. **Define the steady state:** what does "working" look like, in SLI terms?
2. **Form a hypothesis:** "if we lose one zone, checkout keeps its SLO".
3. **Inject the failure:** kill instances, add latency, block a dependency, fail a zone, fill a disk.
4. **Observe:** did the steady state hold? What broke that nobody expected?
5. **Fix and repeat,** gradually increasing the scope (the **blast radius**), from pre-production to production.

Managed tools make this much easier today: Azure Chaos Studio, AWS Fault Injection Service, and open source options like Chaos Mesh or LitmusChaos for Kubernetes.

### DR Drills and Game Days

- **DR drills:** actually fail over to the secondary region (or restore from backup into a clean environment) on a schedule. Measure the real RTO and RPO and compare them with the targets. The first drill is always humbling, and that's the point.
- **Game days:** the team gets together, someone injects a failure (sometimes without telling everyone what it is) and the team responds as in a real incident, using the real runbooks and dashboards. You test the system, the alerts, the documentation **and the people**.

Every drill and game day should end like an incident: with a blameless review, action items and updates to the FMA and runbooks.

<div class="callout warning">
  <p>Start small and safe. Run your first experiments in pre-production, with a clear abort button and the team watching. Chaos engineering in production without solid observability and a kill switch isn't engineering, it's just chaos.</p>
</div>

## Keep It Simple

**Goal:** avoid adding complexity that creates more failure modes than it removes.

This one sounds contradictory after so many sections about redundancy, but it's one of the most important reliability principles. **Every component you add is a component that can fail.** Every replication link, every failover script, every extra region is new code and new configuration that needs to be tested and operated.

Some healthy habits:

- **Prefer managed services** for undifferentiated heavy lifting. The provider's database team has handled more failovers than yours ever will.
- **Don't build multi-region active-active for an internal tool** that needs three nines. Match the architecture to the target, not to the conference talk.
- **Reduce moving parts in critical flows.** If checkout calls seven services synchronously, that's seven multiplications in your composite SLA. Can some of them be asynchronous or optional?
- **Make failover boring:** one well-understood, automated, regularly tested mechanism beats three clever ones nobody fully understands.
- **Evolve gradually:** start with zone redundancy and solid backups, measure, and add regions only when the targets and the incident history demand it. [Evolutionary Design](/en-us/principles/solution/evolutionary-design/) applies here too.

A simple system with good backups, zone redundancy and a tested runbook is often more reliable in practice than a sophisticated multi-region design that the team is afraid to touch.

## Tradeoffs

**Reliability** ensures the *workload* keeps delivering what it promised, through clear targets, redundancy, recovery plans and continuous testing. But reliability is not free, and it's not isolated. Decisions made to improve it inevitably pull on the other pillars.

Shall we look at a few practical examples?

### Tradeoffs with Cost Optimization

More copies, more money: redundant instances, extra zones and secondary regions multiply infrastructure costs, and a warm standby or active-active setup can nearly double the bill.

Higher service tiers: zone redundancy, geo-replication and premium SLAs usually live in more expensive SKUs.

Idle capacity: active-passive and failover headroom mean paying for resources that sit unused most of the time.

Testing costs: DR drills, chaos experiments and pre-production environments that mirror production consume resources and team time.

Data transfer: cross-zone and cross-region replication generates network egress charges that are easy to forget in estimates.

### Tradeoffs with Performance Efficiency

Synchronous replication adds latency: waiting for a write to be confirmed in another zone or region makes every write slower.

Health checks, replication and telemetry consume CPU, memory and network that the *workload* could use for real work.

Consistency versus speed: stronger consistency across regions protects data but costs latency; eventual consistency is fast but opens the door to conflicts and stale reads.

Extra hops: global load balancers, queues and gateways added for reliability each add a little time to the request path.

### Tradeoffs with Operational Excellence

More complexity to operate: multi-region deployments, replication and failover automation need more pipelines, more runbooks and more expertise.

Deployments get harder: every change must be rolled out to multiple locations in a safe order, keeping versions compatible during the rollout.

Drift risk: a passive or standby environment that doesn't receive the same changes as production will silently diverge and fail when you need it.

Testing overhead: game days and drills are valuable, but they take planning, time and coordination away from delivery.

### Tradeoffs with Security

Larger attack surface: every replica, region and backup copy is one more place where data lives and must be protected, patched and monitored.

Data residency and compliance: replicating to another region may move personal data across borders, which regulations such as LGPD and GDPR may restrict.

Access for recovery: break-glass accounts and automated failover need powerful permissions, which must be tightly controlled and audited.

Backups as targets: backup stores hold complete copies of your data and are prime targets; they need encryption, isolation and immutability. See [Security](/en-us/principles/cloud/security/) for more.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So if I make it more reliable I pay more, deploy slower and have more to secure? Then why not just make everything five nines and stop worrying?"</span>
    </div>
  </div>
</div>

Because five nines everywhere would bankrupt the project long before it saved it, Junior! That's the whole point of starting with targets. The business decides how much reliability each flow is worth, the architecture delivers exactly that (not less, and not much more), and the tradeoffs are documented so everyone knows what was chosen and why. Perfection doesn't exist, but conscious decisions do.

## Conclusion

**Reliability** is not about avoiding failure; it's about **expecting it**. Everything fails, all the time, and a well-architected *workload* is one where failure was anticipated, sized and planned for.

It starts with **targets**: SLIs measured from the user's point of view, SLOs agreed with the business, SLAs that leave room for error, and composite math that keeps promises honest. It continues with **understanding** the system: critical flows, failure modes and single points of failure. Then comes **design**: redundancy at the right level, RTO and RPO per flow, and a disaster recovery strategy the business can afford. And it's sustained by **automation and testing**: self-healing for routine failures, and chaos experiments, DR drills and game days to prove the rest actually works.

**Most importantly:** reliability has a price in cost, performance, operational effort and security. The job of the architect is not to maximize it, but to find the level where the cost of the next nine is higher than the cost of the downtime it would prevent, and to make that choice consciously, together with the team and the business.

## Next Steps

1. **Define targets for your critical flows**
Pick the two or three flows that matter most, define user-centric SLIs and agree on SLOs with the business. Make sure any SLA is looser than the SLO.

2. **Do the composite math**
Draw the dependency chain of each critical flow, write down the availability of each component and multiply. Compare the result with what you promise.

3. **Run a failure mode analysis**
For each component in the critical flows, record how it can fail, the impact, how you'd detect it and how you mitigate it. Hunt for single points of failure.

4. **Set RTO and RPO and choose a DR strategy**
Agree on recovery targets per flow and pick the cheapest strategy (backup and restore, pilot light, warm standby or multi-site) that meets them.

5. **Restore a backup this month**
Not "check that it exists": actually restore it into a clean environment and measure how long it takes. Then schedule it to happen regularly.

6. **Start testing on purpose**
Run a small chaos experiment in pre-production, then plan a game day. Adopt error budgets to balance reliability work with feature delivery.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/reliability/" target="_blank" rel="noopener">Azure Well-Architected Framework: Reliability</a></li>
    <li><a href="https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html" target="_blank" rel="noopener">AWS Well-Architected Framework: Reliability Pillar</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://sre.google/sre-book/table-of-contents/" target="_blank" rel="noopener">Site Reliability Engineering (Google SRE book)</a></li>
    <li><a href="https://sre.google/workbook/table-of-contents/" target="_blank" rel="noopener">The Site Reliability Workbook</a></li>
    <li><a href="https://principlesofchaos.org/" target="_blank" rel="noopener">Principles of Chaos Engineering</a></li>
  </ul>
</div>
