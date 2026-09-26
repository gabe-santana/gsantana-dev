---
title: "Idempotency Keys in Practice: Making Payment-Style APIs Safe to Retry"
description: "Use chaves de idempotência para evitar efeitos duplicados ao repetir um POST após timeout."
date: 2026-06-30
tags: [APIs, Idempotency, .NET, C#]
tldr:
  - "O cliente envia uma Idempotency-Key por operação de negócio e reutiliza a mesma chave em todo retry dessa operação."
  - "O servidor reivindica a chave de forma atômica, gera um fingerprint da requisição, guarda a resposta final e a devolve nas repetições."
  - "Isole as chaves por conta, mantenha-as por mais tempo que qualquer janela de retry e repasse chaves derivadas aos provedores downstream."
---

Um cliente toca em "Pagar". Sua API recebe `POST /payments`, chama o provedor de pagamento, grava o resultado e começa a devolver um `201 Created`. Em algum ponto entre o seu servidor e o celular, a conexão cai. O app vê um timeout, e a política de retry dele faz exatamente aquilo para que foi construída: envia a requisição de novo. Sua API, sem fazer ideia de que é o mesmo pagamento, cobra o cartão pela segunda vez.

Nada nessa história é um bug quando olhado isoladamente. O bug mora no espaço entre as peças, e a correção padrão é uma idempotency key. Este post mostra a convenção do header, o algoritmo no servidor (incluindo a parte de concorrência, que é fácil de errar) e uma implementação funcional em ASP.NET Core no .NET 10, com SQLite e testes em xUnit. O Júnior Inocente também está aqui.

## O problema e o contexto

Métodos HTTP têm semântica. GET, HEAD, PUT e DELETE são definidos como idempotentes: enviar a mesma requisição duas vezes deixa o servidor no mesmo estado que enviá-la uma vez. POST não faz essa promessa. Todo POST pode criar algo novo, que é exatamente o que você quer para "criar um pagamento" e exatamente o que dói quando a requisição se repete.

E requisições se repetem o tempo todo, muitas vezes por código que está se comportando corretamente:

- **Timeouts no cliente com sucesso no servidor.** Um timeout significa que o cliente parou de esperar, não que o servidor parou de trabalhar. A cobrança pode ter passado um milissegundo depois que o cliente desistiu.
- **Políticas de retry no cliente.** Bibliotecas de resiliência repetem falhas transitórias por design. Em [Building a Resilient .NET API with Polly](/pt-br/blog/resilient-dotnet-api-polly/) a recomendação era desligar retries em métodos não seguros, a menos que o servidor suporte idempotency keys. Este post é esse suporte do lado do servidor.
- **Intermediários.** Load balancers, API gateways e service meshes podem ser configurados para repetir requisições upstream em erros de conexão e, dependendo da configuração, podem não tratar POST de forma diferente de GET.
- **Pessoas.** Clique duplo, refresh em cima de um spinner, um botão "tentar de novo" num app mobile com conexão instável.
- **Reentrega de mensagens.** Filas com entrega at-least-once vão entregar a mesma mensagem a um consumidor mais de uma vez.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Simples: nunca faça retry de POST. Se der timeout, mostra um erro e deixa o usuário decidir.</span>
    </div>
  </div>
</div>

Isso troca a cobrança dupla por outro problema: ninguém sabe se o pagamento aconteceu. O usuário vê um erro e toca em "Pagar" de novo (um retry manual, mesmo resultado), ou desiste enquanto a cobrança passou em silêncio e o pedido nunca é enviado. O problema real não é o retry, é o servidor não conseguir distinguir um retry de uma requisição nova. Dê a ele um jeito de fazer isso e os retries ficam seguros, venham eles do Polly, de um gateway ou de um dedão.

## Mergulho na arquitetura

### A convenção do header Idempotency-Key

A ideia é simples. O cliente gera um valor único para cada **operação de negócio** (não para cada tentativa), envia esse valor num header `Idempotency-Key` e reutiliza o mesmo valor em todo retry daquela operação. O servidor lembra quais chaves já processou e o que respondeu.

```http title="request"
POST /payments HTTP/1.1
Host: api.example.com
Content-Type: application/json
Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"

{"amount": 100.00, "currency": "BRL"}
```

APIs de pagamento como a da Stripe popularizaram esse padrão, e o grupo de trabalho HTTPAPI da IETF vem padronizando-o num draft chamado "The Idempotency-Key HTTP Header Field". O draft define o header como uma string de structured field (daí as aspas acima), recomenda um identificador aleatório como um UUID e descreve os casos de erro: chave ausente num endpoint que a exige recebe 400, reutilizar uma chave com payload diferente recebe 422, e um retry que chega enquanto a requisição original ainda está em processamento recebe 409. A implementação abaixo segue essa orientação.

<div class="callout info" data-title="Info">
  <p>No momento em que escrevo, a especificação do Idempotency-Key ainda é um Internet-Draft, não uma RFC. Confira a versão mais recente antes de tratar qualquer detalhe como definitivo e documente a sua própria política (endpoints que exigem a chave, formato, expiração) para quem consome a API.</p>
</div>

### O algoritmo no servidor

Para toda requisição a um endpoint que exige chave, o servidor faz o seguinte:

```text title="idempotency flow"
request (scope, key, body)
   |
   v
fingerprint = SHA-256(method, path, query, body)
   |
   v
try to INSERT (scope, key, fingerprint, state = in_progress)   <- atomic, unique (scope, key)
   |
   +-- inserted --------> run handler --> 2xx/4xx: store response, state = completed
   |                                  --> 5xx/exception: delete the row (key can be retried)
   |
   +-- row exists, other fingerprint --> 422 Unprocessable Content
   +-- row exists, in_progress ---------> 409 Conflict + Retry-After
   +-- row exists, completed -----------> replay stored status, headers and body
```

Quatro detalhes decidem se isso funciona ou não.

**O fingerprint.** A chave sozinha diz "esta é a mesma operação". O fingerprint confere essa afirmação. É um hash do método, do path, da query string e do body. Se um cliente reutiliza uma chave com um body diferente, isso é bug do cliente, e o servidor deve dizer isso em alto e bom som com um 422 em vez de tentar adivinhar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Pra que gerar hash do body? Se a chave bate, é só devolver o que a gente guardou. Menos código.</span>
    </div>
  </div>
</div>

Imagine um cliente que, sem querer, reutiliza uma única chave para todos os pagamentos de uma sessão. Sem fingerprint, o segundo pagamento, de R$ 250, recebe o "201 Created" guardado do primeiro, de R$ 100. O cliente acha que pagou, o servidor nunca cobrou, e a divergência aparece semanas depois na conciliação. O fingerprint transforma um bug de dados silencioso num erro imediato e óbvio.

**A reivindicação atômica.** Duas cópias da mesma requisição podem chegar ao mesmo tempo (um retry do gateway disputando com a original, duas instâncias atrás de um load balancer). Se as duas checam "essa chave existe?" antes de qualquer uma inserir, as duas não encontram nada e as duas cobram. A reivindicação precisa ser uma única operação atômica: um insert protegido por uma constraint única em `(scope, key)`. Exatamente um insert vence; todos os outros descobrem que a chave já tem dono.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Não dá pra fazer um SELECT antes e só dar INSERT quando não voltar nada? Fica mais fácil de ler.</span>
    </div>
  </div>
</div>

Fica fácil de ler e falha exatamente nas condições para as quais a idempotência existe. Entre o seu SELECT e o seu INSERT, outra requisição pode rodar o próprio SELECT e também não encontrar nada. Checar e depois agir é uma race condition, a menos que a checagem e a ação sejam um único comando ou um único lock. Deixe o banco garantir a unicidade e trate "o insert alterou zero linhas" como a resposta.

**O que é guardado.** Quem vence marca a chave como `in_progress`, executa o handler e depois registra o status code final, os headers relevantes (no mínimo `Content-Type` e `Location`) e o body. Resultados determinísticos são guardados: um 201 e também um 400 por valor inválido, já que repetir uma requisição inválida vai produzir o mesmo 400. Erros de servidor são diferentes. Um 5xx ou uma exceção não tratada muitas vezes significa que algo transitório falhou, e guardar isso tornaria a chave inútil para sempre: todo retry devolveria a falha. Então, em caso de 5xx, a reivindicação é liberada e o cliente pode tentar de novo com a mesma chave.

Essa escolha tem uma pré-condição: liberar a chave só é seguro se a tentativa que falhou não deixou um efeito colateral para trás. Se a cobrança deu certo e a gravação no banco logo depois quebrou, liberar a chave abre a porta para uma segunda cobrança. Guarde essa ideia; ela é o assunto principal da seção de produção.

**Escopo e expiração.** Chaves são únicas por cliente, não globalmente. Duas contas podem gerar a mesma chave (geradores com bug, fixtures de teste copiadas e coladas), e elas não podem colidir. Pior: um espaço de chaves global deixa um tenant receber a resposta guardada de outro. O escopo precisa vir da identidade autenticada.

<div class="callout warning" data-title="Atenção">
  <p>Nunca deixe o cliente escolher o escopo. Se o escopo vem de um header que quem chama controla, qualquer um que adivinhe ou observe uma chave consegue receber a resposta guardada de outra conta, incluindo o body. Derive o escopo do principal autenticado (usuário, client da API, tenant) no servidor.</p>
</div>

As chaves também precisam de um tempo de vida, e aqui o erro perigoso é expirar cedo demais. Uma chave precisa sobreviver à janela mais longa em que um retry daquela operação ainda pode chegar: orçamentos de retry dos clientes, filas offline de apps mobile, um job que retoma depois de um deploy. Se a chave expira em cinco minutos e o retry chega em dez, o servidor trata o retry como um pagamento novo. Uma escolha comum é 24 horas, que custa um pouco de armazenamento e compra bastante segurança. Seja qual for a escolha, publique-a.

## Implementação na prática

Aqui está tudo no .NET 10: um middleware que aplica o algoritmo, uma abstração de store, uma implementação em SQLite cuja primary key faz a reivindicação atômica, um endpoint de pagamentos e testes em xUnit.

```bash title="terminal"
dotnet new web -n Payments.Api
dotnet new xunit -n Payments.Api.Tests
dotnet add Payments.Api package Microsoft.Data.Sqlite --version 10.0.12
dotnet add Payments.Api.Tests reference Payments.Api/Payments.Api.csproj
dotnet add Payments.Api.Tests package Microsoft.AspNetCore.Mvc.Testing --version 10.0.12
```

Apague o `UnitTest1.cs` do template; os testes vêm mais adiante.

### O contrato do store

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

Três operações mapeiam direto para o fluxo: reivindicar, concluir, liberar. O middleware nunca vê SQL, então o store por trás pode mudar depois.

### O store em SQLite

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

        // A primary key é o lock: de N inserts concorrentes, exatamente um altera uma linha.
        // Uma linha expirada é assumida no mesmo comando, então não há corrida entre delete e insert.
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
            return new ClaimResult(ClaimOutcome.InProgress); // liberada entre os nossos dois comandos: tente depois

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

A parte interessante é o upsert. `INSERT ... ON CONFLICT DO UPDATE ... WHERE` é um único comando atômico: ele insere uma linha nova ou assume uma linha **expirada** e, fora isso, não altera nada. Uma linha alterada significa "a chave é sua"; zero significa que ela é de outra requisição, e o SELECT seguinte diz se essa outra usou um body diferente, ainda está rodando ou já terminou. O Microsoft.Data.Sqlite faz retry quando o banco está ocupado até estourar o timeout do comando, então escritores concorrentes esperam em vez de falhar.

### O middleware

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

    // Só para a demo: em produção, derive o escopo do principal autenticado, nunca de um header que o cliente controla.
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
        // O draft define o valor como uma string de structured field ("abc"), mas muitos clientes enviam sem aspas.
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
            // Não há um resultado confiável para devolver, então libera a chave e deixa um retry executar o handler de novo.
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

        // CancellationToken.None: o efeito colateral já aconteceu, então registre mesmo que o cliente tenha desconectado.
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

Por que um middleware e não um endpoint filter? Um filter enxerga o `IResult` do handler, mas o replay precisa dos bytes exatos que saíram. O middleware troca o body da resposta por um `MemoryStream`, deixa o endpoint escrever nele, guarda o resultado e depois copia para o stream real. Ele só age em endpoints marcados com `RequireIdempotencyKey()`, então o resto da API não paga nada por isso. O `EnableBuffering` permite gerar o hash do body e rebobiná-lo para o model binding.

<div class="callout tip" data-title="Dica">
  <p>Registre o resultado com <code>CancellationToken.None</code>, não com <code>RequestAborted</code>. O cliente desconectar é justamente o cenário que dispara um retry. Se o registro for cancelado junto com a requisição, a cobrança acontece mas a chave fica em <code>in_progress</code>, e o retry recebe 409 até a chave expirar, em vez da resposta original.</p>
</div>

### O efeito colateral e o endpoint

```csharp title="Payments.Api/Payments/PaymentGateway.cs"
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Payments.Api.Payments;

public sealed record ChargeRequest(decimal Amount, string Currency);

public sealed record Payment(Guid Id, decimal Amount, string Currency, string Status);

public interface IPaymentGateway
{
    // Um client real do provedor envia idempotencyKey na sua própria requisição de saída.
    Task<Payment> ChargeAsync(ChargeRequest request, string idempotencyKey, CancellationToken ct);
}

// Conta toda chamada, para os testes provarem quantas vezes o efeito colateral realmente rodou.
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

    // Repassa uma chave derivada da nossa, para que um retry que chegue ao provedor também seja deduplicado lá.
    var payment = await gateway.ChargeAsync(request, $"charge:{context.GetIdempotencyKey()}", ct);
    return Results.Created($"/payments/{payment.Id}", payment);
})
.RequireIdempotencyKey();

app.Run();

public partial class Program;
```

O `UseRouting()` vem antes do `UseIdempotency()` para que o middleware consiga ler os metadados do endpoint que casou com a rota. O handler não sabe nada de deduplicação além de repassar uma chave derivada.

### Provando com testes

O `WebApplicationFactory` roda o pipeline real em memória. Cada teste recebe o próprio arquivo SQLite e um gateway fake com 200 ms de latência, tempo suficiente para requisições concorrentes se sobreporem.

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

Os cinco testes passam. O de concorrência é o que vale reler: dez requisições idênticas disparam ao mesmo tempo, o gateway é chamado exatamente uma vez, e todas as outras requisições recebem ou um 409 (ainda em processamento) ou o 201 devolvido do store.

## Checagem de realidade em produção

O middleware é uma base sólida. Estas são as lacunas que importam em escala.

### Coloque a chave e o efeito colateral na mesma transação

O middleware guarda a chave num lugar e o handler grava o pagamento em outro. Se o processo morrer entre o commit do pagamento e o `CompleteAsync`, a chave fica em `in_progress` enquanto o pagamento existe. Quando o efeito colateral é uma gravação no **seu próprio** banco, o desenho mais forte leva a reivindicação para a mesma transação da gravação de negócio, de modo que as duas fazem commit ou nenhuma faz:

```sql title="transactional-claim.sql (excerpt)"
BEGIN;
INSERT INTO idempotency_keys (scope, key, fingerprint, state, created_at, expires_at)
VALUES (@scope, @key, @fingerprint, 'in_progress', @now, @expires);   -- violação de unicidade: pare, é duplicata
INSERT INTO payments (id, account_id, amount, currency) VALUES (@id, @scope, @amount, @currency);
UPDATE idempotency_keys
SET state = 'completed', status_code = 201, body = @body
WHERE scope = @scope AND key = @key;
COMMIT;
```

Na prática, isso significa que o handler (ou uma unit of work em volta dele) é dono da reivindicação, em vez de um middleware genérico. Liberar a chave em caso de falha também fica seguro de graça, porque um rollback desfaz a linha do pagamento junto.

### Chamadas downstream também precisam de idempotência

Um provedor de pagamento não está na sua transação, e nenhuma esperteza local resolve isso. A saída é empurrar o problema para baixo: envie uma chave derivada da sua (`charge:{scope}:{key}` no exemplo) na chamada ao provedor. Agora um retry depois de um crash, venha ele do seu código, do seu pipeline do Polly ou de uma mensagem reentregue, chega a um provedor que também deduplica. É isso que torna defensável "liberar a chave em 5xx" quando o efeito colateral é remoto: mesmo que a cobrança tenha acontecido, o retry com a mesma chave derivada recebe a cobrança original de volta em vez de uma nova.

### Reivindicações presas em andamento

Se um processo quebra no meio de uma requisição, a linha dele fica em `in_progress` até expirar, e todo retry recebe 409. Com um TTL de 24 horas, é tempo demais. Adicione um lease (`locked_until`) que uma nova requisição pode assumir depois que ele vence, e deixe-o bem mais longo que a sua requisição legítima mais lenta. Retomar um lease enquanto a requisição original ainda está de fato rodando é o risco que você aceita, e a chave downstream é o que limita o estrago.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>SQLite em produção? Eu guardaria as chaves num ConcurrentDictionary em cada instância. Bem mais rápido.</span>
    </div>
  </div>
</div>

Mais rápido, e errado assim que você sobe uma segunda instância. O retry que mais importa é justamente o que cai numa instância diferente da original, porque o load balancer espalha as conexões. E o dicionário some a cada deploy ou restart, que é quando os retries disparam. O store precisa ser compartilhado e durável: o seu banco relacional principal (ideal quando você quer a reivindicação transacional), ou Redis com `SET key value NX PX ttl` para a reivindicação, se você aceita os trade-offs de durabilidade dele. O SQLite aqui é um substituto que deixa a reivindicação atômica fácil de ver e de testar.

### Coisas menores que mordem

- **Fingerprints no nível de bytes.** Gerar hash dos bytes crus significa que um retry que serializa o JSON de novo com outro espaçamento ou outra ordem de propriedades é tratado como requisição diferente. Clientes devem reenviar exatamente o mesmo body; se você não pode garantir isso, gere o fingerprint de uma forma canônica do payload já parseado.
- **Limpeza.** Linhas expiradas não se apagam sozinhas. Rode um job periódico que remova as linhas com `expires_at` vencido e limite o tamanho do body guardado.
- **Fidelidade do replay.** Guarde os headers de que os clientes dependem (`Location`, `Content-Type`, talvez um ETag), não os que são por requisição, como trace ids.
- **Observabilidade.** Conte reivindicações, replays, 409s e 422s. Um pico de 422s normalmente significa que algum cliente está reutilizando chaves.

Idempotency keys transformam "meu pagamento passou?" numa pergunta que o servidor responde do mesmo jeito toda vez. O cliente é dono de uma chave por operação; o servidor a reivindica de forma atômica, confere o fingerprint, guarda a resposta final e a mantém por mais tempo do que qualquer um conseguiria repetir a requisição. Some a isso uma chave derivada na chamada ao provedor, e uma conexão que cai vira um não evento em vez de um chamado de estorno.
