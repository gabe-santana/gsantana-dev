---
title: "Building a Resilient .NET API with Polly: Retries, Circuit Breakers, and Timeouts"
description: "Resiliência é um orçamento, não uma pilha de retries: faça retry só de falhas transitórias em chamadas idempotentes, com backoff exponencial e jitter, e limite tudo com um timeout total mais um timeout por tentativa. Adicione um circuit breaker para que uma dependência com problema ganhe fôlego em vez de uma tempestade de retries."
date: 2025-12-20
tags: [.NET, C#, Resilience, Polly]
tldr:
  - "Faça retry só de falhas transitórias em chamadas idempotentes, com backoff exponencial e jitter, e respeite o Retry-After nas respostas 429."
  - "Ordene as estratégias como um orçamento: timeout total, depois retry, depois circuit breaker, depois timeout por tentativa."
  - "Com o circuito aberto, falhe rápido com um fallback em cache ou um 503 claro, em vez de alimentar uma tempestade de retries."
---

Todo sistema distribuído tem uma dependência que falha no pior momento possível. Normalmente não é uma queda dramática. É um serviço de preços que começa a responder em 9 segundos em vez de 90 milissegundos, ou uma API de estoque que devolve 503 em uma a cada cinco requisições. Sua API não quebrou, mas está prestes a quebrar, por causa da forma como ela reage.

Este post é um guia prático para reagir bem. Vamos construir uma API ASP.NET Core em .NET 8 que chama um serviço downstream instável e protegê-la com Polly v8 e `Microsoft.Extensions.Http.Resilience`. A ideia principal para levar com você: resiliência é um **orçamento**. Você decide quanto tempo e quantas chamadas extras está disposto a gastar com uma dependência que está falhando, e gasta isso de forma deliberada.

## O problema e o contexto

Imagine uma API de catálogo de produtos. Para cada página de produto, ela chama um **serviço de preços** interno para obter o preço atual de um SKU. O serviço de preços pertence a outro time, roda em um banco de dados compartilhado e tem dias ruins: deploys, pausas de GC, um vizinho barulhento martelando o banco.

A primeira versão do client é a clássica:

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

Nada de errado aqui em um dia de sol. Em um dia de chuva, duas coisas acontecem. Todo soluço transitório (uma conexão derrubada, um 503 durante um deploy) vira um erro para o usuário. E quando o serviço de preços fica lento, cada requisição à sua API segura uma conexão e um slot por até 100 segundos, que é o `HttpClient.Timeout` padrão. As requisições se acumulam, a sua própria latência explode e agora **você** é a indisponibilidade para quem chama você.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Fácil: coloca a chamada num loop e tenta 5 vezes. Se funcionar na terceira, o usuário nem percebe, né?</span>
    </div>
  </div>
</div>

Isso funciona para um soluço isolado, e é exatamente assim que indisponibilidades são amplificadas. Pense no que acontece quando o serviço de preços está sofrendo porque está sobrecarregado. Sua API recebe 500 requisições por segundo. Com um loop ingênuo de 5 retries e sem nenhum intervalo, cada requisição com falha vira 6 chamadas. O serviço de preços, que já estava se afogando, agora recebe até 3.000 requisições por segundo só de você. Ele estava mancando; você acabou de empurrá-lo do penhasco. Isso é uma **tempestade de retries** (retry storm), e é uma das formas mais comuns de uma falha parcial virar uma falha total.

Fica pior com camadas. Se o navegador faz retry, o API gateway faz retry, a sua API faz retry e o client de preços faz retry, os multiplicadores se acumulam. Três camadas com 3 retries cada significam até 4 × 4 × 4 = 64 chamadas atingindo o serviço lá de baixo por um único clique do usuário.

Então a pergunta não é "devo fazer retry?". É "quais falhas merecem retry, quantos, com que espaçamento e quando eu paro de tentar de vez?".

## Mergulho na arquitetura

### Falhas transitórias vs não transitórias

Um retry só faz sentido se a próxima tentativa tiver uma chance real de dar um resultado diferente. Isso divide as falhas em duas famílias:

| Sinal | Transitória? | Por quê |
|--------|-----------|-----|
| `HttpRequestException` (conexão resetada, soluço de DNS) | Sim | Soluços de rede costumam se resolver em milissegundos |
| Timeout em uma única tentativa | Sim | Talvez você tenha caído numa instância lenta ou numa pausa de GC |
| 500, 502, 503, 504 | Geralmente | O servidor ou algo na frente dele está sofrendo |
| 408 Request Timeout | Sim | O servidor cansou de esperar, tente de novo |
| 429 Too Many Requests | Sim, com cuidado | Só depois do `Retry-After` que o servidor pedir |
| 400 Bad Request | Não | Seu payload está errado; vai continuar errado na próxima |
| 401 / 403 | Não | Credenciais não se consertam sozinhas em 200 ms |
| 404 Not Found | Não | O SKU não existe; isso é uma resposta, não uma falha |
| 501 Not Implemented | Não | O endpoint não vai passar a existir no retry |

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas e se eu fizer retry de um 400 mesmo assim? No pior caso falha de novo, sem prejuízo.</span>
    </div>
  </div>
</div>

O prejuízo é orçamento gasto. Cada retry inútil adiciona latência para o usuário, consome uma conexão e adiciona carga a um serviço que disse claramente "essa requisição é inválida". Fazer retry de um 400 é como reenviar um e-mail para um endereço que voltou: a resposta não vai mudar, você só está irritando o servidor de e-mail. Faça retry do que está **temporariamente** errado, nunca do que está **definitivamente** errado.

### Idempotência: a outra metade da pergunta

Nem toda falha transitória é segura para retry. Um timeout não significa que a operação não aconteceu. Significa que **você não sabe** se ela aconteceu. Para um `GET /api/prices/SKU-1`, tudo bem: ler duas vezes não muda nada. Para um `POST /api/orders`, um retry depois de um timeout pode criar dois pedidos e cobrar o cliente duas vezes.

Regra prática: faça retry de GET, HEAD, PUT e DELETE (idempotentes por definição, se o servidor os implementa corretamente). Não faça retry de POST ou PATCH a menos que o servidor suporte uma **chave de idempotência**, para reconhecer a segunda tentativa como duplicata da primeira. Voltamos a isso na seção de produção.

### As quatro estratégias e por que a ordem importa

Uma chamada HTTP resiliente combina quatro ideias:

1. **Timeout total**: o tempo máximo que quem chama está disposto a esperar pela operação inteira, retries incluídos. Esse é o orçamento.
2. **Retry**: executar de novo em falhas transitórias, com backoff exponencial (200 ms, 400 ms, 800 ms...) mais **jitter** (variação aleatória) para que mil clients não façam retry em perfeita sincronia.
3. **Circuit breaker**: observar a taxa de falhas. Quando ela passa de um limite, parar de chamar a dependência por um tempo e falhar rápido. Depois da pausa, deixar passar uma requisição de teste (half-open) e fechar o circuito se ela der certo.
4. **Timeout por tentativa**: o tempo máximo que uma única tentativa pode levar, para que uma conexão travada não consuma o orçamento inteiro.

No Polly v8, as estratégias são adicionadas de fora para dentro: a primeira que você adiciona envolve todas as seguintes. A ordem recomendada é:

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

Cada posição tem um motivo:

- O **timeout total fica mais por fora** porque precisa limitar tudo, inclusive a espera entre retries. Sem ele, 4 tentativas de 2 s mais o backoff podem virar 10 s sem ninguém perceber, enquanto quem chamou desistiu em 5 s.
- O **retry fica por fora do breaker** para que toda tentativa seja registrada pelo breaker. Quando o circuito abre, o breaker lança `BrokenCircuitException` na hora, e o retry **não** deve tratar essa exceção. A chamada falha rápido em vez de ficar girando.
- O **timeout por tentativa fica mais por dentro** para que cada tentativa tenha seu próprio relógio, e uma tentativa que estourou o tempo seja vista pelo breaker como falha e pelo retry como erro transitório.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Pra que dois timeouts? Coloca um timeout grandão e deixa o retry se virar.</span>
    </div>
  </div>
</div>

Com só um timeout grande, a primeira tentativa pode travar pelo orçamento inteiro e não sobra tempo para o retry, então a política de retry vira enfeite. Com só um timeout pequeno por tentativa, retries mais backoff não têm teto, e o tempo total depende da sorte. Você precisa dos dois: o pequeno faz cada tentativa falhar rápido, o grande garante que quem chamou recebe uma resposta (boa ou ruim) dentro de um tempo conhecido.

Vamos colocar números no nosso orçamento: total de 8 s, 2 s por tentativa, 3 retries com delay base de 200 ms. O pior caso é 4 tentativas × 2 s mais cerca de 1,4 s de backoff, algo como 9,4 s. O timeout total corta isso em 8 s. Esse é o ponto: o orçamento é garantido por um único número, não pela esperança de que a conta feche.

## Implementação na prática

Você precisa do .NET 8 e de um pacote, que já traz o Polly v8 (`Polly.Core`) junto:

```bash title="terminal"
dotnet add package Microsoft.Extensions.Http.Resilience
```

### O caminho rápido: o standard resilience handler

Para a maioria dos typed clients, comece por aqui. O `AddStandardResilienceHandler` monta o pipeline recomendado completo (rate limiter, timeout total, retry, circuit breaker, timeout por tentativa) na ordem correta, com detecção sensata de erros transitórios e suporte a `Retry-After` de fábrica:

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
    options.Retry.DisableForUnsafeHttpMethods(); // sem retries para POST, PATCH etc.

    options.CircuitBreaker.FailureRatio = 0.5;
    options.CircuitBreaker.MinimumThroughput = 10;
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
    options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
});
```

Leia as configurações do circuit breaker como uma frase: "em qualquer janela de 30 segundos com pelo menos 10 chamadas, se 50% ou mais falharem, pare de chamar por 15 segundos". O `MinimumThroughput` importa mais do que parece: sem ele, 1 falha em 1 chamada às 3 da manhã é uma taxa de falha de 100%.

<div class="callout info" data-title="Info">
  <p>O standard handler valida suas opções na inicialização. <code>SamplingDuration</code> precisa ser pelo menos o dobro de <code>AttemptTimeout.Timeout</code>, e <code>TotalRequestTimeout</code> precisa ser maior que o timeout por tentativa. Se você tomar uma <code>OptionsValidationException</code> no boot, é por isso. É uma feature: ela impede que você publique um orçamento cuja conta não fecha.</p>
</div>

### O caminho customizado: montando o pipeline você mesmo

O standard handler é ótimo até você precisar de regras específicas. Talvez você queira fazer retry de 429 sem contar como falha no breaker, ou limitar por quanto tempo vai respeitar um `Retry-After`. Aí você monta o pipeline com `AddResilienceHandler`, que te entrega um `ResiliencePipelineBuilder<HttpResponseMessage>`. Vou encapsular isso num método de extensão para que a mesma configuração seja usada pelo `Program.cs` e pelos testes:

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

            // 1. Timeout total: o orçamento da operação inteira, retries incluídos.
            pipeline.AddTimeout(TimeSpan.FromSeconds(8));

            // 2. Retry: só falhas transitórias, backoff exponencial com jitter.
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
                // Retornar null faz cair no backoff exponencial.
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

            // 3. Circuit breaker: 429 é throttling, não doença, então não conta.
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

            // 4. Timeout por tentativa: uma conexão travada não consome o orçamento inteiro.
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

Algumas decisões merecem destaque. O predicado do retry não menciona `BrokenCircuitException`, então quando o circuito está aberto a chamada falha na hora em vez de fazer retry contra uma parede. Um 429 cujo `Retry-After` pede mais de 2 segundos **não** entra em retry: esperar 30 segundos dentro de um orçamento de 8 segundos não faz sentido, então é melhor devolver isso para quem chamou imediatamente. E o `OnRetry` registra o número da tentativa, o delay e o motivo, que é o que você vai querer ver às 3 da manhã.

Registrar esse pipeline substitui o standard handler, não fica ao lado dele:

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

<div class="callout warning" data-title="Atenção">
  <p>Não encadeie <code>AddStandardResilienceHandler()</code> e <code>AddResilienceHandler(...)</code> no mesmo client. Você ganha duas camadas de retry, dois breakers e um orçamento multiplicado, que é exatamente a tempestade de retries que estamos tentando evitar. Escolha um pipeline por client.</p>
</div>

### Degradação elegante quando o circuito está aberto

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Beleza, o circuito abriu e o Polly lança uma exceção. Então é só deixar subir como 500 e pronto?</span>
    </div>
  </div>
</div>

Um 500 diz "temos um bug", o que não é verdade: você tem uma dependência doente e um plano para ela. O circuit breaker compra tempo; o fallback decide o que o usuário vê durante esse tempo. Para preços, um valor recente em cache marcado como desatualizado costuma ser muito melhor que uma página de erro. Quando não há nada em cache, responda com um problem response adequado: 503 com `Retry-After` para circuito aberto, 504 para timeout.

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

            // Último valor bom conhecido, usado como fallback quando pricing cai.
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

Repare no que **não** é capturado: um 400 ou 401 vindo de pricing continua lançando exceção, porque isso é bug ou configuração errada do nosso lado e deve aparecer como 500 no seu rastreamento de erros. E uma `OperationCanceledException` causada por quem chamou desconectando também passa intacta. O endpoint mapeia cada status para a resposta HTTP correta:

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

A flag `IsStale` permite que o frontend mostre "o preço pode estar desatualizado" em vez de fingir que está tudo bem. Degradação honesta ganha de degradação silenciosa.

### Testando o pipeline

Código de resiliência que nunca viu uma falha é uma hipótese. O jeito mais barato de testá-lo é um `HttpMessageHandler` fake que devolve uma sequência roteirizada de respostas, plugado como handler primário por baixo do pipeline real:

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

É por isso que `retryBaseDelay` é um parâmetro: os testes rodam em milissegundos, a produção mantém seus 200 ms. Adicione testes parecidos para "o breaker abre depois de N falhas" e "429 com `Retry-After` longo não entra em retry".

Para um ambiente de staging, o Polly 8.3+ traz estratégias de chaos. Coloque-as no fim do pipeline (mais por dentro), atrás de uma flag de configuração, e observe se sua API degrada do jeito que você projetou:

```csharp title="PricingResilience.cs"
// Dentro do AddResilienceHandler, depois do timeout por tentativa. Nunca ligado em produção.
if (context.ServiceProvider.GetService<IConfiguration>()?.GetValue<bool>("Chaos:Pricing") == true)
{
    pipeline.AddChaosLatency(0.1, TimeSpan.FromSeconds(3));
    pipeline.AddChaosOutcome(0.1, () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
}
```

### Observabilidade

Quando o Polly roda via `Microsoft.Extensions.Http.Resilience`, a telemetria vem ligada por padrão: eventos de resiliência são logados e publicados como métricas no meter `Polly` (por exemplo `resilience.polly.strategy.events`, com tags do nome do pipeline, nome da estratégia e evento, como `OnRetry` ou `OnCircuitOpened`). É por isso que dar nome às estratégias (`pricing-retry`, `pricing-breaker`) compensa. Exporte com OpenTelemetry:

```csharp title="Program.cs"
using OpenTelemetry.Metrics;

builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddMeter("Polly")
        .AddOtlpExporter());
```

Os dashboards que importam: retries por segundo por pipeline (uma linha subindo é um alerta precoce, muito antes de os erros aparecerem), eventos de abertura do circuit breaker e a proporção de respostas desatualizadas servidas. Se os retries estão sempre altos, você não tem um problema de resiliência, tem um problema de dependência escondido atrás de um.

## Checagem de realidade em produção

O código acima é a parte fácil. Estas são as coisas que mordem em sistemas reais.

**Retries se multiplicam entre camadas.** Mapeie cada salto que faz retry: SDKs, gateways, service meshes, consumidores de mensagens, seu próprio código. O ideal é que retries aconteçam em **uma** camada, perto da chamada que falha. Se o Envoy ou o seu API Management já faz retry das chamadas upstream, talvez o pipeline do seu client precise de zero retries e só de um breaker e timeouts.

**Seu timeout precisa ser menor que o timeout de quem chama você.** Se o frontend desiste em 5 s e o seu orçamento total é 8 s, você vai continuar trabalhando por 3 s em uma resposta que ninguém vai ler, segurando conexões o tempo todo. Os orçamentos encolhem conforme você desce: o timeout total de cada camada deve caber dentro do da camada de cima. Mantenha também o `HttpClient.Timeout` (100 s por padrão) acima do timeout total do pipeline, para ele não cortar antes com uma `TaskCanceledException` confusa.

**429 é uma conversa, não um erro.** O servidor está dizendo a que velocidade você pode ir. Respeite o `Retry-After` (o standard handler faz isso por padrão), não conte throttling como falha no breaker e, se a espera pedida passar do seu orçamento, falhe rápido e deixe quem chamou decidir. Fazer retry de um 429 antes da hora só faz você ficar mais tempo no throttling.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Meu POST de criar pedido deu timeout. Timeout é transitório, então o retry resolve, né?</span>
    </div>
  </div>
</div>

Só se você gosta de explicar cobrança em dobro para cliente. O primeiro POST pode ter dado certo; o timeout só significa que a resposta não chegou até você. Torne a operação idempotente primeiro: gere uma chave de idempotência uma vez por operação de negócio, envie a mesma chave em todas as tentativas e faça o servidor devolver o resultado original quando vir a mesma chave de novo.

```csharp title="OrdersClient.cs"
public sealed class OrdersClient(HttpClient httpClient)
{
    public async Task<HttpResponseMessage> CreateOrderAsync(CreateOrder order, Guid idempotencyKey, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/orders")
        {
            Content = JsonContent.Create(order)
        };
        // Mesma chave em todas as tentativas: o servidor elimina duplicatas.
        request.Headers.Add("Idempotency-Key", idempotencyKey.ToString());

        return await httpClient.SendAsync(request, ct);
    }
}

public sealed record CreateOrder(string Sku, int Quantity);
```

Sem suporte do servidor a esse header, mantenha o `DisableForUnsafeHttpMethods()` ligado e deixe o erro aparecer.

**Esgotamento do thread pool e do pool de conexões.** Uma dependência lenta não só deixa suas requisições lentas, ela acumula recursos. Cada requisição esperando mantém uma conexão de saída ocupada e, se algo no caminho bloqueia de forma síncrona (`.Result`, `.Wait()`), mantém também uma thread do thread pool. É assim que um serviço de preços lento acaba congelando endpoints que nem chamam pricing. Timeouts apertados são sua primeira defesa; o circuit breaker é a segunda, porque falhar rápido libera recursos imediatamente. Para isolamento de verdade, limite a concorrência por dependência (o standard handler inclui um concurrency limiter que você ajusta via `options.RateLimiter`), para que um serviço doente só consiga ocupar a própria fatia da sua capacidade.

**Ajuste com dados, não com achismo.** Baseie o timeout por tentativa na latência real da dependência (algo como p99 mais uma margem), não num número redondo. Baseie os limites do breaker na taxa de erro normal: se o serviço falha 2% das vezes num dia bom, um limite de 10% é sinal, 1% é ruído. Revise esses números quando o padrão de tráfego mudar.

**Circuit breakers são por instância.** Com 20 pods, você tem 20 breakers independentes, cada um aprendendo sozinho. Isso normalmente é ok, mas não espere um momento sincronizado de "a frota inteira para de chamar pricing", e mantenha o `MinimumThroughput` realista para o tráfego que **um único** pod recebe.

A mudança de mentalidade é a lição inteira: pare de pensar "como faço essa chamada dar certo?" e comece a pensar "quanto estou disposto a gastar quando ela não der certo, e o que o usuário vê nesse momento?". Retries com backoff e jitter gastam o orçamento com sabedoria, timeouts colocam um teto nele, o circuit breaker para de gastar quando não há esperança e o fallback transforma uma falha em uma resposta degradada, mas honesta. Isso é uma API resiliente.
