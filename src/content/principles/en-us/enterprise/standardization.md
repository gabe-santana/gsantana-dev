---
title: Standardization
short: Reusable standards and building blocks so every team stops reinventing the wheel. After all, who wants to fix the same bug in twelve different loggers?
category: enterprise
---

## Introduction

Standardization is the principle that turns the good decisions of one team into the default for everyone else. The **goal** is simple to say and hard to do: **the right way should also be the easiest way**, so that teams spend their energy on the product and not on rediscovering, for the fifth time this year, how to call an API with retries.

In small companies, this happens almost by accident: there are five developers, they sit next to each other, and everybody uses whatever the most senior person chose. The problem shows up when the company grows. New teams arrive, each one with its own taste, its own favorite framework and its own "better" way of doing things. A few years later, you look at the landscape and find:

- Several logging libraries, each with its own format, so no one can correlate a request across services;
- Five different ways to call an HTTP API, three of them without timeouts;
- Every service with its own error format, so each client has to write a custom parser;
- Infrastructure copied and pasted between repositories, with small differences no one remembers the reason for;
- New hires who take months to become productive, because every repository is a new world;
- A critical security patch that takes weeks to roll out, because nobody knows where the vulnerable library is used;

Yep, *it's rare, but it happens all the time*... Who hasn't opened a repository and thought "wait, why does this service do everything differently from the others?" And the worst part is that each of those choices made perfect sense on the day it was made.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But isn't that what team autonomy is all about? Each squad picks the best tool for its problem. Standards sound like the architecture police coming to take my favorite framework away!"</span>
    </div>
  </div>
</div>

Easy there, Junior! Autonomy is great, and nobody here wants an architecture police. But autonomy without any common ground has a price, and that price is paid by everyone: by the on-call engineer who has to debug a service written in a stack she has never seen, by the security team hunting for vulnerable dependencies, and by the next developer who joins your squad.

Good standardization doesn't take autonomy away. It takes away the **decisions that don't deserve your attention** (which logger, which log format, how to structure a pipeline) so you can spend your autonomy where it actually matters: the business problem.

<div class="callout info">
  <p>This principle is about <strong>what</strong> gets standardized and <strong>how</strong> standards are built, shared and retired. Who has the authority to decide, how compliance is checked and what happens when a team deviates belong to <a href="/en-us/principles/enterprise/governance/">Governance</a>. The two go hand in hand: standards without governance are suggestions, and governance without good standards is bureaucracy.</p>
</div>

## The Story of 12 Logging Libraries and 5 Ways to Call an API

Let me tell you a story that, with small variations, I have seen in more than one company.

A company starts with a monolith. Then it adopts microservices, and each new team gets a lot of freedom. The payments team loves one logging library. The catalog team prefers another, because it's faster. The search team writes its own wrapper, because none of the existing ones "does exactly what we need". Three years and forty services later, someone counts: **twelve logging libraries**. And for calling HTTP APIs, there are five different approaches, from a well-configured client with retries and circuit breakers to a hand-rolled function that simply waits forever when the other side doesn't answer.

Everything works, more or less, until the day of the big incident. A customer reports that payments are failing intermittently. The on-call engineer tries to follow the request from the frontend to the payment provider, and discovers that:

- Each service logs in a different format, some in JSON, some in plain text;
- Only half of them propagate a correlation ID, and each one uses a different header name;
- The service that is actually failing uses the hand-rolled HTTP client, with no timeout, so threads pile up until everything stops;

The fix takes ten minutes. **Finding the problem takes six hours.**

A few months later, a critical vulnerability is announced in a popular logging library (anyone who lived through Log4Shell in December 2021 knows exactly what this feels like). How many services use it? Nobody knows. Each team has to check its own dependencies, some are on vacation, some repositories haven't been built in a year. The patch that should take a day takes three weeks.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="std-d1-title std-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d1-title">Before and after standardization</title>
<desc id="std-d1-desc">On the left, three teams connect in a tangle to six different logging and HTTP libraries. On the right, the same three teams all point to a single set of shared building blocks.</desc>
<defs><marker id="std-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="180" y="28" text-anchor="middle" class="d-label">BEFORE: EVERY TEAM FOR ITSELF</text>
<text x="545" y="28" text-anchor="middle" class="d-label">AFTER: A PAVED ROAD</text>
<line x1="360" y1="45" x2="360" y2="290" class="d-line-dashed"/>
<rect x="30" y="60" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="85" text-anchor="middle" class="d-text">Team A</text>
<rect x="30" y="130" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="155" text-anchor="middle" class="d-text">Team B</text>
<rect x="30" y="200" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="225" text-anchor="middle" class="d-text">Team C</text>
<rect x="210" y="50" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="69" text-anchor="middle" class="d-small">Logger A</text>
<rect x="210" y="90" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="109" text-anchor="middle" class="d-small">Logger B</text>
<rect x="210" y="130" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="149" text-anchor="middle" class="d-small">Custom logger</text>
<rect x="210" y="170" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="189" text-anchor="middle" class="d-small">HTTP client X</text>
<rect x="210" y="210" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="229" text-anchor="middle" class="d-small">HTTP client Y</text>
<rect x="210" y="250" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="269" text-anchor="middle" class="d-small">Hand-rolled retry</text>
<line x1="130" y1="80" x2="210" y2="65" class="d-line-danger"/>
<line x1="130" y1="80" x2="210" y2="185" class="d-line-danger"/>
<line x1="130" y1="80" x2="210" y2="265" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="105" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="225" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="145" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="145" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="185" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="265" class="d-line-danger"/>
<text x="180" y="308" text-anchor="middle" class="d-small">3 teams, 6 ways, 0 shared fixes</text>
<rect x="380" y="60" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="85" text-anchor="middle" class="d-text">Team A</text>
<rect x="380" y="130" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="155" text-anchor="middle" class="d-text">Team B</text>
<rect x="380" y="200" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="225" text-anchor="middle" class="d-text">Team C</text>
<line x1="480" y1="80" x2="518" y2="80" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<line x1="480" y1="150" x2="518" y2="150" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<line x1="480" y1="220" x2="518" y2="220" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<rect x="520" y="50" width="170" height="230" rx="10" class="d-box-accent"/>
<text x="605" y="85" text-anchor="middle" class="d-title">Shared</text>
<text x="605" y="105" text-anchor="middle" class="d-title">building blocks</text>
<text x="605" y="140" text-anchor="middle" class="d-small">1 logging library</text>
<text x="605" y="165" text-anchor="middle" class="d-small">1 HTTP client</text>
<text x="605" y="190" text-anchor="middle" class="d-small">1 retry policy</text>
<text x="605" y="215" text-anchor="middle" class="d-small">Service templates</text>
<text x="605" y="240" text-anchor="middle" class="d-small">Reusable IaC modules</text>
<text x="545" y="308" text-anchor="middle" class="d-small">3 teams, 1 way, fixes shipped once</text>
</svg>
</div>
<figcaption>Figure 1: The same three teams, before and after agreeing on shared building blocks</figcaption>
</figure>

Notice that nobody in this story was incompetent. Each decision, taken alone, was reasonable. The problem is the **sum** of reasonable local decisions, with nobody looking at the whole. That's exactly the gap this principle fills.

## Why Standards Pay Off

It's easy to see standards as bureaucracy. So let's be concrete about what they buy.

### Less cognitive load

Every technical decision a developer has to make, or understand, takes up a piece of their head. The folks behind *Team Topologies* talk about **extraneous cognitive load**: the effort spent on things that have nothing to do with the problem you're solving. Figuring out which of the twelve loggers this repository uses, and how it's configured, is pure extraneous load.

When the basics are standardized, a developer who opens any repository in the company already knows where the pipeline is, how logs are written, how errors are returned and how the service is deployed. Their head is free for the part that is actually new: the business logic.

### Faster onboarding

A new hire in a standardized environment learns the platform **once**. After that, moving between teams costs days, not months. The same applies to internal mobility: people can help other teams during an incident, cover for colleagues on vacation or move to a new product without starting from zero.

### Lower risk

Standards concentrate knowledge and effort. A shared HTTP client with sensible timeouts, retries with backoff and a circuit breaker protects every service that uses it. A security patch in a shared library is applied in one place and rolled out by updating a version. An inventory of which services use which building blocks tells you, in minutes, where you are exposed.

### Economies of scale

Anything built once and reused many times gets better over time: more people use it, more bugs are found, more edge cases are handled. Anything built forty times gets forty times the bugs, and each copy improves (or rots) alone.

<div class="callout tip">
  <p>A useful test for any standard: <strong>does it reduce the number of decisions a team has to make without reducing the quality of the result?</strong> If the answer is yes, it's probably a good standard. If the team now has to make <em>more</em> decisions (exceptions, workarounds, paperwork), something is off.</p>
</div>

## What to Standardize (and What to Leave Alone)

Not everything deserves a standard. A good rule of thumb is: **standardize the seams, not the insides**.

The seams are the places where teams, systems and people meet: API contracts, event formats, authentication, logs and traces, deployment, infrastructure. Inconsistency there hurts everyone, because it leaks into other teams. The insides are the implementation details of a service that nobody outside the team needs to see: how the code is organized internally, which testing helper they prefer, how they name private functions. Inconsistency there hurts, at most, the team itself.

| Layer | How strict | Examples |
| :--- | :--- | :--- |
| **Contracts between systems** | Strict: everyone must follow | API naming and versioning, error format, event schemas, authentication, correlation IDs |
| **Platform and operations** | Strong default, exceptions possible | CI/CD pipelines, IaC modules, logging and tracing, container base images, secrets management |
| **Technology choices** | Guided by the radar | Languages, frameworks, databases, message brokers |
| **Inside a service** | Team's choice | Internal code structure, libraries that don't cross boundaries, local conventions |

This split also helps with the tension Junior raised. Teams keep their autonomy where it doesn't affect anyone else, and give up just a little of it at the seams, in exchange for a lot of collective benefit.

## The Standardization Toolbox

There's no single tool that solves standardization. There's a set of complementary practices, each good at one thing. Let's go through them.

### 1. Keep a Technology Radar

**Goal:** make technology choices visible, explicit and easy to consult, instead of living in the heads of a few senior people.

The idea was popularized by ThoughtWorks, which has published its Technology Radar twice a year for more than a decade. Each technology (a tool, a platform, a technique, a language or framework) is placed in one of four rings:

- **Adopt:** the default choice for new work. If you pick something else, you should have a good reason;
- **Trial:** worth using on real projects where the risk is manageable. We're building experience with it;
- **Assess:** worth exploring, with a spike or a proof of concept, to understand how it could affect us;
- **Hold:** don't start anything new with it. Existing uses can stay, but the direction is to move away.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 450" role="img" aria-labelledby="std-d2-title std-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d2-title">A technology radar with four rings and four quadrants</title>
<desc id="std-d2-desc">Concentric rings named Adopt, Trial, Assess and Hold, from the center outwards, split into the quadrants Techniques, Tools, Platforms and Languages. Illustrative technologies are placed as dots in each ring, with a legend explaining each ring.</desc>
<circle cx="230" cy="225" r="200" class="d-box-danger"/>
<circle cx="230" cy="225" r="150" class="d-box-warn"/>
<circle cx="230" cy="225" r="100" class="d-box-info"/>
<circle cx="230" cy="225" r="50" class="d-box-accent"/>
<line x1="30" y1="225" x2="430" y2="225" class="d-line-dashed"/>
<line x1="230" y1="25" x2="230" y2="425" class="d-line-dashed"/>
<text x="30" y="35" class="d-label">TECHNIQUES</text>
<text x="430" y="35" text-anchor="end" class="d-label">TOOLS</text>
<text x="30" y="422" class="d-label">PLATFORMS</text>
<text x="430" y="422" text-anchor="end" class="d-label">LANGUAGES</text>
<circle cx="205" cy="200" r="6" class="d-fill-accent"/>
<text x="197" y="192" text-anchor="end" class="d-small">Trunk-based</text>
<circle cx="167" cy="117" r="6" class="d-fill-warn"/>
<text x="159" y="121" text-anchor="end" class="d-small">AI code review</text>
<circle cx="283" cy="172" r="6" class="d-fill-info"/>
<text x="291" y="176" class="d-small">OpenTelemetry</text>
<circle cx="317" cy="73" r="6" class="d-fill-danger"/>
<text x="325" y="77" class="d-small">Logger #7</text>
<circle cx="205" cy="250" r="6" class="d-fill-accent"/>
<text x="197" y="254" text-anchor="end" class="d-small">Golden path</text>
<circle cx="201" cy="305" r="6" class="d-fill-info"/>
<text x="193" y="309" text-anchor="end" class="d-small">Dev portal</text>
<circle cx="87" cy="325" r="6" class="d-fill-danger"/>
<text x="95" y="342" class="d-small">Snowflake VMs</text>
<circle cx="255" cy="250" r="6" class="d-fill-accent"/>
<text x="263" y="254" class="d-small">TypeScript</text>
<circle cx="338" cy="288" r="6" class="d-fill-warn"/>
<text x="346" y="292" class="d-small">Rust</text>
<circle cx="290" cy="389" r="6" class="d-fill-danger"/>
<text x="298" y="393" class="d-small">Legacy Perl</text>
<text x="470" y="60" class="d-label">RINGS</text>
<circle cx="478" cy="95" r="7" class="d-fill-accent"/>
<text x="494" y="100" class="d-title">Adopt</text>
<text x="494" y="120" class="d-small">default for new work</text>
<circle cx="478" cy="155" r="7" class="d-fill-info"/>
<text x="494" y="160" class="d-title">Trial</text>
<text x="494" y="180" class="d-small">use on real, low-risk work</text>
<circle cx="478" cy="215" r="7" class="d-fill-warn"/>
<text x="494" y="220" class="d-title">Assess</text>
<text x="494" y="240" class="d-small">explore, spike, learn</text>
<circle cx="478" cy="275" r="7" class="d-fill-danger"/>
<text x="494" y="280" class="d-title">Hold</text>
<text x="494" y="300" class="d-small">don't start new work with it</text>
<text x="470" y="350" class="d-small">Dots are illustrative</text>
<text x="470" y="368" class="d-small">examples, not advice.</text>
</svg>
</div>
<figcaption>Figure 2: A technology radar in the ThoughtWorks style (Adopt, Trial, Assess, Hold)</figcaption>
</figure>

The magic of the radar is that it's **a conversation, not a law**. It tells teams where the organization is heading, it gives new technologies a legitimate path in (Assess, then Trial, then Adopt), and it gives old ones a dignified path out (Hold). ThoughtWorks even made their tooling open, so any company can build its own radar.

**Benefit:** fewer technologies in parallel doing the same job, fewer surprises, and a place where "why do we use X?" has a written answer. Tie the radar to your [portfolio rationalization](/en-us/principles/enterprise/portfolio-rationalization/) efforts: the Hold ring is often the first list of candidates for retirement.

### 2. Publish Reference Architectures

**Goal:** give teams a proven starting point for the most common kinds of systems.

A reference architecture is a documented, opinionated blueprint for a recurring problem: "a REST API with a relational database", "an event-driven worker", "a static site with a CDN", "a data pipeline". It shows the components, how they connect, which building blocks to use, how it's secured, monitored and deployed, and, very importantly, **why** each choice was made.

Cloud providers publish plenty of them (the Azure Architecture Center and the AWS Architecture Center are good examples), but the most valuable ones are your own, because they already include your identity provider, your network rules, your observability stack and your compliance requirements.

**Benefit:** a team starting a new service doesn't begin with a blank page. They begin with something that already passed security review, already fits the platform and already has a known cost profile.

<div class="callout warning">
  <p>A reference architecture that nobody updates becomes a trap: teams follow it faithfully and end up building on outdated decisions. Every reference architecture needs an <strong>owner</strong> and a <strong>last reviewed</strong> date, just like any other standard.</p>
</div>

### 3. Build Golden Paths on an Internal Developer Platform

**Goal:** turn standards into something teams *use*, not something they *read*.

Documents are great, but people don't read documents at 6 pm on a Friday. What works much better is making the standard the path of least resistance. That's the idea behind the **golden path** (Spotify's term) or **paved road** (Netflix's term): a supported, opinionated and well-maintained way of building and running a certain kind of software, from the first `git init` to production.

In practice, a golden path is delivered through an **internal developer platform**: a set of self-service capabilities, owned by a platform team and treated as a product. A developer picks a template in a portal (tools like Backstage are common here), answers a few questions and gets a repository with the service skeleton, the pipeline, the infrastructure, logging, tracing, dashboards and alerts, all already wired to company standards.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 390" role="img" aria-labelledby="std-d3-title std-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d3-title">Golden paths on an internal developer platform</title>
<desc id="std-d3-desc">Product teams at the top use golden paths, which are built on an internal developer platform made of CI/CD pipelines, IaC modules, observability and security, running on the cloud. On the side, an off-road path lets a team bypass the platform, as long as it owns the result.</desc>
<defs><marker id="std-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="300" y="28" text-anchor="middle" class="d-label">TEAMS BUILD ON THE PLATFORM</text>
<rect x="30" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="112" y="80" text-anchor="middle" class="d-text">Payments team</text>
<rect x="217" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="300" y="80" text-anchor="middle" class="d-text">Catalog team</text>
<rect x="405" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="488" y="80" text-anchor="middle" class="d-text">Search team</text>
<line x1="112" y1="100" x2="112" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<line x1="300" y1="100" x2="300" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<line x1="488" y1="100" x2="488" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="130" width="540" height="60" rx="10" class="d-box-accent"/>
<text x="300" y="156" text-anchor="middle" class="d-title">Golden paths</text>
<text x="300" y="177" text-anchor="middle" class="d-small">templates, scaffolding, docs, a portal</text>
<line x1="300" y1="190" x2="300" y2="218" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="220" width="540" height="92" rx="10" class="d-box"/>
<text x="300" y="241" text-anchor="middle" class="d-label">INTERNAL DEVELOPER PLATFORM</text>
<rect x="45" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="106" y="272" text-anchor="middle" class="d-text">CI/CD</text>
<text x="106" y="290" text-anchor="middle" class="d-small">pipelines</text>
<rect x="177" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="238" y="272" text-anchor="middle" class="d-text">IaC</text>
<text x="238" y="290" text-anchor="middle" class="d-small">modules</text>
<rect x="309" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="370" y="272" text-anchor="middle" class="d-text">Observability</text>
<text x="370" y="290" text-anchor="middle" class="d-small">logs, traces</text>
<rect x="441" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="502" y="272" text-anchor="middle" class="d-text">Security</text>
<text x="502" y="290" text-anchor="middle" class="d-small">and identity</text>
<line x1="300" y1="312" x2="300" y2="338" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="340" width="540" height="36" rx="10" class="d-box-muted"/>
<text x="300" y="363" text-anchor="middle" class="d-text">Cloud and infrastructure</text>
<path d="M570,75 L649,75 L649,128" class="d-line-dashed" marker-end="url(#std-d3-arrow)"/>
<rect x="588" y="130" width="122" height="180" rx="10" class="d-box-warn"/>
<text x="649" y="165" text-anchor="middle" class="d-title">Off-road</text>
<text x="649" y="192" text-anchor="middle" class="d-small">allowed, but</text>
<text x="649" y="210" text-anchor="middle" class="d-small">you own the</text>
<text x="649" y="228" text-anchor="middle" class="d-small">build, the run</text>
<text x="649" y="246" text-anchor="middle" class="d-small">and the on-call</text>
<path d="M649,310 L649,358 L572,358" class="d-line-dashed" marker-end="url(#std-d3-arrow)"/>
</svg>
</div>
<figcaption>Figure 3: Golden paths on top of an internal developer platform, with an explicit off-road option</figcaption>
</figure>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So the platform team decides everything and we just do what they say? What if my service really needs something the golden path doesn't have?"</span>
    </div>
  </div>
</div>

Great question, Junior, and that's why the figure has an **off-road** box. A golden path is a recommendation made irresistible, not a cage. You're allowed to leave it, but then you own everything the platform would have done for you: the pipeline, the patching, the monitoring, the 3 am pager. Most teams, doing that math honestly, stay on the path. The few that leave usually have a real reason, and those reasons are the best input the platform team can get about what to build next.

The other half of the answer: a good platform team treats developers as **customers**. It has a roadmap, collects feedback, measures adoption and satisfaction, and competes for its users. If teams are escaping the golden path in droves, the problem is the path, not the teams. The CNCF's work on platforms and *Team Topologies* (with its "platform as a product" and "thinnest viable platform" ideas) are good places to go deeper.

**Benefit:** standards applied by default, without anyone having to remember them. A new service is born compliant, observable and secure, which is where [operational excellence](/en-us/principles/cloud/operational-excellence/) and [security shift-left](/en-us/principles/solution/security-shift-left/) become cheap instead of heroic.

### 4. Offer Reusable IaC Modules and Templates

**Goal:** make the infrastructure itself a set of tested, versioned building blocks.

Copying infrastructure code from another repository and tweaking it is how most drift starts. A better approach is to publish **modules** (Terraform modules, Bicep modules, Pulumi components, CloudFormation templates) for the pieces every team needs: a network with the right segmentation, a database with backups and encryption enabled, a container app with the standard sidecars, a storage account with the correct retention policy.

A few practices make modules actually useful:

- **Version them** with semantic versioning, so teams can upgrade on their own schedule and know when a change is breaking;
- **Keep them small and composable**, one module per responsibility, instead of a giant "do everything" module with a hundred parameters;
- **Encode the non-negotiables** (encryption, tagging, private networking) inside the module, so teams don't have to remember them;
- **Test them** in the module's own pipeline, before any team consumes a new version;
- **Publish them in a registry** with docs and examples, so finding them is easier than rewriting them;

**Benefit:** consistent infrastructure, security and cost controls built in, and improvements that reach every team with a version bump.

### 5. Define Service and API Standards

**Goal:** make every API in the company look and behave like it was designed by the same person.

APIs are the most important seams of all. When every team designs its own, clients end up learning dozens of dialects. A short, practical API guideline typically covers:

- **Naming:** plural nouns for resources, consistent casing (pick `camelCase` or `snake_case` for fields and never mix), predictable URLs;
- **Versioning:** how versions are expressed (URL, header or media type), what counts as a breaking change, how long old versions are supported and how deprecation is announced;
- **Errors:** one error format for everyone;
- **Pagination, filtering and sorting:** one way to do each;
- **Cross-cutting headers:** correlation IDs, idempotency keys, rate-limit headers;
- **Security:** authentication scheme, scopes, what must never appear in a URL or a log;

For errors, you don't even need to invent anything: RFC 9457 (*Problem Details for HTTP APIs*) defines a standard JSON shape that many frameworks already support:

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient funds",
  "status": 422,
  "detail": "The account balance is 30.00, but the transfer needs 50.00.",
  "instance": "/transfers/7f3c",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

If you don't want to start from scratch, public guidelines like Microsoft's REST API Guidelines and Google's API Improvement Proposals (AIPs) are excellent references to adapt. For events and telemetry, the same thinking applies: agree on schemas, and prefer open standards such as OpenTelemetry for traces, metrics and logs (which, by the way, is exactly what makes [observability first](/en-us/principles/solution/observability-first/) possible across teams).

**Benefit:** clients integrate faster, generic tooling (gateways, SDK generators, linters, dashboards) works for every service, and an on-call engineer can read any error without a translator.

### 6. Choose Wisely Between Shared Libraries and Copy-Paste

**Goal:** share what really needs to be shared, and nothing more.

Here's a spicy one. Shared libraries are the obvious way to reuse code, but they also create coupling: every consumer depends on the library's release cycle, its transitive dependencies and its bugs. The Go community has a famous proverb for this: *"a little copying is better than a little dependency"*.

So when is a shared library worth it, and when is copying fine?

| Approach | Benefit | Watch out for |
| :--- | :--- | :--- |
| **Shared library** for cross-cutting, stable, security-sensitive concerns (logging setup, HTTP client with resilience, auth token validation, telemetry) | One fix reaches everyone; behavior is consistent at the seams | Needs an owner, versioning, a changelog and backward compatibility; keep it thin and with few dependencies |
| **Copy-paste (or a template)** for small, domain-specific or still-evolving code | Teams stay independent and can adapt freely | Copies drift; fine for code that is expected to diverge |
| **Platform service** instead of a library (a central auth service, a feature-flag service) | No library to upgrade in forty repositories | Becomes a runtime dependency; needs to be as reliable as the services that use it |
| **Generated code** from a contract (OpenAPI, Protobuf, AsyncAPI) | Clients and servers always match the contract | The contract becomes the standard; invest in its quality |

A practical heuristic is the **rule of three**: write it once, copy it the second time, extract a shared component only when the third team needs it and the shape is clear. Extracting too early freezes the wrong abstraction and couples teams for no reason.

And never, ever put **business logic** in a "commons" library shared by every service. That's how you end up with a distributed monolith, where changing a customer rule requires coordinated deploys of fifteen services. Domain logic belongs inside its [bounded context](/en-us/principles/solution/bounded-contexts/).

### 7. Embrace Inner Source

**Goal:** let everyone contribute to shared components, instead of queuing requests for an overloaded central team.

Inner source means applying open source practices inside the company: shared components live in repositories everyone can read, anyone can open a pull request, there's a `CONTRIBUTING.md` explaining how, and a small group of **trusted committers** reviews and merges. The InnerSource Commons community has plenty of patterns and material on this.

It solves a classic problem: the central team that owns the shared library becomes a bottleneck, teams get tired of waiting and fork the code, and now you have six "shared" libraries again. With inner source, the team that needs a feature can build it themselves, with the owners guiding quality and design.

**Benefit:** shared components evolve at the speed of their users, knowledge spreads across teams, and the owners stop being a bottleneck without losing control over quality.

## How a Standard Is Born, Lives and Dies

A standard isn't a stone tablet. It has a lifecycle, and managing that lifecycle well is what separates living standards from dead documents that everybody ignores.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 250" role="img" aria-labelledby="std-d4-title std-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d4-title">The lifecycle of a standard</title>
<desc id="std-d4-desc">A standard moves through six stages: RFC proposal, trial with pilot teams, adoption as the default, maintenance by an owner, deprecation with a sunset date and retirement. From maintenance, a loop returns to a new RFC when a better option appears.</desc>
<defs><marker id="std-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="36" text-anchor="middle" class="d-label">HOW A STANDARD IS BORN, LIVES AND DIES</text>
<rect x="20" y="80" width="104" height="70" rx="10" class="d-box"/>
<text x="72" y="110" text-anchor="middle" class="d-title">RFC</text>
<text x="72" y="131" text-anchor="middle" class="d-small">proposal</text>
<rect x="144" y="80" width="104" height="70" rx="10" class="d-box-info"/>
<text x="196" y="110" text-anchor="middle" class="d-title">Trial</text>
<text x="196" y="131" text-anchor="middle" class="d-small">pilot teams</text>
<rect x="268" y="80" width="104" height="70" rx="10" class="d-box-accent"/>
<text x="320" y="110" text-anchor="middle" class="d-title">Adopt</text>
<text x="320" y="131" text-anchor="middle" class="d-small">the default</text>
<rect x="392" y="80" width="104" height="70" rx="10" class="d-box-accent"/>
<text x="444" y="110" text-anchor="middle" class="d-title">Maintain</text>
<text x="444" y="131" text-anchor="middle" class="d-small">has an owner</text>
<rect x="516" y="80" width="104" height="70" rx="10" class="d-box-warn"/>
<text x="568" y="110" text-anchor="middle" class="d-title">Deprecate</text>
<text x="568" y="131" text-anchor="middle" class="d-small">sunset date</text>
<rect x="640" y="80" width="104" height="70" rx="10" class="d-box-muted"/>
<text x="692" y="110" text-anchor="middle" class="d-title">Retire</text>
<text x="692" y="131" text-anchor="middle" class="d-small">removed</text>
<line x1="124" y1="115" x2="142" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="248" y1="115" x2="266" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="372" y1="115" x2="390" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="496" y1="115" x2="514" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="620" y1="115" x2="638" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<path d="M444,150 L444,200 L72,200 L72,152" class="d-line-dashed" marker-end="url(#std-d4-arrow)"/>
<text x="258" y="222" text-anchor="middle" class="d-small">a better option shows up: new RFC</text>
</svg>
</div>
<figcaption>Figure 4: The lifecycle of a standard, from proposal to retirement</figcaption>
</figure>

### Birth: RFCs and communities of practice

The worst way to create a standard is for one person (usually with "architect" in their title) to write it alone and announce it by email. People don't follow rules they had no part in, especially rules that don't match their reality.

A much better way:

1. **Start from a real pain.** "We have twelve loggers and can't correlate requests" is a great reason. "It would be nice to have a standard for X" is not;
2. **Write an RFC** (*Request for Comments*): a short document describing the problem, the proposal, the alternatives considered, the migration cost and the trade-offs. Keep it in version control, where anyone can comment;
3. **Discuss it in a community of practice**: a group of practitioners from different teams who care about the topic (backend, frontend, data, observability). They review the RFC, bring the view from the trenches and become the standard's ambassadors in their teams;
4. **Record the decision** in an Architecture Decision Record (ADR), with the context and the reasons, so that two years from now nobody has to guess why;
5. **Pilot it** with one or two volunteer teams before rolling it out, and adjust based on what they learn;

Andrew Harmel-Law's article on martinfowler.com about scaling architecture through the **advice process** is a great read here: anyone can make an architectural decision, as long as they seek advice from those affected and from people with expertise. It fits standards very well.

### Life: ownership and versioning

Once adopted, a standard needs what any product needs: an **owner** (a team or a named group, never "everyone"), a place where it's documented, a version, a changelog and a channel for questions and feedback. Standards also need to show up where developers already are: in templates, linters, pipeline checks and the portal, not only in a wiki page.

### Death: deprecation and retirement

Standards should die. Technologies age, better options appear, and a standard that was great five years ago can become an anchor. Retiring one well involves:

- **Moving it to Hold** on the radar and announcing the replacement;
- **Setting a sunset date**, with enough time for teams to migrate;
- **Providing a migration path**: guides, codemods, updated templates, and help from the owners;
- **Tracking usage**, so you know who still depends on it and can help them specifically;
- **Actually removing it** when the date comes, instead of letting it linger forever;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Why retire anything? If the old standard still works, just leave it there. Nobody gets hurt!"</span>
    </div>
  </div>
</div>

Ah, Junior, if only it were that simple! Every standard that is never retired stays in the landscape, and keeping it costs money: someone has to patch it, someone has to know how it works, new hires have to learn it. Without retirement, "standardization" slowly turns into accumulation. You end up with two standards for the same thing, then three, and you're right back at the twelve loggers, except now each one has an official stamp. Retiring standards is as much a part of this principle as creating them.

## The Trap of Over-Standardization

Now the other side of the coin. Just as a lack of standards creates chaos, too many of them create paralysis. Signs you've gone too far:

- Teams need approval from a committee to use any library, even for a small internal tool;
- The approved stack hasn't changed in years, and every new idea hits "it's not in the standard";
- People spend more time filling out exception requests than writing code;
- Good engineers leave because they feel they can't learn or try anything new;
- Shadow IT appears: teams quietly use whatever they want and hide it;
- The standards describe how things were done in 2018, not how the best teams work today;

Over-standardization kills innovation in a very quiet way. Nobody forbids experimentation explicitly; it just becomes so expensive that nobody bothers.

A few ways to avoid it:

| Approach | Benefit |
| :--- | :--- |
| **Standardize the seams, not the insides.** Be strict about contracts and platforms, relaxed about implementation details. | Teams keep real autonomy where it doesn't affect others. |
| **Keep the Assess and Trial rings alive.** Every radar edition should bring new things in, not only take things out. | Innovation has a legitimate path, instead of happening in the shadows. |
| **Make exceptions cheap and visible.** A short written justification, not a three-week approval process. | You learn where the standards don't fit, and teams don't need to hide. |
| **Give standards an expiry.** Review each one periodically: is it still the best option? | Standards evolve with the industry instead of fossilizing. |
| **Measure the outcomes, not the compliance.** Onboarding time, time to first deploy, incident resolution time, developer satisfaction. | You know whether the standards help, not just whether they're followed. |
| **Offer sandboxes for experiments.** Isolated environments where teams can try anything within cost and security limits. | Learning stays cheap and safe, without polluting production. |

<div class="callout info">
  <p>The best standards are the ones teams would choose anyway, if they had the time to evaluate all the options. A standard that needs to be imposed by force is often telling you it's the wrong standard (or that nobody explained the why).</p>
</div>

## Tradeoffs

**Standardization** reduces variance, cognitive load and risk, and lets the organization learn once and apply everywhere. But, like every principle, it comes with *trade-offs*. Something that makes the landscape more consistent can hurt other qualities of the architecture, or of the organization.

Shall we look at the main ones?

### Consistency vs Team Autonomy

This is the central tension. Every standard removes a choice from a team. When the choice didn't matter much (which logger), that's a gain. When the choice really mattered for that team's problem (a data team forced to use the same database as a CRUD service), it's a loss, and sometimes a big one.

The balance comes from the split we saw earlier: strict at the seams, flexible inside. And from a culture where teams can challenge a standard with arguments and data, and where the standard owners actually listen. Autonomy and alignment are not opposites; the goal is *aligned autonomy*.

### Lock-in to Internal Platforms

Everyone worries about vendor lock-in with cloud providers, but few people notice the **internal lock-in**. When every service depends on the internal platform, the internal libraries and the internal templates, the company is locked into its own creation. If the platform team shrinks, if the platform ages or if the company is acquired and needs to integrate with another stack, that dependency can become very expensive.

Some mitigations: build the platform on open standards (OpenTelemetry, OCI containers, standard IaC tools) instead of proprietary internal formats; keep the abstraction layers thin, so teams can see what's underneath; and document the escape routes. The "thinnest viable platform" idea exists precisely for this.

### Maintenance Cost of Shared Components

Nothing is free. A shared library, an IaC module or a golden path template needs people: to fix bugs, to update dependencies, to answer questions, to keep backward compatibility, to write docs. When this cost is not planned, the shared component slowly rots, teams lose trust in it, and they go back to building their own. That's how you get twelve loggers *with* a standard.

If the organization wants reusable building blocks, it has to fund them as products, with a team, a roadmap and a budget. Otherwise, it's better to have fewer of them and maintain them well.

### Tradeoffs with Reliability

Shared components create **shared failure modes**. A bug in the common HTTP client or a bad version of the base container image can hit every service at once. The blast radius of a mistake grows with adoption. Monocultures are efficient until the day they get sick all together.

Mitigations: roll out new versions of shared components progressively (canary teams first), keep them backward compatible, test them heavily, and make sure services pin versions instead of always pulling "latest". On the positive side, a well-built resilience library can raise the [reliability](/en-us/principles/cloud/reliability/) of every service at once.

### Tradeoffs with Security

Standardization is mostly a friend of [security](/en-us/principles/cloud/security/): fewer technologies mean a smaller attack surface, patches are applied in one place and inventories are easy. But the flip side is that a single vulnerability in a widely adopted component exposes everything simultaneously, and attackers love widely used components for exactly that reason. The shared pipeline and the internal package registry also become high-value targets in the software supply chain, so they need to be protected accordingly (frameworks like SLSA help here).

### Tradeoffs with Cost Optimization

Platform teams, communities of practice, RFC reviews, migrations to new standards and the retirement of old ones all consume time and money that could go to product features. In the short term, standardization often *costs* more than it saves. The return comes later, through faster onboarding, fewer incidents and less duplicated work. On the other hand, standards can also improve [cost optimization](/en-us/principles/cloud/cost-optimization/) directly: standard modules with mandatory tagging, right-sized defaults and consolidated licenses.

### Tradeoffs with Performance Efficiency

Standards are built for the common case. A generic HTTP client, a default database configuration or a standard container size will be good enough for most services and suboptimal for a few. A service with extreme latency or throughput requirements may need to go off-road, and the standards should allow that when there's evidence (measurements, not feelings) that the default isn't enough.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Hold on... So too few standards is chaos, too many is paralysis, and each one has a cost. How do I know where the right point is?"</span>
    </div>
  </div>
</div>

Exactly, Junior, there's no magic number. The right point depends on the size of the company, its regulatory context, its maturity and its strategy. A startup with three teams needs very few standards; a bank with three hundred teams needs many more. What works everywhere is to start with the seams that hurt the most, measure whether the standards help, listen to the teams using them and keep retiring what no longer makes sense. Standardization is a continuous practice, not a project with an end date.

## Conclusion

**Standardization** is how an organization stops paying, over and over, for the same decisions. Technology radars make choices explicit, reference architectures give teams a proven starting point, golden paths and internal platforms turn standards into the easiest path, reusable IaC modules and API guidelines keep the seams consistent, and inner source keeps shared components alive and evolving.

**Most importantly:** good standards are born from real pain, are built with the people who will use them, have owners, and die when they're no longer the best option. They reduce cognitive load, onboarding time and risk, without killing the experimentation that keeps the company moving forward.

And remember: standards define the *what*. Who decides, how compliance is checked and how exceptions are handled is the job of [governance](/en-us/principles/enterprise/governance/). Get both right and you have an organization where teams move fast *because* they share a solid common ground, not in spite of it.

## Next Steps

1. **Take inventory of the current landscape**
Map which languages, frameworks, libraries, pipelines and infrastructure patterns are in use today. You can't standardize what you can't see, and the inventory alone usually reveals the worst duplications.

2. **Pick the seams that hurt the most**
Start with the areas where inconsistency causes real incidents or delays: logging and tracing, API errors, authentication, deployment pipelines. Leave the insides of services alone.

3. **Publish your first technology radar**
Even a simple one, with a few dozen entries, gives teams a shared reference and opens the conversation about what to adopt, try, assess and hold.

4. **Build one golden path end to end**
Choose the most common kind of service in the company and make it possible to go from zero to production on the paved road in hours. Measure time to first deploy before and after.

5. **Set up the lifecycle**
Create an RFC template, a community of practice, ADRs and an owner for each standard. Define how standards are reviewed, deprecated and retired, and use the process for real.

6. **Measure and listen**
Track onboarding time, incident resolution time, adoption of shared components and developer satisfaction. When teams keep leaving the golden path, treat it as feedback about the path.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://www.thoughtworks.com/radar" target="_blank" rel="noopener">ThoughtWorks Technology Radar</a></li>
    <li><a href="https://teamtopologies.com/" target="_blank" rel="noopener">Team Topologies</a></li>
    <li><a href="https://tag-app-delivery.cncf.io/whitepapers/platforms/" target="_blank" rel="noopener">CNCF Platforms White Paper</a></li>
    <li><a href="https://backstage.io/" target="_blank" rel="noopener">Backstage, an open platform for developer portals</a></li>
    <li><a href="https://innersourcecommons.org/" target="_blank" rel="noopener">InnerSource Commons</a></li>
    <li><a href="https://martinfowler.com/articles/scaling-architecture-conversationally.html" target="_blank" rel="noopener">Scaling the Practice of Architecture, Conversationally (martinfowler.com)</a></li>
    <li><a href="https://www.rfc-editor.org/rfc/rfc9457" target="_blank" rel="noopener">RFC 9457: Problem Details for HTTP APIs</a></li>
    <li><a href="https://github.com/microsoft/api-guidelines" target="_blank" rel="noopener">Microsoft REST API Guidelines</a></li>
    <li><a href="https://google.aip.dev/" target="_blank" rel="noopener">Google API Improvement Proposals (AIP)</a></li>
    <li><a href="https://semver.org/" target="_blank" rel="noopener">Semantic Versioning</a></li>
    <li><a href="https://opentelemetry.io/" target="_blank" rel="noopener">OpenTelemetry</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
