---
title: "Event-Driven Microservices on Azure: Service Bus vs Event Grid vs Event Hubs"
description: "Escolha Service Bus, Event Grid ou Event Hubs conforme você envia comandos, eventos ou streams."
date: 2025-12-04
tags: [Azure, Messaging, Event-Driven, Microservices, C#]
tldr:
  - "Escolha pelo significado da mensagem: comandos vão para o Service Bus, notificações pontuais para o Event Grid, streams de telemetria para o Event Hubs."
  - "A entrega é pelo menos uma vez, então faça consumidores idempotentes e use o padrão outbox para evitar escrita dupla."
  - "Finalize as mensagens do Service Bus explicitamente, mande poison messages para a dead-letter e escolha partition keys que espalhem a carga sem quebrar a ordenação."
---

A Azure tem três serviços com "message" ou "event" em algum lugar da descrição, e os três aceitam de bom grado um payload JSON vindo do seu código. Essa é justamente a armadilha. O time escolhe o que viu num tutorial e passa meses brigando com ele: ordenação que não existe, retries que derrubam um webhook, ou uma queue que vira, sem ninguém perceber, um pipeline de analytics para o qual ela nunca foi pensada.

A boa notícia: a escolha fica fácil quando você para de comparar lista de features e começa a fazer uma única pergunta. **O que essa mensagem significa?** É uma ordem que alguém espera que você cumpra, um aviso de que algo aconteceu, ou uma gota num rio de dados? Responda isso e o serviço se escolhe sozinho.

## O problema e o contexto

Imagine uma loja online dividida em microsserviços. O cliente clica em "Comprar". O serviço de Pedidos grava o pedido. Aí muita coisa precisa acontecer: Pagamentos precisa cobrar o cartão, Estoque precisa reservar os itens, Expedição precisa gerar a etiqueta, o serviço de e-mail manda a confirmação, e o time de analytics quer cada clique que levou até aquela compra.

A versão ingênua é uma corrente de chamadas HTTP. Pedidos chama Pagamentos, que chama Estoque, que chama Expedição. Funciona no seu notebook. Em produção, Pagamentos tem um minuto lento, Pedidos dá timeout, o cliente clica em "Comprar" de novo, e agora você tem duas cobranças e zero itens reservados. Acoplamento síncrono significa que a disponibilidade do fluxo inteiro é o produto da disponibilidade de cada salto.

Mensageria quebra essa corrente. Producers entregam o trabalho e seguem a vida; consumers processam no próprio ritmo. Mas "mensageria" não é uma coisa só. Tem três tipos diferentes de tráfego escondidos nessa loja:

- **Comandos (mensagens).** "Cobre este cartão pelo pedido 4711." Existe uma intenção, exatamente um handler lógico, e quem envia se importa que aquilo seja feito. Perder a mensagem é um incidente de negócio.
- **Eventos (notificações).** "O estoque do SKU 123 caiu abaixo de 10." Um fato sobre o passado. Quem publica não sabe nem quer saber quem está ouvindo. Zero, um ou quinze assinantes, tanto faz.
- **Streams (telemetria).** "Usuário viu produto, usuário rolou a página, usuário adicionou ao carrinho" vezes alguns milhões por hora. Individualmente não valem nada, em conjunto valem muito, e muitas vezes você quer reprocessar tudo depois.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Isso não é só nomenclatura? Comando é um JSON, evento é um JSON. Por que não jogar tudo num serviço só e pronto?</span>
    </div>
  </div>
</div>

Porque as garantias que você precisa são diferentes, e cada serviço é otimizado para um conjunto delas. Um comando precisa ficar travado enquanto um worker processa, ser reprocessado em caso de falha e ser guardado num lugar seguro se continuar falhando. Um evento precisa ser distribuído para vários assinantes, empurrado rápido até eles e filtrado para ninguém receber ruído. Um stream precisa de throughput bruto, particionamento e da capacidade de voltar no tempo. Você *consegue* forçar um serviço a fazer os três, do mesmo jeito que *consegue* usar uma planilha como banco de dados. A conta chega em forma de código customizado e alerta às 3 da manhã.

Então o mapeamento na Azure fica assim:

| Significado | Serviço Azure | Modelo mental |
|-------------|---------------|---------------|
| Comando / transação de negócio | **Service Bus** | Carta registrada: rastreada, com assinatura no recebimento, devolvida se não entregar |
| "Algo aconteceu" pontual | **Event Grid** | Campainha: toca uma vez para todo mundo que está em casa e acabou |
| Telemetria / stream em alto volume | **Event Hubs** | Gravação de câmera de segurança: contínua, dá para voltar, vários assistem |

## Mergulho na arquitetura

### A loja mapeada nos três serviços

Este é o fluxo de compra com cada serviço fazendo aquilo em que é bom:

```text
                    +------------------+
  Customer  ----->  |  Orders API      |  (writes order + outbox row in one DB tx)
                    +--------+---------+
                             | outbox relay
                             v
              +------------------------------+
              |  Service Bus                 |
              |  queue: payments   (command) |
              |  topic: orders     (pub/sub) |
              +------+----------------+------+
                     |                |
          PeekLock   v                v  subscription "high-value" (SQL filter)
          +----------------+   +----------------+
          | Payments svc   |   | Fraud review   |
          +-------+--------+   +----------------+
                  | PaymentCaptured
                  v
          +----------------+     +-------------------------------+
          | Inventory svc  | --> | Event Grid topic              |
          +----------------+     | "inventory.stock.low"         |
                                 +-------+---------------+-------+
                                         | push          | push
                                         v               v
                                 +--------------+  +--------------+
                                 | Purchasing   |  | Notification |
                                 | (webhook)    |  | Function     |
                                 +--------------+  +--------------+

  Web/mobile clicks  ---->  Event Hubs "clickstream" (8 partitions, key = sessionId)
                                 |                 |
                   consumer group "analytics"   consumer group "recommendations"
                                 v                 v
                          Stream Analytics     ML feature pipeline
```

**Pagamento é um comando.** Ele vai para uma queue do Service Bus. Várias instâncias do serviço de Pagamentos disputam as mensagens (o padrão *competing consumers*), cada mensagem fica travada enquanto é processada (PeekLock) e, se der falha, volta a ficar visível. Depois de tentativas demais, ela cai na **dead-letter queue** em vez de ficar em loop para sempre.

**"Pedido criado" distribuído para serviços internos** pode usar um **topic** do Service Bus com subscriptions. Cada subscription é uma queue durável própria, com seu próprio filtro, então a Análise de Fraude só enxerga pedidos acima de um valor. Use topic quando os assinantes são serviços seus e você ainda quer as garantias do Service Bus: durabilidade, dead-letter, sessions e transações.

**"Estoque baixo" é um evento.** Estoque publica no Event Grid e esquece. O Event Grid empurra o evento para cada assinante que casar (um webhook, uma Azure Function, uma queue do Service Bus), com filtros por tipo de evento, subject ou campos do payload, e suporta o schema CloudEvents 1.0. O Event Grid também é o jeito que a própria Azure usa para te avisar das coisas: um blob foi criado, um recurso foi apagado, um segredo do Key Vault está perto de expirar.

**Cliques são um stream.** Eles vão para o Event Hubs, que os anexa em partitions. Cada consumer group lê o stream inteiro de forma independente, guarda a própria posição (checkpoint) e pode voltar no tempo dentro da janela de retenção. O Event Hubs também expõe um endpoint compatível com Kafka, então producers e consumers Kafka existentes conseguem falar com ele mudando configuração, sem reescrever código.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Topic do Service Bus e Event Grid fazem pub/sub com filtro. Não é a mesma coisa?</span>
    </div>
  </div>
</div>

Eles se sobrepõem, mas o modelo de entrega é o oposto. O Service Bus é **pull**: os assinantes se conectam e buscam mensagens quando estão prontos, e as mensagens esperam na subscription pelo tempo que o time-to-live da entidade permitir. O Event Grid é **push**: ele chama o seu endpoint e faz retry com backoff se você falhar, e quando a política de retry se esgota o evento é descartado ou enviado para um container de dead-letter no Storage, se você configurou um. Regra de bolso: se um assinante fora do ar por uma hora não pode perder nada e precisa de processamento ordenado e transacional, use topic do Service Bus. Se você quer um fan-out leve e reativo (muitas vezes entre times ou vindo dos próprios recursos da Azure), use Event Grid. Uma combinação muito comum é o Event Grid empurrando para uma queue do Service Bus, e aí você ganha roteamento reativo mais consumo durável e no seu ritmo.

### A tabela comparativa

| | Service Bus | Event Grid | Event Hubs |
|---|---|---|---|
| Significado | Comandos, transações | Notificações pontuais | Telemetria, streams |
| Modelo de entrega | Pull (AMQP), PeekLock ou ReceiveAndDelete | Push (HTTP/webhook, Functions, queues) | Pull, consumers leem partitions |
| Ordenação | FIFO por session (sessions) | Não garantida | Por partition |
| Retenção / replay | Até ser consumida ou o TTL expirar; sem replay após o complete | Janela curta de retry; sem replay | Retenção por tempo; replay por offset ou horário |
| Dead-letter | DLQ nativa por queue/subscription | Opcional, para um container no Blob Storage | Não tem; o consumer decide o que pular |
| Perfil de throughput | Moderado, garantias por mensagem | Em rajadas, muitos eventos pequenos | Muito alto, ingestão contínua |
| Consumers | Competing consumers ou subscriptions de topic | Vários assinantes, cada um filtrado | Vários consumer groups, cada um lê tudo |
| Extras | Transações, duplicate detection, mensagens agendadas | CloudEvents, eventos de sistema da Azure, filtros avançados | Endpoint Kafka, Capture para storage, schema registry |

### Padrões que fazem isso funcionar

**Event notification vs event-carried state transfer.** Um evento magro diz "o pedido 4711 mudou", e os consumers chamam de volta para buscar os detalhes. Isso mantém o payload pequeno, mas cria um acoplamento tagarela e uma condição de corrida: quando você for buscar, o estado pode já ter mudado de novo. Um evento gordo carrega o estado relevante ("pedido 4711, status Pago, total 349,90, itens [...]"), então os consumers agem sem precisar chamar ninguém. O Event Grid favorece eventos mais magros (o tamanho do payload é limitado); Service Bus e Event Hubs lidam melhor com os mais gordos. Escolha de propósito e versione seus schemas.

**O outbox pattern.** O bug clássico: Pedidos grava no banco e depois envia a mensagem. Se o processo cair entre as duas coisas, você tem um pedido que ninguém vai cobrar. Se enviar primeiro e a gravação falhar, você cobra um pedido que não existe. A correção é gravar o pedido **e** uma linha de "outbox" na mesma transação do banco local, e ter um relay (um background worker ou change data capture) que lê o outbox e publica no Service Bus, marcando as linhas como enviadas. A entrega vira at-least-once, o que leva direto ao próximo padrão.

**Consumers idempotentes.** Qualquer um desses serviços pode entregar a mesma mensagem mais de uma vez. Um lock expira no meio do processamento, um consumer cai depois de fazer o trabalho mas antes do complete, o Event Grid faz retry porque seu webhook respondeu devagar demais. Os consumers precisam tolerar duplicatas: guarde os IDs de mensagens processadas (ou uma chave de negócio como `orderId + operação`) na mesma transação do efeito colateral, e pule o que já viu. O duplicate detection do Service Bus ajuda do lado do envio dentro de uma janela de tempo, mas não torna o seu handler idempotente.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Não dá para ligar um "exactly-once delivery" em algum lugar e pular essa história toda de idempotência?</span>
    </div>
  </div>
</div>

Infelizmente, nenhum checkbox deixa um sistema distribuído exactly-once de ponta a ponta. As transações do Service Bus dão atomicidade *dentro* do broker (receber, enviar e completar juntos dentro de um namespace), mas no momento em que o seu handler toca um banco de dados ou chama um gateway de pagamento, você voltou para o at-least-once. O alvo prático é "entrega at-least-once mais processamento idempotente", que do ponto de vista do negócio se comporta como exactly-once.

## Implementação na prática

### Provisionando com Azure CLI

Isto cria as três peças da loja. Os nomes são ilustrativos.

```bash title="provision.sh"
RG=rg-shop-messaging
LOC=eastus2
SB=sb-shop-demo
EGT=egt-shop-inventory
EH=evh-shop-demo

az group create --name $RG --location $LOC

# Service Bus: Standard é o tier mínimo para topics
az servicebus namespace create --resource-group $RG --name $SB --location $LOC --sku Standard

az servicebus queue create --resource-group $RG --namespace-name $SB --name payments \
  --max-delivery-count 5 \
  --enable-duplicate-detection true \
  --enable-dead-lettering-on-message-expiration true

az servicebus topic create --resource-group $RG --namespace-name $SB --name orders

az servicebus topic subscription create --resource-group $RG --namespace-name $SB \
  --topic-name orders --name high-value

# Troca a regra padrão (que aceita tudo) por um filtro SQL numa application property
az servicebus topic subscription rule delete --resource-group $RG --namespace-name $SB \
  --topic-name orders --subscription-name high-value --name '$Default'
az servicebus topic subscription rule create --resource-group $RG --namespace-name $SB \
  --topic-name orders --subscription-name high-value --name HighValue \
  --filter-sql-expression "TotalAmount > 1000"

# Event Grid: custom topic usando o schema CloudEvents
az eventgrid topic create --resource-group $RG --name $EGT --location $LOC \
  --input-schema cloudeventschemav1_0

az servicebus queue create --resource-group $RG --namespace-name $SB --name purchasing

TOPIC_ID=$(az eventgrid topic show --resource-group $RG --name $EGT --query id -o tsv)
QUEUE_ID=$(az servicebus queue show --resource-group $RG --namespace-name $SB \
  --name purchasing --query id -o tsv)

# Empurra eventos de estoque baixo para uma queue do Service Bus, com processamento durável e no seu ritmo
az eventgrid event-subscription create --name stock-low-to-purchasing \
  --source-resource-id $TOPIC_ID \
  --endpoint-type servicebusqueue --endpoint $QUEUE_ID \
  --included-event-types shop.inventory.stock.low \
  --advanced-filter data.quantityOnHand NumberLessThan 10

# Event Hubs: capacity = throughput units no tier Standard
az eventhubs namespace create --resource-group $RG --name $EH --location $LOC \
  --sku Standard --capacity 2

az eventhubs eventhub create --resource-group $RG --namespace-name $EH --name clickstream \
  --partition-count 8 --cleanup-policy Delete --retention-time 72

az eventhubs eventhub consumer-group create --resource-group $RG --namespace-name $EH \
  --eventhub-name clickstream --name analytics
```

Nenhuma connection string em lugar nenhum. Em vez disso, dê à managed identity da sua aplicação roles de data plane: `Azure Service Bus Data Sender` / `Azure Service Bus Data Receiver`, `EventGrid Data Sender` e `Azure Event Hubs Data Sender` / `Azure Event Hubs Data Receiver`, com o escopo mais estreito possível (uma única queue ou event hub é melhor que o namespace inteiro).

<div class="callout tip" data-title="Dica">
  <p>Quando todos os clientes estiverem usando Entra ID, considere desabilitar a autenticação local (chaves SAS) nos namespaces. Uma <code>RootManageSharedAccessKey</code> vazada num arquivo de configuração é um dos jeitos mais comuns de esses sistemas serem comprometidos, e não dá para vazar uma chave que não funciona.</p>
</div>

### Enviando um comando para o Service Bus

Os clients do SDK foram feitos para ser singletons de vida longa. Crie uma vez (via DI) e reutilize.

```csharp title="PaymentCommandSender.cs"
using Azure.Identity;
using Azure.Messaging.ServiceBus;

public sealed record ChargePayment(string OrderId, decimal Amount, string Currency);

public sealed class PaymentCommandSender : IAsyncDisposable
{
    private readonly ServiceBusClient _client;
    private readonly ServiceBusSender _sender;

    public PaymentCommandSender(string fullyQualifiedNamespace)
    {
        // ex.: "sb-shop-demo.servicebus.windows.net"; managed identity na Azure, seu az login localmente
        _client = new ServiceBusClient(fullyQualifiedNamespace, new DefaultAzureCredential());
        _sender = _client.CreateSender("payments");
    }

    public Task SendAsync(ChargePayment command, CancellationToken ct = default)
    {
        var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(command))
        {
            // ID estável para o duplicate detection do broker descartar reenvios
            MessageId = $"charge-{command.OrderId}",
            ContentType = "application/json",
            Subject = nameof(ChargePayment)
        };

        return _sender.SendMessageAsync(message, ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _sender.DisposeAsync();
        await _client.DisposeAsync();
    }
}
```

### Processando com PeekLock, complete e dead-letter

```csharp title="PaymentProcessor.cs"
using System.Text.Json;
using Azure.Messaging.ServiceBus;

public sealed class PaymentProcessor
{
    private readonly ServiceBusProcessor _processor;
    private readonly IPaymentService _payments;

    public PaymentProcessor(ServiceBusClient client, IPaymentService payments)
    {
        _payments = payments;
        _processor = client.CreateProcessor("payments", new ServiceBusProcessorOptions
        {
            ReceiveMode = ServiceBusReceiveMode.PeekLock,
            AutoCompleteMessages = false, // fazemos o settle explicitamente
            MaxConcurrentCalls = 8
        });

        _processor.ProcessMessageAsync += HandleAsync;
        _processor.ProcessErrorAsync += args =>
        {
            Console.Error.WriteLine($"[{args.ErrorSource}] {args.EntityPath}: {args.Exception.Message}");
            return Task.CompletedTask;
        };
    }

    public Task StartAsync(CancellationToken ct) => _processor.StartProcessingAsync(ct);
    public Task StopAsync(CancellationToken ct) => _processor.StopProcessingAsync(ct);

    private async Task HandleAsync(ProcessMessageEventArgs args)
    {
        ChargePayment? command;
        try
        {
            command = args.Message.Body.ToObjectFromJson<ChargePayment>();
        }
        catch (JsonException ex)
        {
            // Poison message: nenhum retry vai consertar um payload malformado
            await args.DeadLetterMessageAsync(args.Message, "InvalidPayload", ex.Message);
            return;
        }

        if (command is null)
        {
            await args.DeadLetterMessageAsync(args.Message, "InvalidPayload", "Empty body");
            return;
        }

        // Idempotente: o serviço de pagamento usa OrderId como chave da cobrança e ignora repetições
        await _payments.ChargeOnceAsync(command, args.CancellationToken);

        await args.CompleteMessageAsync(args.Message);
        // Exceções transitórias sobem: o lock é liberado, a mensagem é reprocessada
        // e, depois de MaxDeliveryCount tentativas, o Service Bus move ela para a DLQ por nós.
    }
}

// Seu serviço de domínio. ChargeOnceAsync precisa ser idempotente por OrderId.
public interface IPaymentService
{
    Task ChargeOnceAsync(ChargePayment command, CancellationToken ct);
}
```

Dois caminhos de settle, duas intenções. Lançar exceção (ou chamar `AbandonMessageAsync`) diz "tente de novo mais tarde", o que é certo para um timeout. Mandar para dead-letter diz "isso nunca vai dar certo do jeito que está", o que é certo para dado ruim. Confundir os dois é como você arruma uma poison message queimando cinco retries a cada deploy.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Preciso que os pagamentos do mesmo cliente sejam processados em ordem. É só colocar MaxConcurrentCalls = 1, né?</span>
    </div>
  </div>
</div>

Isso te dá ordenação abrindo mão de todo o paralelismo, para todos os clientes, para sempre. Use **sessions**: habilite `--enable-session true` na queue, defina `SessionId = customerId` em cada mensagem e consuma com `client.CreateSessionProcessor(...)`. O Service Bus garante FIFO dentro de uma session e trava cada session para um consumer por vez, enquanto sessions diferentes são processadas em paralelo. Você paga só pela ordenação que realmente precisa.

### Publicando um CloudEvent no Event Grid

```csharp title="StockEvents.cs"
using Azure.Identity;
using Azure.Messaging;
using Azure.Messaging.EventGrid;

var publisher = new EventGridPublisherClient(
    new Uri("https://egt-shop-inventory.eastus2-1.eventgrid.azure.net/api/events"),
    new DefaultAzureCredential());

var stockLow = new CloudEvent(
    source: "/shop/inventory",
    type: "shop.inventory.stock.low",
    jsonSerializableData: new { sku = "SKU-123", quantityOnHand = 7, warehouse = "GRU-01" })
{
    Subject = "skus/SKU-123"
};

await publisher.SendEventAsync(stockLow);
```

Copie o endpoint real com `az eventgrid topic show --query endpoint`; o sufixo regional varia.

### Enviando cliques para o Event Hubs

```csharp title="ClickstreamProducer.cs"
using Azure.Identity;
using Azure.Messaging.EventHubs;
using Azure.Messaging.EventHubs.Producer;

public sealed record Click(string SessionId, string Page, string Action, DateTimeOffset At);

public sealed class ClickstreamProducer : IAsyncDisposable
{
    private readonly EventHubProducerClient _producer = new(
        "evh-shop-demo.servicebus.windows.net",
        "clickstream",
        new DefaultAzureCredential());

    public async Task SendAsync(string sessionId, IEnumerable<Click> clicks, CancellationToken ct = default)
    {
        // Mesma partition key => mesma partition => ordem garantida por sessão
        using EventDataBatch batch = await _producer.CreateBatchAsync(
            new CreateBatchOptions { PartitionKey = sessionId }, ct);

        foreach (var click in clicks)
        {
            if (!batch.TryAdd(new EventData(BinaryData.FromObjectAsJson(click))))
            {
                throw new InvalidOperationException("Batch full; send it and start a new one.");
            }
        }

        await _producer.SendAsync(batch, ct);
    }

    public ValueTask DisposeAsync() => _producer.DisposeAsync();
}
```

Do lado da leitura, use o `EventProcessorClient` (do pacote `Azure.Messaging.EventHubs.Processor`) com um container do Blob Storage para os checkpoints, um processor por consumer group. Ele balanceia as partitions entre as instâncias e lembra onde cada uma parou.

## Checagem de realidade em produção

**Poison messages vão acontecer.** Uma mudança de schema sobe num serviço antes do outro e, de repente, toda mensagem falha. Defina um max delivery count sensato, mande para dead-letter explicitamente nos erros que não adianta repetir, e trate a DLQ como uma queue de verdade: alerte na contagem de mensagens, construa uma ferramenta simples para inspecionar e reenviar, e nunca deixe ela crescer em silêncio. No Event Grid, configure um container de dead-letter em toda subscription que importa; sem ele, eventos que esgotam os retries simplesmente somem.

**Duplicatas são normais, não bug.** Projete todo consumer para ser idempotente desde o primeiro dia. Encaixar isso depois da primeira entrega em dobro sai muito mais caro.

**Ordenação não é de graça.** Sessions limitam o paralelismo ao número de sessions ativas, e uma única session quente (um cliente B2B gigante) vira gargalo. No Event Hubs, a partition key decide a partition; uma chave desbalanceada (um campo `country` em que quase todo o tráfego vem de um país só) cria uma **hot partition** que limita seu throughput, não importa quantas unidades você compre. Escolha chaves de alta cardinalidade e só peça ordenação onde o negócio realmente precisa.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se uma partition esquentar, é só adicionar mais partitions depois, sem drama.</span>
    </div>
  </div>
</div>

Dependendo do tier, o número de partitions pode ser fixo desde a criação, e mesmo onde dá para aumentar, o mapeamento de chave para partition muda, o que quebra a ordenação por chave durante a transição. Dimensione as partitions para o pico de paralelismo que você espera dos seus consumers, e corrija a distribuição da chave em vez de torcer para mais partitions diluírem o problema.

**Monitore as métricas certas.** No Service Bus: contagem de mensagens ativas, contagem de mensagens em dead-letter e idade das mensagens (um backlog crescendo é o primeiro sinal de problema). No Event Hubs: throughput de entrada vs saída, requisições com throttling e lag do consumer por partition. No Event Grid: falhas de entrega, eventos descartados e enviados para dead-letter. Ligue isso em alertas do Azure Monitor, não em dashboards que ninguém abre.

**Tiers, de forma qualitativa.** O Service Bus **Basic** oferece só queues, sem topics e sem sessions. O **Standard** adiciona topics, sessions, transações e duplicate detection numa infraestrutura compartilhada e cobrada por operação, o que significa vizinhos barulhentos e latência variável. O **Premium** entrega capacidade dedicada (messaging units), desempenho previsível, mensagens maiores e recursos como private endpoints. O Event Hubs escala com **throughput units** no Standard, **processing units** no Premium e clusters dedicados acima disso; o Basic tem limites mais apertados (menos consumer groups, retenção menor, sem endpoint Kafka). O Event Grid cobra por operação. Limites e preços mudam, então confira a documentação atual da Azure antes de dimensionar qualquer coisa.

<div class="callout warning" data-title="Atenção">
  <p>Rede privada costuma depender do tier. Private endpoints no Service Bus exigem <strong>Premium</strong>, e cada serviço tem suas próprias regras para private endpoints, firewall de IP e acesso de serviços confiáveis. Se a sua landing zone proíbe endpoints públicos, valide o suporte do tier <strong>antes</strong> de construir em cima do Standard, não durante a revisão de segurança.</p>
</div>

**Combine, não se contente com meio-termo.** A arquitetura madura raramente usa só um desses serviços. O Service Bus carrega os comandos que movem dinheiro e estoque, o Event Grid espalha os sinais de "isso aconteceu" (inclusive os que a Azure emite sobre os seus próprios recursos), e o Event Hubs absorve a enxurrada de dados para analytics. Decida pelo significado, deixe todo consumer idempotente, publique via outbox e monitore suas dead letters como se elas te devessem dinheiro. Geralmente devem.
