---
title: Observabilidade desde o início
short: Se você só instrumenta depois do primeiro grande incidente, vai depurar no escuro. Afinal, quem quer caçar a causa raiz às 3 da manhã só com um console.log("aqui")?
category: solution
---

## Introdução

Imagina a cena: são 3 da manhã, o celular não para de vibrar e o checkout está falhando para alguns clientes. Não todos, só alguns. Você abre os logs e encontra esta obra-prima:

```text
aqui
aqui 2
aqui
chegou aqui!!!
undefined
```

Pois é. *É raro, mas acontece bastante*... Quem nunca? O código foi escrito na correria, "depois a gente coloca log decente", e o depois chegou às 3 da manhã em forma de incidente. Agora você está reconstruindo na cabeça o que aconteceu, chutando hipóteses, subindo deploy com mais `console.log` e rezando para o problema aparecer de novo.

**Observabilidade desde o início** (*Observability First*) é o princípio que diz: **instrumentação faz parte da funcionalidade, desde o primeiro dia**. A **meta** é simples: quando algo der errado (e vai dar), o time precisa conseguir responder *o que* quebrou, *onde*, *para quem* e *por quê* em minutos, não em horas. Em outras palavras, manter o MTTR (*Mean Time To Recovery*, tempo médio de recuperação) o mais baixo possível.

Quando o time ignora esse princípio, os sintomas são sempre os mesmos:

- Incidentes descobertos pelos clientes, nas redes sociais, antes de qualquer alerta disparar;
- Logs em texto solto, impossíveis de filtrar, sem como seguir uma requisição entre serviços;
- Todo incidente vira arqueologia: "qual serviço foi? qual versão? qual cliente?";
- *Dashboards* cheios de gráficos bonitos que ninguém olha e que não respondem a pergunta do dia;
- Centenas de alertas por semana, a maioria ruído, então aquele que importa é ignorado;
- Uma conta de telemetria que cresce mais rápido que o tráfego, porque tudo é logado e nada é útil;
- Dados de clientes (e-mails, tokens, números de cartão) em texto puro nos arquivos de log;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas a gente tem log! Eu coloquei um console.log em cada função, e o provedor de nuvem já mostra CPU e memória. Isso não é observabilidade?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Ter *dados* não é a mesma coisa que ter *respostas*. Um `console.log("aqui")` diz que o código passou por uma linha; não diz qual usuário, qual requisição, qual versão, quanto tempo levou nem o que aconteceu nos outros três serviços envolvidos. E CPU em 40% não diz nada sobre os clientes estarem conseguindo pagar ou não. Observabilidade é conseguir fazer perguntas novas ao sistema **sem precisar subir código novo** para respondê-las.

<div class="callout info">
  <p>Observabilidade não é uma ferramenta que você compra depois do go-live. É uma propriedade de design do sistema, assim como segurança ou testabilidade. Se não for planejada desde o início, vai ter que ser remendada depois, sob pressão, normalmente no meio de um incidente.</p>
</div>

## Por que o MTTR é a métrica que importa

Todo incidente tem uma linha do tempo. Algo quebra, alguém (ou alguma coisa) percebe, alguém assume, o time entende o que está acontecendo e, finalmente, o serviço volta. Cada um desses trechos tem nome, e cada um pode ser encurtado, ou esticado, pela qualidade da instrumentação do sistema.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="obs-d1-title obs-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d1-title">Linha do tempo de um incidente: MTTD, MTTA e MTTR</title>
<desc id="obs-d1-desc">Uma linha do tempo do início da falha até o serviço ser restabelecido. Detecção, reconhecimento, diagnóstico e correção aparecem como trechos consecutivos, e o MTTR cobre o intervalo inteiro.</desc>
<defs><marker id="obs-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">LINHA DO TEMPO DO INCIDENTE</text>
<text x="60" y="92" text-anchor="middle" class="d-small">Falha</text>
<text x="60" y="108" text-anchor="middle" class="d-small">começa</text>
<text x="240" y="92" text-anchor="middle" class="d-small">Detectada</text>
<text x="240" y="108" text-anchor="middle" class="d-small">(alerta dispara)</text>
<text x="340" y="92" text-anchor="middle" class="d-small">Reconhecida</text>
<text x="340" y="108" text-anchor="middle" class="d-small">(plantão)</text>
<text x="540" y="92" text-anchor="middle" class="d-small">Causa raiz</text>
<text x="540" y="108" text-anchor="middle" class="d-small">encontrada</text>
<text x="640" y="92" text-anchor="middle" class="d-small">Serviço</text>
<text x="640" y="108" text-anchor="middle" class="d-small">restaurado</text>
<line x1="40" y1="140" x2="690" y2="140" class="d-line" marker-end="url(#obs-d1-arrow)"/>
<circle cx="60" cy="140" r="6" class="d-fill-danger"/>
<circle cx="240" cy="140" r="6" class="d-fill-warn"/>
<circle cx="340" cy="140" r="6" class="d-fill-warn"/>
<circle cx="540" cy="140" r="6" class="d-fill-info"/>
<circle cx="640" cy="140" r="6" class="d-fill-accent"/>
<rect x="60" y="165" width="180" height="36" rx="10" class="d-box-danger"/>
<text x="150" y="188" text-anchor="middle" class="d-text">MTTD</text>
<rect x="240" y="165" width="100" height="36" rx="10" class="d-box-warn"/>
<text x="290" y="188" text-anchor="middle" class="d-text">MTTA</text>
<rect x="340" y="165" width="200" height="36" rx="10" class="d-box-info"/>
<text x="440" y="188" text-anchor="middle" class="d-text">Diagnóstico</text>
<rect x="540" y="165" width="100" height="36" rx="10" class="d-box-accent"/>
<text x="590" y="188" text-anchor="middle" class="d-text">Correção</text>
<line x1="62" y1="225" x2="638" y2="225" class="d-line-accent" marker-start="url(#obs-d1-arrow)" marker-end="url(#obs-d1-arrow)"/>
<text x="350" y="248" text-anchor="middle" class="d-small">MTTR: da falha até a recuperação</text>
<text x="350" y="275" text-anchor="middle" class="d-small">Boa telemetria encolhe principalmente os trechos vermelho e azul</text>
</svg>
</div>
<figcaption>Figura 1: A linha do tempo de um incidente e onde a observabilidade se paga</figcaption>
</figure>

- **MTTD (*Mean Time To Detect*):** quanto tempo entre o início da falha e alguém ficar sabendo. Sem bons alertas, isso é medido em "quanto tempo até um cliente reclamar".
- **MTTA (*Mean Time To Acknowledge*):** quanto tempo até alguém assumir o problema. Depende muito do processo de plantão e da qualidade dos alertas.
- **Diagnóstico:** o trecho que ninguém nomeia, mas todo mundo sofre. É aqui que o time do `console.log("aqui")` perde horas.
- **MTTR (*Mean Time To Recovery/Restore*):** a viagem inteira, da falha ao serviço restabelecido. A definição varia entre empresas (algumas começam a contar na detecção), então combinem uma e sigam com ela.

Repare numa coisa: a *correção* costuma ser a parte curta. Fazer *rollback* de um deploy ou desligar uma *feature flag* leva minutos. O que consome a madrugada é **não saber**. E é exatamente essa parte que a observabilidade ataca.

<div class="callout tip">
  <p>A escala de plantão, os runbooks, os postmortems e toda a cultura em torno de incidentes pertencem à <a href="/pt-br/principles/cloud/operational-excellence/">Excelência Operacional</a>. Aqui o foco é a base técnica que faz essas práticas funcionarem: os sinais que o seu sistema emite.</p>
</div>

## Monitoramento vs Observabilidade

As duas palavras são usadas como sinônimos, mas respondem perguntas diferentes.

**Monitoramento** lida com os **problemas conhecidos** (*known unknowns*): você já sabe o que pode dar errado, então fica de olho. "Me avisa se o disco passar de 90%", "me avisa se a taxa de erro passar de 2%". É essencial, mas só cobre as falhas que você imaginou antes.

**Observabilidade** lida com os **problemas desconhecidos** (*unknown unknowns*): as falhas que ninguém previu. "Por que só os clientes do Nordeste, no app Android, usando um cupom específico, estão tomando *timeout* desde o deploy de terça?" Nenhum *dashboard* foi construído para essa pergunta. Um sistema observável permite fatiar a telemetria por qualquer dimensão (região, versão do app, cupom, cliente, *feature flag*) e achar a resposta explorando, não subindo deploy.

| Aspecto | Monitoramento | Observabilidade |
| :--- | :--- | :--- |
| **Tipo de pergunta** | Conhecida de antemão | Descoberta durante a investigação |
| **Artefato típico** | *Dashboards* e alertas por limiar | Telemetria rica em contexto e consultável |
| **Responde** | "Está quebrado?" | "Por que está quebrado, e para quem?" |
| **Depende de** | Escolher as métricas certas | Contexto rico em cada evento (IDs, versões, atributos) |

Monitoramento é um subconjunto de observabilidade, não um concorrente. Você continua precisando dos seus alertas; só precisa que eles sejam o ponto de partida de uma investigação, não o fim dela.

## Os Sinais

A telemetria vem em alguns sabores. Cada um é bom em uma coisa e ruim em outra, e a mágica acontece quando eles estão **conectados**.

### Logs

Eventos discretos com contexto: "o pedido 123 foi recusado porque o cartão foi negado". Ótimos para detalhe, caros em volume. A regra de ouro é o **log estruturado** (*structured logging*): emita JSON (ou outro formato chave/valor), não texto livre. Compare:

```text
Pagamento falhou para o usuário joao@exemplo.com, valor 150.00
```

```json
{
  "timestamp": "2026-09-26T03:12:45.123Z",
  "level": "error",
  "service": "checkout",
  "version": "2.14.1",
  "event": "payment.declined",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "user_id": "u_81723",
  "order_id": "ord_5521",
  "amount_cents": 15000,
  "provider": "acme-pay",
  "reason": "insufficient_funds",
  "duration_ms": 842
}
```

O segundo pode ser filtrado, agregado e cruzado com outros sinais. E também não tem e-mail nenhum (já já falamos disso). Repare no `trace_id`: é ele o fio que amarra tudo.

### Métricas

Números agregados ao longo do tempo: requisições por segundo, taxa de erro, latência p99, tamanho de fila. Baratas para armazenar, rápidas de consultar, perfeitas para alertas e tendências. O ponto fraco: perdem o detalhe individual. A métrica diz "a latência p99 subiu"; não diz qual requisição nem por quê.

### Traces

Um *trace* acompanha **uma requisição** por todos os serviços que ela toca. Cada salto é um *span*, com horário de início, duração, atributos e status. *Traces* respondem "para onde foi o tempo?" e "qual dependência falhou?", perguntas quase impossíveis de responder só com logs em um sistema distribuído.

### Eventos e profiles

Dois sinais que completam o quadro:

- **Eventos:** registros estruturados de coisas relevantes (um deploy, a mudança de uma *feature flag*, uma alteração de configuração). Sobrepor marcadores de deploy nos gráficos responde sozinho metade das perguntas de um incidente: "começou logo depois do release?"
- **Profiling contínuo:** amostras de para onde estão indo CPU e memória, até o nível de função. Quando o *trace* diz "esse *span* levou 2 segundos no nosso próprio código", o *profile* diz qual função queimou esse tempo.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="obs-d2-title obs-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d2-title">Logs, traces e métricas conectados por um ID compartilhado</title>
<desc id="obs-d2-desc">Uma única requisição carrega um trace ID. Ela produz logs, um trace e métricas. Os logs se ligam aos traces pelo trace ID e as métricas se ligam aos traces por exemplars.</desc>
<defs><marker id="obs-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="250" y="40" width="220" height="70" rx="10" class="d-box-accent"/>
<text x="360" y="70" text-anchor="middle" class="d-title">Uma requisição</text>
<text x="360" y="92" text-anchor="middle" class="d-small">trace_id = 4bf92f35...</text>
<line x1="330" y1="110" x2="130" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<line x1="360" y1="110" x2="360" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<line x1="390" y1="110" x2="590" y2="178" class="d-line" marker-end="url(#obs-d2-arrow)"/>
<rect x="30" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="120" y="208" text-anchor="middle" class="d-title">Logs</text>
<text x="120" y="228" text-anchor="middle" class="d-small">o que aconteceu</text>
<text x="120" y="245" text-anchor="middle" class="d-small">eventos discretos</text>
<rect x="270" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="360" y="208" text-anchor="middle" class="d-title">Traces</text>
<text x="360" y="228" text-anchor="middle" class="d-small">para onde foi o tempo</text>
<text x="360" y="245" text-anchor="middle" class="d-small">caminho entre serviços</text>
<rect x="510" y="180" width="180" height="80" rx="10" class="d-box-info"/>
<text x="600" y="208" text-anchor="middle" class="d-title">Métricas</text>
<text x="600" y="228" text-anchor="middle" class="d-small">quanto, com que frequência</text>
<text x="600" y="245" text-anchor="middle" class="d-small">agregados baratos</text>
<line x1="212" y1="222" x2="268" y2="222" class="d-line-dashed" marker-start="url(#obs-d2-arrow)" marker-end="url(#obs-d2-arrow)"/>
<line x1="452" y1="222" x2="508" y2="222" class="d-line-dashed" marker-start="url(#obs-d2-arrow)" marker-end="url(#obs-d2-arrow)"/>
<text x="240" y="208" text-anchor="middle" class="d-small">trace_id</text>
<text x="480" y="208" text-anchor="middle" class="d-small">exemplars</text>
<text x="360" y="288" text-anchor="middle" class="d-small">O mesmo ID em tudo: do alerta ao trace e ao log em poucos cliques</text>
</svg>
</div>
<figcaption>Figura 2: Os sinais só ficam poderosos quando estão correlacionados</figcaption>
</figure>

<div class="callout info">
  <p>O valor real não está em um sinal isolado. Está no <strong>salto</strong>: o alerta dispara em uma métrica, um <em>exemplar</em> leva você a um <em>trace</em> lento, o <em>trace</em> mostra o <em>span</em> que falhou, e o <code>trace_id</code> desse <em>span</em> leva direto aos logs daquela requisição exata. Sem correlação, cada sinal é uma ilha.</p>
</div>

## IDs de correlação e propagação de contexto

Em um monólito, uma requisição vive em um processo e em um arquivo de log. Em um sistema distribuído, um único clique pode passar por um *API gateway*, três microsserviços, uma fila, um *worker* e dois bancos de dados. Se cada um loga por conta própria, você fica com seis pilhas de linhas sem relação nenhuma.

A solução é a **propagação de contexto** (*context propagation*): um ID é criado na borda e viaja com a requisição por todos os saltos, seja em cabeçalhos HTTP, metadados de mensagens, metadados gRPC, qualquer que seja o transporte. O padrão da indústria é o **W3C Trace Context**, que define o cabeçalho `traceparent`:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

São quatro campos separados por hífen: a **versão** (`00`), o **trace ID** que identifica a requisição inteira, o **ID do span pai** de quem chamou e as **flags** (`01` significa "amostrado").

Existe também o cabeçalho `tracestate`, para dados específicos de fornecedor, e o **Baggage**, para o contexto de negócio que você quer carregar junto (cliente, plano, região). Use *baggage* com moderação: tudo que está nele viaja em todas as chamadas e pode vazar para terceiros se você não tomar cuidado.

Algumas regras práticas:

1. **Gere o ID na borda.** *API gateway*, *load balancer* ou o primeiro serviço que recebe a requisição.
2. **Propague através das fronteiras assíncronas.** Filas e barramentos de eventos são onde o contexto costuma morrer. Coloque o `traceparent` nos cabeçalhos da mensagem e restaure-o no consumidor.
3. **Registre o trace ID em toda linha de log.** A maioria das bibliotecas de log consegue injetá-lo automaticamente a partir do contexto ativo.
4. **Devolva o ID para o cliente.** Um `X-Request-Id` (ou o próprio trace ID) na resposta permite que o suporte pergunte "qual é o código que aparece na tela de erro?" e vá direto para o *trace*.

<div class="callout warning">
  <p>Cuidado com as fronteiras com terceiros. Aceitar um <code>traceparent</code> vindo da internet pública é ok para correlação, mas não deixe chamadores externos forçarem decisões de amostragem nem injetarem <em>baggage</em> em que seus serviços confiem cegamente.</p>
</div>

## OpenTelemetry: instrumente uma vez, envie para qualquer lugar

Durante anos, instrumentar significava instalar o agente de um fornecedor, usar o SDK desse fornecedor e ficar preso a ele para sempre. Trocar de ferramenta era reinstrumentar a base de código inteira. O **OpenTelemetry** (OTel), projeto da CNCF, resolveu isso padronizando a cadeia toda:

- **API e SDKs** para as principais linguagens, para criar *spans*, métricas e logs;
- **Autoinstrumentação** para *frameworks* e bibliotecas populares (servidores HTTP, *drivers* de banco, clientes de mensageria), então você ganha *traces* úteis quase sem escrever código;
- **OTLP**, o protocolo de transporte que todo *backend* sério já aceita;
- **Convenções semânticas** (*semantic conventions*), para que um status HTTP tenha o mesmo nome em qualquer linguagem e qualquer ferramenta;
- **O Collector**, um processo independente que recebe, processa e exporta a telemetria.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 290" role="img" aria-labelledby="obs-d3-title obs-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d3-title">Pipeline do OpenTelemetry</title>
<desc id="obs-d3-desc">Três serviços instrumentados com o SDK do OpenTelemetry enviam telemetria via OTLP para um Collector, que recebe, processa (amostragem, remoção de dados pessoais, lotes) e exporta para backends separados de métricas, traces e logs.</desc>
<defs><marker id="obs-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="24" text-anchor="middle" class="d-label">NEUTRO: TROQUE O BACKEND, MANTENHA O CÓDIGO</text>
<rect x="30" y="50" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="72" text-anchor="middle" class="d-text">API</text>
<text x="110" y="90" text-anchor="middle" class="d-small">SDK OTel</text>
<rect x="30" y="125" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="147" text-anchor="middle" class="d-text">Worker</text>
<text x="110" y="165" text-anchor="middle" class="d-small">SDK OTel</text>
<rect x="30" y="200" width="160" height="50" rx="10" class="d-box"/>
<text x="110" y="222" text-anchor="middle" class="d-text">Gateway de LLM</text>
<text x="110" y="240" text-anchor="middle" class="d-small">SDK OTel</text>
<line x1="190" y1="75" x2="263" y2="75" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="190" y1="150" x2="263" y2="150" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="190" y1="225" x2="263" y2="225" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<text x="228" y="142" text-anchor="middle" class="d-small">OTLP</text>
<rect x="265" y="40" width="210" height="220" rx="10" class="d-box-accent"/>
<text x="370" y="68" text-anchor="middle" class="d-title">OTel Collector</text>
<rect x="285" y="85" width="170" height="40" rx="10" class="d-box-info"/>
<text x="370" y="110" text-anchor="middle" class="d-text">Receber (OTLP)</text>
<rect x="285" y="140" width="170" height="52" rx="10" class="d-box-info"/>
<text x="370" y="162" text-anchor="middle" class="d-text">Processar</text>
<text x="370" y="180" text-anchor="middle" class="d-small">amostragem, PII, lotes</text>
<rect x="285" y="207" width="170" height="40" rx="10" class="d-box-info"/>
<text x="370" y="232" text-anchor="middle" class="d-text">Exportar</text>
<line x1="475" y1="75" x2="548" y2="75" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="475" y1="150" x2="548" y2="150" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<line x1="475" y1="225" x2="548" y2="225" class="d-line" marker-end="url(#obs-d3-arrow)"/>
<rect x="550" y="50" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="80" text-anchor="middle" class="d-text">Base de métricas</text>
<rect x="550" y="125" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="155" text-anchor="middle" class="d-text">Backend de traces</text>
<rect x="550" y="200" width="160" height="50" rx="10" class="d-box"/>
<text x="630" y="230" text-anchor="middle" class="d-text">Base de logs</text>
<text x="370" y="282" text-anchor="middle" class="d-small">É no Collector que moram as decisões de custo, privacidade e roteamento</text>
</svg>
</div>
<figcaption>Figura 3: Os serviços emitem OTLP, o Collector decide o que vai para onde</figcaption>
</figure>

Começar em Node.js leva poucas linhas, e a autoinstrumentação cobre HTTP, Express, *drivers* de banco e muito mais:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  serviceName: "checkout",
  traceExporter: new OTLPTraceExporter({ url: "http://otel-collector:4318/v1/traces" }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

A autoinstrumentação entrega o esqueleto. A carne vem dos **atributos de negócio** que você mesmo adiciona: `order.id`, `payment.provider`, `tenant.id`, `feature_flag.new_checkout`. São exatamente essas as dimensões que você vai querer fatiar às 3 da manhã.

```ts
const span = trace.getActiveSpan();
span?.setAttributes({
  "order.id": order.id,
  "payment.provider": provider,
  "cart.items": cart.items.length,
});
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pra que esse negócio de Collector? Não dá pra só instalar o agente do fornecedor, apontar pra nuvem dele e pronto?"</span>
    </div>
  </div>
</div>

Dá, Júnior, e num sistema pequeno pode até funcionar no começo. Mas pensa no que acontece ano que vem, quando a renovação do contrato vier com 40% de aumento, ou quando o jurídico disser que certos dados não podem sair da região. Com SDKs de fornecedor espalhados por cinquenta serviços, trocar vira um projeto de reinstrumentação. Com OTel no código e um Collector no meio, trocar é uma mudança de configuração. O Collector também te dá um lugar só para **descartar dados ruidosos, mascarar PII, amostrar *traces* e rotear** sinais para *backends* diferentes (armazenamento barato para logs de *debug*, ferramenta *premium* para *traces*). Isso é arquitetura: manter opções abertas onde o custo de mudar é alto.

## O que medir: RED, USE e os Golden Signals

"Instrumentar tudo" não é estratégia. Você precisa de uma lista curta de métricas que diga, de relance, se as coisas estão saudáveis. Três *frameworks* conhecidos cobrem a maioria dos casos.

### RED (para serviços)

Para todo serviço orientado a requisições (APIs, microsserviços, *endpoints*):

- **Rate (taxa):** requisições por segundo;
- **Errors (erros):** requisições com falha por segundo (ou em percentual);
- **Duration (duração):** distribuição de latência (p50, p95, p99, nunca só a média).

### USE (para recursos)

Proposto por Brendan Gregg, para todo recurso (CPU, memória, discos, *pools* de conexão, filas):

- **Utilization (utilização):** o quanto o recurso está ocupado;
- **Saturation (saturação):** quanto trabalho está esperando (tamanho de fila, conexões pendentes);
- **Errors (erros):** eventos de erro naquele recurso.

### Os Quatro Golden Signals (Google SRE)

Do livro de SRE do Google: **latência, tráfego, erros e saturação**. Basicamente RED mais saturação, com uma nuance importante sobre latência: meça a latência das requisições bem-sucedidas e das que falharam separadamente, porque um erro rápido continua sendo erro e pode deixar suas médias lindas enquanto os clientes sofrem.

| Framework | Melhor para | Pergunta-chave |
| :--- | :--- | :--- |
| **RED** | Serviços e *endpoints* | "Meus usuários estão sendo bem atendidos?" |
| **USE** | Recursos de infraestrutura | "Tem alguma coisa ficando sem capacidade?" |
| **Golden Signals** | Qualquer sistema voltado ao usuário | "O serviço está saudável, do ponto de vista de quem usa?" |

<div class="callout tip">
  <p>Use percentis, não médias. Uma latência média de 200ms pode esconder que 1% das requisições leva 8 segundos. E esse 1% muitas vezes são os seus maiores clientes, os de carrinho mais cheio ou com mais dados.</p>
</div>

## SLIs, SLOs e alertas por sintoma

As métricas ficam realmente úteis quando estão ligadas ao que o usuário vive. É aí que entram os SLIs e SLOs.

- **SLI (*Service Level Indicator*):** uma medida da experiência do usuário, normalmente uma razão entre eventos bons e eventos totais. Exemplo: "percentual de requisições de checkout que dão certo em menos de 1 segundo".
- **SLO (*Service Level Objective*):** a meta para esse SLI em uma janela de tempo. Exemplo: "99,5% em 30 dias".
- ***Error budget*** (orçamento de erro): o que sobra. Com 99,5%, você pode "gastar" 0,5% das requisições com falhas. Orçamento saudável? Entregue mais rápido. Orçamento queimando? Desacelere e invista em confiabilidade. (A relação com SLAs e o desenho de disponibilidade ficam em [Confiabilidade](/pt-br/principles/cloud/reliability/).)

### Alerte por sintoma, não por causa

Essa é a regra de alertas mais importante, e a mais ignorada. **Alertas por causa** ("CPU acima de 80%", "pod reiniciou", "disco em 85%") disparam o tempo todo sem nenhum impacto no usuário e, mesmo assim, deixam passar as falhas que você não imaginou. **Alertas por sintoma** ("taxa de erro do checkout acima do SLO", "latência p99 queimando o *error budget*") disparam quando o usuário está de fato sofrendo, seja qual for a causa.

O *SRE Workbook* recomenda **alertas por taxa de consumo** (*burn rate*): acione alguém quando o *error budget* estiver sendo consumido rápido o bastante para acabar logo (por exemplo, 2% do orçamento mensal em uma hora) e abra um chamado para consumos lentos. Isso pega tanto as quedas repentinas quanto as degradações lentas, com muito menos ruído que limiares fixos.

Todo acionamento deveria passar por um teste simples:

1. **É urgente?** Se pode esperar até de manhã, é chamado, não acionamento.
2. **É acionável?** Se quem está de plantão não pode fazer nada, não deveria ser acordado.
3. **Reflete impacto no usuário?** Se o usuário não sente, questione por que está acionando alguém.
4. **Tem link para runbook e *dashboard*?** Alerta sem contexto só dá início a uma caça ao tesouro.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior preocupado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Não entendi. Por que não alertar tudo? Mais alerta quer dizer que a gente nunca deixa nada passar, né?"</span>
    </div>
  </div>
</div>

Essa é a armadilha, Júnior! O nome disso é **fadiga de alertas** (*alert fatigue*). Quando o canal recebe 300 alertas por dia, o pessoal silencia, e aquele único alerta que importava se afoga junto com o resto. É o efeito alarme de carro: quando todo carro da rua dispara o tempo todo, ninguém nem olha mais pela janela. Poucos alertas, cada um com significado, ganham de uma mangueira de incêndio todas as vezes. Uma meta saudável é que quase todo acionamento gere uma ação real; se a maioria é "ignora, volta sozinho", esses alertas precisam ir embora.

### Dashboards por público

Um *dashboard* que tenta atender todo mundo não atende ninguém. Monte por público:

| Público | O que mostra | Pergunta que responde |
| :--- | :--- | :--- |
| **Negócio / produto** | Pedidos por minuto, conversão, receita em risco | "O negócio está funcionando agora?" |
| **Donos do serviço** | SLOs, *error budget*, RED por *endpoint*, marcadores de deploy | "Meu serviço está saudável, e o último release piorou algo?" |
| **Plantão / investigação** | Detalhamento por região, versão, cliente; links para *traces* e logs | "Onde exatamente está o problema?" |
| **Plataforma / infra** | USE por recurso, saturação, tendência de capacidade | "Tem algo prestes a acabar?" |

Reserve o topo de todo *dashboard* para os sintomas que o usuário sente, e os detalhes embaixo. Se um painel não é olhado há seis meses, apague.

## Observabilidade para aplicações de LLM e IA

Funcionalidades de IA trazem a sua própria versão do "na minha máquina funciona". O mesmo *prompt* pode gerar respostas diferentes, a latência varia muito, o custo é por *token*, e as falhas muitas vezes são **silenciosas**: a chamada devolve 200 OK com uma resposta confiante e errada. A telemetria tradicional não basta.

O que capturar em cada chamada ao modelo:

- ***Tokens* de entrada e saída**, por requisição, por funcionalidade e por cliente. *Tokens* são o seu *driver* de custo, e um *prompt* que dobrou de tamanho sem ninguém perceber aparece aqui primeiro (ligue isso à [Transparência de Custos](/pt-br/principles/solution/cost-transparency/));
- **Latência separada**: tempo até o primeiro *token* e tempo total de geração. Em interfaces com *streaming*, o tempo até o primeiro *token* é o que o usuário sente;
- **Versão do modelo e do *prompt***, para comparar qualidade e custo antes e depois de uma mudança;
- **Chamadas de ferramentas e etapas de recuperação** como *spans* filhos (em fluxos de RAG ou agentes), para ver qual etapa está lenta ou falhando;
- **Erros, recusas, *rate limits* e truncamentos** (o modelo parou porque atingiu o máximo de *tokens*);
- **Sinais de qualidade**: *feedback* do usuário (joinha para cima ou para baixo), notas de avaliação, disparos de *guardrails*.

O OpenTelemetry já tem **convenções semânticas de GenAI** exatamente para isso (atributos para nome do modelo, uso de *tokens*, operação), então você não precisa inventar seu próprio esquema.

<div class="callout warning" data-title="Prompts são dados do usuário">
  <p>Prompts e respostas costumam conter dados pessoais, documentos confidenciais e segredos que o usuário colou ali. Não logue tudo por padrão. Amostre um percentual pequeno, remova PII antes de armazenar, restrinja quem pode ler, defina uma retenção curta e respeite o que a sua política de privacidade promete. Capturar conteúdo deve ser uma decisão explícita e revisada, não um efeito colateral de ligar o modo <em>debug</em>.</p>
</div>

## Cardinalidade, custo e amostragem

Chegou a parte que ninguém menciona na demo do fornecedor: telemetria custa dinheiro, às vezes muito. Não é raro ver a conta de observabilidade brigando de igual para igual com a conta de computação.

### Cardinalidade

Em métricas, cada combinação única de valores de *labels* vira uma série temporal separada. `http_requests_total{route, status}` com 50 rotas e 10 status é igual a 500 séries. Adicione `user_id` com um milhão de usuários e você acabou de criar 500 milhões de séries, e uma fatura bem desagradável.

- **Métricas:** use *labels* com valores limitados (template da rota, classe do status, região, versão). Nunca IDs crus, URLs completas, e-mails ou texto livre.
- ***Traces* e logs:** é aqui que dado de alta cardinalidade deve morar. `user_id`, `order_id` e `tenant_id` como atributos de *span* são perfeitamente aceitáveis, e é exatamente isso que deixa as investigações rápidas.

### Amostragem: head vs tail

Você raramente precisa de 100% dos *traces* de um sistema saudável que atende milhares de requisições por segundo. A amostragem (*sampling*) guarda um subconjunto representativo. A questão é **quando** você decide.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="obs-d4-title obs-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="obs-d4-title">Head sampling versus tail sampling</title>
<desc id="obs-d4-desc">O head sampling decide no início da requisição com uma escolha aleatória, então pode descartar erros. O tail sampling guarda o trace inteiro e decide depois que ele termina, mantendo erros e requisições lentas mais uma pequena amostra de base.</desc>
<defs><marker id="obs-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="20" y="20" width="330" height="265" rx="10" class="d-box"/>
<text x="185" y="48" text-anchor="middle" class="d-title">Head sampling</text>
<text x="185" y="68" text-anchor="middle" class="d-small">decide quando a requisição começa</text>
<rect x="50" y="85" width="270" height="50" rx="10" class="d-box-info"/>
<text x="185" y="115" text-anchor="middle" class="d-text">Aleatório: guarda 10%</text>
<line x1="160" y1="135" x2="115" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<line x1="210" y1="135" x2="255" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<rect x="50" y="170" width="125" height="70" rx="10" class="d-box-accent"/>
<text x="112" y="194" text-anchor="middle" class="d-text">Guardado</text>
<text x="112" y="212" text-anchor="middle" class="d-small">10% aleatórios</text>
<text x="112" y="228" text-anchor="middle" class="d-small">de tudo</text>
<rect x="195" y="170" width="125" height="70" rx="10" class="d-box-muted"/>
<text x="257" y="194" text-anchor="middle" class="d-text">Descartado</text>
<text x="257" y="212" text-anchor="middle" class="d-small">90%, erros</text>
<text x="257" y="228" text-anchor="middle" class="d-small">inclusive</text>
<text x="185" y="268" text-anchor="middle" class="d-small">Barato e simples, cego para erros</text>
<rect x="370" y="20" width="330" height="265" rx="10" class="d-box"/>
<text x="535" y="48" text-anchor="middle" class="d-title">Tail sampling</text>
<text x="535" y="68" text-anchor="middle" class="d-small">decide depois que o trace termina</text>
<rect x="400" y="85" width="270" height="50" rx="10" class="d-box-info"/>
<text x="535" y="115" text-anchor="middle" class="d-text">Guarda, depois inspeciona</text>
<line x1="510" y1="135" x2="465" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<line x1="560" y1="135" x2="605" y2="168" class="d-line" marker-end="url(#obs-d4-arrow)"/>
<rect x="400" y="170" width="125" height="70" rx="10" class="d-box-accent"/>
<text x="462" y="194" text-anchor="middle" class="d-text">Guardado</text>
<text x="462" y="212" text-anchor="middle" class="d-small">erros + lentos</text>
<text x="462" y="228" text-anchor="middle" class="d-small">+ 5% de base</text>
<rect x="545" y="170" width="125" height="70" rx="10" class="d-box-muted"/>
<text x="607" y="194" text-anchor="middle" class="d-text">Descartado</text>
<text x="607" y="212" text-anchor="middle" class="d-small">rápidos e</text>
<text x="607" y="228" text-anchor="middle" class="d-small">bem-sucedidos</text>
<text x="535" y="268" text-anchor="middle" class="d-small">Guarda o que importa, custa memória</text>
</svg>
</div>
<figcaption>Figura 4: Head sampling é barato, tail sampling é inteligente</figcaption>
</figure>

- ***Head sampling*:** decidido no início da requisição, normalmente de forma aleatória (guarda 10%), e propagado pela *flag* do `traceparent` para que todos os serviços concordem. Barato e simples, mas é cara ou coroa: aquele pagamento com falha de que você precisava pode estar nos 90% descartados.
- ***Tail sampling*:** o Collector guarda todos os *spans* de um *trace* e decide depois que ele termina: mantém todo erro, todo *trace* acima de 2 segundos, toda requisição do cliente VIP, mais uma pequena amostra aleatória de base. Bem mais inteligente, mas precisa de memória, de uma camada de roteamento para que todos os *spans* de um *trace* cheguem ao mesmo Collector e de mais cuidado operacional.

Uma combinação comum e pragmática: *head sampling* com uma taxa generosa no SDK para limitar o *overhead*, *tail sampling* no Collector para guardar o que interessa e **métricas calculadas antes da amostragem**, para que os números de RED continuem precisos.

### Mantendo a conta sob controle

| Abordagem | Benefício |
| :--- | :--- |
| **Níveis de log por ambiente** (*debug* desligado em produção, ajustável em tempo de execução) | Detalhe quando você precisa, sem pagar por ele todo dia. |
| **Retenção por sinal** (métricas por meses, *traces* por dias, logs de *debug* por horas) | Guarda cada sinal pelo tempo em que ele é realmente útil. |
| **Descarte e filtro no Collector** (*health checks*, arquivos estáticos, bibliotecas tagarelas) | Corta volume antes de chegar ao *backend* pago. |
| **Armazenamento em camadas** (quente para o recente, *object storage* barato para arquivo) | *Compliance* e perícia sem preço *premium*. |
| ***Showback* do custo de telemetria por time** | Os times veem quanto a sua verbosidade custa e se corrigem sozinhos. |

## PII e segredos na telemetria

Logs são um dos lugares mais comuns de vazamento de dados sensíveis. Eles são copiados para vários sistemas, lidos por muita gente, guardados por meses e raramente tratados com o mesmo cuidado que o banco de produção. O OWASP Top 10 tem até uma categoria dedicada a falhas de log e monitoramento de segurança.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então pra facilitar o debug eu vou logar o corpo inteiro da requisição e os headers, só por garantia. Mal não faz, né?"</span>
    </div>
  </div>
</div>

Faz, e muito, Júnior. Esse corpo de requisição tem senha, número de cartão, CPF, endereço. Os *headers* têm *tokens* de `Authorization` e *cookies* de sessão. Logue isso e você criou uma segunda cópia dos seus dados mais sensíveis, com controle de acesso mais fraco, em um sistema que ninguém audita. Com a LGPD, isso é um incidente esperando para acontecer, e qualquer pessoa com acesso aos logs consegue sequestrar uma sessão com um *token* copiado.

Regras práticas:

1. **Logue IDs, não identidades.** `user_id: u_81723` em vez de nome e e-mail. Você consegue descobrir quem é a pessoa quando realmente precisar, com o acesso adequado.
2. **Lista de permissão, não de bloqueio.** Decida quais campos entram nos logs; não despeje tudo tentando filtrar as partes ruins depois.
3. **Nunca logue segredos.** *Tokens*, senhas, chaves de API, números completos de cartão, *headers* `Authorization` e `Cookie`. Mascare na configuração do *logger* e de novo no Collector, como segunda rede de proteção.
4. **Classifique a telemetria como dado.** Restrinja quem pode ler logs e *traces* crus, criptografe e defina a retenção de acordo com as suas políticas de dados.
5. **Teste.** Adicione verificações no CI ou na revisão de código que apontem campos suspeitos em instruções de log. É exatamente o espírito do [Security Shift-Left](/pt-br/principles/solution/security-shift-left/).

Mais sobre proteção de dados no sistema como um todo em [Segurança](/pt-br/principles/cloud/security/).

## Colocando em prática: observabilidade como parte do "pronto"

O coração deste princípio é o *timing*. Observabilidade adicionada depois do fato é sempre incompleta, porque quem adiciona já não é quem conhece melhor o código. Então faça dela parte da definição de pronto.

### 1. Instrumente junto com a funcionalidade

**Meta:** toda nova funcionalidade vai para produção com a telemetria necessária para operá-la.

Antes do *merge*, pergunte: "se isso quebrar às 3 da manhã, o que eu precisaria ver?" Adicione os atributos de negócio, os eventos de log relevantes e a métrica que diz se a funcionalidade está funcionando.

**Benefício:** o conhecimento do que importa é capturado por quem o tem, enquanto ainda o tem.

### 2. Padronize o básico

**Meta:** todo serviço fala a mesma língua de telemetria.

Uma biblioteca ou template compartilhado com OTel configurado, log estruturado com trace ID, atributos de recurso padrão (`service.name`, `service.version`, `deployment.environment`) e métricas RED prontas.

**Benefício:** um serviço novo já nasce observável, e quem está de plantão navega por qualquer serviço do mesmo jeito.

### 3. Defina SLOs antes do go-live

**Meta:** combinar o que é "saudável" antes de os usuários chegarem.

Escolha de um a três SLIs por jornada crítica do usuário, defina metas realistas e crie alertas de *burn rate*. Revise depois de algumas semanas de dados reais.

**Benefício:** os alertas refletem impacto no usuário desde o início, e o time ganha uma forma objetiva de equilibrar funcionalidades e confiabilidade.

### 4. Teste sua observabilidade

**Meta:** garantir que a telemetria realmente responde perguntas.

Em *game days* ou experimentos de caos (veja [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/)), quebre coisas de propósito e verifique: o alerta disparou? O *dashboard* mostrou? Alguém que não escreveu o código conseguiu achar a causa usando só a telemetria?

**Benefício:** você descobre os pontos cegos numa terça à tarde, não durante um incidente de verdade.

### 5. Revise depois de cada incidente

**Meta:** cada incidente deixa o sistema mais observável.

Em todo *postmortem*, inclua a pergunta: "que sinal teria permitido detectar ou diagnosticar isso mais rápido?" E adicione esse sinal.

**Benefício:** a observabilidade melhora exatamente onde a realidade provou que ela faltava.

## Tradeoffs

A **Observabilidade desde o início** encurta incidentes, acelera diagnósticos e dá ao time confiança para entregar com frequência. Mas, como todo princípio, ela puxa a corda de outros pilares.

### Tradeoffs com Otimização de Custos (Cost Optimization)

O volume de telemetria cresce com o tráfego, com o número de serviços e com a verbosidade. Ingestão, indexação e retenção podem virar um dos maiores itens da conta de nuvem.

Métricas de alta cardinalidade e captura total de *traces* multiplicam o custo de armazenamento.

O equilíbrio vem da amostragem, das políticas de retenção, do descarte de ruído no Collector e de mostrar a cada time quanto custa a sua telemetria (veja [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/)).

### Tradeoffs com Segurança (Security)

A telemetria é uma cópia do que o sistema faz, e pode conter dados pessoais, segredos e informações de negócio → mais um repositório de dados para proteger.

Collectors, agentes e *backends* de observabilidade são componentes extras com acesso à rede e credenciais → superfície de ataque maior.

Ferramentas SaaS de terceiros significam dados saindo do seu perímetro, o que levanta questões de residência de dados e *compliance*.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Instrumentação tem *overhead*: criar *spans*, serializar logs e exportar dados consome CPU, memória e rede. Normalmente é pouco, mas não é zero, principalmente em caminhos críticos.

Log síncrono em disco ou rede pode adicionar latência. Prefira exportadores assíncronos e em lote, e mantenha a instrumentação fora dos laços mais apertados.

### Tradeoffs com Confiabilidade e Excelência Operacional

O *pipeline* de observabilidade é, ele mesmo, um sistema que pode falhar. Se o Collector cair, você perde visibilidade justamente quando mais precisa. Ele deve ser desenhado e monitorado como qualquer outro componente crítico.

Mais sinais podem significar mais ruído. Sem disciplina em alertas e *dashboards*, a observabilidade vira fadiga de alertas e o time começa a ignorar justamente o que deveria protegê-lo.

Ferramentas, convenções e SLOs precisam de dono e de manutenção, tempo que compete com o desenvolvimento de funcionalidades.

<div class="callout info">
  <p>O objetivo não é o máximo de telemetria. É a <strong>telemetria mínima que responde as perguntas que o seu time vai ter</strong>, a um custo que o negócio consegue sustentar, sem expor dados que não deveria.</p>
</div>

## Conclusão

**Observabilidade desde o início** é a decisão de tratar "como vamos saber o que está acontecendo?" como uma pergunta de design, respondida ao mesmo tempo que "o que essa funcionalidade deve fazer?". Ela se apoia em alguns pilares: sinais estruturados e correlacionados; contexto propagado em todos os saltos; uma base neutra de fornecedor como o OpenTelemetry; métricas que refletem a experiência do usuário; alertas por sintoma, não por causa; e uma abordagem consciente de custo e privacidade.

Quando bem feita, incidente deixa de ser arqueologia. O alerta dispara antes de o cliente perceber, o *dashboard* aponta o serviço certo, o *trace* aponta o *span* certo e o log conta o porquê. O MTTR cai, o plantão deixa de ser temido e o time ganha confiança para entregar com mais frequência.

E a ligação das 3 da manhã? Pode ser que ainda aconteça. Mas, desta vez, você vai ter muito mais do que um `console.log("aqui")` para trabalhar.

## Próximos Passos

1. **Escolha uma jornada crítica do usuário**
Checkout, login, cadastro: escolha uma, mapeie os serviços que ela toca e instrumente de ponta a ponta com OpenTelemetry e trace IDs nos logs.

2. **Migre para log estruturado**
Adote logs em JSON com um conjunto padrão de campos (serviço, versão, ambiente, trace ID) e proíba logs em texto livre no código novo.

3. **Defina seus primeiros SLOs**
De um a três SLIs para essa jornada, metas realistas e alertas de *burn rate*. No caminho, apague pelo menos um alerta ruidoso baseado em causa.

4. **Coloque um Collector no meio**
Roteie a telemetria por um OTel Collector e use-o para descartar ruído, mascarar campos sensíveis e aplicar amostragem.

5. **Audite seus logs atrás de PII e segredos**
Procure e-mails, *tokens* e números de documentos nos logs existentes. Corrija as origens e defina políticas de retenção alinhadas às suas regras de dados.

6. **Faça da observabilidade parte do "pronto"**
Inclua "como vamos saber que está funcionando em produção?" no template de *pull request* e no *checklist* de *postmortem*.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://opentelemetry.io/docs/" target="_blank" rel="noopener">Documentação do OpenTelemetry</a></li>
    <li><a href="https://www.w3.org/TR/trace-context/" target="_blank" rel="noopener">W3C Trace Context</a></li>
    <li><a href="https://sre.google/sre-book/monitoring-distributed-systems/" target="_blank" rel="noopener">Google SRE Book: Monitoring Distributed Systems</a></li>
    <li><a href="https://sre.google/workbook/alerting-on-slos/" target="_blank" rel="noopener">Google SRE Workbook: Alerting on SLOs</a></li>
    <li><a href="https://www.brendangregg.com/usemethod.html" target="_blank" rel="noopener">Brendan Gregg: The USE Method</a></li>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top 10</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
  </ul>
</div>
