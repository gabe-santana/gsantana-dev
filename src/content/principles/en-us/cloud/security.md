---
title: Security
short: Protecting confidentiality, integrity and availability in a world where the perimeter is gone. After all, who wants to find out about a breach from the news?
category: cloud
---

## Introduction

Security is the pillar everybody claims to care about and almost nobody wants to pay for until the day something goes wrong. The **goal** of this principle is simple to state and hard to live by: **protect the workload, its data and its users against intentional and accidental threats, for as long as the workload exists**.

In the cloud, that job changed shape. There's no longer a physical wall around "our servers" with a firewall at the door. Your *workload* talks to managed services over public endpoints, developers deploy from their laptops, pipelines hold credentials to production, and a single misconfigured checkbox can expose millions of records to the whole internet. The attack surface isn't a building anymore, it's a set of identities, configurations and APIs.

When a team neglects this design principle, the symptoms show up long before the incident does. It's common to see:

- Everyone with *Owner* or *Admin* on the production subscription "because it's easier";
- Passwords, connection strings and API keys committed to the repository, pasted into chat or saved in a wiki page;
- Storage accounts, buckets and databases with public access nobody remembers enabling;
- Logs that nobody reads, or worse, no logs at all, so nobody can answer "what happened?" after an incident;
- A flat network where any compromised machine can reach the database directly;
- No idea which data is sensitive, so everything is protected the same way (usually badly);
- An incident response plan that consists of "call the one person who knows how it works".

Yep, *it's rare, but it happens all the time*... Who hasn't opened a cloud console and found a resource called `test-export-final-2` sitting there with public access enabled since two years ago? Security failures in the cloud are rarely sophisticated movie-style hacks. Most of the time, someone simply left the door open.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But we're in the cloud now! Isn't security the provider's problem? They have entire armies of security engineers, right?"</span>
    </div>
  </div>
</div>

Easy there, Junior! They do have armies of security engineers, and they protect their part of the deal extremely well. The problem is that "their part" is smaller than most people think. The provider guarantees nobody walks into the datacenter and steals a disk. It does not guarantee that you won't make your own storage account public, hand out admin rights to an intern's personal account or keep a database password in plain text. That split has a name, the **shared responsibility model**, and we'll get there in a minute.

<div class="callout info">
  <p>Security isn't a product you buy or a phase at the end of the project. It's a <strong>property of the design</strong>, maintained continuously by the <strong>team</strong>: every decision about identity, network, data and operations either strengthens it or weakens it.</p>
</div>

## The CIA Triad: What We're Actually Protecting

Before talking about tools, it helps to agree on what "secure" means. The classic model is the **CIA triad**, and every security control you'll ever implement protects at least one of its three corners:

| Property | What it means | What a failure looks like |
| :--- | :--- | :--- |
| **Confidentiality** | Only authorized people and systems can read the data. | Customer data leaked from a public bucket; an employee reading records they have no business seeing. |
| **Integrity** | Data and systems are only changed by authorized actors, in authorized ways, and changes can be detected. | Someone alters prices in the database; a compromised build injects malicious code; logs are tampered with to hide an intrusion. |
| **Availability** | Authorized users can access the system when they need it. | A DDoS attack takes the site down; ransomware encrypts the production database; an attacker deletes your backups. |

Notice that availability is also a security concern, not only a reliability one. Ransomware is, at its core, an attack on availability (and increasingly on confidentiality too, with the "pay or we publish" double extortion). That's why this pillar and [Reliability](/en-us/principles/cloud/reliability/) are such close neighbors: an immutable backup is both a reliability control and a security control.

The triad also helps prioritize. A public marketing site cares a lot about integrity (nobody wants a defaced homepage) and availability, and much less about confidentiality. A medical records system flips that around. Knowing which corner matters most for each piece of data is the first step toward protecting it proportionally, instead of protecting everything the same way.

## The Shared Responsibility Model

Back to Junior's question. In the cloud, security duties are split between you and the provider, and **where the line falls depends on the service model**:

- **IaaS (virtual machines, virtual networks):** the provider handles the physical datacenter, hardware and hypervisor. Everything above that is yours: the operating system, its patches, the runtime, the application, network rules, identities and data.
- **PaaS (managed databases, App Service, serverless functions):** the provider also takes the OS and runtime. You still own the application code, its configuration, access control and the data. Network controls become a shared job: the provider gives you private endpoints and firewalls, you have to actually turn them on.
- **SaaS (email, CRM, office suites):** the provider runs almost everything. You still own **who has access** and **what data you put in there**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 370" role="img" aria-labelledby="sec-d1-title sec-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d1-title">Shared responsibility by service model</title>
<desc id="sec-d1-desc">A matrix with IaaS, PaaS and SaaS as columns and five layers as rows. Data and identities always belong to the customer, the physical datacenter always belongs to the provider, and the layers in between move from customer to provider as you go from IaaS to SaaS.</desc>
<text x="295" y="58" text-anchor="middle" class="d-label">IAAS</text>
<text x="465" y="58" text-anchor="middle" class="d-label">PAAS</text>
<text x="635" y="58" text-anchor="middle" class="d-label">SAAS</text>
<text x="190" y="105" text-anchor="end" class="d-text">Data and identities</text>
<rect x="220" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="105" text-anchor="middle" class="d-text">You</text>
<rect x="390" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="465" y="105" text-anchor="middle" class="d-text">You</text>
<rect x="560" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="635" y="105" text-anchor="middle" class="d-text">You</text>
<text x="190" y="153" text-anchor="end" class="d-text">Applications</text>
<rect x="220" y="128" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="153" text-anchor="middle" class="d-text">You</text>
<rect x="390" y="128" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="465" y="153" text-anchor="middle" class="d-text">You</text>
<rect x="560" y="128" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="153" text-anchor="middle" class="d-text">Provider</text>
<text x="190" y="201" text-anchor="end" class="d-text">Runtime and OS</text>
<rect x="220" y="176" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="201" text-anchor="middle" class="d-text">You</text>
<rect x="390" y="176" width="150" height="40" rx="10" class="d-box-info"/>
<text x="465" y="201" text-anchor="middle" class="d-text">Provider</text>
<rect x="560" y="176" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="201" text-anchor="middle" class="d-text">Provider</text>
<text x="190" y="249" text-anchor="end" class="d-text">Network controls</text>
<rect x="220" y="224" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="249" text-anchor="middle" class="d-text">You</text>
<rect x="390" y="224" width="150" height="40" rx="10" class="d-box-warn"/>
<text x="465" y="249" text-anchor="middle" class="d-text">Shared</text>
<rect x="560" y="224" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="249" text-anchor="middle" class="d-text">Provider</text>
<text x="190" y="297" text-anchor="end" class="d-text">Physical datacenter</text>
<rect x="220" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="295" y="297" text-anchor="middle" class="d-text">Provider</text>
<rect x="390" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="465" y="297" text-anchor="middle" class="d-text">Provider</text>
<rect x="560" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="297" text-anchor="middle" class="d-text">Provider</text>
<rect x="160" y="336" width="14" height="14" rx="3" class="d-fill-accent"/>
<text x="182" y="348" class="d-small">You (customer)</text>
<rect x="320" y="336" width="14" height="14" rx="3" class="d-fill-warn"/>
<text x="342" y="348" class="d-small">Shared</text>
<rect x="440" y="336" width="14" height="14" rx="3" class="d-fill-info"/>
<text x="462" y="348" class="d-small">Cloud provider</text>
</svg>
</div>
<figcaption>Figure 1: The line of responsibility moves up as you go from IaaS to SaaS, but data and identities never leave your side</figcaption>
</figure>

The top row is the one that matters most: **data and identities are always yours**, no matter the service model. There's no SaaS so managed that it will stop you from sharing a spreadsheet with "anyone with the link". This is also why moving to PaaS is, in general, a security win: every layer the provider takes over is a layer you no longer have to patch at 2 a.m. when a new vulnerability hits the news.

<div class="callout warning">
  <p>The most common cloud breaches don't exploit the provider's side of the model. They exploit the customer's side: <strong>misconfigurations, leaked credentials and excessive permissions</strong>. The provider's security is a foundation, not a guarantee.</p>
</div>

## Zero Trust: Never Trust, Always Verify

For decades, the dominant model was the castle and moat: a strong perimeter, and once you were inside the corporate network, you were trusted. That model aged badly. Remote work, SaaS, mobile devices, partners, APIs and the cloud itself dissolved the perimeter. And attackers learned the obvious lesson: get one foothold inside (a phished laptop, a vulnerable VM) and the "trusted" network hands you everything else.

**Zero Trust** replaces that implicit trust with three principles:

### 1. Verify explicitly

Every request is authenticated and authorized based on all available signals: the identity, its strength of authentication (was MFA used?), the device's health, the location, the resource being accessed and whether the behavior is unusual. Being "on the internal network" is not a credential.

### 2. Use least-privilege access

Give each identity, human or machine, only the permissions it needs, only on the resources it needs, and preferably only for the time it needs them (*just-in-time* and *just-enough* access). Permissions are a liability: each one is something an attacker inherits if that identity is compromised.

### 3. Assume breach

Design as if the attacker is already inside, because one day they will be. Segment everything to limit the *blast radius*, encrypt data end to end, collect telemetry so you can detect lateral movement, and have a plan for when (not if) something is compromised.

<div class="callout info">
  <p>Zero Trust isn't a product and isn't something you "finish". It's a strategy you apply layer by layer: identity first, then devices, network, applications and data. Any vendor promising "Zero Trust in a box" is selling you one piece of the puzzle.</p>
</div>

## The Story of the Forgotten Public Bucket

Before we get into the practices, let me tell you a story. You've probably read a version of it in the news, with different company names, many times.

A developer needs to send a large data export to a partner. The file is too big for email, so they create a storage bucket, upload the export and, to make the partner's life easier, enable public read access. "It's temporary, I'll delete it on Friday." Friday comes with a production incident. The bucket stays. Nobody tagged it with an owner, it isn't in any IaC repository, and it costs a few cents a month, so it never shows up in the cost review either.

Meanwhile, on the internet, automated scanners enumerate bucket names around the clock, day and night, looking for exactly this. Eventually one finds it. A few days later, the export (full of customer names, emails and document numbers) is being sold on a forum, and the company learns about it from a journalist asking for comment.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="sec-d2-title sec-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d2-title">Timeline of a forgotten public bucket</title>
<desc id="sec-d2-desc">A timeline with five events: a bucket is created for a quick export, it is made public to share a file, it is forgotten with no owner, an automated scanner finds it and the data leaks. Below, the guardrails that would have broken the chain: policies blocking public access, mandatory owner tags and posture scanning.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">HOW A TEMPORARY SHORTCUT BECOMES A BREACH</text>
<line x1="80" y1="130" x2="500" y2="130" class="d-line"/>
<line x1="500" y1="130" x2="640" y2="130" class="d-line-danger"/>
<circle cx="80" cy="130" r="9" class="d-fill-muted"/>
<circle cx="220" cy="130" r="9" class="d-fill-warn"/>
<circle cx="360" cy="130" r="9" class="d-fill-warn"/>
<circle cx="500" cy="130" r="9" class="d-fill-danger"/>
<circle cx="640" cy="130" r="9" class="d-fill-danger"/>
<text x="80" y="100" text-anchor="middle" class="d-label">DAY 0</text>
<text x="220" y="100" text-anchor="middle" class="d-label">DAY 3</text>
<text x="360" y="100" text-anchor="middle" class="d-label">DAY 90</text>
<text x="500" y="100" text-anchor="middle" class="d-label">DAY 400</text>
<text x="640" y="100" text-anchor="middle" class="d-label">DAY 401</text>
<text x="80" y="168" text-anchor="middle" class="d-text">Bucket created</text>
<text x="80" y="188" text-anchor="middle" class="d-small">for a quick export</text>
<text x="220" y="168" text-anchor="middle" class="d-text">Made public</text>
<text x="220" y="188" text-anchor="middle" class="d-small">to share one file</text>
<text x="360" y="168" text-anchor="middle" class="d-text">Forgotten</text>
<text x="360" y="188" text-anchor="middle" class="d-small">no owner, no tag</text>
<text x="500" y="168" text-anchor="middle" class="d-text">Found by a bot</text>
<text x="500" y="188" text-anchor="middle" class="d-small">mass scanning</text>
<text x="640" y="168" text-anchor="middle" class="d-text">Data breach</text>
<text x="640" y="188" text-anchor="middle" class="d-small">headlines, fines</text>
<rect x="40" y="228" width="640" height="64" rx="10" class="d-box-accent"/>
<text x="360" y="254" text-anchor="middle" class="d-title">Guardrails that break the chain</text>
<text x="360" y="276" text-anchor="middle" class="d-small">block public access by policy, mandatory owner tag, posture scanning (CSPM)</text>
</svg>
</div>
<figcaption>Figure 2: No single step looked dangerous at the time, and that is exactly the problem</figcaption>
</figure>

What makes this story so instructive is that **nobody was malicious and nobody did anything that felt risky**. Every step was a reasonable shortcut in isolation. And every step was also a missing control:

- A policy denying public access on storage (at the organization level, not per bucket) would have blocked day 3;
- A secure alternative (a time-limited signed URL, or a proper file-transfer channel) would have made the shortcut unnecessary;
- Mandatory owner and expiration tags would have given day 90 a name to call;
- A posture management tool (CSPM) scanning for public resources would have raised an alert long before day 400;
- Data classification would have flagged that this export contained personal data and should never leave a controlled location.

Keep this story in mind. Almost every practice below is, in some way, a link in the chain that would have prevented it.

## Design Principles for Security

The following practices follow the structure of the Well-Architected Security pillar found in the major cloud frameworks. As always, they're not a checklist to apply blindly; they're guidelines you prioritize based on the risk and value of your *workload*.

### 1. Identity is the new perimeter

**Goal:** Make sure every access to every resource comes from a known, strongly authenticated identity with the minimum permissions it needs.

If the network is no longer the boundary, identity is. In the cloud, whoever holds a valid credential with enough permissions can do almost anything, from anywhere, without touching your firewall. That makes identity the most valuable target and the most important control.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Can't I just give myself Owner on the production subscription? Every time I need something I have to open a ticket, and it's so much faster this way!"</span>
    </div>
  </div>
</div>

Faster for you, Junior, and also faster for whoever steals your session token. A standing Owner role means that a single phishing email, a malicious browser extension or a token left in a log file gives an attacker the keys to the entire kingdom, 24 hours a day, 365 days a year. The good news is that we don't have to choose between "open a ticket for everything" and "everyone is admin". That's exactly what *just-in-time* access is for.

| Approach | Security Benefit |
| :--- | :--- |
| **Use managed identities for workloads.** Let your apps authenticate to databases, queues and key vaults with platform-managed identities (managed identities, IAM roles for services, workload identity federation) instead of passwords or keys. | There's no secret to leak, rotate or forget in a config file. The platform issues short-lived tokens automatically, and the credential can't be copied out and reused elsewhere. |
| **Require MFA for every human identity**, especially privileged ones, and prefer phishing-resistant methods (FIDO2 keys, passkeys, platform authenticators). | Stolen passwords stop being enough. MFA blocks the vast majority of account takeover attempts based on credential stuffing and password spraying. |
| **Apply role-based access control (RBAC) with least privilege.** Use built-in roles that match real tasks, scope them to the smallest resource group or project possible, and assign them to groups, not individuals. | Limits what a compromised identity can do and where. Group-based assignment makes access reviews and offboarding manageable. |
| **Use privileged identity management and just-in-time elevation (PIM/JIT).** Admins are eligible for high-privilege roles but activate them only when needed, for a limited time, with justification and, for the most sensitive roles, approval. | Removes standing privilege. Most of the time, nobody has admin rights to steal, and every elevation leaves an audit trail. |
| **Use conditional access.** Evaluate device compliance, location and risk signals before granting access, and block legacy protocols that can't do MFA. | Implements "verify explicitly": a valid password from an unmanaged device in an unusual country isn't treated the same as a sign-in from a managed laptop. |
| **Review access periodically and automate the joiner/mover/leaver lifecycle.** | Permissions accumulate over time ("privilege creep"). Regular reviews and automatic removal when someone changes teams or leaves keep the blast radius small. |
| **Protect emergency access.** Keep one or two break-glass accounts, excluded from normal policies, with strong credentials stored securely and alerts on every use. | You don't lock yourself out during an identity provider outage, and any use of these accounts is immediately visible. |

<div class="callout tip">
  <p>A good maturity signal: if you ask "who can delete the production database right now?", the answer should be a short list, preferably empty, with everyone else needing to go through a time-limited, audited elevation.</p>
</div>

### 2. Segment the network and build defense in depth

**Goal:** Make sure that when one control fails (and one will), other layers still stand between the attacker and what matters.

Identity is the primary perimeter, but it isn't the only one. **Defense in depth** means stacking independent controls so that no single failure leads directly to a breach. Each layer assumes the one outside it might have been breached.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 440" role="img" aria-labelledby="sec-d3-title sec-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d3-title">Defense in depth layers</title>
<desc id="sec-d3-desc">Six nested layers protecting the data at the center: identity on the outside, then perimeter, network, compute, application and finally the encrypted data itself.</desc>
<text x="360" y="24" text-anchor="middle" class="d-label">EACH LAYER ASSUMES THE OUTER ONE CAN FAIL</text>
<rect x="40" y="40" width="640" height="380" rx="10" class="d-box-accent"/>
<text x="56" y="62" class="d-text">Identity</text>
<text x="664" y="62" text-anchor="end" class="d-small">MFA, RBAC, just-in-time</text>
<rect x="90" y="72" width="540" height="316" rx="10" class="d-box-info"/>
<text x="106" y="94" class="d-text">Perimeter</text>
<text x="614" y="94" text-anchor="end" class="d-small">DDoS protection, WAF</text>
<rect x="140" y="104" width="440" height="252" rx="10" class="d-box-warn"/>
<text x="156" y="126" class="d-text">Network</text>
<text x="564" y="126" text-anchor="end" class="d-small">segments, private endpoints</text>
<rect x="190" y="136" width="340" height="188" rx="10" class="d-box"/>
<text x="206" y="158" class="d-text">Compute</text>
<text x="514" y="158" text-anchor="end" class="d-small">hardened, patched</text>
<rect x="240" y="168" width="240" height="124" rx="10" class="d-box-info"/>
<text x="256" y="190" class="d-text">Application</text>
<text x="464" y="190" text-anchor="end" class="d-small">authZ, validation</text>
<rect x="290" y="200" width="140" height="60" rx="10" class="d-box-danger"/>
<text x="360" y="226" text-anchor="middle" class="d-title">Data</text>
<text x="360" y="246" text-anchor="middle" class="d-small">encrypted</text>
</svg>
</div>
<figcaption>Figure 3: Defense in depth, the data at the center is protected by independent layers</figcaption>
</figure>

On the network side, the key idea is **segmentation**: instead of one big flat network where everything talks to everything, divide the workload into zones with explicit, minimal flows between them.

| Approach | Security Benefit |
| :--- | :--- |
| **Segment by function and sensitivity.** Separate front end, application and data tiers into different subnets or VPCs, and separate environments (dev, test, prod) into different subscriptions or accounts. | A compromised web server can't reach the database directly, and a compromised dev environment can't touch production. The blast radius shrinks to a single segment. |
| **Deny by default.** Network security groups and firewall rules should start closed and allow only the specific flows the workload needs. | Every open port is a door. Explicit allow lists make the intended architecture visible and anything else suspicious. |
| **Use private endpoints for PaaS services.** Databases, storage and key vaults should be reachable only from your private network, with public access disabled. | Removes the service from the internet entirely. Even a leaked connection string is useless from outside your network. |
| **Protect the edge.** Put a WAF and DDoS protection in front of public entry points, and centralize egress through a firewall that controls where workloads can call out to. | Filters common web attacks (the OWASP Top 10 kind) before they reach the app, absorbs volumetric attacks and makes data exfiltration to arbitrary destinations much harder. |
| **Eliminate direct admin access from the internet.** No RDP or SSH exposed publicly; use a bastion service or JIT VM access instead. | Management ports are among the most scanned on the internet. Closing them removes a huge class of brute-force attacks. |
| **Harden compute.** Use minimal, patched base images, disable unused services and keep patching automated. | Fewer components mean fewer vulnerabilities, and automated patching closes the window between disclosure and exploitation. |

Notice how the forgotten bucket story fits here: with public access disabled by policy and the storage reachable only through a private endpoint, the bot on day 400 would have found nothing to scan.

### 3. Protect the data

**Goal:** Know what data you have, how sensitive it is, and protect it accordingly, at rest, in transit and in use.

At the end of the day, attackers rarely want your servers. They want your data. And you can't protect data properly if you don't know what it is or where it lives.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"I put the database connection string in appsettings.json, but relax, the repository is private! Only our team can see it."</span>
    </div>
  </div>
</div>

Oh, Junior... "Private" today. Then someone forks it to a personal account, a CI log prints the config, a contractor gets read access, the repository is accidentally made public during a migration, or a developer's laptop gets stolen. And even if none of that happens, the secret is now in the Git history forever: deleting it in the next commit doesn't remove it. Secrets in source code are one of the most common entry points in real incidents, and bots scan public repositories for them within minutes of a push.

The fix is simple: secrets live in a **secrets manager** (Azure Key Vault, AWS Secrets Manager, Google Secret Manager, HashiCorp Vault), are read at runtime by a managed identity and, better yet, disappear entirely wherever the service supports identity-based authentication.

| Approach | Security Benefit |
| :--- | :--- |
| **Classify your data.** Label data by sensitivity (public, internal, confidential, restricted) and by regulatory scope (personal data under LGPD or GDPR, payment data under PCI DSS, health data). | Lets you apply stronger controls where they matter instead of spreading effort evenly. Classification drives decisions on encryption, retention, access and where data can be stored. |
| **Encrypt data at rest.** Enable storage and database encryption (on by default on most platforms), and for sensitive or regulated data, consider customer-managed keys. | A stolen disk, snapshot or backup is useless without the key. Customer-managed keys give you control over revocation and key rotation. |
| **Encrypt data in transit.** Enforce TLS 1.2 or later everywhere, including internal traffic between services, and reject plain HTTP. | Protects against eavesdropping and tampering on the network, including inside your own VNet, in line with "assume breach". |
| **Manage keys properly.** Store keys in a key management service or HSM, separate key administrators from data administrators, enable soft delete and purge protection, and rotate keys on a schedule. | The key is the real secret. Separation of duties prevents a single admin from both accessing data and hiding the evidence, and purge protection stops an attacker from destroying keys to hold your data hostage. |
| **Centralize secrets and rotate them.** Never store secrets in code, config files, container images or pipeline variables in plain text. Automate rotation and alert on expiration. | A leaked secret has a limited lifetime, and you always know where every secret lives and who can read it. |
| **Minimize and mask data.** Collect only what you need, keep it only as long as required, and mask or tokenize sensitive fields in non-production environments and logs. | Data you don't have can't leak. Test environments stop being a back door to production data. |
| **Protect backups.** Keep immutable or logically air-gapped backups, in a separate security boundary from production. | Ransomware operators go after backups first. An immutable copy turns a catastrophe into a bad day. |

<div class="callout warning">
  <p>A classic trap: production data copied to a test environment "just to debug one issue". Test environments usually have weaker controls, broader access and less monitoring. If real personal data lands there, that environment is now in regulatory scope, whether you like it or not.</p>
</div>

### 4. Model threats at the workload level

**Goal:** Identify, before an attacker does, how the workload could be abused, and prioritize controls based on real risk.

Threat modeling sounds intimidating, but at its heart it's a structured conversation around four questions (popularized by Adam Shostack and the OWASP community):

1. **What are we building?** Draw the architecture: components, data flows, trust boundaries (where data crosses from a less trusted zone into a more trusted one) and where sensitive data lives.
2. **What can go wrong?** Walk each flow and component looking for threats.
3. **What are we going to do about it?** Mitigate, transfer, accept or avoid each threat, with a clear owner.
4. **Did we do a good job?** Validate that the mitigations exist and work, and revisit the model when the architecture changes.

A popular technique for question 2 is **STRIDE**, which gives the team a vocabulary so the conversation doesn't depend on who happens to be most paranoid in the room:

| Threat | Violates | Workload example | Typical mitigation |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Authentication | Someone calls the internal API pretending to be the order service. | Managed identities, mutual TLS, token validation. |
| **Tampering** | Integrity | A message in the queue is altered between producer and consumer. | Signed messages, access control on the queue, integrity checks. |
| **Repudiation** | Non-repudiation | An admin deletes records and there's no way to prove who did it. | Immutable audit logs, centralized logging with restricted access. |
| **Information disclosure** | Confidentiality | An error message returns a stack trace with connection details. | Generic error responses, secrets management, encryption. |
| **Denial of service** | Availability | A single tenant floods the API and takes it down for everyone. | Rate limiting, quotas, DDoS protection, autoscaling limits. |
| **Elevation of privilege** | Authorization | A regular user changes an ID in the URL and edits another customer's data. | Authorization checks on every request, least-privilege roles. |

Do it as a team, with a whiteboard, during design and whenever the architecture changes significantly: a new integration, a new data store, a new public endpoint. The output doesn't need to be a 50-page document. A diagram with trust boundaries and a prioritized list of threats, each with an owner, already puts you ahead of most teams.

<div class="callout info">
  <p>Some security work belongs even earlier, inside the delivery pipeline itself: static analysis (SAST), dependency and container scanning, secret scanning on commits, infrastructure-as-code checks and software supply chain protection. That's the subject of <a href="/en-us/principles/solution/security-shift-left/">Security Shift-Left</a>. This pillar focuses on the workload once it's designed and running.</p>
</div>

### 5. Monitor, detect and respond

**Goal:** Detect suspicious activity quickly, contain it before it spreads and learn from every incident.

"Assume breach" has a practical consequence: you need to be able to **see** the breach. The average time between an intrusion and its discovery is still measured in weeks or months in many organizations. Every day an attacker goes unnoticed is a day of lateral movement, privilege escalation and data exfiltration.

| Approach | Security Benefit |
| :--- | :--- |
| **Collect the right telemetry.** Identity sign-ins and audit logs, control plane activity (who created, changed or deleted what), network flows, WAF and firewall logs, and application security events. | You can reconstruct what happened. Without control plane logs, "who made this bucket public?" has no answer. |
| **Centralize in a SIEM.** Send security-relevant logs to a SIEM (Microsoft Sentinel, Google Security Operations, Splunk, Elastic and others) with retention that meets your investigation and compliance needs. | Correlation across sources: a sign-in from an unusual country followed by a mass download is a pattern no single log shows. |
| **Protect the logs themselves.** Store them in a separate security boundary, with restricted, immutable access. | The first thing a competent attacker does is try to erase their tracks. |
| **Use posture management and threat detection.** Enable the provider's cloud security posture management (CSPM) and workload protection (CWPP) tools, such as Microsoft Defender for Cloud, AWS Security Hub and GuardDuty, or Google Security Command Center. | Continuous detection of misconfigurations (like our public bucket) and known attack patterns, without building everything from scratch. |
| **Tune alerts and automate response.** Start with high-fidelity detections, route them to people who can act, and automate repetitive containment with SOAR playbooks (disable a user, isolate a VM, revoke a token). | Avoids alert fatigue, where the real alert drowns among thousands of false positives, and shortens the time to contain. |
| **Have an incident response plan and practice it.** Define roles, communication channels, legal and regulatory notification obligations, and run tabletop exercises. | In a real incident, nobody should be discovering who to call. Regulations such as LGPD and GDPR have notification deadlines, and the clock starts ticking the moment you know. |

A mature incident response process follows a cycle, not a straight line. The NIST incident handling model describes it in phases, which we can simplify like this:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="sec-d4-title sec-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d4-title">Incident response cycle</title>
<desc id="sec-d4-desc">A four-step cycle: prepare, detect and analyze, contain and recover, and learn, which feeds back into preparation. SIEM and SOAR telemetry supports every step.</desc>
<defs><marker id="sec-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="80" y="50" width="200" height="64" rx="10" class="d-box-accent"/>
<text x="180" y="78" text-anchor="middle" class="d-title">1. Prepare</text>
<text x="180" y="100" text-anchor="middle" class="d-small">runbooks, roles, drills</text>
<rect x="440" y="50" width="200" height="64" rx="10" class="d-box-info"/>
<text x="540" y="78" text-anchor="middle" class="d-title">2. Detect and analyze</text>
<text x="540" y="100" text-anchor="middle" class="d-small">SIEM alerts, triage</text>
<rect x="440" y="210" width="200" height="64" rx="10" class="d-box-danger"/>
<text x="540" y="238" text-anchor="middle" class="d-title">3. Contain and recover</text>
<text x="540" y="260" text-anchor="middle" class="d-small">isolate, eradicate, restore</text>
<rect x="80" y="210" width="200" height="64" rx="10" class="d-box-warn"/>
<text x="180" y="238" text-anchor="middle" class="d-title">4. Learn</text>
<text x="180" y="260" text-anchor="middle" class="d-small">blameless post-mortem</text>
<line x1="280" y1="82" x2="436" y2="82" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="540" y1="114" x2="540" y2="206" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="440" y1="242" x2="284" y2="242" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="180" y1="210" x2="180" y2="118" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<text x="360" y="156" text-anchor="middle" class="d-label">SIEM + SOAR</text>
<text x="360" y="176" text-anchor="middle" class="d-small">telemetry feeds every step</text>
</svg>
</div>
<figcaption>Figure 4: Incident response is a cycle, and every incident should make the next preparation better</figcaption>
</figure>

The "learn" step is the one teams skip most often, and it's the one that makes the others improve. A blameless post-mortem asks *how did our system allow this?*, not *who messed up?*. In the bucket story, "the developer forgot to delete it" is a useless conclusion. "Our platform allowed public buckets without an owner and nothing alerted us for a year" is a conclusion that leads to real fixes. This is the same continuous improvement mindset we discussed in [Operational Excellence](/en-us/principles/cloud/operational-excellence/), applied to security.

## Tradeoffs

Security protects the confidentiality, integrity and availability of the *workload*. But like every pillar, it doesn't live alone: security controls cost money, add latency, create operational work and can even reduce availability if designed carelessly.

**But watch out:** the answer to a tradeoff is never "turn security off". It's to choose controls proportional to the risk, understand what they cost and document the decision. Let's look at some practical examples.

### Tradeoffs with Performance Efficiency

**Added latency:** every inspection layer (WAF, firewall, TLS termination and re-encryption, a security proxy, token validation) adds processing time to each request.

**Resource consumption:** encryption, deep packet inspection, security agents on VMs and detailed logging consume CPU, memory and I/O that the application could otherwise use.

**Reduced caching opportunities:** sensitive, per-user data can't be cached at the edge like public content, and strict isolation may prevent sharing resources that would improve efficiency.

**Private networking complexity:** routing everything through private endpoints and central firewalls can introduce extra hops and bottlenecks if the network isn't designed for the throughput. See [Performance Efficiency](/en-us/principles/cloud/performance-efficiency/) for how to budget for this.

### Tradeoffs with Cost Optimization

**More infrastructure:** WAFs, firewalls, DDoS protection plans, bastion hosts, HSMs, private endpoints and separate environments per security boundary all show up on the bill.

**Telemetry is expensive:** SIEM ingestion and long retention of security logs can become one of the largest line items in the cloud bill. You'll need to decide which logs are worth the money.

**Tools and people:** security tooling, audits, penetration tests, certifications and specialized staff (or a managed SOC) are real costs.

**Redundancy for isolation:** separate subscriptions, accounts or clusters to isolate sensitive workloads reduce density and resource sharing, which goes against what [Cost Optimization](/en-us/principles/cloud/cost-optimization/) would like. Then again, compare it with the cost of a breach, fines included.

### Tradeoffs with Operational Excellence

**More friction:** JIT elevation, approvals, restricted production access and change controls make some operational tasks slower. During an incident, that friction can hurt if the break-glass process isn't well rehearsed.

**More complexity:** key rotation, certificate renewal, secret management, policy exceptions and access reviews are recurring operational work that needs automation, or it becomes toil.

**Harder troubleshooting:** private networks, encrypted traffic and masked logs make debugging harder. "I can't reproduce it because I can't see the data" is a real complaint.

**Observability tension:** operations wants rich logs, and security wants no sensitive data in them. Both are right, which is why log classification and masking matter.

### Tradeoffs with Reliability

**New failure points:** the identity provider, the key management service and the central firewall become critical dependencies. If the key vault is unavailable and the app can't read its secrets, the workload goes down with it.

**Self-inflicted outages:** an expired certificate, a rotated secret that wasn't propagated or an overly aggressive firewall rule are classic causes of downtime.

**Lockout risk:** strict policies can block legitimate recovery actions, such as restoring a backup to another region if that region isn't allowed. Recovery procedures must be designed with security controls in mind, and tested.

**Aggressive protections:** DDoS mitigation or rate limiting tuned too tightly can block legitimate traffic peaks, which is precisely the kind of availability problem [Reliability](/en-us/principles/cloud/reliability/) tries to avoid.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Wait... so if security makes everything slower, more expensive and harder to operate, why not just add it later, once the product is making money?"</span>
    </div>
  </div>
</div>

Because "later" is exactly when it costs the most, Junior! Retrofitting managed identities, network segmentation and data classification onto a workload that's already in production is painful, risky and expensive. And if "later" happens to come after a breach, you'll be doing it under pressure, with lawyers on the call and customers asking questions. The secret, as with every pillar, is **proportionality**: a startup MVP doesn't need the same controls as a bank, but it does need the basics (MFA, no secrets in code, no public data stores, least privilege and logs) from day one. Those basics are cheap. Breaches aren't.

## Conclusion

**Security** isn't a feature you add at the end or a product you buy from a vendor. It's a property of the architecture, built from the first design session and maintained for as long as the workload runs. In the cloud, the perimeter has moved to **identity**, most breaches come from the customer's side of the **shared responsibility model**, and the right mindset is **Zero Trust**: verify explicitly, grant least privilege and assume breach.

The practices in this principle fit together: strong identities with just-in-time privilege, segmented networks and defense in depth, classified and encrypted data with properly managed keys and secrets, threat modeling as a team habit, and monitoring with a rehearsed incident response plan. None of them is enough alone, and that's the point: each layer covers the gaps of the others.

**Most importantly:** security comes with tradeoffs in performance, cost, operations and reliability. A mature team doesn't ignore them and doesn't use them as excuses. It makes informed, proportional decisions, documents them and revisits them as the workload and the threats evolve. And it remembers the forgotten bucket: the biggest risks are rarely the most sophisticated ones.

## Next Steps

1. **Map your responsibilities**
For each service your workload uses, identify where the shared responsibility line falls and list which controls are yours. Pay special attention to data and identities.

2. **Lock down identities first**
Enforce MFA for everyone, move workloads to managed identities, remove standing admin access in favor of just-in-time elevation and schedule periodic access reviews.

3. **Hunt for public exposure**
Inventory every resource with public access (storage, databases, management ports, APIs) and close what doesn't need to be public. Then prevent it from coming back with organization-level policies.

4. **Get secrets out of code**
Scan your repositories and pipelines for secrets, move them to a secrets manager, rotate anything that has ever been exposed and enable secret scanning to block new ones.

5. **Classify and protect your data**
Identify where sensitive and regulated data lives, apply encryption and access controls proportional to its classification and keep real data out of test environments.

6. **Run a threat modeling session**
Pick your most critical workload, draw its data flows and trust boundaries, walk through STRIDE with the team and turn the findings into prioritized backlog items with owners.

7. **Make sure you can see and respond**
Centralize security logs in a SIEM, enable posture management, write an incident response plan and rehearse it with a tabletop exercise before you need it for real.

8. **Move security earlier**
Complement these runtime controls with checks inside the delivery pipeline, as described in [Security Shift-Left](/en-us/principles/solution/security-shift-left/).

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/security/" target="_blank" rel="noopener">Azure Well-Architected Framework: Security pillar</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://learn.microsoft.com/security/zero-trust/" target="_blank" rel="noopener">Microsoft Zero Trust guidance</a></li>
    <li><a href="https://csrc.nist.gov/pubs/sp/800/207/final" target="_blank" rel="noopener">NIST SP 800-207: Zero Trust Architecture</a></li>
    <li><a href="https://owasp.org/www-community/Threat_Modeling" target="_blank" rel="noopener">OWASP: Threat Modeling</a></li>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top Ten</a></li>
  </ul>
</div>
