---
title: "The Strangler Fig Migration Blueprint: Moving a Monolith to the Cloud Without a Big Bang"
description: "Migrate a monolith one route at a time, with clear data ownership and a rollback for each slice."
date: 2026-06-14
tags: [Cloud Architecture, Migration, Strangler Fig, .NET, YARP]
tldr:
  - "Big-bang rewrites chase a moving target and deliver nothing until the end; a strangler fig migration ships value one route at a time."
  - "A facade routes each slice to the monolith or the new service, with sticky percentage canaries and a config-only rollback per route."
  - "Data is the real migration: use CDC and an anti-corruption layer, avoid dual writes, and delete the old code once a route stays flipped."
---

Every monolith migration pitch has the same slide. On the left, one huge deployable and a database with four hundred tables. On the right, clean services and managed databases. Between them, a single arrow labeled "rewrite". The arrow is where projects go to die.

This post is the alternative to the arrow: why big-bang rewrites fail, how the strangler fig pattern replaces them with small, reversible moves, how to handle the data, and a working .NET 10 facade built with YARP, with a sticky canary, a one-line rollback and a tested anti-corruption layer. The Naive Junior has questions along the way.

## The Problem & Context

A big-bang rewrite freezes the old system, rebuilds everything in parallel, and switches over on a chosen weekend. It sounds clean. In practice it fails in predictable ways:

- **The target keeps moving.** The business doesn't stop while you rewrite. Every feature added to the monolith during the project must also exist in the new system before launch, so the finish line recedes as you run toward it.
- **Nothing ships until the end.** Months of work produce zero production value and zero production feedback. You learn whether the new system handles real traffic on the day you can least afford to be wrong.
- **The old system is the only full specification.** Nobody knows every rule buried in it, like the discount that applies only to invoices created before a certain date. The rewrite misses some, and you discover which ones after cutover.
- **Rollback is all or nothing.** If the cutover goes badly, the only way back is to switch everything back, often after data has already diverged.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But the old code is so bad. Wouldn't it be faster to start fresh with a clean design and not carry any of that baggage?</span>
    </div>
  </div>
</div>

Faster to start, yes. Faster to finish, almost never. The "baggage" is years of bug fixes and business rules that exist for reasons nobody wrote down. A fresh design throws those away with the ugly code, then rediscovers them one production incident at a time. The goal is to replace the old code without betting everything on a single weekend.

### Where the name comes from

Martin Fowler named the pattern in 2004 after the strangler figs he saw in the rainforests of Queensland, Australia. The fig starts in the upper branches of a host tree, sends roots down to the ground, and gradually grows around the host until it stands on its own. He first called it "Strangler Application" and later renamed it "Strangler Fig Application" to make the metaphor clearer.

In software: you build the new system around the edges of the old one, move functionality over piece by piece while both run in production, and eventually the monolith has nothing left to do. At every point in between, the system works.

## Deep Dive / Architectural Design

The pattern has three moving parts: a **facade** that decides where each request goes, **new services** that take over slices of functionality, and a **data strategy** that lets each slice own its data without breaking the monolith.

```text title="request flow"
                        clients (web, mobile, partners)
                                      |
                                      v
                   +--------------------------------------+
                   |  facade: gateway / reverse proxy     |
                   |  route table, canary %, rollback     |
                   +--------------------------------------+
                      |                              |
         /api/orders/*, everything else        /api/customers/*
                      |                    (10% modern, 90% legacy)
                      v                              v
              +---------------+            +--------------------+
              |   monolith    |            |  customers service |
              |               |            |  + anti-corruption |
              +-------+-------+            |    layer           |
                      |                    +---------+----------+
                      v                              ^
              +---------------+      CDC events      |
              |  legacy DB    |----------------------+
              +---------------+
```

### The facade

Start by putting a reverse proxy in front of the monolith and routing 100% of traffic through it **before** you migrate anything. On day one it forwards every path to the monolith and changes nothing, which is the point: you've inserted the control point without changing behavior. From then on, moving a slice means changing a route, not changing clients.

In Azure, API Management gives you policies and versioning, and Application Gateway does path-based routing at layer 7. YARP is a .NET library for building your own proxy when routing needs real code. NGINX's `split_clients` directive does hash-based percentage splits, and an AWS Application Load Balancer supports weighted target groups. Pick the one your team already operates.

Keep the facade thin: it routes, splits traffic and adds headers. Once it starts transforming payloads or holding business rules, it becomes a new monolith in the middle of your architecture.

### Choosing the first slice

The first slice teaches the team how to migrate, so choose it for learning, not for glory. Good candidates are:

- **Low risk.** A failure is annoying, not a revenue event. Customer profile reads, not payment capture.
- **Clear seams.** A distinct set of URLs and a small set of tables. If it touches thirty tables through shared stored procedures, it's not first.
- **Read-heavy.** Reads can come from a replicated copy while writes stay in the monolith, which postpones the hardest problem (write ownership).
- **Actively changing.** A slice the business wants to evolve delivers visible value early.

### The anti-corruption layer

The new service shouldn't adopt the monolith's model just because the data comes from there. Eric Evans described the **anti-corruption layer** in *Domain-Driven Design*: a translation boundary between a legacy model and your new domain model, so legacy concepts (cryptic status codes, names stored as `"SANTOS, ANA"` in a padded CHAR column, dates as `"20190312"` strings) don't leak into new code. Every weird rule you discover goes into one translator with a test, instead of being rediscovered in five places.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Isn't the translator just throwaway code? Once the monolith is gone we delete it, so why bother testing it?</span>
    </div>
  </div>
</div>

It may live for years, and while it does it's where your new service can silently corrupt data. A translator that maps an unknown status code to "Active" instead of failing produces wrong answers for every row it doesn't understand. Test it hard, make it reject what it can't translate faithfully, and yes, delete it with the monolith.

### Data: the actual migration

Routing is the easy part. The question that decides the migration is: **who owns each piece of data, and how does it move?** The common strategies, roughly in order of how long they should last:

- **Shared database (temporary).** The new service reads the monolith's tables directly. It's the fastest start, but it couples the new service to the old schema: a column rename in the monolith breaks it, and you can't change the model. Treat it as scaffolding with an expiry date.
- **Change data capture.** Tools like Debezium, or the native CDC in SQL Server and other databases, read the transaction log and publish row changes as events. The new service consumes them through the ACL into its own store, without touching the monolith. The trade-off is eventual consistency, with a lag you need to measure.
- **Dual reads.** A comparison job reads from both stores and reports differences. It's how you prove the copy is correct before you trust it.
- **Moving write ownership.** Eventually writes for the slice move to the new service. The new store becomes the source of truth and, if the monolith still needs the data, changes flow back to it through events.

<div class="callout warning" data-title="Warning">
  <p>Avoid dual writes: code that writes to the old database and then the new one (or calls two services) in the same request. When the second write fails, the stores diverge, and there is no transaction spanning both. Write to one store and propagate the change: publish from that store's log with CDC, or use the transactional outbox pattern, where the event is inserted in the same local transaction as the data and a relay publishes it afterwards.</p>
</div>

### Shadow traffic, canaries and rollback

Before any user sees the new service, **shadow** it: copy real requests to it, discard its responses, and compare them with the monolith's. NGINX's `mirror` directive and service meshes like Istio support request mirroring. Shadow only reads, or send shadowed writes to an isolated store, or you'll charge a customer twice.

Then move real traffic with a **canary**: 1%, 5%, 25%, 100%. The split must be **sticky**: hash a stable key (user id, account id) so the same user always lands on the same side. Random per-request routing makes users bounce between implementations and produces bug reports nobody can reproduce.

Every migrated route also needs a **rollback that is one change**: flip the route (or set the canary to 0%) and traffic goes back to the monolith in seconds, without a deployment. That only works while the monolith can still serve the route, another reason to keep write ownership there until the new path has proven itself.

## Hands-On Implementation

We'll build a **Facade** (YARP reverse proxy), a stand-in **Legacy** monolith, a **Modern** customers service, a **Customers.Acl** library and a test project. The customers route runs as a 10% sticky canary, everything else goes to the monolith, and rolling back is a config edit. You need the .NET 10 SDK.

```bash title="terminal"
dotnet new sln -n StranglerFig
dotnet new web -n Facade -o Facade
dotnet new web -n Legacy -o Legacy
dotnet new web -n Modern -o Modern
dotnet new classlib -n Customers.Acl -o Customers.Acl
dotnet new xunit -n Migration.Tests -o Migration.Tests
rm Customers.Acl/Class1.cs Migration.Tests/UnitTest1.cs

dotnet add Facade package Yarp.ReverseProxy --version 2.3.0
dotnet add Modern reference Customers.Acl
dotnet add Migration.Tests reference Customers.Acl Facade
dotnet sln add Facade Legacy Modern Customers.Acl Migration.Tests
```

### The route table

The `customers` route points to a cluster with two destinations tagged by metadata. The `monolith` route catches everything else; its high `Order` makes it the last resort.

```json title="Facade/appsettings.json"
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ReverseProxy": {
    "Routes": {
      "customers": {
        "ClusterId": "customers",
        "Match": { "Path": "/api/customers/{**rest}" }
      },
      "monolith": {
        "ClusterId": "legacy",
        "Order": 1000,
        "Match": { "Path": "{**catch-all}" }
      }
    },
    "Clusters": {
      "legacy": {
        "Destinations": {
          "monolith": { "Address": "http://localhost:5001/" }
        }
      },
      "customers": {
        "Metadata": { "CanaryPercent": "10" },
        "Destinations": {
          "legacy": {
            "Address": "http://localhost:5001/",
            "Metadata": { "Slice": "legacy" }
          },
          "modern": {
            "Address": "http://localhost:5002/",
            "Metadata": { "Slice": "modern" }
          }
        }
      }
    }
  }
}
```

### Sticky canary in the proxy pipeline

YARP has no built-in weighted routing, but you can add middleware to its proxy pipeline. Ours reads `CanaryPercent` from the matched cluster, picks a slice, and narrows the available destinations to that slice.

```csharp title="Facade/CanaryRouting.cs"
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Yarp.ReverseProxy.Model;

namespace Facade;

public static class CanaryRouting
{
    public const string PercentKey = "CanaryPercent";
    public const string SliceKey = "Slice";
    public const string UserHeader = "X-User-Id";
    public const string OverrideHeader = "X-Route-Override";
    public const string Legacy = "legacy";
    public const string Modern = "modern";

    // Stable bucket 0..99: the same user always lands on the same side
    public static int Bucket(string routingKey)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(routingKey));
        return (int)(BitConverter.ToUInt32(hash, 0) % 100);
    }

    public static string ChooseSlice(string? routingKey, int percent, string? overrideValue)
    {
        if (overrideValue is Legacy or Modern) return overrideValue;
        if (percent <= 0 || string.IsNullOrEmpty(routingKey)) return Legacy;
        if (percent >= 100) return Modern;
        return Bucket(routingKey) < percent ? Modern : Legacy;
    }

    // Runs inside the YARP pipeline, after a route and cluster were matched
    public static Task SelectDestination(HttpContext context, Func<Task> next)
    {
        var proxy = context.GetReverseProxyFeature();
        var metadata = proxy.Cluster.Config.Metadata;
        if (metadata is null || !metadata.TryGetValue(PercentKey, out var raw))
        {
            return next();
        }

        // Anything unparseable means 0%: a typo must fail toward the legacy path
        var percent = int.TryParse(raw, out var parsed) ? Math.Clamp(parsed, 0, 100) : 0;
        var slice = ChooseSlice(
            context.Request.Headers[UserHeader].FirstOrDefault(),
            percent,
            context.Request.Headers[OverrideHeader].FirstOrDefault());

        var matching = proxy.AvailableDestinations
            .Where(d => d.Model.Config.Metadata?.GetValueOrDefault(SliceKey) == slice)
            .ToList();

        if (matching.Count > 0)
        {
            proxy.AvailableDestinations = matching;
            context.Response.Headers["X-Slice"] = slice;
        }

        return next();
    }
}
```

The bucket comes from a SHA-256 of the user key, not `string.GetHashCode()`, which is randomized per process in .NET and would reshuffle users on every restart. A bucket under 10 is also under 25, so raising the percentage only adds users to the new service. Requests without a user key stay on legacy, and an override header lets testers force either side.

```csharp title="Facade/Program.cs"
using Facade;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapReverseProxy(proxy =>
{
    proxy.Use(CanaryRouting.SelectDestination);
    proxy.UseLoadBalancing();
});

app.Run();
```

With a custom pipeline, YARP no longer adds its default middleware, so we add load balancing back after our filter. The `Program.cs` files rely on the template's implicit usings.

### The anti-corruption layer

The translator turns `CUSTOMER` rows from CDC into the domain model: it trims CHAR padding, splits the name, maps status codes (including the soft-delete code `X`) and refuses anything it can't translate faithfully.

```csharp title="Customers.Acl/LegacyCustomerTranslator.cs"
using System.Globalization;

namespace Customers.Acl;

// A CUSTOMER row from the monolith's database, as delivered by change data capture
public sealed record LegacyCustomerRow(int CustId, string CustNm, string StatusCd, string CrtDt);

public enum CustomerStatus
{
    Active,
    Suspended,
    Closed,
}

public sealed record Customer(
    int Id,
    string GivenName,
    string FamilyName,
    CustomerStatus Status,
    DateOnly CustomerSince);

public sealed class LegacyTranslationException(string message) : Exception(message);

public static class LegacyCustomerTranslator
{
    private static readonly TextInfo Text = CultureInfo.InvariantCulture.TextInfo;

    public static Customer ToDomain(LegacyCustomerRow row)
    {
        var (given, family) = SplitName(row.CustNm);
        return new Customer(row.CustId, given, family, MapStatus(row.StatusCd), ParseDate(row.CrtDt));
    }

    public static LegacyCustomerRow ToLegacy(Customer customer) => new(
        customer.Id,
        $"{customer.FamilyName.ToUpperInvariant()}, {customer.GivenName.ToUpperInvariant()}",
        customer.Status switch
        {
            CustomerStatus.Active => "A",
            CustomerStatus.Suspended => "S",
            _ => "C",
        },
        customer.CustomerSince.ToString("yyyyMMdd", CultureInfo.InvariantCulture));

    // CUST_NM is a CHAR column: "FAMILY, GIVEN", upper case, padded with spaces
    private static (string Given, string Family) SplitName(string raw)
    {
        var parts = raw.Split(',', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || parts[0].Length == 0 || parts[1].Length == 0)
        {
            throw new LegacyTranslationException($"Unexpected CUST_NM format: '{raw}'");
        }

        return (Text.ToTitleCase(parts[1].ToLowerInvariant()), Text.ToTitleCase(parts[0].ToLowerInvariant()));
    }

    // "X" is how the monolith soft-deletes; the new model only knows Closed
    private static CustomerStatus MapStatus(string code) => code.Trim().ToUpperInvariant() switch
    {
        "A" => CustomerStatus.Active,
        "S" => CustomerStatus.Suspended,
        "C" or "X" => CustomerStatus.Closed,
        _ => throw new LegacyTranslationException($"Unknown STATUS_CD: '{code}'"),
    };

    // "00000000" was the monolith's placeholder for "unknown"; refuse to invent a date
    private static DateOnly ParseDate(string raw)
    {
        if (!DateOnly.TryParseExact(raw.Trim(), "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            throw new LegacyTranslationException($"Invalid CRT_DT: '{raw}'");
        }

        return date;
    }
}
```

`ToLegacy` exists for comparison, so a dual-read job can diff the two stores. The mapping is lossy on purpose (`X` comes back as `C`), a decision you document, not an accident.

### The two backends

The modern service builds its data from replicated legacy rows through the ACL and serves **the same public contract** as the monolith. Both add an `X-Served-By` header so we can tell them apart.

```csharp title="Legacy/Program.cs"
var app = WebApplication.CreateBuilder(args).Build();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Served-By"] = "legacy";
    await next();
});

app.MapGet("/api/customers/{id:int}", (int id) => id == 42
    ? Results.Ok(new { id = 42, name = "Ana Santos", status = "Active", since = "2019-03-12" })
    : Results.NotFound());

app.MapGet("/api/orders/{id:int}", (int id) => Results.Ok(new { id, customerId = 42, total = 129.90m }));

app.Run();
```

```csharp title="Modern/Program.cs"
using System.Globalization;
using Customers.Acl;

var app = WebApplication.CreateBuilder(args).Build();

// Stand-in for rows replicated from the monolith by CDC into this service's own store
LegacyCustomerRow[] replicated = [new(42, "SANTOS, ANA          ", "A", "20190312")];
var customers = replicated.Select(LegacyCustomerTranslator.ToDomain).ToDictionary(c => c.Id);

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Served-By"] = "modern";
    await next();
});

// Same public contract as the monolith: clients must not notice which side answered
app.MapGet("/api/customers/{id:int}", (int id) => customers.TryGetValue(id, out var c)
    ? Results.Ok(new
    {
        id = c.Id,
        name = $"{c.GivenName} {c.FamilyName}",
        status = c.Status.ToString(),
        since = c.CustomerSince.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
    })
    : Results.NotFound());

app.Run();
```

### Tests for the translator and the split

```csharp title="Migration.Tests/LegacyCustomerTranslatorTests.cs"
using Customers.Acl;
using Xunit;

namespace Migration.Tests;

public class LegacyCustomerTranslatorTests
{
    [Fact]
    public void Translates_padded_legacy_row_into_domain_customer()
    {
        var row = new LegacyCustomerRow(42, "SANTOS, ANA          ", "A ", "20190312");

        var customer = LegacyCustomerTranslator.ToDomain(row);

        Assert.Equal(new Customer(42, "Ana", "Santos", CustomerStatus.Active, new DateOnly(2019, 3, 12)), customer);
    }

    [Theory]
    [InlineData("A", CustomerStatus.Active)]
    [InlineData("s", CustomerStatus.Suspended)]
    [InlineData("C", CustomerStatus.Closed)]
    [InlineData("X", CustomerStatus.Closed)]
    public void Maps_every_known_status_code(string code, CustomerStatus expected)
    {
        var row = new LegacyCustomerRow(1, "LIMA, JOAO", code, "20200101");

        Assert.Equal(expected, LegacyCustomerTranslator.ToDomain(row).Status);
    }

    [Theory]
    [InlineData("SANTOS ANA", "A", "20190312")]
    [InlineData(", ANA", "A", "20190312")]
    [InlineData("SANTOS, ANA", "Z", "20190312")]
    [InlineData("SANTOS, ANA", "A", "00000000")]
    [InlineData("SANTOS, ANA", "A", "2019-03-12")]
    public void Rejects_rows_it_cannot_translate_faithfully(string name, string status, string created)
    {
        var row = new LegacyCustomerRow(7, name, status, created);

        Assert.Throws<LegacyTranslationException>(() => LegacyCustomerTranslator.ToDomain(row));
    }

    [Fact]
    public void Round_trips_to_the_legacy_shape_for_comparison()
    {
        var original = new LegacyCustomerRow(9, "DE SOUZA, ANA MARIA", "S", "20211130");

        var back = LegacyCustomerTranslator.ToLegacy(LegacyCustomerTranslator.ToDomain(original));

        Assert.Equal(original, back);
    }
}
```

```csharp title="Migration.Tests/CanaryRoutingTests.cs"
using Facade;
using Xunit;

namespace Migration.Tests;

public class CanaryRoutingTests
{
    [Fact]
    public void Zero_percent_is_a_full_rollback()
    {
        for (var i = 0; i < 1_000; i++)
        {
            Assert.Equal(CanaryRouting.Legacy, CanaryRouting.ChooseSlice($"user-{i}", 0, null));
        }
    }

    [Fact]
    public void Hundred_percent_sends_everyone_to_the_new_service()
    {
        Assert.Equal(CanaryRouting.Modern, CanaryRouting.ChooseSlice("user-1", 100, null));
    }

    [Fact]
    public void Same_user_always_gets_the_same_side()
    {
        var first = CanaryRouting.ChooseSlice("user-123", 30, null);

        for (var i = 0; i < 100; i++)
        {
            Assert.Equal(first, CanaryRouting.ChooseSlice("user-123", 30, null));
        }
    }

    [Fact]
    public void Raising_the_percentage_only_adds_users_to_the_new_service()
    {
        for (var i = 0; i < 1_000; i++)
        {
            var key = $"user-{i}";
            if (CanaryRouting.ChooseSlice(key, 10, null) == CanaryRouting.Modern)
            {
                Assert.Equal(CanaryRouting.Modern, CanaryRouting.ChooseSlice(key, 25, null));
            }
        }
    }

    [Fact]
    public void Split_is_close_to_the_configured_percentage()
    {
        var modern = Enumerable.Range(0, 10_000)
            .Count(i => CanaryRouting.ChooseSlice($"user-{i}", 10, null) == CanaryRouting.Modern);

        Assert.InRange(modern, 800, 1_200);
    }

    [Fact]
    public void Requests_without_a_user_key_stay_on_legacy()
    {
        Assert.Equal(CanaryRouting.Legacy, CanaryRouting.ChooseSlice(null, 50, null));
    }

    [Theory]
    [InlineData("modern", 0, "modern")]
    [InlineData("legacy", 100, "legacy")]
    [InlineData("bogus", 0, "legacy")]
    public void Override_header_wins_only_with_a_known_value(string header, int percent, string expected)
    {
        Assert.Equal(expected, CanaryRouting.ChooseSlice("user-1", percent, header));
    }
}
```

### Run it, then roll back

```bash title="terminal"
dotnet test

# three terminals, one per process
dotnet run --project Legacy --no-launch-profile --urls http://localhost:5001
dotnet run --project Modern --no-launch-profile --urls http://localhost:5002
dotnet run --project Facade --no-launch-profile --urls http://localhost:5000

# a fourth terminal
curl -i http://localhost:5000/api/orders/7
curl -i -H "X-User-Id: user-6" http://localhost:5000/api/customers/42
curl -i -H "X-User-Id: user-1" http://localhost:5000/api/customers/42
curl -i -H "X-Route-Override: modern" http://localhost:5000/api/customers/42
```

All 20 tests pass. The orders request always shows `X-Served-By: legacy`. On the customers route, `user-6` lands in the modern bucket and `user-1` in the legacy one, and both get an identical JSON body.

Now roll back: change `"CanaryPercent": "10"` to `"0"` in `Facade/appsettings.json` and save. YARP reloads its configuration, so seconds later `user-6` is back on `X-Served-By: legacy`, with no restart. Set it back to 10 and the same users return to the modern side, because their buckets never changed.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>The override header is handy. Can we just leave it on in production so support can switch customers when they call?</span>
    </div>
  </div>
</div>

Not as written. Any client can send that header and pick its backend. In production, strip `X-Route-Override` at the edge and honor it only for authenticated internal users. The same goes for `X-User-Id`: derive the routing key from a validated token or a cookie your edge sets, never from a header a client can forge.

<div class="callout tip" data-title="Tip">
  <p>Treat the route table as code: change percentages through pull requests and let the pipeline push them to your configuration source. Every canary step and rollback then has an author and a diff.</p>
</div>

## Production Reality Check

### Observability decides your pace

You can only raise the canary as fast as you can compare the two sides. Record the slice (the `X-Slice` header here) in logs and traces, and break down error rate and latency per route and per slice. Without that, "the new service seems fine" is your only evidence.

### The facade is now critical infrastructure

Every request passes through it, so it needs multiple instances, health checks, capacity headroom and its own dashboards. It also adds a network hop; measure that latency early instead of discovering it at 100%.

### Decommissioning is part of the plan

A route that has sat at 100% for weeks isn't finished until you delete the monolith code for that slice, drop the tables it no longer owns (after a final backup), and remove the CDC connector and the legacy destination. Skip this and you run two systems forever. Put decommissioning tasks in the backlog when the slice starts.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Once the new service handles all the traffic, why rush to delete the old code? It's not hurting anyone just sitting there.</span>
    </div>
  </div>
</div>

It is, quietly. Dead code still gets compiled, patched and read by people trying to understand the system. Old tables keep receiving writes from forgotten jobs, and someone builds a report on the stale copy. Once you won't roll back, deletion is what makes the migration real.

### The organization has to move too

A strangler fig migration takes months or years, so it needs explicit ownership: one team owns the facade and route table, and each slice has a team that owns it end to end, decommissioning included. Agree early that new features for migrated domains go to the new service only, or the target keeps moving. If the migration is also a move between clouds or regions, decide data placement first, as covered in [Multi-Cloud Without the Pain: Patterns That Survive Contact with Reality](/en-us/blog/multi-cloud-patterns/).

<div class="callout info" data-title="Info">
  <p>Not every module needs a new service. Stable modules that rarely change can stay in a smaller monolith; that's a legitimate end state. The goal is a system that is easier to change, not a service count.</p>
</div>

The strangler fig trades one dramatic cutover for dozens of boring, reversible ones: a facade in front, a slice with clear seams, translation at the boundary, data before traffic, sticky canaries, a one-line rollback, and deletion of what you replaced. Boring is exactly what you want from a migration that runs while customers use the system.
