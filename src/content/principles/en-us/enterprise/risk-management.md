---
title: Risk Management
short: Every architecture carries risk. The real question is whether anyone knows which ones, and who agreed to carry them.
category: enterprise
---

## Introduction

Every system you have ever worked on carries risk. The framework that will stop receiving patches next year, the database only one person knows how to tune, the cloud service your whole platform depends on, the customer data sitting in a table nobody remembers creating. None of that is a problem *today*. That's exactly what makes it dangerous.

Technology **Risk Management** at the enterprise level has a simple **goal**: make sure the organization **knows which technical risks it is carrying, decides consciously what to do about each one, and finds out early when a risk is about to turn into an incident**. It's not about eliminating risk (that's impossible and, as we'll see, not even desirable). It's about replacing surprise with decision.

When an organization ignores this principle, the symptoms are painfully familiar:

- Critical systems running on versions that went out of support years ago, and nobody can say exactly which ones;
- "Heroic" incidents where the whole company discovers, at 2 a.m., a dependency no one had mapped;
- Architecture decisions made in a meeting, with no record of what was traded off or why;
- Leadership that only hears about technical risk when it has already become a cost, a fine or a headline;
- Knowledge concentrated in one or two people, with no plan for when they go on vacation (or leave for good);
- Audits and compliance reviews (LGPD, GDPR, SOC 2, PCI) that turn into a month of panic and spreadsheets;

Yep, *it's rare, but it happens all the time*... Who hasn't inherited a system where the documentation was a README saying "don't touch the cron job"?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But if nothing has broken so far, why worry? Isn't this just pessimism with a spreadsheet?"</span>
    </div>
  </div>
</div>

Easy there, Junior! "Nothing has broken so far" is the most expensive sentence in technology. A risk is, by definition, something that *hasn't happened yet*. The fact that the old payment gateway integration has survived five years doesn't mean it's safe; it means you've been lucky for five years, and luck is not an architecture strategy.

Risk management isn't pessimism. Pessimism says "everything will go wrong". Risk management says "these three things could go wrong, this is how likely they are, this is what they would cost us, and this is what we decided to do about each one". One is anxiety. The other is engineering.

<div class="callout info">
  <p>Risk management doesn't require a dedicated department or expensive GRC software to get started. It starts with a shared, living list of what could hurt the business, who owns each item and what was decided about it. The tooling can come later; the <strong>visibility</strong> can't wait.</p>
</div>

## Where Technical Risk Hides

Before you can manage a risk, you have to see it. And technical risk loves to hide in places that look perfectly normal on a day-to-day basis. These are the usual suspects at the enterprise level:

### 1. Technical debt

Every shortcut taken to hit a deadline is a loan. Sometimes it's a great loan (shipping early and learning from real users is worth a lot), but loans charge interest. Debt that nobody tracks keeps compounding until simple changes take weeks and every release feels like defusing a bomb. We'll come back to this one, because it deserves its own section.

### 2. End-of-life technology

Operating systems, runtimes, frameworks, databases, libraries: all of them have a support lifecycle. Once a version reaches end of life (EOL), security patches stop, bug fixes stop, and slowly the ecosystem moves on. Sites like [endoflife.date](https://endoflife.date) make this easy to track, and yet it's one of the most common risks you'll find in any portfolio. It connects directly to [Portfolio Rationalization](/en-us/principles/enterprise/portfolio-rationalization/), because you can't manage the lifecycle of systems you haven't inventoried.

### 3. Vendor lock-in and concentration risk

Depending on a vendor isn't a sin; building everything yourself would be much worse. The risk is depending on a vendor **without knowing how much**. What happens if prices double at renewal? If the product is discontinued? If the provider has a regional outage? **Concentration risk** is the enterprise version of the same idea: when a single provider, region, data center, library or team supports a large share of your critical capabilities, a single failure becomes a company-wide failure.

### 4. Key-person dependency (hello again, Oracle)

In [Operational Excellence](/en-us/principles/cloud/operational-excellence/) we met the **Oracle**: the person who holds all the essential knowledge, access and permissions, and without whom the operation stops. At the enterprise level, the Oracle stops being a team problem and becomes a **business continuity risk**. If a single person leaving would halt billing, payroll or a regulatory report, that belongs in the risk register, with an owner and a mitigation plan, not in hallway jokes.

### 5. Security

Unpatched systems, excessive permissions, secrets in repositories, exposed endpoints. Security risk is huge and specialized, so the operational details live in the [Security](/en-us/principles/cloud/security/) and [Security Shift-Left](/en-us/principles/solution/security-shift-left/) principles. From a risk management perspective, what matters is that security risks are **registered, scored and visible** next to all the others, so leadership can compare them and fund their treatment.

### 6. Compliance and privacy (LGPD, GDPR and friends)

Personal data processed without a legal basis, retained forever "just in case", replicated to environments nobody controls. Regulations such as Brazil's **LGPD** and Europe's **GDPR** turn these into financial and reputational risks, with fines that can reach a meaningful percentage of revenue. Compliance risk is also the category most likely to be invisible to engineering, because it often stems from decisions that seemed purely technical at the time ("let's copy the production database to QA").

### 7. Capacity and scalability

The system handles today's load just fine. Does it handle Black Friday? The new client that triples the volume? The marketing campaign nobody told engineering about? Capacity risk is the gap between what the architecture supports and what the business is planning to do, and it's why risk management has to stay connected to [Business Alignment](/en-us/principles/enterprise/business-alignment/).

| Risk category | Typical warning sign |
| :--- | :--- |
| **Technical debt** | Simple changes estimated in weeks; the same area causes repeated incidents. |
| **End-of-life technology** | "We can't upgrade because it would break X"; vendor support contract expired. |
| **Vendor lock-in / concentration** | No exit plan; one provider or region behind most critical systems. |
| **Key-person dependency** | Tasks that wait for a specific person's vacation to end. |
| **Security** | Findings open for months; unknown or unmanaged assets. |
| **Compliance / privacy** | Nobody can say where personal data lives or how long it's kept. |
| **Capacity** | Business growth plans that engineering hears about last. |

## The Risk Register

Once you start seeing risks, you need somewhere to put them. That place is the **risk register**: a single, shared list of the technical risks the organization is carrying. It sounds bureaucratic, but it's the difference between "I think there's something off with the legacy ERP" and "Risk R-07, owned by the Finance Systems lead, scored 16, mitigation due in Q2".

A good register doesn't need to be sophisticated. A spreadsheet, a wiki page or a board in your work tracker is enough, as long as it's **alive** (reviewed regularly) and **owned** (every item has a name next to it). The essential fields are:

| Field | Why it matters |
| :--- | :--- |
| **ID and description** | A clear statement: cause, event and consequence ("Because X, Y may happen, causing Z"). |
| **Category** | Groups related risks (debt, EOL, vendor, people, security, compliance, capacity). |
| **Likelihood and impact** | Scored on a simple scale (1 to 5) to allow comparison. |
| **Score** | Likelihood x impact, used to prioritize. |
| **Owner** | A person, not a team. Someone who answers for the risk. |
| **Treatment** | Avoid, mitigate, transfer or accept, and the concrete actions. |
| **Indicators (KRIs)** | What we watch to know the risk is getting closer. |
| **Review date** | When we look at it again. Risks change; the register must follow. |

Here's what a few rows might look like:

| ID | Risk | L | I | Score | Owner | Treatment |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| R-03 | Billing runs on a framework out of support since 2022; a vulnerability would have no patch. | 4 | 4 | 16 | Billing tech lead | Mitigate: migration funded for Q2, WAF rules meanwhile. |
| R-07 | Only one engineer can operate the tax reporting pipeline. | 3 | 4 | 12 | Finance systems manager | Mitigate: pairing, runbook, second on-call by March. |
| R-11 | Card data vault hosted by a single provider. | 2 | 4 | 8 | Platform architect | Transfer: contractual SLA and PCI-certified provider. |
| R-15 | Internal reporting tool on an old but isolated runtime. | 2 | 2 | 4 | BI lead | Accept: no external exposure, review in 6 months. |

<div class="callout tip">
  <p>Write each risk as <strong>cause, event, consequence</strong>. "Old framework" isn't a risk, it's a fact. "Because billing runs on an unsupported framework, a new vulnerability could go unpatched, exposing customer data and triggering LGPD penalties" is a risk: anyone reading it understands why it matters.</p>
</div>

## Likelihood x Impact: the Heat Map

A register with forty items and no priority is just a list of worries. To decide where to spend time and money, you need to **compare** risks, and the classic tool for that is the **likelihood x impact matrix**, better known as the heat map.

The idea is simple: score each risk from 1 to 5 on how likely it is to happen (in a given horizon, say the next 12 months) and on how bad it would be if it did. Multiply the two and you get a score from 1 to 25. Then place each risk on the grid.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 425" role="img" aria-labelledby="risk-d1-title risk-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="risk-d1-title">Likelihood x impact heat map</title>
<desc id="risk-d1-desc">A five by five grid with impact on the horizontal axis and likelihood on the vertical axis. Cells are colored from low to critical by score, and six example risks are placed on it: tech debt and an end-of-life stack in the critical zone, key person and data leak in the high zone, and cert expiry and lock-in in the medium zone.</desc>
<rect x="170" y="50" width="100" height="56" rx="10" class="d-box-info"/>
<text x="220" y="84" text-anchor="middle" class="d-small">5</text>
<rect x="270" y="50" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="320" y="84" text-anchor="middle" class="d-small">10</text>
<rect x="370" y="50" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="420" y="72" text-anchor="middle" class="d-small">15</text>
<text x="420" y="92" text-anchor="middle" class="d-text">Tech debt</text>
<rect x="470" y="50" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="520" y="84" text-anchor="middle" class="d-small">20</text>
<rect x="570" y="50" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="620" y="84" text-anchor="middle" class="d-small">25</text>
<rect x="170" y="106" width="100" height="56" rx="10" class="d-box-info"/>
<text x="220" y="140" text-anchor="middle" class="d-small">4</text>
<rect x="270" y="106" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="320" y="140" text-anchor="middle" class="d-small">8</text>
<rect x="370" y="106" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="420" y="140" text-anchor="middle" class="d-small">12</text>
<rect x="470" y="106" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="520" y="128" text-anchor="middle" class="d-small">16</text>
<text x="520" y="148" text-anchor="middle" class="d-text">EOL stack</text>
<rect x="570" y="106" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="620" y="140" text-anchor="middle" class="d-small">20</text>
<rect x="170" y="162" width="100" height="56" rx="10" class="d-box-accent"/>
<text x="220" y="196" text-anchor="middle" class="d-small">3</text>
<rect x="270" y="162" width="100" height="56" rx="10" class="d-box-info"/>
<text x="320" y="184" text-anchor="middle" class="d-small">6</text>
<text x="320" y="204" text-anchor="middle" class="d-text">Cert expiry</text>
<rect x="370" y="162" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="420" y="196" text-anchor="middle" class="d-small">9</text>
<rect x="470" y="162" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="520" y="184" text-anchor="middle" class="d-small">12</text>
<text x="520" y="204" text-anchor="middle" class="d-text">Key person</text>
<rect x="570" y="162" width="100" height="56" rx="10" class="d-box-danger"/>
<text x="620" y="196" text-anchor="middle" class="d-small">15</text>
<rect x="170" y="218" width="100" height="56" rx="10" class="d-box-accent"/>
<text x="220" y="252" text-anchor="middle" class="d-small">2</text>
<rect x="270" y="218" width="100" height="56" rx="10" class="d-box-info"/>
<text x="320" y="252" text-anchor="middle" class="d-small">4</text>
<rect x="370" y="218" width="100" height="56" rx="10" class="d-box-info"/>
<text x="420" y="240" text-anchor="middle" class="d-small">6</text>
<text x="420" y="260" text-anchor="middle" class="d-text">Lock-in</text>
<rect x="470" y="218" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="520" y="252" text-anchor="middle" class="d-small">8</text>
<rect x="570" y="218" width="100" height="56" rx="10" class="d-box-warn"/>
<text x="620" y="240" text-anchor="middle" class="d-small">10</text>
<text x="620" y="260" text-anchor="middle" class="d-text">Data leak</text>
<rect x="170" y="274" width="100" height="56" rx="10" class="d-box-accent"/>
<text x="220" y="308" text-anchor="middle" class="d-small">1</text>
<rect x="270" y="274" width="100" height="56" rx="10" class="d-box-accent"/>
<text x="320" y="308" text-anchor="middle" class="d-small">2</text>
<rect x="370" y="274" width="100" height="56" rx="10" class="d-box-accent"/>
<text x="420" y="308" text-anchor="middle" class="d-small">3</text>
<rect x="470" y="274" width="100" height="56" rx="10" class="d-box-info"/>
<text x="520" y="308" text-anchor="middle" class="d-small">4</text>
<rect x="570" y="274" width="100" height="56" rx="10" class="d-box-info"/>
<text x="620" y="308" text-anchor="middle" class="d-small">5</text>
<text x="160" y="82" text-anchor="end" class="d-small">Almost certain</text>
<text x="160" y="138" text-anchor="end" class="d-small">Likely</text>
<text x="160" y="194" text-anchor="end" class="d-small">Possible</text>
<text x="160" y="250" text-anchor="end" class="d-small">Unlikely</text>
<text x="160" y="306" text-anchor="end" class="d-small">Rare</text>
<text x="220" y="350" text-anchor="middle" class="d-small">Minimal</text>
<text x="320" y="350" text-anchor="middle" class="d-small">Minor</text>
<text x="420" y="350" text-anchor="middle" class="d-small">Moderate</text>
<text x="520" y="350" text-anchor="middle" class="d-small">Major</text>
<text x="620" y="350" text-anchor="middle" class="d-small">Severe</text>
<text x="420" y="374" text-anchor="middle" class="d-label">IMPACT</text>
<text x="30" y="190" text-anchor="middle" class="d-label" transform="rotate(-90 30 190)">LIKELIHOOD</text>
<rect x="170" y="394" width="16" height="16" rx="4" class="d-box-accent"/>
<text x="194" y="407" class="d-small">Low (1-3)</text>
<rect x="300" y="394" width="16" height="16" rx="4" class="d-box-info"/>
<text x="324" y="407" class="d-small">Medium (4-6)</text>
<rect x="430" y="394" width="16" height="16" rx="4" class="d-box-warn"/>
<text x="454" y="407" class="d-small">High (8-12)</text>
<rect x="560" y="394" width="16" height="16" rx="4" class="d-box-danger"/>
<text x="584" y="407" class="d-small">Critical (15+)</text>
</svg>
</div>
<figcaption>Figure 1: A likelihood x impact heat map with example technology risks</figcaption>
</figure>

A few practical tips so the matrix doesn't become theater:

- **Define the scales in business terms.** "Severe impact" should mean something concrete: revenue loss above a threshold, a regulatory fine, a multi-day outage of a critical capability, data exposure. Otherwise each person scores by gut feeling.
- **Score as a group.** Architects, product, operations and security scoring together produce far better estimates than one person alone, and they create shared ownership of the result.
- **Don't fake precision.** The goal isn't to discover that a risk is a 13.7. It's to separate the handful of items in the red zone from the long tail in the green.
- **Watch the "low likelihood, catastrophic impact" corner.** A total loss of the primary region, a ransomware attack, a supplier going bankrupt. These rarely score high by multiplication, but they deserve a specific response (usually tested continuity plans, see [Reliability](/en-us/principles/cloud/reliability/)).

## Risk Appetite and Tolerance

Now the uncomfortable question: which of these risks are **acceptable**? That's not a question engineering can answer alone, because it depends on how much risk the business is willing to take in pursuit of its goals. This is the **risk appetite**.

- **Risk appetite** is the amount and type of risk the organization is willing to pursue or retain. A startup racing for market share has a big appetite for technical debt and a small appetite for losing speed. A bank has almost zero appetite for data exposure and will gladly trade speed for control.
- **Risk tolerance** is the acceptable variation around that appetite, usually expressed as thresholds: "no critical system may run on unsupported software for more than 6 months", "no single vendor may support more than 40% of revenue-generating capabilities", "no personal data may leave the production perimeter".

Appetite gives direction; tolerance gives lines you can actually check. In the heat map, tolerance becomes the boundary between zones: anything in the red must be treated now, orange needs a plan and a date, green can be accepted and monitored.

<div class="callout warning">
  <p>If nobody ever defined the risk appetite, it still exists: it's just set by whoever is under the most deadline pressure that week. Undefined appetite almost always means <strong>accidentally huge</strong> appetite.</p>
</div>

Defining appetite is a job for leadership, supported by architecture. It belongs in [Governance](/en-us/principles/enterprise/governance/), next to the other policies the organization uses to steer technology decisions.

## Treatment Strategies

With risks scored and appetite defined, every risk above tolerance needs a treatment. There are four classic strategies, and every one of them is legitimate in the right context:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="risk-d3-title risk-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="risk-d3-title">The four risk treatment strategies</title>
<desc id="risk-d3-desc">An assessed risk branches into four possible treatments: avoid by dropping the activity, mitigate by reducing likelihood or impact, transfer through insurance, contracts or managed services, and accept with documentation, an owner and a review date.</desc>
<defs><marker id="risk-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="250" y="20" width="220" height="60" rx="10" class="d-box"/>
<text x="360" y="46" text-anchor="middle" class="d-title">Assessed risk</text>
<text x="360" y="66" text-anchor="middle" class="d-small">score vs. risk appetite</text>
<line x1="360" y1="80" x2="360" y2="115" class="d-line"/>
<line x1="105" y1="115" x2="615" y2="115" class="d-line"/>
<line x1="105" y1="115" x2="105" y2="148" class="d-line" marker-end="url(#risk-d3-arrow)"/>
<line x1="275" y1="115" x2="275" y2="148" class="d-line" marker-end="url(#risk-d3-arrow)"/>
<line x1="445" y1="115" x2="445" y2="148" class="d-line" marker-end="url(#risk-d3-arrow)"/>
<line x1="615" y1="115" x2="615" y2="148" class="d-line" marker-end="url(#risk-d3-arrow)"/>
<rect x="30" y="150" width="150" height="100" rx="10" class="d-box-danger"/>
<text x="105" y="185" text-anchor="middle" class="d-title">Avoid</text>
<text x="105" y="210" text-anchor="middle" class="d-small">drop the activity</text>
<text x="105" y="228" text-anchor="middle" class="d-small">or the technology</text>
<rect x="200" y="150" width="150" height="100" rx="10" class="d-box-accent"/>
<text x="275" y="185" text-anchor="middle" class="d-title">Mitigate</text>
<text x="275" y="210" text-anchor="middle" class="d-small">reduce likelihood</text>
<text x="275" y="228" text-anchor="middle" class="d-small">or impact</text>
<rect x="370" y="150" width="150" height="100" rx="10" class="d-box-info"/>
<text x="445" y="185" text-anchor="middle" class="d-title">Transfer</text>
<text x="445" y="210" text-anchor="middle" class="d-small">insurance, SLAs,</text>
<text x="445" y="228" text-anchor="middle" class="d-small">managed services</text>
<rect x="540" y="150" width="150" height="100" rx="10" class="d-box-warn"/>
<text x="615" y="185" text-anchor="middle" class="d-title">Accept</text>
<text x="615" y="210" text-anchor="middle" class="d-small">document, owner,</text>
<text x="615" y="228" text-anchor="middle" class="d-small">review date</text>
</svg>
</div>
<figcaption>Figure 2: Every risk above tolerance gets one of four treatments</figcaption>
</figure>

### 1. Avoid

**Goal:** Eliminate the risk by not doing the thing that causes it.

Don't store the credit card number if a tokenization provider can do it for you. Don't adopt the exotic database that only one contractor knows. Don't expose the internal admin API to the internet. Avoidance is the most effective treatment, but it usually means giving up something (a feature, a shortcut, a technology you liked).

**Benefit:** the risk simply disappears from the register, along with every control you would have needed to manage it.

### 2. Mitigate

**Goal:** Reduce the likelihood, the impact, or both, until the risk fits inside the tolerance.

This is where most technical work lives: migrating off the EOL framework, adding a second region, writing the runbook and training a second person, introducing automated dependency updates, adding encryption and access controls. Mitigation always has a cost, so it should be proportional to the score.

**Benefit:** the organization keeps the value of the activity while bringing the exposure down to an agreed level.

### 3. Transfer

**Goal:** Move part of the consequences to a third party better equipped to carry them.

Cyber insurance, contractual SLAs with penalties, managed services where the provider operates and patches the platform. Watch out: you can transfer the **financial** impact, but rarely the **reputational** or **regulatory** one. Under LGPD and GDPR, if your provider leaks your customers' data, it's still your customers and your name in the news.

**Benefit:** specialized providers often handle certain risks better and cheaper than you could, and contracts make the split of responsibilities explicit.

### 4. Accept

**Goal:** Consciously retain the risk because treating it would cost more than it's worth.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Happy junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Oh, I love this one! So accepting a risk just means we ignore it and move on, right? Easiest strategy ever!"</span>
    </div>
  </div>
</div>

Not so fast, Junior! Accepting and ignoring look the same from the outside, but they are opposites. **Ignoring** is not knowing, or pretending not to know. **Accepting** is a decision made by someone with the authority to make it, recorded in writing, with an owner, the reasoning, the indicators being watched and a date to look at it again. An accepted risk is still in the register. An ignored risk is a surprise waiting for a date.

**Benefit:** the organization stops spending on risks that don't justify it and frees budget for the ones that do, with a clear trail of who decided what.

| Approach | Benefit |
| :--- | :--- |
| **Match the treatment to the score.** Red-zone risks get funded action; green-zone risks can be accepted and monitored. | Effort goes where the exposure is, instead of where the loudest person is. |
| **Combine strategies.** Mitigate part, transfer part, accept the residual. | Treatment rarely takes a risk to zero; combining strategies brings it inside tolerance at a lower cost. |
| **Always record the residual risk.** Score the risk again after treatment. | Everyone knows what exposure remains, and nobody assumes a partial fix solved everything. |
| **Put a date on every acceptance.** Six or twelve months, then review. | Context changes (a system becomes critical, a regulation arrives), and yesterday's acceptable risk may not be acceptable today. |

## Technical Debt: a Risk That Charges Interest

Ward Cunningham's debt metaphor is famous for a reason: technical debt behaves like financial debt. You borrow time today (a shortcut, a skipped upgrade, a hardcoded integration) and pay **interest** on every future change that touches that area, in the form of slower delivery, more bugs and more incidents. Martin Fowler's [technical debt quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html) adds a useful distinction: debt can be deliberate or inadvertent, prudent or reckless. Deliberate, prudent debt ("we'll ship now and deal with the consequences") is a legitimate business decision. Reckless debt nobody knows about is pure risk.

From a risk management perspective, the key insight is that **unmanaged debt increases both likelihood and impact over time**. The older and more tangled it gets, the more likely something breaks, and the more expensive it is to fix when it does.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Thoughtful junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Fine, but can't we just do one big refactoring sprint later, when things calm down?"</span>
    </div>
  </div>
</div>

Ah, Junior, "when things calm down". I've been waiting for that moment my entire career, and I'm told my grandfather waited for it too. Things never calm down, because a successful product always has more demand than capacity. That's why debt has to be treated like any other risk: registered, scored and paid down continuously, with an agreed share of each cycle's capacity, instead of being saved for a mythical quiet quarter.

### The "we'll deal with it when it happens" story

Let me tell you a story that, with small variations, I've seen in more than one company.

A core system ran on a well-known web framework. The vendor announced the end of support for that major version, with a comfortable two-year window. The team estimated the migration at about three months. Leadership looked at the roadmap, full of revenue features, and decided: "It still works. We'll deal with it when it happens."

The end of support came and went. Nothing broke, so the decision seemed right. Then a vulnerability was published for that version, and there was no patch. The team built a workaround. Then the libraries the system depended on released new versions that no longer supported the old framework, so those stopped being updated too. Then hiring became harder, because nobody wanted to work on that stack. Every new feature took longer, because each one had to work around the growing pile of patches.

Four years after end of support, an external audit flagged the system as a critical finding. The migration that would have taken three months now took more than a year, had to happen under pressure, and consumed exactly the team that was supposed to be building the features the original decision was trying to protect.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 370" role="img" aria-labelledby="risk-d4-title risk-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="risk-d4-title">The cost of postponing an end-of-life migration</title>
<desc id="risk-d4-desc">A timeline over four years: end of life is announced with a three month migration estimate, support ends, an unpatched vulnerability appears, libraries stop supporting the old version, and an audit finding forces a rewrite. Below it, bars show the migration estimate growing from three months to more than fourteen months.</desc>
<defs><marker id="risk-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="24" text-anchor="middle" class="d-label">THE COST OF WAITING</text>
<line x1="40" y1="80" x2="690" y2="80" class="d-line" marker-end="url(#risk-d4-arrow)"/>
<text x="80" y="60" text-anchor="middle" class="d-label">YEAR -2</text>
<text x="220" y="60" text-anchor="middle" class="d-label">YEAR 0</text>
<text x="360" y="60" text-anchor="middle" class="d-label">YEAR 1</text>
<text x="500" y="60" text-anchor="middle" class="d-label">YEAR 2</text>
<text x="640" y="60" text-anchor="middle" class="d-label">YEAR 4</text>
<circle cx="80" cy="80" r="7" class="d-fill-accent"/>
<circle cx="220" cy="80" r="7" class="d-fill-info"/>
<circle cx="360" cy="80" r="7" class="d-fill-warn"/>
<circle cx="500" cy="80" r="7" class="d-fill-warn"/>
<circle cx="640" cy="80" r="7" class="d-fill-danger"/>
<text x="80" y="108" text-anchor="middle" class="d-text">EOL announced</text>
<text x="80" y="128" text-anchor="middle" class="d-small">"still works"</text>
<text x="220" y="108" text-anchor="middle" class="d-text">Support ends</text>
<text x="220" y="128" text-anchor="middle" class="d-small">no more fixes</text>
<text x="360" y="108" text-anchor="middle" class="d-text">CVE, no patch</text>
<text x="360" y="128" text-anchor="middle" class="d-small">workarounds pile up</text>
<text x="500" y="108" text-anchor="middle" class="d-text">Libs move on</text>
<text x="500" y="128" text-anchor="middle" class="d-small">hiring gets hard</text>
<text x="640" y="108" text-anchor="middle" class="d-text">Audit finding</text>
<text x="640" y="128" text-anchor="middle" class="d-small">forced rewrite</text>
<text x="360" y="180" text-anchor="middle" class="d-label">MIGRATION ESTIMATE</text>
<rect x="50" y="326" width="60" height="24" rx="6" class="d-fill-accent"/>
<text x="80" y="318" text-anchor="middle" class="d-small">3 months</text>
<rect x="190" y="310" width="60" height="40" rx="6" class="d-fill-info"/>
<text x="220" y="302" text-anchor="middle" class="d-small">5 months</text>
<rect x="330" y="286" width="60" height="64" rx="6" class="d-fill-warn"/>
<text x="360" y="278" text-anchor="middle" class="d-small">8 months</text>
<rect x="470" y="262" width="60" height="88" rx="6" class="d-fill-warn"/>
<text x="500" y="254" text-anchor="middle" class="d-small">11 months</text>
<rect x="610" y="238" width="60" height="112" rx="6" class="d-fill-danger"/>
<text x="640" y="230" text-anchor="middle" class="d-small">14+ months</text>
<line x1="30" y1="350" x2="690" y2="350" class="d-line"/>
</svg>
</div>
<figcaption>Figure 3: "We'll deal with it when it happens": the interest on a postponed migration</figcaption>
</figure>

The lesson isn't "never postpone". Sometimes postponing is the right call. The lesson is that the original decision was never really a decision: nobody recorded the accepted risk, nobody defined an indicator ("if a CVE without a patch appears, we migrate immediately"), nobody set a review date. The risk was ignored, not accepted, and the interest compounded silently.

## Early Warning: Key Risk Indicators

A register reviewed once a year is an archaeological record. To manage risk you need to know when a risk is **moving**, and that's the job of **Key Risk Indicators (KRIs)**: metrics that signal an increase in exposure before the incident happens.

KPIs tell you how well you're doing. KRIs tell you how close you are to trouble. Good KRIs are measurable, automated where possible and tied to a threshold that triggers action. Some examples for technology risk:

| KRI | Risk it signals | Example threshold |
| :--- | :--- | :--- |
| **% of critical systems on unsupported versions** | End-of-life technology | Above 5%, or any system unsupported for more than 6 months. |
| **Days until end of support** for key components | Upcoming EOL | Less than 12 months with no funded migration plan. |
| **Critical vulnerabilities open beyond SLA** | Security | Any critical finding older than 15 days. |
| **Number of people able to operate each critical system** | Key-person dependency | Fewer than 2 (the "bus factor"). |
| **Share of critical capabilities on a single vendor or region** | Concentration | Above the tolerance agreed in governance. |
| **Change failure rate and repeated incidents per component** | Technical debt | The same component in the top incident list for 3 months. |
| **Certificates and contracts expiring** | Operational and vendor risk | Anything expiring in 30 days without an owner acting on it. |
| **Personal data stores without a classified owner** | Compliance / privacy | Any. |

Notice how several of these come for free from things you should already have: an inventory from portfolio rationalization, a vulnerability scanner, deployment metrics from your pipelines, [observability](/en-us/principles/solution/observability-first/) data. The trick is to put them on the same page, next to the risks they represent.

## Making Risk Visible to Business Leadership

Here's a hard truth: a risk that only engineering understands doesn't get funded. Leadership decides where money goes, and leadership speaks the language of revenue, customers, regulation and reputation, not the language of frameworks and CVEs.

Translating is the architect's job. Compare:

- **Engineering language:** "Our billing service runs on an unsupported framework version with known CVEs and outdated transitive dependencies."
- **Business language:** "The system that collects 100% of our revenue can no longer receive security fixes. If it's breached, we face an LGPD notification, potential fines and a billing outage. Fixing it now costs one team for one quarter; fixing it after an incident costs much more and happens on the attacker's schedule."

Same risk. Only one of them gets a budget approved.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 340" role="img" aria-labelledby="risk-d2-title risk-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="risk-d2-title">The continuous risk management cycle</title>
<desc id="risk-d2-desc">A loop of five steps: identify, assess, treat, monitor and report, which leads back to identify. A risk register in the center is connected to the assess, monitor and report steps and holds everything the cycle produces.</desc>
<defs><marker id="risk-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="60" y="40" width="150" height="64" rx="10" class="d-box-info"/>
<text x="135" y="68" text-anchor="middle" class="d-title">Identify</text>
<text x="135" y="88" text-anchor="middle" class="d-small">tech, people, vendors</text>
<rect x="285" y="40" width="150" height="64" rx="10" class="d-box-info"/>
<text x="360" y="68" text-anchor="middle" class="d-title">Assess</text>
<text x="360" y="88" text-anchor="middle" class="d-small">likelihood x impact</text>
<rect x="510" y="40" width="150" height="64" rx="10" class="d-box-info"/>
<text x="585" y="68" text-anchor="middle" class="d-title">Treat</text>
<text x="585" y="88" text-anchor="middle" class="d-small">4 strategies</text>
<rect x="510" y="236" width="150" height="64" rx="10" class="d-box-info"/>
<text x="585" y="264" text-anchor="middle" class="d-title">Monitor</text>
<text x="585" y="284" text-anchor="middle" class="d-small">KRIs and thresholds</text>
<rect x="60" y="236" width="150" height="64" rx="10" class="d-box-info"/>
<text x="135" y="264" text-anchor="middle" class="d-title">Report</text>
<text x="135" y="284" text-anchor="middle" class="d-small">business language</text>
<rect x="285" y="140" width="150" height="60" rx="10" class="d-box-accent"/>
<text x="360" y="166" text-anchor="middle" class="d-title">Risk register</text>
<text x="360" y="186" text-anchor="middle" class="d-small">single source</text>
<line x1="210" y1="72" x2="283" y2="72" class="d-line" marker-end="url(#risk-d2-arrow)"/>
<line x1="435" y1="72" x2="508" y2="72" class="d-line" marker-end="url(#risk-d2-arrow)"/>
<line x1="585" y1="104" x2="585" y2="234" class="d-line" marker-end="url(#risk-d2-arrow)"/>
<line x1="510" y1="268" x2="212" y2="268" class="d-line" marker-end="url(#risk-d2-arrow)"/>
<line x1="135" y1="236" x2="135" y2="106" class="d-line" marker-end="url(#risk-d2-arrow)"/>
<line x1="360" y1="140" x2="360" y2="104" class="d-line-dashed"/>
<line x1="435" y1="190" x2="510" y2="245" class="d-line-dashed"/>
<line x1="285" y1="190" x2="210" y2="245" class="d-line-dashed"/>
<text x="360" y="326" text-anchor="middle" class="d-label">CONTINUOUS, NOT ANNUAL</text>
</svg>
</div>
<figcaption>Figure 4: Risk management is a loop around a living register</figcaption>
</figure>

Some practices that help risk reach the people who decide:

### 1. A one-page risk view

Leadership doesn't need the 60-row register. They need the heat map, the top five to ten risks in business language, what changed since last time, and the decisions being requested. One page, reviewed on a fixed cadence (monthly or quarterly), in the same forum where roadmap and budget are discussed.

**Benefit:** risk becomes a regular agenda item, not a special meeting called after an incident.

### 2. Name the cost of inaction

Every risk presented should come with two numbers: the cost of treating it now, and the estimated cost if it materializes (outage hours, lost revenue, fines, emergency rework). They don't need to be precise, they need to be honest orders of magnitude.

**Benefit:** the conversation moves from "engineering wants time for tech stuff" to "we're choosing between paying X now or risking Y later".

### 3. Make every acceptance explicit and signed

When leadership chooses to accept a risk, record who accepted it, on what date, with what reasoning and until when. This isn't about blame; it's about making sure the person accepting has the authority and the information to do so.

**Benefit:** risk ownership lands where the decision power is, and the "we'll deal with it" story can't happen silently.

### 4. Tie risk to strategy

Connect each major risk to the business goals it threatens: "this risk puts the Q3 expansion into Mexico at risk", "this one blocks the enterprise customer certification". That's the bridge described in [Business Alignment](/en-us/principles/enterprise/business-alignment/).

**Benefit:** risk treatment competes for budget on equal footing with features, because it's framed as protecting the same outcomes.

## Architecture Decisions and the Risks They Accept

Every architecture decision accepts some risk. Choosing a managed service accepts vendor dependency. Choosing to build in-house accepts operational burden and key-person risk. Choosing eventual consistency accepts temporary divergence. There's no decision without trade-offs, and so there's no decision without risk.

That's why the **Architecture Decision Record (ADR)** is one of the best risk management tools you'll ever have, and it costs almost nothing. A good ADR records the context, the options considered, the decision and its consequences. Add one small section to your template: **"Risks accepted"**, with each risk linked to the register.

| ADR section | What it captures for risk management |
| :--- | :--- |
| **Context** | Constraints and assumptions at the time (deadline, team skills, budget). |
| **Options considered** | The alternatives rejected, and the risks each one would have carried. |
| **Decision** | What was chosen and who decided. |
| **Risks accepted** | The risks this decision knowingly introduces, with IDs in the register. |
| **Revisit when** | The trigger for reviewing the decision: a date, a volume, an event. |

The **"Revisit when"** field is gold. "We chose a single-region deployment; revisit when revenue from this product exceeds X or when a customer contract requires regional redundancy." That single line turns a risk that would have been forgotten into a risk with a built-in early warning. It fits perfectly with [Evolutionary Design](/en-us/principles/solution/evolutionary-design/): the architecture is allowed to be simple today precisely because we wrote down when it must grow.

<div class="callout tip">
  <p>Two years from now, someone will look at your system and ask "why on earth did they do it this way?". An ADR with the risks accepted turns that question from an accusation into a conversation: <strong>here's what we knew, here's what we traded, here's when we planned to revisit it</strong>.</p>
</div>

## Tradeoffs

Risk management protects the organization, but like every principle it has a price. Treating every risk to zero would make the company slow, expensive and, ironically, exposed to the biggest risk of all: being overtaken by competitors who took smarter risks. Let's look at the main tensions.

### Tradeoffs with Cost Optimization

Mitigation costs money: a second region, redundant vendors, extended support contracts, insurance premiums, dedicated time to pay down debt. Each one competes with the budget discipline described in [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

Over-mitigation is waste: spending more to protect against a risk than the risk could ever cost is as irrational as ignoring it.

On the other hand, the cheapest option today often hides the most expensive incident tomorrow. The heat map and the cost of inaction are what let you have this conversation with numbers instead of opinions.

### Tradeoffs with Speed and Time to Market

Risk reviews, ADRs, approvals and controls add friction. Applied without proportion, they turn every decision into a committee.

Taking on deliberate technical debt to validate a product quickly is often the right business decision. Blocking it in the name of risk can kill the product before it has a chance to prove itself.

The balance: lightweight, proportional processes. Low-scored risks get a line in an ADR; only red-zone risks need leadership sign-off.

### Tradeoffs with Operational Excellence

More controls mean more to operate: indicators to collect, reviews to run, registers to maintain. If this is done manually, it becomes exactly the kind of toil [Operational Excellence](/en-us/principles/cloud/operational-excellence/) tries to eliminate.

The answer is the same as always: automate the KRIs, generate inventory from real data, and keep the register close to the tools the team already uses.

### Tradeoffs with Reliability

Some mitigations add complexity: multi-region, multi-vendor and failover mechanisms introduce new components and new failure modes. A badly tested failover can cause the outage it was meant to prevent.

Every mitigation that adds moving parts needs to be tested, or it becomes a new risk in disguise.

### Tradeoffs with Innovation

A very low risk appetite pushes teams toward "nobody ever got fired for choosing" technologies, even when newer options would bring real advantages.

Innovation needs controlled spaces (pilots, isolated experiments, clear exit criteria) where a higher appetite is explicitly allowed, instead of either banning novelty or letting it spread without control.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wait... so we shouldn't try to eliminate every risk? I thought that was the whole point!"</span>
    </div>
  </div>
</div>

Exactly the opposite, Junior! A company with zero risk is a company doing nothing. The point is to take the **right** risks, the ones that bring value and fit the appetite, and to take them **knowingly**. Good risk management doesn't say "no". It says "yes, and here's what we're carrying, who owns it and how we'll know if it gets worse".

## Conclusion

**Risk Management** is what separates organizations that are surprised by their technology from organizations that steer it. It starts with seeing the risks (debt, end-of-life technology, vendor and concentration dependencies, key people, security, compliance, capacity), putting them in a living register, comparing them with a simple likelihood x impact matrix and deciding, against a defined appetite, what to avoid, mitigate, transfer or accept.

**Most importantly:** risk management is not about fear, and it's not a yearly compliance ritual. It's a continuous loop that turns hidden risks into visible decisions, with owners, indicators and review dates. The framework out of support for four years wasn't a technical failure. It was a decision nobody made.

When architecture records the risks each decision accepts, when leadership sees risk in business language, and when early warning indicators are watched like any other metric, the organization can move fast **and** sleep at night.

## Next Steps

1. **Start the risk register this week**
Gather architects, product, operations and security for an hour. List the top risks you already know about, write each one as cause, event and consequence, and give each a named owner.

2. **Agree on scales and build the heat map**
Define likelihood and impact scales in business terms, score the risks together and put them on the matrix. Focus on the red zone first.

3. **Ask leadership to define appetite and tolerance**
Propose a few concrete thresholds (unsupported software, vendor concentration, personal data handling) and get them approved as part of your governance.

4. **Choose a treatment for every risk above tolerance**
Avoid, mitigate, transfer or accept, with actions, dates and residual risk recorded. Make every acceptance explicit, signed and time-boxed.

5. **Automate your Key Risk Indicators**
Start with the cheapest ones: EOL dates from your inventory, open critical vulnerabilities, bus factor of critical systems. Put them on the same page as the register.

6. **Add "Risks accepted" and "Revisit when" to your ADR template**
From now on, every significant architecture decision states what it trades and when it must be reviewed.

7. **Review on a fixed cadence**
Monthly for the team, quarterly with leadership. A register that isn't reviewed is just a list of good intentions.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://www.iso.org/iso-31000-risk-management.html" target="_blank" rel="noopener">ISO 31000: Risk management</a></li>
    <li><a href="https://www.nist.gov/cyberframework" target="_blank" rel="noopener">NIST Cybersecurity Framework</a></li>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">TOGAF Standard (The Open Group)</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://martinfowler.com/bliki/TechnicalDebt.html" target="_blank" rel="noopener">Martin Fowler: Technical Debt</a></li>
    <li><a href="https://martinfowler.com/bliki/TechnicalDebtQuadrant.html" target="_blank" rel="noopener">Martin Fowler: Technical Debt Quadrant</a></li>
    <li><a href="https://adr.github.io/" target="_blank" rel="noopener">Architecture Decision Records (adr.github.io)</a></li>
    <li><a href="https://endoflife.date/" target="_blank" rel="noopener">endoflife.date</a></li>
    <li><a href="https://owasp.org/" target="_blank" rel="noopener">OWASP Foundation</a></li>
    <li><a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noopener">General Data Protection Regulation (GDPR)</a></li>
    <li><a href="https://www.gov.br/anpd/" target="_blank" rel="noopener">ANPD: Brazilian National Data Protection Authority (LGPD)</a></li>
  </ul>
</div>
