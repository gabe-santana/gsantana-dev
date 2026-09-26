---
title: Cost Optimization
short: One of the most important Architecture Design Principles in systems architecture decision-making. After all, who wants to pay for what they don't need?
category: cloud
---

## Cost Optimization in Software Architecture

People who design systems tend to think about performance, scalability and security, and rightly so. But in the cloud, ignoring cost can turn an elegant architecture into a <strong>budget trap</strong>.  
Most cloud platforms, such as <strong>Azure</strong> and <strong>AWS</strong>, already treat cost optimization as a key pillar of their <strong>Well-Architected</strong> framework  
- [Microsoft Docs](https://learn.microsoft.com)  
- [AWS Docs](https://docs.aws.amazon.com)  

---

### Cost isn't a detail, it's a requirement

<figure style="margin:40px auto 40px; display:flex; flex-direction:column; align-items:center; text-align:center;">
  <img src="/principles/cloud/cost-optimization/custo-requisito.svg" alt="Image showing cost as a requirement" style="max-width:100%; height:auto; display:block;" />
  <figcaption style="margin-top:8px; font-size:0.95rem; color:#666; font-style: italic;">
    Figure 1: Cost as a requirement
  </figcaption>
</figure>


Failing to treat system costs as a fundamental requirement is like designing a rocket without thinking about fuel: it may lift off, but it won't get very far.

Who hasn't been shocked by the bill from a virtual machine someone forgot to shut down? Or that time the test environment, spun up "just to quickly check one little thing", ended up running for the entire month?

These slip-ups seem small, but at production scale they become an <strong>architecture problem</strong>. Because every technical choice comes with a built-in invoice:

- A poorly sized relational database;
- A Kubernetes cluster full of idle pods;
- Logs that never expire;
- Premium services used for simple tasks;

Or that "just one more microservice" that comes with its own storage, networking and monitoring.

Cost, then, is not an afterthought; it's an essential part of <strong>architectural design</strong>. If performance, security and availability are part of your decision matrix, cost should be there with the same weight.

The logic is simple: if your costs blow past the budget, it doesn't matter how well designed the system is, it becomes unsustainable. The outcome is inevitable: the product stops turning a profit, the business runs out of steam and, in some cases, goes bankrupt.

The difference between an "expensive solution that works" and an "efficient solution that grows" lies right here, in understanding that optimizing cost isn't about cutting spending, it's about <strong>designing for value</strong>.

---

### So what's this "FinOps" thing?

Understanding cost as a fundamental requirement leads us straight to the need for a culture and a structure to manage it. When it comes to cloud cost optimization, <strong>FinOps</strong> is the number one result in your Google search. But what does it mean, and how does it affect an organization's day-to-day?

In broad terms, <strong>FinOps</strong> isn't just a tool or a team; at its core, it's a <strong>culture</strong> that transforms the way companies consume the cloud. Its central purpose is to break down silos and <strong>bring Technology, Finance and Business together</strong> to create accountability and <strong>shared financial value</strong>.

Unlike a rigid methodology or a proprietary *framework*, FinOps is a set of <strong>principles and best practices</strong> accumulated over the years by the *cloud* community. This organic nature is crucial: <strong>there is no definitive, universal guide</strong> to FinOps. Instead, there's a range of practices (such as *Tagging*, *Showback* and *Right Sizing*) from which your organization should select and adapt the ones that actually deliver value. The success of FinOps lies precisely in recognizing that not every practice has to make sense for your reality. It's a path of <strong>continuous adaptation</strong>, not blind compliance.

<div class="callout info">
  <p>Applying FinOps strategies in your organization means driving a <strong>fundamental shift in mindset</strong> and process in how technology is designed, operated and funded as a <strong>whole</strong>.</p>
</div>

#### A brief introduction to FinOps

<figure style="margin:40px auto 40px; display:flex; flex-direction:column; align-items:center; text-align:center;">
  <img src="/principles/cloud/cost-optimization/finops.svg" alt="Image illustrating the three phases of the FinOps Framework: Inform, Operate and Optimize" style="max-width:100%; height:auto; display:block;" />
  <figcaption style="margin-top:8px; font-size:0.95rem; color:#666; font-style: italic;">
    Figure 2: FinOps Framework
  </figcaption>
</figure>

FinOps (short for *Financial Operations*) is more than a discipline, it's a culture. Its purpose is to bring technology, finance and operations together to create shared financial accountability.  

Instead of the finance team acting as the "guardian of the budget" while the technical team simply consumes resources, FinOps creates a collaborative model in which developers, architects and managers understand the financial impact of technical decisions.

The result is a <strong>cost-aware</strong> culture, where metrics such as cost per user, cost per transaction or cost per *feature* become just as important as latency or availability.

---

### CFM: Cloud Financial Management (The Execution Framework)

If FinOps defines the culture, <strong>Cloud Financial Management (CFM)</strong> provides the structure and tools needed to put that culture into practice. CFM translates cultural principles into a set of practices and disciplines that ensure <strong>visibility, control and continuous optimization</strong> of cloud spending.

The scope of CFM goes far beyond simply looking at the bill at the end of the month. It covers:

1.  <strong>Planning and Forecasting (*Budgeting* and *Forecasting*):</strong> Setting realistic budgets and projecting future spend based on growth and architectural decisions.
2.  <strong>Cost Allocation and Attribution:</strong> Making sure costs are correctly identified and attributed to the business units, teams or applications that generated them (essential for *Showback* and *Chargeback* practices).
3.  <strong>Monitoring and Optimization:</strong> Analyzing resource usage in real time to identify waste, anomalies and efficiency opportunities.
4.  <strong>Governance:</strong> Establishing automated policies and *guardrails* to ensure resources are provisioned within the cost and efficiency rules defined by the company.


Effective CFM execution depends directly on the native and third-party tools offered by cloud providers. They are the pillars that turn raw data into actionable *insights*:

* <strong>Azure Cost Management:</strong> Provides detailed reports, analysis *dashboards*, budgets and alerts to monitor spending and make decisions across the Azure ecosystem.
* <strong>AWS Cost Explorer:</strong> Lets you visualize, understand and manage AWS costs and usage over time. It's essential for spotting trends and usage spikes and for forecasting.
* <strong>GCP Billing Reports:</strong> Gives visibility into Google Cloud costs, letting you filter by projects, services and *labels* for accurate allocation.

These tools are crucial because they provide detailed reports that allow Engineering and Finance teams to:

* <strong>Identify Anomalies:</strong> Quickly detect unexpected cost increases.
* <strong>Analyze Usage Spikes:</strong> Understand whether a high spend was a one-off (e.g., a load test) or a new trend.
* <strong>*Right Sizing* Opportunities:</strong> Determine whether a virtual machine or database is oversized and suggest a better-fitting size to save money without losing performance.


<strong>From Visibility to Action: The CFM Lifecycle</strong>

CFM isn't a state but a continuous improvement cycle, which aligns perfectly with the cyclical approach of FinOps:

| Phase | Description | Related Engineering Practices |
| :--- | :--- | :--- |
| <strong>Inform (*Inform*)</strong> | Gain visibility into costs. | <strong>*Tagging*</strong> (Resource Labeling), Detailed Reporting. |
| <strong>Optimize (*Optimize*)</strong> | Reduce cost through structural and tactical actions. | <strong>Right Sizing</strong>, Use of Reserved Instances or Savings Plans, Storage Optimization. |
| <strong>Operate (*Operate*)</strong> | Keep the momentum and ensure continuous improvement. | <strong>Automated</strong> shutdown of non-production environments, Implementation of <strong>Policy as Code</strong> for governance. |

By embracing CFM, Software Architecture elevates cost from a financial concern to a fundamental <strong>architectural metric</strong>, ensuring that scalability and performance go hand in hand with the system's economic viability.

---

#### Chargeback and Showback: making costs accountable

To close the CFM loop (from visibility to action), accountability has to be assigned. This is where <strong>Showback</strong> and <strong>Chargeback</strong> come in, turning cost data into financial awareness.

<strong>Showback</strong> is the gentlest and most fundamental mechanism in the FinOps journey.

<div class="callout info">
  <p><strong>Showback</strong> is when you transparently show a team, business unit or even a project <strong>how much they're spending</strong> on cloud resources, <strong>without necessarily charging</strong> that amount to their budget.</p>
</div>

<strong>Goal:</strong> Build financial awareness.

<strong>How it works:</strong>
* The engineering, architecture or development team receives periodic reports and *dashboards* detailing the cost of their applications, databases, test environments, logs, and so on.
* This cost is treated as an indicator, an <strong>architectural metric</strong> as important as latency or availability.
* Seeing the real cost of running their APIs or microservices naturally encourages the team to pursue <strong>Right Sizing</strong> and shut down idle resources.

Showback is an excellent starting point because it encourages behavioral change collaboratively, without the initial friction that direct charging can create.

<strong>Chargeback: The Next Level of Accountability</strong>

<strong>Chargeback</strong> is the natural evolution of Showback and represents a more formal step in cost governance.

<div class="callout info">
  <p><strong>Chargeback</strong> is the next step: cloud costs are <strong>charged and allocated directly to the budget</strong> of the business unit or team consuming the resources.</p>
  
</div>

<strong>Goal:</strong> Ensure full financial accountability and influence budget planning.

<strong>How it works:</strong>
* Costs are tracked precisely (usually through robust <strong>Tagging</strong>) and formally allocated in the internal books.
* If the Marketing team decides to run a large data analytics cluster, the cost of that cluster hits their budget directly.
* If a Product team decides to keep a staging environment running 24/7 for no good reason, that cost becomes a management problem for the *squad*.

<strong>Impact on Decisions:</strong>
Chargeback has a profound impact on architectural decisions. A new technology choice that is significantly more expensive will have to be justified not only by performance, but also by its financial viability within that department's budget.

<strong>The Strategic Value for Engineering</strong>

Both mechanisms are essential because they turn cost from a "Finance" problem into an <strong>Architecture and Engineering problem</strong>.

When each team sees the real cost of running their APIs, databases or environments, the mindset changes:

* <strong>Data-Driven Decisions:</strong> Choices about instance type, storage model or *log* retention start being made based on <strong>cost efficiency</strong>, not just technical convenience.
* <strong>The End of Invisible Waste:</strong> The forgotten test environment or the oversized database, which used to go unnoticed in the overall bill, are now visible and affect the team's financial performance.

By implementing Showback, and later Chargeback, in a transparent and fair way, the company ensures that every technical decision will sustain not only operations but also the system's <strong>economic viability</strong>.

---

### The Value of Cost as an Architectural Metric

Implementing FinOps, CFM and accountability mechanisms is what raises cost to its rightful level. Real maturity happens when cost stops being a number on Finance's spreadsheet and becomes a fundamental <strong>architectural parameter</strong>, treated with the same rigor as performance, security or availability.

Designing with cost awareness is designing with a business mindset. It means making sure every technical decision sustains not only operations but also the <strong>system's economic viability</strong>.

<strong>Cost as a Trade-off:</strong>

Architects and engineers live on *trade-offs*. When deciding between a more expensive managed solution (*Fully Managed Service*) and a cheaper *self-hosted* one, cost goes on the scale:

* <strong>Managed Service (More expensive):</strong> Offers higher <strong>Availability</strong> and reduces the *Operational Burden*, but comes with a higher price tag.
* <strong>Self-Hosted (Cheaper):</strong> Offers more control and a lower direct price, but demands more of the Engineering team's time (a higher implicit <strong>Operational Cost</strong>) and increases the risk of *downtime*.

<div class="callout info">
  <p>The goal of <strong>FinOps</strong> isn't to always pick the cheapest option, but the one that delivers the best <strong>Return on Investment (ROI)</strong> and the greatest efficiency for the business.</p>
</div>

---

## Design Principles for Cost Optimization

With cost established as an architectural metric, the focus shifts to design guidelines. Designing software architectures is never just about technology; it's fundamentally about <strong>business</strong>. Every decision should <strong>factor in Return on Investment (ROI)</strong> and respect financial constraints.

Some essential questions to consider at the start of the design:

* Are the allocated budgets enough to achieve the business goals?
* What is the expected spending pattern for the application and its operations? Which areas are the highest investment priorities?
* How do you maximize your investment in resources: through better utilization or through smart reduction of consumption?

It's important to note that a cost-optimized *workload* isn't necessarily the cheapest one. There are <strong>significant trade-offs</strong>. Tactical approaches are reactive and may only cut costs in the short term. To achieve long-term financial accountability, you need to <strong>build a structured strategy</strong>, with prioritization, continuous monitoring and repeatable processes focused on optimization.

The following design principles provide optimization strategies to consider as you design and implement your architecture.

---

### 1. Develop Cost-Management Discipline

<strong>Goal:</strong> Build a team culture that is aware of budget, expenses and cost tracking.

Cost optimization happens at multiple levels of the organization. It's crucial to align your *workload* costs with the organization's <strong>FinOps</strong> practices. Having visibility into business units, resource organization and centralized audit policies enables a standardized financial system.

| Approach | Optimization Benefit |
| :--- | :--- |
| <strong>Develop a Detailed Cost Model.</strong> This is the foundational exercise for financial tracking. | The model helps segment expenses and estimate Total Cost of Ownership (TCO), including infrastructure and support, allowing you to <strong>identify cost *drivers*</strong> and predict the impact of changes or growth on overall spend. |
| <strong>Implement a Clear and Flexible Accountability Model.</strong> Defined by well-assigned roles and responsibilities. | Clear accountability helps enforce functional expectations, increases transparency and enables reliable financial reporting at every level. |
| <strong>Ensure Realistic and Proactive Budgets.</strong> Covering functional and non-functional requirements and projected growth. | Lets you set financial limits and check spending continuously. Using <strong>threshold alerts</strong> prevents overspending at the account or resource scope. |
| <strong>Weigh proactive investment against penalty costs.</strong> For *workloads* governed by SLAs, decide whether the budget should cover penalties or implementation efforts. | Investing proactively in robust solutions can avoid penalties or fines, turning spending into a preventive measure. |
| <strong>Plan for Training and Support costs.</strong> Include the training, hiring and infrastructure costs needed to evolve the *workload*. | Investing in talent complements existing skills, whether through in-house staff or specialized technical support, maturing the *workload* sustainably. |
| <strong>Communicate the cost implications of every design decision.</strong> Changes driven by production *insights* should be reflected in the budget. | The organization can make practical budget adjustments based on production *feedback*, which should carry the same weight as numerical data. |

---

### 2. Design with a Cost-Efficiency Mindset

<strong>Goal:</strong> Spend only what's strictly necessary to achieve the highest possible return on investment (ROI).

Every architectural decision has direct and indirect financial implications (e.g., *build vs buy*, technology choice, licensing, operating cost). Given the need, the goal is to optimize by making smart *trade-offs* on cost without compromising essential requirements.

| Approach | Optimization Benefit |
| :--- | :--- |
| <strong>Establish a Cost Baseline</strong> that includes projected growth. The design must respect the allocated budget. | Cost estimation helps predict expenses, identify key cost *drivers* and <strong>reveal hidden costs</strong>, avoiding *over-engineering* and ensuring a balanced approach. |
| <strong>Create and enforce Cost *Guardrails*.</strong> Define minimum and maximum limits for resources in your architecture. | Enforcing these rules prevents incidental or unapproved charges and ensures only the budgeted amount of resources is provisioned (via <strong>Policy as Code</strong>). |
| <strong>Treat SDLC environments differently.</strong> Deploy the right number of environments with specific characteristics. | Recognizing that not every environment needs to mirror production saves money. Pre-production environments can use smaller SKUs, fewer instances and reduced *logging* levels. |
| <strong>Use *on-demand* non-production environments.</strong> Create development and test environments on demand and remove them when they're no longer needed. | This automated *Lifecycle Management* practice reduces operating costs by keeping resources from sitting idle 24/7. |

---

### 3. Design for Usage Optimization

<strong>Goal:</strong> Maximize the utilization of purchased resources and operations, aligning them with functional and non-functional requirements.

Cloud services offer a wide range of capabilities and pricing tiers. Once you've selected a set of features or a SKU, avoid underutilizing it. Find ways to get the most out of your investment in the chosen service tier.

| Approach | Optimization Benefit |
| :--- | :--- |
| <strong>Make the most of the selected resources (SKUs).</strong> Use the full capacity of what you paid for to meet performance and security goals. | Maximizes the ROI of what was invested. Avoid SKUs with features you don't need, as they add unnecessary cost with no extra benefit. |
| <strong>Adjust capacity dynamically.</strong> Scale up when demand increases and scale down when it's no longer needed (<strong>Auto-scaling</strong>). | Lets you keep a minimal baseline and expand only when required, aligning resource consumption with real usage patterns and avoiding excessive pre-provisioning. |
| <strong>Favor Active-Active models</strong> over Active-Passive when the resources are already paid for. | Avoids idle resources in Active-Passive setups that could be used for *load leveling* and to absorb scaling peaks, optimizing resilience spending. |
| <strong>Prioritize commitment-based discounts (*Committed Use*).</strong> Use Reserved Instances or Savings Plans. | Finding opportunities to use commitment plans significantly reduces the cost of rolling out new features, given a stable and predictable usage pattern. |
| <strong>Get the most out of your Support and Training Plan.</strong> | Using your support plan for production issues or proactive reviews ensures you get the full value of the investment. Investing in training ensures the team uses tools and technologies efficiently. |

---

### 4. Design for Rate Optimization

<strong>Goal:</strong> Increase efficiency and reduce utility costs without redesigning the architecture or sacrificing requirements.

Take advantage of opportunities to optimize the costs of existing resources and operations. Not doing so means wasting money with no additional ROI.

| Approach | Optimization Benefit |
| :--- | :--- |
| <strong>Identify resources with stable usage</strong> to optimize costs through <strong>pre-purchase (Reservations)</strong>. Work with the licensing team. | Committing long-term to specific resources secures lower rates, amortized over time. Influencing the licensing team helps ensure upcoming agreements align with your projected investments. |
| <strong>Explore alternatives that don't require additional licensing.</strong> Consider hybrid use or pre-production subscription pricing. | Reduces licensing costs by leveraging options that grant usage rights for comparable technologies at a lower cost. |
| <strong>Use consumption-based pricing (*Pay-as-you-go*) when it's more advantageous.</strong> | Paying only for what you use may be the best choice if you don't expect to fully utilize a prepaid option, avoiding underutilization. |
| <strong>Prefer fixed-price *billing*</strong> (reservations) over consumption when utilization is high and predictable. | When utilization is high, the fixed-price model is usually more cost-effective and often supports more features. |
| <strong>Co-locate usage with other *workloads* and teams.</strong> | Sharing resources across multiple *workloads* spreads out costs, since they're provisioned with greater capacity and managed centrally. |
| <strong>Deploy to lower-cost regions</strong>, as long as this doesn't compromise functional requirements. | Using premium regions only where strictly necessary leads to significant savings. You can use cheaper regions for non-critical environments. |
| <strong>Favor services that enable higher density.</strong> | As density increases (e.g., *serverless* or highly packed *containers*), the amount of resources needed to run the *workload* drops, lowering the cost per unit. |

---

### 5. Monitor and Optimize Continuously

<strong>Goal:</strong> Adjust your investment as the *workload* evolves alongside the ecosystem.

What mattered yesterday may not matter today. As you learn from production, the architecture, requirements and processes evolve. It's crucial to assess the cost impact of every change.

| Approach | Optimization Benefit |
| :--- | :--- |
| <strong>Build capabilities to capture and classify expenses.</strong> | Lets you calculate costs that reveal technical and business perspectives. Enables regular reviews and drives <strong>Showback and Chargeback</strong> processes. |
| <strong>Implement cost alerts</strong> when spending approaches predefined budgets. | Proactive notifications help prevent budget overruns and support real-time decision-making. |
| <strong>Continuously review and adjust design decisions</strong> with respect to resource and operating costs. | Regular reviews of metrics, performance and *billing* reports can lead to fine-tuning that reduces costs. |
| <strong>Decommission resources</strong> that are underutilized, obsolete or could be replaced by more efficient alternatives. | Resizing or removing unused resources cuts costs. Shutting down idle resources and deleting unnecessary data frees up budget for more valuable investments. |

--- 

## Governance and Automation

The design principles listed above are only effective if there are control mechanisms in place. <strong>Visibility</strong> (what we spend) alone doesn't solve anything; real optimization only materializes through <strong>continuous, automated action</strong> (how we make sure we spend well). Modern cost management can't rely on retroactive manual audits; it needs <strong>Governance as Code (*Policy as Code*)</strong> to prevent waste before it happens.

Cost-focused governance turns financial policies into executable engineering rules. Key governance tools and practices include:

#### 1. Policy as Code (PaC) for Cost *Guardrails*

<strong>PaC</strong> is the foundation of cost prevention. It ensures that every resource provisioned in the cloud automatically follows predefined cost, security and *tagging* rules. This <strong>prevents human error</strong> and the provisioning of overly expensive resources.

<strong>Practical Examples with Tools (Azure Policy, AWS Config, OPA):</strong>
    <strong>Size Limits:</strong> Block the creation of virtual machines (VMs) from *premium* or high-cost families in development/test environments, requiring justification for their use.
    <strong>Mandatory *Tagging*:</strong> Require every resource to carry the <strong>mandatory tags</strong> (`team`, `cost-center`, `environment`) so that *Showback* actually works.
    <strong>Licensing Compliance:</strong> Prevent the use of services that require expensive licensing when more efficient *serverless* alternatives are available.

#### 2. Optimization Automation (*Continuous Optimization*)

Once resources comply with PaC, automation kicks in to keep day-to-day usage efficient. These are *pipelines* that periodically analyze the environment and act on identified waste.

* <strong>Automated Right Sizing:</strong> Scripts that, based on utilization metrics (gathered via <strong>CFM/Observability</strong>), suggest or apply resizing of VMs, *containers* or databases to match real demand, avoiding idle capacity.
* <strong>Lifecycle Management (*Lifecycle Management*):</strong> Automations that shut down development and test environments outside business hours, or move cold data from expensive *storage* (*Hot Tier*) to cheaper tiers (*Cold Tier*), minimizing storage costs.
* <strong>Anomaly Alerts:</strong> Proactive notifications that fire when a service's daily spend exceeds a historical or budget threshold, allowing immediate correction before the bill grows exponentially.

Combining Governance (prevention via PaC) and Automation (continuous correction) keeps the system financially efficient, turning cost optimization into a continuous *pipeline* process.

<div class="callout tip">
  <p>Rolling out <strong>governance policies</strong> is challenging because it involves culture, regulatory compliance, clear responsibilities and changing everyday habits. To improve your odds of success:

<strong>Start small</strong>: prioritize high-impact guardrails (mandatory tags, SKU limits, allowed regions).<br/>
<strong>Define ownership</strong>: who approves, who monitors and who answers for deviations.<br/>
<strong>Explain the why</strong>: connect policies to FinOps (showback/chargeback, budgets, alerts) and provide enablement (templates, IaC modules, examples).<br/>
<strong>Automate</strong>: apply Policy as Code and pipeline checks to avoid reactive manual audits.<br/>
<strong>Measure and iterate</strong>: compliance metrics, blocked deviations and estimated savings guide continuous tuning.
</p>
</div>

---

### Where to Start?

The whole FinOps and CFM structure brings us back to where we started. For architects and engineering teams, the challenge is to make the system work as well as possible <strong>within budget</strong>. Starting the FinOps journey takes focus and discipline:

1.  <strong>Prioritize Visibility:</strong> Make sure 100% of resources are correctly <strong>tagged</strong>. Without clear *tags*, Showback/Chargeback and cost allocation are impossible.
2.  <strong>Educate and Raise Awareness:</strong> Implement <strong>Showback</strong>. Present monthly costs to development teams, turning cost into a product metric.
3.  <strong>Set Simple *Guardrails*:</strong> Start with <strong>Policy as Code</strong> to prevent the most expensive and common mistakes, such as provisioning resources without *tagging* or high-cost VMs in development environments.

A system's cost should be born at the start of the design cycle, as a <strong>fundamental business requirement</strong>. Only then will the architecture be not just technically robust, but economically sustainable too.

---

## FinOps Roadmap

<section id="finops-roadmap" style="margin:2.25rem 0;">
<p class="rm-intro" style="margin: .5rem 0 1rem; color: var(--color-fg-soft);">
  A practical, iterative path to mature your cost management, aligning teams and technical decisions with financial outcomes.
</p>

<div class="rm-carousel">
  <button class="rm-nav prev" aria-label="Previous" title="Previous">‹</button>
  <button class="rm-nav next" aria-label="Next" title="Next">›</button>
  <div class="rm-fade left" aria-hidden="true"></div>
  <div class="rm-fade right" aria-hidden="true"></div>

  <div class="rm-track" role="region" aria-roledescription="carousel" aria-label="FinOps Roadmap">
    <div class="rm-item" role="group" aria-roledescription="slide" aria-label="1 of 3">
      <div class="rm-line"><span class="rm-marker">1</span></div>
      <span class="rm-stepnum">Step 1</span>
      <h5>Foundation of visibility and accountability</h5>
      <ul>
        <li>Establish <strong>mandatory tagging</strong> (teams, product, environment, cost center).</li>
        <li>Create <strong>budgets</strong> and <strong>alerts</strong> per account/product/environment.</li>
        <li>Build <strong>dashboards</strong> and <strong>reports</strong> per business unit.</li>
        <li>Implement monthly <strong>Showback</strong> to make cost a product metric.</li>
      </ul>
    </div>
    <div class="rm-item" role="group" aria-roledescription="slide" aria-label="2 of 3">
      <div class="rm-line"><span class="rm-marker">2</span></div>
      <span class="rm-stepnum">Step 2</span>
      <h5>Tackling waste head-on</h5>
      <ul>
        <li>Run recurring <strong>right sizing</strong> (machines, databases, pods).</li>
        <li>Apply <strong>reservations/savings plans</strong> for stable usage.</li>
        <li>Automate the <strong>lifecycle</strong> of non-production environments (start/stop).</li>
        <li>Optimize <strong>storage and log retention</strong> based on real needs.</li>
      </ul>
    </div>
    <div class="rm-item" role="group" aria-roledescription="slide" aria-label="3 of 3">
      <div class="rm-line"><span class="rm-marker">3</span></div>
      <span class="rm-stepnum">Step 3</span>
      <h5>Governance and continuous improvement</h5>
      <ul>
        <li>Adopt <strong>Policy as Code</strong> for cost and compliance <em>guardrails</em>.</li>
        <li>Enable <strong>anomaly detection</strong> and fast responses to deviations.</li>
        <li>Evolve from <strong>Showback</strong> to <strong>Chargeback</strong> once you're mature enough.</li>
        <li>Run <strong>periodic architecture reviews</strong> driven by CFM data.</li>
      </ul>
    </div>
  </div>
  <div class="rm-dots" role="tablist" aria-label="Roadmap slides">
    <button class="dot" role="tab" aria-current="true" title="Slide 1"></button>
    <button class="dot" role="tab" title="Slide 2"></button>
    <button class="dot" role="tab" title="Slide 3"></button>
  </div>
</div>
</section>
