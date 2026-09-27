---
title: Governance
short: "Guardrails, not gates: governance that lets teams move fast without driving off a cliff. After all, who wants to wait a month for a meeting to say yes?"
category: enterprise
---

## Introduction

Say the word "governance" in a room full of engineers and watch the faces. Someone sighs, someone looks at the ceiling, and someone quietly opens a new tab to update their resume. For a lot of people, governance means forms, committees, approvals and that feeling of asking permission to do your job.

And honestly? Many times they're right. But that's bad governance, not governance itself.

The **goal** of this principle is simple to say and hard to do: make sure the organization's important decisions are made by the right people, at the right level, with the right information, and that the rules which come out of those decisions are **enforced automatically**, without turning every delivery into a bureaucratic obstacle course. Good governance doesn't slow teams down. It's what allows a company with fifty teams to move fast without each one reinventing security, networking and compliance on its own (and getting some of them wrong).

When an organization neglects this principle, or implements it the wrong way, the symptoms show up quickly:

- Each team makes the same critical decision in a different way, and nobody knows which one is "right";
- Nobody remembers **why** that database, that region or that framework was chosen;
- Compliance is checked once a year, in a panic, the week before the audit;
- Exceptions granted "temporarily" in 2019 are still in production;
- Approvals take weeks, so teams learn to go around the process (the famous *shadow IT*);
- Security and cost rules exist in a PDF that nobody has opened since it was written;

Yep, *it's rare, but it happens all the time*... Who hasn't seen it?

### The committee that met once a month

Let me tell you a story that, with small variations, I've seen in more than one company.

There was an **Architecture Review Board** (ARB). It met on the first Tuesday of each month. To get on the agenda, a team had to submit a design document two weeks in advance, following a thirty-page template. The board was made up of seven senior people, all very busy, who read the documents (when they read them) the night before.

A team wanted to use a managed message queue. They submitted it. The meeting ran out of time before their item. Next month. On the second try, the board asked for "a comparison with three alternatives". Next month. On the third try, the decision was approved with the condition of "reviewing the network topology with the infrastructure team", which had its own committee. Total: almost four months to use a service that the cloud provider offers with two clicks.

What happened next is what always happens: the next team didn't even ask. They created the queue in a personal subscription, with a credit card, "just to test". The test went to production. Nobody knew it existed until the bill arrived, along with an audit finding about data outside the approved region.

<div class="callout warning" data-title="The paradox of the slow gate">
  <p>A governance process that is too slow doesn't produce more control. It produces <strong>less</strong> control, because people start going around it. The most rigid committee in the world governs nothing if the decisions are being made outside it.</p>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So the solution is simple: abolish the committee and let each team do whatever it wants! Freedom!"</span>
    </div>
  </div>
</div>

Easy there, Junior! Throwing governance away is the other extreme, and it ends just as badly. Without any shared rules, you get forty ways of handling secrets, twelve logging stacks, public buckets full of customer data and nobody able to answer the auditor's simplest question: "who approved this, and why?".

The answer isn't "more control" or "less control". It's **smarter control**: move the rules out of the meeting room and into the platform, and keep human judgment for the decisions that really need it.

## Guardrails, Not Gates

This is the central idea of modern governance, so it's worth spelling it out.

A **gate** is a checkpoint where work stops and waits for someone's approval. It's synchronous, manual and, by nature, a queue. The more teams you have, the longer the queue.

A **guardrail** is a limit built into the road. You drive at full speed, and the guardrail only makes itself felt when you're about to go off the cliff. It's automatic, it runs all the time, and it scales with the number of teams without anyone having to be in a meeting.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="gov-d1-title gov-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d1-title">Gate model versus guardrail model</title>
<desc id="gov-d1-desc">In the gate model, a team request waits for a monthly review board, often loops back for rework, and deploys weeks later. In the guardrail model, the team starts from a paved road, automated policy checks run in the pipeline and the platform, and the deploy happens the same day.</desc>
<defs><marker id="gov-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">GATES: WEEKS OF WAITING</text>
<rect x="20" y="45" width="140" height="64" rx="10" class="d-box"/>
<text x="90" y="73" text-anchor="middle" class="d-title">Team request</text>
<text x="90" y="95" text-anchor="middle" class="d-small">design doc, slides</text>
<rect x="200" y="45" width="140" height="64" rx="10" class="d-box-danger"/>
<text x="270" y="73" text-anchor="middle" class="d-title">Monthly ARB</text>
<text x="270" y="95" text-anchor="middle" class="d-small">waits for meeting</text>
<rect x="380" y="45" width="140" height="64" rx="10" class="d-box-warn"/>
<text x="450" y="73" text-anchor="middle" class="d-title">Verdict</text>
<text x="450" y="95" text-anchor="middle" class="d-small">approve or redo</text>
<rect x="560" y="45" width="140" height="64" rx="10" class="d-box-muted"/>
<text x="630" y="73" text-anchor="middle" class="d-title">Deploy</text>
<text x="630" y="95" text-anchor="middle" class="d-small">weeks later</text>
<line x1="160" y1="77" x2="198" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<line x1="340" y1="77" x2="378" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<line x1="520" y1="77" x2="558" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<path d="M450,109 L450,128 L270,128 L270,111" fill="none" class="d-line-danger" marker-end="url(#gov-d1-arrow)"/>
<text x="360" y="146" text-anchor="middle" class="d-small">rework loop: back to next month</text>
<text x="360" y="184" text-anchor="middle" class="d-label">GUARDRAILS: MINUTES TO HOURS</text>
<rect x="20" y="200" width="140" height="64" rx="10" class="d-box"/>
<text x="90" y="228" text-anchor="middle" class="d-title">Team need</text>
<text x="90" y="250" text-anchor="middle" class="d-small">starts coding</text>
<rect x="200" y="200" width="140" height="64" rx="10" class="d-box-accent"/>
<text x="270" y="228" text-anchor="middle" class="d-title">Paved road</text>
<text x="270" y="250" text-anchor="middle" class="d-small">templates, modules</text>
<rect x="380" y="200" width="140" height="64" rx="10" class="d-box-info"/>
<text x="450" y="228" text-anchor="middle" class="d-title">Policy checks</text>
<text x="450" y="250" text-anchor="middle" class="d-small">CI and platform</text>
<rect x="560" y="200" width="140" height="64" rx="10" class="d-box-accent"/>
<text x="630" y="228" text-anchor="middle" class="d-title">Deploy</text>
<text x="630" y="250" text-anchor="middle" class="d-small">same day</text>
<line x1="160" y1="232" x2="198" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
<line x1="340" y1="232" x2="378" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
<line x1="520" y1="232" x2="558" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
</svg>
</div>
<figcaption>Figure 1: The same need, handled by a gate and by a guardrail</figcaption>
</figure>

Notice that the guardrail model doesn't eliminate the rules. The rules are **the same** (allowed regions, encryption, no public endpoints for internal data, mandatory tags). What changes is **where** they live and **when** they are checked: instead of a person reading a document once a month, a policy evaluates every change, all the time, in seconds.

### Paved roads: make the right thing the easy thing

Guardrails say what you **can't** do. A **paved road** (some companies call it a *golden path*) shows what you **should** do, and makes it the path of least resistance.

In practice, the paved road is a set of ready-to-use building blocks, maintained by a platform team:

- Infrastructure modules (Terraform, Bicep, Pulumi) that already come with encryption, private networking, diagnostics and tags;
- Service templates with pipeline, observability and security scanning configured out of the box;
- Pre-approved patterns for the most common scenarios (web API, event consumer, batch job, static site);
- Documentation that explains **why** each choice was made.

The deal with teams is clear: **if you use the paved road, you're already compliant**. No review, no ticket, no waiting. If you want to go off-road, you can, but then you take on the burden of proving that your alternative meets the same requirements.

<div class="callout tip">
  <p>A paved road only works if it's <strong>genuinely better</strong> than the alternative. If the official template is slower, older or harder to use than doing it by hand, teams will leave it, no matter how many policies you write. Treat the platform as a product, with the development teams as its customers.</p>
</div>

The paved road overlaps with standardization, and that's intentional: the reusable standards themselves (which languages, which patterns, which reference architectures) are the subject of [Standardization](/en-us/principles/enterprise/standardization/). Here, the focus is on the other half: **who decides** what goes into the road, and **how** the rules are enforced.

## Decision Rights: Who Decides What

Every organization makes architecture decisions all the time. The question is whether it knows **who** is making them. Unclear decision rights produce two opposite diseases: everything goes up to the committee (paralysis), or nothing does (chaos).

A useful way to distribute decisions is to look at two dimensions:

- **Blast radius:** how many teams, systems or customers are affected if the decision is wrong?
- **Reversibility:** how expensive is it to undo? Changing a library is cheap. Changing the company's primary database or identity provider is not.

Amazon popularized this idea with the analogy of "one-way doors" and "two-way doors": decisions you can walk back through should be made fast, by the people closest to the problem. Only the one-way doors deserve heavier deliberation.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 340" role="img" aria-labelledby="gov-d2-title gov-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d2-title">Decision rights by blast radius and reversibility</title>
<desc id="gov-d2-desc">A two by two matrix. Decisions with low blast radius that are easy to reverse are made by the team. Low blast radius but hard to reverse: the team decides with an ADR and peer review. High blast radius but easy to reverse: an automated platform guardrail. High blast radius and hard to reverse: an architecture forum with an ADR and asynchronous review.</desc>
<text x="70" y="175" text-anchor="middle" class="d-label" transform="rotate(-90 70 175)">BLAST RADIUS</text>
<text x="100" y="60" text-anchor="end" class="d-small">high</text>
<text x="100" y="295" text-anchor="end" class="d-small">low</text>
<rect x="120" y="40" width="265" height="125" rx="10" class="d-box-danger"/>
<text x="252" y="88" text-anchor="middle" class="d-title">Architecture forum</text>
<text x="252" y="112" text-anchor="middle" class="d-small">ADR plus async review</text>
<text x="252" y="132" text-anchor="middle" class="d-small">days, not months</text>
<rect x="395" y="40" width="265" height="125" rx="10" class="d-box-info"/>
<text x="527" y="88" text-anchor="middle" class="d-title">Platform guardrail</text>
<text x="527" y="112" text-anchor="middle" class="d-small">encoded as policy</text>
<text x="527" y="132" text-anchor="middle" class="d-small">checked on every change</text>
<rect x="120" y="175" width="265" height="125" rx="10" class="d-box-warn"/>
<text x="252" y="223" text-anchor="middle" class="d-title">Team plus ADR</text>
<text x="252" y="247" text-anchor="middle" class="d-small">peer review, advisor</text>
<text x="252" y="267" text-anchor="middle" class="d-small">written for the future</text>
<rect x="395" y="175" width="265" height="125" rx="10" class="d-box-accent"/>
<text x="527" y="223" text-anchor="middle" class="d-title">Team decides</text>
<text x="527" y="247" text-anchor="middle" class="d-small">just ship it</text>
<text x="527" y="267" text-anchor="middle" class="d-small">within the guardrails</text>
<text x="252" y="325" text-anchor="middle" class="d-label">HARD TO REVERSE</text>
<text x="527" y="325" text-anchor="middle" class="d-label">EASY TO REVERSE</text>
</svg>
</div>
<figcaption>Figure 2: Who decides depends on blast radius and reversibility</figcaption>
</figure>

The practical consequence: **most decisions should never reach a committee**. Picking a JSON library, naming queues, structuring a repository, choosing a test framework: all of this lives in the bottom right corner. The architecture forum should see a handful of decisions per month, not dozens.

### RACI: making responsibility explicit

For recurring governance activities, a **RACI** matrix removes the "I thought you were doing it" problem. Each letter answers a different question: who does the work (**R**esponsible), who answers for the result and has the final say (**A**ccountable, only one person or role per activity), who must be heard before (**C**onsulted) and who must be informed after (**I**nformed).

| Activity | Product team | Platform team | Architecture forum | Security | CISO / CTO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Choose libraries and frameworks inside the paved road** | R, A | I | | | |
| **Write an ADR for a cross-team decision** | R | C | A | C | I |
| **Create or change an enterprise policy** | C | R | C | A | I |
| **Grant a policy exception** | R (requests) | C | C | A | I |
| **Maintain landing zones and paved road modules** | C | R, A | C | C | |
| **Define the governance principles themselves** | C | C | R | C | A |

<div class="callout info">
  <p>The most common RACI mistake is having <strong>more than one "A"</strong> per line. If two people are accountable, nobody is. The second most common mistake is consulting everyone about everything: every "C" is someone the work has to wait for.</p>
</div>

### Architecture review done right

So should we get rid of the ARB? Not necessarily. It needs to change its nature: from a **gate** that approves projects to a **forum** that helps people make good decisions and learns from them. Some traits of forums that work:

1. **Asynchronous by default.** The decision is proposed in writing (an ADR in a pull request), people comment over a few days, and the meeting only exists for the cases where writing wasn't enough.
2. **Advice, not permission.** Andrew Harmel-Law describes this well in the "advice process" (see the references): anyone can make an architecture decision, as long as they first seek advice from the people affected and from those with expertise. The decider stays responsible, and the forum is a place to ask for that advice.
3. **Short and predictable timebox.** For example, "if nobody raises a blocking concern within five business days, the decision stands". Predictability matters more than speed.
4. **Only for one-way doors.** Everything else is decided by the teams, within the guardrails.
5. **Feeds the platform.** When the forum sees the same question three times, the answer should become a paved road module or a policy, so nobody needs to ask a fourth time.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Writing it down? But we already decided in the meeting, everybody was there. Why waste time documenting?"</span>
    </div>
  </div>
</div>

Because in eighteen months, Junior, half of "everybody" will have left the company, and the other half will remember the meeting differently. Then someone new will look at the system, think "what a strange choice", and spend three weeks undoing a decision that had a very good reason behind it. Or worse, will keep a bad decision out of fear, because nobody knows whether it was deliberate.

### Architecture Decision Records (ADRs)

An **ADR** is a short document (one or two pages, at most) that records a single significant decision: the context, the decision itself and its consequences. The format was popularized by Michael Nygard, and its beauty is how small it is. ADRs live **in the repository**, next to the code, versioned in Git and reviewed in pull requests like any other change.

A minimal template:

```markdown
# ADR-0042: Use managed message queue for order events

Status: Accepted (2026-09-10)
Deciders: Orders team, advice from Platform and Security

## Context
Order events are lost when the consumer restarts. We need
at-least-once delivery, and we don't want to operate a broker.

## Decision
Use the cloud provider's managed queue, provisioned through
the paved road module, with private endpoint and CMK encryption.

## Consequences
+ No broker to patch or scale.
+ Already compliant with the landing zone policies.
- Vendor lock-in on the queue API (mitigated by an adapter).
- Consumers must be idempotent.
```

Some habits that make ADRs useful instead of decorative:

- **ADRs are immutable.** When a decision changes, you write a new ADR that *supersedes* the old one, and the old one stays there with its status updated. The history is precisely the value.
- **Record the rejected alternatives**, with one line explaining why. That's what future readers will ask.
- **Write them at decision time**, not afterwards. An ADR written six months later is archaeology, not governance.
- **Link ADRs to the policies** they gave rise to. When a policy blocks someone, they should be able to find the reason with one click.

## Landing Zones and the Hierarchy

Decision rights say **who** decides. The next question is **where** the decisions are applied. In the cloud, the answer is the resource hierarchy: the structure of accounts, subscriptions and projects, and the groupings above them.

A **landing zone** is a pre-configured environment, ready to receive *workloads*, that already comes with identity, networking, logging, security and the governance policies in place. Instead of every team building its own foundation from scratch, they "land" on one that is already compliant.

The key trick is the hierarchy: **policies are assigned at a high level and inherited downward**. You write the rule "only these regions are allowed" once, at the top, and it applies to every subscription or account below it, including the ones that will be created next year.

- On **Azure**, this is done with **management groups**, with **Azure Policy** assignments at each level;
- On **AWS**, with **AWS Organizations** and **organizational units (OUs)**, where **Service Control Policies (SCPs)** define the maximum permissions allowed in each account, and **AWS Control Tower** packages the landing zone;
- On **Google Cloud**, with the **organization, folders and projects** hierarchy and **Organization Policies**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 330" role="img" aria-labelledby="gov-d3-title gov-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d3-title">Management group and account hierarchy</title>
<desc id="gov-d3-desc">An organization root with global guardrails branches into Platform, Landing zones, Sandbox and Decommissioned groups. Landing zones branches further into Corp, for private workloads, and Online, where public endpoints are allowed. Policies assigned higher up are inherited by everything below.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">AZURE MANAGEMENT GROUPS / AWS OUS / GCP FOLDERS</text>
<rect x="270" y="38" width="180" height="56" rx="10" class="d-box-accent"/>
<text x="360" y="62" text-anchor="middle" class="d-title">Organization root</text>
<text x="360" y="82" text-anchor="middle" class="d-small">regions, audit, logging</text>
<line x1="360" y1="94" x2="360" y2="117" class="d-line"/>
<line x1="95" y1="117" x2="620" y2="117" class="d-line"/>
<line x1="95" y1="117" x2="95" y2="140" class="d-line"/>
<line x1="270" y1="117" x2="270" y2="140" class="d-line"/>
<line x1="445" y1="117" x2="445" y2="140" class="d-line"/>
<line x1="620" y1="117" x2="620" y2="140" class="d-line"/>
<rect x="20" y="140" width="150" height="56" rx="10" class="d-box"/>
<text x="95" y="164" text-anchor="middle" class="d-title">Platform</text>
<text x="95" y="184" text-anchor="middle" class="d-small">identity, network</text>
<rect x="195" y="140" width="150" height="56" rx="10" class="d-box-info"/>
<text x="270" y="164" text-anchor="middle" class="d-title">Landing zones</text>
<text x="270" y="184" text-anchor="middle" class="d-small">workload baseline</text>
<rect x="370" y="140" width="150" height="56" rx="10" class="d-box-warn"/>
<text x="445" y="164" text-anchor="middle" class="d-title">Sandbox</text>
<text x="445" y="184" text-anchor="middle" class="d-small">loose, budget cap</text>
<rect x="545" y="140" width="150" height="56" rx="10" class="d-box-danger"/>
<text x="620" y="164" text-anchor="middle" class="d-title">Decommissioned</text>
<text x="620" y="184" text-anchor="middle" class="d-small">deny everything</text>
<line x1="270" y1="196" x2="270" y2="222" class="d-line"/>
<line x1="180" y1="222" x2="360" y2="222" class="d-line"/>
<line x1="180" y1="222" x2="180" y2="248" class="d-line"/>
<line x1="360" y1="222" x2="360" y2="248" class="d-line"/>
<rect x="110" y="248" width="140" height="56" rx="10" class="d-box"/>
<text x="180" y="272" text-anchor="middle" class="d-title">Corp</text>
<text x="180" y="292" text-anchor="middle" class="d-small">private only</text>
<rect x="290" y="248" width="140" height="56" rx="10" class="d-box"/>
<text x="360" y="272" text-anchor="middle" class="d-title">Online</text>
<text x="360" y="292" text-anchor="middle" class="d-small">public allowed</text>
<rect x="470" y="238" width="225" height="76" rx="10" class="d-box-muted"/>
<text x="582" y="264" text-anchor="middle" class="d-text">Assign policies high,</text>
<text x="582" y="284" text-anchor="middle" class="d-text">they inherit downward</text>
<text x="582" y="303" text-anchor="middle" class="d-small">new accounts start compliant</text>
</svg>
</div>
<figcaption>Figure 3: A typical hierarchy, where policies flow from the top to every account below</figcaption>
</figure>

A few design tips for the hierarchy:

- **Organize by governance needs, not by org chart.** Departments get reorganized every year; the difference between "private workloads" and "internet-facing workloads" doesn't. If two groups have the same policies, they probably don't need to be separate groups.
- **Keep it shallow.** Three or four levels are usually enough. Deep hierarchies make it hard to understand which policy applies where.
- **Have a sandbox.** Give people a place to experiment with looser rules and a hard budget limit. The alternative is experiments happening on personal credit cards (remember the story?).
- **Have a decommissioned group.** Moving an account there before deletion blocks everything while you make sure nobody still depends on it.
- **Automate account creation** ("subscription vending" or "account vending"): a request in a form or a pull request generates a new account, already placed in the right spot of the hierarchy, with networking and policies applied. Waiting two weeks for a subscription is also a gate.

## Policy as Code

We've already talked about Policy as Code in [Cost Optimization](/en-us/principles/cloud/cost-optimization/), with a focus on cost *guardrails* (SKU limits, mandatory tags, budgets). Here, the view is broader: policy as code is the **enforcement mechanism** for all governance decisions, including security, compliance, data residency and operations.

The idea is to treat rules exactly like software: written in a declarative language, versioned in Git, reviewed in pull requests, tested automatically and deployed through a pipeline. No more rules that exist only in a PDF.

### Where policies run

Policies can act at different moments, and a mature governance program uses more than one:

| Moment | What it does | Examples of tools |
| :--- | :--- | :--- |
| **In the developer's pipeline (shift left)** | Evaluates the IaC plan before anything exists and fails the build with a clear message. | OPA with Conftest, Checkov, tfsec / Trivy, Sentinel (Terraform) |
| **At the cloud control plane (preventive)** | Denies the API call that would create a non-compliant resource, no matter where it came from. | Azure Policy (deny), AWS SCPs, GCP Organization Policies |
| **At the Kubernetes API (admission)** | Rejects manifests that break the rules (privileged containers, images from untrusted registries). | OPA Gatekeeper, Kyverno |
| **After the fact (detective)** | Continuously evaluates what already exists and flags or remediates drift. | Azure Policy (audit, deployIfNotExists), AWS Config rules, Security Hub, Defender for Cloud |

The pipeline gives fast feedback; the control plane guarantees nobody can bypass it through the portal or the CLI; the detective layer catches what was created before the policy existed. You want all three.

A small example, in Rego (the OPA language), evaluating a Terraform plan in the pipeline:

```rego
package terraform.storage

import rego.v1

deny contains msg if {
  some r in input.resource_changes
  r.type == "azurerm_storage_account"
  r.change.after.public_network_access_enabled == true
  msg := sprintf("%s: public network access is not allowed (see ADR-0017)", [r.address])
}
```

Notice the message: it says what's wrong **and** points to the decision behind it. A policy that just says "denied" generates a ticket. A policy that explains itself generates a fix.

### The lifecycle of a policy

A policy is never turned on in *deny* mode on day one. That's the fastest way to break production and make the whole company hate governance. The healthy path looks like this:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 240" role="img" aria-labelledby="gov-d4-title gov-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d4-title">Policy as code lifecycle</title>
<desc id="gov-d4-desc">A policy is authored in Git and reviewed, tested in CI, rolled out first in audit mode to measure impact, then enforced by denying or remediating, and finally produces continuous compliance evidence. Exceptions with expiry dates and findings feed back into the next version of the policy.</desc>
<defs><marker id="gov-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="30" text-anchor="middle" class="d-label">POLICY AS CODE LIFECYCLE</text>
<rect x="15" y="60" width="126" height="70" rx="10" class="d-box"/>
<text x="78" y="90" text-anchor="middle" class="d-title">Author</text>
<text x="78" y="112" text-anchor="middle" class="d-small">in Git, reviewed</text>
<rect x="161" y="60" width="126" height="70" rx="10" class="d-box"/>
<text x="224" y="90" text-anchor="middle" class="d-title">Test in CI</text>
<text x="224" y="112" text-anchor="middle" class="d-small">unit tests, plan</text>
<rect x="307" y="60" width="126" height="70" rx="10" class="d-box-warn"/>
<text x="370" y="90" text-anchor="middle" class="d-title">Audit mode</text>
<text x="370" y="112" text-anchor="middle" class="d-small">measure impact</text>
<rect x="453" y="60" width="126" height="70" rx="10" class="d-box-accent"/>
<text x="516" y="90" text-anchor="middle" class="d-title">Enforce</text>
<text x="516" y="112" text-anchor="middle" class="d-small">deny or remediate</text>
<rect x="599" y="60" width="126" height="70" rx="10" class="d-box-info"/>
<text x="662" y="90" text-anchor="middle" class="d-title">Evidence</text>
<text x="662" y="112" text-anchor="middle" class="d-small">continuous report</text>
<line x1="141" y1="95" x2="159" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="287" y1="95" x2="305" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="433" y1="95" x2="451" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="579" y1="95" x2="597" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<path d="M662,130 L662,180 L78,180 L78,132" fill="none" class="d-line-dashed" marker-end="url(#gov-d4-arrow)"/>
<text x="370" y="205" text-anchor="middle" class="d-small">findings and expiring exceptions feed the next version</text>
</svg>
</div>
<figcaption>Figure 4: A policy goes through audit before enforcement, and its results feed its own evolution</figcaption>
</figure>

1. **Author:** the policy is written as code, with a link to the ADR or the requirement that justifies it, and reviewed in a pull request by platform, security and at least one product team.
2. **Test:** unit tests with compliant and non-compliant examples, run in CI. Yes, policies have bugs too.
3. **Audit mode:** the policy is deployed only to report. For a few weeks, you measure how many resources would be blocked and talk to the owners. It's common to discover the rule was too broad.
4. **Enforce:** only then does it move to *deny* (or to automatic remediation, when that's safe). The teams were warned, the migration path is documented, and the paved road modules already comply.
5. **Evidence:** the compliance state is collected continuously and becomes a dashboard and a report, which closes the loop.

## Exceptions With an Expiry Date

No matter how good your policies are, there will be legitimate cases that don't fit: a legacy system that can't be migrated this quarter, a vendor product that requires a public endpoint, a proof of concept with a hard deadline. Pretending that exceptions don't exist is how you end up with the "temporary" admin account from 2019.

The answer is an **exception process**, as formal and as automated as the policies themselves:

- **Requested in writing**, with the justification, the risk accepted and the compensating controls (for example, "public endpoint, but behind a WAF with IP allowlist");
- **Approved by the accountable role**, as defined in the RACI (usually security for security policies, not the requester's own manager);
- **Scoped as narrowly as possible:** one resource, not the whole subscription;
- **With a mandatory expiry date.** Azure Policy exemptions have an `expiresOn` field; with SCPs and OPA you can model the same in code. When the date comes, the exception disappears by itself, and renewing it requires a new justification;
- **Visible:** all active exceptions in one place, with owners and expiry dates, reviewed periodically.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wouldn't it be easier to just ask the admin to disable the policy for a bit, do the deploy and turn it back on?"</span>
    </div>
  </div>
</div>

It would be easier, Junior, just like it's easier to remove the smoke detector because it goes off when you make toast. The problem is that "turn it back on later" is a sentence with a very low completion rate. And while it's off, it's off for **everyone**, not just for you. A scoped exception with an expiry date gives you exactly what you need, for the time you need it, and leaves a trail explaining why.

<div class="callout tip">
  <p>Watch the exception list as a signal. If the same policy accumulates many exceptions, the problem is probably the policy (too broad, or with no viable paved road alternative), not the teams. Exceptions are feedback, not just paperwork.</p>
</div>

## Compliance Automation and Continuous Evidence

Remember the panic the week before the audit? That happens because evidence is collected **manually and periodically**: screenshots, exported spreadsheets, emails asking "can you confirm that encryption is enabled?". It's slow, error-prone and, worst of all, it only proves that things were fine **on the day the screenshot was taken**.

Continuous compliance flips this around:

- **Controls are mapped to policies.** Each requirement of the framework you follow (ISO 27001, SOC 2, PCI DSS, LGPD, internal standards) points to one or more automated policies. Azure Policy and AWS Security Hub already ship built-in initiatives mapped to several of these frameworks;
- **The state is collected all the time.** The detective layer evaluates every resource continuously, and the result is stored with timestamps;
- **Evidence is a query, not a project.** When the auditor asks, you show the compliance history for the period, the exceptions with their approvals and the ADRs behind the rules;
- **Changes are traceable.** Since policies and infrastructure are in Git, "who changed this rule, when and why" is answered by the commit history and the pull request.

This doesn't remove the auditor, and it doesn't cover everything (processes like access reviews or training still need human evidence). But it turns the audit from an archaeological excavation into a conversation about data. For the risk side of this conversation (appetite, registers, treatment), see [Risk Management](/en-us/principles/enterprise/risk-management/).

## Measuring Governance

If you can't measure governance, you can't tell whether it's helping or just getting in the way. And be careful: measuring only compliance encourages the committee that blocks everything (100% compliance, 0% delivery). You need metrics for **both** sides, control and flow.

| Metric | What it tells you | Watch out for |
| :--- | :--- | :--- |
| **Compliance rate** (compliant resources / evaluated resources, per policy) | How well the rules are being followed in practice. | A high rate with few policies can mean you're measuring the wrong things. |
| **Time to approval** (request to decision, for ADRs, exceptions, new accounts) | Whether governance is a road or a queue. | Median hides the long tail; look at the 90th percentile too. |
| **Paved road adoption** (% of workloads using the official modules and templates) | Whether the easy path is really the easy path. | Low adoption is a product problem for the platform team. |
| **Active exceptions and their age** | How much risk has been accepted, and whether it's being paid down. | Exceptions renewed over and over are permanent exceptions in disguise. |
| **Time to remediate findings** | How fast drift is corrected once detected. | Split by severity; critical and low shouldn't share a target. |
| **Decisions escalated to the forum per month** | Whether decision rights are well distributed. | Too many means teams lack autonomy; zero may mean nobody asks. |

<div class="callout info">
  <p>A good north star for governance: <strong>time to compliant production</strong>. How long does it take a new team, starting from nothing, to have a service running in production that already meets every policy? In organizations with good paved roads, that's measured in hours or days. In the monthly committee story, it was measured in quarters.</p>
</div>

## Design Principles for Governance

Putting it all together, these are the practices that make governance an accelerator instead of a brake.

### 1. Encode rules, don't just publish them

**Goal:** every governance rule that can be checked by a machine is checked by a machine.

| Approach | Benefit |
| :--- | :--- |
| **Write policies as code, versioned and reviewed in Git.** | Rules become testable, traceable and auditable, with a history of who changed what and why. |
| **Enforce at more than one layer** (pipeline, control plane, detective). | Fast feedback for developers, no bypass through the portal, and drift caught after the fact. |
| **Roll out in audit mode before deny.** | You find out the real impact before breaking anyone, and the teams have time to adapt. |

### 2. Make the compliant path the easiest path

**Goal:** teams comply because it's the least effort, not because they're afraid.

| Approach | Benefit |
| :--- | :--- |
| **Offer paved roads (modules, templates, landing zones) that are compliant by default.** | Most workloads never need a review, and compliance comes for free. |
| **Automate account and environment provisioning.** | Removes one of the most common hidden gates and the temptation to use personal accounts. |
| **Treat the platform as a product, with feedback from its users.** | Paved roads stay current and genuinely better than the alternatives. |

### 3. Push decisions to where the information is

**Goal:** decisions are made at the lowest level that has enough context and accountability.

| Approach | Benefit |
| :--- | :--- |
| **Classify decisions by blast radius and reversibility.** | Only one-way doors get heavy deliberation; everything else is fast. |
| **Make decision rights explicit with RACI, one "A" per activity.** | No more "I thought you were deciding that". |
| **Replace the approval board with an advice forum, asynchronous and timeboxed.** | Keeps expert input without creating a queue. |

### 4. Write decisions down

**Goal:** the organization remembers why it did what it did.

| Approach | Benefit |
| :--- | :--- |
| **Record significant decisions as ADRs in the repository.** | Context survives team turnover, and new people understand the system faster. |
| **Link policies to the ADRs that motivated them.** | Anyone blocked by a rule can find the reason and challenge it properly. |
| **Supersede, don't edit.** | The history of decisions becomes a learning tool. |

### 5. Treat exceptions as first-class citizens

**Goal:** deviations are allowed, visible, limited and temporary.

| Approach | Benefit |
| :--- | :--- |
| **Require justification, compensating controls and an expiry date.** | Accepted risk is conscious and has an end. |
| **Keep exceptions in code, next to the policies.** | Auditable and reviewed like any other change. |
| **Review exception trends periodically.** | Recurring exceptions reveal policies that need to change. |

### 6. Measure both control and flow

**Goal:** governance is judged by what it protects **and** by what it enables.

| Approach | Benefit |
| :--- | :--- |
| **Track compliance rate and time to approval together.** | Avoids optimizing one at the expense of the other. |
| **Collect evidence continuously.** | Audits become routine, and problems are found in days, not at the next annual review. |
| **Revisit policies that nobody has triggered in a year.** | Keeps the rule set lean; dead rules are noise. |

## Tradeoffs

Governance is, at its core, a balance between two things the organization wants at the same time: **control** (consistency, safety, compliance) and **autonomy** (speed, innovation, ownership). There's no setting that maximizes both. Every rule you add buys some control with some autonomy, and the architect's job is to make that trade on purpose.

### Control vs autonomy

Too much control and you get the monthly committee: teams stop proposing, start bypassing, and the best engineers leave for places where they can decide things. Too much autonomy and you get fragmentation: every team with its own stack, no shared learning, duplicated effort and inconsistent security. The guardrail model tries to get the best of both by being **strict about outcomes** (data must be encrypted, internal services must not be public) and **flexible about means** (use whatever language or framework you want, inside the road).

### Speed vs compliance

Every check has a cost in time, even automated ones. A pipeline with twenty policy scanners that takes forty minutes is also a gate, just a robotic one. Keep policy checks fast, put the cheap ones first, and don't block the build for low severity findings that can be tracked instead.

### Tradeoffs with Operational Excellence

Policies and landing zones are more infrastructure to maintain: code, tests, pipelines, versions, documentation. The platform team becomes a dependency, and if it's understaffed, the paved road rots and turns into a bottleneck. On the other hand, governance done well **reduces** operational variance, which is exactly what [Operational Excellence](/en-us/principles/cloud/operational-excellence/) is after.

### Tradeoffs with Reliability

A *deny* policy with a bug can block legitimate deployments, including emergency fixes during an incident. Automatic remediation can change resources in production in ways nobody expected. Mitigate this with audit mode, gradual rollouts of policies (one management group at a time), and a documented, fast break-glass procedure that is itself audited.

### Tradeoffs with Security

Governance is one of security's best allies, but it can create a false sense of safety: "we have 100% compliance" only means you comply with the rules you wrote. Also, the permissions needed to manage policies and exceptions are extremely powerful and must be protected like any other privileged access. For the controls themselves, see [Security](/en-us/principles/cloud/security/) and [Security Shift Left](/en-us/principles/solution/security-shift-left/).

### Tradeoffs with Cost Optimization

Landing zones come with shared components (hub networks, firewalls, centralized logging, security tooling) that cost money even before the first workload lands. Continuous compliance means continuous evaluation and log retention. It's usually cheaper than an incident or a failed audit, but it's not free, and small organizations should size the foundation to their reality instead of copying an enterprise-scale blueprint.

### Tradeoffs with Performance Efficiency

Some rules have a direct performance cost: forcing traffic through a central firewall adds latency; restricting regions can put data far from users; mandatory encryption with customer-managed keys adds calls to the key vault. These are often the right choices, but they should be made knowingly, with the numbers on the table.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So there's no perfect amount of governance? How do I know if we have too much or too little?"</span>
    </div>
  </div>
</div>

Exactly, Junior, there's no perfect amount, and it changes as the company grows. Look at the signals: if teams are going around the process, if approvals take weeks and the exception list only grows, you have too much (or the wrong kind). If every incident review ends with "each team did it differently" and nobody can answer the auditor, you have too little. The metrics from the previous section exist precisely to show you which side you're leaning toward, and ADRs let you adjust the course without forgetting why you got here.

## Conclusion

**Governance** isn't the committee that says no. It's the set of mechanisms that lets an organization make good decisions consistently, remember them, and apply them automatically at the scale of dozens or hundreds of teams. When it works, most people barely notice it: they use the paved road, the policies silently keep them out of trouble, and the rare hard decision gets expert advice in days, not months.

The shift is from **gates to guardrails**: from people reading documents once a month to policies evaluating every change in seconds; from permission to advice; from verbal decisions to ADRs; from permanent exceptions to exceptions with an expiry date; from panicked audits to continuous evidence.

And like every other principle, governance doesn't eliminate tradeoffs. Control and autonomy, speed and compliance, will always pull in opposite directions. Good governance makes that tension explicit, measures it, and adjusts it over time, in line with what the business actually needs (see [Business Alignment](/en-us/principles/enterprise/business-alignment/)).

## Next Steps

1. **Map your decision rights**
List the recurring architecture decisions and classify them by blast radius and reversibility. Build a RACI with one accountable role per activity, and push everything you can to the teams.

2. **Start writing ADRs**
Pick a template, create a folder in the repositories and record the next significant decision. Don't try to document the past all at once; start now and backfill only the decisions people keep asking about.

3. **Encode your top five rules**
Choose the rules that matter most (allowed regions, encryption, no public data stores, mandatory tags, logging) and turn them into policies. Roll them out in audit mode, measure, talk to the owners, then enforce.

4. **Build the foundation**
Organize the hierarchy of management groups, OUs or folders by governance needs, create a sandbox, and automate account provisioning with landing zones that are compliant by default.

5. **Formalize exceptions**
Create a lightweight, written process with justification, compensating controls, approval by the accountable role and a mandatory expiry date. Make the list of active exceptions visible.

6. **Transform the review board**
Move it to asynchronous, timeboxed advice, only for one-way doors, and make it feed the paved road so the same question never needs to be asked twice.

7. **Measure control and flow**
Track compliance rate, time to approval, paved road adoption and exception age together, and review them regularly with the teams.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/govern/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework: Govern</a></li>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework: Azure landing zones</a></li>
    <li><a href="https://learn.microsoft.com/azure/governance/policy/overview" target="_blank" rel="noopener">Azure Policy overview</a></li>
    <li><a href="https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html" target="_blank" rel="noopener">AWS Organizations: Service control policies</a></li>
    <li><a href="https://aws.amazon.com/controltower/" target="_blank" rel="noopener">AWS Control Tower</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://www.openpolicyagent.org/" target="_blank" rel="noopener">Open Policy Agent (OPA)</a></li>
    <li><a href="https://open-policy-agent.github.io/gatekeeper/" target="_blank" rel="noopener">OPA Gatekeeper</a></li>
    <li><a href="https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions" target="_blank" rel="noopener">Michael Nygard: Documenting Architecture Decisions</a></li>
    <li><a href="https://adr.github.io/" target="_blank" rel="noopener">Architecture Decision Records (adr.github.io)</a></li>
    <li><a href="https://martinfowler.com/articles/scaling-architecture-conversationally.html" target="_blank" rel="noopener">Andrew Harmel-Law: Scaling the Practice of Architecture, Conversationally</a></li>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">The Open Group: TOGAF Standard</a></li>
  </ul>
</div>
