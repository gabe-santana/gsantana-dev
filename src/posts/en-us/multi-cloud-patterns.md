---
title: "Multi-Cloud Without the Pain: Patterns That Survive Contact with Reality"
description: "Multi-cloud works when you know why you are doing it and make things portable only where it pays off: containers and IaC, federated identity instead of copied secrets, one observability plane. Data placement is the decision that actually locks you in, so make it first."
date: 2026-02-06
tags: [Multi-Cloud, Terraform, Azure, AWS, Architecture]
tldr:
  - "Most teams should run each workload on one deliberately chosen cloud and share only IaC, identity, observability and governance practices."
  - "Replace copied cloud keys with OIDC federation, so GitHub Actions deploys to Azure and AWS using short-lived tokens scoped to repo and branch."
  - "Decide data placement first, because egress costs and cross-cloud latency lock you in far more than compute ever will."
---

Somewhere in a slide deck right now, an architecture diagram shows the same application running on Azure, AWS and Google Cloud at the same time, with traffic flowing between them. The slide says "no vendor lock-in". What it leaves out is three IAM models, three networking stacks, three bills with egress charges, and an on-call rotation that needs to be fluent in all of it at 3 a.m.

Multi-cloud is not good or bad. It is expensive, and the expense only makes sense if you know exactly what you are buying with it. The teams that do it well are not the ones that run everything everywhere. They are the ones that decided **why** they are multi-cloud, and then made things portable only at the layers where portability pays for itself.

## The Problem & Context

Start with the drivers, because every later decision depends on them. Honest reasons to be on more than one cloud look like this:

- **Regulation and sovereignty.** A regulator, a contract or a data residency rule requires a specific provider, region or a provably independent fallback.
- **Acquisition.** You bought a company that runs on the other cloud. Migrating it is a multi-year project with no customer-facing value, so both clouds stay.
- **Best-of-breed services.** One provider has the managed service you actually need: a specific AI model platform, an analytics engine, a database your team knows deeply.
- **Negotiating leverage.** Having a credible second provider changes the tone of a renewal conversation. This only works if the second provider is real, not a PowerPoint.
- **Resilience against a provider-level failure.** Rare, but for some systems a whole-provider outage or account-level problem is an unacceptable risk.

And the bad reasons: "avoiding lock-in" as an abstract goal, a CTO who read an analyst report, or a vague sense that portability is always good. Lock-in is a cost to manage, not an evil to eliminate at any price.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If we build everything to run on any cloud, we can just move whenever a provider raises prices, right?</span>
    </div>
  </div>
</div>

In theory. In practice, to run anywhere you have to give up anything that only exists somewhere. No managed queues, no serverless triggers, no provider-native databases, no managed identity. You rebuild those capabilities yourself on VMs or Kubernetes, and now you operate a message broker, a database cluster and a secrets store that your provider would have run for you. This is the **lowest-common-denominator trap**: you pay the full cost of portability every single day to insure against a migration that may never happen. And when the migration does come, the data is still sitting in the old cloud, which is the part that is actually hard to move.

### The multi-cloud spectrum

It helps to see multi-cloud as a spectrum, not a switch:

| Level | What it looks like | Cost | Who should be here |
|---|---|---|---|
| 1. By accident | Teams picked clouds independently. No shared practices, duplicate everything | Hidden but high | Nobody, on purpose |
| 2. Workload-per-cloud | Each workload lives on one cloud, chosen deliberately. Shared IaC, identity, observability and governance practices | Moderate | Most organizations |
| 3. Portable workloads | Workloads can be redeployed on another cloud within days or weeks. Data replicated or restorable | High | Regulated or sovereignty-driven systems |
| 4. Active-active across providers | Same workload serving traffic from two clouds at once | Very high | A tiny set of systems with extreme requirements |

The sweet spot for almost everyone is **level 2**. Each workload uses its cloud fully, managed services included, while the platform practices around it (how you provision, authenticate, observe and govern) are shared. You get most of the organizational benefits without paying the portability tax on every component.

## Deep Dive / Architectural Design

### A reference architecture

Here is what level 2 looks like for a typical organization running on Azure and AWS:

```text
                          +-----------------------------+
                          |  GitHub (repos + Actions)   |
                          |  OIDC tokens, no cloud keys |
                          +--------------+--------------+
                                         |
                    federated trust      |      federated trust
              +--------------------------+--------------------------+
              v                                                     v
+-----------------------------+                       +-----------------------------+
|  AZURE                      |                       |  AWS                        |
|  Hub VNet (firewall, DNS)   |<===== private =======>|  Transit GW / hub VPC       |
|    |          |             |     interconnect      |    |          |             |
|  Spoke:     Spoke:          |   (ExpressRoute  <->  |  Spoke:     Spoke:          |
|  ERP +      AI platform     |    Direct Connect     |  E-commerce Analytics       |
|  identity   (Azure OpenAI)  |    via colo/partner)  |  (EKS)      (data lake)     |
|                             |                       |                             |
|  Key Vault (Azure secrets)  |                       |  Secrets Manager (AWS)      |
|  Entra ID (workforce IdP) --+------ SAML/OIDC ----->|  IAM Identity Center        |
+--------------+--------------+                       +--------------+--------------+
               |                                                     |
               |          OpenTelemetry collectors in each cloud     |
               +-----------------------+-----------------------------+
                                       v
                        +-------------------------------+
                        |  One observability backend    |
                        |  logs, metrics, traces, SLOs  |
                        +-------------------------------+
```

Notice what is shared and what is not. Secrets, networking and compute are **per cloud**. Identity, delivery and observability are **one plane** across both.

### Workload placement by capability

Place each workload where its most important dependency lives. The ERP integration and AI platform go to Azure because that is where the identity and the model platform are. The e-commerce stack stays on AWS because it came with an acquisition and runs well there. The rule to avoid: splitting a single workload across clouds so that every request crosses the provider boundary. That is how you get latency on every call and egress on every byte.

### Hub networking per cloud, private interconnect between them

Build a normal hub-and-spoke (or a managed equivalent like Virtual WAN or Transit Gateway) in each cloud, following that cloud's conventions. Then connect the hubs privately, usually through a colocation or a network partner that terminates both ExpressRoute and Direct Connect. Site-to-site VPN over the internet works for low volume and as a backup path. Plan IP address space across all clouds and on-premises **before** the first VNet is created. Overlapping CIDRs are painful to fix later, and they turn up surprisingly often after acquisitions.

### Identity federation instead of copied secrets

The most common multi-cloud security failure is a long-lived AWS access key stored as a secret in an Azure DevOps pipeline, or an Azure service principal secret sitting in an AWS parameter store. Every copied credential is a key that someone must rotate, and usually nobody does.

Federate instead. For people, one workforce identity provider (Entra ID, for example) federates into the other cloud's SSO. For workloads and pipelines, use **OIDC workload identity**: the CI system issues a short-lived signed token, and each cloud is configured to trust tokens from that issuer with specific claims. No stored secrets, nothing to rotate, and access is scoped by repository and branch. We will build exactly this in the next section.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Shouldn't we use one secrets manager for both clouds, so there's a single source of truth?</span>
    </div>
  </div>
</div>

It sounds tidy, but it creates a cross-cloud dependency on your most critical path. If the AWS workloads read secrets from Azure Key Vault, an Azure incident or a broken interconnect takes down AWS too, and every workload needs a credential to reach the secrets store, which is the original problem again. Keep secrets **in the cloud where they are consumed**, accessed through that cloud's native identity. What you share is the policy: naming, rotation rules, who can read what, and how it is audited.

### Terraform: one interface, provider-specific implementations

Use the same IaC tool and workflow everywhere, but do not write a "universal" module that abstracts away the clouds. Define a small **interface** (inputs and outputs that mean the same thing) and write separate implementations per provider:

```hcl title="main.tf (excerpt)"
# Same inputs and outputs, different implementation per cloud
module "artifact_store" {
  source = "./modules/object-store/aws" # or ./modules/object-store/azure

  name        = "orders-artifacts"
  environment = "prod"
  retention   = 90
}

output "artifact_store_url" {
  value = module.artifact_store.url
}
```

Consumers of the module get a consistent contract. Inside, the AWS version uses S3 features and the Azure version uses Storage account features, without pretending they are identical.

### Kubernetes as a portability layer (and its bill)

Containers are the cheapest portability you can buy: a container image runs on AKS, EKS or a VM with almost no changes. Kubernetes goes further and gives you the same deployment API everywhere. But it is not free. You still have provider-specific ingress, storage classes, identity integration (Azure Workload Identity vs EKS Pod Identity or IRSA), autoscaling and upgrades. Kubernetes makes the **application** portable; it does not make the **platform** portable. Use it when you need a common runtime, not as a ritual.

### One observability plane

Instrument everything with **OpenTelemetry**, run collectors in each cloud, and ship logs, metrics and traces to a single backend. When an incident spans a request from AWS to Azure, you want one trace, not two consoles and a spreadsheet. Filter and sample at the collector to keep cross-cloud telemetry traffic under control, since that is egress too.

### Data gravity decides everything

Compute is easy to move. Data is not. Providers generally charge little or nothing for data coming in and meaningfully for data going out, and cross-cloud latency is real on every synchronous call. Put a chatty service in one cloud and its database in another, and you pay on every query, forever. Decide data placement **first**: where the system of record lives, what gets replicated, and in which direction. If an event-driven design connects the clouds, keep the event flow asynchronous and batched where you can (the patterns in [Event-Driven Microservices on Azure: Service Bus vs Event Grid vs Event Hubs](/en-us/blog/azure-service-bus-vs-event-grid-vs-event-hubs/) apply directly).

### DR across clouds vs across regions

For most systems, a second **region** in the same cloud is the right disaster recovery target. Same services, same IAM, same tooling, and replication features built in. Cross-**cloud** DR protects against provider-level or account-level failures, but it means maintaining a working second implementation of everything, which rots quickly if not exercised. Choose it only when the risk justifies that cost, and write down which threat you are actually covering.

## Hands-On Implementation

Let's build the identity layer: a GitHub Actions workflow that deploys to both Azure and AWS with **zero stored cloud credentials**. On Azure we use a user-assigned managed identity with a federated credential; on AWS, an IAM OIDC provider plus a role whose trust policy checks the repository and branch.

```hcl title="versions.tf"
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

provider "aws" {
  region = var.aws_region
}
```

```hcl title="variables.tf"
variable "azure_subscription_id" {
  description = "Azure subscription where the deployment identity lives"
  type        = string
}

variable "azure_location" {
  description = "Azure region for the identity resource group"
  type        = string
  default     = "eastus2"
}

variable "azure_role_definition_name" {
  description = "Built-in or custom role granted to the pipeline in Azure"
  type        = string
  default     = "Contributor"
}

variable "aws_region" {
  description = "Default AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_deploy_policy_arn" {
  description = "Managed policy ARN attached to the pipeline role in AWS"
  type        = string
}

variable "github_oidc_thumbprints" {
  description = "Thumbprints for the GitHub OIDC issuer certificate chain"
  type        = list(string)
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

variable "github_org" {
  description = "GitHub organization or user that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "Repository name, without the organization"
  type        = string
}

variable "github_branch" {
  description = "Only workflows running on this branch may deploy"
  type        = string
  default     = "main"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gha-deploy"
}

locals {
  github_issuer = "https://token.actions.githubusercontent.com"
  # The same subject claim is trusted by both clouds
  github_subject = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.github_branch}"
}
```

```hcl title="identity-azure.tf"
data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "identity" {
  name     = "rg-${var.name_prefix}-identity"
  location = var.azure_location
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "id-${var.name_prefix}"
  location            = azurerm_resource_group.identity.location
  resource_group_name = azurerm_resource_group.identity.name
}

# Trust GitHub's OIDC tokens for one repo and branch; no client secret exists
resource "azurerm_federated_identity_credential" "github_branch" {
  name                = "github-${var.github_repo}-${var.github_branch}"
  resource_group_name = azurerm_resource_group.identity.name
  parent_id           = azurerm_user_assigned_identity.github.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = local.github_issuer
  subject             = local.github_subject
}

# Scope as narrowly as possible; a resource group beats the whole subscription
resource "azurerm_role_assignment" "github_deploy" {
  scope                = azurerm_resource_group.identity.id
  role_definition_name = var.azure_role_definition_name
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}
```

```hcl title="identity-aws.tf"
# One OIDC provider per AWS account for GitHub's issuer
resource "aws_iam_openid_connect_provider" "github" {
  url             = local.github_issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.github_oidc_thumbprints
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Without this condition, any repo on GitHub could assume the role
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_subject]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${var.name_prefix}-github"
  assume_role_policy   = data.aws_iam_policy_document.github_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = var.aws_deploy_policy_arn
}
```

```hcl title="outputs.tf"
# Identifiers, not secrets: safe to store as GitHub repository variables
output "azure_client_id" {
  value = azurerm_user_assigned_identity.github.client_id
}

output "azure_tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "azure_subscription_id" {
  value = var.azure_subscription_id
}

output "aws_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
```

After `terraform apply`, copy the four outputs into GitHub **repository variables** (not secrets, since none of them grants access on its own). The workflow then requests an OIDC token and exchanges it with each cloud:

```yaml title=".github/workflows/deploy.yml"
name: deploy

on:
  push:
    branches: [main]

# id-token: write lets the job request a GitHub OIDC token
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure login (OIDC, no secret)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: AWS login (OIDC, no access keys)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1
          role-session-name: gha-${{ github.run_id }}

      - name: Prove both identities
        run: |
          az account show --query "{subscription:name, tenant:tenantId}" -o table
          aws sts get-caller-identity
```

Both logins produce short-lived credentials that expire on their own. If someone forks the repository or pushes a workflow to another branch, the subject claim does not match and both clouds refuse the token.

<div class="callout warning" data-title="Warning">
  <p>The subject claim changes with the trigger. A job that uses <code>environment: production</code> presents <code>repo:org/repo:environment:production</code>, and a pull request presents <code>repo:org/repo:pull_request</code>. If login fails with a subject mismatch, check which claim the job actually sends and add a federated credential (and an AWS trust condition) for that exact value. Avoid wildcards on <code>sub</code> unless you understand every workflow they admit.</p>
</div>

## Production Reality Check

**Skills and on-call are the biggest cost.** Every cloud you add is another set of services, failure modes and consoles your engineers must know under pressure. A team that is excellent on one cloud and mediocre on two is a real risk. Budget for training, and route on-call by workload so nobody is expected to be an expert in everything.

**Governance gets duplicated.** Azure Policy and AWS Organizations with service control policies solve similar problems in different ways. Tagging standards, budget alerts, landing zones and security baselines all need an implementation per cloud. Write the **intent** once (for example, "no public storage, mandatory cost-center tag") and map it to each cloud's native controls.

**IAM models do not line up.** Azure RBAC assigns roles at scopes in a hierarchy; AWS IAM evaluates identity and resource policies with explicit denies and permission boundaries. "Contributor" has no exact AWS equivalent. Do not build a translation layer that pretends otherwise; review access per cloud, in each cloud's own terms.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Egress can't be that bad. It's just a few cents per gigabyte, isn't it?</span>
    </div>
  </div>
</div>

Per gigabyte it looks harmless. Then someone points a nightly analytics job in one cloud at the data lake in the other, or enables verbose cross-cloud log shipping, and the line item grows every month without anyone deciding it should. Egress surprises come from architecture, not from pricing tables. Tag and alert on data transfer costs per workload, review new cross-cloud flows in design reviews, and move the computation to the data rather than the other way around.

<div class="callout info" data-title="Info">
  <p>Private interconnects usually lower per-gigabyte transfer costs and make latency predictable, but they add fixed port and partner costs. Model both options against your real expected traffic, and check current pricing on each provider before you commit.</p>
</div>

**Test failover for real.** A cross-cloud DR plan that has never been executed is a hypothesis. Schedule game days: fail a workload over, run it on the other side under real traffic, and fail back. Expect to discover expired certificates, missing DNS records, quotas that were never raised, and a runbook step that only one person understood. That is the point of the exercise.

**Know where to stop.** Most organizations should aim for workload-per-cloud with shared platform practices: portable at the container and IaC layer, federated identity everywhere, one observability plane, and data placement decided up front. Go further only when a specific driver (a regulator, a real resilience requirement) pays for it. Multi-cloud without the pain is not about running everything everywhere. It is about spending your portability budget only where it earns its keep.
