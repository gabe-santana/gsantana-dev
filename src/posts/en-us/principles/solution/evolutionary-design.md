---
title: Evolutionary Design
short: Architecture that changes in small, measured steps instead of betting everything on one big plan. After all, who can predict what the business will need in three years?
category: solution
---

## Introduction

Every system you'll ever work on will change. New features, new regulations, new traffic patterns, a new CEO with a new strategy, a cloud provider that deprecates the service you built everything on. The only real question is whether your architecture was built to **absorb change** or to **resist it**.

**Evolutionary Design** is the principle that treats change as the normal state of software, not as an exception. Instead of trying to get the whole design right on day one, you design enough to start, build in small steps, measure what happens, and let real feedback guide the next decision. The architecture grows with the product, protected by automated checks that keep it from rotting along the way.

When a team ignores this principle, the symptoms show up in one of two opposite flavors, and sometimes both at the same time:

- Months spent on diagrams and specifications before a single line of code reaches a real user;
- Decisions locked in early, based on guesses, that nobody dares to revisit later;
- The opposite extreme: no design at all, where every *sprint* adds another shortcut until the codebase becomes a big ball of mud;
- Changes that should take a day taking a month, because everything is coupled to everything;
- Fear of deploying, so releases get bigger, rarer and scarier;
- The famous "let's rewrite it from scratch" meeting, held every two years or so;
- Nobody remembers *why* the system is the way it is, so nobody knows what's safe to change.

Yep, *it's rare, but it happens all the time*... Who hasn't inherited a system where changing a field on a screen required touching eleven projects and asking for permission from three teams?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But wouldn't it be safer to design the whole thing properly at the start? Then we'd never need to change it!"</span>
    </div>
  </div>
</div>

Easy there, Junior! That's the dream of every architect who has never seen a system survive contact with real users. The problem isn't that designing up front is bad; it's that the future is unknowable. The requirements you're so sure about today are hypotheses, and some of them are wrong. You just don't know which ones yet.

Let me tell you a story that shows how that dream usually ends.

## The Rewrite That Never Shipped

A company had a monolith that was, honestly, a mess. Slow deploys, tangled code, a database with four hundred tables and no clear owner. Leadership approved "the new platform": a clean rewrite, designed from scratch by the best people in the company, with every future need anticipated.

The architecture team spent six months on the design. Microservices, event sourcing, a service mesh, a custom framework "so every team builds things the same way". Beautiful diagrams. Then development started.

Here's what happened over the next three years:

- The old system **kept changing**, because the business couldn't stop for three years. Every new feature had to be built twice, or the rewrite fell further behind;
- The requirements the design was based on **became obsolete**: the company entered a new market, dropped a product line and changed its pricing model twice;
- The custom framework consumed a whole team just to maintain it;
- Nothing reached production until "everything was ready", so there was **zero real feedback** for three years;
- The best engineers were on the rewrite, so the old system, the one paying the bills, was maintained by whoever was left.

In year three, a new CTO looked at the budget, looked at the delivery date (which had moved five times) and cancelled the project. The monolith is still running today. Slightly worse than before, because it was neglected for three years.

<div class="callout warning">
  <p>The big-bang rewrite fails for a simple reason: it trades a known, working system for an unknown one, and it delivers <strong>no value and no learning</strong> until the very end. By the time you find out your design assumptions were wrong, you've already spent the budget.</p>
</div>

The alternative was never "don't improve the system". It was to improve it **incrementally**: carve out one piece at a time, put it in production, learn from it, and keep going. That's what Evolutionary Design is about.

## What Evolutionary Architecture Actually Means

The term was popularized by Neal Ford, Rebecca Parsons and Patrick Kua in the book *Building Evolutionary Architectures*. Their definition is short and precise: an evolutionary architecture **supports guided, incremental change across multiple dimensions**.

Let's unpack those three words, because each one matters:

- **Incremental:** change happens in small steps, both in how the software is built (small commits, small deploys) and in how it's released (progressive rollout, not big-bang);
- **Guided:** the change isn't random. There are objective criteria (the *fitness functions*, which we'll see in a moment) that tell you whether the architecture is still healthy after each step;
- **Multiple dimensions:** architecture isn't only code structure. It includes performance, security, data, operability, cost, compliance. A change can be fine on one axis and terrible on another.

This sits between two extremes that everyone has seen in the wild.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="evo-d1-title evo-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d1-title">The design spectrum</title>
<desc id="evo-d1-desc">A horizontal axis from designing everything up front to no design at all. Big Design Up Front sits on the left, No Design on the right, and Evolutionary Design in the middle, designing continuously in small verifiable steps.</desc>
<defs><marker id="evo-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="24" text-anchor="middle" class="d-label">THE DESIGN SPECTRUM</text>
<text x="60" y="52" text-anchor="start" class="d-small">everything up front</text>
<text x="660" y="52" text-anchor="end" class="d-small">nothing at all</text>
<line x1="62" y1="66" x2="658" y2="66" class="d-line" marker-start="url(#evo-d1-arrow)" marker-end="url(#evo-d1-arrow)"/>
<rect x="30" y="95" width="200" height="120" rx="10" class="d-box-warn"/>
<text x="130" y="128" text-anchor="middle" class="d-title">Big Design Up Front</text>
<text x="130" y="154" text-anchor="middle" class="d-small">months of diagrams</text>
<text x="130" y="174" text-anchor="middle" class="d-small">decisions before data</text>
<text x="130" y="194" text-anchor="middle" class="d-small">rigid when wrong</text>
<rect x="260" y="95" width="200" height="120" rx="10" class="d-box-accent"/>
<text x="360" y="128" text-anchor="middle" class="d-title">Evolutionary</text>
<text x="360" y="154" text-anchor="middle" class="d-small">enough design to start</text>
<text x="360" y="174" text-anchor="middle" class="d-small">decide at the last</text>
<text x="360" y="194" text-anchor="middle" class="d-small">responsible moment</text>
<rect x="490" y="95" width="200" height="120" rx="10" class="d-box-danger"/>
<text x="590" y="128" text-anchor="middle" class="d-title">No Design</text>
<text x="590" y="154" text-anchor="middle" class="d-small">code first, think later</text>
<text x="590" y="174" text-anchor="middle" class="d-small">accidental architecture</text>
<text x="590" y="194" text-anchor="middle" class="d-small">big ball of mud</text>
<text x="360" y="252" text-anchor="middle" class="d-small">The target is the middle: design continuously, in small, verifiable steps</text>
</svg>
</div>
<figcaption>Figure 1: Evolutionary design sits between planning everything and planning nothing</figcaption>
</figure>

**Big Design Up Front (BDUF)** assumes you can know the requirements well enough to design everything before building. It works for bridges, where physics doesn't change after the blueprint is signed. Software isn't a bridge: the ground moves under it every quarter.

**No design** is what many teams fall into when they reject BDUF and misread agile as "we don't plan". Every decision is local and short-term, and the architecture that emerges is accidental. It's fast for six months and then it's slow forever.

Evolutionary Design is **not** the absence of design. As Martin Fowler put it years ago in *Is Design Dead?*, it's design that happens continuously, supported by practices (tests, refactoring, continuous integration) that make changing the design cheap. You still think hard about architecture; you just don't pretend you can think about all of it at once.

## Decide at the Last Responsible Moment

If you can't know everything up front, when should you make a decision? The Lean software community has a good answer: at the **last responsible moment**. That's the point where delaying further would eliminate an important option or cost more than deciding now.

Notice the word *responsible*. It's not the *last possible* moment, where the team is paralyzed and the decision gets made by accident. It's the moment where you have as much information as you're going to get without paying too much for waiting.

Why delay at all? Because every week you wait, you learn something:

- Real usage data shows which features matter and which were someone's guess;
- The load profile becomes visible, so you size for reality instead of a spreadsheet;
- The team understands the domain better, so the boundaries you draw are better;
- New options may appear (a managed service, a library, a platform feature).

### Reversible and Irreversible Decisions

Not every decision deserves the same care. Amazon made famous a simple way to sort them: **one-way doors** and **two-way doors**.

- A **two-way door** is a decision you can walk back through if it turns out wrong: a library choice behind an interface, a UI layout, a caching strategy, a feature behind a flag. Make these quickly, with small teams, and watch the results;
- A **one-way door** is hard or impossible to reverse: the primary database technology for core data, a public API contract that external customers integrate with, a data model with years of history, a vendor contract with a three-year lock-in. These deserve slow, careful thought, prototypes and a written record.

The trap is treating every decision as a one-way door (and becoming slow and bureaucratic) or treating one-way doors as two-way doors (and discovering the lock only when it's too late).

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 380" role="img" aria-labelledby="evo-d2-title evo-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d2-title">Decision reversibility matrix</title>
<desc id="evo-d2-desc">A two by two matrix with impact on the vertical axis and reversibility on the horizontal axis. High impact and hard to reverse is a one-way door that needs care. High impact and easy to reverse is a big two-way door, decided fast and monitored. Low impact and hard to reverse is a hidden trap. Low impact and easy to reverse means just do it.</desc>
<defs><marker id="evo-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="407" y="28" text-anchor="middle" class="d-label">DECISION MATRIX</text>
<text x="60" y="187" text-anchor="middle" class="d-label" transform="rotate(-90 60 187)">IMPACT</text>
<text x="120" y="64" text-anchor="end" class="d-small">high</text>
<text x="120" y="320" text-anchor="end" class="d-small">low</text>
<line x1="130" y1="324" x2="130" y2="52" class="d-line" marker-end="url(#evo-d2-arrow)"/>
<rect x="140" y="50" width="264" height="134" rx="10" class="d-box-danger"/>
<text x="272" y="105" text-anchor="middle" class="d-title">One-way door</text>
<text x="272" y="128" text-anchor="middle" class="d-small">decide carefully</text>
<text x="272" y="146" text-anchor="middle" class="d-small">prototype, ADR, review</text>
<rect x="410" y="50" width="264" height="134" rx="10" class="d-box-info"/>
<text x="542" y="105" text-anchor="middle" class="d-title">Big two-way door</text>
<text x="542" y="128" text-anchor="middle" class="d-small">decide fast</text>
<text x="542" y="146" text-anchor="middle" class="d-small">watch the metrics closely</text>
<rect x="140" y="190" width="264" height="134" rx="10" class="d-box-warn"/>
<text x="272" y="245" text-anchor="middle" class="d-title">Hidden trap</text>
<text x="272" y="268" text-anchor="middle" class="d-small">cheap now, costly later</text>
<text x="272" y="286" text-anchor="middle" class="d-small">make it reversible</text>
<rect x="410" y="190" width="264" height="134" rx="10" class="d-box-accent"/>
<text x="542" y="245" text-anchor="middle" class="d-title">Just do it</text>
<text x="542" y="268" text-anchor="middle" class="d-small">the team decides</text>
<text x="542" y="286" text-anchor="middle" class="d-small">no ceremony</text>
<line x1="140" y1="336" x2="672" y2="336" class="d-line" marker-end="url(#evo-d2-arrow)"/>
<text x="140" y="354" text-anchor="start" class="d-small">hard to reverse</text>
<text x="674" y="354" text-anchor="end" class="d-small">easy to reverse</text>
<text x="407" y="372" text-anchor="middle" class="d-label">REVERSIBILITY</text>
</svg>
</div>
<figcaption>Figure 2: Match the ceremony of a decision to its impact and reversibility</figcaption>
</figure>

The bottom-left quadrant is the sneaky one. Small decisions that look harmless but quietly become permanent: a date stored as a string in a table that ten services read, an internal event format that everyone copies, an ID generated in a way that leaks into URLs. Nobody writes an ADR for these, and five years later they cost a migration.

And here's the real architect's move: **turning one-way doors into two-way doors**. Put the database behind a repository layer. Version your public API from day one. Keep vendor-specific code behind an adapter. You pay a little now to buy the right to change your mind later.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Thoughtful junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Got it! So the trick is to postpone every decision as long as possible. Nobody can blame me for a decision I never made!"</span>
    </div>
  </div>
</div>

Nice try, Junior, but no. Not deciding is also a decision, usually the worst one, because it gets made by default, by whoever writes the code first, with no thought at all. The last *responsible* moment has a deadline. And for decisions that are cheap to reverse, delaying is pure waste: pick something reasonable, ship it, and learn. Save the long thinking for the one-way doors.

## Fitness Functions: Guardrails for Change

Here's the part that separates evolutionary architecture from "we just refactor when we feel like it". If the architecture is going to change continuously, how do you know it's still healthy? How do you stop a thousand small, reasonable-looking changes from slowly destroying the structure?

The answer from Ford, Parsons and Kua is the **architectural fitness function**: an objective, preferably automated, check of how well the system meets an architectural characteristic. The name comes from evolutionary computing, where a fitness function measures how close a candidate solution is to the goal.

In plain terms: you take the architectural rules that usually live in a wiki page nobody reads ("the domain layer must not depend on the web layer", "the checkout page must load in under two seconds", "no service calls another service's database") and you turn them into **tests that run in the pipeline**. When a change breaks a rule, the build fails, just like a failing unit test.

<div class="callout info">
  <p>A fitness function turns an architectural intention into an executable check. It's the difference between <strong>hoping</strong> the architecture is respected and <strong>knowing</strong> it is, on every commit.</p>
</div>

### Kinds of Fitness Functions

| Type | What it checks | Example |
| :--- | :--- | :--- |
| **Structural (dependency rules)** | Layers, module boundaries, forbidden dependencies, cycles | ArchUnit (Java), NetArchTest (.NET), dependency-cruiser (JavaScript) failing the build when the domain imports the infrastructure layer |
| **Performance budgets** | Latency, throughput, bundle size, page weight | A load test in the pipeline that fails if p95 latency exceeds 300 ms; a front-end budget that fails if the JavaScript bundle grows past 200 KB |
| **Security** | Vulnerable dependencies, secrets, insecure configuration | Dependency scanning and secret detection as blocking pipeline steps |
| **Operability** | Health checks, logs, metrics, traces present | A contract test that fails if a new service doesn't expose health and metrics endpoints |
| **Data and contracts** | Schema compatibility, API compatibility | Consumer-driven contract tests; a check that blocks breaking changes to a published event schema |
| **Cost** | Resource sizes, tags, spend per unit | Policy as Code that rejects untagged resources or oversized SKUs in non-production |
| **Holistic (in production)** | Behavior of the running system | SLO burn-rate alerts; chaos experiments that verify the system survives losing an instance |

Some fitness functions are **atomic** (they check one thing, like a dependency rule) and some are **holistic** (they check a combination, like "the system stays within its latency SLO during a zone failure"). Some run **on every commit**, some **on a schedule**, some **continuously in production**. You need a mix.

### How to Adopt Fitness Functions

### 1. Start from the characteristics that really matter

**Goal:** protect the few architectural qualities that would hurt the most if they degraded.

Don't try to automate every rule on day one. Ask the team: "Which architectural property, if it silently eroded, would cause us the most pain in a year?" Maybe it's the separation between bounded contexts, maybe it's checkout latency, maybe it's the absence of cycles between modules. Start there.

**Benefit:** fast return on effort and a team that sees the value before being asked to maintain dozens of checks.

### 2. Make them run in the pipeline, not in a slide deck

**Goal:** architectural rules are enforced by machines, on every change.

A rule that exists only in a document will be broken the first time a deadline is tight. A rule that fails the build gets respected, or gets consciously changed through a discussion, which is just as good.

**Benefit:** architecture reviews stop being about catching violations and start being about making better decisions.

### 3. Treat a failing fitness function as a conversation, not a wall

**Goal:** keep the rules alive and relevant.

Sometimes the rule is right and the code must change. Sometimes the rule is outdated and the architecture must evolve. Both are fine, as long as the decision is explicit and recorded. What's not fine is disabling the check quietly "just for this release".

**Benefit:** the fitness functions evolve together with the architecture instead of becoming a museum of old opinions.

### 4. Include production signals

**Goal:** check the architecture where it actually lives.

Pipelines test what you predicted. Production tells you what actually happens. SLOs, error budgets, cost per transaction and latency percentiles are fitness functions too, and they're the ones customers feel. This is where evolutionary design meets [Observability First](/en-us/principles/solution/observability-first/).

**Benefit:** you detect architectural drift that no static test could see, such as a chatty integration that only hurts under real load.

## Incremental Change with Feedback Loops

Fitness functions tell you whether a change is safe. The other half of the principle is making changes **small and frequent**, so each one produces feedback quickly. It's the classic *build, measure, learn* loop, applied to architecture instead of just product features.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 295" role="img" aria-labelledby="evo-d3-title evo-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d3-title">The evolution loop</title>
<desc id="evo-d3-desc">A small change goes through build and tests, then fitness functions that break the build if an architectural rule is violated, then a deploy behind a feature flag, then measurement with DORA metrics and SLOs. What is measured feeds a learn and decide step that shapes the next small change.</desc>
<defs><marker id="evo-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="30" text-anchor="middle" class="d-label">THE EVOLUTION LOOP</text>
<rect x="20" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="80" y="104" text-anchor="middle" class="d-title">Small change</text>
<text x="80" y="126" text-anchor="middle" class="d-small">one idea</text>
<line x1="140" y1="110" x2="163" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="165" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="225" y="104" text-anchor="middle" class="d-title">Build + test</text>
<text x="225" y="126" text-anchor="middle" class="d-small">unit, contract</text>
<line x1="285" y1="110" x2="308" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="310" y="70" width="120" height="80" rx="10" class="d-box-accent"/>
<text x="370" y="98" text-anchor="middle" class="d-title">Fitness</text>
<text x="370" y="116" text-anchor="middle" class="d-title">functions</text>
<text x="370" y="137" text-anchor="middle" class="d-small">arch rules</text>
<line x1="430" y1="110" x2="453" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="455" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="515" y="104" text-anchor="middle" class="d-title">Deploy</text>
<text x="515" y="126" text-anchor="middle" class="d-small">behind a flag</text>
<line x1="575" y1="110" x2="598" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="600" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="660" y="104" text-anchor="middle" class="d-title">Measure</text>
<text x="660" y="126" text-anchor="middle" class="d-small">DORA, SLOs</text>
<text x="370" y="172" text-anchor="middle" class="d-small">breaks the build if violated</text>
<polyline points="660,150 660,220 462,220" fill="none" class="d-line-dashed" marker-end="url(#evo-d3-arrow)"/>
<rect x="280" y="195" width="180" height="50" rx="10" class="d-box-info"/>
<text x="370" y="217" text-anchor="middle" class="d-text">Learn + decide</text>
<text x="370" y="235" text-anchor="middle" class="d-small">adjust the design</text>
<polyline points="280,220 80,220 80,153" fill="none" class="d-line-dashed" marker-end="url(#evo-d3-arrow)"/>
<text x="370" y="278" text-anchor="middle" class="d-small">Each lap is short: hours or days, not quarters</text>
</svg>
</div>
<figcaption>Figure 3: Small changes, automated guardrails and real measurements feed the next design decision</figcaption>
</figure>

The shorter this loop, the cheaper it is to be wrong. If a lap takes a quarter, a bad decision costs a quarter. If it takes a day, it costs a day. That's why evolutionary design is so tightly connected to continuous integration, continuous delivery and the practices described in [Operational Excellence](/en-us/principles/cloud/operational-excellence/): without them, the loop is too slow for the architecture to evolve safely.

### Metrics That Guide Evolution

How do you know whether your architecture is getting easier or harder to change? Opinions aren't enough. The research program behind the *Accelerate* book and the annual DORA reports identified a small set of metrics that correlate with both delivery performance and organizational outcomes:

| Metric | What it tells you about the architecture |
| :--- | :--- |
| **Deployment frequency** | How often you can ship. Low frequency often means coupling: too many things must be released together. |
| **Lead time for changes** | Time from commit to production. Long lead times point to slow pipelines, manual gates or tangled dependencies. |
| **Change failure rate** | Share of deployments that cause a failure. High rates suggest missing tests, missing fitness functions or changes that are too big. |
| **Time to restore service** | How fast you recover. Slow recovery points to poor observability and no easy rollback. |

These aren't vanity numbers for a dashboard. Watch the **trend**. If lead time keeps growing quarter after quarter while the team size stays the same, the architecture is accumulating friction, and that's a signal to invest in decoupling before the next big feature.

## Techniques for Changing a Running System

Evolution happens while the system is in production and customers are using it. You can't stop the plane to change the engines, so you need techniques that let old and new coexist safely.

### 1. Strangler Fig

Named by Martin Fowler after the fig trees that grow around a host tree until they replace it. You put a **facade** (a router, gateway or proxy) in front of the legacy system, then move one capability at a time to the new implementation. The facade decides where each request goes. Over time, the legacy shrinks until it can be switched off.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="evo-d4-title evo-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d4-title">Strangler fig progression</title>
<desc id="evo-d4-desc">Three stages of a migration behind a facade. In stage one a single slice moves to the new system and legacy still handles most traffic. In stage two about half has moved along with data ownership. In stage three the new services handle everything and the legacy is switched off.</desc>
<defs><marker id="evo-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="120" y="38" text-anchor="middle" class="d-label">STAGE 1</text>
<text x="360" y="38" text-anchor="middle" class="d-label">STAGE 2</text>
<text x="600" y="38" text-anchor="middle" class="d-label">STAGE 3</text>
<rect x="20" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="120" y="80" text-anchor="middle" class="d-text">Facade / router</text>
<rect x="260" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="360" y="80" text-anchor="middle" class="d-text">Facade / router</text>
<rect x="500" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="600" y="80" text-anchor="middle" class="d-text">Facade / router</text>
<line x1="120" y1="95" x2="120" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<line x1="360" y1="95" x2="360" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<line x1="600" y1="95" x2="600" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<rect x="20" y="120" width="168" height="38" rx="10" class="d-box-warn"/>
<text x="104" y="144" text-anchor="middle" class="d-small">legacy</text>
<rect x="190" y="120" width="30" height="38" rx="10" class="d-box-accent"/>
<rect x="260" y="120" width="99" height="38" rx="10" class="d-box-warn"/>
<text x="309" y="144" text-anchor="middle" class="d-small">legacy</text>
<rect x="361" y="120" width="99" height="38" rx="10" class="d-box-accent"/>
<text x="410" y="144" text-anchor="middle" class="d-small">new</text>
<rect x="500" y="120" width="200" height="38" rx="10" class="d-box-accent"/>
<text x="600" y="144" text-anchor="middle" class="d-small">new services</text>
<line x1="226" y1="139" x2="254" y2="139" class="d-line-accent" marker-end="url(#evo-d4-arrow)"/>
<line x1="466" y1="139" x2="494" y2="139" class="d-line-accent" marker-end="url(#evo-d4-arrow)"/>
<text x="120" y="182" text-anchor="middle" class="d-small">legacy 85%, new 15%</text>
<text x="360" y="182" text-anchor="middle" class="d-small">legacy 50%, new 50%</text>
<text x="600" y="182" text-anchor="middle" class="d-small">legacy 0%, new 100%</text>
<text x="120" y="218" text-anchor="middle" class="d-title">First slice</text>
<text x="360" y="218" text-anchor="middle" class="d-title">Half migrated</text>
<text x="600" y="218" text-anchor="middle" class="d-title">Legacy retired</text>
<text x="120" y="240" text-anchor="middle" class="d-small">one route, canary</text>
<text x="360" y="240" text-anchor="middle" class="d-small">data ownership moved</text>
<text x="600" y="240" text-anchor="middle" class="d-small">switch it off</text>
<text x="360" y="292" text-anchor="middle" class="d-small">Every stage ships value to production and has its own rollback</text>
</svg>
</div>
<figcaption>Figure 4: A strangler fig migration replaces the legacy one slice at a time</figcaption>
</figure>

This is exactly what the company in our rewrite story should have done. Each slice goes to production, delivers value, produces feedback and can be rolled back by changing a route. I wrote a full practical guide on this in [The Strangler Fig Migration Blueprint](/en-us/blog/strangler-fig-migration/).

### 2. Branch by Abstraction

When the thing you need to replace lives **inside** the codebase (an ORM, a payment provider client, a logging library), you can't put a router in front of it. Branch by Abstraction solves that:

1. Create an abstraction (an interface) around the component you want to replace;
2. Move all callers to use the abstraction instead of the concrete component;
3. Build the new implementation behind the same abstraction;
4. Switch callers gradually (often with a flag) until the old implementation has no users;
5. Delete the old implementation, and the abstraction too if it no longer earns its keep.

The key point: the main branch stays releasable **the whole time**. No long-lived feature branch that takes three weeks to merge and breaks everything when it finally does.

### 3. Feature Flags

Feature flags (or toggles) separate **deploying** code from **releasing** behavior. The code goes to production switched off, and you turn it on for internal users, then 1% of customers, then 10%, then everyone. If something goes wrong, you flip the switch back without a new deploy.

For architecture, flags let you run the old and new paths side by side, compare results, and migrate with confidence.

### 4. Parallel Run

For critical logic (pricing, tax calculation, financial reconciliation), you can run the old and new implementations **at the same time**, serve the old result to the customer, and compare both in the background. When the differences reach zero for long enough, you switch. It costs extra compute, but for high-stakes changes it's a bargain.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Excited junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Feature flags are amazing! I'm going to put a flag on everything. Then I can never break anything again, right?"</span>
    </div>
  </div>
</div>

Easy there, Junior! Flags are powerful, but every flag is a small branch in your code that someone has to understand, test and eventually remove. A codebase with three hundred forgotten flags has 2<sup>300</sup> theoretical combinations, and nobody knows which ones are actually running in production. Flags need an **owner**, an **expiration date** and a **cleanup task** created the same day the flag is created. Release flags should live for weeks, not years. That's what we call **flag debt**, and it's real debt with real interest.

## Modularity and Low Coupling: The Real Enablers

All these techniques depend on one thing: being able to change one part of the system **without changing everything else**. That's what modularity and low coupling give you.

A system where every module reaches into every other module's internals can't evolve incrementally, because there are no increments. Every change is a big change. This is why the "distributed monolith" is so painful: you have all the operational cost of microservices and none of the independence, because services still have to be deployed together.

Some practical ways to keep the architecture evolvable:

| Approach | Benefit |
| :--- | :--- |
| **Draw boundaries around business capabilities.** Use domain modeling to find where one context ends and another begins (see [Bounded Contexts](/en-us/principles/solution/bounded-contexts/)). | Changes in one business area stay inside one module, so teams can move independently. |
| **Communicate through explicit contracts.** APIs and events with versioned schemas, never shared database tables. | You can replace the implementation behind a contract without the consumers noticing. |
| **Hide volatile decisions behind interfaces.** Vendors, storage engines, external APIs. | Turns one-way doors into two-way doors at a small upfront cost. |
| **Prefer a modular monolith before microservices.** Strong internal boundaries, one deployable unit. | You get evolvability without paying the distributed-systems tax before you need it, and you can extract services later along boundaries that have been proven. |
| **Enforce boundaries with fitness functions.** Dependency rules in the pipeline. | Boundaries don't erode silently under deadline pressure. |

<div class="callout tip">
  <p>A good test for evolvability: pick a real feature from last quarter and count how many modules, repositories and teams it touched. If the answer is "most of them", your architecture is resisting change, no matter how modern the technology stack looks.</p>
</div>

## Architecture Decision Records: Remember Why

Evolutionary design means decisions will be revisited. That only works if people know **why** a decision was made in the first place. Otherwise you get one of two bad outcomes: nobody dares to change anything ("there must have been a reason"), or someone changes it and reintroduces the exact problem the original decision solved.

An **Architecture Decision Record (ADR)** is a short document, usually a markdown file in the repository, that captures one decision:

- **Context:** what situation and forces led to the decision;
- **Decision:** what was chosen;
- **Alternatives considered:** and why they were rejected;
- **Consequences:** the good, the bad and the trade-offs accepted;
- **Status:** proposed, accepted, superseded (with a link to the newer ADR).

ADRs are cheap, versioned with the code, and reviewed in pull requests like everything else. When a decision changes, you don't delete the old ADR; you write a new one that supersedes it. The history of the architecture becomes readable, and new team members can understand the system's shape without an archaeology expedition.

Write ADRs for the one-way doors and the important two-way doors. You don't need one for every library upgrade.

## YAGNI vs Designing for Change

*You Aren't Gonna Need It* (YAGNI) is one of the pillars of evolutionary design: don't build features or abstractions for needs you only imagine. Every speculative abstraction has a cost: code to maintain, concepts to learn, indirection to debug. And most of the time, the future you designed for never arrives, or arrives looking different from what you expected.

But YAGNI is often misread as "never think about the future". That's not it. The distinction is subtle but important:

- **Speculative generality** (bad): building a plugin system because "someday we might support other payment providers", when you have one provider and no plans for another;
- **Designing for change** (good): keeping the payment provider behind a clean interface, which costs almost nothing and makes the future change cheap if it ever happens.

The rule of thumb: don't build the future, but **don't block it** either. Keep the code clean, the boundaries clear and the tests good, and most future changes become affordable without you having predicted them.

<div class="callout info">
  <p>The best preparation for an unknown future isn't a flexible framework. It's a codebase that is <strong>easy to change</strong>: well tested, loosely coupled and simple. Simplicity is the most future-proof architecture there is.</p>
</div>

## Technical Debt as a Conscious Tool

Technical debt isn't always a sin. Like financial debt, it can be a **smart investment** when taken consciously: you ship faster now, validate a market hypothesis, and pay it back later. The problem is debt taken without knowing, and debt that is never paid.

Martin Fowler's *Technical Debt Quadrant* is a useful way to think about it, crossing *deliberate vs inadvertent* with *prudent vs reckless*:

- **Deliberate and prudent:** "We know this won't scale past ten thousand users, but we need to launch and learn. We'll revisit it when we reach five thousand." This is healthy;
- **Deliberate and reckless:** "We don't have time for design." This is how the big ball of mud starts;
- **Inadvertent and reckless:** the team didn't know good practices and didn't care to learn;
- **Inadvertent and prudent:** "Now that we've built it, we understand how we should have built it." This happens to everyone, and it's exactly why evolution matters.

Making debt a conscious tool means:

1. **Record it** when you take it (an ADR, a ticket, a comment with a link), with the trigger that will make you pay it back;
2. **Make it visible** in the backlog, not hidden in someone's head;
3. **Reserve capacity** to pay it down continuously (many teams use a fixed share of each iteration) instead of waiting for a "refactoring sprint" that never gets approved;
4. **Watch the interest**: if lead time and change failure rate are growing in an area, the debt there is charging interest, and it's time to pay.

## Tradeoffs

Evolutionary design is powerful, but it's not free. Like every principle, it pulls against others, and pretending otherwise is how teams end up disappointed. Shall we look at the main tensions?

### Short-Term Speed vs Structural Integrity

The daily pressure is always to ship the feature now. Writing fitness functions, keeping boundaries clean and paying down debt all compete with that. Skip them for too long and you slide toward "no design"; overdo them and you slide back toward BDUF with extra steps. The balance moves over time: an early-stage product validating a market can accept more debt than a mature platform with hundreds of customers.

### The Cost of Keeping Options Open

Every abstraction that keeps a door two-way has a price: more code, more indirection, sometimes a little performance. Keeping *every* option open is its own form of over-engineering. Keep options open only where the probability of change multiplied by the cost of change justifies it.

### Tradeoffs with Reliability

Frequent, incremental changes mean more deployments, and each one is an opportunity for failure. Without solid automation, observability and rollback, "evolve continuously" becomes "break continuously". Coexistence periods (strangler facades, parallel runs, dual writes) also add moving parts and new failure modes. The practices in [Reliability](/en-us/principles/cloud/reliability/) are a prerequisite, not an afterthought.

### Tradeoffs with Security

Every flag, facade and transition path is additional surface to protect. Old and new systems running in parallel may have different security models, and the seam between them is a classic place for gaps. Fitness functions help here too: security checks belong in the same pipeline (see [Security Shift-Left](/en-us/principles/solution/security-shift-left/)).

### Tradeoffs with Cost Optimization

Running legacy and new side by side during a migration means paying for both. Parallel runs double compute for the logic under test. Pipelines full of fitness functions, load tests and contract tests consume build minutes. These costs are usually far smaller than a failed rewrite, but they must be budgeted and time-boxed, or the "temporary" coexistence becomes permanent.

### Tradeoffs with Performance Efficiency

Abstractions, facades and adapters add latency and hops. A strangler facade is one more network call on every request. Usually negligible, sometimes not. Performance budgets as fitness functions keep this visible, so the cost of evolvability never grows silently.

### Tradeoffs with Operational Excellence

Flags, multiple versions and coexisting systems increase the cognitive load on whoever operates the system. "Which version is this customer on? Is that flag on in this region?" Without discipline (flag ownership, cleanup, clear dashboards), operational complexity grows faster than the system itself.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So designing everything up front is bad, not designing is bad, and evolving has costs too. How do I know I'm doing it right?"</span>
    </div>
  </div>
</div>

Welcome to architecture, Junior! There's no configuration that's right forever. You know you're on the right track when changes stay cheap over time: lead time is stable or falling, deployments are boring, the team isn't afraid to touch old code and nobody is scheduling the "big rewrite" meeting. The trade-offs don't disappear; you just make them consciously, write them down in ADRs, and revisit them when the context changes.

## Conclusion

**Evolutionary Design** accepts a simple truth: you'll never know less about your system than you do on day one. So instead of betting everything on an upfront plan, you design enough to start, decide at the last responsible moment, and let real feedback shape the architecture over time.

It's not the absence of design. It's design supported by **guardrails**: fitness functions that turn architectural rules into automated checks, feedback loops short enough to make mistakes cheap, techniques like strangler fig and branch by abstraction to change a running system safely, modularity that keeps changes local, and ADRs that remember why things are the way they are.

**Most importantly:** evolutionary design is what keeps you out of the "rewrite from scratch" trap. A system that evolves continuously never gets so bad that throwing it away seems like the only option.

## Next Steps

1. **Map your one-way doors**
List the decisions in your system that would be very expensive to reverse. Check whether each one has an ADR and whether some could be made reversible with a small abstraction.

2. **Write your first fitness function**
Pick the architectural rule that hurts most when broken (a layer dependency, a latency budget, a module boundary) and make it fail the build. One real check beats fifty rules on a wiki.

3. **Start measuring the DORA metrics**
Deployment frequency, lead time, change failure rate and time to restore. Track the trend quarterly and use it to decide where to invest in decoupling.

4. **Adopt ADRs**
Create an `adr` folder in the repository and record the next significant decision. Then the one after that.

5. **Replace the next rewrite with a strangler plan**
If there's a legacy system everyone wants to rewrite, design the facade and the first slice instead. Ship it, learn, repeat.

6. **Put flags on a diet**
Give every feature flag an owner and an expiration date, and remove the ones that have been fully rolled out.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://evolutionaryarchitecture.com/" target="_blank" rel="noopener">Building Evolutionary Architectures (Ford, Parsons, Kua)</a></li>
    <li><a href="https://martinfowler.com/articles/designDead.html" target="_blank" rel="noopener">Martin Fowler: Is Design Dead?</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://martinfowler.com/bliki/BranchByAbstraction.html" target="_blank" rel="noopener">Martin Fowler: Branch By Abstraction</a></li>
    <li><a href="https://martinfowler.com/articles/feature-toggles.html" target="_blank" rel="noopener">Pete Hodgson: Feature Toggles (aka Feature Flags)</a></li>
    <li><a href="https://martinfowler.com/bliki/TechnicalDebtQuadrant.html" target="_blank" rel="noopener">Martin Fowler: Technical Debt Quadrant</a></li>
    <li><a href="https://dora.dev/" target="_blank" rel="noopener">DORA: DevOps Research and Assessment</a></li>
    <li><a href="https://www.archunit.org/" target="_blank" rel="noopener">ArchUnit</a></li>
    <li><a href="https://adr.github.io/" target="_blank" rel="noopener">Architecture Decision Records</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
