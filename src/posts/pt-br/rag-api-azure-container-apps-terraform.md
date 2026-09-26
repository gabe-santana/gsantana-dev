---
title: "Deploying a RAG API to Azure Container Apps with Terraform, Step by Step"
description: "Um deploy no Azure Container Apps com cara de produção é, na maior parte, identidade e configuração: uma imagem puxada do ACR por uma managed identity, secrets referenciados do Key Vault e escala guiada por concorrência HTTP. Some health probes e uma sequência deliberada para o primeiro deploy, e as novas revisions entram no ar com segurança em vez de falhar no meio da madrugada."
date: 2026-04-27
tags: [Azure, Container Apps, Terraform, RAG, FastAPI]
tldr:
  - "Puxe imagens do ACR com uma managed identity user-assigned que tenha AcrPull, e mantenha a conta admin do registry desabilitada."
  - "Guarde a chave do modelo no Key Vault e deixe o container app referenciá-la pela mesma identidade, nunca como valor em texto puro."
  - "Escale por concorrência HTTP, mantenha pelo menos uma réplica aquecida e proteja cada revision com probes de liveness e readiness."
---

Colocar uma aplicação FastAPI rodando no Azure Container Apps leva um comando `az containerapp up`. Colocá-la rodando do jeito que você defenderia numa revisão de arquitetura (sem senha de registry, sem API key em variável de ambiente, escala previsível, revisions que se recusam a receber tráfego até estarem saudáveis) dá um pouco mais de trabalho. A boa notícia: quase nada desse trabalho extra é código. É identidade e configuração.

Este post constrói tudo de ponta a ponta: uma pequena API de RAG com um retriever plugável, testes, um Dockerfile, uma configuração Terraform que valida contra o provider azurerm 4.x atual e a sequência exata de comandos para fazer o deploy, incluindo a parte que a maioria dos tutoriais pula, que é o primeiríssimo deploy.

## O problema e o contexto

Vamos à situação típica. Um time tem uma API de retrieval-augmented generation que funciona no notebook. Ela expõe um endpoint `POST /ask`, recupera alguns trechos de contexto e os passa para um modelo. Agora ela precisa morar num lugar de verdade, e os requisitos são estes:

- **Nada de segredo compartilhado para infraestrutura.** Ninguém deveria copiar uma senha de registry para uma variável de pipeline.
- **A API key do modelo mora em um lugar só.** Rotacioná-la não deveria exigir redeploy da definição da aplicação.
- **Escala com o tráfego, não com um cron.** Tranquila à noite, mais movimentada no horário comercial.
- **Releases ruins não derrubam as boas.** Uma revision que quebra no startup nunca pode receber tráfego.
- **É reproduzível.** Destruir o ambiente e recriá-lo é um comando, não uma página de wiki.

O Azure Container Apps encaixa bem nesse formato. Ele roda containers numa plataforma gerenciada baseada em Kubernetes sem você encostar no Kubernetes, escala com regras do KEDA (inclusive até zero) e tem suporte de primeira classe a managed identities, referências ao Key Vault e revisions. O Terraform transforma tudo isso num arquivo revisável.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que não habilitar o usuário admin do ACR e colar a senha no container app? Funciona de primeira.</span>
    </div>
  </div>
</div>

Funciona de primeira, e essa é a armadilha. O usuário admin é uma única credencial compartilhada com direito de push e pull no registry inteiro. Ela acaba em variáveis de pipeline, no histórico do shell de alguém, num state do Terraform, e ninguém sabe quem mais está usando quando chega a hora de rotacionar. Uma managed identity com a role `AcrPull` não tem senha para vazar, só consegue fazer pull e tem escopo de exatamente um registry. O custo é um role assignment. Essa troca nem é disputada.

## Mergulho na arquitetura

A arquitetura alvo cabe em uma figura:

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

Cinco decisões sustentam tudo.

**1. Uma identidade user-assigned faz os dois trabalhos.** A mesma identidade puxa a imagem e resolve o secret do Key Vault. Uma identidade user-assigned (em vez de system-assigned) existe antes do container app, e isso importa: você pode conceder as roles primeiro, e a aplicação consegue usá-las já na primeira revision. Com uma identidade system-assigned, a identidade nasce junto com a aplicação, então a primeira revision tenta fazer pull antes de qualquer role existir.

**2. Secrets são referências, não valores.** O container app declara um secret com `key_vault_secret_id` e a identidade a ser usada. A plataforma busca o valor no Key Vault e o expõe para o container como variável de ambiente via `secret_name`. O Terraform da aplicação nunca vê a chave, e rotacioná-la é uma operação no Key Vault.

**3. Escale por concorrência, não por CPU.** Uma requisição de RAG passa a maior parte da vida esperando uma chamada ao modelo ou à busca. A CPU fica baixa enquanto a latência sobe. Uma regra de escala HTTP adiciona réplicas quando as requisições concorrentes por réplica passam de um limite, o que acompanha o que o usuário realmente sente.

**4. Health endpoints protegem as revisions.** Toda mudança no template cria uma nova revision. A readiness probe mantém o tráfego longe de uma réplica até o `/healthz` responder, e a liveness probe reinicia uma réplica que para de responder. Sem probes, "o container subiu" é tratado como "a aplicação está pronta".

**5. A imagem é construída uma vez e promovida por tag.** O `az acr build` faz o build no Azure e envia para o registry. O Terraform só referencia `rag-api:<tag>`. Avançar ou voltar versão é uma troca de tag.

Veja como cada peça se relaciona com aquilo contra o que ela protege:

| Peça | Falha que ela evita |
|---|---|
| ACR com admin desabilitado + identidade com AcrPull | Credenciais de registry vazadas ou impossíveis de rotacionar |
| Referência ao Key Vault + role Secrets User | API keys em app settings e no state em texto puro |
| Regra de escala HTTP | Picos de latência enquanto a CPU parece ociosa |
| Probes de readiness e liveness | Revisions quebradas recebendo tráfego |
| min_replicas de pelo menos 1 | Cold start na primeira requisição do dia |

## Implementação na prática

### A estrutura do projeto

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

Num projeto real, fixe as versões e mova `pytest` e `httpx2` para um arquivo separado de dependências de desenvolvimento, para que eles fiquem fora da imagem.

### O núcleo do RAG: interfaces primeiro

A API não se importa com a origem do contexto nem com quem escreve a resposta. Ela depende de dois protocolos pequenos, `Retriever` e `Generator`. O retriever em memória e o generator stub fazem tudo rodar sem nenhum serviço externo, que é exatamente o que você quer nos testes e no primeiro deploy.

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


# Um corpus minúsculo para a API rodar sem nenhum serviço externo.
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
    """Sobreposição de palavras. Suficiente para provar o encanamento, não é um motor de busca."""

    def __init__(self, documents: list[Document]):
        self._documents = list(documents)

    def retrieve(self, query: str, k: int) -> list[Document]:
        terms = _tokens(query)
        scored = [(len(terms & _tokens(d.text)), d) for d in self._documents]
        hits = [(score, d) for score, d in scored if score > 0]
        hits.sort(key=lambda pair: pair[0], reverse=True)
        return [d for _, d in hits[:k]]


class StubGenerator:
    """Devolve o contexto de grounding em vez de chamar um modelo."""

    def generate(self, question: str, context: list[Document]) -> str:
        if not context:
            return "No relevant context found."
        return "Answer grounded in: " + ", ".join(d.id for d in context)


class HttpGenerator:
    """Client enxuto para o que estiver atrás de MODEL_ENDPOINT (seu gateway ou adapter).
    Troque o corpo da requisição pela chamada do SDK do seu provedor; a interface continua a mesma."""

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
    # Um client de busca de verdade (busca híbrida, um índice vetorial) entra aqui, lendo
    # SEARCH_ENDPOINT do ambiente e implementando retrieve(query, k).
    return InMemoryRetriever(CORPUS)


def build_generator() -> Generator:
    endpoint = os.getenv("MODEL_ENDPOINT", "")
    if endpoint:
        return HttpGenerator(endpoint, os.getenv("MODEL_API_KEY", ""))
    return StubGenerator()
```

As factories são a costura. O `build_generator` lê `MODEL_ENDPOINT` e `MODEL_API_KEY` do ambiente, que é exatamente onde o Container Apps vai colocá-las. Quando você trocar o retriever por palavras-chave por algo sério, como a abordagem de [Hybrid Search That Actually Works](/pt-br/blog/hybrid-search-bm25-vectors-rrf/), só o `build_retriever` muda.

### A API

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
        # Barato e sem dependências: as probes batem aqui a cada poucos segundos.
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
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O /healthz não deveria chamar o modelo e o índice de busca, para só dizer que está saudável quando tudo funciona?</span>
    </div>
  </div>
</div>

Tentador, e perigoso. As probes rodam a cada poucos segundos em cada réplica. Se o `/healthz` chama o modelo, um provedor de modelo lento vira liveness probe falhando, e a plataforma começa a reiniciar réplicas perfeitamente saudáveis, o que piora a indisponibilidade. A liveness deveria responder uma única pergunta: este processo está vivo e consegue servir HTTP? Se você quer checar dependências, coloque isso num endpoint separado que alimenta dashboards e alertas, não restarts.

### Testes

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

Rode `pip install -r requirements.txt` e depois `pytest`. O último teste é o mais importante: ele prova que o retriever é mesmo substituível via `create_app`, que é a mesma costura que um client de busca de verdade usa.

### O container

```dockerfile title="Dockerfile"
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Dependências primeiro, para mudanças no código não invalidarem a camada do pip.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Nunca rode como root dentro do container.
RUN useradd --create-home --uid 10001 appuser
USER 10001

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

O `PYTHONUNBUFFERED` importa mais do que parece: sem ele, os logs ficam presos num buffer e aparecem no Log Analytics atrasados, ou nem aparecem, quando uma réplica quebra.

### Terraform: providers e variáveis

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

### Terraform: plataforma, registry e identidade

```hcl title="main.tf"
resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

locals {
  name  = "${var.prefix}-${random_string.suffix.result}"
  flat  = "${var.prefix}${random_string.suffix.result}" # para nomes que não aceitam hífen
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
  admin_enabled       = false # nada de usuário e senha compartilhados, nunca
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
  rbac_authorization_enabled = true # Azure RBAC, não access policies
  soft_delete_retention_days = 7
  purge_protection_enabled   = false # ligue em vaults de produção
}

# Quem roda o Terraform precisa gravar o secret.
resource "azurerm_role_assignment" "deployer_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# A aplicação só precisa ler.
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
  <p>Aqui o valor do secret passa pelo Terraform, então ele vai parar no state. Isso só é aceitável com um backend remoto criptografado e com controle de acesso. O padrão mais rígido é criar o secret por fora (ou fazer quem emite a chave gravá-la direto no Key Vault) e deixar o Terraform gerenciar só a referência <code>secret</code> na aplicação.</p>
</div>

### Terraform: o container app

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

  # Pull do ACR como a managed identity: nenhuma senha de registry em lugar nenhum.
  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.api.id
  }

  # Uma referência, não uma cópia: a plataforma resolve o valor no Key Vault.
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

  # As duas roles precisam existir antes de a primeira revision tentar fazer pull e resolver o secret.
  depends_on = [
    azurerm_role_assignment.acr_pull,
    azurerm_role_assignment.api_secrets_user,
  ]
}
```

Alguns detalhes merecem uma segunda leitura. O `versionless_id` faz a aplicação seguir a versão mais recente do secret, então a rotação não precisa de mudança no Terraform. O `concurrent_requests` é uma string no schema do provider, daí o `tostring`. E o `depends_on` não é enfeite: o container app não tem nenhuma referência de atributo aos role assignments, então sem ele o Terraform criaria a aplicação em paralelo com as permissões dela, sem pestanejar.

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
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Ótimo, então eu rodo terraform apply uma vez e tudo sobe?</span>
    </div>
  </div>
</div>

Não numa subscription vazia. O container app referencia `rag-api:v1` num registry que o Terraform está criando na mesma execução. O registry nasce vazio, a primeira revision não consegue fazer pull e o apply falha ou fica pendurado até dar timeout. A imagem precisa estar no registry antes de a aplicação existir. A correção mais limpa é um primeiro deploy em duas fases: criar o registry, fazer o build da imagem e só então aplicar todo o resto.

### Deploy, passo a passo

```bash title="deploy.sh"
cd infra
export TF_VAR_model_api_key="replace-me"   # qualquer valor serve enquanto o generator stub estiver ativo

terraform init

# Fase 1 (só no primeiro deploy): criar apenas o registry para ter onde enviar a imagem.
terraform apply -target=azurerm_container_registry.main
ACR=$(terraform output -raw acr_name)

# Build no Azure e push. Sem daemon Docker local, sem senha de registry.
az acr build --registry "$ACR" --image rag-api:v1 ..

# Fase 2: todo o resto, incluindo o container app apontando para rag-api:v1.
terraform plan -out tfplan
terraform apply tfplan

APP_URL=$(terraform output -raw app_url)
curl "$APP_URL/healthz"
curl -X POST "$APP_URL/ask" -H "Content-Type: application/json" \
  -d '{"question": "How do I pull images from ACR?"}'

# Toda release depois disso: build de uma nova tag e rollout como nova revision.
az acr build --registry "$ACR" --image rag-api:v2 ..
terraform apply -var image_tag=v2
```

O `-target` existe para situações excepcionais, e o bootstrap é uma delas. Depois do primeiro deploy, nunca mais use: todo apply deveria ser um plan completo.

## Checagem de realidade em produção

**A propagação de RBAC não é instantânea.** Role assignments podem levar alguns minutos para valer. Num ambiente novo, a gravação do secret no Key Vault pode falhar com 403 mesmo com o assignment de Secrets Officer recém-criado, e a primeira revision pode falhar no pull mesmo com o AcrPull existindo. Rodar `terraform apply` de novo alguns minutos depois costuma resolver. Se acontece toda vez no CI, crie a identidade e os role assignments dela num estágio anterior, ou adicione uma espera explícita, em vez de tentar de novo às cegas.

<div class="callout warning" data-title="Atenção">
  <p>O truque da imagem placeholder (subir a aplicação com uma imagem pública de exemplo e trocar depois) parece mais simples que um apply em duas fases, mas o placeholder precisa escutar no mesmo <code>target_port</code> e responder no path da sua probe. Uma imagem de exemplo na porta 80 com probes em <code>/healthz</code> na porta 8000 gera uma revision que nunca fica pronta, e o apply falha por motivos que nada têm a ver com o seu código.</p>
</div>

**Escolha o revision mode de propósito.** No modo `Single`, uma nova revision substitui a antiga assim que fica pronta, e a antiga é desativada. Isso, junto com as readiness probes, te dá um rolling update seguro de graça. No modo `Multiple`, várias revisions ficam ativas e você divide o tráfego entre elas, o que permite releases canário:

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

O porém: no modo Multiple, revisions antigas continuam rodando (e cobrando) até você desativá-las, e os pesos de tráfego viram algo que o seu pipeline precisa gerenciar. Comece com Single e passe para Multiple quando você realmente fizer canários.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O Container Apps escala até zero, então min_replicas = 0 é dinheiro de graça, certo?</span>
    </div>
  </div>
</div>

Economiza dinheiro e custa latência. Com zero réplicas, a primeira requisição depois de um período ocioso espera uma réplica ser agendada, a imagem ser baixada se não estiver em cache, o Python importar o FastAPI e seus clients e a readiness probe passar. Para uma ferramenta interna, tudo bem. Para uma caixa de chat voltada ao usuário, a primeira pergunta da manhã parece quebrada. `min_replicas = 1` mantém uma réplica aquecida, o que significa pagar por ela o dia inteiro. Confira a página de preços atual do Container Apps para a sua região e decida por ambiente: zero para dev, uma ou mais para produção.

**Ajuste a regra de escala contra a dependência mais lenta.** Um limite de concorrência de 20 pressupõe que uma réplica aguenta 20 requisições em andamento. Se cada requisição espera vários segundos pelo modelo, essas requisições são basicamente sockets ociosos, e o limite pode subir. Se o provedor do modelo te aplica rate limit, mais réplicas só produzem mais 429 mais rápido. O seu `max_replicas` deveria refletir o que os serviços downstream conseguem absorver, não o que a plataforma permite.

**Olhe os logs onde eles realmente chegam.** A saída de console vai para o Log Analytics pelo environment. As duas tabelas que você mais vai consultar são a dos logs de console do container e a dos logs de sistema, que contêm as falhas úteis: erros de pull de imagem, erros de resolução de secret, falhas de probe. Quando uma revision fica presa em provisionamento, o log de sistema diz o porquê, normalmente nas primeiras linhas.

<div class="callout tip" data-title="Dica">
  <p>Se o CI envia imagens e atualiza a aplicação fora do Terraform (por exemplo com <code>az containerapp update --image</code>), adicione um bloco <code>lifecycle { ignore_changes = [template[0].container[0].image] }</code> ao container app. Caso contrário, o próximo <code>terraform apply</code> faz rollback silencioso da produção para a tag que estiver nas suas variáveis.</p>
</div>

**Rede privada é o próximo passo, não um detalhe para depois.** Este setup expõe a aplicação publicamente e acessa o ACR e o Key Vault por endpoints públicos, autenticando por identidade. Para muitas cargas internas, o próximo movimento é um Container Apps environment integrado a uma VNet, private endpoints para ACR e Key Vault, acesso de rede pública desabilitado nos dois e ingress apenas interno, com um application gateway ou Front Door na frente. Isso muda os recursos de rede, não o modelo de identidade que você acabou de construir, e é exatamente por isso que o modelo de identidade vem primeiro.

Tire o Python da frente e este post é, na verdade, sobre cinco linhas de intenção: a imagem vem de um registry sem senha, a chave vem de um vault que a aplicação só consegue ler, as réplicas seguem a concorrência, uma revision conquista tráfego passando nas probes e o primeiro deploy segue uma ordem deliberada. Acerte essas cinco coisas e o Container Apps vira a parte menos surpreendente do seu sistema de RAG.
