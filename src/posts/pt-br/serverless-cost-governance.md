---
title: "Serverless Cost Governance: Keeping Azure Functions and AWS Lambda Bills Predictable"
description: "A fatura de serverless cresce com tráfego, retries e bugs, não com a capacidade que você planejou, então a previsibilidade precisa ser projetada antes da surpresa. Limite a concorrência, ligue budgets a pessoas e automação, exija tags de alocação de custo via policy e acompanhe o custo por requisição como você acompanha latência."
date: 2026-04-11
tags: [Serverless, FinOps, Azure Functions, AWS Lambda, Terraform]
tldr:
  - "Limite toda função com reserved concurrency no Lambda e máximo de instâncias no Azure Functions, para um bug não escalar a fatura sem fim."
  - "Budgets alertam depois do gasto, então ligue-os cedo a donos e automação e trate os alertas de previsão como o sinal real."
  - "Exija as tags owner, cost-center e environment via policy e acompanhe o custo por 1.000 requisições num dashboard, ao lado da latência."
---

Serverless tem uma proposta linda: nada de servidor para dimensionar, nada de capacidade ociosa, você paga só pelo que usa. E é verdade. O problema está nas últimas palavras. Você paga pelo que usa, incluindo o que um bug usa, o que uma tempestade de retries usa, o que um scraper martelando seu endpoint público usa e o que uma função que dispara a si mesma sem querer usa às 2 da manhã de um sábado.

Com uma VM, o pior caso é o tamanho da VM. Com serverless, o pior caso é até onde a plataforma estiver disposta a escalar, e isso é muito. Essa é a funcionalidade. E é também por isso que governança de custo em serverless não é sobre espremer milissegundos do seu handler. É sobre colocar guardrails **antes** da surpresa, para a fatura continuar entediante mesmo quando o seu código não está.

## O problema e o contexto

### Como o custo de serverless se acumula de verdade

A página de preços mostra duas dimensões principais, e são essas que todo mundo modela:

- **Invocações.** Uma cobrança por requisição (ou por execução), não importa quanto tempo ela dure.
- **Duração vezes memória.** Tempo de execução multiplicado pela memória (e, implicitamente, pela CPU) alocada para a função. Dobre a memória e cada segundo fica mais caro, embora a função possa terminar mais rápido.

Opções de hospedagem premium e dedicadas somam uma terceira: **capacidade provisionada ou always-ready**, que você paga esteja ela ocupada ou não. Confira as páginas de preço atuais dos dois provedores, porque as unidades e valores exatos mudam e variam por plano e região.

As dimensões principais raramente são o que surpreende. As partes escondidas são estas:

- **Volume de logs.** Cada `print` e cada linha de log de debug é ingerida e armazenada pelo CloudWatch Logs ou pelo Application Insights. Com muitas requisições, a conta de logs pode passar a conta de compute.
- **Egress.** Dados saindo da região ou da cloud são cobrados à parte da função.
- **Serviços downstream.** A função é barata; o banco, a fila, o API gateway e a API de terceiros que ela chama a cada invocação não necessariamente. Serverless escala sem esforço, e a carga que você joga em tudo que está atrás dele também.
- **Retries.** Uma invocação que falhou e é repetida é cobrada de novo. Algumas fontes de eventos repetem por padrão até a mensagem expirar.
- **Triggers recursivos.** Uma função que grava no mesmo bucket, fila ou tabela que a dispara pode entrar em loop para sempre, e cada volta do loop é uma invocação cobrada.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas serverless é pay-per-use, então se ninguém usa, não custa nada. Como isso pode ficar caro?</span>
    </div>
  </div>
</div>

Pay-per-use corta dos dois lados. "Ninguém usa" é o caso fácil. O caso caro é quando algo usa muito e esse algo não é um cliente pagante. Um bot raspando sua API é uso. Uma poison message repetida milhares de vezes é uso. Um trigger chamando a mesma função em loop é um uso que nunca dorme. Pay-per-use significa que a sua fatura é uma função do seu tráfego **e** dos seus bugs, e bugs não vêm com plano de capacidade.

### As causas clássicas de fatura surpresa

A maioria dos incidentes de custo em serverless segue um conjunto pequeno de padrões:

1. **A função que dispara a si mesma.** Um trigger de objeto criado num bucket, e a função grava o resultado de volta no mesmo bucket. Ou um consumidor de fila que reenfileira em caso de falha sem nenhum contador.
2. **A tempestade de retries.** Uma mensagem malformada que sempre falha. A fonte de eventos repete, a função falha e, sem destino de dead-letter ou limite de retries, o ciclo se repete até a mensagem expirar.
3. **Log verboso em escala.** Log de debug ligado "só por um momento" em produção, registrando payloads inteiros, com retenção configurada para nunca expirar.
4. **Tráfego indesejado.** Um endpoint HTTP público descoberto por um scraper, um teste de carga apontado para o ambiente errado ou um DDoS. A plataforma escala para atender, como projetado.
5. **O ambiente esquecido.** Um ambiente de dev ou demo com plano premium, instâncias always-ready ou provisioned concurrency, ligado por meses porque ninguém é dono dele.

Nenhum desses é um problema de otimização. São problemas de **controle**, resolvidos com limites, alertas e ownership, não com um parser de JSON mais rápido.

## Mergulho na arquitetura

### O loop de controle

Governança de custo em serverless é um loop de feedback, não um relatório mensal. Limites restringem o raio de impacto, a telemetria mostra o que está acontecendo, os budgets pegam o que os limites deixaram passar e os alertas chegam a uma pessoa ou a uma automação que pode agir.

```text
+---------------------------+      +----------------------------+
|  1. LIMITS (preventive)   |      |  2. TELEMETRY (detective)  |
|  concurrency caps         |----->|  invocations, duration     |
|  max instances            |      |  throttles, errors, DLQ    |
|  bounded retries + DLQ    |      |  log volume                |
|  log retention/sampling   |      |  cost per 1,000 requests   |
+-------------^-------------+      +--------------+-------------+
              |                                   |
              |                                   v
+-------------+-------------+      +----------------------------+
|  4. OWNERS + AUTOMATION   |      |  3. BUDGETS (backstop)     |
|  on-call gets paged       |<-----|  forecasted + actual       |
|  runbook: lower caps,     |      |  alerts per tag / scope    |
|  disable trigger, fix bug |      |  action groups / SNS       |
+---------------------------+      +----------------------------+
```

O loop só funciona se cada seta for real. Um alerta de budget enviado para uma caixa de e-mail que ninguém lê é uma seta quebrada.

### Limites: restringindo o raio de impacto

O **AWS Lambda** tem duas camadas de controle de concorrência. O **limite de concorrência da conta** é uma quota regional compartilhada por todas as funções da conta; quando ela se esgota, todas as funções daquela região começam a sofrer throttling. A **reserved concurrency** de uma função garante a ela uma fatia desse pool e, ao mesmo tempo, limita a função a esse número. Uma função com reserved concurrency nunca roda mais instâncias do que o limite, não importa quanto tráfego chegue. Isso faz da reserved concurrency o seu principal teto de custo no Lambda. (Configurar como zero desliga a função na prática, o que é um ótimo botão de emergência.)

O **Azure Functions** controla a escala pelo plano de hospedagem:

| Plano | Comportamento de escala | Formato do custo | Alavanca de governança |
|---|---|---|---|
| Consumption | Scale out orientado a eventos, escala até zero | Por execução e consumo de recursos | Limite máximo de scale out configurável por app |
| Flex Consumption | Orientado a eventos, escala mais rápida, instâncias always-ready opcionais | Por execução, mais a base always-ready se configurada | Número máximo de instâncias configurável, quantidade always-ready |
| Premium | Instâncias pré-aquecidas, scale out elástico | Paga continuamente pelas instâncias mínimas | Limites de instâncias mínimas e de burst máximo |
| Dedicated (App Service) | Manual ou regras de autoscale em instâncias fixas | Paga pelo plano, como uma VM | Número de instâncias e regras de autoscale |

O ponto importante: todo plano permite definir um **limite máximo de instâncias**, e você deveria definir isso de propósito. Os padrões da plataforma são generosos porque otimizam para disponibilidade, não para o seu orçamento.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Um limite de concorrência não vai simplesmente quebrar a aplicação quando vier um pico de tráfego de verdade?</span>
    </div>
  </div>
</div>

Pode quebrar, e é por isso que o limite é uma decisão de design, não um número aleatório. Um limite transforma "custo sem teto" em "custo com teto mais throttling", e throttling é um modo de falha para o qual você pode projetar: fontes baseadas em fila esperam e entregam depois, chamadores síncronos recebem um erro que pode ser repetido. Dimensione o limite a partir do pico real de tráfego, com folga. Uma função sem limite não é mais disponível, ela só falha mais tarde e mais caro, normalmente derrubando o banco que está atrás dela.

### Retries, dead letters e logs

Coloque limite em todo caminho de retry. Para invocações assíncronas do Lambda, configure um número máximo de retries e uma idade máxima do evento, e mande as falhas para um destino on-failure ou uma dead-letter queue. Para fontes de fila e stream, defina um máximo de recebimentos ou tentativas e uma DLQ, para que uma poison message seja estacionada depois de poucas tentativas em vez de ser cobrada para sempre. Na Azure, o Service Bus move a mensagem para a subfila de dead-letter depois do número máximo de entregas, e as retry policies do Functions devem ter uma contagem finita. Depois, **crie alerta para a profundidade da DLQ**: uma DLQ crescendo é um bug report com carimbo de data e hora.

Logs merecem uma política própria. Defina retenção em todo log group (o padrão de um novo log group do CloudWatch é guardar os logs para sempre). Use logs estruturados em INFO em produção e ligue DEBUG por função, temporariamente. Na Azure, o Application Insights suporta sampling e limites diários de ingestão; ative sampling em apps de alto volume e trate o limite diário como freio de emergência, sabendo que atingi-lo significa perder telemetria pelo resto do dia.

### Budgets ligados a pessoas e automação

Os **budgets do Azure Cost Management** podem ter escopo de subscription, de resource group ou filtro por tags, e alertam quando o gasto real ou previsto cruza limites. As notificações podem ir para endereços de e-mail e para **action groups**, que podem acionar pessoas, chamar webhooks ou disparar Logic Apps, Functions ou runbooks.

O **AWS Budgets** faz o mesmo do lado da AWS: budgets de custo filtrados por serviço, conta ou tag, com limites de gasto real ou previsto. As notificações vão para e-mail ou para um **tópico SNS**, e do SNS você roteia para chat, ferramenta de plantão ou um Lambda. A AWS também oferece **budget actions**, que podem aplicar uma policy de IAM ou SCP, ou agir sobre instâncias específicas, quando um limite é cruzado. São poderosas, e podem parar coisas que você não pretendia parar, então comece com notificações e adicione actions só depois de saber exatamente o que elas afetam.

### Tags pelas quais dá para alocar custo de verdade

Um budget só é tão preciso quanto o seu escopo, e o escopo mais flexível é uma tag. Escolha um conjunto pequeno de tags obrigatórias e faça valer:

- `owner`: um time ou pessoa que recebe o alerta.
- `cost-center`: onde o dinheiro é cobrado.
- `environment`: `dev`, `test`, `prod`, para um stack de dev esquecido ficar visível.

Na Azure, o **Azure Policy** pode negar a criação de recursos sem as tags obrigatórias, ou adicionar e herdar tags do resource group. Na AWS, as **tag policies** do AWS Organizations padronizam chaves de tag e valores permitidos, e service control policies podem negar certas ações de criação quando a tag não vem na requisição, embora nem todo serviço suporte condições de tag em toda ação, então teste antes de confiar nisso. Lembre também que, na AWS, as tags precisam ser **ativadas como cost allocation tags** no console de billing antes de aparecerem nos relatórios de custo e nos filtros de budget.

Uma regra mínima do Azure Policy que nega resource groups sem a tag `cost-center` fica assim:

```json title="require-cost-center.json (excerpt)"
{
  "if": {
    "allOf": [
      { "field": "type", "equals": "Microsoft.Resources/subscriptions/resourceGroups" },
      { "field": "tags['cost-center']", "exists": "false" }
    ]
  },
  "then": { "effect": "deny" }
}
```

### Unit economics: custo por 1.000 requisições

O gasto mensal total diz se você estourou o orçamento. Ele não diz se você é eficiente. Para isso, acompanhe um **custo unitário**: custo por 1.000 requisições (ou por pedido, por documento processado, por usuário ativo).

```text
cost per 1,000 requests = (daily cost for tag service=X) / (daily invocations of X) * 1000
```

O numerador vem dos dados de billing: o AWS Cost and Usage Report (CUR) ou os Data Exports consultados com Athena, e os exports do Azure Cost Management para uma storage account, consultados com a ferramenta de analytics da sua preferência. O denominador vem das suas métricas: `Invocations` do Lambda no CloudWatch ou a contagem de execuções das funções no Azure Monitor. Coloque o resultado no mesmo dashboard da latência p95 e da taxa de erro. Quando um deploy dobra o custo por requisição sem mudança de tráfego, isso é uma regressão, exatamente como uma regressão de latência, e merece a mesma atenção.

## Implementação na prática

Vamos construir os guardrails como código: uma função Lambda com limite de concorrência e um log group com retenção, um budget da AWS com escopo por tag e alertas de previsão e de gasto real para e-mail e SNS, e um resource group na Azure com um budget ligado a um action group. As tags obrigatórias são definidas uma vez em `locals` e aplicadas via `default_tags` na AWS e explicitamente na Azure.

```hcl title="versions.tf"
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Todo recurso AWS criado por esta configuração recebe as tags obrigatórias
  default_tags {
    tags = local.required_tags
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}
```

```hcl title="variables.tf"
variable "aws_region" {
  description = "AWS region for the function and its logs"
  type        = string
  default     = "us-east-1"
}

variable "azure_subscription_id" {
  description = "Azure subscription that holds the resource group"
  type        = string
}

variable "azure_location" {
  description = "Azure region for the resource group"
  type        = string
  default     = "eastus2"
}

variable "service_name" {
  description = "Short service name used in resource names"
  type        = string
  default     = "orders-api"
}

variable "owner" {
  description = "Team or person accountable for this spend"
  type        = string
}

variable "cost_center" {
  description = "Cost center the spend is charged to"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment must be dev, test or prod."
  }
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package (.zip) built by CI"
  type        = string
}

variable "lambda_reserved_concurrency" {
  description = "Hard cap on concurrent executions for the function"
  type        = number
  default     = 20
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount, in the billing currency, for both clouds"
  type        = number
}

variable "budget_alert_emails" {
  description = "People who receive budget alerts"
  type        = list(string)
}

variable "azure_budget_start_date" {
  description = "First day of the budget month, e.g. 2026-05-01T00:00:00Z"
  type        = string
}

locals {
  name = "${var.service_name}-${var.environment}"

  # Uma única definição das tags obrigatórias, usada pelas duas clouds
  required_tags = {
    owner         = var.owner
    "cost-center" = var.cost_center
    environment   = var.environment
    service       = var.service_name
  }
}
```

```hcl title="lambda.tf"
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Criamos o log group nós mesmos para ter retenção em vez de "nunca expirar"
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "api" {
  function_name    = local.name
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  handler          = "app.handler"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  memory_size      = 256
  timeout          = 10

  # O teto de custo: nunca mais do que este número de execuções simultâneas
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.lambda_logs,
  ]
}
```

```hcl title="budgets-aws.tf"
resource "aws_sns_topic" "budget_alerts" {
  name = "${local.name}-budget-alerts"
}

# Permite que o AWS Budgets publique no tópico
data "aws_iam_policy_document" "budget_alerts" {
  statement {
    effect    = "Allow"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.budget_alerts.arn]

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "budget_alerts" {
  arn    = aws_sns_topic.budget_alerts.arn
  policy = data.aws_iam_policy_document.budget_alerts.json
}

resource "aws_budgets_budget" "service" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_amount)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Conta só o gasto com a tag deste centro de custo (a tag precisa estar ativada para alocação de custo)
  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:cost-center$%s", var.cost_center)]
  }

  # Aviso antecipado: a previsão diz que vamos passar de 80%
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  # Rede de segurança: o gasto real já passou de 100%
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}
```

```hcl title="budgets-azure.tf"
resource "azurerm_resource_group" "serverless" {
  name     = "rg-${local.name}"
  location = var.azure_location
  tags     = local.required_tags
}

resource "azurerm_monitor_action_group" "cost" {
  name                = "ag-${local.name}-cost"
  resource_group_name = azurerm_resource_group.serverless.name
  short_name          = "costalert"
  tags                = local.required_tags

  # Um email receiver por endereço; adicione receivers de webhook ou Logic App para automação
  dynamic "email_receiver" {
    for_each = var.budget_alert_emails
    content {
      name                    = "email-${email_receiver.key}"
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }
}

resource "azurerm_consumption_budget_resource_group" "serverless" {
  name              = "budget-${local.name}"
  resource_group_id = azurerm_resource_group.serverless.id
  amount            = var.monthly_budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = var.azure_budget_start_date
  }

  # Aviso antecipado pela previsão, roteado para o action group
  notification {
    enabled        = true
    threshold      = 80
    threshold_type = "Forecasted"
    operator       = "GreaterThan"
    contact_groups = [azurerm_monitor_action_group.cost.id]
  }

  # Rede de segurança no gasto real, também enviada direto por e-mail
  notification {
    enabled        = true
    threshold      = 100
    threshold_type = "Actual"
    operator       = "GreaterThan"
    contact_groups = [azurerm_monitor_action_group.cost.id]
    contact_emails = var.budget_alert_emails
  }
}
```

```hcl title="outputs.tf"
output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "budget_alerts_topic_arn" {
  value = aws_sns_topic.budget_alerts.arn
}

output "azure_resource_group_id" {
  value = azurerm_resource_group.serverless.id
}
```

Inscreva sua ferramenta de plantão no tópico SNS e adicione um receiver de webhook ou Logic App ao action group para automação, como um runbook que zera a reserved concurrency do Lambda num stack que não é de produção.

<div class="callout tip" data-title="Dica">
  <p>O <code>start_date</code> do budget na Azure precisa ser o primeiro dia de um mês, e o filtro <code>TagKeyValue</code> da AWS só funciona depois que <code>cost-center</code> é ativada como cost allocation tag. Para a própria Function App, defina o scale out máximo na configuração do app (no Flex Consumption, o <code>maximum_instance_count</code> do <code>azurerm_function_app_flex_consumption</code>) no mesmo pull request que cria o app.</p>
</div>

## Checagem de realidade em produção

**Budgets são indicadores atrasados.** Os dados de billing chegam horas depois do uso, às vezes mais. Quando um alerta de gasto real dispara, o dinheiro já foi. É por isso que o limite de previsão importa mais do que o de gasto real, e por isso os limites vêm primeiro no loop. Para detectar rápido, crie alarmes nos sinais antecipados que você controla diretamente: taxa de invocações, execuções simultâneas, throttles, volume de ingestão de logs e profundidade da DLQ. Esses disparam em minutos, não em um dia.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O budget não pode simplesmente desligar tudo sozinho quando a gente atingir o limite?</span>
    </div>
  </div>
</div>

Budgets nas duas clouds são ferramentas de alerta, não tetos de cobrança. Nenhum dos provedores para um workload de produção por padrão porque um budget foi ultrapassado, e você nem ia querer isso: desligar automaticamente um sistema voltado ao cliente é uma indisponibilidade que você mesmo agendou. Automação é ótima para dev e test (escalar a zero, desativar triggers, parar instâncias always-ready). Em produção, deixe o alerta acionar um dono que consiga decidir se aquele gasto é um bug ou um lançamento de produto que deu certo.

**Limites causam throttling, então planeje a degradação.** Quando uma função atinge o limite, quem chama precisa de uma experiência razoável: uma fila que absorva o pico, uma resposta em cache ou reduzida, um erro claro que pode ser repetido com backoff. Crie alarmes para throttles, para descobrir que um limite está apertado demais antes de os seus clientes te avisarem.

<div class="callout warning" data-title="Atenção">
  <p>A reserved concurrency do Lambda sai do limite regional da conta. Reservar com generosidade em muitas funções pode esvaziar o pool não reservado que todas as outras funções compartilham. Mantenha um mapa das reservas por conta e revise quando adicionar funções.</p>
</div>

**Decida quem é acionado.** Alertas de custo devem ser roteados como qualquer outro alerta de produção: para o time da tag `owner`, pela mesma ferramenta de plantão. Um pico de custo às 2 da manhã por causa de um trigger recursivo é um incidente. Um desvio lento ao longo do mês é um ticket. Deixe essa distinção explícita no roteamento dos alertas.

**Revise custo nos pull requests.** Mudanças de tamanho de memória, timeouts, limites de concorrência, nível de log, retenção e tipo de plano mexem na fatura. Um item de checklist ("isso muda alguma configuração de escala ou de log?") pega a maioria dos erros.

**Mantenha uma cadência de FinOps.** Toda semana, o time dono dá uma olhada no custo por 1.000 requisições e nas anomalias. Todo mês, engenharia e financeiro revisam o gasto por tag, os recursos sem tag e os ambientes ociosos. Todo trimestre, revisitem limites e planos com base no tráfego real. Se você roda nas duas clouds, mapeie a mesma intenção para os controles nativos de cada uma, como descrito em [Multi-Cloud Without the Pain: Patterns That Survive Contact with Reality](/pt-br/blog/multi-cloud-patterns/).

Previsibilidade de custo em serverless não é truque de preço. É um conjunto de decisões que você toma antes: até onde cada função pode escalar, para onde vão as mensagens que falharam, quanto tempo os logs vivem, quem é dono de cada recurso e qual número do dashboard avisa que algo mudou. Tome essas decisões em código, e a fatura deixa de ser surpresa e passa a ser uma métrica.
