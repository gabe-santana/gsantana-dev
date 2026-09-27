---
title: "Idempotency Keys in Practice: Making Payment-Style APIs Safe to Retry"
description: "Use idempotency keys to make timed-out POST retries safe from duplicate side effects."
date: 2026-06-30
tags: [APIs, Idempotency, .NET, C#]
tldr:
  - "The client sends one Idempotency-Key per business operation, and reuses it on every retry of that operation."
  - "The server atomically claims the key, fingerprints the request, stores the final response and replays it for repeats."
  - "Scope keys per account, keep them longer than any retry window, and forward derived keys to downstream providers."
---

A customer taps "Pay". Your API receives `POST /payments`, calls the payment provider, writes the result and starts sending back a `201 Created`. Somewhere between your server and the phone, the connection drops. The app sees a timeout, and its retry policy does exactly what it was built to do: it sends the request again. Your API, having no idea this is the same payment, charges the card a second time.

Nothing in that story is a bug in isolation. The bug lives in the gap between the pieces, and the standard fix is an idempotency key. This post covers the header convention, the server algorithm (including the concurrency part that's easy to get wrong) and a working ASP.NET Core implementation on .NET 10 with SQLite and xUnit tests. The Naive Junior is here too.

## The Problem & Context

HTTP methods come with semantics. GET, HEAD, PUT and DELETE are defined as idempotent: sending the same request twice leaves the server in the same state as sending it once. POST carries no such promise. Every POST can create something new, which is exactly what you want for "create a payment" and exactly what hurts when the request is repeated.

And requests are repeated all the time, often by code that is behaving correctly:

- **Client timeouts where the server succeeded.** A timeout means the client stopped waiting, not that the server stopped working. The charge may have gone through a millisecond after the client gave up.
- **Client retry policies.** Resilience libraries retry transient failures by design. In [Building a Resilient .NET API with Polly](/en-us/blog/resilient-dotnet-api-polly/) the advice was to disable retries for unsafe methods unless the server supports idempotency keys. This post is that server-side support.
- **Intermediaries.** Load balancers, API gateways and service meshes can be configured to retry upstream requests on connection errors, and depending on configuration they may not treat POST differently from GET.
- **Humans.** Double clicks, refreshes on a spinner, a "try again" button on a mobile app with a flaky connection.
- **Message redelivery.** Queues with at-least-once delivery will hand the same message to a consumer more than once.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Simple: never retry a POST. If it times out, show an error and let the user decide.</span>
    </div>
  </div>
</div>

That trades a double charge for a different problem: nobody knows whether the payment happened. The user sees an error, taps "Pay" again (a manual retry, same outcome), or gives up while the charge quietly succeeded and the order never ships. The real issue is not the retry, it's that the server can't tell a retry apart from a new request. Give it a way to do that and retries become safe, whether they come from Polly, a gateway or a thumb.

## Deep Dive / Architectural Design

### The Idempotency-Key header convention

The idea is simple. The client generates a unique value for each **business operation** (not for each attempt), sends it in an `Idempotency-Key` header, and reuses the same value on every retry of that operation. The server remembers which keys it has already processed and what it answered.

```http title="request"
POST /payments HTTP/1.1
Host: api.example.com
Content-Type: application/json
Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"

{"amount": 100.00, "currency": "BRL"}
```

Payment APIs such as Stripe popularized this pattern, and the IETF HTTPAPI working group has been standardizing it in a draft titled "The Idempotency-Key HTTP Header Field". The draft defines the header as a structured field string (hence the quotes above), recommends a random identifier such as a UUID, and describes the error cases: a missing key on an endpoint that requires one gets a 400, reusing a key with a different payload gets a 422, and a retry that arrives while the original request is still being processed gets a 409. The implementation below follows that guidance.

<div class="callout info" data-title="Info">
  <p>At the time of writing, the Idempotency-Key specification is still an Internet-Draft, not an RFC. Check the latest version before treating any detail as final, and document your own policy (required endpoints, key format, expiry) for API consumers.</p>
</div>

### The server algorithm

For every request to an endpoint that requires a key, the server does this:

<div id="idempotency-flow-slot"></div>

Four details make or break it.

**The fingerprint.** The key alone says "this is the same operation". The fingerprint checks that claim. It's a hash of the method, path, query string and body. If a client reuses a key with a different body, that's a client bug, and the server should say so loudly with a 422 rather than guess.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why hash the body at all? If the key matches, just replay what we stored. Less code.</span>
    </div>
  </div>
</div>

Picture a client that accidentally reuses one key for every payment of a session. Without a fingerprint, the second payment of R$ 250 gets the stored "201 Created" of the first payment of R$ 100. The client thinks it paid, the server never charged, and the discrepancy surfaces weeks later in reconciliation. The fingerprint turns a silent data bug into an immediate, obvious error.

**The atomic claim.** Two copies of the same request can arrive at the same time (a gateway retry racing the original, two instances behind a load balancer). If both check "does this key exist?" before either inserts, both see nothing and both charge. The claim must be a single atomic operation: an insert guarded by a unique constraint on `(scope, key)`. Exactly one insert wins; everyone else learns the key is taken.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Can't I do a SELECT first and only INSERT when nothing comes back? It reads more clearly.</span>
    </div>
  </div>
</div>

It reads clearly and fails under exactly the conditions idempotency exists for. Between your SELECT and your INSERT, another request can run its own SELECT and also see nothing. Check-then-act is a race unless the check and the act are one statement or one lock. Let the database enforce uniqueness, and treat "the insert changed zero rows" as the answer.

**What gets stored.** The winner marks the key `in_progress`, runs the handler, then records the final status code, the relevant headers (at least `Content-Type` and `Location`) and the body. Deterministic outcomes are stored: a 201 and also a 400 for an invalid amount, since retrying an invalid request will produce the same 400. Server errors are different. A 5xx or an unhandled exception often means something transient failed, and storing it would make the key permanently useless: every retry would replay the failure. So on 5xx the claim is released and the client may retry with the same key.

That choice has a precondition: releasing the key is only safe if the failed attempt did not leave a side effect behind. If the charge succeeded and the database write after it crashed, releasing the key invites a second charge. Hold that thought; it's the main topic of the production section.

**Scope and expiry.** Keys are unique per client, not globally. Two accounts can generate the same key (buggy generators, copy-pasted test fixtures), and they must not collide. Worse, a global key space lets one tenant receive another tenant's stored response. The scope must come from the authenticated identity.

<div class="callout warning" data-title="Warning">
  <p>Never let the client choose the scope. If the scope comes from a header the caller controls, anyone who guesses or observes a key can replay another account's stored response, including its body. Derive the scope from the authenticated principal (user, API client, tenant) on the server.</p>
</div>

Keys also need a time to live, and here the dangerous mistake is expiring too early. A key must outlive the longest window in which a retry of that operation can still arrive: client retry budgets, offline mobile queues, a job that resumes after a deploy. If the key expires after five minutes and the retry arrives after ten, the server treats it as a new payment. A common choice is 24 hours, which costs a little storage and buys a lot of safety. Whatever you choose, publish it.

## Hands-On Implementation

Here's the whole thing on .NET 10: a middleware that enforces the algorithm, a store abstraction, a SQLite implementation whose primary key does the atomic claim, a payments endpoint and xUnit tests.

```bash title="terminal"
dotnet new web -n Payments.Api
dotnet new xunit -n Payments.Api.Tests
dotnet add Payments.Api package Microsoft.Data.Sqlite --version 10.0.12
dotnet add Payments.Api.Tests reference Payments.Api/Payments.Api.csproj
dotnet add Payments.Api.Tests package Microsoft.AspNetCore.Mvc.Testing --version 10.0.12
```

Delete the template's `UnitTest1.cs`; the tests come later.

### The store contract

```csharp title="Payments.Api/Idempotency/IIdempotencyStore.cs"
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Payments.Api.Idempotency;

public enum ClaimOutcome
{
    Claimed,
    InProgress,
    Completed,
    FingerprintMismatch
}

public sealed record StoredResponse(int StatusCode, string? ContentType, string? Location, byte[] Body);

public sealed record ClaimResult(ClaimOutcome Outcome, StoredResponse? Response = null);

public interface IIdempotencyStore
{
    Task<ClaimResult> TryClaimAsync(string scope, string key, string fingerprint, TimeSpan ttl, CancellationToken ct);

    Task CompleteAsync(string scope, string key, StoredResponse response, CancellationToken ct);

    Task ReleaseAsync(string scope, string key, CancellationToken ct);
}
```

Three operations map directly to the flow: claim, complete, release. The middleware never sees SQL, so the backing store can change later.

### The SQLite store

```csharp title="Payments.Api/Idempotency/SqliteIdempotencyStore.cs"
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;

namespace Payments.Api.Idempotency;

public sealed class SqliteIdempotencyStore : IIdempotencyStore
{
    private readonly string _connectionString;
    private readonly TimeProvider _time;

    public SqliteIdempotencyStore(string connectionString, TimeProvider time)
    {
        _connectionString = connectionString;
        _time = time;

        using var connection = new SqliteConnection(_connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                scope        TEXT    NOT NULL,
                key          TEXT    NOT NULL,
                fingerprint  TEXT    NOT NULL,
                state        TEXT    NOT NULL CHECK (state IN ('in_progress', 'completed')),
                status_code  INTEGER NULL,
                content_type TEXT    NULL,
                location     TEXT    NULL,
                body         BLOB    NULL,
                created_at   INTEGER NOT NULL,
                expires_at   INTEGER NOT NULL,
                PRIMARY KEY (scope, key)
            );
            """;
        command.ExecuteNonQuery();
    }

    public async Task<ClaimResult> TryClaimAsync(string scope, string key, string fingerprint, TimeSpan ttl, CancellationToken ct)
    {
        var now = _time.GetUtcNow();
        await using var connection = await OpenAsync(ct);

        // The primary key is the lock: of N concurrent inserts, exactly one changes a row.
        // An expired row is taken over in the same statement, so there is no delete-then-insert race.
        await using (var claim = connection.CreateCommand())
        {
            claim.CommandText = """
                INSERT INTO idempotency_keys (scope, key, fingerprint, state, created_at, expires_at)
                VALUES ($scope, $key, $fingerprint, 'in_progress', $now, $expires)
                ON CONFLICT (scope, key) DO UPDATE SET
                    fingerprint  = excluded.fingerprint,
                    state        = 'in_progress',
                    status_code  = NULL,
                    content_type = NULL,
                    location     = NULL,
                    body         = NULL,
                    created_at   = excluded.created_at,
                    expires_at   = excluded.expires_at
                WHERE idempotency_keys.expires_at <= excluded.created_at;
                """;
            claim.Parameters.AddWithValue("$scope", scope);
            claim.Parameters.AddWithValue("$key", key);
            claim.Parameters.AddWithValue("$fingerprint", fingerprint);
            claim.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds());
            claim.Parameters.AddWithValue("$expires", now.Add(ttl).ToUnixTimeMilliseconds());

            if (await claim.ExecuteNonQueryAsync(ct) == 1)
                return new ClaimResult(ClaimOutcome.Claimed);
        }

        await using var select = connection.CreateCommand();
        select.CommandText = """
            SELECT fingerprint, state, status_code, content_type, location, body
            FROM idempotency_keys
            WHERE scope = $scope AND key = $key;
            """;
        select.Parameters.AddWithValue("$scope", scope);
        select.Parameters.AddWithValue("$key", key);

        await using var reader = await select.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return new ClaimResult(ClaimOutcome.InProgress); // released between our two statements: retry later

        if (reader.GetString(0) != fingerprint)
            return new ClaimResult(ClaimOutcome.FingerprintMismatch);

        if (reader.GetString(1) == "in_progress")
            return new ClaimResult(ClaimOutcome.InProgress);

        var response = new StoredResponse(
            StatusCode: reader.GetInt32(2),
            ContentType: reader.IsDBNull(3) ? null : reader.GetString(3),
            Location: reader.IsDBNull(4) ? null : reader.GetString(4),
            Body: reader.IsDBNull(5) ? [] : (byte[])reader.GetValue(5));

        return new ClaimResult(ClaimOutcome.Completed, response);
    }

    public async Task CompleteAsync(string scope, string key, StoredResponse response, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE idempotency_keys
            SET state = 'completed', status_code = $status, content_type = $contentType, location = $location, body = $body
            WHERE scope = $scope AND key = $key AND state = 'in_progress';
            """;
        command.Parameters.AddWithValue("$status", response.StatusCode);
        command.Parameters.AddWithValue("$contentType", (object?)response.ContentType ?? DBNull.Value);
        command.Parameters.AddWithValue("$location", (object?)response.Location ?? DBNull.Value);
        command.Parameters.AddWithValue("$body", response.Body);
        command.Parameters.AddWithValue("$scope", scope);
        command.Parameters.AddWithValue("$key", key);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task ReleaseAsync(string scope, string key, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM idempotency_keys WHERE scope = $scope AND key = $key AND state = 'in_progress';";
        command.Parameters.AddWithValue("$scope", scope);
        command.Parameters.AddWithValue("$key", key);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken ct)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }
}
```

The interesting part is the upsert. `INSERT ... ON CONFLICT DO UPDATE ... WHERE` is one atomic statement: it inserts a fresh row, or takes over an **expired** row, and otherwise changes nothing. One changed row means "you own this key"; zero means someone else does, and the follow-up SELECT tells us whether that someone used a different body, is still running, or already finished. Microsoft.Data.Sqlite retries on a busy database until the command timeout, so concurrent writers wait instead of failing.

### The middleware

```csharp title="Payments.Api/Idempotency/IdempotencyMiddleware.cs"
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace Payments.Api.Idempotency;

public sealed class RequireIdempotencyKeyMetadata;

public sealed class IdempotencyOptions
{
    public TimeSpan KeyTtl { get; set; } = TimeSpan.FromHours(24);

    public int MaxKeyLength { get; set; } = 255;

    // Demo only: in production, derive the scope from the authenticated principal, never from a header the client controls.
    public Func<HttpContext, string?> ResolveScope { get; set; } =
        context => context.Request.Headers["X-Account-Id"].ToString() is { Length: > 0 } account ? account : null;
}

public sealed class IdempotencyMiddleware(RequestDelegate next, IIdempotencyStore store, IOptions<IdempotencyOptions> options)
{
    public const string HeaderName = "Idempotency-Key";
    internal const string ItemKey = "idempotency.scoped-key";

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.GetEndpoint()?.Metadata.GetMetadata<RequireIdempotencyKeyMetadata>() is null)
        {
            await next(context);
            return;
        }

        var settings = options.Value;
        // The draft defines the value as a structured-field string ("abc"), but many clients send it bare.
        var key = context.Request.Headers[HeaderName].ToString().Trim().Trim('"');
        if (key.Length == 0 || key.Length > settings.MaxKeyLength)
        {
            await ProblemAsync(context, StatusCodes.Status400BadRequest, "This endpoint requires a valid Idempotency-Key header.");
            return;
        }

        var scope = settings.ResolveScope(context);
        if (scope is null)
        {
            await ProblemAsync(context, StatusCodes.Status401Unauthorized, "Unknown account.");
            return;
        }

        var fingerprint = await FingerprintAsync(context.Request, context.RequestAborted);
        var claim = await store.TryClaimAsync(scope, key, fingerprint, settings.KeyTtl, context.RequestAborted);

        switch (claim.Outcome)
        {
            case ClaimOutcome.FingerprintMismatch:
                await ProblemAsync(context, StatusCodes.Status422UnprocessableEntity,
                    "This Idempotency-Key was already used with a different request.");
                return;
            case ClaimOutcome.InProgress:
                context.Response.Headers.RetryAfter = "1";
                await ProblemAsync(context, StatusCodes.Status409Conflict,
                    "A request with this Idempotency-Key is still being processed.");
                return;
            case ClaimOutcome.Completed:
                await ReplayAsync(context, claim.Response!);
                return;
        }

        context.Items[ItemKey] = $"{scope}:{key}";
        await ExecuteAndRecordAsync(context, scope, key);
    }

    private async Task ExecuteAndRecordAsync(HttpContext context, string scope, string key)
    {
        var originalBody = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);
        }
        catch
        {
            // No trustworthy outcome to replay, so free the key and let a retry run the handler again.
            await store.ReleaseAsync(scope, key, CancellationToken.None);
            throw;
        }
        finally
        {
            context.Response.Body = originalBody;
        }

        var response = new StoredResponse(
            context.Response.StatusCode,
            context.Response.ContentType,
            context.Response.Headers.Location.ToString() is { Length: > 0 } location ? location : null,
            buffer.ToArray());

        // CancellationToken.None: the side effect already happened, so record it even if the client hung up.
        if (response.StatusCode >= 500)
            await store.ReleaseAsync(scope, key, CancellationToken.None);
        else
            await store.CompleteAsync(scope, key, response, CancellationToken.None);

        await originalBody.WriteAsync(response.Body);
    }

    private static async Task ReplayAsync(HttpContext context, StoredResponse stored)
    {
        context.Response.StatusCode = stored.StatusCode;
        context.Response.ContentType = stored.ContentType;
        if (stored.Location is not null)
            context.Response.Headers.Location = stored.Location;
        context.Response.Headers["Idempotent-Replayed"] = "true";
        await context.Response.Body.WriteAsync(stored.Body, context.RequestAborted);
    }

    private static async Task<string> FingerprintAsync(HttpRequest request, CancellationToken ct)
    {
        request.EnableBuffering();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Encoding.UTF8.GetBytes($"{request.Method} {request.Path}{request.QueryString}\n"));

        var chunk = new byte[8192];
        int read;
        while ((read = await request.Body.ReadAsync(chunk, ct)) > 0)
            hash.AppendData(chunk, 0, read);

        request.Body.Position = 0;
        return Convert.ToHexString(hash.GetHashAndReset());
    }

    private static Task ProblemAsync(HttpContext context, int statusCode, string detail) =>
        Results.Problem(detail: detail, statusCode: statusCode).ExecuteAsync(context);
}

public static class IdempotencyExtensions
{
    public static IApplicationBuilder UseIdempotency(this IApplicationBuilder app) =>
        app.UseMiddleware<IdempotencyMiddleware>();

    public static TBuilder RequireIdempotencyKey<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.WithMetadata(new RequireIdempotencyKeyMetadata());

    public static string? GetIdempotencyKey(this HttpContext context) =>
        context.Items[IdempotencyMiddleware.ItemKey] as string;
}
```

Why a middleware and not an endpoint filter? A filter sees the handler's `IResult`, but replaying needs the exact bytes that went out. The middleware swaps the response body for a `MemoryStream`, lets the endpoint write into it, stores the result, then copies it to the real stream. It only acts on endpoints tagged with `RequireIdempotencyKey()`, so the rest of the API pays nothing. `EnableBuffering` lets it hash the body and rewind it for model binding.

<div class="callout tip" data-title="Tip">
  <p>Record the outcome with <code>CancellationToken.None</code>, not with <code>RequestAborted</code>. The client disconnecting is the very scenario that triggers a retry. If recording is cancelled along with the request, the charge happens but the key stays <code>in_progress</code>, and the retry gets a 409 until the key expires instead of the original response.</p>
</div>

### The side effect and the endpoint

```csharp title="Payments.Api/Payments/PaymentGateway.cs"
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Payments.Api.Payments;

public sealed record ChargeRequest(decimal Amount, string Currency);

public sealed record Payment(Guid Id, decimal Amount, string Currency, string Status);

public interface IPaymentGateway
{
    // A real provider client sends idempotencyKey on its own outgoing request.
    Task<Payment> ChargeAsync(ChargeRequest request, string idempotencyKey, CancellationToken ct);
}

// Counts every call, so tests can prove how many times the side effect actually ran.
public sealed class FakePaymentGateway(TimeSpan latency) : IPaymentGateway
{
    private int _charges;

    public int Charges => Volatile.Read(ref _charges);

    public async Task<Payment> ChargeAsync(ChargeRequest request, string idempotencyKey, CancellationToken ct)
    {
        Interlocked.Increment(ref _charges);
        await Task.Delay(latency, ct);
        return new Payment(Guid.NewGuid(), request.Amount, request.Currency, "succeeded");
    }
}
```

```csharp title="Payments.Api/Program.cs"
using System;
using System.IO;
using System.Threading;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Payments.Api.Idempotency;
using Payments.Api.Payments;

var builder = WebApplication.CreateBuilder(args);

var dbPath = builder.Configuration["Idempotency:DatabasePath"] ?? Path.Combine(AppContext.BaseDirectory, "idempotency.db");

builder.Services.AddProblemDetails();
builder.Services.AddOptions<IdempotencyOptions>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IIdempotencyStore>(sp =>
    new SqliteIdempotencyStore($"Data Source={dbPath}", sp.GetRequiredService<TimeProvider>()));
builder.Services.AddSingleton<IPaymentGateway>(new FakePaymentGateway(TimeSpan.FromMilliseconds(50)));

var app = builder.Build();

app.UseRouting();
app.UseIdempotency();

app.MapPost("/payments", async (ChargeRequest request, HttpContext context, IPaymentGateway gateway, CancellationToken ct) =>
{
    if (request.Amount <= 0)
        return Results.Problem(detail: "Amount must be positive.", statusCode: StatusCodes.Status400BadRequest);

    // Forward a key derived from ours, so a retry that reaches the provider is deduplicated there too.
    var payment = await gateway.ChargeAsync(request, $"charge:{context.GetIdempotencyKey()}", ct);
    return Results.Created($"/payments/{payment.Id}", payment);
})
.RequireIdempotencyKey();

app.Run();

public partial class Program;
```

`UseRouting()` comes before `UseIdempotency()` so the middleware can read the matched endpoint's metadata. The handler knows nothing about deduplication beyond forwarding a derived key.

### Proving it with tests

`WebApplicationFactory` runs the real pipeline in memory. Each test gets its own SQLite file and a fake gateway with 200 ms of latency, long enough for concurrent requests to overlap.

```csharp title="Payments.Api.Tests/IdempotencyTests.cs"
using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Payments.Api.Idempotency;
using Payments.Api.Payments;
using Xunit;

namespace Payments.Api.Tests;

public sealed class IdempotencyTests : IDisposable
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"idempotency-{Guid.NewGuid():N}.db");
    private readonly FakePaymentGateway _gateway = new(TimeSpan.FromMilliseconds(200));
    private readonly WebApplicationFactory<Program> _factory;

    public IdempotencyTests()
    {
        var store = new SqliteIdempotencyStore($"Data Source={_dbPath};Pooling=False", TimeProvider.System);
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(web =>
            web.ConfigureTestServices(services =>
            {
                services.AddSingleton<IIdempotencyStore>(store);
                services.AddSingleton<IPaymentGateway>(_gateway);
            }));
    }

    [Fact]
    public async Task Replay_returns_the_stored_response_without_charging_again()
    {
        var client = _factory.CreateClient();

        using var first = await client.SendAsync(Charge("key-1", 100m));
        using var second = await client.SendAsync(Charge("key-1", 100m));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await second.Content.ReadAsStringAsync());
        Assert.Equal(first.Headers.Location, second.Headers.Location);
        Assert.True(second.Headers.Contains("Idempotent-Replayed"));
        Assert.Equal(1, _gateway.Charges);
    }

    [Fact]
    public async Task Same_key_with_a_different_body_is_rejected()
    {
        var client = _factory.CreateClient();

        using var first = await client.SendAsync(Charge("key-2", 100m));
        using var second = await client.SendAsync(Charge("key-2", 250m));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, second.StatusCode);
        Assert.Equal(1, _gateway.Charges);
    }

    [Fact]
    public async Task Concurrent_duplicates_charge_exactly_once()
    {
        var client = _factory.CreateClient();

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 10).Select(_ => client.SendAsync(Charge("key-3", 100m))));
        var statuses = responses.Select(r => r.StatusCode).ToList();

        Assert.Equal(1, _gateway.Charges);
        Assert.Contains(HttpStatusCode.Created, statuses);
        Assert.All(statuses, s => Assert.True(s is HttpStatusCode.Created or HttpStatusCode.Conflict, $"unexpected {s}"));
    }

    [Fact]
    public async Task Keys_are_scoped_per_account()
    {
        var client = _factory.CreateClient();

        using var first = await client.SendAsync(Charge("key-4", 100m, account: "acct_a"));
        using var second = await client.SendAsync(Charge("key-4", 100m, account: "acct_b"));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, _gateway.Charges);
    }

    [Fact]
    public async Task Missing_key_is_rejected_before_any_charge()
    {
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/payments")
        {
            Content = JsonContent.Create(new ChargeRequest(100m, "BRL"))
        };
        request.Headers.Add("X-Account-Id", "acct_a");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _gateway.Charges);
    }

    private static HttpRequestMessage Charge(string key, decimal amount, string account = "acct_a")
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/payments")
        {
            Content = JsonContent.Create(new ChargeRequest(amount, "BRL"))
        };
        request.Headers.Add(IdempotencyMiddleware.HeaderName, key);
        request.Headers.Add("X-Account-Id", account);
        return request;
    }

    public void Dispose()
    {
        _factory.Dispose();
        SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-wal", "-shm" })
            File.Delete(_dbPath + suffix);
    }
}
```

```bash title="terminal"
dotnet test Payments.Api.Tests
```

All five tests pass. The concurrency test is the one worth rereading: ten identical requests fire at once, the gateway is called exactly once, and every other request gets either a 409 (still in progress) or the replayed 201.

## Production Reality Check

The middleware is a solid baseline. These are the gaps that matter at scale.

### Put the key and the side effect in one transaction

The middleware stores the key in one place and the handler writes the payment somewhere else. If the process dies between the payment commit and `CompleteAsync`, the key stays `in_progress` while the payment exists. When the side effect is a write to **your own** database, the stronger design moves the claim into the same transaction as the business write, so both commit or neither does:

```sql title="transactional-claim.sql (excerpt)"
BEGIN;
INSERT INTO idempotency_keys (scope, key, fingerprint, state, created_at, expires_at)
VALUES (@scope, @key, @fingerprint, 'in_progress', @now, @expires);   -- unique violation: stop, it's a duplicate
INSERT INTO payments (id, account_id, amount, currency) VALUES (@id, @scope, @amount, @currency);
UPDATE idempotency_keys
SET state = 'completed', status_code = 201, body = @body
WHERE scope = @scope AND key = @key;
COMMIT;
```

In practice that means the handler (or a unit of work around it) owns the claim instead of a generic middleware. Releasing the key on failure also becomes safe for free, because a rollback undoes the payment row too.

### Downstream calls need idempotency too

A payment provider is not in your transaction, and no amount of local cleverness fixes that. The fix is to pass the problem down: send a key derived from yours (`charge:{scope}:{key}` in the example) on the provider call. Now a retry after a crash, whether from your code, your Polly pipeline or a replayed message, reaches a provider that also deduplicates. This is what makes "release the key on 5xx" defensible when the side effect is remote: even if the charge actually happened, the retry with the same derived key gets the original charge back instead of a new one.

### Stuck in-progress claims

If a process crashes mid-request, its row sits in `in_progress` until it expires, and every retry receives a 409. For a 24 hour TTL, that's too long. Add a lease (`locked_until`) that a new request may take over once it passes, and make it comfortably longer than your slowest legitimate request. Reclaiming a lease while the original request is actually still running is the risk you accept, and the downstream key is what limits the damage.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>SQLite in production? I'd just keep the keys in a ConcurrentDictionary on each instance. Way faster.</span>
    </div>
  </div>
</div>

Faster, and wrong as soon as you run a second instance. The retry that matters most is the one that lands on a different instance than the original, because the load balancer spreads connections. It also vanishes on every deploy or restart, which is when retries spike. The store must be shared and durable: your main relational database (ideal when you want the transactional claim), or Redis with `SET key value NX PX ttl` for the claim if you accept its durability trade-offs. SQLite here is a stand-in that makes the atomic claim easy to see and test.

### Smaller things that bite

- **Byte-level fingerprints.** Hashing raw bytes means a retry that re-serializes JSON with different whitespace or property order is treated as a different request. Clients should resend the exact same body; if you can't guarantee that, fingerprint a canonical form of the parsed payload.
- **Cleanup.** Expired rows don't delete themselves. Run a periodic job that removes rows past `expires_at`, and cap the stored body size.
- **Replay fidelity.** Store the headers clients depend on (`Location`, `Content-Type`, maybe an ETag), not per-request ones like trace ids.
- **Observability.** Count claims, replays, 409s and 422s. A spike in 422s usually means a client is reusing keys.

Idempotency keys turn "did my payment go through?" into a question the server answers the same way every time. The client owns one key per operation; the server claims it atomically, checks the fingerprint, stores the final answer and keeps it longer than anyone could retry. Add a derived key on the provider call, and a dropped connection becomes a non-event instead of a refund ticket.
