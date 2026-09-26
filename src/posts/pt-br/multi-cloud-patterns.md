---
title: "Multi-Cloud Without the Pain: Patterns That Survive Contact with Reality"
description: "Torne portável só o que compensa e decida primeiro onde seus dados vão morar."
date: 2026-02-06
tags: [Multi-Cloud, Terraform, Azure, AWS, Architecture]
tldr:
  - "A maioria dos times deveria rodar cada workload em uma cloud escolhida de propósito e compartilhar só práticas de IaC, identidade, observabilidade e governança."
  - "Troque chaves copiadas por federação OIDC: o GitHub Actions faz deploy na Azure e na AWS com tokens curtos restritos a repo e branch."
  - "Decida onde os dados ficam primeiro, porque custo de egress e latência entre clouds prendem você muito mais do que compute."
---

Neste exato momento, em algum slide por aí, um diagrama de arquitetura mostra a mesma aplicação rodando na Azure, na AWS e no Google Cloud ao mesmo tempo, com tráfego passando entre elas. O slide diz "sem vendor lock-in". O que ele não mostra são três modelos de IAM, três stacks de rede, três faturas com cobrança de egress e uma escala de plantão que precisa dominar tudo isso às 3 da manhã.

Multi-cloud não é bom nem ruim. É caro, e esse custo só faz sentido se você sabe exatamente o que está comprando com ele. Os times que fazem isso bem não são os que rodam tudo em todo lugar. São os que decidiram **por que** são multi-cloud e, a partir daí, tornaram as coisas portáveis só nas camadas em que a portabilidade se paga.

## O problema e o contexto

Comece pelos motivos, porque toda decisão seguinte depende deles. Motivos honestos para estar em mais de uma cloud são estes:

- **Regulação e soberania.** Um regulador, um contrato ou uma regra de residência de dados exige um provedor específico, uma região específica ou um fallback comprovadamente independente.
- **Aquisição.** Você comprou uma empresa que roda na outra cloud. Migrar é um projeto de vários anos sem nenhum valor visível para o cliente, então as duas clouds ficam.
- **Melhor serviço da categoria.** Um provedor tem o serviço gerenciado de que você realmente precisa: uma plataforma específica de modelos de IA, um motor de analytics, um banco de dados que o seu time conhece a fundo.
- **Poder de negociação.** Ter um segundo provedor crível muda o tom de uma conversa de renovação. Isso só funciona se o segundo provedor for real, não um PowerPoint.
- **Resiliência contra falha em nível de provedor.** É raro, mas para alguns sistemas uma queda do provedor inteiro ou um problema na conta é um risco inaceitável.

E os motivos ruins: "evitar lock-in" como objetivo abstrato, um CTO que leu um relatório de analista, ou uma sensação vaga de que portabilidade é sempre bom. Lock-in é um custo a ser gerenciado, não um mal a ser eliminado a qualquer preço.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se a gente construir tudo para rodar em qualquer cloud, dá para mudar de provedor sempre que alguém aumentar o preço, né?</span>
    </div>
  </div>
</div>

Na teoria. Na prática, para rodar em qualquer lugar você precisa abrir mão de tudo que só existe em algum lugar. Nada de filas gerenciadas, triggers serverless, bancos nativos do provedor ou managed identity. Você reconstrói essas capacidades por conta própria em VMs ou Kubernetes, e agora opera um message broker, um cluster de banco de dados e um cofre de segredos que o provedor teria operado por você. Essa é a **armadilha do menor denominador comum**: você paga o custo inteiro da portabilidade todo santo dia para se proteger de uma migração que talvez nunca aconteça. E quando a migração finalmente chega, os dados continuam na cloud antiga, que é justamente a parte difícil de mover.

### O espectro do multi-cloud

Ajuda enxergar multi-cloud como um espectro, não como um interruptor:

| Nível | Como é | Custo | Quem deveria estar aqui |
|---|---|---|---|
| 1. Por acidente | Os times escolheram clouds de forma independente. Nenhuma prática compartilhada, tudo duplicado | Escondido, mas alto | Ninguém, de propósito |
| 2. Workload por cloud | Cada workload vive em uma cloud, escolhida de propósito. IaC, identidade, observabilidade e governança compartilhadas | Moderado | A maioria das organizações |
| 3. Workloads portáveis | Workloads podem ser reimplantados em outra cloud em dias ou semanas. Dados replicados ou restauráveis | Alto | Sistemas regulados ou movidos por soberania |
| 4. Active-active entre provedores | O mesmo workload servindo tráfego de duas clouds ao mesmo tempo | Muito alto | Um conjunto minúsculo de sistemas com requisitos extremos |

O ponto ideal para quase todo mundo é o **nível 2**. Cada workload usa sua cloud por completo, serviços gerenciados incluídos, enquanto as práticas de plataforma ao redor (como você provisiona, autentica, observa e governa) são compartilhadas. Você fica com a maior parte dos benefícios organizacionais sem pagar o imposto da portabilidade em cada componente.

## Mergulho na arquitetura

### Uma arquitetura de referência

Assim é o nível 2 para uma organização típica rodando na Azure e na AWS:

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

Repare no que é compartilhado e no que não é. Segredos, rede e compute são **por cloud**. Identidade, entrega e observabilidade são **um plano só** para as duas.

### Posicionamento de workload por capacidade

Coloque cada workload onde vive a sua dependência mais importante. A integração com o ERP e a plataforma de IA vão para a Azure porque é lá que estão a identidade e a plataforma de modelos. O stack de e-commerce fica na AWS porque veio com uma aquisição e roda bem lá. A regra a evitar: dividir um único workload entre clouds de modo que toda requisição atravesse a fronteira do provedor. É assim que você ganha latência em cada chamada e egress em cada byte.

### Rede hub por cloud, interconexão privada entre elas

Monte um hub-and-spoke normal (ou um equivalente gerenciado como Virtual WAN ou Transit Gateway) em cada cloud, seguindo as convenções daquela cloud. Depois conecte os hubs de forma privada, normalmente por meio de uma colocation ou de um parceiro de rede que termine tanto o ExpressRoute quanto o Direct Connect. VPN site-to-site pela internet funciona para volume baixo e como caminho de backup. Planeje o espaço de endereçamento IP de todas as clouds e do on-premises **antes** de criar a primeira VNet. CIDRs sobrepostos são dolorosos de corrigir depois, e aparecem com uma frequência surpreendente depois de aquisições.

### Federação de identidade em vez de segredos copiados

A falha de segurança mais comum em multi-cloud é uma access key de longa duração da AWS guardada como segredo num pipeline do Azure DevOps, ou um segredo de service principal da Azure largado num parameter store da AWS. Cada credencial copiada é uma chave que alguém precisa rotacionar, e normalmente ninguém rotaciona.

Federe. Para pessoas, um único provedor de identidade corporativo (o Entra ID, por exemplo) federa no SSO da outra cloud. Para workloads e pipelines, use **OIDC workload identity**: o sistema de CI emite um token assinado de curta duração, e cada cloud é configurada para confiar em tokens daquele emissor com claims específicas. Nenhum segredo guardado, nada para rotacionar, e o acesso fica restrito por repositório e branch. Vamos construir exatamente isso na próxima seção.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Não seria melhor usar um único secrets manager para as duas clouds, com uma fonte única da verdade?</span>
    </div>
  </div>
</div>

Parece organizado, mas cria uma dependência entre clouds no seu caminho mais crítico. Se os workloads da AWS leem segredos do Azure Key Vault, um incidente na Azure ou uma interconexão quebrada derruba a AWS também, e todo workload precisa de uma credencial para chegar ao cofre, que é o problema original de novo. Mantenha os segredos **na cloud onde eles são consumidos**, acessados pela identidade nativa daquela cloud. O que você compartilha é a política: nomenclatura, regras de rotação, quem pode ler o quê e como isso é auditado.

### Terraform: uma interface, implementações por provedor

Use a mesma ferramenta de IaC e o mesmo fluxo em todo lugar, mas não escreva um módulo "universal" que abstrai as clouds. Defina uma **interface** pequena (inputs e outputs que significam a mesma coisa) e escreva implementações separadas por provedor:

```hcl title="main.tf (excerpt)"
# Mesmos inputs e outputs, implementação diferente por cloud
module "artifact_store" {
  source = "./modules/object-store/aws" # ou ./modules/object-store/azure

  name        = "orders-artifacts"
  environment = "prod"
  retention   = 90
}

output "artifact_store_url" {
  value = module.artifact_store.url
}
```

Quem consome o módulo recebe um contrato consistente. Por dentro, a versão AWS usa recursos do S3 e a versão Azure usa recursos do Storage account, sem fingir que são idênticos.

### Kubernetes como camada de portabilidade (e a conta dele)

Containers são a portabilidade mais barata que você pode comprar: uma imagem roda no AKS, no EKS ou numa VM quase sem mudanças. O Kubernetes vai além e te dá a mesma API de deploy em todo lugar. Mas ele não é de graça. Você continua com ingress, storage classes, integração de identidade (Azure Workload Identity vs EKS Pod Identity ou IRSA), autoscaling e upgrades específicos de cada provedor. O Kubernetes deixa a **aplicação** portável; ele não deixa a **plataforma** portável. Use quando você precisa de um runtime comum, não por ritual.

### Um único plano de observabilidade

Instrumente tudo com **OpenTelemetry**, rode collectors em cada cloud e envie logs, métricas e traces para um único backend. Quando um incidente envolve uma requisição da AWS para a Azure, você quer um trace só, não dois consoles e uma planilha. Filtre e faça sampling no collector para manter sob controle o tráfego de telemetria entre clouds, porque isso também é egress.

### A gravidade dos dados decide tudo

Compute é fácil de mover. Dados, não. Os provedores geralmente cobram pouco ou nada pela entrada de dados e cobram de forma relevante pela saída, e a latência entre clouds é real em toda chamada síncrona. Coloque um serviço tagarela numa cloud e o banco dele em outra, e você paga em cada query, para sempre. Decida o posicionamento dos dados **primeiro**: onde fica o sistema de registro, o que é replicado e em qual direção. Se um design orientado a eventos conecta as clouds, mantenha o fluxo de eventos assíncrono e em lotes sempre que possível (os padrões de [Event-Driven Microservices on Azure: Service Bus vs Event Grid vs Event Hubs](/pt-br/blog/azure-service-bus-vs-event-grid-vs-event-hubs/) se aplicam diretamente).

### DR entre clouds vs entre regiões

Para a maioria dos sistemas, uma segunda **região** na mesma cloud é o alvo certo de disaster recovery. Mesmos serviços, mesmo IAM, mesmo ferramental, e recursos de replicação nativos. DR entre **clouds** protege contra falhas em nível de provedor ou de conta, mas exige manter uma segunda implementação funcional de tudo, e isso apodrece rápido se não for exercitado. Escolha essa opção só quando o risco justificar o custo, e registre por escrito qual ameaça você está cobrindo de fato.

## Implementação na prática

Vamos construir a camada de identidade: um workflow do GitHub Actions que faz deploy na Azure e na AWS com **zero credenciais de cloud armazenadas**. Na Azure usamos uma user-assigned managed identity com uma federated credential; na AWS, um IAM OIDC provider mais uma role cuja trust policy confere o repositório e a branch.

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
  # A mesma subject claim é aceita pelas duas clouds
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

# Confia nos tokens OIDC do GitHub para um repo e uma branch; não existe client secret
resource "azurerm_federated_identity_credential" "github_branch" {
  name                = "github-${var.github_repo}-${var.github_branch}"
  resource_group_name = azurerm_resource_group.identity.name
  parent_id           = azurerm_user_assigned_identity.github.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = local.github_issuer
  subject             = local.github_subject
}

# Escopo o mais estreito possível; um resource group é melhor que a subscription inteira
resource "azurerm_role_assignment" "github_deploy" {
  scope                = azurerm_resource_group.identity.id
  role_definition_name = var.azure_role_definition_name
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}
```

```hcl title="identity-aws.tf"
# Um OIDC provider por conta AWS para o emissor do GitHub
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

    # Sem esta condição, qualquer repo do GitHub conseguiria assumir a role
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
# Identificadores, não segredos: podem ficar em variables do repositório no GitHub
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

Depois do `terraform apply`, copie os quatro outputs para as **repository variables** do GitHub (não secrets, já que nenhum deles dá acesso sozinho). O workflow então pede um token OIDC e troca esse token com cada cloud:

```yaml title=".github/workflows/deploy.yml"
name: deploy

on:
  push:
    branches: [main]

# id-token: write permite que o job peça um token OIDC ao GitHub
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

Os dois logins geram credenciais de curta duração que expiram sozinhas. Se alguém fizer fork do repositório ou subir um workflow em outra branch, a subject claim não bate e as duas clouds recusam o token.

<div class="callout warning" data-title="Atenção">
  <p>A subject claim muda conforme o gatilho. Um job que usa <code>environment: production</code> apresenta <code>repo:org/repo:environment:production</code>, e um pull request apresenta <code>repo:org/repo:pull_request</code>. Se o login falhar por subject divergente, confira qual claim o job realmente envia e adicione uma federated credential (e uma condição na trust policy da AWS) para esse valor exato. Evite wildcards no <code>sub</code>, a menos que você entenda cada workflow que eles liberam.</p>
</div>

## Checagem de realidade em produção

**Habilidades e plantão são o maior custo.** Cada cloud que você adiciona é mais um conjunto de serviços, modos de falha e consoles que seus engenheiros precisam dominar sob pressão. Um time excelente em uma cloud e mediano em duas é um risco real. Reserve orçamento para treinamento e organize o plantão por workload, para ninguém precisar ser especialista em tudo.

**A governança fica duplicada.** Azure Policy e AWS Organizations com service control policies resolvem problemas parecidos de jeitos diferentes. Padrões de tags, alertas de orçamento, landing zones e baselines de segurança precisam de uma implementação por cloud. Escreva a **intenção** uma vez (por exemplo, "nenhum storage público, tag de centro de custo obrigatória") e mapeie para os controles nativos de cada cloud.

**Os modelos de IAM não se encaixam.** O Azure RBAC atribui roles em escopos dentro de uma hierarquia; o AWS IAM avalia policies de identidade e de recurso, com denies explícitos e permission boundaries. "Contributor" não tem equivalente exato na AWS. Não construa uma camada de tradução que finja o contrário; revise os acessos por cloud, nos termos de cada uma.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Egress não pode ser tão ruim assim. São só uns centavos por gigabyte, não?</span>
    </div>
  </div>
</div>

Por gigabyte parece inofensivo. Aí alguém aponta um job noturno de analytics numa cloud para o data lake da outra, ou liga um envio verboso de logs entre clouds, e a linha da fatura cresce todo mês sem ninguém ter decidido isso. Surpresas de egress vêm da arquitetura, não da tabela de preços. Coloque tags e alertas de custo de transferência de dados por workload, revise novos fluxos entre clouds nas revisões de design e leve o processamento até os dados, não o contrário.

<div class="callout info" data-title="Info">
  <p>Interconexões privadas costumam reduzir o custo por gigabyte transferido e deixam a latência previsível, mas somam custos fixos de porta e de parceiro. Modele as duas opções com o tráfego que você realmente espera e confira os preços atuais de cada provedor antes de fechar qualquer coisa.</p>
</div>

**Teste o failover de verdade.** Um plano de DR entre clouds que nunca foi executado é uma hipótese. Agende game days: faça failover de um workload, rode do outro lado com tráfego real e volte. Espere descobrir certificados expirados, registros de DNS faltando, quotas que nunca foram aumentadas e um passo do runbook que só uma pessoa entendia. Esse é o objetivo do exercício.

**Saiba onde parar.** A maioria das organizações deveria mirar em workload por cloud com práticas de plataforma compartilhadas: portável na camada de containers e IaC, identidade federada em todo lugar, um único plano de observabilidade e o posicionamento dos dados decidido desde o início. Vá além só quando um motivo específico (um regulador, um requisito real de resiliência) pagar a conta. Multi-cloud sem dor não é rodar tudo em todo lugar. É gastar seu orçamento de portabilidade só onde ele se paga.
