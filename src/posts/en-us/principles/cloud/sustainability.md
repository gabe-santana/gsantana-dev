---
title: Sustainability
short: The greenest server is the one you never had to turn on. After all, why burn energy on work nobody asked for?
category: cloud
---

## Introduction

For a long time, sustainability sounded like a topic for the facilities team, the annual ESG report or the marketing slide with a leaf on it. Architects had "real" problems to solve: latency, availability, security, the bill. Well, the cloud changed that. When your data center is an API call away, every architectural decision you make is also an energy decision, and energy (along with the hardware that consumes it) has a carbon footprint.

That's why AWS added **Sustainability** as the sixth pillar of its Well-Architected Framework, Microsoft published guidance for sustainable *workloads* in the Azure Well-Architected Framework, and Google Cloud has a sustainability pillar in its Architecture Framework. On the community side, the **Green Software Foundation** (GSF) has been turning the subject into engineering practice, with principles, patterns and even a specification for measuring the carbon intensity of software.

The **goal** of this principle is simple to state and hard to practice: **deliver the same business value using fewer resources, less energy and cleaner energy**. It isn't about making the product worse to save the planet. It's about removing waste that nobody would miss.

When a team ignores this principle, the symptoms are surprisingly familiar:

- Virtual machines running at single-digit CPU utilization, 24 hours a day, 7 days a week;
- Development and test environments that nobody turns off at night or on weekends;
- Data kept forever in the hottest (and most energy-hungry) storage tier "just in case";
- Batch jobs scheduled at whatever time the developer happened to type into the cron expression;
- Huge AI models answering questions a much smaller one would handle just fine;
- No idea at all of how much carbon the *workload* emits, and therefore no way to improve it;

Yep, *it's rare, but it happens all the time*... Who hasn't found a forgotten cluster humming along in some subscription, burning energy for a project that ended months ago?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But the cloud is somebody else's data center! If it pollutes, isn't that the provider's problem? I just write code."</span>
    </div>
  </div>
</div>

Easy there, Junior! That's exactly the misunderstanding this principle tries to fix. The provider is responsible for a lot, but not for everything. Let's see how that responsibility is split.

## Shared Responsibility for Sustainability

You probably know the shared responsibility model from security: the provider secures the physical infrastructure and you secure what you build on top of it. AWS applies the same idea to sustainability, and it works nicely as a mental model for any cloud:

- **Sustainability OF the cloud** belongs to the provider: data center efficiency, cooling, how the energy is sourced, the hardware supply chain, server utilization across its fleet, and what happens to equipment at the end of its life.
- **Sustainability IN the cloud** belongs to you: which region you deploy to, how well you use what you provision, how efficient your code is, how much data you store and for how long, and which architectural patterns you choose.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="sus-d1-title sus-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d1-title">Shared responsibility for sustainability</title>
<desc id="sus-d1-desc">The customer owns sustainability in the cloud: region choice, utilization, efficient code and data lifecycle. The provider owns sustainability of the cloud: data centers, cooling, energy sourcing and hardware lifecycle.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">SHARED RESPONSIBILITY</text>
<rect x="40" y="46" width="640" height="116" rx="10" class="d-box-accent"/>
<text x="360" y="74" text-anchor="middle" class="d-title">You: sustainability IN the cloud</text>
<rect x="60" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="130" y="123" text-anchor="middle" class="d-text">Region choice</text>
<rect x="215" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="285" y="123" text-anchor="middle" class="d-text">Utilization</text>
<rect x="370" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="440" y="123" text-anchor="middle" class="d-text">Efficient code</text>
<rect x="525" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="595" y="123" text-anchor="middle" class="d-text">Data lifecycle</text>
<line x1="40" y1="178" x2="680" y2="178" class="d-line-dashed"/>
<rect x="40" y="194" width="640" height="90" rx="10" class="d-box-info"/>
<text x="360" y="222" text-anchor="middle" class="d-title">Provider: sustainability OF the cloud</text>
<text x="360" y="246" text-anchor="middle" class="d-small">data centers, cooling, energy sourcing,</text>
<text x="360" y="266" text-anchor="middle" class="d-small">hardware supply chain and end of life</text>
</svg>
</div>
<figcaption>Figure 1: The provider runs an efficient data center; what you run inside it is on you</figcaption>
</figure>

The provider can run the most efficient data center on the planet, but if you leave a hundred idle machines running inside it, those machines still consume energy and still occupy hardware that had to be manufactured. **Efficiency of the building doesn't cancel waste in the tenant.**

<div class="callout info">
  <p>Sustainability in the cloud is an <strong>architectural responsibility</strong>, just like cost and security. It isn't something you delegate to the provider's marketing page.</p>
</div>

## The Building Blocks of Green Software

The Green Software Foundation organizes the topic around a few core ideas. They're worth knowing by name, because every practice later in this article is an application of one of them.

### Carbon efficiency

Emit the least amount of carbon possible **per unit of useful work**. This is the umbrella goal. Everything else is a way to get there. Notice the "per unit of work": a system that serves ten times more users with twice the emissions became *more* carbon efficient, even though its total footprint grew.

### Energy efficiency

Use the least amount of energy possible to do the job. Energy is the main proxy for operational carbon: less energy consumed means less carbon emitted, whatever the grid mix is. There's a subtle point here called **energy proportionality**: servers don't consume energy in proportion to their load. An idle or lightly loaded server still draws a significant share of its peak power just by being on. That's why a few well-utilized machines beat many idle ones.

### Hardware efficiency (embodied carbon)

Every server, disk, network switch and phone had carbon emitted to build it, ship it and eventually dispose of it. That's **embodied carbon**, and it's "spent" before your first request arrives. The practical conclusion: use the least hardware possible and get the most out of the hardware that already exists. Higher utilization amortizes embodied carbon over more useful work, and extending the useful life of devices avoids manufacturing new ones.

### Carbon awareness

The same kilowatt-hour doesn't have the same carbon everywhere, or at every hour. The carbon intensity of electricity depends on the mix of sources feeding the grid (solar, wind, hydro, gas, coal...), and that mix changes by location and time of day. Carbon awareness means **doing more when and where the energy is cleaner, and less when and where it's dirtier**. This is achieved in two ways:

- **Demand shifting:** moving flexible work in time (run it later) or in space (run it in another region) to where the grid is cleaner;
- **Demand shaping:** changing how much work you do based on the energy available, for example reducing video quality or pausing non-essential features when intensity is high, the same way a phone's low-power mode trades features for battery life.

### Measurement

What you don't measure, you can't improve. This one is so important it deserves its own section.

## Measure Before You Optimize

Who hasn't seen a team debate for weeks about rewriting a service in a "faster language" to save energy, when the real waste was a forgotten environment costing more than the whole service? Measuring first keeps the effort where the emissions actually are.

### SCI: Software Carbon Intensity

The Green Software Foundation created the **Software Carbon Intensity (SCI)** specification, later published as the ISO/IEC 21031:2024 standard. Instead of producing a single total, it gives you a **rate**: carbon emitted per unit of something meaningful for your business.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 245" role="img" aria-labelledby="sus-d2-title sus-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d2-title">The Software Carbon Intensity formula</title>
<desc id="sus-d2-desc">SCI equals energy used times grid carbon intensity, plus embodied carbon, divided by a functional unit such as a user, a request or a job.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">SOFTWARE CARBON INTENSITY (SCI)</text>
<text x="180" y="58" text-anchor="middle" class="d-label">OPERATIONAL</text>
<text x="435" y="58" text-anchor="middle" class="d-label">EMBODIED</text>
<text x="615" y="58" text-anchor="middle" class="d-label">FUNCTIONAL UNIT</text>
<rect x="30" y="70" width="130" height="90" rx="10" class="d-box-info"/>
<text x="95" y="100" text-anchor="middle" class="d-title">E</text>
<text x="95" y="122" text-anchor="middle" class="d-small">energy used</text>
<text x="95" y="142" text-anchor="middle" class="d-small">kWh</text>
<text x="180" y="121" text-anchor="middle" class="d-title">×</text>
<rect x="200" y="70" width="130" height="90" rx="10" class="d-box-info"/>
<text x="265" y="100" text-anchor="middle" class="d-title">I</text>
<text x="265" y="122" text-anchor="middle" class="d-small">grid intensity</text>
<text x="265" y="142" text-anchor="middle" class="d-small">gCO2e per kWh</text>
<text x="350" y="121" text-anchor="middle" class="d-title">+</text>
<rect x="370" y="70" width="130" height="90" rx="10" class="d-box-warn"/>
<text x="435" y="100" text-anchor="middle" class="d-title">M</text>
<text x="435" y="122" text-anchor="middle" class="d-small">embodied carbon</text>
<text x="435" y="142" text-anchor="middle" class="d-small">hardware share</text>
<text x="525" y="120" text-anchor="middle" class="d-text">per</text>
<rect x="550" y="70" width="130" height="90" rx="10" class="d-box-accent"/>
<text x="615" y="100" text-anchor="middle" class="d-title">R</text>
<text x="615" y="122" text-anchor="middle" class="d-small">per unit</text>
<text x="615" y="142" text-anchor="middle" class="d-small">user, request, job</text>
<text x="360" y="198" text-anchor="middle" class="d-text">SCI = ((E × I) + M) per R</text>
<text x="360" y="224" text-anchor="middle" class="d-small">A rate, not a total: lower it with less energy, cleaner energy or less hardware</text>
</svg>
</div>
<figcaption>Figure 2: SCI turns carbon into a rate you can track, like latency or cost per transaction</figcaption>
</figure>

- **E** is the energy consumed by the software;
- **I** is the carbon intensity of the electricity where and when it ran (location-based, grams of CO2 equivalent per kWh);
- **M** is the share of the hardware's embodied emissions attributable to the software;
- **R** is the functional unit: per user, per API call, per transaction, per training run, per report generated.

The beauty of it is that the formula itself tells you the three levers you have: **use less energy (E), use cleaner energy (I), or use less hardware (M)**. And because it's a rate, it rewards efficiency instead of punishing growth.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Why all this math? The provider says it's matching 100% of its energy with renewables, and we can always buy carbon offsets. Problem solved, right?"</span>
    </div>
  </div>
</div>

Not so fast, Junior! Renewable energy purchase agreements and certificates are a real and valuable effort by the providers, but they're an accounting instrument over a whole year and a whole fleet. At any given hour, the machine running your code is still plugged into a physical grid with a physical mix of sources. That's why the SCI uses location-based intensity and **explicitly doesn't let you lower your score with offsets or market-based instruments**: the only way to improve it is to actually emit less. Offsets may have a place in a company's climate strategy, but they're not an architecture decision. Reducing waste is.

### Provider carbon dashboards

You don't need to start from zero. The three major providers offer carbon reporting for your account:

| Tool | What it gives you |
| :--- | :--- |
| **Azure: Emissions Impact Dashboard** (and carbon optimization views in the portal) | Estimated emissions of your Azure usage, broken down by service and region, suitable for reporting and trend tracking. |
| **AWS: Customer Carbon Footprint Tool** | Estimated emissions of your AWS usage by service and region, available in the billing console, with historical data to track progress. |
| **Google Cloud: Carbon Footprint** | Estimated emissions per project, service and region, with export to BigQuery for your own analysis. |

A few honest caveats: these reports usually lag behind by weeks or months, use each provider's own methodology (so comparing across clouds is tricky), and are better for **trends and reporting** than for real-time decisions. For day-to-day engineering, pair them with the proxies you already have: CPU and memory utilization, idle hours, storage volume, data transferred and, of course, the bill. For carbon-aware scheduling, you'll want grid intensity data by region and hour, which the GSF's open source **Carbon Aware SDK** can fetch from third-party data providers.

<div class="callout tip">
  <p>Start with a <strong>proxy you already measure</strong>. If you track utilization and idle resources for FinOps, you're already tracking a good part of your energy waste. Perfect carbon accounting isn't a prerequisite for cutting obvious waste.</p>
</div>

## Design Principles for Sustainability

With the building blocks and the measurement in place, let's get practical. The following principles bring together the AWS Sustainability pillar, the Azure guidance on sustainable *workloads* and the Green Software Foundation's patterns.

### 1. Choose regions deliberately

**Goal:** Run *workloads* where the energy is cleaner, as long as business requirements allow it.

Regions differ in the carbon intensity of the local grid and in how much renewable or carbon-free energy the provider has there. Google, for example, publishes carbon-free energy information per region, and its console highlights lower-carbon regions. Latency, data residency laws (like LGPD or GDPR), service availability and cost still come first, but when two regions satisfy the requirements, carbon is a legitimate tiebreaker.

| Approach | Benefit |
| :--- | :--- |
| **Include carbon intensity in region selection criteria**, alongside latency, compliance and cost. | Moves the whole *workload* to a cleaner baseline with a one-time decision. |
| **Place flexible work (batch, training, analytics) in cleaner regions**, even if interactive traffic stays close to users. | Captures most of the benefit without hurting user experience. |
| **Keep data close to compute.** | Avoids moving large volumes across regions, which costs energy and money. |

### 2. Maximize utilization and right size

**Goal:** Get more useful work out of every machine you provision.

This is where sustainability and cost shake hands. Because of energy proportionality and embodied carbon, an oversized fleet running at low utilization is wasteful twice: it burns energy while doing little, and it ties up hardware that had a carbon cost to manufacture.

| Approach | Benefit |
| :--- | :--- |
| **Right size continuously** based on real utilization metrics, not on the "just to be safe" estimate from launch day. | Fewer, fuller machines doing the same work. |
| **Scale to demand with autoscaling**, including scale-in and scale to zero where the platform supports it. | Capacity follows the load curve instead of sitting at peak all day. |
| **Turn off non-production environments** outside working hours, and create them on demand. | Removes a huge share of idle hours with a simple schedule. |
| **Prefer higher-density platforms**: containers, serverless and managed services where it makes sense. | The provider packs many tenants on shared hardware, raising utilization far beyond what a single team usually reaches. |
| **Use the latest efficient instance families**, including ARM-based processors where your stack supports them. | Newer generations generally deliver more performance per watt. Validate with your own benchmarks. |

### 3. Shift and shape demand

**Goal:** Do flexible work when and where the grid is cleaner, and scale down optional work when it isn't.

Not everything needs to run *right now*. Nightly reports, data pipelines, model training, video transcoding, backups and index rebuilds usually have a deadline, not a specific minute. That flexibility is an opportunity.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="sus-d3-title sus-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d3-title">Shifting a batch job to a cleaner window</title>
<desc id="sus-d3-desc">A line shows grid carbon intensity varying over a day. A batch job originally scheduled at the evening peak is moved to a midday window where intensity is lower, using the same energy with fewer emissions.</desc>
<defs><marker id="sus-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">GRID CARBON INTENSITY OVER A DAY</text>
<text x="66" y="54" text-anchor="start" class="d-small">gCO2e per kWh</text>
<rect x="340" y="62" width="150" height="168" rx="10" class="d-box-muted"/>
<text x="415" y="82" text-anchor="middle" class="d-label">CLEANER WINDOW</text>
<line x1="60" y1="60" x2="60" y2="230" class="d-line"/>
<line x1="60" y1="230" x2="680" y2="230" class="d-line"/>
<polyline points="60,120 140,100 220,95 300,150 370,190 440,195 500,160 560,95 620,82 680,110" fill="none" class="d-line-accent"/>
<rect x="570" y="140" width="100" height="46" rx="10" class="d-box-danger"/>
<text x="620" y="160" text-anchor="middle" class="d-text">Batch job</text>
<text x="620" y="178" text-anchor="middle" class="d-small">peak hours</text>
<rect x="365" y="96" width="100" height="46" rx="10" class="d-box-accent"/>
<text x="415" y="116" text-anchor="middle" class="d-text">Batch job</text>
<text x="415" y="134" text-anchor="middle" class="d-small">shifted</text>
<line x1="568" y1="160" x2="470" y2="124" class="d-line-dashed" marker-end="url(#sus-d3-arrow)"/>
<text x="60" y="250" text-anchor="middle" class="d-small">00:00</text>
<text x="215" y="250" text-anchor="middle" class="d-small">06:00</text>
<text x="370" y="250" text-anchor="middle" class="d-small">12:00</text>
<text x="525" y="250" text-anchor="middle" class="d-small">18:00</text>
<text x="680" y="250" text-anchor="middle" class="d-small">24:00</text>
<text x="360" y="282" text-anchor="middle" class="d-small">Same job, same energy, fewer emissions: only the time changed</text>
</svg>
</div>
<figcaption>Figure 3: Demand shifting in time (illustrative curve; the real shape depends on each grid)</figcaption>
</figure>

| Approach | Benefit |
| :--- | :--- |
| **Separate urgent work from flexible work** in your design, with queues and deadlines instead of fixed schedules. | Creates the freedom to choose *when* things run. |
| **Schedule flexible jobs using grid intensity forecasts** (time shifting) or run them in a cleaner region (location shifting). | Same work, same energy, lower emissions. |
| **Shape demand**: degrade gracefully when intensity is high, for example lower default video resolution, fewer background refreshes, or deferred non-essential features. | Keeps the core experience while trimming optional consumption. |
| **Flatten peaks with queues and load leveling.** | Smoother load means less capacity provisioned only for the peak. |

<div class="callout warning">
  <p>Shifting only helps if the work is truly flexible. Moving a job to "the cleanest hour" and then blowing through a business deadline is not a green win, it's an incident. Encode the deadline in the scheduler, not in someone's memory.</p>
</div>

### 4. Manage the data lifecycle

**Goal:** Store only what you need, in the right tier, for as long as you need it.

Data feels free because it's invisible. It isn't. Every copy lives on disks that consume energy and were manufactured with embodied carbon, and hot storage with high redundancy consumes more than cold archival tiers. Who hasn't found terabytes of debug logs from a service that was decommissioned two years ago?

| Approach | Benefit |
| :--- | :--- |
| **Classify data and define retention policies** from day one. | Data stops accumulating by default. |
| **Use lifecycle rules to move data between tiers** (hot, cool, archive) and to delete it when retention ends. | Less energy-intensive storage for data that's rarely read, automatically. |
| **Avoid unnecessary copies and over-replication**: match redundancy to the data's real criticality. | Fewer disks spinning for the same information. |
| **Compress and use efficient formats** (for example columnar formats for analytics). | Less storage, less data transferred, less compute to scan it. |
| **Reduce data transfer**: caching, CDNs and sending only the fields the client needs. | Network equipment consumes energy too, and so do the devices on the other end. |

### 5. Write efficient software

**Goal:** Do the same work with fewer CPU cycles, less memory and fewer network round trips.

This is where developers have direct influence. Efficient code isn't about micro-optimizations everywhere; it's about not doing work that isn't needed.

- **Avoid unnecessary work**: N+1 queries, polling where events would do, recomputing results that could be cached, serializing huge payloads nobody reads;
- **Choose appropriate algorithms and data structures** for hot paths, guided by profiling rather than guesses;
- **Optimize the front end**: smaller bundles, optimized images, lazy loading. A heavy page costs energy on every visit, on every device, forever;
- **Use asynchronous and event-driven designs** so resources aren't held while waiting;
- **Remove dead features**: code paths, scheduled jobs and integrations nobody uses still consume resources.

<div class="callout info">
  <p>Don't rewrite everything in a "faster language" because of a benchmark you saw online. Profile first. The biggest wins almost always come from <strong>not doing work at all</strong>: an idle cluster turned off saves more than any clever loop.</p>
</div>

### 6. Be deliberate with AI and LLM workloads

**Goal:** Use the smallest model, the least hardware and the fewest tokens that meet the quality bar.

AI workloads deserve a principle of their own, because they concentrate everything we've discussed: power-hungry accelerators with significant embodied carbon, long-running training jobs, and inference traffic that grows with every user.

Let me tell you a story I've seen in more than one version. A team gets a GPU cluster approved for a proof of concept. The experiment runs for a couple of weeks, the results go into a presentation, everyone is happy, and the project moves on to the next phase... with a different architecture. The cluster? It stays there, fully provisioned, utilization close to zero, for months. Nobody owns it anymore, nobody remembers why it exists, and nobody wants to be the one who deletes it "in case someone needs it". Accelerators are among the most expensive and energy-hungry resources in the cloud, so this one forgotten cluster can easily outweigh every other optimization the team ever made. The finance team eventually noticed, of course, because **cost and carbon waste usually show up in the same place**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But the biggest model is always the smartest one! Why wouldn't I use it for everything, including classifying support tickets?"</span>
    </div>
  </div>
</div>

Easy there, Junior! The biggest model is the most *capable*, not necessarily the most *appropriate*. Classifying a ticket into five categories doesn't need the same model that writes a legal analysis. A larger model generally needs more compute per token, more memory and often more accelerators to serve. If a smaller model meets your quality bar in your evaluations, the larger one is just burning energy to give you the same answer.

| Approach | Benefit |
| :--- | :--- |
| **Pick the smallest model that passes your evaluations**, and route by task: small models for simple tasks, large ones only where they're needed. | Less compute per request for most of the traffic. |
| **Use distilled, fine-tuned or quantized models** where quality allows. | Smaller memory footprint, fewer accelerators, faster inference. |
| **Batch inference requests** and use batch APIs for work that isn't interactive. | Higher accelerator utilization; providers often price batch processing lower, too. |
| **Cache responses and prompts** (including provider prompt caching) and avoid regenerating identical answers. | Work done once, reused many times. |
| **Keep prompts and outputs lean**: trim context, limit output length, retrieve only relevant documents. | Tokens are compute; fewer tokens, less energy. |
| **Prefer fine-tuning or retrieval over training from scratch**, and schedule training in cleaner regions and windows. | Avoids the most energy-intensive step when it isn't needed, and makes the unavoidable part cleaner. |
| **Give every accelerator an owner and an expiry**, with alerts on low utilization and automatic scale to zero. | The idle GPU cluster story never happens again. |

### 7. Extend hardware life and think about the end user

**Goal:** Reduce the embodied carbon your system demands, on both sides of the wire.

Embodied carbon isn't only in the data center. If your web app is so heavy that it only runs well on last year's phones, you're nudging users toward new hardware. If your internal tools require top-tier laptops, the same applies.

- Support older devices and browsers where reasonable, and keep the client lightweight;
- Prefer managed and shared services over dedicated hardware you'll underuse;
- For on-premises or hybrid estates, extend refresh cycles when the equipment still meets requirements, and consolidate before buying more.

## Sustainability and Cost: Usually Friends, Not Twins

If you read the [Cost Optimization](/en-us/principles/cloud/cost-optimization/) principle, many of the practices above probably felt familiar: right sizing, turning off idle resources, lifecycle policies, autoscaling. That's no coincidence. In the cloud, you pay for resources, and resources consume energy and hardware. **Most of the time, cutting waste cuts both the bill and the emissions.**

Most of the time. Not always.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 375" role="img" aria-labelledby="sus-d4-title sus-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d4-title">Sustainability and cost matrix</title>
<desc id="sus-d4-desc">A two by two matrix. Lower cost and lower carbon: turn off idle resources, right size, delete unread data. Lower carbon but higher cost: cleaner but pricier regions, carbon-aware engineering effort. Lower cost but not lower carbon: cheaper regions with dirtier grids, paid capacity left idle. Higher cost and higher carbon: oversized always-on systems, unneeded redundancy, logs kept forever.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">SUSTAINABILITY AND COST: USUALLY FRIENDS</text>
<rect x="120" y="50" width="275" height="135" rx="10" class="d-box-info"/>
<text x="257" y="80" text-anchor="middle" class="d-title">Greener, but pricier</text>
<text x="257" y="108" text-anchor="middle" class="d-small">Cleaner region costs more</text>
<text x="257" y="128" text-anchor="middle" class="d-small">Carbon-aware scheduling work</text>
<text x="257" y="148" text-anchor="middle" class="d-small">Engineering time to measure</text>
<rect x="405" y="50" width="275" height="135" rx="10" class="d-box-accent"/>
<text x="542" y="80" text-anchor="middle" class="d-title">Both win</text>
<text x="542" y="108" text-anchor="middle" class="d-small">Turn off idle resources</text>
<text x="542" y="128" text-anchor="middle" class="d-small">Right size and consolidate</text>
<text x="542" y="148" text-anchor="middle" class="d-small">Delete data nobody reads</text>
<rect x="120" y="195" width="275" height="135" rx="10" class="d-box-danger"/>
<text x="257" y="225" text-anchor="middle" class="d-title">Avoid</text>
<text x="257" y="253" text-anchor="middle" class="d-small">Oversized and always on</text>
<text x="257" y="273" text-anchor="middle" class="d-small">Redundancy nobody needs</text>
<text x="257" y="293" text-anchor="middle" class="d-small">Logs kept forever</text>
<rect x="405" y="195" width="275" height="135" rx="10" class="d-box-warn"/>
<text x="542" y="225" text-anchor="middle" class="d-title">Cheaper, not greener</text>
<text x="542" y="253" text-anchor="middle" class="d-small">Cheaper region, dirtier grid</text>
<text x="542" y="273" text-anchor="middle" class="d-small">Paid capacity left idle</text>
<text x="60" y="110" text-anchor="middle" class="d-label">LOWER</text>
<text x="60" y="126" text-anchor="middle" class="d-label">CARBON</text>
<text x="60" y="255" text-anchor="middle" class="d-label">HIGHER</text>
<text x="60" y="271" text-anchor="middle" class="d-label">CARBON</text>
<text x="257" y="355" text-anchor="middle" class="d-label">HIGHER COST</text>
<text x="542" y="355" text-anchor="middle" class="d-label">LOWER COST</text>
</svg>
</div>
<figcaption>Figure 4: Most waste reduction lands in "Both win", but watch the other quadrants</figcaption>
</figure>

A few situations where the two diverge:

- **The cheapest region isn't always the cleanest.** Moving a *workload* to save a few percent on compute can land it on a grid that emits considerably more per kWh.
- **"It's already paid for."** Reservations and savings plans are great for cost, but they create a perverse incentive: if the capacity is prepaid, nobody bothers to turn it off. Financially it's sunk cost; for the planet, an idle machine is still drawing power. Right sizing the commitment in the next cycle matters.
- **Carbon-aware engineering has a price.** Measuring, building schedulers that follow grid intensity and running jobs in a more expensive but cleaner region all cost money and engineering time.
- **Offsets cost money and reduce nothing in the architecture.** They may be part of a corporate strategy, but they don't change the system's SCI.

<div class="callout tip" data-title="A practical rule">
  <p>Start with the "Both win" quadrant: it pays for itself and nobody argues with it. Then decide, explicitly and with the business, how much you're willing to invest in the "Greener, but pricier" quadrant. Just don't pretend that the "Cheaper, not greener" decisions are green.</p>
</div>

## Tradeoffs

**Sustainability** pushes the *workload* toward doing more with less: fewer resources, higher utilization, less data, cleaner energy. That's a healthy pressure, but like every pillar, it pulls against the others at some point. Shall we look at a few practical examples?

### Tradeoffs with Reliability

Redundancy is the reliability pillar's best friend, and redundancy means resources that exist "just in case". A multi-region active-passive setup keeps a whole standby environment consuming energy and hardware while waiting for a disaster that may never happen.

Higher utilization leaves less headroom. A fleet running at high utilization is efficient, but a traffic spike or a failed node has less spare capacity to absorb it.

Aggressive scale-in and scale to zero introduce cold starts and scaling delays, which can hurt availability during sudden peaks.

Shorter retention and fewer data copies reduce storage, but also reduce the options for recovery and forensic analysis.

**How to balance:** match redundancy to the real criticality of each component (not every service needs multi-region), prefer active-active designs where the standby capacity does useful work, and use [Reliability](/en-us/principles/cloud/reliability/) targets (SLOs, RTO, RPO) to justify every spare resource instead of adding them by reflex.

### Tradeoffs with Performance Efficiency

Carbon-aware scheduling delays work on purpose. If a report needs to be ready in minutes, waiting for a cleaner window isn't an option.

Running in a cleaner but farther region adds latency for interactive users.

Smaller AI models are more efficient but may deliver lower quality on complex tasks, and demand shaping (lower video quality, fewer refreshes) is literally a reduction in experience.

On the other hand, [Performance Efficiency](/en-us/principles/cloud/performance-efficiency/) and sustainability agree more often than they fight: efficient code, caching and less data transferred make systems both faster and greener.

### Tradeoffs with Cost Optimization

As we saw above, they usually walk together, but cleaner regions can be more expensive, measurement and carbon-aware tooling cost engineering time, and early hardware refreshes for efficiency add embodied carbon and capital expense at the same time.

### Tradeoffs with Security

Security controls consume resources: encryption, detailed audit logs, extended retention for compliance, scanning and duplicate environments for isolation all add energy and storage. You don't cut these to save carbon; you size them correctly, retain what regulations require (and not "forever by default"), and tier security logs like any other data.

Sharing infrastructure increases utilization but can weaken isolation. Multi-tenant density is great for sustainability, but some data classifications demand dedicated resources.

### Tradeoffs with Operational Excellence

Measuring carbon, maintaining lifecycle policies, owning schedules and running carbon-aware pipelines is additional operational work. More automation, more components, more things to monitor. Without the discipline from [Operational Excellence](/en-us/principles/cloud/operational-excellence/) (ownership, IaC, automation), sustainability initiatives become one-off cleanups that decay within months.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So if I turn everything off, the system is maximally green? Zero servers, zero carbon!"</span>
    </div>
  </div>
</div>

Technically correct, Junior, and also a great way to get fired! A system that doesn't deliver value isn't sustainable, it's just off. The point was never to minimize resources at any cost, it's to minimize **waste**: resources that don't contribute to the value the business needs. Like every tradeoff, the answer is a conscious decision, documented and made together with the team and the business, not a reflex in either direction.

## Conclusion

**Sustainability** is the newest pillar in the Well-Architected frameworks, but its ideas aren't new at all: use what you need, turn off what you don't, do work efficiently and pay attention to where your energy comes from. What changed is that we can now measure it, attribute it and design for it, just like we do with cost and performance.

The provider takes care of sustainability *of* the cloud; sustainability *in* the cloud is ours. That includes region choice, utilization, demand shifting, data lifecycle, efficient code and, increasingly, the deliberate use of AI. Most of these practices also lower the bill, which makes them an easy sell. The ones that don't should be discussed openly, as the tradeoffs they are.

In the end, sustainable architecture is simply **architecture without waste**. And a system without waste is cheaper, simpler, faster and easier to operate. Not a bad deal for something that's also good for the planet.

## Next Steps

1. **Get visibility**
Enable your provider's carbon reporting (Emissions Impact Dashboard, Customer Carbon Footprint Tool or Carbon Footprint) and review it alongside your cost reports. Pick one proxy you already track, such as idle hours or average utilization, as a starting metric.

2. **Harvest the "Both win" quadrant**
Turn off idle resources, schedule non-production environments, right size oversized machines and apply lifecycle policies to storage and logs. Give every expensive resource, especially accelerators, an owner and an expiry date.

3. **Define an SCI for a key workload**
Choose a meaningful functional unit (per user, per transaction, per job), estimate E, I and M, and track the rate over time. Use it to compare design options, not just to report.

4. **Make flexible work carbon aware**
Identify batch, training and analytics jobs with flexible deadlines, move them to queues with deadlines, and experiment with time or location shifting using grid intensity data.

5. **Review AI workloads with an efficiency lens**
Evaluate smaller or distilled models, add caching and batching, trim prompts and route tasks to the right model size.

6. **Add sustainability to architecture reviews**
Include carbon as a criterion in design decisions and ADRs, next to cost, reliability and performance, and document the tradeoffs when you consciously choose against it.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html" target="_blank" rel="noopener">AWS Well-Architected: Sustainability Pillar</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://greensoftware.foundation/" target="_blank" rel="noopener">Green Software Foundation</a></li>
    <li><a href="https://sci.greensoftware.foundation/" target="_blank" rel="noopener">Software Carbon Intensity (SCI) Specification</a></li>
    <li><a href="https://learn.greensoftware.foundation/" target="_blank" rel="noopener">Green Software Practitioner course</a></li>
    <li><a href="https://github.com/Green-Software-Foundation/carbon-aware-sdk" target="_blank" rel="noopener">Carbon Aware SDK</a></li>
    <li><a href="https://aws.amazon.com/aws-cost-management/aws-customer-carbon-footprint-tool/" target="_blank" rel="noopener">AWS Customer Carbon Footprint Tool</a></li>
    <li><a href="https://cloud.google.com/carbon-footprint" target="_blank" rel="noopener">Google Cloud Carbon Footprint</a></li>
    <li><a href="https://www.finops.org/" target="_blank" rel="noopener">FinOps Foundation</a></li>
  </ul>
</div>
