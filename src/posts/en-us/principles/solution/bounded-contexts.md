---
title: Bounded Contexts
short: One model to rule them all sounds great until "Customer" means five different things. Draw the boundaries before the boundaries draw you.
category: solution
---

## Introduction

Every system starts small and honest. There's an `Order` table, a `Customer` table, a few services talking to each other, and everyone in the room means the same thing when they say "order". Then the company grows, new teams show up, sales wants one thing, billing wants another, logistics wants a third, and that innocent `Customer` table ends up with 80 columns, half of them nullable, and a comment at the top that says "don't touch, ask Carlos".

**Bounded Contexts** are the answer Domain-Driven Design (DDD) gives to that mess. The **goal** of this principle is simple to say and hard to practice: **split a large domain into smaller models, each with a clear boundary, its own language and its own owner**, and make the relationships between those models explicit instead of accidental.

When a team ignores this principle, the symptoms show up sooner than anyone expects:

- The same word means different things in different meetings, and nobody notices until a bug reaches production;
- A single "canonical" model tries to serve every department and ends up serving none of them well;
- Every change in one area breaks something in an area nobody on the team has ever heard of;
- Teams wait on each other for every release, because everything touches everything;
- Microservices that share one database and must be deployed together (the famous distributed monolith);
- Integrations with legacy systems leak their weird names and rules into brand new code;

Yep, *it's rare, but it happens all the time*... Who hasn't opened a class called `CustomerHelperManagerService` and felt a small piece of their soul leave their body?

<div class="callout info">
  <p>Bounded Contexts are not a technology, a framework or a deployment unit. They are a <strong>modeling decision</strong>: where one model ends and another begins. Services, databases and teams can (and often should) follow those lines, but the boundary comes first.</p>
</div>

## Ubiquitous Language: the word is the design

Before we talk about boundaries, we need to talk about language. Eric Evans, who wrote the original DDD book, called it the **Ubiquitous Language**: a shared, rigorous vocabulary used by domain experts and developers alike, in conversations, in documents, in tests and, above all, in the code.

If the business says "the policy is *reinstated*" and the code says `setStatus(3)`, you have a translation layer living inside people's heads. Every translation is a chance for a misunderstanding, and misunderstandings compile just fine.

A healthy ubiquitous language has a few properties:

- **It lives in the code.** Class names, method names, events and API fields use the business terms, not technical approximations;
- **It is precise.** "Active customer" has a definition that everyone can repeat, not a feeling;
- **It evolves.** When a conversation with a domain expert reveals a better term, the code gets renamed. Refactoring the language is refactoring the design;
- **It has a boundary.** And this is the key part: a ubiquitous language is only ubiquitous *inside one context*.

### The "Customer means five different things" problem

Ask five departments what a "customer" is and you'll get five honest, correct and incompatible answers.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 330" role="img" aria-labelledby="bc-d1-title bc-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d1-title">One word, five models</title>
<desc id="bc-d1-desc">The word Customer sits in the center, connected to five contexts: Sales sees a lead in the pipeline, Billing sees whoever pays the invoice, Shipping sees a name and an address, Support sees who opened the ticket, and Marketing sees a segment member.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">ONE WORD, FIVE MODELS</text>
<rect x="280" y="110" width="160" height="60" rx="10" class="d-box-warn"/>
<text x="360" y="136" text-anchor="middle" class="d-title">Customer</text>
<text x="360" y="156" text-anchor="middle" class="d-small">one table, 80 columns</text>
<line x1="280" y1="125" x2="230" y2="80" class="d-line-dashed"/>
<line x1="440" y1="125" x2="490" y2="80" class="d-line-dashed"/>
<line x1="280" y1="155" x2="230" y2="215" class="d-line-dashed"/>
<line x1="440" y1="155" x2="490" y2="215" class="d-line-dashed"/>
<line x1="360" y1="170" x2="360" y2="240" class="d-line-dashed"/>
<rect x="30" y="35" width="200" height="70" rx="10" class="d-box-accent"/>
<text x="130" y="64" text-anchor="middle" class="d-title">Sales</text>
<text x="130" y="86" text-anchor="middle" class="d-small">a lead in the pipeline</text>
<rect x="490" y="35" width="200" height="70" rx="10" class="d-box-info"/>
<text x="590" y="64" text-anchor="middle" class="d-title">Billing</text>
<text x="590" y="86" text-anchor="middle" class="d-small">whoever pays the invoice</text>
<rect x="30" y="190" width="200" height="70" rx="10" class="d-box-info"/>
<text x="130" y="219" text-anchor="middle" class="d-title">Shipping</text>
<text x="130" y="241" text-anchor="middle" class="d-small">a name and an address</text>
<rect x="490" y="190" width="200" height="70" rx="10" class="d-box-info"/>
<text x="590" y="219" text-anchor="middle" class="d-title">Support</text>
<text x="590" y="241" text-anchor="middle" class="d-small">who opened the ticket</text>
<rect x="260" y="240" width="200" height="70" rx="10" class="d-box"/>
<text x="360" y="269" text-anchor="middle" class="d-title">Marketing</text>
<text x="360" y="291" text-anchor="middle" class="d-small">a segment member</text>
</svg>
</div>
<figcaption>Figure 1: The same word, five legitimate meanings</figcaption>
</figure>

- For **Sales**, a customer is a lead with a stage in the funnel, an owner and a probability of closing;
- For **Billing**, a customer is whoever is legally responsible for paying: a tax ID, a payment method, a billing address, a credit limit;
- For **Shipping**, a "customer" barely exists. What matters is a recipient: a name, an address, a delivery window;
- For **Support**, a customer is whoever opened the ticket, with a plan, an SLA and a history of complaints;
- For **Marketing**, a customer is a member of a segment, with consent flags and campaign history.

The classic mistake is to look at this and say "great, let's build one `Customer` entity that covers all of it". That's how you get the 80-column table, the `isLead` flag, the `shippingAddress2Old` field and the meeting where three teams argue about whether `status = 'ACTIVE'` means "paid this month" or "logged in this month".

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But isn't that duplication? DRY, right? If we have five Customer classes, we're repeating ourselves five times!"</span>
    </div>
  </div>
</div>

Easy there, Junior! DRY is about not duplicating **knowledge**, not about never having two classes with the same name. The shipping recipient and the billing payer are *different concepts* that happen to share a word. Forcing them into one class doesn't remove duplication, it creates **coupling**: now every change to billing rules has to be negotiated with shipping, and vice versa.

The DDD answer is: each context gets its own model of "customer", shaped exactly for its job, and the contexts share only an identifier (a `customerId`) and whatever facts they explicitly agree to exchange. Five small, sharp models beat one big, blurry one.

## Subdomains: where to spend your best people

A **domain** is the area of business your software serves. Large domains are made of **subdomains**, and not all of them are equally important. DDD classifies them into three types, and this classification should drive where you invest.

| Type | What it is | How to treat it |
| :--- | :--- | :--- |
| **Core** | What makes the business different from competitors. The reason customers choose you. | Build it in-house, with your best people, rich domain models and constant refinement. This is where DDD pays off the most. |
| **Supporting** | Necessary and somewhat specific to your business, but not a differentiator. | Build it, but keep it simple. CRUD is often fine. Consider outsourcing. |
| **Generic** | Problems every company has and that are already solved: identity, email, payments, accounting. | Buy it or use a SaaS or open source solution. Don't reinvent authentication. |

For an e-commerce company that competes on dynamic pricing, **Pricing** is core. **Order management** might be core too. **Shipping** is supporting (it needs to work well, but it's not why people buy from you). **Identity** and **payments** are generic: use a proven provider and move on.

<div class="callout tip">
  <p>A quick smell test: if a competitor copied this subdomain tomorrow, would it hurt? If the answer is "not really", it's not core. Teams love to treat everything as core, because core is where the interesting problems live. Resist that. Spending your best engineers on a homemade login system is a strategic mistake, not a technical one.</p>
</div>

Subdomains belong to the **problem space** (how the business is organized). Bounded contexts belong to the **solution space** (how we model and build it). Ideally they line up one to one, but in real life a legacy system may cover three subdomains, or a single subdomain may need two contexts. Knowing the difference helps you talk about the gap.

## Bounded Contexts: drawing the lines

A **bounded context** is an explicit boundary within which a particular model applies and a particular ubiquitous language is consistent. Inside the boundary, "Order" means exactly one thing. Outside, it may mean something else, and that's fine.

In practice, a bounded context usually comes with:

- **Its own model:** entities, value objects, aggregates and rules, designed for that context only;
- **Its own language:** documented terms, ideally in a small glossary that lives in the repository;
- **Its own data:** a database or at least a schema that only this context writes to;
- **Its own team:** one team owns it end to end. A team may own several contexts, but a context shouldn't have several owning teams;
- **An explicit interface:** an API, events, or a published contract. Nobody reaches into its internals.

### Finding the boundaries

There's no algorithm that spits out perfect contexts, but there are good signals:

#### 1. Language changes

When the same word starts meaning something different, or when domain experts start using a different vocabulary, you're probably crossing a boundary. Listen for "well, for us an order is only an order after it's paid".

#### 2. Different rates of change

Pricing rules change every week; the tax engine changes once a year when the law changes. Parts that change at different speeds and for different reasons want to live apart.

#### 3. Different experts

If the people you need to talk to in order to understand an area are different people, that's a strong hint. The finance team doesn't care how the warehouse picks items, and the warehouse doesn't care about revenue recognition.

#### 4. Consistency needs

Things that must be consistent in the same transaction usually belong together. Things that can tolerate a few seconds (or minutes) of delay can be split and integrated with events.

#### 5. Business capabilities

Capabilities such as "take orders", "bill customers", "ship packages" are more stable than org charts and much more stable than technology. They are a good first cut.

**Goal:** each context should be small enough to be understood by one team and cohesive enough that most changes stay inside it.

**Benefit:** teams can change their model freely without asking permission from the whole company, as long as they honor their published contracts.

## Event Storming: discovering boundaries together

Drawing contexts alone in a meeting room is a recipe for a beautiful diagram that nobody agrees with. **Event Storming**, created by Alberto Brandolini, is a workshop format that puts developers and domain experts in front of a long wall (or a virtual board) to map the business as a sequence of **domain events**.

The basic flow looks like this:

1. **Chaotic exploration:** everyone writes domain events on orange sticky notes, in the past tense: "Order Placed", "Payment Authorized", "Package Shipped", "Refund Requested". No discussion yet, just volume;
2. **Enforce the timeline:** put events in chronological order. Duplicates and contradictions appear, and that's the point;
3. **Hot spots:** mark areas of confusion, disagreement or pain with bright pink notes. These are gold: they show where the language is broken;
4. **Commands and actors:** add what triggers each event (blue for commands, small yellow for actors or roles);
5. **Policies and external systems:** "whenever X happens, do Y" rules and the systems you depend on;
6. **Find the boundaries:** look for clusters of events that use the same language and are owned by the same people. Draw lines around them. Those are your candidate bounded contexts.

The magic of Event Storming is not the sticky notes. It's watching someone from sales and someone from finance argue for ten minutes about what "Order Confirmed" means and realizing that you just found a context boundary for free.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So... each bounded context is a microservice, right? We run the workshop, draw eight circles and tomorrow we create eight repositories and eight databases!"</span>
    </div>
  </div>
</div>

Hold on, Junior! That's exactly the mistake that creates the most expensive systems in the industry. We'll get there in a moment, it deserves its own section.

## Context Mapping: the relationships matter as much as the boxes

Contexts don't live alone. Orders need prices, billing needs orders, shipping needs addresses. A **context map** makes those relationships explicit: who depends on whom, who has the power to change the contract, and how models are translated at the border.

These are the classic patterns:

| Pattern | What it means | When to use it |
| :--- | :--- | :--- |
| **Partnership** | Two teams succeed or fail together and coordinate changes closely. | Two core contexts that evolve together, with teams that talk every day. |
| **Shared Kernel** | Two contexts share a small, explicitly defined piece of model or code. | A tiny, stable subset (like a `Money` or `Address` value object). Keep it minimal, changes need both teams' approval. |
| **Customer/Supplier** | The upstream (supplier) serves the downstream (customer), and the downstream's needs influence the upstream's roadmap. | Most internal integrations. The downstream team has a voice in planning. |
| **Conformist** | The downstream simply adopts the upstream's model, with no translation. | The upstream won't change for you (a big vendor, a powerful team) and its model is good enough. |
| **Anti-Corruption Layer (ACL)** | The downstream builds a translation layer to protect its model from the upstream's. | Legacy systems, external APIs with poor models, anything you don't want leaking into your core. |
| **Open Host Service (OHS)** | The upstream exposes a well-defined protocol for many consumers. | A context used by many others, like identity or catalog. |
| **Published Language (PL)** | A documented, shared exchange format (often paired with OHS). | Public events, industry standards, versioned schemas. |
| **Separate Ways** | No integration at all. Each context solves its own problem. | When integrating costs more than the benefit. Sometimes duplicating a small feature is the right call. |

Here's what a context map for our e-commerce example could look like:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 410" role="img" aria-labelledby="bc-d2-title bc-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d2-title">Context map of an e-commerce system</title>
<desc id="bc-d2-desc">Identity is a generic context exposed as an open host service with a published language to Pricing, Ordering and Billing. Pricing and Ordering are core contexts in a partnership. Ordering supplies Billing as customer and supplier and shares a kernel with Shipping. Shipping conforms to an external carrier API. Billing reads a legacy ERP through an anti-corruption layer. Marketing goes separate ways.</desc>
<defs><marker id="bc-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="26" text-anchor="middle" class="d-label">CONTEXT MAP</text>
<rect x="30" y="50" width="160" height="70" rx="10" class="d-box-muted"/>
<text x="110" y="80" text-anchor="middle" class="d-title">Marketing</text>
<text x="110" y="102" text-anchor="middle" class="d-small">separate ways</text>
<rect x="300" y="50" width="160" height="70" rx="10" class="d-box"/>
<text x="380" y="80" text-anchor="middle" class="d-title">Identity</text>
<text x="380" y="102" text-anchor="middle" class="d-small">generic</text>
<rect x="570" y="44" width="14" height="14" rx="3" class="d-box-accent"/>
<text x="592" y="56" class="d-small">Core</text>
<rect x="570" y="64" width="14" height="14" rx="3" class="d-box-info"/>
<text x="592" y="76" class="d-small">Supporting</text>
<rect x="570" y="84" width="14" height="14" rx="3" class="d-box"/>
<text x="592" y="96" class="d-small">Generic</text>
<rect x="570" y="104" width="14" height="14" rx="3" class="d-box-muted"/>
<text x="592" y="116" class="d-small">External</text>
<rect x="570" y="124" width="14" height="14" rx="3" class="d-box-danger"/>
<text x="592" y="136" class="d-small">Legacy</text>
<line x1="380" y1="120" x2="380" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<line x1="300" y1="108" x2="112" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<line x1="460" y1="108" x2="648" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<text x="390" y="156" class="d-label">OHS / PL</text>
<rect x="30" y="180" width="160" height="70" rx="10" class="d-box-accent"/>
<text x="110" y="210" text-anchor="middle" class="d-title">Pricing</text>
<text x="110" y="232" text-anchor="middle" class="d-small">core</text>
<rect x="300" y="180" width="160" height="70" rx="10" class="d-box-accent"/>
<text x="380" y="210" text-anchor="middle" class="d-title">Ordering</text>
<text x="380" y="232" text-anchor="middle" class="d-small">core</text>
<rect x="570" y="180" width="160" height="70" rx="10" class="d-box-info"/>
<text x="650" y="210" text-anchor="middle" class="d-title">Billing</text>
<text x="650" y="232" text-anchor="middle" class="d-small">supporting</text>
<line x1="190" y1="222" x2="300" y2="222" class="d-line-accent"/>
<text x="245" y="212" text-anchor="middle" class="d-label">PARTNERSHIP</text>
<line x1="460" y1="222" x2="568" y2="222" class="d-line" marker-end="url(#bc-d2-arrow)"/>
<text x="515" y="198" text-anchor="middle" class="d-label">CUSTOMER /</text>
<text x="515" y="212" text-anchor="middle" class="d-label">SUPPLIER</text>
<line x1="380" y1="250" x2="380" y2="320" class="d-line"/>
<text x="390" y="290" class="d-label">SHARED KERNEL</text>
<rect x="30" y="320" width="160" height="70" rx="10" class="d-box-muted"/>
<text x="110" y="350" text-anchor="middle" class="d-title">Carrier API</text>
<text x="110" y="372" text-anchor="middle" class="d-small">external</text>
<rect x="300" y="320" width="160" height="70" rx="10" class="d-box-info"/>
<text x="380" y="350" text-anchor="middle" class="d-title">Shipping</text>
<text x="380" y="372" text-anchor="middle" class="d-small">supporting</text>
<line x1="190" y1="362" x2="298" y2="362" class="d-line" marker-end="url(#bc-d2-arrow)"/>
<text x="245" y="352" text-anchor="middle" class="d-label">CONFORMIST</text>
<rect x="570" y="320" width="160" height="70" rx="10" class="d-box-danger"/>
<text x="650" y="350" text-anchor="middle" class="d-title">Legacy ERP</text>
<text x="650" y="372" text-anchor="middle" class="d-small">legacy</text>
<line x1="650" y1="320" x2="650" y2="302" class="d-line"/>
<rect x="610" y="268" width="80" height="34" rx="10" class="d-box-warn"/>
<text x="650" y="290" text-anchor="middle" class="d-text">ACL</text>
<line x1="650" y1="268" x2="650" y2="252" class="d-line" marker-end="url(#bc-d2-arrow)"/>
</svg>
</div>
<figcaption>Figure 2: A context map shows the boxes and, more importantly, the power dynamics between them</figcaption>
</figure>

Notice that the context map is not only technical. It's **political**. "Conformist" is an honest admission that you have no leverage over the upstream. "Customer/Supplier" only works if the upstream team actually listens. "Partnership" requires two teams with aligned goals and real communication. Drawing the map forces those conversations to happen out loud, instead of being discovered during an incident.

<div class="callout warning">
  <p>Be careful with <strong>Shared Kernel</strong>. It starts as "just the Address class" and, six months later, it's a shared library with 40 classes that three teams have to coordinate releases around. If it grows, it's no longer a kernel, it's a monolith in disguise. Keep it tiny, versioned and boring.</p>
</div>

## Anti-Corruption Layer: keeping the legacy out

Let's zoom in on the most useful pattern for anyone who has ever integrated with a legacy system: the **Anti-Corruption Layer**.

Picture the scenario. Your new Billing context has a clean model: `Invoice`, `Payer`, `Money`, `InvoiceStatus`. But the company's 20-year-old ERP is still the source of truth for customer credit data, and its API returns things like this:

```json
{
  "CD_CLI": "000482",
  "NM_RAZ": "ACME LTDA",
  "TP_DOC": 3,
  "VL_LIM_CRED": "15000,00",
  "FL_BLOQ": "S"
}
```

`TP_DOC = 3` means "company" (unless it's a branch, then it's 4, except in records created before 2011). `FL_BLOQ = "S"` means blocked, and the amount is a string with a comma as decimal separator. If you let this shape into your domain model, your shiny new context will be speaking ERP within a month.

The ACL is a layer that belongs to **your** context and whose only job is translation. It usually has three parts:

- **Facade:** a simplified interface over the legacy system, exposing only what you need;
- **Adapter:** handles the technical details: protocol, authentication, retries, pagination, weird encodings;
- **Translator:** converts the legacy model into your domain model (and back, if needed), including all the business quirks.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="bc-d3-title bc-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d3-title">Anti-corruption layer between Billing and a legacy ERP</title>
<desc id="bc-d3-desc">The Billing context, with its own model of Invoice, Payer and Money, talks to an anti-corruption layer made of a facade, a translator and an adapter. The layer talks to the legacy ERP and its cryptic fields, so the legacy model never reaches Billing.</desc>
<defs><marker id="bc-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="120" y="58" text-anchor="middle" class="d-label">OUR MODEL</text>
<rect x="30" y="70" width="180" height="140" rx="10" class="d-box-accent"/>
<text x="120" y="100" text-anchor="middle" class="d-title">Billing</text>
<text x="120" y="130" text-anchor="middle" class="d-small">Invoice</text>
<text x="120" y="152" text-anchor="middle" class="d-small">Payer</text>
<text x="120" y="174" text-anchor="middle" class="d-small">Money</text>
<text x="360" y="38" text-anchor="middle" class="d-label">OWNED BY BILLING</text>
<rect x="270" y="50" width="180" height="180" rx="10" class="d-box-warn"/>
<text x="360" y="76" text-anchor="middle" class="d-title">Anti-Corruption</text>
<text x="360" y="95" text-anchor="middle" class="d-title">Layer</text>
<rect x="290" y="108" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="129" text-anchor="middle" class="d-text">Facade</text>
<rect x="290" y="148" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="169" text-anchor="middle" class="d-text">Translator</text>
<rect x="290" y="188" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="209" text-anchor="middle" class="d-text">Adapter</text>
<text x="600" y="58" text-anchor="middle" class="d-label">THEIR MODEL</text>
<rect x="510" y="70" width="180" height="140" rx="10" class="d-box-danger"/>
<text x="600" y="100" text-anchor="middle" class="d-title">Legacy ERP</text>
<text x="600" y="130" text-anchor="middle" class="d-small">CD_CLI, NM_RAZ</text>
<text x="600" y="152" text-anchor="middle" class="d-small">TP_DOC = 3</text>
<text x="600" y="174" text-anchor="middle" class="d-small">FL_BLOQ = "S"</text>
<line x1="212" y1="140" x2="268" y2="140" class="d-line" marker-start="url(#bc-d3-arrow)" marker-end="url(#bc-d3-arrow)"/>
<line x1="452" y1="140" x2="508" y2="140" class="d-line" marker-start="url(#bc-d3-arrow)" marker-end="url(#bc-d3-arrow)"/>
<text x="360" y="268" text-anchor="middle" class="d-small">translation happens in one place; the legacy model never leaks in</text>
</svg>
</div>
<figcaption>Figure 3: The ACL belongs to the downstream context and absorbs all the legacy weirdness</figcaption>
</figure>

In code, the translator is often surprisingly small and boring, which is exactly what you want:

```typescript
// Billing's own model: no trace of the ERP here
type PayerKind = "individual" | "company";

interface Payer {
  id: PayerId;
  legalName: string;
  kind: PayerKind;
  creditLimit: Money;
  blocked: boolean;
}

// ACL translator: the only place that knows what TP_DOC means
function toPayer(raw: ErpCustomerDto): Payer {
  return {
    id: PayerId.fromLegacy(raw.CD_CLI),
    legalName: raw.NM_RAZ.trim(),
    kind: raw.TP_DOC === 3 || raw.TP_DOC === 4 ? "company" : "individual",
    creditLimit: Money.brl(parseLegacyDecimal(raw.VL_LIM_CRED)),
    blocked: raw.FL_BLOQ === "S",
  };
}
```

The Billing domain works with `Payer` and never sees `FL_BLOQ`. When the ERP is finally replaced (it will be, someday, maybe), you rewrite the ACL, and the rest of Billing doesn't even notice. The ACL is also the natural place for the **Strangler Fig** strategy: route calls through it and move capabilities out of the legacy system one piece at a time.

**Benefit:** your domain model stays clean, legacy changes have a small blast radius, and the translation rules are tested in isolation instead of scattered across the codebase.

## Bounded Contexts vs Microservices

Now back to Junior's question. It's the most common misconception in the whole topic, so let's be very clear:

<div class="callout info">
  <p><strong>A bounded context is a logical boundary. A microservice is a deployment boundary.</strong> A good microservice should not cross a context boundary, but a context does not need to be a microservice. One context can be a module inside a monolith, one service, or even several services.</p>
</div>

### The distributed monolith story

I've seen this movie more than once. A company decides it's time to "go microservices". The team runs a quick workshop, splits the old monolith by **entity** (a `customer-service`, an `order-service`, a `product-service`, an `inventory-service`) and, to save time, they all keep pointing at the same database. After all, the data is already there.

A year later:

- Placing an order calls `customer-service`, which calls `product-service`, which calls `inventory-service`, which calls `pricing-service`. If any of them is slow, checkout is slow. If any of them is down, checkout is down;
- A column rename in the shared database requires a coordinated deploy of six services, scheduled for Saturday at 2 AM;
- Every feature touches four repositories, four pipelines and four teams;
- The cloud bill tripled, latency doubled, and debugging requires distributed tracing across a dozen hops;
- Nobody can deploy anything alone, which was the entire point of the migration.

That's the **distributed monolith**: all the coupling of a monolith, plus all the operational cost of a distributed system. The worst of both worlds. The root cause was not microservices themselves, it was splitting along the wrong lines (entities and tables instead of business capabilities and language) and sharing the data underneath.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 310" role="img" aria-labelledby="bc-d4-title bc-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d4-title">Distributed monolith versus modular monolith</title>
<desc id="bc-d4-desc">On the left, three services call each other synchronously in a chain and share one database, so they deploy and fail together. On the right, a single deployable holds three modules, each with its own schema, talking through in-process events and public APIs, ready to be split later along proven seams.</desc>
<defs><marker id="bc-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-danger"/></marker></defs>
<text x="185" y="26" text-anchor="middle" class="d-label">DISTRIBUTED MONOLITH</text>
<rect x="35" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="80" y="91" text-anchor="middle" class="d-text">Orders</text>
<rect x="140" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="185" y="91" text-anchor="middle" class="d-text">Billing</text>
<rect x="245" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="290" y="91" text-anchor="middle" class="d-text">Shipping</text>
<path d="M85,64 Q132,36 178,62" class="d-line-danger" marker-end="url(#bc-d4-arrow)"/>
<path d="M192,64 Q240,36 284,62" class="d-line-danger" marker-end="url(#bc-d4-arrow)"/>
<text x="185" y="40" text-anchor="middle" class="d-small">sync calls</text>
<line x1="80" y1="108" x2="148" y2="188" class="d-line-danger"/>
<line x1="185" y1="108" x2="185" y2="188" class="d-line-danger"/>
<line x1="290" y1="108" x2="222" y2="188" class="d-line-danger"/>
<rect x="110" y="190" width="150" height="60" rx="10" class="d-box-danger"/>
<text x="185" y="216" text-anchor="middle" class="d-title">Shared DB</text>
<text x="185" y="236" text-anchor="middle" class="d-small">one schema for all</text>
<text x="185" y="284" text-anchor="middle" class="d-small">deploy together, fail together</text>
<line x1="370" y1="20" x2="370" y2="290" class="d-line-dashed"/>
<text x="550" y="26" text-anchor="middle" class="d-label">MODULAR MONOLITH</text>
<rect x="390" y="44" width="320" height="210" rx="10" class="d-box"/>
<text x="550" y="66" text-anchor="middle" class="d-small">one deployable</text>
<rect x="405" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="450" y="108" text-anchor="middle" class="d-text">Orders</text>
<rect x="505" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="550" y="108" text-anchor="middle" class="d-text">Billing</text>
<rect x="605" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="650" y="108" text-anchor="middle" class="d-text">Shipping</text>
<line x1="415" y1="148" x2="685" y2="148" class="d-line-dashed"/>
<line x1="450" y1="126" x2="450" y2="172" class="d-line"/>
<line x1="550" y1="126" x2="550" y2="172" class="d-line"/>
<line x1="650" y1="126" x2="650" y2="172" class="d-line"/>
<rect x="420" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="450" y="193" text-anchor="middle" class="d-small">schema</text>
<rect x="520" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="550" y="193" text-anchor="middle" class="d-small">schema</text>
<rect x="620" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="650" y="193" text-anchor="middle" class="d-small">schema</text>
<text x="550" y="234" text-anchor="middle" class="d-small">events and public APIs between modules</text>
<text x="550" y="284" text-anchor="middle" class="d-small">split later along proven seams</text>
</svg>
</div>
<figcaption>Figure 4: Same three names, very different coupling</figcaption>
</figure>

### The modular monolith: contexts without the network

For many teams, the best first step is a **modular monolith**: one deployable application, internally divided into modules that follow bounded context lines. Each module:

- Has its own internal model and exposes only a small public API (an interface, a facade, published events);
- Owns its own tables, ideally in its own schema, and other modules never query them directly;
- Communicates with other modules through that public API or through in-process events;
- Has its boundaries enforced by tooling: architecture tests (ArchUnit, NetArchTest, dependency-cruiser), separate projects or packages, lint rules.

You get most of the modeling benefits of bounded contexts (clear language, isolated change, explicit contracts) without paying for network calls, distributed transactions, service discovery and a dozen pipelines. And if one module later needs to scale independently or be owned by a separate team, the seam is already there. Extracting a well-isolated module into a service is a weekend project. Untangling a big ball of mud is a two-year program.

### When a context should become a service

Split a context into its own deployable when there's a concrete reason, such as:

1. **Independent scaling:** its load profile is very different from the rest (search, image processing, pricing at Black Friday);
2. **Independent release cadence:** a team needs to ship several times a day without coordinating with anyone;
3. **Team autonomy:** a separate team owns it and the shared deploy has become a bottleneck;
4. **Different technology needs:** a different runtime, language or data store really makes a difference;
5. **Fault isolation:** a failure there must not take down the rest (see [Resilience Patterns](/en-us/principles/solution/resilience-patterns/)).

If none of these apply, a module is probably enough. Distribution is a cost you pay for a benefit, not a badge.

## Data Ownership per Context

A boundary that stops at the code and ignores the data is not a boundary. The rule is simple and non-negotiable: **each context owns its data, and only that context writes to it.** Other contexts get the data through the owner's API or through the events it publishes.

What does that look like in practice?

### 1. No shared tables

If two contexts write to the same table, they are one context (whether you admit it or not). Reading another context's tables directly is almost as bad: your code now depends on their internal schema, and they can't refactor without breaking you.

### 2. Share identifiers, not rows

Billing stores the `orderId`, not a foreign key into Ordering's database. It can ask Ordering for details or keep its own copy of the few facts it needs.

### 3. Local copies are fine

Shipping can keep its own projection of the delivery address, updated by an `OrderPlaced` or `AddressChanged` event. That's not a bug, it's a deliberate **read model**. Each copy has exactly the shape its context needs.

### 4. Events are part of the published language

Domain events that cross boundaries (`OrderPlaced`, `PaymentCaptured`) are contracts. Version them, document them and treat breaking changes with the same care as a public API change. Internal events can change freely; public ones cannot.

### 5. Use the Outbox pattern for reliable publishing

Writing to your database and publishing an event are two operations that can fail independently. The **Transactional Outbox** saves the event in the same transaction as the state change and a relay publishes it afterward, so you never lose an event or publish one for a change that was rolled back.

```csharp
public async Task PlaceOrder(PlaceOrderCommand cmd)
{
    var order = Order.Place(cmd.CustomerId, cmd.Items, _clock);

    await using var tx = await _db.Database.BeginTransactionAsync();
    _db.Orders.Add(order);
    _db.Outbox.Add(OutboxMessage.From(new OrderPlaced(order.Id, order.Total)));
    await _db.SaveChangesAsync();
    await tx.CommitAsync();
    // A background relay reads the outbox and publishes to the broker
}
```

| Approach | Benefit |
| :--- | :--- |
| **One writer per piece of data** | No hidden coupling through the database; each team can change its schema freely. |
| **Integration through APIs and events** | Contracts are explicit, versioned and testable. |
| **Local read models** | Each context gets exactly the data shape it needs, with no runtime dependency on others for reads. |
| **Transactional outbox** | State changes and published events stay consistent, even with failures in between. |

## Conway's Law and Team Topologies

In 1967, Melvin Conway observed that *organizations design systems that mirror their own communication structure*. Half a century later, it's still undefeated. If three teams build a compiler, you get a three-pass compiler. If one team owns Billing and Shipping together and nobody owns Pricing, your architecture will reflect exactly that, no matter what the diagram on the wiki says.

This has a direct consequence for bounded contexts: **boundaries in the software only hold if they match boundaries in the organization.** A context owned by three teams will be pulled in three directions. Two contexts owned by one overloaded team will slowly merge.

The practical move is known as the **Inverse Conway Maneuver**: design the team structure you want so that the architecture you want emerges naturally. The book *Team Topologies*, by Matthew Skelton and Manuel Pais, gives a useful vocabulary for this:

- **Stream-aligned teams:** own a flow of business value end to end, usually one or more bounded contexts. Most teams should be this type;
- **Platform teams:** provide internal services (deploy, observability, data platform) that reduce the cognitive load of stream-aligned teams;
- **Enabling teams:** help other teams adopt new skills or practices, then step back;
- **Complicated-subsystem teams:** own a part that requires deep specialist knowledge (a pricing engine, a video codec, a risk model).

And three interaction modes that map nicely to context mapping: **collaboration** (close to Partnership), **X-as-a-Service** (close to Open Host Service and Customer/Supplier) and **facilitating** (enabling teams helping others).

<div class="callout tip">
  <p>A good heuristic from Team Topologies is <strong>cognitive load</strong>: a team should own only as many contexts as it can truly understand. If a team can't explain its own domain model without opening the code, it owns too much. Split the ownership before the model rots.</p>
</div>

## Tradeoffs

Bounded contexts bring clarity, autonomy and models that fit their purpose. But, like every architectural decision, they come with a price tag. Pretending they're free is how teams end up hating DDD.

### Duplication of data and models

The same concept appears in several contexts with different shapes. That's intentional, but it means more code, more mapping and more places to update when a genuinely shared fact changes (like a customer's legal name). You trade some duplication for a lot of independence. Just make sure it's a conscious trade.

### Integration complexity

Every relationship on the context map is an integration to design, build, test, monitor and version. Contract tests, schema registries, event versioning, ACLs: all of that is real work. With too many small contexts, the integration cost can exceed the benefit. Fewer, larger contexts are often better than many tiny ones, especially early on.

### Eventual consistency

Once contexts communicate through events, the system is no longer consistent at every instant. The order is placed, but the invoice appears a few seconds later. The business must accept that (and usually does, once someone explains that the old system also ran a nightly batch). You'll need idempotent consumers, retries, compensation (sagas) and user interfaces that handle "processing" states gracefully.

### Tradeoffs with Reliability

Splitting into services introduces network calls and more failure modes. Without timeouts, retries, circuit breakers and asynchronous communication, more boundaries mean more ways to fail. See [Reliability](/en-us/principles/cloud/reliability/) and [Resilience Patterns](/en-us/principles/solution/resilience-patterns/).

### Tradeoffs with Performance Efficiency

Translation layers, serialization and hops across the network add latency. Queries that used to be a single SQL join now need composition across contexts or dedicated read models. See [Performance Efficiency](/en-us/principles/cloud/performance-efficiency/).

### Tradeoffs with Cost Optimization

More deployables mean more infrastructure, more pipelines, more databases and more observability data. A modular monolith keeps most of the modeling benefits at a fraction of the cost. See [Cost Optimization](/en-us/principles/cloud/cost-optimization/).

### Tradeoffs with Operational Excellence

Each context needs ownership, runbooks, dashboards and on-call. Tracing a request across contexts requires correlation IDs and distributed tracing from day one. See [Operational Excellence](/en-us/principles/cloud/operational-excellence/) and [Observability First](/en-us/principles/solution/observability-first/).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wait... so if I get the boundaries wrong, I'm stuck with them forever?"</span>
    </div>
  </div>
</div>

Not forever, Junior, but moving a boundary gets more expensive the more you've invested in it. That's exactly why it pays to start with a modular monolith, keep contexts a bit larger at first, and adjust as you learn. Boundaries are hypotheses about the business. Treat them like any other design decision: explicit, documented (an ADR helps a lot) and open to revision. That's the heart of [Evolutionary Design](/en-us/principles/solution/evolutionary-design/).

## Conclusion

**Bounded Contexts** are one of the most powerful ideas in software architecture, precisely because they're not about technology. They're about accepting that a large business can't be described by a single model, that words mean different things in different places, and that clear boundaries (in language, code, data and teams) are what allow a system to grow without collapsing under its own weight.

Get the language right inside each context. Classify subdomains so you invest where it matters. Make relationships explicit with a context map. Protect your model from legacy with anti-corruption layers. Give each context ownership of its data. And remember that a context is a modeling boundary first: whether it becomes a module or a microservice is a separate, later decision driven by real needs.

**Most importantly:** bounded contexts don't eliminate complexity, they put it in the right place. You trade accidental coupling for deliberate integration, and a single blurry model for several sharp ones. That's a trade worth making, as long as you make it consciously.

## Next Steps

1. **Build a glossary for your current system**
Pick the ten most important business terms and ask different teams to define them. Wherever definitions disagree, you've likely found a context boundary.

2. **Classify your subdomains**
List the main areas of the business and label them core, supporting or generic. Check whether your best people and biggest investments are going to the core.

3. **Run an Event Storming session**
Bring domain experts and developers together for a few hours. Map the events, mark the hot spots and draw candidate boundaries.

4. **Draw your context map**
Document the relationships that already exist, including the uncomfortable ones (conformist, shared database). Making them visible is the first step to fixing them.

5. **Protect the core with an ACL**
Identify the legacy or external integration that leaks the most into your core model and wrap it in an anti-corruption layer.

6. **Enforce boundaries before distributing**
Start with a modular monolith or strict module boundaries, one schema per context and architecture tests. Extract services only when there's a concrete reason.

7. **Align teams with contexts**
Review who owns what. Every context should have exactly one owning team, with a cognitive load it can handle.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://martinfowler.com/bliki/BoundedContext.html" target="_blank" rel="noopener">Martin Fowler: Bounded Context</a></li>
    <li><a href="https://martinfowler.com/bliki/UbiquitousLanguage.html" target="_blank" rel="noopener">Martin Fowler: Ubiquitous Language</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://martinfowler.com/bliki/MonolithFirst.html" target="_blank" rel="noopener">Martin Fowler: Monolith First</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/microservices/model/domain-analysis" target="_blank" rel="noopener">Microsoft Learn: Using domain analysis to model microservices</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/anti-corruption-layer" target="_blank" rel="noopener">Microsoft Learn: Anti-corruption Layer pattern</a></li>
    <li><a href="https://www.domainlanguage.com/ddd/" target="_blank" rel="noopener">Domain Language: Domain-Driven Design (Eric Evans)</a></li>
    <li><a href="https://www.eventstorming.com/" target="_blank" rel="noopener">EventStorming (Alberto Brandolini)</a></li>
    <li><a href="https://teamtopologies.com/" target="_blank" rel="noopener">Team Topologies (Matthew Skelton and Manuel Pais)</a></li>
  </ul>
</div>
