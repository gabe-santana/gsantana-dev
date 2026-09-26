---
title: "Real-Time Message Queuing with Azure Service Bus and C#: A Complete Walkthrough"
description: "Crie um worker C# de Service Bus idempotente, com sessions, liquidação explícita e recuperação de dead-letter."
date: 2026-02-22
tags: [Azure, Service Bus, C#, .NET, Messaging]
tldr:
  - "Rode o consumer como worker hospedado com PeekLock e AutoCompleteMessages desligado, e faça complete, abandon ou dead-letter de cada mensagem explicitamente."
  - "Use sessions por id da entidade para manter a ordem, mais um número de sequência que torna inofensivos duplicatas, updates antigos e replays da DLQ."
  - "Reprocesse a dead-letter queue com uma ferramenta revisada que reenvia falhas de retry com novo MessageId e deixa conflitos de negócio para humanos."
---

Enviar uma mensagem para o Azure Service Bus leva cinco linhas de C#. Consumir mensagens do jeito certo, em ordem, sem perder nenhuma, sem aplicar nenhuma duas vezes e sem que um único payload malformado trave o pipeline, exige bem mais reflexão. A maioria dos tutoriais para nas cinco linhas. Os incidentes de produção começam logo depois delas.

Se você ainda precisa decidir se o Service Bus é mesmo a ferramenta certa, comece pela [comparação entre Service Bus, Event Grid e Event Hubs](/pt-br/blog/azure-service-bus-vs-event-grid-vs-event-hubs/). Este post parte do princípio de que você já escolheu o Service Bus e constrói um sistema pequeno e completo em cima dele: provisionamento, um worker hospedado com sessions, settlement explícito, um follow-up agendado, uma ferramenta de reprocessamento da dead-letter queue e os detalhes operacionais que decidem se ele sobrevive à primeira semana movimentada.

## O problema e o contexto

Vamos a um cenário típico. Uma plataforma de e-commerce tem um serviço dono do read model de "status do pedido", aquilo que a página de rastreamento do cliente e o painel do suporte consultam. Vários outros serviços reportam mudanças para ele: o Checkout avisa que um pedido foi criado, o Payments avisa que foi pago, o armazém avisa que foi despachado, a integração com a transportadora avisa que foi entregue. Todos esses updates passam por uma única queue do Service Bus chamada `order-status`.

Os requisitos parecem inofensivos:

- **Ordem por pedido.** "Despachado" nunca pode ser aplicado antes de "Pago" para o mesmo pedido. Entre pedidos diferentes, ninguém liga para a ordem, e queremos o máximo de paralelismo possível.
- **Nenhum update perdido.** Se o worker cair no meio de um update, a mensagem precisa voltar.
- **Nenhum efeito duplicado.** Se uma mensagem for entregue duas vezes, a segunda entrega tem que ser inofensiva.
- **Mensagens ruins são estacionadas, não reprocessadas para sempre.** Um payload de um producer com bug não deveria queimar retries a cada deploy.
- **Pedidos não pagos expiram.** Se um pedido continua sem pagamento 30 minutos depois de criado, ele é cancelado automaticamente.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que não um while simples chamando ReceiveMessageAsync no modo ReceiveAndDelete? Menos peças móveis, certo?</span>
    </div>
  </div>
</div>

Menos peças móveis e zero segurança. No modo ReceiveAndDelete, o broker apaga a mensagem no instante em que entrega para você. Se o processo morrer uma linha depois, aquele update de status sumiu para sempre. PeekLock é o modo que torna "nenhum update perdido" possível: a mensagem fica com lock, invisível para outros consumers, e só é removida quando você a completa explicitamente. O loop escrito à mão também te obriga a reinventar concorrência, renovação de lock, reconexão e shutdown, que é exatamente o que os processors do SDK já fazem bem.

## Mergulho na arquitetura

O sistema inteiro cabe em uma figura:

```text
  Checkout / Payments / Warehouse / Carrier
                  |
                  |  OrderStatusPublisher
                  |  SessionId = orderId, MessageId = orderId:sequence
                  v
   +-------------------------------------------+
   | Service Bus queue "order-status"          |
   | sessions on, max delivery 5, lock 1 min,  |
   | duplicate detection 10 min                |
   |                                           |
   |  scheduled: PaymentTimeoutCheck (+30 min) |
   +-------------------+-----------------------+
                       |  ServiceBusSessionProcessor (PeekLock)
                       v
   +-------------------------------------------+       +-------------------+
   | OrderStatusWorker (BackgroundService)     | ----> | Order status store|
   |  Complete / Abandon / DeadLetter          |       | (LastSequence per |
   +-------------------+-----------------------+       |  order)           |
                       | dead-lettered                 +-------------------+
                       v
   +-------------------------------------------+
   | order-status/$DeadLetterQueue             |
   |   <- DeadLetterReprocessor (manual run)   |
   +-------------------------------------------+
```

Quatro decisões de design sustentam tudo.

**1. Sessions dão FIFO por pedido sem serializar tudo.** Toda mensagem carrega `SessionId = orderId`. O broker entrega uma session para exatamente um consumer por vez e entrega as mensagens dela em ordem, enquanto sessions diferentes são processadas em paralelo. Com `MaxConcurrentCallsPerSession = 1` você tem ordem estrita dentro de um pedido e `MaxConcurrentSessions` pedidos ao mesmo tempo.

**2. Toda mensagem é liquidada explicitamente.** Com `AutoCompleteMessages = false`, o handler decide o destino de cada mensagem. Só existem três desfechos sensatos:

| Situação | Settlement | O que acontece depois |
|---|---|---|
| Processada, ou reconhecida como duplicata | `CompleteMessageAsync` | Removida da queue |
| Falha transitória (timeout no banco, shutdown) | `AbandonMessageAsync` | Lock liberado, delivery count sobe, reentregue |
| Nunca vai dar certo (payload ruim, transição inválida) | `DeadLetterMessageAsync` | Movida para a DLQ com motivo e descrição |

Quando o delivery count passa do max delivery count da queue, o próprio Service Bus manda a mensagem para dead-letter com o motivo `MaxDeliveryCountExceeded`. Essa é a sua rede de segurança para falhas transitórias que acabam se revelando permanentes.

**3. Idempotência por chave natural.** O Service Bus é at-least-once. Um lock pode expirar enquanto você ainda está trabalhando, um worker pode cair depois de gravar no banco mas antes de completar, e a mensagem volta. Em vez de guardar cada `MessageId` processado, o producer carimba um `Sequence` crescente por pedido, e o store guarda `LastSequence` por pedido. Uma mensagem com sequência igual à guardada é duplicata; uma menor está desatualizada. As duas são completadas sem efeitos colaterais. Guardar os `MessageId`s processados numa tabela também funciona, mas ela cresce para sempre e precisa de limpeza; a chave natural sai de graça.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se as sessions já garantem a ordem, por que eu preciso de um número de sequência no payload?</span>
    </div>
  </div>
</div>

Porque sessions garantem a ordem do *broker*, que é a ordem em que as mensagens chegaram na queue, não a ordem em que as coisas aconteceram no negócio. Duas instâncias do producer podem enviar updates do mesmo pedido com poucos milissegundos de diferença e chegar ao broker na ordem errada. Uma mensagem reenviada da DLQ vai para o fim da sua session, atrás de updates mais novos. O número de sequência permite ao consumer reconhecer os dois casos e ignorar o update antigo em vez de sobrescrever um estado mais recente.

**4. Trabalho atrasado usa mensagens agendadas.** Quando um pedido é criado, o publisher agenda uma mensagem `PaymentTimeoutCheck` para 30 minutos depois, na mesma session. Ela fica invisível até lá. Se o pagamento chegar antes, o publisher cancela usando o número de sequência devolvido no agendamento. O cancelamento pode perder uma corrida com a entrega, então o handler é condicional: só cancela se o pedido ainda estiver `Created`. Isso transforma o cancelamento numa otimização, não num requisito de corretude.

<div class="callout info" data-title="Info">
  <p>A duplicate detection da queue descarta uma segunda mensagem com o mesmo <code>MessageId</code> dentro da janela configurada. Ela protege contra retries do producer depois de uma falha de rede. Ela não protege contra reentrega para os consumers, então o handler continua precisando ser idempotente.</p>
</div>

## Implementação na prática

### Provisionando a queue

Sessions e duplicate detection não existem no tier Basic, então vamos de Standard. Algumas configurações, incluindo sessions e duplicate detection, só podem ser escolhidas na criação da queue, então decida antes.

```bash title="provision.sh"
RG=rg-orders-messaging
LOC=eastus2
SB=sb-orders-dev-$RANDOM   # nomes de namespace são globalmente únicos
QUEUE=order-status

az group create --name $RG --location $LOC

az servicebus namespace create --resource-group $RG --name $SB \
  --location $LOC --sku Standard

az servicebus queue create --resource-group $RG --namespace-name $SB --name $QUEUE \
  --enable-session true \
  --max-delivery-count 5 \
  --lock-duration PT1M \
  --enable-duplicate-detection true \
  --duplicate-detection-history-time-window PT10M \
  --default-message-time-to-live P7D \
  --enable-dead-lettering-on-message-expiration true

# Acesso de data plane para a sua identidade (no Azure, use a managed identity da aplicação)
QUEUE_ID=$(az servicebus queue show --resource-group $RG --namespace-name $SB \
  --name $QUEUE --query id -o tsv)
az role assignment create --role "Azure Service Bus Data Owner" \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" --scope $QUEUE_ID
```

O que cada configuração te dá:

- `--enable-session`: obrigatório para o session processor; o FIFO por pedido depende disso.
- `--max-delivery-count 5`: cinco tentativas e depois a DLQ. Baixo demais, uma queda curta manda tudo para dead-letter; alto demais, uma mensagem envenenada desperdiça minutos.
- `--lock-duration PT1M`: quanto tempo um lock dura antes de precisar ser renovado. O processor renova automaticamente, mas uma duração base maior tolera pausas de GC e renovações lentas.
- Duplicate detection com janela de 10 minutos: cobre retries do producer. Janelas maiores custam controle interno no broker.
- Dead-letter na expiração: mensagens expiradas caem na DLQ (motivo `TTLExpiredException`) em vez de sumir.

Em produção, dê ao worker `Azure Service Bus Data Receiver` e aos producers `Azure Service Bus Data Sender`. Data Owner é uma conveniência para quem roda os dois lados localmente.

### O projeto

```bash title="setup.sh"
dotnet new worker -n OrderStatus.Worker
cd OrderStatus.Worker
rm Worker.cs   # substituído pelo OrderStatusWorker.cs abaixo
dotnet add package Azure.Messaging.ServiceBus
dotnet add package Azure.Identity
dotnet add package Microsoft.Extensions.Azure

# Rode o worker, ou a ferramenta da DLQ (dry run primeiro)
export ServiceBus__FullyQualifiedNamespace="<your-namespace>.servicebus.windows.net"
dotnet run
dotnet run -- --reprocess-dlq --dry-run
```

### Contratos

```csharp title="OrderMessages.cs"
using System.Text.Json;
using System.Text.Json.Serialization;

public enum OrderStatus { Created, Paid, Shipped, Delivered, Cancelled }

// Sequence é atribuído pelo dono do pedido e cresce de um em um a cada mudança daquele pedido.
public sealed record OrderStatusChanged(string OrderId, OrderStatus Status, long Sequence, DateTimeOffset OccurredAt);

// Follow-up atrasado: "se este pedido ainda não foi pago quando isto chegar, cancele".
public sealed record PaymentTimeoutCheck(string OrderId);

public static class Messaging
{
    public const string QueueName = "order-status";
    public const string StatusChangedSubject = "OrderStatusChanged";
    public const string PaymentTimeoutSubject = "PaymentTimeoutCheck";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
}

// Lançada para falhas que nenhum retry resolve. O worker manda estas para dead-letter.
public sealed class PoisonMessageException(string reason, string description)
    : Exception(description)
{
    public string Reason { get; } = reason;
}
```

### O publisher, incluindo o follow-up agendado

```csharp title="OrderStatusPublisher.cs"
using Azure.Messaging.ServiceBus;

public sealed class OrderStatusPublisher : IAsyncDisposable
{
    private readonly ServiceBusSender _sender;

    public OrderStatusPublisher(ServiceBusClient client)
        => _sender = client.CreateSender(Messaging.QueueName);

    public Task PublishAsync(OrderStatusChanged update, CancellationToken ct = default)
    {
        var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(update, Messaging.Json))
        {
            SessionId = update.OrderId,                          // FIFO por pedido
            MessageId = $"{update.OrderId}:{update.Sequence}",   // estável, para a duplicate detection funcionar
            Subject = Messaging.StatusChangedSubject,
            ContentType = "application/json"
        };

        return _sender.SendMessageAsync(message, ct);
    }

    // Devolve o número de sequência necessário para cancelar depois. Persista junto com o pedido.
    public Task<long> SchedulePaymentTimeoutAsync(string orderId, DateTimeOffset checkAt, CancellationToken ct = default)
    {
        var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(new PaymentTimeoutCheck(orderId), Messaging.Json))
        {
            SessionId = orderId,
            MessageId = $"{orderId}:payment-timeout",
            Subject = Messaging.PaymentTimeoutSubject,
            ContentType = "application/json"
        };

        return _sender.ScheduleMessageAsync(message, checkAt, ct);
    }

    public Task CancelPaymentTimeoutAsync(long scheduledSequenceNumber, CancellationToken ct = default)
        => _sender.CancelScheduledMessageAsync(scheduledSequenceNumber, ct);

    public ValueTask DisposeAsync() => _sender.DisposeAsync();
}
```

O Checkout chama `PublishAsync` com `Created`, depois `SchedulePaymentTimeoutAsync(orderId, DateTimeOffset.UtcNow.AddMinutes(30))`, e guarda o número devolvido. O Payments chama `CancelPaymentTimeoutAsync` com ele depois de publicar `Paid`.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o Payments sempre cancela o timeout, o worker pode simplesmente cancelar o pedido quando o check chegar, sem perguntar nada?</span>
    </div>
  </div>
</div>

Só se você gosta de cancelar pedidos pagos. A chamada de cancelamento pode falhar, dar timeout ou chegar um instante depois de a mensagem ficar ativa, e um serviço pode cair entre publicar `Paid` e cancelar. Trate mensagens agendadas como "me acorde mais tarde" e confira o estado quando acordar. É isso que o `ExpireIfUnpaidAsync` faz logo abaixo.

### O store: ordem e idempotência no mesmo lugar

```csharp title="OrderStatusStore.cs"
public enum ApplyResult { Applied, Duplicate, Stale }

public interface IOrderStatusStore
{
    Task<ApplyResult> ApplyAsync(OrderStatusChanged update, CancellationToken ct);
    Task<ApplyResult> ExpireIfUnpaidAsync(string orderId, CancellationToken ct);
}

// Suficiente para rodar localmente e em testes. Em produção isto é uma linha por pedido
// com uma coluna LastSequence e um UPDATE condicional, na mesma transação
// de qualquer outro efeito colateral.
public sealed class InMemoryOrderStatusStore : IOrderStatusStore
{
    private sealed record OrderState(OrderStatus Status, long LastSequence);

    private readonly Dictionary<string, OrderState> _orders = new();
    private readonly object _gate = new();

    public Task<ApplyResult> ApplyAsync(OrderStatusChanged update, CancellationToken ct)
    {
        lock (_gate)
        {
            if (_orders.TryGetValue(update.OrderId, out var current))
            {
                // A chave natural (OrderId + Sequence) torna a reentrega inofensiva.
                if (update.Sequence == current.LastSequence) return Task.FromResult(ApplyResult.Duplicate);
                if (update.Sequence < current.LastSequence) return Task.FromResult(ApplyResult.Stale);

                if (current.Status is OrderStatus.Delivered or OrderStatus.Cancelled)
                {
                    throw new PoisonMessageException(
                        "InvalidTransition",
                        $"Order {update.OrderId} is {current.Status}; cannot move to {update.Status}.");
                }
            }

            _orders[update.OrderId] = new OrderState(update.Status, update.Sequence);
            return Task.FromResult(ApplyResult.Applied);
        }
    }

    public Task<ApplyResult> ExpireIfUnpaidAsync(string orderId, CancellationToken ct)
    {
        lock (_gate)
        {
            // Condicional de propósito: se o cancelamento da mensagem agendada perdeu a corrida,
            // um pedido pago simplesmente ignora o timeout.
            if (!_orders.TryGetValue(orderId, out var current) || current.Status != OrderStatus.Created)
            {
                return Task.FromResult(ApplyResult.Stale);
            }

            _orders[orderId] = current with { Status = OrderStatus.Cancelled };
            return Task.FromResult(ApplyResult.Applied);
        }
    }
}
```

Repare na falha interessante: um update `Paid` que chega depois de o timeout já ter cancelado o pedido lança `InvalidTransition`. Isso não é um bug para dar retry, é um cliente que pagou por um pedido cancelado. Vai para a DLQ, onde um humano (ou um fluxo de reembolso) assume.

### O worker

```csharp title="OrderStatusWorker.cs"
using System.Text.Json;
using Azure.Messaging.ServiceBus;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public sealed class OrderStatusWorker : BackgroundService
{
    private readonly ServiceBusSessionProcessor _processor;
    private readonly IOrderStatusStore _store;
    private readonly ILogger<OrderStatusWorker> _logger;

    public OrderStatusWorker(ServiceBusClient client, IOrderStatusStore store, ILogger<OrderStatusWorker> logger)
    {
        _store = store;
        _logger = logger;

        _processor = client.CreateSessionProcessor(Messaging.QueueName, new ServiceBusSessionProcessorOptions
        {
            ReceiveMode = ServiceBusReceiveMode.PeekLock,
            AutoCompleteMessages = false,                         // toda mensagem é liquidada explicitamente
            MaxConcurrentSessions = 16,                           // pedidos processados em paralelo
            MaxConcurrentCallsPerSession = 1,                     // ordem estrita dentro de um pedido
            SessionIdleTimeout = TimeSpan.FromSeconds(5),         // libera sessions paradas rapidamente
            MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(5), // renova o lock da session para handlers lentos
            PrefetchCount = 0
        });

        _processor.ProcessMessageAsync += HandleMessageAsync;
        _processor.ProcessErrorAsync += HandleErrorAsync;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _processor.StartProcessingAsync(stoppingToken);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // O host está desligando.
        }

        // Para de receber e espera os handlers em andamento terminarem.
        await _processor.StopProcessingAsync(CancellationToken.None);
        await _processor.DisposeAsync();
    }

    private async Task HandleMessageAsync(ProcessSessionMessageEventArgs args)
    {
        ServiceBusReceivedMessage message = args.Message;

        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["SessionId"] = args.SessionId,
            ["MessageId"] = message.MessageId,
            ["DeliveryCount"] = message.DeliveryCount
        });

        try
        {
            ApplyResult result = message.Subject switch
            {
                Messaging.StatusChangedSubject => await _store.ApplyAsync(ReadUpdate(args), args.CancellationToken),
                Messaging.PaymentTimeoutSubject => await _store.ExpireIfUnpaidAsync(args.SessionId, args.CancellationToken),
                _ => throw new PoisonMessageException("UnknownSubject", $"No handler for subject '{message.Subject}'.")
            };

            await args.CompleteMessageAsync(message, args.CancellationToken);
            _logger.LogInformation("Settled {Subject} as {Result}", message.Subject, result);
        }
        catch (PoisonMessageException ex)
        {
            // Retry não resolve isto: estacione com um motivo que um humano consiga ler.
            _logger.LogWarning(ex, "Dead-lettering message: {Reason}", ex.Reason);
            await args.DeadLetterMessageAsync(message, ex.Reason, ex.Message, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Transitório (banco fora, timeout, shutdown): devolva o lock.
            // O Service Bus incrementa o DeliveryCount e manda para dead-letter depois do MaxDeliveryCount.
            _logger.LogWarning(ex, "Abandoning message for retry");
            await args.AbandonMessageAsync(message, cancellationToken: CancellationToken.None);
        }
    }

    private static OrderStatusChanged ReadUpdate(ProcessSessionMessageEventArgs args)
    {
        OrderStatusChanged? update;
        try
        {
            update = args.Message.Body.ToObjectFromJson<OrderStatusChanged>(Messaging.Json);
        }
        catch (JsonException ex)
        {
            throw new PoisonMessageException("InvalidPayload", ex.Message);
        }

        if (update is null || update.OrderId != args.SessionId)
        {
            throw new PoisonMessageException("InvalidPayload", "Body is empty or does not match the SessionId.");
        }

        return update;
    }

    private Task HandleErrorAsync(ProcessErrorEventArgs args)
    {
        if (args.Exception is ServiceBusException { Reason: ServiceBusFailureReason.SessionLockLost or ServiceBusFailureReason.MessageLockLost })
        {
            // Outra instância pode ser dona da session agora; a mensagem será reentregue.
            _logger.LogWarning(args.Exception, "Lock lost on {EntityPath}", args.EntityPath);
        }
        else
        {
            _logger.LogError(args.Exception, "Service Bus error from {ErrorSource} on {EntityPath}", args.ErrorSource, args.EntityPath);
        }

        return Task.CompletedTask;
    }
}
```

O formato importa mais que os detalhes: um `try`, um caminho de sucesso que completa, um catch para falhas permanentes que manda para dead-letter, um catch para todo o resto que faz abandon. As chamadas de settlement nos blocos catch usam `CancellationToken.None`, porque durante o shutdown o token do handler já está cancelado e você ainda quer devolver o lock de forma limpa.

### Juntando tudo

```csharp title="Program.cs"
using Azure.Identity;
using Microsoft.Extensions.Azure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

HostApplicationBuilder builder = Host.CreateApplicationBuilder(args);

string serviceBusNamespace = builder.Configuration["ServiceBus:FullyQualifiedNamespace"]
    ?? throw new InvalidOperationException("Set ServiceBus:FullyQualifiedNamespace, e.g. sb-orders-dev.servicebus.windows.net");

builder.Services.AddAzureClients(clients =>
{
    // Um ServiceBusClient de vida longa (uma conexão AMQP) para o processo inteiro.
    clients.AddServiceBusClientWithNamespace(serviceBusNamespace);
    clients.UseCredential(new DefaultAzureCredential());
});

// Dá tempo para os handlers em andamento terminarem antes de o processo ser encerrado.
builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(60));

builder.Services.AddSingleton<IOrderStatusStore, InMemoryOrderStatusStore>();
builder.Services.AddSingleton<OrderStatusPublisher>();
builder.Services.AddSingleton<DeadLetterReprocessor>();
builder.Services.AddHostedService<OrderStatusWorker>();

IHost host = builder.Build();

if (args.Contains("--reprocess-dlq"))
{
    // Execução administrativa pontual: o worker hospedado não é iniciado neste modo.
    var reprocessor = host.Services.GetRequiredService<DeadLetterReprocessor>();
    await reprocessor.RunAsync(dryRun: args.Contains("--dry-run"), CancellationToken.None);
    return;
}

await host.RunAsync();
```

### Reprocessando a dead-letter queue de forma deliberada

A DLQ é uma sub-queue da queue principal. Ela não tem sessions habilitadas, então um receiver comum com `SubQueue.DeadLetter` consegue lê-la. A política vive no código, então é revisada como código: reenviar o que morreu por esgotar retries ou por expiração, descartar o que está estruturalmente quebrado, deixar conflitos de negócio para um humano.

```csharp title="DeadLetterReprocessor.cs"
using Azure.Messaging.ServiceBus;
using Microsoft.Extensions.Logging;

public sealed class DeadLetterReprocessor(ServiceBusClient client, ILogger<DeadLetterReprocessor> logger)
{
    public async Task RunAsync(bool dryRun, CancellationToken ct)
    {
        await using ServiceBusReceiver dlq = client.CreateReceiver(Messaging.QueueName, new ServiceBusReceiverOptions
        {
            SubQueue = SubQueue.DeadLetter,
            ReceiveMode = ServiceBusReceiveMode.PeekLock
        });

        if (dryRun)
        {
            // Peek não aplica lock nem altera nada: seguro para rodar contra produção.
            long? from = null;
            while (true)
            {
                IReadOnlyList<ServiceBusReceivedMessage> page = await dlq.PeekMessagesAsync(50, from, ct);
                if (page.Count == 0) return;
                foreach (ServiceBusReceivedMessage dead in page) Describe(dead);
                from = page[^1].SequenceNumber + 1;
            }
        }

        await using ServiceBusSender sender = client.CreateSender(Messaging.QueueName);
        var seen = new HashSet<long>();

        while (!ct.IsCancellationRequested)
        {
            IReadOnlyList<ServiceBusReceivedMessage> batch =
                await dlq.ReceiveMessagesAsync(maxMessages: 50, maxWaitTime: TimeSpan.FromSeconds(5), cancellationToken: ct);
            if (batch.Count == 0) return;

            bool wrappedAround = false;
            foreach (ServiceBusReceivedMessage dead in batch)
            {
                if (!seen.Add(dead.SequenceNumber))
                {
                    // Já decidimos deixar esta: tudo o que sobrou precisa de um humano.
                    await dlq.AbandonMessageAsync(dead, cancellationToken: ct);
                    wrappedAround = true;
                    continue;
                }

                Describe(dead);

                switch (dead.DeadLetterReason)
                {
                    // Esgotou os retries num problema transitório que já foi resolvido: tente de novo.
                    case "MaxDeliveryCountExceeded":
                    case "TTLExpiredException":
                        var replay = new ServiceBusMessage(dead)
                        {
                            // Id novo, senão a duplicate detection pode descartar o reenvio dentro da janela.
                            MessageId = $"{dead.MessageId}:replay:{dead.SequenceNumber}"
                        };
                        replay.ApplicationProperties["ReplayedFromDeadLetter"] = dead.DeadLetterReason;

                        await sender.SendMessageAsync(replay, ct);
                        await dlq.CompleteMessageAsync(dead, ct);
                        break;

                    // Dado ruim nunca melhora. Arquive antes se precisar de trilha de auditoria.
                    case "InvalidPayload":
                    case "UnknownSubject":
                        await dlq.CompleteMessageAsync(dead, ct);
                        break;

                    // Conflitos de negócio (InvalidTransition) precisam de um humano. Deixe na DLQ.
                    default:
                        await dlq.AbandonMessageAsync(dead, cancellationToken: ct);
                        break;
                }
            }

            if (wrappedAround) return;
        }
    }

    private void Describe(ServiceBusReceivedMessage dead) =>
        logger.LogInformation(
            "DLQ {MessageId} session={SessionId} reason={Reason} description={Description} deliveries={DeliveryCount}",
            dead.MessageId, dead.SessionId, dead.DeadLetterReason, dead.DeadLetterErrorDescription, dead.DeliveryCount);
}
```

O construtor de cópia `new ServiceBusMessage(dead)` mantém o body, o `SessionId` e as application properties, então o replay cai na session certa. Enviar e completar são duas operações separadas: se a ferramenta morrer entre elas, a mensagem existe duas vezes. O store idempotente nem pisca, e é exatamente por isso que ele foi construído primeiro.

<div class="callout warning" data-title="Atenção">
  <p>Reenviar uma mensagem da dead-letter com o <code>MessageId</code> original dentro da janela de duplicate detection faz o broker descartá-la em silêncio: o envio dá certo e nada chega. Sempre dê um <code>MessageId</code> novo aos replays e confie na chave natural para a idempotência.</p>
</div>

### Desenvolvimento local

O setup honesto mais simples é um namespace de dev dedicado por desenvolvedor ou por time, criado com o script acima: mesmas features, mesma autenticação via Entra ID, mesmo caminho de código da produção. A Microsoft também oferece um emulador oficial do Service Bus que roda em Docker, com as queues declaradas num arquivo de configuração JSON. Ele é útil para trabalhar offline e em CI, mas autentica com connection string em vez de Entra ID, então você registraria o client de outro jeito em desenvolvimento, e ele não reproduz todas as features e limites do serviço na nuvem. Confira a documentação atual antes de depender dele.

## Checagem de realidade em produção

**Lock perdido é normal, não exótico.** Um lock de session expira se o handler travar por mais tempo que a duração do lock e a renovação falhar, ou se um soluço de rede derrubar o link. Você vai ver `SessionLockLost` no error handler, e as chamadas de settlement daquela session vão falhar. A mensagem volta mais tarde, talvez em outra instância. É por isso que o store é idempotente e que o `MaxAutoLockRenewalDuration` deve cobrir o seu handler mais lento realista. Se os handlers precisam de minutos com frequência, tire o trabalho lento de dentro do handler.

**Uma mensagem em dead-letter quebra a ordem da session.** Quando uma mensagem vai para a DLQ, a session segue com a próxima. Para status de pedido, a checagem de sequência transforma um replay posterior da mensagem morta num no-op se já existir estado mais novo, que é o resultado correto aqui. Se o seu domínio não tolera buracos, detecte-os (sequência pulando mais de um) e decida explicitamente se vai esperar, alertar ou seguir em frente.

**Mensagens envenenadas aparecem no dia do deploy.** Um producer publica uma mudança de schema antes do consumer, e toda mensagem falha na desserialização. Como o worker manda `InvalidPayload` para dead-letter na hora em vez de fazer abandon, você perde uma tentativa por mensagem em vez de cinco, e a DLQ te diz exatamente o que quebrou.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O throughput está baixo, então vou colocar MaxConcurrentSessions em 1000 e deixar voar?</span>
    </div>
  </div>
</div>

Cada session concorrente é um link de recebimento aberto esperando mensagens, e uma session ociosa segura aquele slot até o `SessionIdleTimeout` expirar. Com muitos pedidos quietos e poucos movimentados, um número alto compra principalmente links parados, enquanto um número baixo combinado com um idle timeout longo causa **session starvation**: os workers ficam presos em sessions silenciosas enquanto as ativas esperam. Ajuste os dois juntos, escale instâncias para ter mais paralelismo e meça contra a capacidade do seu store, porque o banco costuma ser o teto de verdade.

**Prefetch é uma faca de dois gumes.** O `PrefetchCount` puxa mensagens antes do processamento e corta round-trips, mas mensagens pré-carregadas já estão com lock. Se o processamento é lento, os locks delas vão se esgotando antes de você tocá-las, e elas voltam com delivery count maior. Comece com zero e só aumente quando os handlers forem rápidos e você tiver medido a latência dos receives.

**O tamanho da mensagem é limitado, e o limite depende do tier.** O Standard aceita payloads modestos; o Premium aceita bem maiores. Para documentos grandes, use o padrão claim check: guarde o blob no Storage e envie uma referência. Updates de status nunca deveriam chegar perto do limite, de qualquer forma.

**Observe a queue, não só o código.** Registre `SessionId`, `MessageId` e `DeliveryCount` em toda tentativa (o logging scope acima faz isso). Um `DeliveryCount` acima de um nos logs é um aviso antecipado. No Azure Monitor, crie alertas para contagem de mensagens em dead-letter maior que zero, contagem de mensagens ativas em tendência de alta, e erros de servidor e requisições com throttling.

<div class="callout tip" data-title="Dica">
  <p>Alerte sobre a profundidade da DLQ com limite <code>&gt; 0</code> e um runbook que começa com <code>dotnet run -- --reprocess-dlq --dry-run</code>. Uma DLQ que ninguém observa é só um jeito mais lento de perder dados.</p>
</div>

**Escolha o tier primeiro pelas features, depois pela previsibilidade.** O Basic não tem sessions nem duplicate detection, então está fora para este design. O Standard roda em capacidade compartilhada com cobrança por operação: serve para a maioria das cargas, com variação ocasional de latência. O Premium dá capacidade dedicada, latência mais previsível, mensagens maiores e private endpoints, com custo fixo por messaging unit. Confira a página de preços atual antes de dimensionar.

O padrão vale muito além de pedidos: um worker hospedado, settlement explícito, sessions só onde a ordem importa, uma DLQ com uma ferramenta de reprocessamento que você realmente usa e um store que torna a segunda entrega entediante. Construa essas cinco peças e o Service Bus vira a parte menos empolgante do seu sistema, que é exatamente o que você quer de infraestrutura.
