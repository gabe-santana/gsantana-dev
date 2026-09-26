---
title: "Building a Resilient .NET API with Polly: Retries, Circuit Breakers, and Timeouts"
description: "Resilience is a budget, not a pile of retries: retry only transient failures on idempotent calls with exponential backoff and jitter, and bound everything with a total timeout plus a per-attempt timeout. Add a circuit breaker so a failing dependency gets breathing room instead of a retry storm."
date: 2025-12-20
tags: [.NET, C#, Resilience, Polly]
---

Every distributed system has a dependency that fails at the worst possible moment. Usually it's not a dramatic crash. It's a pricing service that starts answering in 9 seconds instead of 90 milliseconds, or an inventory API that returns a 503 on one request out of every five. Your API didn't break, but it's about to, because of how it reacts.

This post is a hands-on guide to reacting well. We'll build an ASP.NET Core API on .NET 8 that calls a flaky downstream service, and protect it with Polly v8 and `Microsoft.Extensions.Http.Resilience`. The main idea to carry with you: resilience is a **budget**. You decide how much time and how many extra calls you're willing to spend on a failing dependency, and you spend it deliberately.

## The Problem & Context

Picture a product catalog API. For every product page, it calls an internal **pricing service** to get the current price for a SKU. The pricing service is owned by another team, runs on a shared database, and has bad days: deploys, GC pauses, a noisy neighbor hammering its database.

The first version of the client is the classic one:

```csharp title="PricingClient.cs"
using System.Net;

public sealed class PricingClient(HttpClient httpClient)
{
    public async Task<PriceQuote?> GetPriceAsync(string sku, CancellationToken ct)
    {
        using var response = await httpClient.GetAsync($"api/prices/{Uri.EscapeDataString(sku)}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PriceQuote>(ct);
    }
}

public sealed record PriceQuote(string Sku, decimal Amount, string Currency, DateTimeOffset AsOf);
```

Nothing wrong here on a sunny day. On a rainy day, two things happen. Every transient blip (a dropped connection, a 503 during a deploy) becomes a user facing error. And when the pricing service gets slow, each request to your API holds a connection and a slot for up to 100 seconds, which is the default `HttpClient.Timeout`. Requests pile up, your own latency explodes, and now **you** are the outage for whoever calls you.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Easy fix: wrap the call in a loop and try 5 times. If it works on the third try, the user never notices, right?</span>
    </div>
  </div>
</div>

That works for a single isolated blip, and it's exactly how outages get amplified. Think about what happens when the pricing service is struggling because it's overloaded. Your API receives 500 requests per second. With a naive 5x retry loop and no delay, each failing request turns into 6 calls. The pricing service, already drowning, now gets up to 3,000 requests per second from you alone. It was limping; you just pushed it off a cliff. This is a **retry storm**, and it's one of the most common ways a partial failure turns into a full one.

It gets worse with layers. If the browser retries, your API gateway retries, your API retries, and the pricing client retries, the multipliers compound. Three layers with 3 retries each means up to 4 × 4 × 4 = 64 calls hitting the bottom service for one user click.

So the question isn't "should I retry?". It's "which failures deserve a retry, how many, how spaced out, and when do I stop trying altogether?".

## Deep Dive / Architectural Design

### Transient vs non-transient failures

A retry only makes sense if the next attempt has a real chance of a different result. That splits failures into two families:

| Signal | Transient? | Why |
|--------|-----------|-----|
| `HttpRequestException` (connection reset, DNS hiccup) | Yes | Network blips often resolve in milliseconds |
| Timeout on a single attempt | Yes | Maybe you hit a slow instance or a GC pause |
| 500, 502, 503, 504 | Usually | The server or something in front of it is struggling |
| 408 Request Timeout | Yes | The server gave up waiting, try again |
| 429 Too Many Requests | Yes, carefully | Only after the `Retry-After` the server asks for |
| 400 Bad Request | No | Your payload is wrong; it will be wrong next time too |
| 401 / 403 | No | Credentials won't fix themselves in 200 ms |
| 404 Not Found | No | The SKU doesn't exist; that's an answer, not a failure |
| 501 Not Implemented | No | The endpoint will not start existing on retry |

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But what if I retry a 400 anyway? Worst case it fails again, no harm done.</span>
    </div>
  </div>
</div>

The harm is spent budget. Every pointless retry adds latency for the user, eats a connection, and adds load to a service that told you clearly "this request is invalid". Retrying a 400 is like re-sending an email to an address that bounced: the answer won't change, you're just annoying the mail server. Retry things that are **temporarily** wrong, never things that are **definitively** wrong.

### Idempotency: the other half of the question

Even a transient failure isn't always safe to retry. A timeout doesn't mean the operation didn't happen. It means **you don't know** whether it happened. For a `GET /api/prices/SKU-1`, that's fine: reading twice changes nothing. For a `POST /api/orders`, a retry after a timeout can create two orders and charge the customer twice.

Rule of thumb: retry GET, HEAD, PUT and DELETE (idempotent by design, if the server implements them correctly). Don't retry POST or PATCH unless the server supports an **idempotency key**, so it can recognize the second attempt as a duplicate of the first. We'll come back to this in the production section.

### The four strategies and why order matters

A resilient HTTP call combines four ideas:

1. **Total timeout**: the maximum time the caller is willing to wait for the whole operation, retries included. This is the budget.
2. **Retry**: re-execute on transient failures, with exponential backoff (200 ms, 400 ms, 800 ms...) plus **jitter** (random variation) so a thousand clients don't retry in perfect sync.
3. **Circuit breaker**: watch the failure ratio. When it crosses a threshold, stop calling the dependency for a while and fail fast. After the break, let a trial request through (half-open) and close the circuit if it succeeds.
4. **Per-attempt timeout**: the maximum time a single try can take, so one hung connection doesn't consume the whole budget.

In Polly v8, strategies are added from the outside in: the first one you add wraps everything after it. The recommended order is:

```text
request
  │
  ▼
┌─────────────────────────── Total timeout (8s) ───────────────────────────┐
│  ┌────────────────────── Retry (3x, exp + jitter) ─────────────────────┐ │
│  │  ┌────────────────── Circuit breaker (50% / 30s) ────────────────┐  │ │
│  │  │  ┌────────────── Per-attempt timeout (2s) ─────────────────┐  │  │ │
│  │  │  │                 HTTP call to pricing                    │  │  │ │
│  │  │  └─────────────────────────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

Each position has a reason:

- The **total timeout is outermost** because it must bound everything, including the waiting between retries. Without it, 4 attempts of 2 s plus backoff can quietly become 10 s while your caller gave up at 5 s.
- The **retry sits outside the breaker** so every attempt is recorded by the breaker. When the circuit opens, the breaker throws `BrokenCircuitException` immediately, and the retry should **not** handle that exception. The call fails fast instead of spinning.
- The **per-attempt timeout is innermost** so each try gets its own clock, and a timed out attempt is seen by the breaker as a failure and by the retry as a transient error.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why two timeouts? Just set one big timeout and let the retry figure it out.</span>
    </div>
  </div>
</div>

With only a big timeout, the first attempt can hang for the entire budget and there's no time left to retry, so the retry policy becomes decoration. With only a small per-attempt timeout, retries plus backoff have no ceiling, and the total time depends on luck. You need both: the small one makes each attempt fail fast, the big one guarantees the caller gets an answer (good or bad) within a known time.

Let's put numbers on our budget: total 8 s, per attempt 2 s, 3 retries with a 200 ms base delay. The worst case is 4 attempts × 2 s plus roughly 1.4 s of backoff, about 9.4 s. The total timeout cuts that at 8 s. That's the point: the budget is enforced by one number, not by hoping the math works out.

## Hands-On Implementation

You need .NET 8 and one package, which brings Polly v8 (`Polly.Core`) with it:

```bash title="terminal"
dotnet add package Microsoft.Extensions.Http.Resilience
```

### The quick path: the standard resilience handler

For most typed clients, start here. `AddStandardResilienceHandler` wires the full recommended pipeline (rate limiter, total timeout, retry, circuit breaker, attempt timeout) in the correct order, with sensible transient error detection and `Retry-After` support out of the box:

```csharp title="Program.cs"
using Microsoft.Extensions.Http.Resilience;
using Polly;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient<PricingClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Pricing:BaseUrl"]!);
})
.AddStandardResilienceHandler(options =>
{
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(8);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(2);

    options.Retry.MaxRetryAttempts = 3;
    options.Retry.Delay = TimeSpan.FromMilliseconds(200);
    options.Retry.BackoffType = DelayBackoffType.Exponential;
    options.Retry.UseJitter = true;
    options.Retry.DisableForUnsafeHttpMethods(); // no retries for POST, PATCH, etc.

    options.CircuitBreaker.FailureRatio = 0.5;
    options.CircuitBreaker.MinimumThroughput = 10;
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
    options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
});
```

Read the circuit breaker settings as a sentence: "in any 30 second window with at least 10 calls, if 50% or more fail, stop calling for 15 seconds". `MinimumThroughput` matters more than people think: without it, 1 failure out of 1 call at 3 AM is a 100% failure ratio.

<div class="callout info" data-title="Info">
  <p>The standard handler validates your options at startup. <code>SamplingDuration</code> must be at least twice <code>AttemptTimeout.Timeout</code>, and <code>TotalRequestTimeout</code> must be greater than the attempt timeout. If you get an <code>OptionsValidationException</code> on boot, that's why. It's a feature: it stops you from shipping a budget that doesn't add up.</p>
</div>

### The custom path: building the pipeline yourself

The standard handler is great until you need specific rules. Maybe you want 429 to be retried but not counted as a breaker failure, or you want to cap how long you'll honor a `Retry-After`. Then you build the pipeline yourself with `AddResilienceHandler`, which hands you a `ResiliencePipelineBuilder<HttpResponseMessage>`. I'll wrap it in an extension method so the same configuration is used by `Program.cs` and by the tests:

```csharp title="PricingResilience.cs"
using System.Net;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using Polly.Simmy;
using Polly.Timeout;

public static class PricingResilience
{
    public const string PipelineName = "pricing";
    private static readonly TimeSpan MaxHonoredRetryAfter = TimeSpan.FromSeconds(2);

    public static IHttpClientBuilder AddPricingResilience(
        this IHttpClientBuilder builder,
        TimeSpan? retryBaseDelay = null)
    {
        builder.AddResilienceHandler(PipelineName, (pipeline, context) =>
        {
            var logger = context.ServiceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("Pricing.Resilience");

            // 1. Total timeout: the budget for the whole operation, retries included.
            pipeline.AddTimeout(TimeSpan.FromSeconds(8));

            // 2. Retry: only transient failures, exponential backoff with jitter.
            pipeline.AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                Name = "pricing-retry",
                MaxRetryAttempts = 3,
                Delay = retryBaseDelay ?? TimeSpan.FromMilliseconds(200),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutRejectedException>()
                    .HandleResult(IsTransient),
                // Returning null falls back to the exponential backoff.
                DelayGenerator = args => ValueTask.FromResult(GetRetryAfter(args.Outcome.Result)),
                OnRetry = args =>
                {
                    logger.LogWarning(
                        "Pricing retry {Attempt} after {DelayMs} ms. Status: {Status}, error: {Error}",
                        args.AttemptNumber + 1,
                        args.RetryDelay.TotalMilliseconds,
                        (int?)args.Outcome.Result?.StatusCode,
                        args.Outcome.Exception?.GetType().Name);
                    return default;
                }
            });

            // 3. Circuit breaker: 429 is throttling, not sickness, so it doesn't count.
            pipeline.AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
            {
                Name = "pricing-breaker",
                FailureRatio = 0.5,
                MinimumThroughput = 10,
                SamplingDuration = TimeSpan.FromSeconds(30),
                BreakDuration = TimeSpan.FromSeconds(15),
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutRejectedException>()
                    .HandleResult(r => r.StatusCode is HttpStatusCode.RequestTimeout
                                       or >= HttpStatusCode.InternalServerError),
                OnOpened = args =>
                {
                    logger.LogError("Pricing circuit OPEN for {Seconds} s", args.BreakDuration.TotalSeconds);
                    return default;
                },
                OnHalfOpened = _ =>
                {
                    logger.LogInformation("Pricing circuit HALF-OPEN, sending a trial request");
                    return default;
                },
                OnClosed = _ =>
                {
                    logger.LogInformation("Pricing circuit CLOSED, dependency recovered");
                    return default;
                }
            });

            // 4. Per-attempt timeout: one hung connection can't eat the whole budget.
            pipeline.AddTimeout(TimeSpan.FromSeconds(2));
        });

        return builder;
    }

    private static bool IsTransient(HttpResponseMessage response) => response.StatusCode switch
    {
        HttpStatusCode.RequestTimeout => true,
        HttpStatusCode.TooManyRequests => (GetRetryAfter(response) ?? TimeSpan.Zero) <= MaxHonoredRetryAfter,
        HttpStatusCode.NotImplemented => false,
        >= HttpStatusCode.InternalServerError => true,
        _ => false
    };

    private static TimeSpan? GetRetryAfter(HttpResponseMessage? response)
    {
        var retryAfter = response?.Headers.RetryAfter;

        if (retryAfter?.Delta is TimeSpan delta)
            return delta;

        if (retryAfter?.Date is DateTimeOffset date && date > DateTimeOffset.UtcNow)
            return date - DateTimeOffset.UtcNow;

        return null;
    }
}
```

A few decisions worth calling out. The retry predicate doesn't mention `BrokenCircuitException`, so when the circuit is open the call fails immediately instead of retrying against a wall. A 429 whose `Retry-After` asks for more than 2 seconds is **not** retried: waiting 30 seconds inside an 8 second budget is pointless, so it's better to surface it to the caller right away. And `OnRetry` logs the attempt number, the delay and the reason, which is what you'll want at 3 AM.

Registering it replaces the standard handler, it doesn't sit next to it:

```csharp title="Program.cs"
builder.Services.AddMemoryCache();
builder.Services.AddProblemDetails();

builder.Services.AddHttpClient<PricingClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Pricing:BaseUrl"]!);
})
.AddPricingResilience();

builder.Services.AddScoped<PriceService>();
```

<div class="callout warning" data-title="Warning">
  <p>Don't chain <code>AddStandardResilienceHandler()</code> and <code>AddResilienceHandler(...)</code> on the same client. You get two retry layers, two breakers and a multiplied budget, which is exactly the retry storm we're trying to avoid. Pick one pipeline per client.</p>
</div>

### Graceful degradation when the circuit is open

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>OK, the circuit is open and Polly throws an exception. So I just let it bubble up as a 500, done?</span>
    </div>
  </div>
</div>

A 500 says "we have a bug", which isn't true: you have a sick dependency and a plan for it. The circuit breaker buys you time; the fallback decides what the user sees during that time. For prices, a recently cached value flagged as stale is often far better than an error page. When there's nothing cached, answer with a proper problem response: 503 with `Retry-After` for an open circuit, 504 for a timeout.

```csharp title="PriceService.cs"
using System.Net;
using Microsoft.Extensions.Caching.Memory;
using Polly.CircuitBreaker;
using Polly.Timeout;

public enum PriceStatus { Fresh, Stale, NotFound, CircuitOpen, TimedOut, Failed }

public sealed record PriceLookup(PriceStatus Status, PriceQuote? Quote = null);

public sealed record PriceResponse(PriceQuote Quote, bool IsStale);

public sealed class PriceService(PricingClient client, IMemoryCache cache, ILogger<PriceService> logger)
{
    public async Task<PriceLookup> GetAsync(string sku, CancellationToken ct)
    {
        var cacheKey = $"price:{sku}";

        try
        {
            var quote = await client.GetPriceAsync(sku, ct);
            if (quote is null)
                return new PriceLookup(PriceStatus.NotFound);

            // Last known good value, used as a fallback when pricing is down.
            cache.Set(cacheKey, quote, TimeSpan.FromMinutes(30));
            return new PriceLookup(PriceStatus.Fresh, quote);
        }
        catch (BrokenCircuitException ex)
        {
            return FromCacheOr(cacheKey, PriceStatus.CircuitOpen, ex);
        }
        catch (TimeoutRejectedException ex)
        {
            return FromCacheOr(cacheKey, PriceStatus.TimedOut, ex);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is null
                                              or HttpStatusCode.TooManyRequests
                                              or >= HttpStatusCode.InternalServerError)
        {
            return FromCacheOr(cacheKey, PriceStatus.Failed, ex);
        }
    }

    private PriceLookup FromCacheOr(string cacheKey, PriceStatus failure, Exception ex)
    {
        if (cache.TryGetValue(cacheKey, out PriceQuote? cached) && cached is not null)
        {
            logger.LogWarning(ex, "Serving stale price for {CacheKey} ({Failure})", cacheKey, failure);
            return new PriceLookup(PriceStatus.Stale, cached);
        }

        return new PriceLookup(failure);
    }
}
```

Notice what is **not** caught: a 400 or 401 from pricing still throws, because that's a bug or a misconfiguration on our side and should show up as a 500 in your error tracking. And an `OperationCanceledException` from the caller disconnecting also flows through untouched. The endpoint maps each status to the right HTTP answer:

```csharp title="Program.cs"
app.MapGet("/products/{sku}/price", async (string sku, PriceService prices, HttpResponse response, CancellationToken ct) =>
{
    var lookup = await prices.GetAsync(sku, ct);

    if (lookup.Status == PriceStatus.CircuitOpen)
        response.Headers.RetryAfter = "15";

    return lookup.Status switch
    {
        PriceStatus.Fresh => Results.Ok(new PriceResponse(lookup.Quote!, IsStale: false)),
        PriceStatus.Stale => Results.Ok(new PriceResponse(lookup.Quote!, IsStale: true)),
        PriceStatus.NotFound => Results.NotFound(),
        PriceStatus.CircuitOpen => Results.Problem(
            title: "Pricing temporarily unavailable",
            detail: "The pricing service is failing and calls are paused. Try again shortly.",
            statusCode: StatusCodes.Status503ServiceUnavailable),
        PriceStatus.TimedOut => Results.Problem(
            title: "Pricing timed out",
            statusCode: StatusCodes.Status504GatewayTimeout),
        _ => Results.Problem(
            title: "Pricing failed",
            statusCode: StatusCodes.Status502BadGateway)
    };
});
```

The `IsStale` flag lets the frontend show "price may be outdated" instead of pretending everything is fine. Honest degradation beats silent degradation.

### Testing the pipeline

Resilience code that has never seen a failure is a hypothesis. The cheapest way to test it is a fake `HttpMessageHandler` that returns a scripted sequence of responses, plugged in as the primary handler under the real pipeline:

```csharp title="ScriptedHandler.cs"
public sealed class ScriptedHandler(params Func<HttpResponseMessage>[] responses) : HttpMessageHandler
{
    private int _calls;
    public int Calls => _calls;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var index = Interlocked.Increment(ref _calls) - 1;
        var next = responses[Math.Min(index, responses.Length - 1)];
        return Task.FromResult(next());
    }
}
```

```csharp title="PricingResilienceTests.cs"
using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class PricingResilienceTests
{
    [Fact]
    public async Task Retries_transient_503_and_then_succeeds()
    {
        var handler = new ScriptedHandler(
            () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable),
            () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable),
            () => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new PriceQuote("SKU-1", 10m, "BRL", DateTimeOffset.UtcNow))
            });

        var quote = await BuildClient(handler).GetPriceAsync("SKU-1", CancellationToken.None);

        Assert.NotNull(quote);
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task Does_not_retry_a_400()
    {
        var handler = new ScriptedHandler(() => new HttpResponseMessage(HttpStatusCode.BadRequest));

        await Assert.ThrowsAsync<HttpRequestException>(
            () => BuildClient(handler).GetPriceAsync("SKU-1", CancellationToken.None));

        Assert.Equal(1, handler.Calls);
    }

    private static PricingClient BuildClient(HttpMessageHandler handler)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpClient<PricingClient>(c => c.BaseAddress = new Uri("https://pricing.test/"))
            .ConfigurePrimaryHttpMessageHandler(() => handler)
            .AddPricingResilience(retryBaseDelay: TimeSpan.FromMilliseconds(1));

        return services.BuildServiceProvider().GetRequiredService<PricingClient>();
    }
}
```

That's why `retryBaseDelay` is a parameter: tests run in milliseconds, production keeps its 200 ms. Add similar tests for "breaker opens after N failures" and "429 with a long `Retry-After` is not retried".

For a staging environment, Polly 8.3+ ships chaos strategies. Put them at the end of the pipeline (innermost), behind a config flag, and watch whether your API degrades the way you designed:

```csharp title="PricingResilience.cs"
// Inside AddResilienceHandler, after the per-attempt timeout. Never enabled in production.
if (context.ServiceProvider.GetService<IConfiguration>()?.GetValue<bool>("Chaos:Pricing") == true)
{
    pipeline.AddChaosLatency(0.1, TimeSpan.FromSeconds(3));
    pipeline.AddChaosOutcome(0.1, () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
}
```

### Observability

When Polly runs through `Microsoft.Extensions.Http.Resilience`, telemetry is on by default: resilience events are logged and published as metrics on the `Polly` meter (for example `resilience.polly.strategy.events`, tagged with the pipeline name, strategy name and event such as `OnRetry` or `OnCircuitOpened`). That's why naming your strategies (`pricing-retry`, `pricing-breaker`) pays off. Export them with OpenTelemetry:

```csharp title="Program.cs"
using OpenTelemetry.Metrics;

builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddMeter("Polly")
        .AddOtlpExporter());
```

The dashboards that matter: retries per second per pipeline (a rising line is an early warning, long before errors show up), circuit breaker opened events, and the ratio of stale responses served. If retries are always high, you don't have a resilience problem, you have a dependency problem hiding behind one.

## Production Reality Check

The code above is the easy part. These are the things that bite in real systems.

**Retries multiply across layers.** Map every hop that retries: SDKs, gateways, service meshes, message consumers, your own code. Ideally, retries happen at **one** layer, close to the failing call. If Envoy or your API Management already retries upstream calls, your client pipeline might need zero retries and only a breaker and timeouts.

**Your timeout must be shorter than your caller's timeout.** If the frontend gives up at 5 s and your total budget is 8 s, you'll keep working for 3 s on a response nobody will read, holding connections the whole time. Budgets shrink as you go deeper: each layer's total timeout should fit inside the layer above it. Also keep `HttpClient.Timeout` (100 s by default) above your total pipeline timeout so it doesn't cut in first with a confusing `TaskCanceledException`.

**429 is a conversation, not an error.** The server is telling you how fast you can go. Honor `Retry-After` (the standard handler does by default), don't count throttling as breaker failures, and if the requested wait exceeds your budget, fail fast and let the caller decide. Retrying a 429 early just gets you throttled longer.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>My POST to create an order timed out. Timeouts are transient, so the retry should handle it, right?</span>
    </div>
  </div>
</div>

Only if you enjoy explaining double charges to customers. The first POST may have succeeded; the timeout only means the response didn't reach you. Make the operation idempotent first: generate an idempotency key once per business operation, send it on every attempt, and have the server return the original result when it sees the same key again.

```csharp title="OrdersClient.cs"
public sealed class OrdersClient(HttpClient httpClient)
{
    public async Task<HttpResponseMessage> CreateOrderAsync(CreateOrder order, Guid idempotencyKey, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/orders")
        {
            Content = JsonContent.Create(order)
        };
        // Same key on every attempt: the server deduplicates.
        request.Headers.Add("Idempotency-Key", idempotencyKey.ToString());

        return await httpClient.SendAsync(request, ct);
    }
}

public sealed record CreateOrder(string Sku, int Quantity);
```

Without server support for that header, keep `DisableForUnsafeHttpMethods()` on and let the error surface.

**Thread pool and connection pool exhaustion.** A slow dependency doesn't just slow your requests, it hoards resources. Each waiting request keeps an outbound connection busy, and if anything in the call path blocks synchronously (`.Result`, `.Wait()`), it keeps a thread pool thread too. That's how a slow pricing service ends up freezing endpoints that never call pricing. Tight timeouts are your first defense; the circuit breaker is your second, because failing fast releases resources immediately. For hard isolation, cap concurrency per dependency (the standard handler includes a concurrency limiter you can tune through `options.RateLimiter`) so one sick service can only occupy its own slice of your capacity.

**Tune with data, not vibes.** Base the per-attempt timeout on the dependency's real latency (something like p99 plus a margin), not on a round number. Base breaker thresholds on normal error rates: if the service fails 2% of the time on a good day, a 10% threshold is a signal, 1% is noise. Revisit these numbers when traffic patterns change.

**Circuit breakers are per instance.** With 20 pods, you have 20 independent breakers, each learning on its own. That's usually fine, but don't expect a synchronized "the whole fleet stops calling pricing" moment, and keep `MinimumThroughput` realistic for the traffic a **single** pod sees.

The mindset shift is the whole lesson: stop thinking "how do I make this call succeed?" and start thinking "how much am I willing to spend when it doesn't, and what does the user see then?". Retries with backoff and jitter spend the budget wisely, timeouts cap it, the circuit breaker stops spending when it's hopeless, and the fallback turns a failure into a degraded but honest answer. That's a resilient API.
