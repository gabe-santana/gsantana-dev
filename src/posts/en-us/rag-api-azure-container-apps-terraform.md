---
title: "Deploying a RAG API to Azure Container Apps with Terraform, Step by Step"
description: "A production-shaped Container Apps deployment is mostly identity and configuration: one image pulled from ACR by a managed identity, secrets referenced from Key Vault, and scaling driven by HTTP concurrency. Add health probes and a deliberate first-deploy sequence, and new revisions roll out safely instead of failing in the middle of the night."
date: 2026-04-27
tags: [Azure, Container Apps, Terraform, RAG, FastAPI]
tldr:
  - "Pull images from ACR with a user-assigned managed identity holding AcrPull, and keep the registry admin account disabled."
  - "Store the model key in Key Vault and let the container app reference it through the same identity, never as a plain value."
  - "Scale on HTTP concurrency, keep at least one replica warm, and gate every revision with liveness and readiness probes."
---

Getting a FastAPI app running on Azure Container Apps takes one `az containerapp up` command. Getting it running the way you would defend in a design review (no registry passwords, no API keys in environment variables, predictable scaling, revisions that refuse to take traffic until they are healthy) takes a bit more. The good news: almost none of that extra work is code. It is identity and configuration.

This post builds the whole thing end to end: a small RAG API with a pluggable retriever, tests, a Dockerfile, a Terraform configuration that validates against the current azurerm 4.x provider, and the exact command sequence to deploy it, including the part most tutorials skip, which is the very first deploy.

## The Problem & Context

Here is the typical situation. A team has a retrieval-augmented generation API that works on a laptop. It exposes a `POST /ask` endpoint, retrieves a few chunks of context, and passes them to a model. Now it needs to live somewhere real, and the requirements look like this:

- **No shared secrets for infrastructure.** Nobody should copy a registry password into a pipeline variable.
- **The model API key lives in one place.** Rotating it should not require a redeploy of the app definition.
- **It scales with traffic, not with a cron job.** Quiet at night, busier during business hours.
- **Bad releases do not take down good ones.** A revision that crashes on startup must never receive traffic.
- **It is reproducible.** Tearing the environment down and rebuilding it is one command, not a wiki page.

Azure Container Apps fits this shape well. It runs containers on a managed Kubernetes-based platform without you touching Kubernetes, scales with KEDA rules (including to zero), and has first-class support for managed identities, Key Vault references and revisions. Terraform turns all of it into a reviewable file.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why not just enable the ACR admin user and paste the password into the container app? It works on the first try.</span>
    </div>
  </div>
</div>

It does work on the first try, and that is the trap. The admin user is a single shared credential with push and pull rights on the whole registry. It ends up in pipeline variables, in someone's shell history, in a Terraform state file, and nobody knows who else is using it when the time comes to rotate it. A managed identity with the `AcrPull` role has no password to leak, can only pull, and is scoped to exactly one registry. The cost is one role assignment. That trade is not close.

## Deep Dive / Architectural Design

The target architecture fits in one picture:

```text
                         Internet (HTTPS)
                               |
                               v
  +---------------------------------------------------------------+
  | Container Apps environment            ---> Log Analytics      |
  |                                            (console + system  |
  |  +---------------------------------------+  logs)             |
  |  | Container app "rag-api"               |                    |
  |  |  ingress :8000, probes on /healthz    |                    |
  |  |  scale: 1..5 replicas, HTTP rule      |                    |
  |  |  user-assigned managed identity ------+----+               |
  |  +-------------------+-------------------+    |               |
  +----------------------|------------------------|---------------+
                         |                        |
      pulls image (AcrPull)          reads secret (Key Vault Secrets User)
                         |                        |
                         v                        v
            +----------------------+   +------------------------+
            | Azure Container      |   | Key Vault (RBAC mode)  |
            | Registry, admin off  |   | secret: model-api-key  |
            +----------------------+   +------------------------+

  rag-api --HTTPS--> external model / search endpoint (MODEL_ENDPOINT)
```

Five decisions carry the weight.

**1. One user-assigned identity does both jobs.** The same identity pulls the image and resolves the Key Vault secret. A user-assigned identity (rather than system-assigned) exists before the container app does, which matters: you can grant its roles first, and the app can use them on its very first revision. With a system-assigned identity, the identity is born with the app, so the first revision tries to pull before any role exists.

**2. Secrets are references, not values.** The container app declares a secret with `key_vault_secret_id` and the identity to use. The platform fetches the value from Key Vault and exposes it to the container as an environment variable through `secret_name`. The Terraform for the app never sees the key, and rotating it is a Key Vault operation.

**3. Scale on concurrency, not CPU.** A RAG request spends most of its life waiting on a model or a search call. CPU stays low while latency climbs. An HTTP scale rule adds replicas when concurrent requests per replica cross a threshold, which tracks what users actually feel.

**4. Health endpoints gate revisions.** Every change to the template creates a new revision. The readiness probe keeps traffic away from a replica until `/healthz` answers, and the liveness probe restarts a replica that stops answering. Without probes, "the container started" is treated as "the app is ready".

**5. The image is built once and promoted by tag.** `az acr build` builds in Azure and pushes to the registry. Terraform only references `rag-api:<tag>`. Rolling forward or back is a tag change.

Here is how the pieces map to what they protect against:

| Piece | Failure it prevents |
|---|---|
| ACR with admin disabled + AcrPull identity | Leaked or unrotatable registry credentials |
| Key Vault reference + Secrets User role | API keys in plain app settings and state |
| HTTP scale rule | Latency spikes while CPU looks idle |
| Readiness and liveness probes | Broken revisions receiving traffic |
| min_replicas of at least 1 | Cold starts on the first request of the day |

## Hands-On Implementation

### The project layout

```text title="layout"
rag-api/
  app/
    __init__.py        (empty)
    rag.py
    main.py
  tests/
    test_api.py
  infra/
    providers.tf  variables.tf  main.tf
    keyvault.tf   containerapp.tf  outputs.tf
  Dockerfile
  pytest.ini
  requirements.txt
```

```text title="requirements.txt"
fastapi
uvicorn
pytest
httpx2
```

In a real project, pin versions and move `pytest` and `httpx2` to a separate dev requirements file so they stay out of the image.

### The RAG core: interfaces first

The API does not care where context comes from or who writes the answer. It depends on two small protocols, `Retriever` and `Generator`. The in-memory retriever and the stub generator make the whole thing run with zero external services, which is exactly what you want in tests and on the first deploy.

```python title="app/rag.py"
import json
import os
import re
import urllib.request
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Document:
    id: str
    text: str


class Retriever(Protocol):
    def retrieve(self, query: str, k: int) -> list[Document]: ...


class Generator(Protocol):
    def generate(self, question: str, context: list[Document]) -> str: ...


# A tiny corpus so the API runs with zero external services.
CORPUS = [
    Document("acr-pull", "Container Apps pull images from ACR with a managed identity that holds the AcrPull role."),
    Document("key-vault", "Secrets live in Key Vault and the container app references them through its identity."),
    Document("scaling", "The HTTP scale rule adds replicas when concurrent requests per replica pass the threshold."),
    Document("probes", "Liveness and readiness probes on the health endpoint gate traffic to a new revision."),
]

_STOPWORDS = {"a", "an", "and", "the", "to", "of", "on", "in", "is", "do", "does", "how", "what", "with", "from"}


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS}


class InMemoryRetriever:
    """Keyword overlap. Good enough to prove the plumbing, not a search engine."""

    def __init__(self, documents: list[Document]):
        self._documents = list(documents)

    def retrieve(self, query: str, k: int) -> list[Document]:
        terms = _tokens(query)
        scored = [(len(terms & _tokens(d.text)), d) for d in self._documents]
        hits = [(score, d) for score, d in scored if score > 0]
        hits.sort(key=lambda pair: pair[0], reverse=True)
        return [d for _, d in hits[:k]]


class StubGenerator:
    """Returns the grounding context instead of calling a model."""

    def generate(self, question: str, context: list[Document]) -> str:
        if not context:
            return "No relevant context found."
        return "Answer grounded in: " + ", ".join(d.id for d in context)


class HttpGenerator:
    """Thin client for whatever sits behind MODEL_ENDPOINT (your gateway or adapter).
    Swap the request body for your provider's SDK call; the interface stays the same."""

    def __init__(self, endpoint: str, api_key: str, timeout: float = 30.0):
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def generate(self, question: str, context: list[Document]) -> str:
        body = json.dumps({"question": question, "context": [d.text for d in context]}).encode()
        request = urllib.request.Request(
            self._endpoint,
            data=body,
            headers={"Content-Type": "application/json", "api-key": self._api_key},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self._timeout) as response:
            return json.loads(response.read())["answer"]


def build_retriever() -> Retriever:
    # A real search client (hybrid search, a vector index) plugs in here, reading
    # SEARCH_ENDPOINT from the environment and implementing retrieve(query, k).
    return InMemoryRetriever(CORPUS)


def build_generator() -> Generator:
    endpoint = os.getenv("MODEL_ENDPOINT", "")
    if endpoint:
        return HttpGenerator(endpoint, os.getenv("MODEL_API_KEY", ""))
    return StubGenerator()
```

The factories are the seam. `build_generator` reads `MODEL_ENDPOINT` and `MODEL_API_KEY` from the environment, which is exactly where Container Apps will put them. When you replace the keyword retriever with something serious, like the approach in [Hybrid Search That Actually Works](/en-us/blog/hybrid-search-bm25-vectors-rrf/), only `build_retriever` changes.

### The API

```python title="app/main.py"
from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.rag import Generator, Retriever, build_generator, build_retriever


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    k: int = Field(default=3, ge=1, le=10)


class ContextChunk(BaseModel):
    id: str
    text: str


class AskResponse(BaseModel):
    answer: str
    context: list[ContextChunk]


def create_app(retriever: Retriever | None = None, generator: Generator | None = None) -> FastAPI:
    retriever = retriever or build_retriever()
    generator = generator or build_generator()
    api = FastAPI(title="rag-api")

    @api.get("/healthz")
    def healthz() -> dict[str, str]:
        # Cheap and dependency-free: probes hit this every few seconds.
        return {"status": "ok"}

    @api.post("/ask", response_model=AskResponse)
    def ask(request: AskRequest) -> AskResponse:
        documents = retriever.retrieve(request.question, request.k)
        answer = generator.generate(request.question, documents)
        return AskResponse(
            answer=answer,
            context=[ContextChunk(id=d.id, text=d.text) for d in documents],
        )

    return api


app = create_app()
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Shouldn't /healthz call the model and the search index, so it only reports healthy when everything works?</span>
    </div>
  </div>
</div>

Tempting, and dangerous. Probes run every few seconds on every replica. If `/healthz` calls the model, a slow model provider turns into failing liveness probes, and the platform starts restarting perfectly healthy replicas, which makes the outage worse. Liveness should answer one question: is this process alive and able to serve HTTP? If you want dependency checks, put them on a separate endpoint that feeds dashboards and alerts, not restarts.

### Tests

```ini title="pytest.ini"
[pytest]
pythonpath = .
testpaths = tests
```

```python title="tests/test_api.py"
from fastapi.testclient import TestClient

from app.main import app, create_app
from app.rag import Document, InMemoryRetriever, StubGenerator

client = TestClient(app)


def test_healthz_returns_ok():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ask_returns_relevant_context():
    response = client.post("/ask", json={"question": "How do I pull images from ACR?"})
    assert response.status_code == 200
    body = response.json()
    assert body["context"][0]["id"] == "acr-pull"
    assert "acr-pull" in body["answer"]


def test_ask_without_match_returns_empty_context():
    response = client.post("/ask", json={"question": "quantum pizza"})
    assert response.status_code == 200
    assert response.json()["context"] == []


def test_ask_rejects_empty_question():
    response = client.post("/ask", json={"question": ""})
    assert response.status_code == 422


def test_retriever_is_pluggable():
    custom = create_app(
        retriever=InMemoryRetriever([Document("faq-1", "Refunds take five business days.")]),
        generator=StubGenerator(),
    )
    response = TestClient(custom).post("/ask", json={"question": "How long do refunds take?", "k": 1})
    assert [c["id"] for c in response.json()["context"]] == ["faq-1"]
```

Run `pip install -r requirements.txt` and then `pytest`. The last test is the important one: it proves the retriever really is swappable through `create_app`, which is the same seam a real search client uses.

### The container

```dockerfile title="Dockerfile"
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Dependencies first, so code changes do not bust the pip layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Never run as root inside the container.
RUN useradd --create-home --uid 10001 appuser
USER 10001

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`PYTHONUNBUFFERED` matters more than it looks: without it, logs sit in a buffer and show up in Log Analytics late or not at all when a replica crashes.

### Terraform: providers and variables

```hcl title="providers.tf"
terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}
```

```hcl title="variables.tf"
variable "prefix" {
  type        = string
  description = "Short name used in every resource name."
  default     = "ragapi"
}

variable "location" {
  type    = string
  default = "eastus2"
}

variable "image_tag" {
  type        = string
  description = "Tag of the rag-api image in ACR. Change it to roll out a new revision."
  default     = "v1"
}

variable "model_endpoint" {
  type        = string
  description = "URL of the model gateway. Empty means the stub generator."
  default     = ""
}

variable "model_api_key" {
  type        = string
  description = "API key for the model endpoint. Stored in Key Vault, never in app settings."
  sensitive   = true
}

variable "min_replicas" {
  type    = number
  default = 1
}

variable "max_replicas" {
  type    = number
  default = 5
}

variable "concurrent_requests" {
  type        = number
  description = "Concurrent HTTP requests per replica before the scaler adds another."
  default     = 20
}
```

### Terraform: platform, registry and identity

```hcl title="main.tf"
resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

locals {
  name  = "${var.prefix}-${random_string.suffix.result}"
  flat  = "${var.prefix}${random_string.suffix.result}" # for names that forbid dashes
  image = "${azurerm_container_registry.main.login_server}/rag-api:${var.image_tag}"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name}"
  location = var.location
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

resource "azurerm_container_registry" "main" {
  name                = "acr${local.flat}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "Basic"
  admin_enabled       = false # no shared username/password, ever
}

resource "azurerm_user_assigned_identity" "api" {
  name                = "id-${local.name}-api"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}
```

### Terraform: Key Vault

```hcl title="keyvault.tf"
resource "azurerm_key_vault" "main" {
  name                       = "kv-${local.flat}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true # Azure RBAC, not access policies
  soft_delete_retention_days = 7
  purge_protection_enabled   = false # turn on for production vaults
}

# Whoever runs Terraform needs to write the secret.
resource "azurerm_role_assignment" "deployer_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# The app only needs to read it.
resource "azurerm_role_assignment" "api_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_key_vault_secret" "model_api_key" {
  name         = "model-api-key"
  value        = var.model_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.deployer_secrets_officer]
}
```

<div class="callout info" data-title="Info">
  <p>The secret value passes through Terraform here, so it lands in state. That is acceptable only with a remote backend that is encrypted and access-controlled. The stricter pattern is to create the secret out of band (or have the key issuer write it to Key Vault) and let Terraform manage only the <code>secret</code> reference on the app.</p>
</div>

### Terraform: the container app

```hcl title="containerapp.tf"
resource "azurerm_container_app" "api" {
  name                         = "ca-${local.name}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api.id]
  }

  # Pull from ACR as the managed identity: no registry password anywhere.
  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.api.id
  }

  # A reference, not a copy: the platform resolves it from Key Vault.
  secret {
    name                = "model-api-key"
    key_vault_secret_id = azurerm_key_vault_secret.model_api_key.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  ingress {
    external_enabled = true
    target_port      = 8000

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "api"
      image  = local.image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "MODEL_ENDPOINT"
        value = var.model_endpoint
      }

      env {
        name        = "MODEL_API_KEY"
        secret_name = "model-api-key"
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/healthz"
        interval_seconds        = 10
        failure_count_threshold = 3
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/healthz"
        interval_seconds        = 5
        failure_count_threshold = 3
      }
    }

    http_scale_rule {
      name                = "http-concurrency"
      concurrent_requests = tostring(var.concurrent_requests)
    }
  }

  # Both roles must exist before the first revision tries to pull and resolve.
  depends_on = [
    azurerm_role_assignment.acr_pull,
    azurerm_role_assignment.api_secrets_user,
  ]
}
```

A few details worth reading twice. `versionless_id` makes the app follow the latest version of the secret, so rotation does not need a Terraform change. `concurrent_requests` is a string in the provider schema, hence the `tostring`. And the `depends_on` is not decoration: the container app has no attribute reference to the role assignments, so without it Terraform would happily create the app in parallel with its permissions.

```hcl title="outputs.tf"
output "app_url" {
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "acr_name" {
  value = azurerm_container_registry.main.name
}

output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "latest_revision" {
  value = azurerm_container_app.api.latest_revision_name
}
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Great, so I run terraform apply once and everything comes up?</span>
    </div>
  </div>
</div>

Not on an empty subscription. The container app references `rag-api:v1` in a registry that Terraform is creating in the same run. The registry comes up empty, the first revision cannot pull, and the apply fails or hangs until it times out. You need the image in the registry before the app exists. The cleanest fix is a two-phase first deploy: create the registry, build the image, then apply everything.

### Deploying, step by step

```bash title="deploy.sh"
cd infra
export TF_VAR_model_api_key="replace-me"   # any value works while the stub generator is active

terraform init

# Phase 1 (first deploy only): create just the registry so there is somewhere to push.
terraform apply -target=azurerm_container_registry.main
ACR=$(terraform output -raw acr_name)

# Build in Azure and push. No local Docker daemon, no registry password.
az acr build --registry "$ACR" --image rag-api:v1 ..

# Phase 2: everything else, including the container app pointing at rag-api:v1.
terraform plan -out tfplan
terraform apply tfplan

APP_URL=$(terraform output -raw app_url)
curl "$APP_URL/healthz"
curl -X POST "$APP_URL/ask" -H "Content-Type: application/json" \
  -d '{"question": "How do I pull images from ACR?"}'

# Every release after that: build a new tag and roll it out as a new revision.
az acr build --registry "$ACR" --image rag-api:v2 ..
terraform apply -var image_tag=v2
```

`-target` is meant for exceptional situations, and bootstrapping is one of them. After the first deploy, never use it again: every apply should be a full plan.

## Production Reality Check

**RBAC propagation is not instant.** Role assignments can take a few minutes to become effective. On a fresh environment, the Key Vault secret write can fail with a 403 even though the Secrets Officer assignment was just created, and the first revision can fail to pull even though AcrPull exists. Re-running `terraform apply` a couple of minutes later usually fixes it. If it happens every time in CI, create the identity and its role assignments in an earlier stage, or add an explicit wait, rather than retrying blindly.

<div class="callout warning" data-title="Warning">
  <p>The placeholder image trick (deploy the app with a public sample image, swap it later) looks simpler than a two-phase apply, but the placeholder must listen on the same <code>target_port</code> and answer your probe path. A sample image on port 80 with probes on <code>/healthz</code> at port 8000 produces a revision that never becomes ready, and the apply fails for reasons unrelated to your code.</p>
</div>

**Choose the revision mode on purpose.** In `Single` mode, a new revision replaces the old one once it is ready, and the old one is deactivated. That, plus readiness probes, gives you a safe rolling update for free. In `Multiple` mode, several revisions stay active and you split traffic between them, which enables canary releases:

```hcl title="containerapp.tf (excerpt)"
  revision_mode = "Multiple"

  ingress {
    external_enabled = true
    target_port      = 8000

    traffic_weight {
      revision_suffix = "v1"
      percentage      = 90
    }

    traffic_weight {
      latest_revision = true
      percentage      = 10
    }
  }
```

The catch: in Multiple mode, old revisions keep running (and billing) until you deactivate them, and traffic weights become something your pipeline has to manage. Start with Single, move to Multiple when you actually run canaries.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Container Apps scales to zero, so min_replicas = 0 is free money, right?</span>
    </div>
  </div>
</div>

It saves money and costs latency. With zero replicas, the first request after an idle period waits for a replica to be scheduled, the image to be pulled if it is not cached, Python to import FastAPI and your clients, and the readiness probe to pass. For an internal tool, that is fine. For a user-facing chat box, the first question of the morning feels broken. `min_replicas = 1` keeps one replica warm, which means paying for it around the clock. Check the current Container Apps pricing page for your region and decide per environment: zero for dev, one or more for production.

**Tune the scale rule against the slowest dependency.** A concurrency threshold of 20 assumes a replica can hold 20 in-flight requests. If each request waits several seconds on a model, those requests are mostly idle sockets, and the threshold can go higher. If the model provider rate-limits you, more replicas just produce more 429s faster. Your `max_replicas` should reflect what downstream services can absorb, not what the platform allows.

**Watch the logs where they actually land.** Console output goes to Log Analytics through the environment. The two tables you will query most are the container console logs and the system logs, which contain the useful failures: image pull errors, secret resolution errors, probe failures. When a revision is stuck provisioning, the system log tells you why, usually in the first few lines.

<div class="callout tip" data-title="Tip">
  <p>If CI pushes images and updates the app outside Terraform (for example with <code>az containerapp update --image</code>), add a <code>lifecycle { ignore_changes = [template[0].container[0].image] }</code> block to the container app. Otherwise the next <code>terraform apply</code> quietly rolls production back to whatever tag is in your variables.</p>
</div>

**Private networking is the next step, not an afterthought.** This setup exposes the app publicly and reaches ACR and Key Vault over public endpoints, authenticated by identity. For many internal workloads, the next move is a VNet-integrated Container Apps environment, private endpoints for ACR and Key Vault, public network access disabled on both, and internal-only ingress fronted by an application gateway or Front Door. It changes the networking resources, not the identity model you just built, which is exactly why the identity model comes first.

Strip away the Python and this post is really about five lines of intent: the image comes from a registry that has no password, the key comes from a vault the app can only read, replicas follow concurrency, a revision earns traffic by passing its probes, and the first deploy follows a deliberate order. Get those right and Container Apps becomes the least surprising part of your RAG system.
