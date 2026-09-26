---
title: "O plano Strangler Fig: migrando um monólito para a nuvem sem Big Bang"
description: "Migre um monólito uma rota por vez, com dono claro para os dados e rollback por fatia."
date: 2026-06-14
tags: [Cloud Architecture, Migration, Strangler Fig, .NET, YARP]
tldr:
  - "Reescritas big bang perseguem um alvo em movimento e não entregam nada até o fim; a migração strangler fig entrega valor rota a rota."
  - "Uma facade roteia cada fatia para o monólito ou o serviço novo, com canary percentual sticky e rollback só de configuração por rota."
  - "Os dados são a migração de verdade: use CDC e uma anti-corruption layer, evite dual writes e apague o código antigo quando a rota estabilizar."
---

Todo pitch de migração de monólito tem o mesmo slide. À esquerda, um deployable gigante e um banco com quatrocentas tabelas. À direita, serviços limpos e bancos gerenciados. No meio, uma única seta escrita "reescrita". É na seta que os projetos morrem.

Este post é a alternativa à seta: por que reescritas big bang falham, como o padrão strangler fig as substitui por movimentos pequenos e reversíveis, como lidar com os dados, e uma facade funcional em .NET 10 feita com YARP, com canary fixo por usuário, rollback de uma linha e uma anti-corruption layer testada. O Júnior Inocente tem perguntas pelo caminho.

## O problema e o contexto

Uma reescrita big bang congela o sistema antigo, reconstrói tudo em paralelo e faz a virada num fim de semana escolhido. Parece limpo. Na prática, falha de jeitos previsíveis:

- **O alvo não para de se mexer.** O negócio não para enquanto você reescreve. Cada funcionalidade adicionada ao monólito durante o projeto também precisa existir no sistema novo antes do lançamento, então a linha de chegada se afasta enquanto você corre na direção dela.
- **Nada vai para produção até o fim.** Meses de trabalho geram zero valor e zero feedback de produção. Você descobre se o sistema novo aguenta tráfego real justamente no dia em que menos pode errar.
- **O sistema antigo é a única especificação completa.** Ninguém conhece todas as regras enterradas nele, como o desconto que só vale para faturas emitidas antes de certa data. A reescrita deixa algumas de fora, e você descobre quais depois da virada.
- **O rollback é tudo ou nada.** Se a virada der errado, o único caminho de volta é reverter tudo, muitas vezes depois que os dados já divergiram.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas o código antigo é tão ruim. Não seria mais rápido começar do zero, com um design limpo, sem carregar essa bagagem toda?</span>
    </div>
  </div>
</div>

Mais rápido para começar, sim. Mais rápido para terminar, quase nunca. A "bagagem" são anos de correções de bugs e regras de negócio que existem por motivos que ninguém documentou. Um design do zero joga isso fora junto com o código feio e depois redescobre tudo, um incidente de produção por vez. O objetivo é substituir o código antigo sem apostar tudo num único fim de semana.

### De onde vem o nome

Martin Fowler batizou o padrão em 2004, inspirado nas figueiras estranguladoras (strangler figs) que viu nas florestas tropicais de Queensland, na Austrália. A figueira nasce nos galhos altos de uma árvore hospedeira, desce raízes até o chão e vai crescendo em volta da hospedeira até se sustentar sozinha. Ele chamou primeiro de "Strangler Application" e depois renomeou para "Strangler Fig Application", para deixar a metáfora mais clara.

Em software: você constrói o sistema novo pelas bordas do antigo, migra funcionalidades pedaço por pedaço com os dois rodando em produção e, no fim, o monólito fica sem nada para fazer. Em todos os pontos do caminho, o sistema funciona.

## Mergulho na arquitetura

O padrão tem três peças: uma **facade** que decide para onde vai cada requisição, **serviços novos** que assumem fatias da funcionalidade e uma **estratégia de dados** que permite a cada fatia ser dona dos seus dados sem quebrar o monólito.

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

### A facade

Comece colocando um reverse proxy na frente do monólito e passando 100% do tráfego por ele **antes** de migrar qualquer coisa. No primeiro dia ele encaminha todos os paths para o monólito e não muda nada, e é justamente essa a ideia: você inseriu o ponto de controle sem mudar comportamento. Daí em diante, migrar uma fatia significa mudar uma rota, não mudar clientes.

No Azure, o API Management oferece policies e versionamento, e o Application Gateway faz roteamento por path na camada 7. O YARP é uma biblioteca .NET para construir o seu próprio proxy quando o roteamento precisa de código de verdade. A diretiva `split_clients` do NGINX faz divisões percentuais baseadas em hash, e um Application Load Balancer da AWS suporta target groups com peso. Escolha o que o seu time já opera.

Mantenha a facade fina: ela roteia, divide tráfego e adiciona headers. Quando começa a transformar payloads ou guardar regras de negócio, vira um novo monólito no meio da sua arquitetura.

### Escolhendo a primeira fatia

A primeira fatia ensina o time a migrar, então escolha pensando em aprendizado, não em glória. Bons candidatos são:

- **Baixo risco.** Uma falha é incômoda, não um evento de receita. Leitura de perfil de cliente, não captura de pagamento.
- **Fronteiras claras.** Um conjunto distinto de URLs e poucas tabelas. Se toca trinta tabelas por stored procedures compartilhadas, não é a primeira.
- **Muita leitura.** Leituras podem vir de uma cópia replicada enquanto as escritas ficam no monólito, o que adia o problema mais difícil (quem é dono das escritas).
- **Em evolução ativa.** Uma fatia que o negócio quer evoluir entrega valor visível cedo.

### A anti-corruption layer

O serviço novo não deveria adotar o modelo do monólito só porque os dados vêm de lá. Eric Evans descreveu a **anti-corruption layer** em *Domain-Driven Design*: uma fronteira de tradução entre um modelo legado e o seu novo modelo de domínio, para que conceitos legados (códigos de status enigmáticos, nomes guardados como `"SANTOS, ANA"` numa coluna CHAR com padding, datas como strings `"20190312"`) não vazem para o código novo. Cada regra estranha que você descobre vai para um único tradutor com teste, em vez de ser redescoberta em cinco lugares.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O tradutor não é código descartável? Quando o monólito sumir a gente apaga, então para que se dar ao trabalho de testar?</span>
    </div>
  </div>
</div>

Ele pode viver por anos e, enquanto vive, é onde o serviço novo pode corromper dados em silêncio. Um tradutor que mapeia um código de status desconhecido para "Active" em vez de falhar produz respostas erradas para cada linha que não entende. Teste pesado, faça-o rejeitar o que não consegue traduzir fielmente e, sim, apague-o junto com o monólito.

### Dados: a migração de verdade

Rotear é a parte fácil. A pergunta que decide a migração é: **quem é dono de cada dado, e como ele se move?** As estratégias comuns, mais ou menos na ordem de quanto tempo deveriam durar:

- **Banco compartilhado (temporário).** O serviço novo lê as tabelas do monólito diretamente. É o começo mais rápido, mas acopla o serviço novo ao schema antigo: renomear uma coluna no monólito quebra o serviço, e você não consegue mudar o modelo. Trate como andaime com data de validade.
- **Change data capture.** Ferramentas como o Debezium, ou o CDC nativo do SQL Server e de outros bancos, leem o log de transações e publicam as mudanças de linha como eventos. O serviço novo as consome pela ACL para o seu próprio store, sem mexer no monólito. O trade-off é a consistência eventual, com um atraso que você precisa medir.
- **Dual reads.** Um job de comparação lê dos dois stores e reporta diferenças. É assim que você prova que a cópia está correta antes de confiar nela.
- **Mover a posse das escritas.** Em algum momento as escritas da fatia passam para o serviço novo. O store novo vira a fonte da verdade e, se o monólito ainda precisar dos dados, as mudanças voltam para ele via eventos.

<div class="callout warning" data-title="Atenção">
  <p>Evite dual writes: código que grava no banco antigo e depois no novo (ou chama dois serviços) na mesma requisição. Quando a segunda escrita falha, os stores divergem, e não existe transação que abranja os dois. Grave em um store só e propague a mudança: publique a partir do log desse store com CDC, ou use o padrão transactional outbox, em que o evento é inserido na mesma transação local dos dados e um relay o publica depois.</p>
</div>

### Shadow traffic, canaries e rollback

Antes que qualquer usuário veja o serviço novo, faça **shadow**: copie requisições reais para ele, descarte as respostas e compare com as do monólito. A diretiva `mirror` do NGINX e service meshes como o Istio suportam espelhamento de requisições. Faça shadow só de leituras, ou mande as escritas espelhadas para um store isolado, ou você vai cobrar um cliente duas vezes.

Depois mova tráfego real com um **canary**: 1%, 5%, 25%, 100%. A divisão precisa ser **sticky**: faça hash de uma chave estável (id do usuário, id da conta) para que o mesmo usuário sempre caia do mesmo lado. Roteamento aleatório por requisição faz o usuário pular entre implementações e gera bugs que ninguém consegue reproduzir.

Toda rota migrada também precisa de um **rollback de uma única mudança**: vire a rota (ou ponha o canary em 0%) e o tráfego volta para o monólito em segundos, sem deploy. Isso só funciona enquanto o monólito ainda consegue atender a rota, mais um motivo para manter a posse das escritas lá até o caminho novo se provar.

## Implementação na prática

Vamos construir uma **Facade** (reverse proxy com YARP), um monólito **Legacy** de mentira, um serviço de clientes **Modern**, uma biblioteca **Customers.Acl** e um projeto de testes. A rota de clientes roda como canary sticky de 10%, todo o resto vai para o monólito, e o rollback é uma edição de configuração. Você precisa do SDK do .NET 10.

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

### A tabela de rotas

A rota `customers` aponta para um cluster com dois destinos marcados por metadata. A rota `monolith` pega todo o resto; o `Order` alto faz dela o último recurso.

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

### Canary sticky no pipeline do proxy

O YARP não tem roteamento com peso embutido, mas você pode adicionar middleware ao pipeline do proxy. O nosso lê `CanaryPercent` do cluster encontrado, escolhe uma fatia e restringe os destinos disponíveis aos daquela fatia.

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

O bucket vem de um SHA-256 da chave do usuário, não de `string.GetHashCode()`, que no .NET é aleatorizado por processo e embaralharia os usuários a cada restart. Um bucket abaixo de 10 também está abaixo de 25, então aumentar o percentual só adiciona usuários ao serviço novo. Requisições sem chave de usuário ficam no legado, e um header de override permite que testers forcem qualquer um dos lados.

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

Com um pipeline customizado, o YARP deixa de adicionar os middlewares padrão, então recolocamos o load balancing depois do nosso filtro. Os arquivos `Program.cs` dependem dos implicit usings do template.

### A anti-corruption layer

O tradutor transforma linhas de `CUSTOMER` vindas do CDC no modelo de domínio: remove o padding do CHAR, separa o nome, mapeia os códigos de status (incluindo o código de soft delete `X`) e recusa tudo que não consegue traduzir fielmente.

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

O `ToLegacy` existe para comparação, para que um job de dual read consiga comparar os dois stores. O mapeamento perde informação de propósito (`X` volta como `C`), uma decisão que você documenta, não um acidente.

### Os dois backends

O serviço moderno monta seus dados a partir das linhas legadas replicadas, passando pela ACL, e expõe **o mesmo contrato público** do monólito. Os dois adicionam um header `X-Served-By` para conseguirmos distingui-los.

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

### Testes do tradutor e da divisão

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

### Rode e depois faça rollback

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

Os 20 testes passam. A requisição de pedidos sempre mostra `X-Served-By: legacy`. Na rota de clientes, `user-6` cai no bucket moderno e `user-1` no legado, e os dois recebem um corpo JSON idêntico.

Agora faça o rollback: troque `"CanaryPercent": "10"` por `"0"` em `Facade/appsettings.json` e salve. O YARP recarrega a configuração, então segundos depois `user-6` está de volta em `X-Served-By: legacy`, sem restart. Volte para 10 e os mesmos usuários retornam ao lado moderno, porque os buckets deles nunca mudaram.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O header de override é prático. Dá para deixar ligado em produção, para o suporte trocar o cliente de lado quando ele ligar?</span>
    </div>
  </div>
</div>

Não do jeito que está. Qualquer cliente pode mandar esse header e escolher o backend. Em produção, remova o `X-Route-Override` na borda e só o respeite para usuários internos autenticados. O mesmo vale para o `X-User-Id`: derive a chave de roteamento de um token validado ou de um cookie definido pela borda, nunca de um header que o cliente pode forjar.

<div class="callout tip" data-title="Dica">
  <p>Trate a tabela de rotas como código: mude percentuais via pull request e deixe o pipeline publicá-los na sua fonte de configuração. Assim cada passo do canary e cada rollback tem autor e diff.</p>
</div>

## Checagem de realidade em produção

### Observabilidade define o seu ritmo

Você só consegue subir o canary na velocidade em que consegue comparar os dois lados. Registre a fatia (aqui, o header `X-Slice`) em logs e traces, e quebre taxa de erro e latência por rota e por fatia. Sem isso, "o serviço novo parece ok" é a sua única evidência.

### A facade agora é infraestrutura crítica

Toda requisição passa por ela, então ela precisa de múltiplas instâncias, health checks, folga de capacidade e dashboards próprios. Ela também adiciona um salto de rede; meça essa latência cedo em vez de descobri-la em 100%.

### O descomissionamento faz parte do plano

Uma rota parada em 100% há semanas só está terminada quando você apaga o código do monólito daquela fatia, remove as tabelas que ele não possui mais (depois de um backup final) e tira o conector de CDC e o destino legado. Pule essa etapa e você roda dois sistemas para sempre. Coloque as tarefas de descomissionamento no backlog quando a fatia começar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Quando o serviço novo estiver com todo o tráfego, por que a pressa de apagar o código antigo? Ele não está atrapalhando ninguém ali parado.</span>
    </div>
  </div>
</div>

Está, só que em silêncio. Código morto continua sendo compilado, recebendo patches e sendo lido por quem tenta entender o sistema. Tabelas antigas continuam recebendo escritas de jobs esquecidos, e alguém monta um relatório em cima da cópia desatualizada. Quando você não vai mais fazer rollback, apagar é o que torna a migração real.

### A organização também precisa se mover

Uma migração strangler fig leva meses ou anos, então precisa de ownership explícito: um time é dono da facade e da tabela de rotas, e cada fatia tem um time dono dela de ponta a ponta, descomissionamento incluído. Combine cedo que funcionalidades novas de domínios migrados vão só para o serviço novo, ou o alvo continua se mexendo. Se a migração também for uma mudança entre nuvens ou regiões, decida primeiro onde os dados ficam, como discutido em [Multi-Cloud Without the Pain: Patterns That Survive Contact with Reality](/pt-br/blog/multi-cloud-patterns/).

<div class="callout info" data-title="Info">
  <p>Nem todo módulo precisa de um serviço novo. Módulos estáveis que raramente mudam podem ficar num monólito menor; é um estado final legítimo. O objetivo é um sistema mais fácil de mudar, não uma contagem de serviços.</p>
</div>

O strangler fig troca uma virada dramática por dezenas de viradas chatas e reversíveis: uma facade na frente, uma fatia com fronteiras claras, tradução na fronteira, dados antes do tráfego, canaries sticky, rollback de uma linha e remoção do que foi substituído. Chato é exatamente o que você quer de uma migração que acontece enquanto os clientes usam o sistema.
