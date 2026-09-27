---
title: Security Shift-Left
short: Security that shows up only at the end of the project arrives as a bill. Bring it to the start and it arrives as a habit.
category: solution
---

## Introduction

For a long time, security worked like the final exam of a software project. The team spent months building, and then, a week before go-live, someone from the security department showed up with a scanner, a checklist and a 200-page PDF full of red findings. Cue the panic, the "exception approvals", and the launch that slipped by a month (or, worse, the launch that happened anyway, holes and all).

**Security Shift-Left** is the principle that flips this around: security work moves to the **left** of the delivery timeline, closer to design and code, where problems are cheaper to prevent and easier to fix. It's the heart of what the market calls **DevSecOps**: security stops being a gate at the end and becomes a property of the way the team builds software, every day.

When a team ignores this principle, the symptoms are pretty easy to spot:

- Security reviews that happen only right before release, turning into bottlenecks and last-minute fights;
- Vulnerabilities found in production that could have been caught by a free tool in the IDE;
- Passwords, tokens and connection strings living in the repository "just for now";
- Dependencies nobody has updated in years, with known CVEs that anyone can look up;
- A security team seen as "the department of no", and developers who see security as "someone else's problem";
- Pentest reports that repeat the same findings year after year, because nothing changed in the process;

Yep, *it's rare, but it happens all the time*... Who hasn't opened an old repository and found an `appsettings.Production.json` with the real database password sitting there, committed in 2019, by someone who left the company in 2020?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Confused junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"But we have a security team for that, right? My job is to ship features. They can run their scanner before we go live."</span>
    </div>
  </div>
</div>

Easy there, Junior! That's exactly the mindset this principle exists to fix. The security team can't be the only line of defense, for a very simple reason: there are usually a handful of security people for dozens (or hundreds) of developers. If every line of code needs to pass through their hands at the end, either they become a bottleneck or they start approving things without looking. Neither option ends well.

<div class="callout info">
  <p>Shifting left doesn't mean dumping all security work on developers. It means putting the <strong>right control in the right phase</strong>, automating what can be automated, and letting the security team act as enablers and specialists instead of a final checkpoint.</p>
</div>

## Why earlier is cheaper

There's an old idea in software engineering that the later a defect is found, the more expensive it is to fix. You'll find plenty of articles quoting precise multipliers ("100 times more expensive in production!"), and many of those numbers have shaky origins. We don't need them. The **trend** is obvious to anyone who has lived through it:

- During **design**, fixing a security flaw means changing a diagram or a paragraph in a document;
- During **coding**, it means changing a few lines before anyone else depends on them;
- After **merge**, it means a new branch, a new review, maybe reworking code that other features now rely on;
- In **staging**, it means reopening a closed story, retesting, and possibly moving a release date;
- In **production**, it means an incident, a hotfix under pressure, maybe customer notification, lawyers, regulators and a very uncomfortable meeting with the board.

And the cost isn't only money. The further right a vulnerability travels, the more context is lost. The developer who wrote the code has moved on to other things, the business rule that justified it is fuzzy, and the fix gets done by someone who is afraid to touch it.

The picture below shows the typical software delivery lifecycle, where each security control naturally lives, and the illustrative trend of how the cost to fix grows as you move right.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 350" role="img" aria-labelledby="ssl-d1-title ssl-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d1-title">Security controls across the delivery lifecycle</title>
<desc id="ssl-d1-desc">Eight lifecycle phases from design to operate, the security control that lives in each one, and bars showing that the cost to fix a vulnerability grows the later it is found. An arrow at the bottom indicates moving controls to the left.</desc>
<defs><marker id="ssl-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="380" y="26" text-anchor="middle" class="d-label">WHERE EACH CONTROL LIVES</text>
<rect x="17" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="58" y="71" text-anchor="middle" class="d-text">Design</text>
<rect x="109" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="150" y="71" text-anchor="middle" class="d-text">Code</text>
<rect x="201" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="242" y="71" text-anchor="middle" class="d-text">Commit</text>
<rect x="293" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="334" y="71" text-anchor="middle" class="d-text">Build</text>
<rect x="385" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="426" y="71" text-anchor="middle" class="d-text">Test</text>
<rect x="477" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="518" y="71" text-anchor="middle" class="d-text">Release</text>
<rect x="569" y="44" width="82" height="44" rx="10" class="d-box-warn"/>
<text x="610" y="71" text-anchor="middle" class="d-text">Deploy</text>
<rect x="661" y="44" width="82" height="44" rx="10" class="d-box-danger"/>
<text x="702" y="71" text-anchor="middle" class="d-text">Operate</text>
<text x="58" y="112" text-anchor="middle" class="d-small">STRIDE</text>
<text x="58" y="128" text-anchor="middle" class="d-small">Sec reqs</text>
<text x="150" y="112" text-anchor="middle" class="d-small">IDE linters</text>
<text x="150" y="128" text-anchor="middle" class="d-small">Standards</text>
<text x="242" y="112" text-anchor="middle" class="d-small">Pre-commit</text>
<text x="242" y="128" text-anchor="middle" class="d-small">Secret scan</text>
<text x="334" y="112" text-anchor="middle" class="d-small">SAST, SCA</text>
<text x="334" y="128" text-anchor="middle" class="d-small">IaC scan</text>
<text x="426" y="112" text-anchor="middle" class="d-small">DAST</text>
<text x="426" y="128" text-anchor="middle" class="d-small">Image scan</text>
<text x="518" y="112" text-anchor="middle" class="d-small">SBOM, sign</text>
<text x="518" y="128" text-anchor="middle" class="d-small">Provenance</text>
<text x="610" y="112" text-anchor="middle" class="d-small">Verify sig</text>
<text x="610" y="128" text-anchor="middle" class="d-small">Policy gate</text>
<text x="702" y="112" text-anchor="middle" class="d-small">Runtime</text>
<text x="702" y="128" text-anchor="middle" class="d-small">Sec pillar</text>
<text x="17" y="166" class="d-label">COST TO FIX (TREND)</text>
<line x1="17" y1="290" x2="743" y2="290" class="d-line"/>
<rect x="38" y="280" width="40" height="10" rx="3" class="d-fill-accent"/>
<rect x="130" y="274" width="40" height="16" rx="3" class="d-fill-accent"/>
<rect x="222" y="268" width="40" height="22" rx="3" class="d-fill-accent"/>
<rect x="314" y="258" width="40" height="32" rx="3" class="d-fill-info"/>
<rect x="406" y="244" width="40" height="46" rx="3" class="d-fill-info"/>
<rect x="498" y="228" width="40" height="62" rx="3" class="d-fill-warn"/>
<rect x="590" y="210" width="40" height="80" rx="3" class="d-fill-warn"/>
<rect x="682" y="186" width="40" height="104" rx="3" class="d-fill-danger"/>
<line x1="700" y1="314" x2="60" y2="314" class="d-line-accent" marker-end="url(#ssl-d1-arrow)"/>
<text x="380" y="338" text-anchor="middle" class="d-label">SHIFT LEFT: CATCH IT EARLIER</text>
</svg>
</div>
<figcaption>Figure 1: Security controls along the lifecycle and the illustrative cost trend (not measured values)</figcaption>
</figure>

Notice something important in the picture: shifting left doesn't mean removing the controls on the right. Runtime protection, monitoring and incident response are still there (and they belong to the [Security pillar](/en-us/principles/cloud/security/), where we talk about Zero Trust, identity, network segmentation and SIEM). The idea is that the controls on the right become the **last** net, not the **only** one.

## The Friday night API key

Let me tell you a story. You may have heard a version of it, or lived one.

It's Friday, 11 pm. A developer is finishing a small integration with a cloud provider from home. To test it quickly, they paste the access key straight into a config file. It works! Happy, they run `git add .`, `git commit -m "fix"`, `git push`, and go to bed. The repository is public, a small open source helper the team maintains.

What they don't know is that there are bots constantly watching public commits on GitHub, looking for exactly this kind of pattern. In a matter of minutes (sometimes less), the key has been found. By Saturday morning, someone has spun up dozens of large GPU instances in regions the company has never used, mining cryptocurrency on the company's bill. By Monday, the finance team is asking why the cloud invoice looks like a phone number.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Worried junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Okay, but that's easy to fix, right? You just delete the commit and force push. Nobody will ever see it."</span>
    </div>
  </div>
</div>

Oh, Junior... Git has a long memory. The commit lives on in forks, in clones, in caches, in the bot's database, and in the history of anyone who pulled in the meantime. **Once a secret has been pushed to a public place, it is compromised. Period.** The only real fix is to **revoke and rotate** the credential, then go hunting for what was done with it.

Now look at how many shift-left controls could have stopped this story, each one earlier and cheaper than the last:

- A **secrets manager** (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault) and short-lived credentials, so there's no long-lived key to paste in the first place;
- A **pre-commit hook** with a secret scanner (like gitleaks or detect-secrets) that refuses the commit on the developer's machine;
- **Push protection** on the hosting platform, which blocks the push when a known secret pattern shows up;
- **Secret scanning** in the pipeline and across the whole history of the repository;
- **Budget alerts and least privilege** on the cloud account, so even a leaked key can do limited damage (and someone gets paged on Saturday, not Monday).

Notice how the first four are all on the left. The last one is the safety net. That's the principle in a nutshell.

## Start at design: requirements and threat modeling

The furthest left you can go is the whiteboard. Before a single line of code, the team can already answer questions like: what data does this feature handle? Who should be able to access it? What happens if someone tries to abuse it?

### 1. Write security requirements like any other requirement

Security requirements shouldn't be a generic sentence like "the system must be secure". They should be concrete and testable, written into the stories, just like functional requirements:

- "Only the account owner and support staff with the `billing:read` role can see invoices";
- "Personal data is encrypted at rest and never written to application logs";
- "The password reset link expires in 30 minutes and can be used only once";
- "Failed login attempts are rate limited per account and per IP".

**Goal:** make security part of the definition of done, not an extra phase.
**Benefit:** requirements that are clear at design time become test cases, and test cases become automated checks.

### 2. Threat modeling with STRIDE

Threat modeling sounds fancy, but at its core it's a structured conversation around four questions (popularized by Adam Shostack): **What are we building? What can go wrong? What are we going to do about it? Did we do a good job?**

The team draws a simple data flow diagram of the feature (users, services, data stores, trust boundaries) and walks through each element asking "what can go wrong here?". To avoid staring at the whiteboard in silence, **STRIDE** gives you six categories of threats to think about, each one violating a specific security property:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="ssl-d2-title ssl-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d2-title">The STRIDE threat categories</title>
<desc id="ssl-d2-desc">A grid of six boxes, one per STRIDE category: spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege, each with the security property it violates and a typical mitigation.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">STRIDE: SIX QUESTIONS PER ELEMENT</text>
<rect x="20" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="130" y="80" text-anchor="middle" class="d-title">Spoofing</text>
<text x="130" y="108" text-anchor="middle" class="d-small">violates authentication</text>
<text x="130" y="130" text-anchor="middle" class="d-small">mitigate: MFA, mTLS</text>
<rect x="250" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="360" y="80" text-anchor="middle" class="d-title">Tampering</text>
<text x="360" y="108" text-anchor="middle" class="d-small">violates integrity</text>
<text x="360" y="130" text-anchor="middle" class="d-small">mitigate: signing, hashes</text>
<rect x="480" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="590" y="80" text-anchor="middle" class="d-title">Repudiation</text>
<text x="590" y="108" text-anchor="middle" class="d-small">violates non-repudiation</text>
<text x="590" y="130" text-anchor="middle" class="d-small">mitigate: audit logs</text>
<rect x="20" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="130" y="202" text-anchor="middle" class="d-title">Info disclosure</text>
<text x="130" y="230" text-anchor="middle" class="d-small">violates confidentiality</text>
<text x="130" y="252" text-anchor="middle" class="d-small">mitigate: encryption</text>
<rect x="250" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="360" y="202" text-anchor="middle" class="d-title">Denial of service</text>
<text x="360" y="230" text-anchor="middle" class="d-small">violates availability</text>
<text x="360" y="252" text-anchor="middle" class="d-small">mitigate: rate limits</text>
<rect x="480" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="590" y="202" text-anchor="middle" class="d-title">Elevation of privilege</text>
<text x="590" y="230" text-anchor="middle" class="d-small">violates authorization</text>
<text x="590" y="252" text-anchor="middle" class="d-small">mitigate: least privilege</text>
</svg>
</div>
<figcaption>Figure 2: STRIDE, the six threat categories and the property each one attacks</figcaption>
</figure>

A threat modeling session for a single feature doesn't need to take days. An hour with the developer, the tech lead and (ideally) a security champion is often enough to find the two or three things that really matter. Tools like OWASP Threat Dragon or Microsoft Threat Modeling Tool help, but a whiteboard and honest people work just as well.

**Goal:** find design flaws while they are still just lines on a diagram.
**Benefit:** design flaws are the most expensive kind to fix later, because no scanner will ever find "we forgot to check who owns the invoice". That's a logic problem, and only humans who understand the business catch it.

<div class="callout tip">
  <p>Don't try to threat model the whole system at once. Model <strong>changes</strong>: a new integration, a new public endpoint, a new kind of data. Small, frequent sessions beat a giant yearly workshop that nobody remembers.</p>
</div>

### 3. Use references instead of reinventing the wheel

The **OWASP Top 10** is the classic list of the most critical web application security risks (broken access control, injection, cryptographic failures, security misconfiguration, vulnerable components and so on). It's not a complete standard, but it's an excellent vocabulary for the team and a good starting checklist for design reviews. The **OWASP ASVS** goes deeper, with verifiable requirements you can turn into acceptance criteria.

And to evaluate how mature your program is as a whole, **OWASP SAMM** (Software Assurance Maturity Model) breaks secure software development into business functions (governance, design, implementation, verification and operations) with maturity levels for each practice. It's a great way to answer "where are we, and what should we improve next?" without buying a consultancy.

## Secure coding: standards and the developer's machine

Once the design is sound, the next place to catch problems is where the code is born.

### 1. Secure coding standards

Agree, as a team, on how common security-sensitive things are done: how to query the database (parameterized queries, always), how to validate input, how to encode output, how to handle errors without leaking stack traces, how to log without writing personal data, which crypto libraries are allowed. The OWASP Cheat Sheet Series is a great base to start from.

The trick is to keep the standard **short and practical**, with examples in your own stack, and to connect it to [Standardization](/en-us/principles/enterprise/standardization/) efforts across the company. A 90-page PDF nobody reads is not a standard, it's a decoration.

### 2. Feedback in the IDE

Security linters and IDE plugins give feedback while the developer is typing, which is the cheapest moment possible: no context switch, no ticket, no meeting. A squiggly line under `"SELECT * FROM users WHERE id = " + id` teaches more than a yearly training.

### 3. Pre-commit hooks and secret scanning

Pre-commit hooks run on the developer's machine before the commit is created. They're perfect for fast checks: secret scanning, formatting, blocking large binaries, basic linting. Frameworks like `pre-commit` make it easy to share the same hooks across the team through a config file in the repository.

<div class="callout warning">
  <p>Pre-commit hooks are a <strong>convenience, not a control</strong>. Anyone can skip them with <code>--no-verify</code>, or simply never install them. Always repeat the critical checks (especially secret scanning) on the server side: push protection and the pipeline.</p>
</div>

## Security in the pipeline

The CI pipeline is where shift-left becomes systematic. Every change goes through it, so it's the natural place to automate checks that would be impossible to do by hand. Let's go through the main families.

### 1. SAST (Static Application Security Testing)

SAST tools analyze source code without running it, looking for patterns that lead to vulnerabilities: injection, unsafe deserialization, hardcoded secrets, weak crypto, path traversal. Examples include Semgrep, CodeQL, SonarQube and many commercial options.

**Benefit:** fast feedback right on the pull request, pointing to the exact line.
**Watch out:** SAST produces false positives, and a lot of them if you turn on every rule. Start with a curated, high-confidence rule set and grow from there.

### 2. SCA (Software Composition Analysis) and SBOMs

Most of the code running in your application wasn't written by your team. It came from open source packages, which bring their own dependencies, which bring theirs. SCA tools (Dependabot, Renovate, Snyk, OWASP Dependency-Check, Trivy and others) compare your dependency tree against vulnerability databases and tell you which packages have known CVEs, often opening the update pull request for you.

Closely related is the **SBOM** (Software Bill of Materials): a machine-readable list of every component inside your artifact, in standard formats like **CycloneDX** or **SPDX**. It sounds like bureaucracy until the day a critical vulnerability hits a popular library and your boss asks "are we affected?". With SBOMs for every release, the answer takes minutes. Without them, it takes a week of grepping repositories.

**Benefit:** visibility of what you actually ship, and a fast answer when the next big CVE lands.

### 3. IaC scanning

If your infrastructure is code (and it should be, see [Operational Excellence](/en-us/principles/cloud/operational-excellence/)), then its misconfigurations are bugs you can catch before they exist. Tools like Checkov, tfsec/Trivy, KICS and cloud-native policy engines flag public storage buckets, open security groups, disabled encryption, missing logging and overly broad IAM roles right in the pull request.

**Benefit:** "someone left the bucket public" stops being a headline and becomes a failed check on a Tuesday afternoon.

### 4. Container image scanning

Container images carry a whole operating system layer along with your app. Scanners like Trivy or Grype check the base image and installed packages for known vulnerabilities. Combine that with good hygiene: minimal or distroless base images, pinned versions (ideally by digest), non-root users, and regular rebuilds so patches actually reach production.

### 5. DAST (Dynamic Application Security Testing)

DAST tests the running application from the outside, like an attacker would: it crawls endpoints, sends malicious payloads and looks at the responses. OWASP ZAP is the classic open source option. DAST finds things static analysis can't see, such as misconfigured headers, authentication issues and server behavior, but it's slower and usually runs against a test or staging environment, not on every commit.

| Approach | Benefit |
|---|---|
| **Threat modeling** | Catches design and logic flaws no tool can see |
| **Pre-commit and push protection** | Stops secrets before they ever leave the machine |
| **SAST** | Line-level feedback on insecure code patterns, right on the PR |
| **SCA and SBOM** | Visibility and alerts for vulnerable third-party components |
| **IaC scanning** | Blocks insecure cloud configuration before it's provisioned |
| **Image scanning** | Finds vulnerable OS packages and bad container practices |
| **DAST** | Tests the running app the way an attacker would |
| **Signing and provenance** | Proves the artifact is what your pipeline built, unmodified |

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Excited junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"Awesome! So I'll turn on every scanner, set every rule to maximum and fail the build on any finding. Maximum security!"</span>
    </div>
  </div>
</div>

Hold on, Junior! That's the fastest way to make the whole team hate security. Turn everything on at full blast in a legacy codebase and you'll get two thousand findings on the first run, half of them false positives, and a pipeline that never goes green again. In a week, someone will add `continue-on-error: true` and you'll be back to zero, except now with a team that ignores security alerts. We'll get to how to handle findings in a moment.

## Software supply chain security

Here's an uncomfortable thought: you can write perfectly secure code and still ship something malicious. Attacks like the SolarWinds build compromise, the `xz` backdoor attempt and a steady stream of typosquatted or hijacked packages showed that attackers love the supply chain: the dependencies, the build system and the path from source to production.

Protecting it means answering, with evidence: **is this artifact really built from this source, by this pipeline, without tampering?**

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 290" role="img" aria-labelledby="ssl-d3-title ssl-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d3-title">A secured software supply chain</title>
<desc id="ssl-d3-desc">Five stages from source to deploy: reviewed source, a hardened build that emits provenance, a signed artifact with an SBOM, a registry that scans it, and a deploy step that verifies the signature and policy before admitting it. Provenance and signatures travel with the artifact until verification.</desc>
<defs><marker id="ssl-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="28" text-anchor="middle" class="d-label">FROM SOURCE TO PRODUCTION, WITH EVIDENCE</text>
<rect x="10" y="60" width="128" height="96" rx="10" class="d-box"/>
<text x="74" y="90" text-anchor="middle" class="d-title">Source</text>
<text x="74" y="116" text-anchor="middle" class="d-small">reviewed PRs</text>
<text x="74" y="134" text-anchor="middle" class="d-small">protected branch</text>
<rect x="163" y="60" width="128" height="96" rx="10" class="d-box-info"/>
<text x="227" y="90" text-anchor="middle" class="d-title">Build</text>
<text x="227" y="116" text-anchor="middle" class="d-small">hardened runner</text>
<text x="227" y="134" text-anchor="middle" class="d-small">emits provenance</text>
<rect x="316" y="60" width="128" height="96" rx="10" class="d-box-accent"/>
<text x="380" y="90" text-anchor="middle" class="d-title">Artifact</text>
<text x="380" y="116" text-anchor="middle" class="d-small">SBOM attached</text>
<text x="380" y="134" text-anchor="middle" class="d-small">signed (cosign)</text>
<rect x="469" y="60" width="128" height="96" rx="10" class="d-box-info"/>
<text x="533" y="90" text-anchor="middle" class="d-title">Registry</text>
<text x="533" y="116" text-anchor="middle" class="d-small">image scanned</text>
<text x="533" y="134" text-anchor="middle" class="d-small">immutable tags</text>
<rect x="622" y="60" width="128" height="96" rx="10" class="d-box-accent"/>
<text x="686" y="90" text-anchor="middle" class="d-title">Deploy</text>
<text x="686" y="116" text-anchor="middle" class="d-small">verify signature</text>
<text x="686" y="134" text-anchor="middle" class="d-small">policy admission</text>
<line x1="138" y1="108" x2="161" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="291" y1="108" x2="314" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="444" y1="108" x2="467" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="597" y1="108" x2="620" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="227" y1="186" x2="686" y2="186" class="d-line-dashed"/>
<line x1="227" y1="156" x2="227" y2="186" class="d-line-dashed"/>
<line x1="686" y1="186" x2="686" y2="158" class="d-line-dashed" marker-end="url(#ssl-d3-arrow)"/>
<text x="456" y="208" text-anchor="middle" class="d-small">provenance and signature travel with the artifact</text>
<rect x="163" y="228" width="434" height="44" rx="10" class="d-box-danger"/>
<text x="380" y="255" text-anchor="middle" class="d-text">Unsigned or unknown artifact? Rejected.</text>
</svg>
</div>
<figcaption>Figure 3: A supply chain where every step leaves evidence that the next step can verify</figcaption>
</figure>

### 1. SLSA

**SLSA** (Supply-chain Levels for Software Artifacts, pronounced "salsa") is a framework from the OpenSSF that defines incremental levels of assurance for how artifacts are built. At the lower levels, you simply document how the build happens and generate **provenance**: a signed statement saying which source, which builder and which parameters produced the artifact. At higher levels, the build runs on a hardened, isolated platform where even a compromised developer account can't forge that provenance.

The beauty of SLSA is that it's incremental. You don't need to reach the top level to get value; generating provenance at all already puts you ahead of most of the industry.

### 2. Signed artifacts with Sigstore and cosign

Signing used to be painful because of key management: where do you store the private key, who rotates it, what happens when it leaks? **Sigstore** changed that with *keyless signing*: **cosign** signs the artifact using a short-lived certificate tied to the pipeline's identity (via OIDC), and the signature is recorded in a public transparency log (Rekor). On the other side, the deploy step (for example, a Kubernetes admission controller like Kyverno or the Sigstore policy controller) verifies that the image was signed by **your** pipeline before letting it run.

### 3. Dependency hygiene

- Pin versions with lock files and verify integrity hashes;
- Use a private proxy or mirror for packages, so you control what comes in;
- Be suspicious of brand-new packages with names very close to popular ones (typosquatting);
- Review what an update actually changes before merging it automatically, especially for install scripts;
- Check the health of what you adopt: is it maintained? Does it have more than one maintainer? The OpenSSF Scorecard helps here.

### 4. Harden the pipeline itself

Your CI/CD system has the keys to production, which makes it one of the most attractive targets you have. Treat it that way:

- **Least privilege** for pipeline identities, scoped per environment, with production credentials available only on protected branches;
- **OIDC federation** instead of long-lived cloud keys stored as pipeline secrets;
- **Pin third-party actions and plugins** to a commit hash, not a movable tag;
- **Protected branches and required reviews**, so nobody (including admins) pushes straight to main;
- **Ephemeral runners**, so one build can't leave something behind for the next;
- **Don't run untrusted code with secrets**: pull requests from forks shouldn't get access to deployment credentials;
- **Audit logs** for pipeline changes, because changing the pipeline is changing production.

## Handling findings without blocking everything

This is where many DevSecOps initiatives die. The tools are installed, the scanners run, and then... thousands of findings, a red pipeline and a team that learns to ignore security the same way it ignores the car alarm in the parking lot.

The fix is a triage process that treats findings like any other work: prioritized, owned and time-boxed.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 310" role="img" aria-labelledby="ssl-d4-title ssl-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d4-title">Triage of security findings</title>
<desc id="ssl-d4-desc">A scanner finding goes through deduplication and triage, then follows one of four paths: critical findings block the merge, high findings become tickets with a fix deadline, medium and low findings go to the backlog, and false positives are suppressed with a reason and an expiry date.</desc>
<defs><marker id="ssl-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="24" text-anchor="middle" class="d-label">EVERY FINDING GETS A PATH, NOT A PANIC</text>
<rect x="20" y="128" width="140" height="70" rx="10" class="d-box"/>
<text x="90" y="158" text-anchor="middle" class="d-title">Finding</text>
<text x="90" y="180" text-anchor="middle" class="d-small">from any scanner</text>
<line x1="160" y1="163" x2="198" y2="163" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<rect x="200" y="128" width="150" height="70" rx="10" class="d-box-info"/>
<text x="275" y="158" text-anchor="middle" class="d-title">Triage</text>
<text x="275" y="180" text-anchor="middle" class="d-small">dedupe, context</text>
<rect x="420" y="40" width="300" height="54" rx="10" class="d-box-danger"/>
<text x="570" y="63" text-anchor="middle" class="d-text">Critical: block the merge</text>
<text x="570" y="82" text-anchor="middle" class="d-small">exploitable, reachable, fix now</text>
<rect x="420" y="104" width="300" height="54" rx="10" class="d-box-warn"/>
<text x="570" y="127" text-anchor="middle" class="d-text">High: ticket with SLA</text>
<text x="570" y="146" text-anchor="middle" class="d-small">owner and deadline, release continues</text>
<rect x="420" y="168" width="300" height="54" rx="10" class="d-box"/>
<text x="570" y="191" text-anchor="middle" class="d-text">Medium, low: backlog</text>
<text x="570" y="210" text-anchor="middle" class="d-small">prioritized with other work</text>
<rect x="420" y="232" width="300" height="54" rx="10" class="d-box-muted"/>
<text x="570" y="255" text-anchor="middle" class="d-text">False positive: suppress</text>
<text x="570" y="274" text-anchor="middle" class="d-small">with a reason and an expiry date</text>
<line x1="350" y1="163" x2="418" y2="67" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="131" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="195" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="259" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
</svg>
</div>
<figcaption>Figure 4: Severity thresholds and triage turn a flood of alerts into a manageable flow</figcaption>
</figure>

### 1. Severity thresholds

Decide, as a team and with the security folks, what actually breaks the build. A common starting point: only **new** findings of **critical** severity (and maybe high, once things are under control) block the merge. Everything else is reported, visible and tracked, but doesn't stop delivery.

Severity alone isn't everything, though. Context matters: a critical CVE in a library function you never call is less urgent than a medium one on your public login endpoint. Reachability analysis, the EPSS score and the CISA KEV catalog (known exploited vulnerabilities) help separate "theoretically bad" from "actively exploited".

### 2. Baseline the legacy

For existing codebases, take a **baseline**: record the current findings and gate only on **new** ones. The old debt goes into a backlog with a plan to burn it down. This way the pipeline goes green on day one, and the rule "don't make it worse" is enforced from then on.

### 3. SLAs per severity

Define fix deadlines per severity (for example: critical in days, high in a few weeks, medium in a quarter), agreed with the business and the security team. The exact numbers depend on your risk appetite, which ties this directly to [Risk Management](/en-us/principles/enterprise/risk-management/). What matters is that every finding has an **owner** and a **deadline**, and that overdue items are visible to leadership.

### 4. Suppressions with accountability

False positives exist, and forcing people to "fix" them is a waste of time. Allow suppressions, but with rules: a written reason, a reviewer, and an **expiry date** so they get revisited. A suppression without a reason is just a way to hide the problem.

## Make the secure path the easy path

If there's one idea to take away from this article, it's this: **developers follow the path of least resistance**. If the secure way is harder than the insecure way, people will take the insecure way under deadline pressure, no matter how many trainings they attended. So make the secure way the easiest one. People call these *paved roads* or *golden paths*:

- **Project templates** that already come with the pipeline, the scanners, the pre-commit config and the secure defaults wired in;
- **Shared pipeline modules**, so improving a security check once improves it for every team;
- **Secure-by-default libraries**: an HTTP client that validates TLS, an ORM that parameterizes queries, a logger that masks personal data;
- **Hardened base images** maintained by a platform team and rebuilt automatically;
- **Secrets managers and workload identity** that are easier to use than a config file;
- **Clear, actionable messages** in failed checks: what's wrong, why it matters and how to fix it, with a link.

This is the same thinking behind [Evolutionary Design](/en-us/principles/solution/evolutionary-design/): the architecture should make the right change easy. Security is no different.

## Security champions

Tools don't change culture; people do. A **security champions program** picks developers (volunteers, ideally) inside each product team who get extra training, time and a direct line to the security team. They're not security police: they're the person on the team who says "hey, let's do a quick threat model before we build this", who helps triage findings, and who brings the team's pain back to the security team.

For it to work:

- Give champions **real time** for it (a percentage of their week, not "in your spare time");
- Give them **recognition**: career paths, visibility, certifications;
- Build a **community**: regular meetups, a shared channel, internal talks;
- Let them **influence** the tools and standards, because they know what hurts in daily work.

The security team, in turn, changes role: from gatekeeper to coach, building paved roads, curating rules, and diving deep into the hard problems that really need a specialist.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Thoughtful junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>"So if we do all of this on the left, we can drop the pentest and the runtime monitoring, right? The code is already secure!"</span>
    </div>
  </div>
</div>

Not quite, Junior. Shifting left reduces how many problems reach production; it doesn't make that number zero. New vulnerabilities are discovered every day in code that was "clean" yesterday, configurations drift, and attackers are creative. That's why you still need regular pentests, runtime protection, logging, detection and incident response. Think of it as *shift left* **and** *shield right*. The [Security pillar](/en-us/principles/cloud/security/) covers the runtime side, and [Observability First](/en-us/principles/solution/observability-first/) makes sure you can see what's happening when something does get through.

## Tradeoffs

Like every principle, shifting security left has costs. Making them explicit is what separates a mature program from a pile of tools.

### Tradeoffs with Performance Efficiency and delivery speed

Every scanner adds minutes to the pipeline. SAST on a large monorepo, DAST against a full environment and image scanning of many services can turn a five-minute build into a forty-minute one, which kills fast feedback. Mitigate by running quick checks on every PR (secrets, incremental SAST, SCA) and heavier ones in parallel, nightly or before release, and by caching aggressively.

### Tradeoffs with Operational Excellence

More tools means more things to install, update, configure and keep running. Each scanner has its own rules, its own dashboard and its own false positives. Without consolidation (a single place to see findings, shared pipeline templates), the security toolchain itself becomes operational debt.

### False positives and alert fatigue

This one deserves its own heading. A tool that cries wolf every day trains people to ignore it, and then the real wolf walks right in. Curate rules, tune thresholds, remove noisy checks that never find anything real, and measure the false positive rate like any other quality metric.

### Developer friction

Every blocking check is friction. Some friction is healthy (you want the push with the cloud key to fail), but too much of it drives people to workarounds: disabled hooks, suppressions without reason, "temporary" bypasses that last forever. The goal is maximum protection for minimum friction, which is why paved roads and clear error messages matter so much.

### Tradeoffs with Cost Optimization

Commercial scanners, extra pipeline minutes, SBOM storage, champion time and training all cost money. Still, it's usually far cheaper than an incident. Use [Cost Transparency](/en-us/principles/solution/cost-transparency/) to make that investment visible and defensible, and start with the strong open source options before buying.

### Tradeoffs with Reliability

Supply chain controls add dependencies to your deployment path. If the signature verification service, the transparency log or the policy engine is unavailable, can you still deploy an emergency fix? Plan break-glass procedures (audited, rare and reviewed afterwards) so security controls don't become a single point of failure during an incident.

## Conclusion

**Security Shift-Left** is not a tool you buy, it's a change in **when** and **by whom** security work gets done. Security requirements and threat modeling at design time, secure standards and fast feedback while coding, secret scanning before the push, SAST, SCA, IaC and image scanning in the pipeline, DAST before release, and a verifiable supply chain from source to production. Each control in the phase where it's cheapest and most effective.

But the tools are the easy part. The hard part is the culture: a triage process that doesn't paralyze delivery, paved roads that make the secure way the easy way, champions who bring security into every team, and a security team that works as a partner rather than a gatekeeper.

Do it well, and the Friday night API key becomes a failed pre-commit hook and a slightly annoyed developer. Which, let's be honest, is a much better ending than a Monday morning meeting about the cloud bill.

## Next Steps

1. **Assess where you are**
Use OWASP SAMM to get a quick picture of your maturity and pick the two or three practices with the biggest gap.

2. **Stop the bleeding with secrets**
Turn on push protection and secret scanning across all repositories, move credentials to a secrets manager, and rotate anything you find.

3. **Add the basic pipeline checks**
Start with SCA and a curated SAST rule set on every pull request, with a baseline for legacy code and blocking only on new critical findings.

4. **Threat model your next change**
Pick the next feature that touches sensitive data or a public endpoint and run a one-hour STRIDE session with the team.

5. **Define triage rules and SLAs**
Agree on severity thresholds, deadlines per severity and how suppressions work, and make overdue findings visible.

6. **Secure the supply chain incrementally**
Generate SBOMs, sign your artifacts with cosign, verify signatures at deploy time, and harden your pipeline identities with OIDC and least privilege.

7. **Grow people, not just tools**
Start a security champions program and build paved roads so the secure path is always the easiest one.

<div class="callout info" data-title="References">
  <ul>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top 10</a></li>
    <li><a href="https://owaspsamm.org/" target="_blank" rel="noopener">OWASP SAMM (Software Assurance Maturity Model)</a></li>
    <li><a href="https://owasp.org/www-project-application-security-verification-standard/" target="_blank" rel="noopener">OWASP Application Security Verification Standard (ASVS)</a></li>
    <li><a href="https://cheatsheetseries.owasp.org/" target="_blank" rel="noopener">OWASP Cheat Sheet Series</a></li>
    <li><a href="https://slsa.dev/" target="_blank" rel="noopener">SLSA: Supply-chain Levels for Software Artifacts</a></li>
    <li><a href="https://www.sigstore.dev/" target="_blank" rel="noopener">Sigstore</a></li>
    <li><a href="https://cyclonedx.org/" target="_blank" rel="noopener">CycloneDX SBOM standard</a></li>
    <li><a href="https://csrc.nist.gov/projects/ssdf" target="_blank" rel="noopener">NIST Secure Software Development Framework (SSDF)</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/security/" target="_blank" rel="noopener">Azure Well-Architected Framework: Security</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
  </ul>
</div>
