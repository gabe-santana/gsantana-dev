---
title: "Event-Driven Microservices on Azure: Service Bus vs Event Grid vs Event Hubs"
description: "Pick an Azure messaging service by what the message means, not by feature lists: commands go to Service Bus, notifications go to Event Grid and telemetry streams go to Event Hubs. Real systems usually combine all three, glued together with idempotent consumers and the outbox pattern."
date: 2025-12-04
tags: [Azure, Messaging, Event-Driven, Microservices, C#]
---

Azure has three services with "message" or "event" somewhere in the description, and all three will happily accept a JSON payload from your code. That is exactly the trap. Teams pick the one they saw in a tutorial, then spend months fighting it: ordering that is not there, retries that flood a webhook, or a queue that quietly becomes an analytics pipeline it was never designed to be.

The good news: the choice gets easy once you stop comparing feature lists and start asking one question. **What does this message mean?** Is it an order someone expects you to carry out, a heads-up that something happened, or one drop in a river of data? Answer that, and the service picks itself.

## The Problem & Context

Picture an online store split into microservices. A customer clicks "Buy". The Orders service saves the order. Then a lot has to happen: Payments must charge the card, Inventory must reserve stock, Shipping must prepare a label, the email service must send a confirmation, and the analytics team wants every click that led to that purchase.

The naive version is a chain of HTTP calls. Orders calls Payments, which calls Inventory, which calls Shipping. It works on your laptop. In production, Payments has a slow minute, Orders times out, the customer clicks "Buy" again, and now you have two charges and zero reserved items. Synchronous coupling means the availability of the whole flow is the product of the availability of every hop.

Messaging breaks that chain. Producers hand off work and move on; consumers process at their own pace. But "messaging" is not one thing. There are three different kinds of traffic hiding in that store:

- **Commands (messages).** "Charge this card for order 4711." There is an intent, exactly one logical handler, and the sender cares that it gets done. Losing it is a business incident.
- **Events (notifications).** "Stock for SKU 123 dropped below 10." A fact about the past. The publisher does not know or care who listens. Zero, one or fifteen subscribers are all fine.
- **Streams (telemetry).** "User viewed product, user scrolled, user added to cart" times a few million per hour. Individually worthless, valuable in aggregate, and you often want to replay them later.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Isn't that just naming? A command is a JSON blob, an event is a JSON blob. Why not push everything through one service and be done?</span>
    </div>
  </div>
</div>

Because the guarantees you need are different, and each service is optimized for one set of guarantees. A command needs to be locked while one worker processes it, retried on failure, and parked somewhere safe if it keeps failing. An event needs to be fanned out to many subscribers, pushed to them quickly and filtered so nobody gets noise. A stream needs raw throughput, partitioning and the ability to rewind. You *can* force one service to do all three, the same way you *can* use a spreadsheet as a database. You will pay for it in custom code and 3 a.m. pages.

So the mapping for Azure is:

| Meaning | Azure service | Mental model |
|---------|---------------|--------------|
| Command / business transaction | **Service Bus** | A registered letter: tracked, signed for, returned if undeliverable |
| Discrete "something happened" | **Event Grid** | A doorbell: rings once for everyone at home, then it is done |
| High-volume telemetry / stream | **Event Hubs** | A security camera recording: continuous, rewindable, watched by many |

## Deep Dive / Architectural Design

### The store, mapped to three services

Here is the purchase flow with each service doing what it is good at:

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

**Payment is a command.** It goes to a Service Bus queue. Several instances of the Payments service compete for messages (the *competing consumers* pattern), each message is locked while processed (PeekLock), and a failure makes it visible again. After too many attempts it lands in the **dead-letter queue** instead of looping forever.

**"Order placed" fanned out to internal services** can use a Service Bus **topic** with subscriptions. Each subscription is its own durable queue with its own filter, so Fraud Review only sees orders above a threshold. Use a topic when the subscribers are your own services and you still want Service Bus guarantees: durability, dead-lettering, sessions and transactions.

**"Stock is low" is an event.** Inventory publishes it to Event Grid and forgets about it. Event Grid pushes it to every matching subscriber (a webhook, an Azure Function, a Service Bus queue), with filtering by event type, subject or payload fields, and supports the CloudEvents 1.0 schema. Event Grid is also how Azure itself tells you things: a blob was created, a resource was deleted, a Key Vault secret is about to expire.

**Clicks are a stream.** They go to Event Hubs, which appends them to partitions. Each consumer group reads the whole stream independently, keeps its own position (checkpoint) and can rewind within the retention window. Event Hubs also exposes a Kafka-compatible endpoint, so existing Kafka producers and consumers can talk to it with configuration changes instead of rewrites.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Service Bus topics and Event Grid both do pub/sub with filters. Aren't they the same thing?</span>
    </div>
  </div>
</div>

They overlap, but the delivery model is opposite. Service Bus is **pull**: subscribers connect and fetch messages when they are ready, and messages wait in the subscription for as long as the entity's time-to-live allows. Event Grid is **push**: it calls your endpoint and retries with backoff if you fail, and after the retry policy is exhausted the event is dropped or sent to a dead-letter storage container if you configured one. Rule of thumb: if a subscriber being down for an hour must not lose anything and needs ordered, transactional processing, use a Service Bus topic. If you want lightweight, reactive fan-out (often across teams or from Azure resources themselves), use Event Grid. A very common combo is Event Grid pushing into a Service Bus queue, so you get reactive routing plus durable, paced consumption.

### The comparison table

| | Service Bus | Event Grid | Event Hubs |
|---|---|---|---|
| Meaning | Commands, transactions | Discrete notifications | Telemetry, streams |
| Delivery model | Pull (AMQP), PeekLock or ReceiveAndDelete | Push (HTTP/webhook, Functions, queues) | Pull, consumers read partitions |
| Ordering | FIFO per session (sessions) | Not guaranteed | Per partition |
| Retention / replay | Until consumed or TTL expires; no replay after completion | Short retry window; no replay | Time-based retention; replay by offset or time |
| Dead-lettering | Built-in DLQ per queue/subscription | Optional, to a Blob Storage container | None; the consumer decides what to skip |
| Throughput profile | Moderate, per-message guarantees | Bursty, many small events | Very high, sustained ingestion |
| Consumers | Competing consumers or topic subscriptions | Many subscribers, each filtered | Many consumer groups, each reads everything |
| Extras | Transactions, duplicate detection, scheduled messages | CloudEvents, Azure system events, advanced filters | Kafka endpoint, Capture to storage, schema registry |

### Patterns that make it work

**Event notification vs event-carried state transfer.** A thin event says "order 4711 changed", and consumers call back to fetch details. It keeps payloads small, but it creates chatty coupling and a race: by the time you fetch, the state may have changed again. A fat event carries the relevant state ("order 4711, status Paid, total 349.90, items [...]"), so consumers can act without calling back. Event Grid favors thin-ish events (payload size is limited); Service Bus and Event Hubs handle fatter ones. Pick deliberately and version your schemas.

**The outbox pattern.** The classic bug: Orders writes to its database and then sends a message. If the process crashes between the two, you have an order nobody will charge. If you send first and the database write fails, you charge for an order that does not exist. The fix is to write the order **and** an "outbox" row in the same local database transaction, then have a relay (a background worker or change data capture) read the outbox and publish to Service Bus, marking rows as sent. Delivery becomes at-least-once, which leads straight to the next pattern.

**Idempotent consumers.** Every one of these services can deliver the same message more than once. A lock expires mid-processing, a consumer crashes after doing the work but before completing, Event Grid retries because your webhook answered too slowly. Consumers must tolerate duplicates: store processed message IDs (or a business key like `orderId + operation`) in the same transaction as the side effect, and skip what you have already seen. Service Bus duplicate detection helps on the send side within a time window, but it does not make your handler idempotent.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Can't I just turn on "exactly-once delivery" somewhere and skip all the idempotency stuff?</span>
    </div>
  </div>
</div>

Sadly, no checkbox makes a distributed system exactly-once end to end. Service Bus transactions give you atomicity *inside* the broker (receive, send and complete together within one namespace), but the moment your handler touches a database or calls a payment gateway, you are back to at-least-once. The practical target is "at-least-once delivery plus idempotent processing", which behaves like exactly-once from the business point of view.

## Hands-On Implementation

### Provisioning with Azure CLI

This creates the three pieces of the store. Names are illustrative.

```bash title="provision.sh"
RG=rg-shop-messaging
LOC=eastus2
SB=sb-shop-demo
EGT=egt-shop-inventory
EH=evh-shop-demo

az group create --name $RG --location $LOC

# Service Bus: Standard is the minimum tier for topics
az servicebus namespace create --resource-group $RG --name $SB --location $LOC --sku Standard

az servicebus queue create --resource-group $RG --namespace-name $SB --name payments \
  --max-delivery-count 5 \
  --enable-duplicate-detection true \
  --enable-dead-lettering-on-message-expiration true

az servicebus topic create --resource-group $RG --namespace-name $SB --name orders

az servicebus topic subscription create --resource-group $RG --namespace-name $SB \
  --topic-name orders --name high-value

# Replace the catch-all default rule with a SQL filter on an application property
az servicebus topic subscription rule delete --resource-group $RG --namespace-name $SB \
  --topic-name orders --subscription-name high-value --name '$Default'
az servicebus topic subscription rule create --resource-group $RG --namespace-name $SB \
  --topic-name orders --subscription-name high-value --name HighValue \
  --filter-sql-expression "TotalAmount > 1000"

# Event Grid: custom topic using the CloudEvents schema
az eventgrid topic create --resource-group $RG --name $EGT --location $LOC \
  --input-schema cloudeventschemav1_0

az servicebus queue create --resource-group $RG --namespace-name $SB --name purchasing

TOPIC_ID=$(az eventgrid topic show --resource-group $RG --name $EGT --query id -o tsv)
QUEUE_ID=$(az servicebus queue show --resource-group $RG --namespace-name $SB \
  --name purchasing --query id -o tsv)

# Push low-stock events into a Service Bus queue for durable, paced processing
az eventgrid event-subscription create --name stock-low-to-purchasing \
  --source-resource-id $TOPIC_ID \
  --endpoint-type servicebusqueue --endpoint $QUEUE_ID \
  --included-event-types shop.inventory.stock.low \
  --advanced-filter data.quantityOnHand NumberLessThan 10

# Event Hubs: capacity = throughput units on the Standard tier
az eventhubs namespace create --resource-group $RG --name $EH --location $LOC \
  --sku Standard --capacity 2

az eventhubs eventhub create --resource-group $RG --namespace-name $EH --name clickstream \
  --partition-count 8 --cleanup-policy Delete --retention-time 72

az eventhubs eventhub consumer-group create --resource-group $RG --namespace-name $EH \
  --eventhub-name clickstream --name analytics
```

No connection strings anywhere. Grant your app's managed identity data-plane roles instead: `Azure Service Bus Data Sender` / `Azure Service Bus Data Receiver`, `EventGrid Data Sender` and `Azure Event Hubs Data Sender` / `Azure Event Hubs Data Receiver`, scoped as narrowly as you can (a single queue or event hub beats the whole namespace).

<div class="callout tip" data-title="Tip">
  <p>Once every client uses Entra ID, consider disabling local (SAS key) authentication on the namespaces. A leaked <code>RootManageSharedAccessKey</code> in a config file is one of the most common ways these systems get compromised, and you cannot leak a key that does not work.</p>
</div>

### Sending a command to Service Bus

The SDK clients are designed to be long-lived singletons. Create them once (via DI) and reuse them.

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
        // e.g. "sb-shop-demo.servicebus.windows.net"; managed identity in Azure, your az login locally
        _client = new ServiceBusClient(fullyQualifiedNamespace, new DefaultAzureCredential());
        _sender = _client.CreateSender("payments");
    }

    public Task SendAsync(ChargePayment command, CancellationToken ct = default)
    {
        var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(command))
        {
            // Stable ID so broker-side duplicate detection can drop resends
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

### Processing with PeekLock, completing and dead-lettering

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
            AutoCompleteMessages = false, // we settle explicitly
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
            // Poison message: retrying will never fix a malformed payload
            await args.DeadLetterMessageAsync(args.Message, "InvalidPayload", ex.Message);
            return;
        }

        if (command is null)
        {
            await args.DeadLetterMessageAsync(args.Message, "InvalidPayload", "Empty body");
            return;
        }

        // Idempotent: the payment service keys the charge on OrderId and ignores repeats
        await _payments.ChargeOnceAsync(command, args.CancellationToken);

        await args.CompleteMessageAsync(args.Message);
        // Transient exceptions bubble up: the lock is released, the message is retried,
        // and after MaxDeliveryCount attempts Service Bus moves it to the DLQ for us.
    }
}

// Your domain service. ChargeOnceAsync must be idempotent per OrderId.
public interface IPaymentService
{
    Task ChargeOnceAsync(ChargePayment command, CancellationToken ct);
}
```

Two settlement paths, two intentions. Throwing (or calling `AbandonMessageAsync`) says "try again later", which is right for a timeout. Dead-lettering says "this will never succeed as is", which is right for bad data. Mixing them up is how you get a poison message burning five retries on every deploy.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>I need payments for the same customer processed in order. I'll just set MaxConcurrentCalls to 1, right?</span>
    </div>
  </div>
</div>

That gives you ordering by giving up all parallelism, for every customer, forever. Use **sessions** instead: enable `--enable-session true` on the queue, set `SessionId = customerId` on each message, and consume with `client.CreateSessionProcessor(...)`. Service Bus guarantees FIFO within a session and locks a session to one consumer at a time, while different sessions are processed in parallel. You pay only for the ordering you actually need.

### Publishing a CloudEvent to Event Grid

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

Copy the real endpoint from `az eventgrid topic show --query endpoint`; the regional suffix varies.

### Streaming clicks into Event Hubs

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
        // Same partition key => same partition => ordered per session
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

On the reading side, use `EventProcessorClient` (from `Azure.Messaging.EventHubs.Processor`) with a Blob Storage container for checkpoints, one processor per consumer group. It balances partitions across instances and remembers where each one stopped.

## Production Reality Check

**Poison messages will happen.** A schema change ships in one service before the other, and suddenly every message fails. Set a sensible max delivery count, dead-letter explicitly on non-retryable errors, and treat the DLQ as a real queue: alert on its message count, build a small tool to inspect and resubmit, and never let it grow silently. For Event Grid, configure a dead-letter container on every subscription that matters; without it, events that exhaust retries are simply gone.

**Duplicates are normal, not a bug.** Design every consumer to be idempotent from day one. Retrofitting it after the first double shipment is much more expensive.

**Ordering is not free.** Sessions reduce parallelism to the number of active sessions, and a single hot session (one giant B2B customer) becomes a bottleneck. In Event Hubs, the partition key decides the partition; a skewed key (a `country` field where most traffic comes from one country) creates a **hot partition** that caps your throughput no matter how many units you buy. Choose high-cardinality keys, and only ask for ordering where the business actually needs it.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If a partition gets hot, I'll just add more partitions later, no big deal.</span>
    </div>
  </div>
</div>

Depending on the tier, the partition count may be fixed at creation, and even where you can increase it, existing key-to-partition mapping changes, which breaks per-key ordering during the transition. Size partitions for the peak parallelism you expect from your consumers, and fix the key distribution rather than hoping more partitions will dilute it.

**Watch the right metrics.** For Service Bus: active message count, dead-lettered message count, and message age (a growing backlog is the earliest sign of trouble). For Event Hubs: incoming vs outgoing throughput, throttled requests, and consumer lag per partition. For Event Grid: delivery failures, dropped and dead-lettered events. Wire these into Azure Monitor alerts, not dashboards nobody opens.

**Tiers, described qualitatively.** Service Bus **Basic** offers queues only, no topics and no sessions. **Standard** adds topics, sessions, transactions and duplicate detection on shared, pay-per-operation infrastructure, which means noisy neighbors and variable latency. **Premium** gives you dedicated capacity (messaging units), predictable performance, larger messages, and features like private endpoints. Event Hubs scales with **throughput units** on Standard, **processing units** on Premium, and dedicated clusters beyond that; Basic has tighter limits (fewer consumer groups, shorter retention, no Kafka endpoint). Event Grid charges per operation. Limits and prices change, so check the current Azure documentation before you size anything.

<div class="callout warning" data-title="Warning">
  <p>Private networking is often tier-gated. Service Bus private endpoints require <strong>Premium</strong>, and each service has its own rules for private endpoints, IP firewalls and trusted-service access. If your landing zone forbids public endpoints, validate tier support <strong>before</strong> you build on Standard, not during the security review.</p>
</div>

**Combine, do not compromise.** The mature architecture rarely uses just one of these. Service Bus carries the commands that move money and stock, Event Grid spreads the "this happened" signals (including the ones Azure emits about your own resources), and Event Hubs soaks up the firehose for analytics. Decide by meaning, make every consumer idempotent, publish through an outbox, and monitor your dead letters like they owe you money. They usually do.
