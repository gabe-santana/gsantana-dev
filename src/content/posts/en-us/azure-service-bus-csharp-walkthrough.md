---
title: "Real-Time Message Queuing with Azure Service Bus and C#: A Complete Walkthrough"
description: "Build an idempotent C# Service Bus worker with sessions, explicit settlement, and dead-letter recovery."
date: 2026-02-22
tags: [Azure, Service Bus, C#, .NET, Messaging]
tldr:
  - "Run the consumer as a hosted worker with PeekLock and AutoCompleteMessages off, and complete, abandon or dead-letter every message explicitly."
  - "Use sessions keyed by entity id for per-entity ordering, plus a sequence number so duplicates, stale updates and DLQ replays become harmless no-ops."
  - "Reprocess the dead-letter queue with a reviewed tool that replays retry exhaustion under a new MessageId and leaves business conflicts for humans."
---

Sending a message to Azure Service Bus takes five lines of C#. Consuming messages correctly, in order, without losing any, without applying any twice, and without a single malformed payload jamming the pipeline, takes a lot more thought. Most tutorials stop at the five lines. Production incidents start right after them.

If you still need to decide whether Service Bus is even the right tool, start with [the comparison of Service Bus, Event Grid and Event Hubs](/en-us/blog/azure-service-bus-vs-event-grid-vs-event-hubs/). This post assumes you already picked Service Bus and builds one small, complete system on top of it: provisioning, a hosted worker with sessions, explicit settlement, a scheduled follow-up, a dead-letter reprocessing tool and the operational details that decide whether it survives its first busy week.

## The Problem & Context

Here is a typical scenario. An e-commerce platform has a service that owns the "order status" read model, the thing the customer tracking page and the support dashboard query. Several other services report changes to it: Checkout says an order was created, Payments says it was paid, the warehouse says it shipped, the carrier integration says it was delivered. All of those updates flow through one Service Bus queue called `order-status`.

The requirements look innocent:

- **Per-order ordering.** "Shipped" must never be applied before "Paid" for the same order. Across different orders, nobody cares about order, and we want as much parallelism as possible.
- **No lost updates.** If the worker crashes mid-update, the message must come back.
- **No double effects.** If a message is delivered twice, the second delivery must be harmless.
- **Bad messages get parked, not retried forever.** A payload from a buggy producer should not burn retries on every deploy.
- **Unpaid orders expire.** If an order is still unpaid 30 minutes after creation, it gets cancelled automatically.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why not a simple while loop that calls ReceiveMessageAsync in ReceiveAndDelete mode? Fewer moving parts, right?</span>
    </div>
  </div>
</div>

Fewer moving parts, and zero safety. In ReceiveAndDelete mode the broker deletes the message the moment it hands it to you. If your process dies one line later, that status update is gone for good. PeekLock is the mode that makes "no lost updates" possible: the message is locked, invisible to other consumers, and only removed when you explicitly complete it. The hand-written loop also leaves you to reinvent concurrency, lock renewal, reconnection and shutdown, which is exactly what the SDK processors already do well.

## Deep Dive / Architectural Design

The whole system fits in one picture:

<div id="service-bus-order-status-slot"></div>

Four design decisions carry the weight.

**1. Sessions give per-order FIFO without global serialization.** Every message carries `SessionId = orderId`. The broker hands a session to exactly one consumer at a time and delivers its messages in order, while different sessions are processed in parallel. With `MaxConcurrentCallsPerSession = 1` you get strict order inside an order and `MaxConcurrentSessions` orders at once.

**2. Every message is settled explicitly.** With `AutoCompleteMessages = false`, the handler decides the fate of each message. There are only three sensible outcomes:

| Situation | Settlement | What happens next |
|---|---|---|
| Processed, or recognized as a duplicate | `CompleteMessageAsync` | Removed from the queue |
| Transient failure (database timeout, shutdown) | `AbandonMessageAsync` | Lock released, delivery count goes up, redelivered |
| Can never succeed (bad payload, invalid transition) | `DeadLetterMessageAsync` | Moved to the DLQ with a reason and description |

When the delivery count exceeds the queue's max delivery count, Service Bus dead-letters the message itself with the reason `MaxDeliveryCountExceeded`. That is your safety net for transient failures that turn out to be permanent.

**3. Idempotency by natural key.** Service Bus is at-least-once. A lock can expire while you are still working, a worker can crash after writing to the database but before completing, and the message comes back. Instead of storing every processed `MessageId`, the producer stamps a monotonically increasing `Sequence` per order, and the store keeps `LastSequence` per order. A message with a sequence equal to the stored one is a duplicate; a lower one is stale. Both get completed without side effects. Storing processed `MessageId`s in a table works too, but it grows forever and needs cleanup; the natural key is free.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If sessions already guarantee order, why do I need a sequence number in the payload?</span>
    </div>
  </div>
</div>

Because sessions guarantee *broker* order, which is the order messages arrived at the queue, not the order things happened in the business. Two producer instances can send updates for the same order a few milliseconds apart and reach the broker in the wrong order. A message replayed from the DLQ goes to the back of its session, behind newer updates. The sequence number lets the consumer recognize both cases and ignore the stale update instead of overwriting fresher state.

**4. Delayed work uses scheduled messages.** When an order is created, the publisher schedules a `PaymentTimeoutCheck` message for 30 minutes later, in the same session. It stays invisible until then. If payment arrives first, the publisher cancels it using the sequence number returned at scheduling time. Cancellation can lose a race with delivery, so the handler is conditional: it cancels only if the order is still `Created`. That makes the cancel an optimization, not a correctness requirement.

<div class="callout info" data-title="Info">
  <p>Duplicate detection on the queue drops a second message with the same <code>MessageId</code> within the configured window. It protects against producer retries after a network blip. It does not protect against redelivery to consumers, so the handler still has to be idempotent.</p>
</div>

## Hands-On Implementation

### Provisioning the queue

Sessions and duplicate detection are not available on the Basic tier, so this uses Standard. Some settings, including sessions and duplicate detection, can only be chosen when the queue is created, so decide up front.

```bash title="provision.sh"
RG=rg-orders-messaging
LOC=eastus2
SB=sb-orders-dev-$RANDOM   # namespace names are globally unique
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

# Data-plane access for your own identity (use the app's managed identity in Azure)
QUEUE_ID=$(az servicebus queue show --resource-group $RG --namespace-name $SB \
  --name $QUEUE --query id -o tsv)
az role assignment create --role "Azure Service Bus Data Owner" \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" --scope $QUEUE_ID
```

What each setting buys you:

- `--enable-session`: required for the session processor; per-order FIFO depends on it.
- `--max-delivery-count 5`: five attempts, then the DLQ. Too low and a short outage dead-letters everything; too high and a poison message wastes minutes.
- `--lock-duration PT1M`: how long a lock lasts before it must be renewed. The processor renews it automatically, but a longer base duration tolerates GC pauses and slow renewals.
- Duplicate detection with a 10 minute window: covers producer retries. Longer windows cost broker-side bookkeeping.
- Expiration dead-lettering: expired messages land in the DLQ (reason `TTLExpiredException`) instead of vanishing.

In production, give the worker `Azure Service Bus Data Receiver` and producers `Azure Service Bus Data Sender`. Data Owner is a convenience for a developer who runs both sides locally.

### The project

```bash title="setup.sh"
dotnet new worker -n OrderStatus.Worker
cd OrderStatus.Worker
rm Worker.cs   # replaced by OrderStatusWorker.cs below
dotnet add package Azure.Messaging.ServiceBus
dotnet add package Azure.Identity
dotnet add package Microsoft.Extensions.Azure

# Run the worker, or the DLQ tool (dry run first)
export ServiceBus__FullyQualifiedNamespace="<your-namespace>.servicebus.windows.net"
dotnet run
dotnet run -- --reprocess-dlq --dry-run
```

### Contracts

```csharp title="OrderMessages.cs"
using System.Text.Json;
using System.Text.Json.Serialization;

public enum OrderStatus { Created, Paid, Shipped, Delivered, Cancelled }

// Sequence is assigned by the order owner and grows by one per change of that order.
public sealed record OrderStatusChanged(string OrderId, OrderStatus Status, long Sequence, DateTimeOffset OccurredAt);

// Delayed follow-up: "if this order is still unpaid when this arrives, cancel it".
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

// Thrown for failures that no retry can fix. The worker dead-letters these.
public sealed class PoisonMessageException(string reason, string description)
    : Exception(description)
{
    public string Reason { get; } = reason;
}
```

### The publisher, including the scheduled follow-up

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
            SessionId = update.OrderId,                          // FIFO per order
            MessageId = $"{update.OrderId}:{update.Sequence}",   // stable, so duplicate detection works
            Subject = Messaging.StatusChangedSubject,
            ContentType = "application/json"
        };

        return _sender.SendMessageAsync(message, ct);
    }

    // Returns the sequence number you need to cancel it later. Persist it with the order.
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

Checkout calls `PublishAsync` with `Created`, then `SchedulePaymentTimeoutAsync(orderId, DateTimeOffset.UtcNow.AddMinutes(30))`, and stores the returned number. Payments calls `CancelPaymentTimeoutAsync` with it after publishing `Paid`.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If Payments always cancels the timeout, the worker can just cancel the order when the check arrives, no questions asked?</span>
    </div>
  </div>
</div>

Only if you enjoy cancelling paid orders. The cancel call can fail, time out, or land a moment after the message became active, and a service can crash between publishing `Paid` and cancelling. Treat scheduled messages as "wake me up later", and re-check state when you wake up. That is what `ExpireIfUnpaidAsync` does below.

### The store: ordering and idempotency in one place

```csharp title="OrderStatusStore.cs"
public enum ApplyResult { Applied, Duplicate, Stale }

public interface IOrderStatusStore
{
    Task<ApplyResult> ApplyAsync(OrderStatusChanged update, CancellationToken ct);
    Task<ApplyResult> ExpireIfUnpaidAsync(string orderId, CancellationToken ct);
}

// Good enough for local runs and tests. In production this is one row per order
// with a LastSequence column and a conditional UPDATE, in the same transaction
// as any other side effect.
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
                // The natural key (OrderId + Sequence) makes redelivery harmless.
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
            // Conditional on purpose: if the cancel of the scheduled message lost a race,
            // a paid order simply ignores the timeout.
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

Notice the interesting failure: a `Paid` update that arrives after the timeout already cancelled the order throws `InvalidTransition`. That is not a bug to retry, it is a customer who paid for a cancelled order. It goes to the DLQ, where a human (or a refund flow) picks it up.

### The worker

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
            AutoCompleteMessages = false,                         // every message is settled explicitly
            MaxConcurrentSessions = 16,                           // orders processed in parallel
            MaxConcurrentCallsPerSession = 1,                     // strict order inside one order
            SessionIdleTimeout = TimeSpan.FromSeconds(5),         // release quiet sessions quickly
            MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(5), // renew the session lock for slow handlers
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
            // Host is shutting down.
        }

        // Stops receiving and waits for in-flight handlers to finish.
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
            // Retrying cannot fix this: park it with a reason a human can read.
            _logger.LogWarning(ex, "Dead-lettering message: {Reason}", ex.Reason);
            await args.DeadLetterMessageAsync(message, ex.Reason, ex.Message, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Transient (database down, timeout, shutdown): give the lock back.
            // Service Bus increments DeliveryCount and dead-letters after MaxDeliveryCount.
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
            // Another instance may own the session now; the message will be redelivered.
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

The shape matters more than the details: one `try`, one success path that completes, one catch for permanent failures that dead-letters, one catch for everything else that abandons. Settlement calls in the catch blocks use `CancellationToken.None`, because during shutdown the handler's token is already cancelled and you still want to hand the lock back cleanly.

### Wiring it up

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
    // One long-lived ServiceBusClient (one AMQP connection) for the whole process.
    clients.AddServiceBusClientWithNamespace(serviceBusNamespace);
    clients.UseCredential(new DefaultAzureCredential());
});

// Give in-flight handlers time to finish before the process is killed.
builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(60));

builder.Services.AddSingleton<IOrderStatusStore, InMemoryOrderStatusStore>();
builder.Services.AddSingleton<OrderStatusPublisher>();
builder.Services.AddSingleton<DeadLetterReprocessor>();
builder.Services.AddHostedService<OrderStatusWorker>();

IHost host = builder.Build();

if (args.Contains("--reprocess-dlq"))
{
    // One-off admin run: the hosted worker is not started in this mode.
    var reprocessor = host.Services.GetRequiredService<DeadLetterReprocessor>();
    await reprocessor.RunAsync(dryRun: args.Contains("--dry-run"), CancellationToken.None);
    return;
}

await host.RunAsync();
```

### Reprocessing the dead-letter queue deliberately

The DLQ is a sub-queue of the main queue. It is not session-enabled, so a plain receiver with `SubQueue.DeadLetter` reads it. The policy lives in code, so it is reviewed like code: replay what died of retry exhaustion or expiry, discard what is structurally broken, leave business conflicts for a human.

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
            // Peek does not lock or change anything: safe to run against production.
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
                    // We already decided to leave this one: everything left needs a human.
                    await dlq.AbandonMessageAsync(dead, cancellationToken: ct);
                    wrappedAround = true;
                    continue;
                }

                Describe(dead);

                switch (dead.DeadLetterReason)
                {
                    // Ran out of retries on a transient problem that has since been fixed: try again.
                    case "MaxDeliveryCountExceeded":
                    case "TTLExpiredException":
                        var replay = new ServiceBusMessage(dead)
                        {
                            // New id, otherwise duplicate detection may drop the resend inside its window.
                            MessageId = $"{dead.MessageId}:replay:{dead.SequenceNumber}"
                        };
                        replay.ApplicationProperties["ReplayedFromDeadLetter"] = dead.DeadLetterReason;

                        await sender.SendMessageAsync(replay, ct);
                        await dlq.CompleteMessageAsync(dead, ct);
                        break;

                    // Bad data never gets better. Archive it first if you need an audit trail.
                    case "InvalidPayload":
                    case "UnknownSubject":
                        await dlq.CompleteMessageAsync(dead, ct);
                        break;

                    // Business conflicts (InvalidTransition) need a human. Leave them in the DLQ.
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

The copy constructor `new ServiceBusMessage(dead)` keeps the body, `SessionId` and application properties, so the replay lands in the right session. Send and complete are two separate operations: if the tool dies between them, the message exists twice. The idempotent store shrugs that off, which is the whole point of building it first.

<div class="callout warning" data-title="Warning">
  <p>Replaying a dead-lettered message with its original <code>MessageId</code> inside the duplicate detection window gets it silently dropped by the broker: the send succeeds and nothing arrives. Always give replays a new <code>MessageId</code> and rely on the natural key for idempotency.</p>
</div>

### Local development

The simplest honest setup is a dedicated dev namespace per developer or per team, created with the script above: same features, same Entra ID auth, same code path as production. Microsoft also ships an official Service Bus emulator that runs in Docker, with queues declared in a JSON config file. It is handy for offline work and CI, but it authenticates with a connection string rather than Entra ID, so you would register the client differently in development, and it does not replicate every feature or limit of the cloud service. Check its current documentation before relying on it.

## Production Reality Check

**Lock lost is normal, not exotic.** A session lock expires if your handler stalls longer than the lock duration and renewal fails, or if a network hiccup drops the link. You will see `SessionLockLost` in the error handler, and settlement calls on that session will fail. The message comes back later, possibly on another instance. This is why the store is idempotent and why `MaxAutoLockRenewalDuration` should cover your slowest realistic handler. If handlers regularly need minutes, move the slow work out of the handler.

**A dead-lettered message breaks per-session order.** Once a message goes to the DLQ, the session continues with the next one. For order status, the sequence check turns a later replay of the dead message into a no-op if newer state already exists, which is the correct outcome here. If your domain cannot tolerate gaps, detect them (sequence jumps by more than one) and decide explicitly whether to wait, alert, or proceed.

**Poison messages surface on deploy day.** A producer ships a schema change before the consumer, and every message fails deserialization. Because the worker dead-letters `InvalidPayload` immediately instead of abandoning it, you lose one attempt per message rather than five, and the DLQ tells you exactly what broke.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Throughput is low, so I'll set MaxConcurrentSessions to 1000 and let it fly?</span>
    </div>
  </div>
</div>

Each concurrent session is an open receive link waiting for messages, and an idle session holds that slot until `SessionIdleTimeout` expires. With many quiet orders and few busy ones, a high count mostly buys you links sitting idle, while a low count combined with a long idle timeout causes **session starvation**: workers stay parked on silent sessions while active ones wait. Tune the two together, scale out instances for more parallelism, and measure against your store's capacity, because the database is usually the real ceiling.

**Prefetch is a double-edged tool.** `PrefetchCount` pulls messages ahead of processing and cuts round-trips, but prefetched messages are already locked. If processing is slow, their locks tick away before you touch them, and they come back with a higher delivery count. Start with zero, and raise it only when handlers are fast and you have measured latency on receives.

**Message size is limited, and the limit depends on the tier.** Standard allows modest payloads; Premium allows much larger ones. For big documents, use the claim check pattern: store the blob in Storage and send a reference. Status updates should never be near the limit anyway.

**Observe the queue, not just the code.** Log `SessionId`, `MessageId` and `DeliveryCount` on every attempt (the logging scope above does that). A `DeliveryCount` above one in your logs is an early warning. In Azure Monitor, alert on dead-lettered message count greater than zero, on active message count trending up, and on server errors and throttled requests.

<div class="callout tip" data-title="Tip">
  <p>Alert on DLQ depth with a threshold of <code>&gt; 0</code> and a runbook that starts with <code>dotnet run -- --reprocess-dlq --dry-run</code>. A DLQ that nobody watches is just a slower way to lose data.</p>
</div>

**Pick the tier for features first, then for predictability.** Basic has no sessions and no duplicate detection, so it is out for this design. Standard runs on shared capacity with per-operation billing: fine for most workloads, with occasional latency variance. Premium gives dedicated capacity, more predictable latency, larger messages and private endpoints, at a fixed cost per messaging unit. Check the current pricing page before sizing.

The pattern generalizes well beyond orders: a hosted worker, explicit settlement, sessions only where order matters, a DLQ with a reprocessing tool you actually run, and a store that makes the second delivery boring. Build those five and Service Bus becomes the least exciting part of your system, which is exactly what you want from infrastructure.
