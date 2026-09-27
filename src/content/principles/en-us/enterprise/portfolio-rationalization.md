---
title: Portfolio Rationalization
short: A lean application portfolio, with no redundancy and no hidden costs. After all, why pay three times for the same CRM?
category: enterprise
---

## Introduction

Every company that has been around for a few years carries a collection of systems. Some were bought, some were built in-house, some came along with an acquisition, and some were created on a Friday afternoon by someone in Finance who "just needed a quick tool". Over time, that collection grows, and almost nobody stops to ask the uncomfortable question: **do we still need all of this?**

**Portfolio rationalization** is the discipline of answering that question on purpose. The **goal** of this principle is simple to say and hard to do: **keep only the applications that deliver value, in the healthiest possible state, at the lowest reasonable total cost**. Everything else gets modernized, consolidated or switched off, in a planned and safe way.

When an organization ignores this principle, the symptoms show up everywhere:

- Nobody can produce a reliable list of all the systems the company runs;
- Three (or five) applications doing the same job in different departments;
- License renewals that get paid automatically, year after year, for tools nobody opens;
- Integrations so tangled that any change in one system breaks two others;
- Security patches that never happen because "that server is too old to touch";
- An IT budget where most of the money goes to *keeping the lights on* and almost nothing is left to innovate;

Yep, *it's rare, but it happens all the time*... Who hasn't been there?

### The system nobody owns and nobody dares to turn off

Every company has one. It's a virtual machine (or worse, a physical box under someone's desk) with a cryptic name like `SRV-APP-07`. It consumes compute, storage, licenses and backup. It shows up on every vulnerability scan with a red score. Nobody knows exactly what it does. The person who built it left the company six years ago.

And yet, nobody dares to turn it off. Because what if it's the thing that generates the monthly regulatory report? What if the payroll integration goes through it? What if the CEO's favorite dashboard reads from its database?

So the server keeps running. Year after year. Quietly costing money, quietly accumulating risk. That machine is the perfect symbol of an organization that never practiced portfolio rationalization: **the fear of the unknown is more expensive than the system itself, but nobody has ever measured either**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But if it's running and nobody complains, why bother? If it ain't broke, don't fix it, right?"</span>
    </div>
  </div>
</div>

Easy there, Junior! "Nobody complains" is not the same as "it costs nothing". That system is paying for licenses, hardware, energy, backup and, above all, **risk**: an unpatched operating system on the network is an open door. It also pays in attention, because every audit, every migration and every infrastructure change has to tiptoe around it. The problem isn't that it's broken. The problem is that **nobody knows whether it matters**, and that ignorance has a price.

<div class="callout info">
  <p>Portfolio rationalization is not a one-off cost-cutting project. It's a continuous practice of <strong>knowing what you have</strong>, <strong>judging it honestly</strong> and <strong>acting on that judgment</strong>, so that the portfolio stays aligned with what the business actually needs.</p>
</div>

## What Application Portfolio Management Really Is

Portfolio rationalization lives inside a broader discipline called **Application Portfolio Management (APM)**. The idea comes from finance: an investor manages a portfolio of assets, deciding which to buy, hold or sell based on return and risk. APM applies the same thinking to software. Each application is an asset that consumes money and people, and it has to justify its place.

In practice, the work follows a cycle that never really ends:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 260" role="img" aria-labelledby="port-d1-title port-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d1-title">The portfolio rationalization cycle</title>
<desc id="port-d1-desc">Five steps in a loop: inventory the applications, assess value and health, decide with TIME and the 7 Rs, execute through roadmap waves, and govern to keep the portfolio lean, which feeds back into the inventory.</desc>
<defs><marker id="port-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="32" text-anchor="middle" class="d-label">APPLICATION PORTFOLIO MANAGEMENT</text>
<rect x="24" y="70" width="112" height="72" rx="10" class="d-box-info"/>
<text x="80" y="100" text-anchor="middle" class="d-title">Inventory</text>
<text x="80" y="122" text-anchor="middle" class="d-small">CMDB, discovery</text>
<line x1="136" y1="106" x2="162" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="164" y="70" width="112" height="72" rx="10" class="d-box"/>
<text x="220" y="100" text-anchor="middle" class="d-title">Assess</text>
<text x="220" y="122" text-anchor="middle" class="d-small">value vs health</text>
<line x1="276" y1="106" x2="302" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="304" y="70" width="112" height="72" rx="10" class="d-box-accent"/>
<text x="360" y="100" text-anchor="middle" class="d-title">Decide</text>
<text x="360" y="122" text-anchor="middle" class="d-small">TIME and 7 Rs</text>
<line x1="416" y1="106" x2="442" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="444" y="70" width="112" height="72" rx="10" class="d-box"/>
<text x="500" y="100" text-anchor="middle" class="d-title">Execute</text>
<text x="500" y="122" text-anchor="middle" class="d-small">roadmap waves</text>
<line x1="556" y1="106" x2="582" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="584" y="70" width="112" height="72" rx="10" class="d-box-warn"/>
<text x="640" y="100" text-anchor="middle" class="d-title">Govern</text>
<text x="640" y="122" text-anchor="middle" class="d-small">keep it lean</text>
<path d="M640,142 L640,196 L80,196 L80,146" fill="none" class="d-line-dashed" marker-end="url(#port-d1-arrow)"/>
<text x="360" y="222" text-anchor="middle" class="d-small">new systems, new contracts and new needs feed the next round</text>
</svg>
</div>
<figcaption>Figure 1: Portfolio rationalization is a loop, not a project</figcaption>
</figure>

Let's walk through each step.

## Step 1: Know What You Have

You can't rationalize what you can't see. The first step, and honestly the one where most initiatives die, is building a **reliable inventory**.

### 1. Start with the CMDB, but don't trust it blindly

Many companies already have a **CMDB** (Configuration Management Database), usually tied to the ITSM tool. It's a great starting point, but it tends to be outdated: servers that were decommissioned years ago, applications registered with the wrong owner, SaaS tools that were never added because "they don't run on our infrastructure".

**Goal:** treat the CMDB as a hypothesis to be validated, not as the truth.

### 2. Use automated discovery

Complement the CMDB with sources that don't depend on someone remembering to fill in a form:

- **Network and infrastructure discovery:** agents and scanners that find hosts, open ports, running processes and the connections between them;
- **Cloud inventories:** resource graphs and tags from each cloud provider, which list everything that exists (and everything that bills);
- **Identity provider logs:** SSO sign-ins reveal which SaaS applications people actually use, and how often;
- **Finance data:** credit card statements, expense reports and accounts payable are an amazing source for finding software that IT never approved;
- **Code repositories and pipelines:** every deployable artifact is a candidate application.

**Benefit:** the inventory reflects reality instead of good intentions, and it can be refreshed automatically.

### 3. Capture the minimum useful attributes

An inventory with two hundred fields per application never gets filled in. Start small, with what you need to make decisions:

| Attribute | Why it matters |
|-----------|----------------|
| **Business owner** | Someone who can say whether the system still matters. No owner, no decision. |
| **Technical owner** | Someone who knows how it runs and what breaks if it stops. |
| **Business capability** | Which capability it supports (billing, CRM, HR...). This is how you find redundancy. |
| **Users and usage** | How many people use it and how often. Real numbers, not opinions. |
| **Integrations** | What it sends data to and receives data from. This is where the hidden risk lives. |
| **Annual cost** | Licenses, infrastructure, support and people. Even a rough estimate helps. |
| **Technology and lifecycle** | Stack, versions, vendor support end dates. |
| **Data classification** | Whether it holds personal, financial or regulated data. |

### 4. Map applications to business capabilities

This is the secret weapon. When you attach every application to a **business capability map**, redundancy jumps off the page. You look at the "Customer Relationship Management" capability and find three different CRMs: one bought by Sales years ago, one that came with the acquisition of a smaller company, and one that Marketing built on a low-code platform because the other two "didn't do what they needed".

Three CRMs means three license contracts, three sets of integrations with the ERP, three versions of the customer's truth and three teams keeping them alive. And, of course, no one can answer a simple question like "how many active customers do we have?" without a spreadsheet war.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Why all this trouble? Just send a spreadsheet to every manager and ask them to list their systems!"</span>
    </div>
  </div>
</div>

You can do that, Junior, and you should, as one of the sources. But a self-reported spreadsheet only captures what people remember and what they're comfortable admitting. The tool someone pays for on a corporate card, the macro-powered Excel file that is secretly a critical system, the old server that "belongs to nobody"... none of those make the list. That's why you cross the survey with discovery, SSO logs and finance data. **The truth is in the intersection.**

### Shadow IT: the portfolio nobody approved

**Shadow IT** is any technology used by the business without IT's knowledge or approval. It's not always a villain: most of the time it's a symptom that official IT is too slow or doesn't meet a real need. But it brings real problems:

- Company data (sometimes personal data) living in tools with no security review;
- Contracts signed without legal or procurement review;
- Duplicated spending, because each department pays for its own license;
- No offboarding: when someone leaves, their access to that SaaS tool stays open.

The right answer is not to "hunt down and ban" everything. It's to bring it into the light: discover it, assess it like any other application, and then decide. Sometimes the shadow tool is better than the official one and becomes the new standard. Sometimes it gets consolidated. Either way, it stops being invisible.

## Step 2: Assess Value and Health

With the inventory in hand, it's time to judge each application honestly. Two questions matter most:

1. **Business value:** how much does this application contribute to the business? Does it support a critical capability? Does it generate revenue, satisfy regulation, differentiate the company?
2. **Technical health:** how good is its technical condition? Is it supported by the vendor? Is it secure, stable, maintainable, integrable? Can people still find skills for it in the market?

Each question becomes a score, built from a few weighted criteria:

| Dimension | Example criteria |
|-----------|------------------|
| **Business value** | Criticality of the capability, number of users, revenue or regulatory impact, strategic fit, user satisfaction |
| **Technical health** | Vendor support status, security posture, incident frequency, maintainability, architecture fit, skill availability |

Keep the scoring simple (1 to 5 per criterion is plenty) and, most importantly, **score with the people who know**: business owners score value, technical owners score health. An architect scoring everything alone produces a pretty chart that nobody believes.

### The TIME model

With both scores in hand, you plot each application on a two by two matrix. **Gartner** popularized a classic way to read it, the **TIME model**: *Tolerate, Invest, Migrate, Eliminate*.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 390" role="img" aria-labelledby="port-d2-title port-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d2-title">The TIME model</title>
<desc id="port-d2-desc">A two by two matrix with technical health on the horizontal axis and business value on the vertical axis. High value and low health means Migrate, high value and high health means Invest, low value and low health means Eliminate, low value and high health means Tolerate.</desc>
<defs><marker id="port-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="146" y="46" width="228" height="134" rx="10" class="d-box-warn"/>
<text x="260" y="94" text-anchor="middle" class="d-title">Migrate</text>
<text x="260" y="118" text-anchor="middle" class="d-small">valuable, but fragile</text>
<text x="260" y="136" text-anchor="middle" class="d-small">modernize or replace</text>
<rect x="386" y="46" width="228" height="134" rx="10" class="d-box-accent"/>
<text x="500" y="94" text-anchor="middle" class="d-title">Invest</text>
<text x="500" y="118" text-anchor="middle" class="d-small">valuable and healthy</text>
<text x="500" y="136" text-anchor="middle" class="d-small">evolve and extend</text>
<rect x="146" y="192" width="228" height="134" rx="10" class="d-box-danger"/>
<text x="260" y="240" text-anchor="middle" class="d-title">Eliminate</text>
<text x="260" y="264" text-anchor="middle" class="d-small">low value, poor health</text>
<text x="260" y="282" text-anchor="middle" class="d-small">retire and archive</text>
<rect x="386" y="192" width="228" height="134" rx="10" class="d-box-info"/>
<text x="500" y="240" text-anchor="middle" class="d-title">Tolerate</text>
<text x="500" y="264" text-anchor="middle" class="d-small">healthy, low value</text>
<text x="500" y="282" text-anchor="middle" class="d-small">keep, minimal spend</text>
<line x1="130" y1="338" x2="640" y2="338" class="d-line" marker-end="url(#port-d2-arrow)"/>
<line x1="130" y1="338" x2="130" y2="36" class="d-line" marker-end="url(#port-d2-arrow)"/>
<text x="380" y="370" text-anchor="middle" class="d-label">TECHNICAL HEALTH</text>
<text x="160" y="356" text-anchor="middle" class="d-small">low</text>
<text x="600" y="356" text-anchor="middle" class="d-small">high</text>
<text x="92" y="190" text-anchor="middle" class="d-label" transform="rotate(-90 92 190)">BUSINESS VALUE</text>
<text x="118" y="322" text-anchor="end" class="d-small">low</text>
<text x="118" y="62" text-anchor="end" class="d-small">high</text>
</svg>
</div>
<figcaption>Figure 2: The TIME model, business value versus technical health</figcaption>
</figure>

- **Tolerate** (healthy, but low value): it works and it doesn't hurt, but it isn't strategic. Keep it running with minimal investment and don't add features.
- **Invest** (valuable and healthy): these are your crown jewels. Put money and people here, evolve them, make them the platform others consolidate into.
- **Migrate** (valuable, but technically fragile): the business depends on it, but it's sitting on an unsupported stack, full of incidents or impossible to change. Modernize it or replace it, carefully.
- **Eliminate** (low value and poor health): the easy wins. Plan the retirement, archive what must be kept and switch it off.

<div class="callout tip">
  <p>The matrix is a conversation starter, not a verdict. An application in <strong>Eliminate</strong> may still hold data you're legally required to keep for ten years. An application in <strong>Tolerate</strong> may be the only one integrating with a key partner. Use the quadrant to prioritize the discussion, then validate each case with its owners.</p>
</div>

### Handling redundancy

Redundancy deserves its own look. When several applications serve the same capability, you compare them side by side, using the same scores, and pick a **target**: usually the one in (or closest to) **Invest**. The others become consolidation candidates. Back to our three CRMs: if the one from Sales is healthy, well-integrated and has the most users, it becomes the target, and the other two get a migration plan with dates.

Beware of one trap: the "winner" is not always the most technically elegant system. It's the one that best balances business fit, health, cost and the effort to move everyone else into it.

## Step 3: Understand the Real Cost

A decision to consolidate or retire is ultimately a financial decision, so you need numbers. And the license price is usually the smallest part of the story. The number that matters is the **Total Cost of Ownership (TCO)**.

| Cost category | What people forget |
|---------------|--------------------|
| **Licenses and subscriptions** | Auto-renewals, unused seats, premium tiers nobody needs, minimum commitments |
| **Infrastructure** | Servers, storage, backup, disaster recovery, network, monitoring agents |
| **Integrations** | Middleware, custom connectors, the time spent fixing broken interfaces after every change |
| **People** | Support, maintenance, administrators, the specialist who is the only one who understands it |
| **Security and compliance** | Extra audits, compensating controls for unsupported software, risk exceptions |
| **Opportunity cost** | Budget and attention that could go to new capabilities instead of keeping old ones alive |

The **people** line is the one that surprises executives the most. A "free" open source tool that requires two engineers to keep alive isn't free. An old system that only one person understands has a cost that can't be measured in currency until the day that person resigns.

If you already practice **FinOps** on the cloud side, reuse it: tags, showback and cost allocation are exactly the data you need to attach a cost to each application. We covered that in [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

**Benefit:** with TCO per application, the portfolio stops being a list of names and becomes a list of investments, each one with a price and a return. That's the language the business understands.

## Step 4: Decide the Path for Each Application

TIME tells you the direction. For applications that will move, you still need to decide **how**. The most widely used vocabulary here came from cloud migration: the **Rs of migration**. It started as five, AWS expanded it to six and later to seven, and the list works just as well outside of cloud projects.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 290" role="img" aria-labelledby="port-d3-title port-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d3-title">The 7 Rs of migration</title>
<desc id="port-d3-desc">Seven strategies ordered from less to more change: retain, retire, relocate, rehost, replatform, repurchase and refactor. Effort, cost and risk grow from left to right.</desc>
<defs><marker id="port-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="370" y="32" text-anchor="middle" class="d-label">THE 7 RS, FROM LESS TO MORE CHANGE</text>
<rect x="16" y="64" width="96" height="100" rx="10" class="d-box-muted"/>
<text x="64" y="100" text-anchor="middle" class="d-title">Retain</text>
<text x="64" y="124" text-anchor="middle" class="d-small">keep as is</text>
<text x="64" y="142" text-anchor="middle" class="d-small">revisit later</text>
<rect x="118" y="64" width="96" height="100" rx="10" class="d-box-danger"/>
<text x="166" y="100" text-anchor="middle" class="d-title">Retire</text>
<text x="166" y="124" text-anchor="middle" class="d-small">turn it off</text>
<text x="166" y="142" text-anchor="middle" class="d-small">archive data</text>
<rect x="220" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="268" y="100" text-anchor="middle" class="d-title">Relocate</text>
<text x="268" y="124" text-anchor="middle" class="d-small">move the VMs</text>
<text x="268" y="142" text-anchor="middle" class="d-small">no changes</text>
<rect x="322" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="370" y="100" text-anchor="middle" class="d-title">Rehost</text>
<text x="370" y="124" text-anchor="middle" class="d-small">lift and shift</text>
<text x="370" y="142" text-anchor="middle" class="d-small">new infra</text>
<rect x="424" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="472" y="100" text-anchor="middle" class="d-title">Replatform</text>
<text x="472" y="124" text-anchor="middle" class="d-small">small tweaks</text>
<text x="472" y="142" text-anchor="middle" class="d-small">managed DB</text>
<rect x="526" y="64" width="96" height="100" rx="10" class="d-box-warn"/>
<text x="574" y="100" text-anchor="middle" class="d-title">Repurchase</text>
<text x="574" y="124" text-anchor="middle" class="d-small">move to SaaS</text>
<text x="574" y="142" text-anchor="middle" class="d-small">drop custom</text>
<rect x="628" y="64" width="96" height="100" rx="10" class="d-box-accent"/>
<text x="676" y="100" text-anchor="middle" class="d-title">Refactor</text>
<text x="676" y="124" text-anchor="middle" class="d-small">re-architect</text>
<text x="676" y="142" text-anchor="middle" class="d-small">cloud native</text>
<line x1="24" y1="206" x2="716" y2="206" class="d-line-accent" marker-end="url(#port-d3-arrow)"/>
<text x="24" y="232" class="d-small">less</text>
<text x="716" y="232" text-anchor="end" class="d-small">more</text>
<text x="370" y="232" text-anchor="middle" class="d-label">EFFORT, COST AND RISK</text>
<text x="370" y="262" text-anchor="middle" class="d-small">more change also means more potential benefit</text>
</svg>
</div>
<figcaption>Figure 3: The 7 Rs, a shared vocabulary for what happens to each application</figcaption>
</figure>

| Strategy | What it means | When it makes sense |
|----------|---------------|---------------------|
| **Retire** | Switch it off, archive what must be kept | Low value, redundant, or nobody uses it anymore |
| **Retain** | Leave it as is, for now | Recently upgraded, too risky to touch this year, or waiting for a dependency |
| **Relocate** | Move the whole platform to another host without changing it (e.g., a VMware cluster to a cloud VMware service) | Data center exit with a tight deadline |
| **Rehost** | *Lift and shift*: same application, new infrastructure | Quick infrastructure savings, first step before modernizing |
| **Replatform** | Small targeted changes, like swapping a self-managed database for a managed one | Reduce operational burden without rewriting |
| **Repurchase** | Replace it with a product, usually SaaS | Commodity capability (email, HR, CRM) where custom code adds no advantage |
| **Refactor** | Re-architect, often into cloud native services | High value, needs agility or scale the current design can't give |

Mapping TIME to the Rs is fairly natural: **Eliminate** leads to *Retire*; **Tolerate** usually means *Retain* (maybe *Rehost* if the data center is closing); **Migrate** leads to *Replatform*, *Repurchase* or *Refactor*; **Invest** may involve *Refactor* to unlock the next stage of growth.

<div class="callout warning">
  <p><strong>Retire and Repurchase are underused.</strong> Teams love to refactor because it's the most interesting work. But the cheapest line of code to maintain is the one that no longer exists, and for commodity capabilities, a good product often beats a custom system you'll have to maintain forever.</p>
</div>

For refactoring big, critical systems, avoid the "big bang" rewrite. The **Strangler Fig** pattern, where new functionality gradually replaces the old system piece by piece behind a stable interface, lets you move value early and keep rollback possible. We go deeper into this mindset in [Evolutionary Design](/en-us/principles/solution/evolutionary-design/).

## Step 5: Build a Consolidation Roadmap

With a decision per application, you need a plan that actually fits the organization's capacity. A roadmap that tries to retire forty systems in one quarter is a wish list, not a plan.

### 1. Start with quick wins

Unused SaaS subscriptions, zombie servers with zero traffic, duplicate tools with a handful of users. They build credibility, free budget for the harder moves and prove that the process works.

**Benefit:** early, visible savings buy the political capital you'll need for the difficult consolidations.

### 2. Group work into waves

Organize the roadmap in **waves**, grouping applications that share dependencies, data, users or infrastructure. Moving an application without moving the integrations it depends on just relocates the problem.

### 3. Respect the dependency order

If three systems read from the old database, you can't switch the database off before migrating the three. Draw the dependency graph (the integration attribute of the inventory pays off here) and sequence accordingly.

### 4. Respect the business calendar

Don't migrate the billing system in the last week of the fiscal year. Don't change the retail point of sale in December. Every business has its sacred periods, and the roadmap has to work around them.

### 5. Tie every move to a measurable outcome

Each wave should have a clear goal: licenses canceled, servers switched off, integrations removed, incidents reduced, hours saved. That's how you prove value and keep sponsorship. This is exactly the link described in [Business Alignment](/en-us/principles/enterprise/business-alignment/).

### 6. Fund the transition

Consolidation costs money before it saves money: parallel running, data migration, training, contract overlap. Put that in the business case upfront. A plan that assumes savings from day one gets canceled at the first budget review.

## Step 6: Decommission the Right Way

Switching off a system sounds like the easy part. It isn't. A careless decommission can erase data you were legally required to keep, break an integration nobody documented, or leave users stranded on a Monday morning. A good decommission is a small project with its own plan.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 280" role="img" aria-labelledby="port-d4-title port-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d4-title">Decommissioning, step by step</title>
<desc id="port-d4-desc">Six steps along a timeline: map dependencies and owners, announce the change, freeze the system as read-only, archive and export data according to retention rules, switch it off while keeping backups during a rollback window, and finally delete data, infrastructure and contracts.</desc>
<defs><marker id="port-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="32" text-anchor="middle" class="d-label">DECOMMISSIONING, STEP BY STEP</text>
<rect x="18" y="64" width="104" height="96" rx="10" class="d-box-info"/>
<text x="70" y="98" text-anchor="middle" class="d-title">Map</text>
<text x="70" y="122" text-anchor="middle" class="d-small">dependencies</text>
<text x="70" y="140" text-anchor="middle" class="d-small">and owners</text>
<line x1="122" y1="112" x2="136" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="138" y="64" width="104" height="96" rx="10" class="d-box"/>
<text x="190" y="98" text-anchor="middle" class="d-title">Announce</text>
<text x="190" y="122" text-anchor="middle" class="d-small">dates, who,</text>
<text x="190" y="140" text-anchor="middle" class="d-small">what changes</text>
<line x1="242" y1="112" x2="256" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="258" y="64" width="104" height="96" rx="10" class="d-box"/>
<text x="310" y="98" text-anchor="middle" class="d-title">Freeze</text>
<text x="310" y="122" text-anchor="middle" class="d-small">read-only</text>
<text x="310" y="140" text-anchor="middle" class="d-small">no new data</text>
<line x1="362" y1="112" x2="376" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="378" y="64" width="104" height="96" rx="10" class="d-box-accent"/>
<text x="430" y="98" text-anchor="middle" class="d-title">Archive</text>
<text x="430" y="122" text-anchor="middle" class="d-small">retention</text>
<text x="430" y="140" text-anchor="middle" class="d-small">and export</text>
<line x1="482" y1="112" x2="496" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="498" y="64" width="104" height="96" rx="10" class="d-box-warn"/>
<text x="550" y="98" text-anchor="middle" class="d-title">Switch off</text>
<text x="550" y="122" text-anchor="middle" class="d-small">scream test</text>
<text x="550" y="140" text-anchor="middle" class="d-small">keep backups</text>
<line x1="602" y1="112" x2="616" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="618" y="64" width="104" height="96" rx="10" class="d-box-danger"/>
<text x="670" y="98" text-anchor="middle" class="d-title">Delete</text>
<text x="670" y="122" text-anchor="middle" class="d-small">data, infra,</text>
<text x="670" y="140" text-anchor="middle" class="d-small">contracts</text>
<text x="70" y="188" text-anchor="middle" class="d-small">T-90 days</text>
<text x="190" y="188" text-anchor="middle" class="d-small">T-60 days</text>
<text x="310" y="188" text-anchor="middle" class="d-small">T-30 days</text>
<text x="430" y="188" text-anchor="middle" class="d-small">T-15 days</text>
<text x="550" y="188" text-anchor="middle" class="d-small">T-0</text>
<text x="670" y="188" text-anchor="middle" class="d-small">T+90 days</text>
<line x1="550" y1="214" x2="670" y2="214" class="d-line-dashed"/>
<line x1="550" y1="206" x2="550" y2="222" class="d-line-dashed"/>
<line x1="670" y1="206" x2="670" y2="222" class="d-line-dashed"/>
<text x="610" y="242" text-anchor="middle" class="d-small">rollback window</text>
</svg>
</div>
<figcaption>Figure 4: A decommission is a small project, with a timeline and a way back</figcaption>
</figure>

The timeline is illustrative; a small internal tool may go through it in a few weeks, while a core system may take a year. What matters is that every step exists.

### 1. Map dependencies and owners

Before anything else, find out who uses the system and what talks to it. Network flow logs, database connection logs, API gateway metrics and job schedulers tell you what the documentation doesn't. Confirm the business owner formally agrees with the retirement.

### 2. Communicate early and clearly

Tell users what's changing, when, why and where they should go instead. Repeat it. Then repeat it again closer to the date. Silence is the fastest way to turn a technical decision into a political crisis.

### 3. Freeze before you remove

Put the system in **read-only** mode first. People can still look up historical data, but nothing new goes in. This surfaces hidden writers (that nightly job nobody knew about) without losing anything.

### 4. Respect data retention

This one is non-negotiable. Tax, labor, health and financial records often have legal retention periods, and privacy laws such as **LGPD** and **GDPR** require you to delete personal data you no longer have a basis to keep. Decide, with legal and compliance, what gets archived (in an accessible, documented format), what gets migrated and what gets deleted.

### 5. Switch off with a way back

Turn it off, but keep backups and the ability to restore for an agreed window. This is where the famous **scream test** lives: you switch the system off and see who screams. Done carelessly, it's reckless. Done with a rollback plan, after communication and a read-only phase, it's a perfectly legitimate final check for that last dependency nobody documented.

### 6. Finish the job

Delete the infrastructure, revoke the credentials and service accounts, remove DNS entries and firewall rules, cancel the contracts and licenses, and update the CMDB. A decommission that leaves the license renewing and the VM snapshots lying around isn't finished; it's just hidden.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wait, so I could have just pulled the plug on SRV-APP-07 and waited to see who called? Why didn't anyone do that?"</span>
    </div>
  </div>
</div>

Because pulling the plug without the steps before it is how people lose their jobs, Junior! If that server turns out to feed the regulatory report and its data was never archived, you don't get a scream, you get a fine. The scream test is the **last** step of a careful process, not a replacement for it. Map, communicate, freeze, archive, and only then switch off, with the backup ready to come back.

## Keep the Portfolio Lean, Continuously

The biggest mistake is treating rationalization as a project that ends. You clean the portfolio, celebrate the savings, and two years later you're back to four CRMs. Entropy always wins unless there's a mechanism pushing back.

### 1. Put a gate at the entrance

Every new application, whether built, bought or subscribed, goes through a light intake review: does a system with this capability already exist? Who owns it? Where does the data live? This is one of the most valuable controls of [Governance](/en-us/principles/enterprise/governance/), as long as it's fast. A gate that takes three months simply creates more shadow IT.

### 2. Define standards per capability

When the company has a clear standard for CRM, for BI, for messaging, people have a default and don't need to reinvent the choice. That's the heart of [Standardization](/en-us/principles/enterprise/standardization/).

### 3. Give every application a lifecycle

Each application should have a declared state (emerging, strategic, tolerated, sunsetting, retired) and, for those sunsetting, a date. Vendor end of support dates go on the calendar years in advance, not discovered during an incident.

### 4. Review on a rhythm

Revisit scores and costs at least once a year, and every time there's a major trigger: an acquisition, a data center exit, a big contract renewal, a strategy change. Contract renewals are the perfect moment: "do we still need this?" should be asked before signing, not after.

### 5. Track portfolio health metrics

| Metric | What it tells you |
|--------|-------------------|
| **Number of applications per capability** | Redundancy trend over time |
| **Percentage of applications with a named owner** | Whether accountability is real |
| **Share of the budget spent on "run" vs "change"** | How much room is left for innovation |
| **Applications on unsupported technology** | Accumulated technical and security risk |
| **Retirements completed vs planned** | Whether the roadmap is actually executing |

**Benefit:** the portfolio stays aligned with the business by design, and rationalization becomes routine instead of a painful exercise every five years.

## Tradeoffs

**Portfolio rationalization** frees budget, reduces risk and simplifies the landscape. But, as with every principle, it comes with costs and conflicts that must be managed consciously.

### Consolidation risk versus savings

Every consolidation concentrates. Three CRMs become one, which means one failure now affects everyone, one vendor has more leverage over you, and one bad upgrade hits the whole company. The savings are real, but so is the larger blast radius. Balance it with strong reliability practices on the target platform (see [Reliability](/en-us/principles/cloud/reliability/)) and clear exit clauses in contracts. Sometimes keeping two systems for genuinely different needs is the right call.

### Disruption to users

A migration that is a win on the spreadsheet can be a loss on the ground. People lose features they relied on, workflows change, productivity dips during the transition. Underestimate this and you'll see users quietly rebuilding the old system in spreadsheets, which is just new shadow IT. Invest in change management, training and feature gap analysis before choosing the target.

### Migration cost and time

Consolidation pays off over years, but costs up front: parallel running, data migration, integration rework, contract overlap and the team's time. Some migrations never pay back, especially for systems close to their natural end of life. The honest answer, in those cases, is *Retain* until retirement, not an expensive migration for the sake of tidiness.

### Tradeoffs with Security

Retiring unsupported systems is a big security win, but the migration itself opens risks: data copied to temporary locations, extra credentials created for the transition, archives that need protection for years. Treat migration and archive environments with the same rigor as production. See [Security](/en-us/principles/cloud/security/).

### Tradeoffs with Operational Excellence

A rationalization program adds work to teams that are already busy: inventory updates, scoring sessions, migration waves, decommission checklists. Without automation (discovery, tagging, cost allocation) it becomes bureaucracy that people route around. On the other hand, a leaner portfolio means fewer things to patch, monitor and support, which is exactly what [Operational Excellence](/en-us/principles/cloud/operational-excellence/) asks for.

### Tradeoffs with Business Agility

Strict standards and heavy intake gates reduce redundancy, but they can slow down teams that need to experiment. A little controlled duplication, like a pilot of a new tool alongside the standard, can be the price of learning. The key is making it temporary and visible, with an end date and a decision at the end.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So consolidating can save money but also concentrate risk, annoy users and cost a fortune up front? How do I know if it's worth it?"</span>
    </div>
  </div>
</div>

Exactly the right question, Junior! You know it's worth it by putting everything on the same table: TCO today, TCO after, migration cost, risk concentrated and risk removed, and impact on users. When the numbers and the owners agree, you move. When they don't, you document the decision and revisit it later. That's the job, and it's always done together with the business, never behind its back. It's also why this principle walks hand in hand with [Risk Management](/en-us/principles/enterprise/risk-management/).

## Conclusion

**Portfolio rationalization** is the discipline of keeping an organization's application landscape honest. It starts with **knowing what you have** (a real inventory, crossing the CMDB with discovery, SSO and finance data), continues with **judging it fairly** (business value versus technical health, the TIME model, real TCO) and ends with **acting on it** (the 7 Rs, consolidation waves and careful decommissioning).

That forgotten server that nobody owns and nobody dares to turn off is not a technical problem. It's the visible symptom of a portfolio that nobody manages. Fixing it one server at a time helps; building the habit that prevents the next one is what really changes the game.

**Most importantly:** rationalization is not about having fewer systems for the sake of it. It's about having **the right systems**, well owned, well maintained and paid for consciously, so the budget and the talent of the organization go to what truly moves the business forward.

## Next Steps

1. **Build a first inventory**
Start with the CMDB, then cross it with cloud inventories, SSO logs and finance data. Aim for "good enough to decide", not perfect.

2. **Name an owner for every application**
No owner, no decision. Applications without a business owner are the first candidates for review.

3. **Map applications to business capabilities**
Use the map to expose redundancy. Pick one capability with obvious duplication as your pilot.

4. **Score value, health and cost**
Run short scoring sessions with business and technical owners, estimate the TCO, and plot the TIME matrix.

5. **Deliver quick wins, then plan the waves**
Retire the zombies and cancel unused licenses first. Use the savings and credibility to fund the harder consolidations.

6. **Institutionalize the loop**
Add an intake gate for new applications, lifecycle states with dates, a yearly review and a handful of portfolio health metrics.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">The Open Group: TOGAF Standard</a></li>
    <li><a href="https://aws.amazon.com/blogs/enterprise-strategy/6-strategies-for-migrating-applications-to-the-cloud/" target="_blank" rel="noopener">AWS: 6 Strategies for Migrating Applications to the Cloud</a></li>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework for Azure</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://www.finops.org/" target="_blank" rel="noopener">FinOps Foundation</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
