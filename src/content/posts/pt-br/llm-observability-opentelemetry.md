---
title: "Tracing de agentes LLM com OpenTelemetry: spans, tokens, custo e privacidade"
description: "Instrumente um loop de agente com as convenções GenAI do OpenTelemetry, mascare o conteúdo antes da exportação e transforme contagem de tokens em custo por feature e por tenant."
date: 2026-09-18
tags: [AI Agents, Observability, OpenTelemetry, Python, LLM]
tldr:
  - "Uma requisição de agente é uma árvore: invoke_agent na raiz, spans chat, execute_tool e retrieval abaixo dela, com os nomes e atributos que as convenções semânticas GenAI definem."
  - "Metadados operacionais vão nos spans, o conteúdo fica desligado por padrão e é mascarado no processo antes de qualquer exporter, e tenant e feature viajam como baggage."
  - "Custo é tokens vezes uma tabela de preços versionada, calculado sobre dados sem amostragem; o tail sampling guarda erros e traces lentos, e notas de avaliação e feedback se ligam ao trace id."
---

Um cliente escreve para o suporte: "o bot disse que não conseguiu falar com a transportadora, duas vezes, e depois me mandou um link de rastreio que não funcionava". Você abre os logs dessa conversa e encontra catorze linhas vindas de três serviços, um `POST https://llm-gateway/v1/chat 200` repetido quatro vezes e um `WARN carrier timeout` sem id de requisição. Na mesma manhã, o financeiro pergunta por que a conta do modelo subiu 40% no mês passado, e qual cliente é o responsável. Ninguém consegue responder nenhuma das duas perguntas em menos de um dia.

Nenhuma das perguntas é exótica. As duas falam do formato de uma requisição: quais chamadas ao modelo ela fez, quais ferramentas rodou, o que falhou, o que foi repetido e quantos tokens cada passo queimou. Esse formato é um trace, e o OpenTelemetry agora tem convenções semânticas exatamente para esse tipo de carga. Este post mostra o que as convenções GenAI definem (e quão estáveis elas são), onde cada informação deve ficar, como manter prompts e dados pessoais fora da telemetria, como obter custo por feature e por tenant a partir da contagem de tokens, e onde entram amostragem, avaliações e feedback do usuário. A parte prática é um loop de agente em Python com um modelo falso e ferramentas falsas, instrumentado com o SDK real do OpenTelemetry, mais um script de análise que lê o que foi exportado. O Júnior Inocente vem junto.

## O problema e o contexto

Uma requisição web clássica é quase uma linha reta: a requisição entra, roda algumas queries, a resposta sai. Uma requisição de agente é uma árvore, e o formato da árvore muda de uma requisição para outra. A mesma pergunta pode gerar uma chamada ao modelo ou cinco. O modelo pode chamar uma ferramenta, tomar um timeout, tentar de novo, chamar outra ferramenta e só então responder. Um passo de retrieval acrescenta alguns milhares de tokens de contexto a todas as chamadas seguintes. Um provedor devolve 429 e o seu cliente repete em silêncio. Cada um desses passos tem a sua latência, os seus modos de falha e, no caso das chamadas ao modelo, o seu preço.

Logs achatam essa árvore em linhas. Mesmo com um correlation id em todas elas, você reconstrói a estrutura na mão às duas da manhã: qual timeout pertencia a qual tentativa, se a resposta que o usuário viu veio antes ou depois do retry, qual das quatro chamadas ao modelo foi a lenta. Métricas vão para o outro extremo: agregam tão bem que a requisição individual desaparece. "O p95 do endpoint de suporte está em 6 segundos" diz que algo está lento, não que é a API da transportadora na primeira tentativa para pedidos cujo número cai num shard ruim.

Instrumentação HTTP genérica também não resolve. Ela vê um `POST` de saída com status e duração. Não sabe o nome do modelo, o finish reason, quantos tokens de entrada vieram do cache do provedor, nem que a resposta era uma chamada de ferramenta. São essas as informações que explicam latência, custo e qualidade, e elas só existem no seu código e na resposta do provedor.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que não logar o prompt e a resposta completos de toda chamada em JSON? Depois dá para buscar qualquer coisa.</span>
    </div>
  </div>
</div>

Porque isso responde as perguntas erradas e cria outras. Uma linha de log com um prompt de 12 KB diz o que foi enviado, não para onde foram os quatro segundos nem qual passo falhou primeiro. Não tem estrutura de pai e filho, então você continua reconstruindo a árvore na mão. E coloca as mensagens de todos os usuários, incluindo os e-mails e números de cartão que as pessoas colam em caixas de chat, num sistema que costuma ter acesso amplo de leitura, retenção longa e exportação para outras ferramentas. Conteúdo às vezes ajuda a depurar, e existe um jeito de capturá-lo de propósito, mas é a exceção, não o padrão.

A ferramenta certa para a árvore é tracing: um trace por requisição do usuário, um span por passo, com ligações de pai e filho e timestamps. Se você viu o painel de trace do pipeline em [Agentic Mesh Architecture](/pt-br/blog/agentic-mesh-architecture-rag-agents/), é a mesma ideia desenhada como interface: cada etapa da requisição como uma barra com tempo, que você pode abrir. O que faltava no mundo de LLM era um acordo sobre como esses spans se chamam e quais atributos carregam, para que seus dashboards, a interface do seu fornecedor e as bibliotecas de instrumentação leiam os mesmos campos. É isso que são as convenções semânticas GenAI.

## Mergulho na arquitetura

### As convenções semânticas GenAI em setembro de 2026

Dois fatos antes de qualquer nome de atributo. Primeiro, as convenções [mudaram de casa](https://github.com/open-telemetry/semantic-conventions/pull/3696) em maio de 2026: saíram do repositório principal de semantic conventions e foram para um repositório próprio, o [open-telemetry/semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai). As páginas antigas em [opentelemetry.io/docs/specs/semconv/gen-ai/](https://opentelemetry.io/docs/specs/semconv/gen-ai/) agora dizem que a página mudou e apontam para lá. Segundo, todos os sinais GenAI continuam marcados como **Development**, no sentido do [document status](https://opentelemetry.io/docs/specs/otel/document-status/). Os únicos atributos estáveis que você vai usar nesses spans são os gerais, como `error.type`, `server.address` e `server.port`. Development quer dizer que os nomes ainda podem mudar entre versões, e mudam: nas últimas semanas o repositório depreciou o finish reason por mensagem e acrescentou detalhamento de uso por modalidade e por cache.

Com essa ressalva, este é o núcleo, tirado dos documentos de [spans de modelo](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) e de [spans de agente](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md):

| Operação | Nome do span | Kind | Atributos que mais importam |
|----------|--------------|------|-----------------------------|
| Chamada ao modelo | `chat {gen_ai.request.model}` | `CLIENT` | `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.response.id`, `gen_ai.response.finish_reasons`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` |
| Execução de ferramenta | `execute_tool {gen_ai.tool.name}` | `INTERNAL` | `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.type`, `error.type` |
| Invocação de agente | `invoke_agent {gen_ai.agent.name}` | `INTERNAL` no mesmo processo, `CLIENT` para um serviço de agente remoto | `gen_ai.agent.name`, `gen_ai.conversation.id`, uso somado |
| Retrieval | `retrieval {gen_ai.data_source.id}` | `CLIENT` | `gen_ai.data_source.id`, `gen_ai.retrieval.top_k` |

`gen_ai.operation.name` é obrigatório em todos, com valores conhecidos como `chat`, `generate_content`, `embeddings`, `retrieval`, `execute_tool`, `invoke_agent`, `invoke_workflow` e `plan`. Nos spans de modelo, `gen_ai.provider.name` também é obrigatório (`openai`, `anthropic`, `aws.bedrock`, `azure.ai.openai`, `gcp.vertex_ai` e assim por diante; ele substituiu o antigo `gen_ai.system`). A especificação pede que `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `server.address` e `server.port` sejam definidos **na criação do span**, e não depois da chamada, porque os samplers só enxergam os atributos que existem no início.

Dois detalhes são fáceis de errar. Os contadores de uso são aninhados: `gen_ai.usage.input_tokens` DEVERIA incluir os tokens em cache, e `gen_ai.usage.cache_read.input_tokens` é um subconjunto dele, não uma soma à parte. E quando o provedor informa tanto a contagem cobrada quanto a consumida, você reporta a cobrada, para os números baterem com a fatura.

O conteúdo tem atributos próprios, todos **Opt-In**: `gen_ai.system_instructions`, `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` e `gen_ai.retrieval.query.text`. As mensagens seguem um JSON schema com `role` e uma lista de `parts` tipadas (`text`, `tool_call`, `tool_call_response` e outras). Onde atributos estruturados não são suportados em spans, que é o caso dos atributos de span no SDK de Python, elas são serializadas como string JSON.

As instrumentações Python do [opentelemetry-python-contrib](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/util/opentelemetry-util-genai) seguem isso com duas chaves: `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` para emitir as convenções mais recentes em vez do formato antigo da v1.30, e `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` (`NO_CONTENT` por padrão, ou `SPAN_ONLY`, `EVENT_ONLY`, `SPAN_AND_EVENT`) para o conteúdo.

### Como fica uma requisição de agente

Este é um trace real do código mais adiante: um cliente pergunta onde está o pedido, a API da transportadora dá timeout na primeira tentativa, a segunda funciona e o modelo responde. Mais tarde, um juiz online dá nota para a resposta, e o cliente clica no polegar para baixo mesmo assim.

<div id="llmobs-trace-tree-slot"></div>

Algumas escolhas nessa árvore são deliberadas. Os dois spans `execute_tool` são irmãos, não um span só, porque o retry foi uma decisão do loop do agente: duas tentativas, dois spans, um deles com erro. O retry do provedor num 429 é o caso oposto. A especificação diz que, quando uma falha transitória é repetida automaticamente, o span "DEVERIA cobrir a duração da operação lógica com todos os retries", então uma chamada `chat` com rate limit continua sendo um span só, e cada retry vira um evento do span. Na prática é o que você quer: "quantas chamadas ao modelo essa requisição fez" não deveria mudar porque o provedor estava ocupado.

O span raiz carrega o contexto de negócio (`app.tenant.id`, `app.feature`) e os totais de tokens. Os spans `chat` carregam a verdade de cada chamada. Consultas de custo leem os spans `chat`; a raiz serve para ver de relance quanto custou aquela requisição. Somar os dois contaria cada token duas vezes.

### Spans, eventos e métricas: onde cada informação fica

A regra que eu uso: spans guardam os metadados operacionais de cada passo, eventos guardam o que é grande, sensível ou acontece depois, e métricas guardam aquilo em que você cria alertas.

**Spans** recebem tudo o que é de baixo risco e limitado: nomes de modelo, finish reasons, contagem de tokens, nomes de ferramentas, tipos de erro, o `top_k` do retrieval e os seus próprios atributos de negócio. É por eles que você filtra e agrupa numa investigação.

**Eventos** (log records com nome de evento, correlacionados ao span pelo contexto do trace) são onde o [documento de eventos](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md) coloca duas coisas. `gen_ai.client.inference.operation.details` é um evento opt-in com os detalhes completos da requisição, incluindo mensagens, para que o conteúdo possa morar num pipeline de logs com retenção e regras de acesso diferentes das dos traces. `gen_ai.evaluation.result` carrega uma nota de qualidade (`gen_ai.evaluation.name`, `gen_ai.evaluation.score.value`, `gen_ai.evaluation.score.label`) e DEVERIA ser filho do span que ele avalia, ou carregar `gen_ai.response.id` quando o id do span não é conhecido. É o gancho para avaliações online.

**Métricas** estão definidas no [documento de métricas](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md): `gen_ai.client.operation.duration` (histograma em segundos, com buckets recomendados de 10 ms a uns 82 s), tempos de streaming como `gen_ai.client.operation.time_to_first_chunk`, métricas de agente como `gen_ai.invoke_agent.inference_calls` e `gen_ai.execute_tool.duration`, e uso de tokens. No momento em que escrevo, o uso de tokens é `gen_ai.client.token.usage`, um histograma separado por `gen_ai.token.type` (`input` ou `output`), e um [pull request em revisão](https://github.com/open-telemetry/semantic-conventions-genai/pull/374) o substitui por contadores por tipo. Mais um lembrete para fixar versões.

O contexto de negócio precisa de mais uma peça. Tenant e feature são conhecidos na borda do sistema, mas todo span abaixo deveria carregá-los, para qualquer consulta poder agrupar por eles sem join. [Baggage](https://opentelemetry.io/docs/concepts/signals/baggage/) é o mecanismo do OpenTelemetry para isso: pares chave e valor que viajam com o contexto, dentro do processo e entre serviços pelo header `baggage`. Um span processor pequeno copia as chaves que interessam para cada span no início.

<div class="callout warning" data-title="Atenção">
  <p>O baggage é propagado para todo serviço downstream que você chama por HTTP, inclusive terceiros, se a instrumentação do seu cliente injeta headers neles. Um tenant id ou um nome de feature, tudo bem. O e-mail de um usuário, um nome ou um id de documento, não. Coloque só identificadores que você aceitaria ver no access log de um parceiro.</p>
</div>

### Privacidade: conteúdo é opt-in, e mascaramento é uma etapa do pipeline

A especificação é direta sobre conteúdo: instruções, entradas e saídas "são consideradas sensíveis e costumam ser grandes", e as instrumentações "NÃO DEVERIAM capturá-las por padrão, mas DEVERIAM oferecer uma opção de opt-in". Ela lista três padrões: não gravar conteúdo (o padrão), gravar nos atributos do span (para pré-produção ou para stores de telemetria que já cumprem suas regras de privacidade), ou enviar para um armazenamento separado e deixar só uma referência no span, que é o recomendado para produção quando você precisa de conteúdo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Vamos ligar a captura de conteúdo em produção por enquanto. Se o jurídico reclamar, a gente apaga depois.</span>
    </div>
  </div>
</div>

O problema está no "depois". Traces são replicados entre regiões do backend, copiados para datasets exportados, guardados em cache nos dashboards e colados em tickets de incidente. Apagar as mensagens de um usuário de tudo isso a pedido dele (o que a LGPD e o GDPR podem exigir) fica entre caro e impossível. Backends de telemetria também são feitos para acesso amplo: normalmente a engenharia inteira consegue ler. Deixe o conteúdo desligado, ligue numa fatia amostrada ou em staging quando precisar e, quando capturar, mascare antes que ele saia do processo.

Essa última parte é uma decisão de pipeline, não uma propriedade do seu código. A ordem é: carimbar o contexto, mascarar, depois exportar. O mascaramento roda primeiro no processo porque é o único lugar onde o dado cru existe; uma segunda passada no Collector com o [redaction processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/redactionprocessor) (uma allow list de chaves de atributo mais padrões de valores bloqueados) pega o que algum serviço esqueceu.

<div id="llmobs-pipeline-slot"></div>

Mascaramento por regex é um piso, não um teto. Ele pega e-mails, números de cartão, telefones e documentos como o CPF. Não pega um nome, um endereço escrito em prosa ou um detalhe médico. Se o conteúdo precisa ser guardado para avaliação ou fine-tuning, isso é um produto de dados, com consentimento, acesso e retenção próprios, e o pipeline de telemetria é o lugar errado para ele.

### Atribuição de custo a partir da contagem de tokens

Os spans já têm o que você precisa: `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.cache_read.input_tokens` e `gen_ai.usage.output_tokens`, mais o tenant e a feature carimbados a partir do baggage. Custo é aritmética:

`cost = (input - cached) * input_price + cached * cached_price + output * output_price`

Eu calculo isso na hora da consulta, a partir de uma tabela de preços versionada junto com o código de análise, em vez de gravar um atributo `cost` em cada span. Preços mudam, descontos negociados se aplicam retroativamente, e um erro num atributo gravado fica para sempre no histórico. Tokens são o fato; dinheiro é uma visão sobre o fato. Use `gen_ai.response.model` e não o modelo pedido, porque aliases e gateways podem rotear a requisição para um modelo diferente do que você pediu. E os tokens de raciocínio já estão dentro de `gen_ai.usage.output_tokens` (a especificação define `gen_ai.usage.reasoning.output_tokens` como um subconjunto), então eles são cobrados como saída sem trabalho extra.

### Amostragem: guarde os traces que explicam alguma coisa

Em escala não dá para guardar todos os traces, e o head sampling (decidir na raiz, antes de qualquer coisa acontecer) guarda uma fatia aleatória: em geral, requisições tediosas e bem-sucedidas.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Um head sampler de 10% resolve. Se uma falha é comum o bastante para importar, ela aparece na amostra.</span>
    </div>
  </div>
</div>

Ela aparece como taxa, mas não como um trace que você possa abrir quando um cliente específico reclama, e em 90% das vezes o trace de que você precisa foi descartado antes de ter a chance de falhar. Com agentes é pior: se uma requisição é interessante depende do que aconteceu três chamadas de ferramenta depois, e um head sampler não tem como saber. O tail sampling decide depois que o trace termina. O [tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor) do Collector segura os spans em memória por `decision_wait` (30 s por padrão) e depois aplica políticas: guardar todo trace com status de erro, guardar todo trace acima de um limite de latência, guardar uma fatia probabilística do resto e, se quiser, guardar todo trace de uma feature que você está depurando nesta semana. A análise da parte prática simula exatamente essa política.

A pegadinha é que o tail sampling tem estado: todos os spans de um trace precisam chegar à mesma instância do Collector. Num deployment com várias instâncias, você coloca uma primeira camada de Collectors com o [load-balancing exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter), que roteia por `traceID` por padrão, na frente da camada de amostragem.

### Avaliações e feedback pertencem ao trace

Uma nota de avaliação sem o trace é um número sem causa. Um juiz online (um LLM como juiz, um classificador, uma regra) que avalia uma amostra das respostas deve emitir `gen_ai.evaluation.result` como filho do span `chat` que ele avaliou. Aí "me mostre os traces em que a relevância falhou" vira um filtro, e o trace reprovado mostra o timeout de ferramenta que causou a resposta ruim.

O feedback do usuário funciona do mesmo jeito, com uma diferença: ele chega depois, em outra requisição HTTP. Devolva o trace id (ou um token de feedback que aponte para ele) junto com a resposta, guarde-o com a conversa e, quando o polegar para baixo chegar, emita um evento com esse trace id como contexto pai. A análise no fim deste post liga os dois tipos de evento aos seus traces.

## Implementação na prática

A demo é um agente de suporte com três features: `order_status` (uma chamada de ferramenta a uma API de transportadora que às vezes dá timeout), `refund_help` (retrieval sobre políticas de reembolso e depois uma consulta de pedido, no modelo maior) e `summarize_ticket` (uma chamada no modelo pequeno com uma entrada longa). O modelo e as ferramentas são falsos, com comportamento determinístico e pequenos sleeps, então tudo roda offline em uns 20 segundos. A telemetria é o SDK real do OpenTelemetry, versão 1.44.0, a mais recente quando escrevi.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install "opentelemetry-api==1.44.0" "opentelemetry-sdk==1.44.0"
```

### Os fakes

O modelo falso responde por regra, reporta uso como uma API de verdade, lê 850 tokens do system prompt de um "cache do provedor" nas chamadas seguintes, devolve 429 em toda trigésima chamada e tem 4% de chance de 400 ms de congestionamento. A API da transportadora dá timeout na primeira tentativa para números de pedido divisíveis por 6, e nas duas tentativas quando são divisíveis por 12.

```python title="fakes.py"
"""A deterministic stand-in for a model provider and three backend tools."""

import itertools
import random
import re
import time
from dataclasses import dataclass, field

SYSTEM_PROMPT = "You are the support agent for an online store. Use tools for order data. Never invent order ids."
SYSTEM_TOKENS = 850  # instructions plus tool definitions, as the provider would count them


class RateLimited(Exception):
    status_code = 429


class ToolTimeout(Exception):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ModelResponse:
    id: str
    model: str
    text: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0


def _tokens(text: str) -> int:
    return max(1, len(text) // 4)


class FakeModel:
    """Answers by rule instead of by sampling, and reports usage like a real API."""

    LATENCY = {"orion-large": (0.040, 0.0005), "orion-mini": (0.015, 0.0002)}

    def __init__(self, seed: int = 7):
        self._rng = random.Random(seed)
        self._ids = itertools.count(1)
        self._calls = 0

    def complete(self, model: str, messages: list[dict]) -> ModelResponse:
        self._calls += 1
        if self._calls % 30 == 0:
            time.sleep(0.005)
            raise RateLimited("429 Too Many Requests")

        last = messages[-1]
        prompt_tokens = SYSTEM_TOKENS + sum(_tokens(str(m["content"])) for m in messages)
        cached = SYSTEM_TOKENS if len(messages) > 1 else 0
        response_id = f"resp_{next(self._ids):05d}"

        if last["role"] == "user" and (match := re.search(r"ORD-\d{4}", last["content"])):
            tool = "lookup_tracking" if "where" in last["content"].lower() else "get_order"
            call = ToolCall(f"call_{response_id[5:]}", tool, {"order_id": match.group()})
            response = ModelResponse(response_id, model, None, [call], "tool_call", prompt_tokens, 24, cached)
        else:
            text = self._answer(last)
            response = ModelResponse(response_id, model, text, [], "stop", prompt_tokens,
                                     _tokens(text) + self._rng.randint(60, 220), cached)

        base, per_token = self.LATENCY[model]
        congestion = 0.4 if self._rng.random() < 0.04 else 0.0
        time.sleep(base + per_token * response.output_tokens + congestion)
        return response

    @staticmethod
    def _answer(last: dict) -> str:
        if last["role"] == "tool" and "error" in last["content"]:
            return "I couldn't reach the carrier right now. I've logged it, please try again in a few minutes."
        if last["role"] == "tool":
            return f"Here is what I found: {last['content']}"
        return "Summary: customer reports a delayed delivery and asks for a status update."


class Tools:
    def lookup_tracking(self, order_id: str, attempt: int) -> dict:
        number = int(order_id[4:])
        time.sleep(0.012)
        if number % 6 == 0 and (attempt == 1 or number % 12 == 0):
            time.sleep(0.2)
            raise ToolTimeout(f"carrier API timed out for {order_id}")
        return {"order_id": order_id, "status": "in_transit", "eta": "2026-09-21"}

    def get_order(self, order_id: str, attempt: int) -> dict:
        time.sleep(0.006)
        return {"order_id": order_id, "total": "189.90", "currency": "BRL", "refundable": True}

    def search_kb(self, query: str, top_k: int) -> list[dict]:
        time.sleep(0.010)
        policy = "Refunds are accepted within 30 days of delivery for unused items in the original packaging. " * 6
        return [{"id": f"kb-{i}", "score": round(0.9 - i * 0.07, 2), "text": policy} for i in range(top_k)]
```

### O pipeline de telemetria

Este arquivo é a parte que você reaproveitaria. Ele configura um tracer provider e um logger provider com um resource, adiciona o processor de baggage e envolve o processor de exportação num processor de mascaramento.

```python title="telemetry.py"
import json
import re
from typing import Sequence

from opentelemetry import baggage, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import LogRecordExporter, LogRecordExportResult, SimpleLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import Event, ReadableSpan, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult

# Business context that every span should carry, copied from baggage at span start.
CONTEXT_KEYS = ("app.tenant.id", "app.feature")

# Attributes that may hold user content. Everything else is operational metadata.
CONTENT_KEYS = {
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.system_instructions",
    "gen_ai.tool.call.arguments",
    "gen_ai.tool.call.result",
    "gen_ai.retrieval.query.text",
}

PII_PATTERNS = [
    (re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"), "<email>"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "<card>"),
    (re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"), "<cpf>"),
    (re.compile(r"\+?\d{2}\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b"), "<phone>"),
]
MAX_TEXT_CHARS = 300


def redact_text(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + f"...<{len(text) - MAX_TEXT_CHARS} chars truncated>"
    return text


def scrub(value):
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, dict):
        return {k: scrub(v) for k, v in value.items()}
    return value


def redact(raw: str) -> str:
    # Content attributes are JSON strings; scrub the strings inside and keep the structure valid.
    try:
        return json.dumps(scrub(json.loads(raw)))
    except ValueError:
        return redact_text(raw)


class BaggageAttributesProcessor(SpanProcessor):
    """Stamps tenant and feature on every span, so any span can be grouped without a join."""

    def on_start(self, span, parent_context=None):
        for key in CONTEXT_KEYS:
            value = baggage.get_baggage(key, parent_context)
            if value is not None:
                span.set_attribute(key, str(value))


class RedactingSpanProcessor(SpanProcessor):
    """Scrubs content attributes, then hands a sanitized copy to the exporting processor.

    A finished span is read-only in the SDK, so redaction happens on a copy.
    Wrapping the exporter's processor makes the order explicit: nothing reaches
    the exporter without passing through here first.
    """

    def __init__(self, delegate: SpanProcessor):
        self._delegate = delegate

    def on_start(self, span, parent_context=None):
        self._delegate.on_start(span, parent_context)

    def on_end(self, span: ReadableSpan):
        self._delegate.on_end(
            ReadableSpan(
                name=span.name,
                context=span.context,
                parent=span.parent,
                resource=span.resource,
                attributes=self._clean(span.attributes),
                events=[Event(ev.name, self._clean(ev.attributes), ev.timestamp) for ev in span.events],
                links=span.links,
                kind=span.kind,
                status=span.status,
                start_time=span.start_time,
                end_time=span.end_time,
                instrumentation_scope=span.instrumentation_scope,
            )
        )

    @staticmethod
    def _clean(attributes):
        cleaned = dict(attributes or {})
        for key, value in cleaned.items():
            if key in CONTENT_KEYS and isinstance(value, str):
                cleaned[key] = redact(value)
        return cleaned

    def shutdown(self):
        self._delegate.shutdown()

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return self._delegate.force_flush(timeout_millis)


class JsonLinesSpanExporter(SpanExporter):
    def __init__(self, path: str):
        self._file = open(path, "w", encoding="utf-8")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            self._file.write(span.to_json(indent=None) + "\n")
        return SpanExportResult.SUCCESS

    def shutdown(self):
        self._file.close()


class JsonLinesLogExporter(LogRecordExporter):
    def __init__(self, path: str):
        self._file = open(path, "w", encoding="utf-8")

    def export(self, batch) -> LogRecordExportResult:
        for record in batch:
            self._file.write(record.to_json(indent=None) + "\n")
        return LogRecordExportResult.SUCCESS

    def shutdown(self):
        self._file.close()

    def force_flush(self, timeout_millis: int = 10_000) -> bool:
        self._file.flush()
        return True


def setup(service_name: str, spans_path: str, logs_path: str) -> tuple[TracerProvider, LoggerProvider]:
    resource = Resource.create({"service.name": service_name, "deployment.environment.name": "dev"})

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BaggageAttributesProcessor())
    # SimpleSpanProcessor keeps the demo synchronous; production uses BatchSpanProcessor.
    exporting = SimpleSpanProcessor(JsonLinesSpanExporter(spans_path))
    tracer_provider.add_span_processor(RedactingSpanProcessor(exporting))
    trace.set_tracer_provider(tracer_provider)

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(SimpleLogRecordProcessor(JsonLinesLogExporter(logs_path)))
    set_logger_provider(logger_provider)
    return tracer_provider, logger_provider
```

Por que envolver em vez de registrar dois processors? O SDK chama os processors na ordem de registro, e um span finalizado é imutável (`ReadableSpan`), então um processor de "mascaramento" registrado ao lado de um de exportação não consegue mudar o que o exporter já recebeu. Envolver torna a dependência estrutural: o exporter só enxerga a cópia limpa. O mascaramento também faz o parse dos atributos de conteúdo em JSON e limpa as strings dentro deles, então uma mensagem truncada continua sendo JSON válido para qualquer interface que a renderize depois. A especificação permite explicitamente truncar o conteúdo das mensagens preservando a estrutura.

O processor de baggage usa o outro gancho. No `on_start` o span ainda aceita escrita, então ele copia `app.tenant.id` e `app.feature` do contexto pai para todo span, inclusive os que são criados lá dentro de bibliotecas que você não controla.

### O loop do agente instrumentado

```python title="agent.py"
import json
import os
import time

from opentelemetry import baggage, context, trace
from opentelemetry._logs import get_logger
from opentelemetry.trace import SpanKind, Status, StatusCode

import telemetry
from fakes import SYSTEM_PROMPT, FakeModel, RateLimited, Tools, ToolTimeout

AGENT = "support-agent"
PROVIDER = "fake_llm"
MODEL_BY_FEATURE = {"order_status": "orion-mini", "refund_help": "orion-large", "summarize_ticket": "orion-mini"}
CAPTURE_CONTENT = os.getenv("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "").upper() in ("SPAN_ONLY", "SPAN_AND_EVENT")

tracer = trace.get_tracer("support-agent", "1.0.0")
events = get_logger("support-agent.events")
llm = FakeModel()
tools = Tools()


def otel_messages(messages: list[dict]) -> str:
    parts = []
    for m in messages:
        if m["role"] == "tool":
            parts.append({"role": "tool", "parts": [{"type": "tool_call_response", "id": m["tool_call_id"], "response": m["content"]}]})
        elif m.get("tool_calls"):
            parts.append({"role": "assistant", "parts": [
                {"type": "tool_call", "id": c.id, "name": c.name, "arguments": c.arguments} for c in m["tool_calls"]]})
        else:
            parts.append({"role": m["role"], "parts": [{"type": "text", "content": m["content"]}]})
    return json.dumps(parts)


def chat(model: str, messages: list[dict]):
    attributes = {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": PROVIDER,
        "gen_ai.request.model": model,
        "gen_ai.request.temperature": 0.0,
        "gen_ai.request.max_tokens": 1024,
        "server.address": "llm.internal.example",
        "server.port": 443,
    }
    with tracer.start_as_current_span(f"chat {model}", kind=SpanKind.CLIENT, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.system_instructions", json.dumps([{"type": "text", "content": SYSTEM_PROMPT}]))
            span.set_attribute("gen_ai.input.messages", otel_messages(messages))
        # One span per logical call: provider retries stay inside it, as events.
        for attempt in range(1, 4):
            try:
                response = llm.complete(model, messages)
                break
            except RateLimited:
                span.add_event("app.retry", {"error.type": "429", "app.retry.attempt": attempt})
                time.sleep(0.05 * attempt)
        else:
            span.set_attribute("error.type", "429")
            span.set_status(Status(StatusCode.ERROR, "rate limited after 3 attempts"))
            raise RateLimited("gave up")

        span.set_attributes({
            "gen_ai.response.id": response.id,
            "gen_ai.response.model": response.model,
            "gen_ai.response.finish_reasons": [response.finish_reason],
            "gen_ai.usage.input_tokens": response.input_tokens,
            "gen_ai.usage.output_tokens": response.output_tokens,
        })
        if response.cache_read_tokens:
            span.set_attribute("gen_ai.usage.cache_read.input_tokens", response.cache_read_tokens)
        if CAPTURE_CONTENT:
            parts = [{"type": "text", "content": response.text}] if response.text else [
                {"type": "tool_call", "id": c.id, "name": c.name, "arguments": c.arguments} for c in response.tool_calls]
            span.set_attribute("gen_ai.output.messages", json.dumps([{"role": "assistant", "parts": parts}]))
        return response, span


def execute_tool(call, attempt: int) -> dict:
    attributes = {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.agent.name": AGENT,
        "gen_ai.tool.name": call.name,
        "gen_ai.tool.call.id": call.id,
        "gen_ai.tool.type": "function",
    }
    with tracer.start_as_current_span(f"execute_tool {call.name}", kind=SpanKind.INTERNAL, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.tool.call.arguments", json.dumps(call.arguments))
        try:
            result = getattr(tools, call.name)(call.arguments["order_id"], attempt)
        except ToolTimeout as exc:
            span.set_attribute("error.type", "timeout")
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            return {"error": "timeout"}
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.tool.call.result", json.dumps(result))
        return result


def retrieve(query: str, top_k: int = 4) -> list[dict]:
    attributes = {
        "gen_ai.operation.name": "retrieval",
        "gen_ai.data_source.id": "kb-refund-policies",
        "gen_ai.retrieval.top_k": top_k,
    }
    with tracer.start_as_current_span("retrieval kb-refund-policies", kind=SpanKind.CLIENT, attributes=attributes) as span:
        if CAPTURE_CONTENT:
            span.set_attribute("gen_ai.retrieval.query.text", query)
        return tools.search_kb(query, top_k)


def run_agent(conversation_id: str, feature: str, user_text: str) -> dict:
    model = MODEL_BY_FEATURE[feature]
    with tracer.start_as_current_span(f"invoke_agent {AGENT}", kind=SpanKind.INTERNAL, attributes={
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": AGENT,
        "gen_ai.conversation.id": conversation_id,
        "gen_ai.request.model": model,
    }) as agent_span:
        content = user_text
        if feature == "refund_help":
            docs = retrieve(user_text)
            content += "\n\nPolicy excerpts:\n" + "\n".join(d["text"] for d in docs)
        messages = [{"role": "user", "content": content}]
        usage_in = usage_out = 0
        tool_failed = False

        for _ in range(4):  # step budget: an agent loop always needs one
            response, chat_span = chat(model, messages)
            usage_in += response.input_tokens
            usage_out += response.output_tokens
            if not response.tool_calls:
                break
            messages.append({"role": "assistant", "content": "", "tool_calls": response.tool_calls})
            for call in response.tool_calls:
                result = execute_tool(call, attempt=1)
                if "error" in result:
                    result = execute_tool(call, attempt=2)
                tool_failed = tool_failed or "error" in result
                messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})

        agent_span.set_attributes({
            "gen_ai.usage.input_tokens": usage_in,
            "gen_ai.usage.output_tokens": usage_out,
            "gen_ai.response.finish_reasons": [response.finish_reason],
        })
        if tool_failed:
            agent_span.set_attribute("error.type", "tool_failed")
            agent_span.set_status(Status(StatusCode.ERROR, "answered without tool data"))

        # Stand-in for an online judge; a real one runs async, on a sample, and reports the same way.
        score = 2.0 if tool_failed else 4.0 + (int(conversation_id[-2:]) % 2)
        record_evaluation(chat_span, response.id, "Relevance", score)
        ids = agent_span.get_span_context()
        return {"trace_id": ids.trace_id, "span_id": ids.span_id, "tool_failed": tool_failed}


def record_evaluation(span, response_id: str, name: str, score: float) -> None:
    events.emit(
        event_name="gen_ai.evaluation.result",
        context=trace.set_span_in_context(span),  # parents the event to the chat span it grades
        attributes={
            "gen_ai.evaluation.name": name,
            "gen_ai.evaluation.score.value": score,
            "gen_ai.evaluation.score.label": "pass" if score >= 3 else "fail",
            "gen_ai.response.id": response_id,
        },
    )


def record_feedback(trace_id: int, span_id: int, rating: str) -> None:
    # Feedback arrives later, from another request: rebuild the span context from stored ids.
    parent = trace.NonRecordingSpan(trace.SpanContext(trace_id, span_id, is_remote=True,
                                                      trace_flags=trace.TraceFlags(trace.TraceFlags.SAMPLED)))
    events.emit(event_name="app.user_feedback", context=trace.set_span_in_context(parent),
                attributes={"app.feedback.rating": rating})


REQUESTS = {
    "order_status": "Hi, I'm maria.souza@example.com. Where is my order ORD-{n}?",
    "refund_help": "Please refund order ORD-{n} to my card 4111 1111 1111 1111.",
    "summarize_ticket": "Summarize this ticket for the on-call agent: " + "The package was due Monday and has not arrived. " * 60,
}
TENANTS = ["acme", "acme", "globex", "acme", "initech", "globex"]  # acme sends half the traffic


def main() -> None:
    tracer_provider, logger_provider = telemetry.setup("support-agent", "spans.jsonl", "events.jsonl")
    features = ["order_status"] * 5 + ["refund_help"] * 3 + ["summarize_ticket"] * 2
    finished = []
    for i in range(120):
        feature = features[i % len(features)]
        tenant = TENANTS[i % len(TENANTS)]
        ctx = baggage.set_baggage("app.tenant.id", tenant)
        ctx = baggage.set_baggage("app.feature", feature, ctx)
        token = context.attach(ctx)
        try:
            finished.append(run_agent(f"conv_{i:04d}", feature, REQUESTS[feature].format(n=1000 + i)))
        finally:
            context.detach(token)

    for i, result in enumerate(finished):
        if result["tool_failed"] or i % 37 == 0:
            record_feedback(result["trace_id"], result["span_id"], "thumbs_down")

    tracer_provider.shutdown()
    logger_provider.shutdown()
    print(f"requests: {len(finished)}  content capture: {'on' if CAPTURE_CONTENT else 'off'}")


if __name__ == "__main__":
    main()
```

Vale reparar em algumas coisas. Os atributos relevantes para amostragem entram em `start_as_current_span(..., attributes=...)`, os atributos da resposta depois da chamada. A captura de conteúdo reaproveita `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`, a variável que as instrumentações do contrib leem, então uma chave só controla os seus spans e os delas. Falhas de ferramenta recebem um `error.type` de baixa cardinalidade (`timeout`) e o status do span; a mensagem com o id do pedido vai na descrição do status, não no `error.type`. Se você valida as chamadas de ferramenta antes de executá-las, como em [Deterministic Tool Calling](/pt-br/blog/deterministic-tool-calling/), esses códigos de erro estáveis (`CURRENCY_MISMATCH`, `ORDER_NOT_FOUND`) são exatamente o que vai em `error.type` no span `execute_tool`. E `gen_ai.conversation.id` está definido porque esta aplicação é dona da conversa; a especificação diz para não inventar um (nada de UUID novo, nada de trace id como alternativa) quando você não tem um de verdade.

### Rodando

Primeiro com a captura de conteúdo ligada, para ver o mascaramento funcionar, depois no padrão (desligada) para a análise.

```bash title="terminal"
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=SPAN_ONLY python agent.py
```

```text title="terminal"
requests: 120  content capture: on
```

Estes são três spans de um trace de `order_status` em `spans.jsonl`, resumidos: tirei timestamps, o bloco de resource e o contexto do trace para ficar legível. O e-mail na mensagem do usuário sumiu, a primeira tentativa da ferramenta carrega `error.type`, e a segunda chamada ao modelo mostra o system prompt em cache.

```json title="spans.jsonl (um trace, resumido)"
{
  "name": "chat orion-mini",
  "kind": "SpanKind.CLIENT",
  "parent_id": "0x97b82b18201929a1",
  "status": { "status_code": "UNSET" },
  "attributes": {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "fake_llm",
    "gen_ai.request.model": "orion-mini",
    "gen_ai.request.temperature": 0.0,
    "gen_ai.request.max_tokens": 1024,
    "server.address": "llm.internal.example",
    "server.port": 443,
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.system_instructions": "[{\"type\": \"text\", \"content\": \"You are the support agent for an online store. Use tools for order data. Never invent order ids.\"}]",
    "gen_ai.input.messages": "[{\"role\": \"user\", \"parts\": [{\"type\": \"text\", \"content\": \"Hi, I'm <email>. Where is my order ORD-1002?\"}]}]",
    "gen_ai.response.id": "resp_00005",
    "gen_ai.response.model": "orion-mini",
    "gen_ai.response.finish_reasons": ["tool_call"],
    "gen_ai.usage.input_tokens": 865,
    "gen_ai.usage.output_tokens": 24,
    "gen_ai.output.messages": "[{\"role\": \"assistant\", \"parts\": [{\"type\": \"tool_call\", \"id\": \"call_00005\", \"name\": \"lookup_tracking\", \"arguments\": {\"order_id\": \"ORD-1002\"}}]}]"
  }
}
{
  "name": "execute_tool lookup_tracking",
  "kind": "SpanKind.INTERNAL",
  "parent_id": "0x97b82b18201929a1",
  "status": { "status_code": "ERROR", "description": "carrier API timed out for ORD-1002" },
  "attributes": {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.agent.name": "support-agent",
    "gen_ai.tool.name": "lookup_tracking",
    "gen_ai.tool.call.id": "call_00005",
    "gen_ai.tool.type": "function",
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.tool.call.arguments": "{\"order_id\": \"ORD-1002\"}",
    "error.type": "timeout"
  }
}
{
  "name": "invoke_agent support-agent",
  "kind": "SpanKind.INTERNAL",
  "parent_id": null,
  "status": { "status_code": "UNSET" },
  "attributes": {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": "support-agent",
    "gen_ai.conversation.id": "conv_0002",
    "gen_ai.request.model": "orion-mini",
    "app.tenant.id": "globex",
    "app.feature": "order_status",
    "gen_ai.usage.input_tokens": 1748,
    "gen_ai.usage.output_tokens": 235,
    "gen_ai.response.finish_reasons": ["stop"]
  }
}
```

O span `chat` final do mesmo trace reportou `"gen_ai.usage.input_tokens": 883` com `"gen_ai.usage.cache_read.input_tokens": 850`. Num trace de `refund_help`, o número do cartão virou `<card>` tanto na query do retrieval quanto na entrada do modelo, e os quatro trechos de política foram cortados em 300 caracteres cada, terminando em `...<1977 chars truncated>` dentro de um JSON ainda válido. Uma chamada com rate limit fica assim, um span com um evento:

```json title="spans.jsonl (eventos de um span chat, resumido)"
"name": "chat orion-large",
"events": [{ "name": "app.retry", "attributes": { "error.type": "429", "app.retry.attempt": 1 } }]
```

### O script de análise

Ele faz o papel da linguagem de consulta do seu backend de traces: lê os spans e eventos exportados, calcula o preço de cada span `chat` e liga avaliações e feedback aos seus traces. Também simula uma política de tail sampling sobre os dados completos.

```python title="analyze.py"
import json
import math
from collections import defaultdict
from datetime import datetime

# USD per million tokens. Illustrative numbers for the fake models, versioned with the code.
PRICES = {
    "orion-large": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
    "orion-mini": {"input": 0.25, "cached_input": 0.025, "output": 2.00},
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def seconds(span):
    start = datetime.fromisoformat(span["start_time"])
    end = datetime.fromisoformat(span["end_time"])
    return (end - start).total_seconds()


def p(values, q):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(q * len(ordered)) - 1)]


def cost(attrs):
    price = PRICES[attrs["gen_ai.response.model"]]
    cached = attrs.get("gen_ai.usage.cache_read.input_tokens", 0)
    fresh = attrs["gen_ai.usage.input_tokens"] - cached
    return (fresh * price["input"] + cached * price["cached_input"]
            + attrs["gen_ai.usage.output_tokens"] * price["output"]) / 1_000_000


spans = load("spans.jsonl")
events = load("events.jsonl")
op = lambda s: s["attributes"].get("gen_ai.operation.name")
agents = [s for s in spans if op(s) == "invoke_agent"]
chats = [s for s in spans if op(s) == "chat"]
tool_calls = [s for s in spans if op(s) == "execute_tool"]

print("== cost and latency per feature")
by_feature = defaultdict(lambda: {"cost": 0.0, "tokens": 0, "latency": [], "requests": 0})
for s in chats:
    f = by_feature[s["attributes"]["app.feature"]]
    f["cost"] += cost(s["attributes"])
    f["tokens"] += s["attributes"]["gen_ai.usage.input_tokens"] + s["attributes"]["gen_ai.usage.output_tokens"]
for s in agents:
    f = by_feature[s["attributes"]["app.feature"]]
    f["requests"] += 1
    f["latency"].append(seconds(s))
print(f"{'feature':<18}{'requests':>9}{'cost USD':>11}{'USD/1k req':>12}{'tokens/req':>12}{'p95 s':>8}")
for name, f in sorted(by_feature.items(), key=lambda kv: -kv[1]["cost"]):
    print(f"{name:<18}{f['requests']:>9}{f['cost']:>11.4f}{1000 * f['cost'] / f['requests']:>12.2f}"
          f"{f['tokens'] // f['requests']:>12}{p(f['latency'], 0.95):>8.3f}")

print("\n== cost per tenant")
by_tenant = defaultdict(float)
for s in chats:
    by_tenant[s["attributes"]["app.tenant.id"]] += cost(s["attributes"])
for tenant, total in sorted(by_tenant.items(), key=lambda kv: -kv[1]):
    print(f"{tenant:<18}{total:>11.4f}")

print("\n== chat latency per model")
by_model = defaultdict(list)
for s in chats:
    by_model[s["attributes"]["gen_ai.request.model"]].append(seconds(s))
for model, values in sorted(by_model.items()):
    print(f"{model:<18}calls={len(values):<5}p50={p(values, 0.5):.3f}s  p95={p(values, 0.95):.3f}s  max={max(values):.3f}s")
retries = sum(1 for s in chats for ev in s["events"] if ev["name"] == "app.retry")
print(f"provider retries recorded as span events: {retries}")

print("\n== tools")
by_tool = defaultdict(lambda: [0, 0])
for s in tool_calls:
    t = by_tool[s["attributes"]["gen_ai.tool.name"]]
    t[0] += 1
    t[1] += s["status"]["status_code"] == "ERROR"
for tool, (calls, errors) in sorted(by_tool.items()):
    print(f"{tool:<18}calls={calls:<5}errors={errors:<4}error rate={errors / calls:.1%}")
failed = sum(1 for s in agents if s["attributes"].get("error.type") == "tool_failed")
print(f"requests answered without tool data: {failed} of {len(agents)}")

print("\n== quality signals joined to traces")
trace_of = {s["context"]["trace_id"]: s for s in agents}
scores = defaultdict(list)
for ev in events:
    if ev["event_name"] == "gen_ai.evaluation.result":
        root = trace_of[ev["trace_id"]]
        scores[root["attributes"]["app.feature"]].append(ev["attributes"]["gen_ai.evaluation.score.value"])
for feature, values in sorted(scores.items()):
    fails = sum(v < 3 for v in values)
    print(f"{feature:<18}relevance avg={sum(values) / len(values):.2f}  fail={fails}")
down = [ev for ev in events if ev["event_name"] == "app.user_feedback"]
with_errors = sum(1 for ev in down if trace_of[ev["trace_id"]]["status"]["status_code"] == "ERROR")
print(f"thumbs down: {len(down)}, of which {with_errors} land on traces with an error status")

print("\n== what a tail sampling policy would keep")
kept = [s for s in agents if s["status"]["status_code"] == "ERROR" or seconds(s) > 0.5
        or int(s["context"]["trace_id"], 16) % 10 == 0]
print(f"keep errors + slow (>500 ms) + 10% of the rest: {len(kept)} of {len(agents)} traces "
      f"({len(kept) / len(agents):.0%}), {sum(s['status']['status_code'] == 'ERROR' for s in kept)} errors kept")
```

```bash title="terminal"
python agent.py && python analyze.py
```

```text title="terminal"
requests: 120  content capture: off
== cost and latency per feature
feature            requests   cost USD  USD/1k req  tokens/req   p95 s
refund_help              36     0.3296        9.16        3055   0.284
order_status             60     0.0361        0.60        1925   0.505
summarize_ticket         24     0.0169        0.71        1736   0.063

== cost per tenant
acme                   0.2075
globex                 0.1255
initech                0.0496

== chat latency per model
orion-large       calls=72   p50=0.091s  p95=0.160s  max=0.452s
orion-mini        calls=144  p50=0.037s  p95=0.098s  max=0.450s
provider retries recorded as span events: 7

== tools
get_order         calls=36   errors=0   error rate=0.0%
lookup_tracking   calls=72   errors=18  error rate=25.0%
requests answered without tool data: 6 of 120

== quality signals joined to traces
order_status      relevance avg=4.20  fail=6
refund_help       relevance avg=4.67  fail=0
summarize_ticket  relevance avg=4.50  fail=0
thumbs down: 10, of which 6 land on traces with an error status

== what a tail sampling policy would keep
keep errors + slow (>500 ms) + 10% of the rest: 26 of 120 traces (22%), 6 errors kept
```

As latências são pequenas porque os fakes dormem por milissegundos, mas o formato é o que você veria em produção, e ele diz coisas que nenhuma busca em log diria.

`refund_help` é 30% das requisições e 86% do custo (US$ 0,3296 de US$ 0,3826). Ele roda no modelo grande e leva quatro trechos de política recuperados para todas as chamadas. Isso é uma alavanca concreta: um modelo mais barato para essa feature, menos chunks ou chunks menores, ou um prefixo em cache mais longo. Por tenant, a acme responde por 54% do gasto, que é o número que você mostra quando alguém pergunta se o plano dela está bem precificado.

`order_status` tem o pior p95 (0,505 s) rodando no modelo mais rápido (p95 de 0,098 s por chamada). O problema não é o modelo; são os timeouts da transportadora e os retries. `lookup_tracking` falha em 25% das chamadas, mas só 6 de 120 requisições (5%) terminaram sem os dados da ferramenta, porque o retry absorve a maior parte das falhas e paga por isso em latência. Os dois números importam: a taxa por chamada diz ao time dono da integração com a transportadora que eles têm um problema, a taxa por requisição diz o que os usuários sentiram.

Os 7 retries do provedor não criaram 7 spans extras. A contagem de chamadas continua honesta, e os retries continuam visíveis como eventos se você procurar.

A seção de qualidade liga avaliações e feedback pelo trace id. As 6 notas de relevância reprovadas estão em traces de `order_status` com falha de ferramenta. Dos 10 polegares para baixo, 6 caem em traces com status de erro. Os outros 4 caem em traces que parecem saudáveis por qualquer medida operacional, e é exatamente aí que você vai ler conteúdo (com captura ligada numa amostra) para achar um problema de qualidade que a telemetria não enxerga.

Por fim, a política de tail simulada guardou 26 de 120 traces (22%) e todos os 6 erros. Com tráfego realista, em que erros e requisições lentas são mais raros do que nesta demo, a mesma política guarda uma fatia bem menor. A fatia de 10% usa o trace id, que é aleatório, então esse número varia um pouco entre execuções; a contagem de erros não.

### Apontando para um backend de verdade

Os exporters de JSON lines são para a demo. Num serviço você troca por um exporter OTLP e um `BatchSpanProcessor`, mantém os processors de baggage e mascaramento exatamente como estão e envia para um Collector. Esta parte é configuração ilustrativa, não algo que eu rodei para este post:

```python title="telemetry_otlp.py (ilustrativo)"
# pip install opentelemetry-exporter-otlp-proto-grpc
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor

exporting = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True))
tracer_provider.add_span_processor(RedactingSpanProcessor(exporting))
```

Jaeger e Grafana Tempo aceitam OTLP diretamente, então num ambiente local você pode apontar o exporter para eles e pular o Collector. Para Azure Monitor e Application Insights, a distro OpenTelemetry do Azure Monitor (`pip install azure-monitor-opentelemetry` e depois `configure_azure_monitor(connection_string=...)`, veja a [documentação da Microsoft](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable?tabs=python)) configura os providers para você; ou mantenha OTLP na aplicação e use o exporter `azuremonitor` do Collector. O Collector é onde moram o tail sampling e a segunda passada de mascaramento:

```yaml title="otel-collector.yaml (ilustrativo)"
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  redaction:
    allow_all_keys: true
    blocked_values:
      - "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+"
  tail_sampling:
    decision_wait: 30s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 8000 }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }
  batch: {}

connectors:
  spanmetrics:
    dimensions:
      - name: gen_ai.operation.name
      - name: gen_ai.request.model
      - name: app.feature

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls: { insecure: true }
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write

service:
  pipelines:
    traces/all:
      receivers: [otlp]
      processors: [redaction, batch]
      exporters: [spanmetrics]
    traces/sampled:
      receivers: [otlp]
      processors: [redaction, tail_sampling, batch]
      exporters: [otlp/tempo]
    metrics/spans:
      receivers: [spanmetrics]
      exporters: [prometheusremotewrite]
```

Dois pipelines leem o mesmo receiver de propósito: o [spanmetrics connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector) enxerga 100% dos spans, então contagem de chamadas, taxas de erro e histogramas de latência são exatos, e só o armazenamento de traces é amostrado.

## Checagem de realidade em produção

### Nunca calcule custo a partir de traces amostrados

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O backend de traces tem todas as contagens de tokens. Vou montar o dashboard de custo como uma query que soma por feature.</span>
    </div>
  </div>
</div>

Ele tem todas as contagens de tokens dos traces que você guardou. Depois do tail sampling, isso são erros, requisições lentas e uma fatia aleatória, uma amostra enviesada: requisições lentas costumam ser as longas e caras, então a soma erra para os dois lados ao mesmo tempo. O meu script de análise escapa disso porque lê spans sem amostragem. Em produção, custo precisa de uma fonte sem amostragem: um contador de tokens registrado no processo (a métrica `gen_ai.client.token.usage`, com feature e modelo como dimensões), um pipeline no Collector que agrega antes da amostragem, ou o export de uso do provedor, conciliado todo mês. Use traces para explicar um número de custo, não para produzi-lo.

### As convenções vão mudar debaixo de você

O status Development não é formalidade. Entre julho e setembro de 2026 o repositório acrescentou spans `fetch_response`, depreciou o finish reason por mensagem, acrescentou detalhamento de uso por modalidade e cache e começou a reformular as métricas de tokens. Fixe as versões do SDK e das instrumentações, defina `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` por decisão e não por acidente, e mantenha seus dashboards num conjunto pequeno de atributos que estão estáveis na prática há algum tempo (`gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.tool.name`, `error.type`). Quando um rename chegar, um dashboard que lê os dois nomes durante uma versão sai mais barato do que um buraco no seu relatório de custo.

### Cardinalidade decide o que pode virar métrica

Tudo o que você coloca num span pode ser buscado. Tudo o que você promove a dimensão de métrica multiplica o número de séries. Modelo, operação, feature e nome de ferramenta são limitados e tudo bem. Tenant tudo bem se você tem dezenas ou centenas, não se tem um milhão de contas self-service. User id, conversation id, response id e texto de prompt nunca devem virar dimensão de métrica; eles pertencem aos spans, onde cardinalidade é de graça. O spanmetrics connector cria de bom grado uma série por conversa se você pedir, e a sua conta de métricas vai contar isso no mês seguinte.

### Dashboards e alertas que valem a pena

Uma lista curta que justifica o espaço na tela:

- **p95 de latência por modelo e operação**, a partir de `gen_ai.client.operation.duration` ou do spanmetrics. Alerte numa regressão depois de um deploy ou de uma troca de versão de prompt (`gen_ai.prompt.name` e `gen_ai.prompt.version` existem para isso).
- **Tokens por requisição por feature**, entrada e saída separadas. Uma contagem de entrada que sobe devagar geralmente é uma mudança no retrieval ou um histórico de conversa que ninguém corta.
- **Taxa de erro por ferramenta, por chamada e por requisição.** Acorde alguém pela taxa por requisição, abra ticket pela taxa por chamada.
- **Custo por feature por dia contra um orçamento**, a partir da fonte sem amostragem. Alerte numa anomalia diária, não num total mensal que você descobre tarde demais.
- **Finish reasons.** Uma fatia crescente de `length` significa respostas truncadas; uma fatia crescente de `content_filter` significa mudança no prompt ou no perfil dos usuários.
- **Taxa de 429 e de retry por provedor**, a partir dos eventos dos spans. Retries são o aviso antecipado mais barato de problema de cota, e o lugar onde uma política de resiliência como as de [Building a Resilient .NET API with Polly](/pt-br/blog/resilient-dotnet-api-polly/) ou salva você ou esconde o problema.
- **Taxa de reprovação nas avaliações e de polegar para baixo por feature**, cada uma com link para traces de exemplo.

### Coisas menores que mordem

- **Contexto entre threads e tarefas assíncronas.** Uma ferramenta que roda num thread pool sem o contexto pai começa um trace novo. Copie o contexto para o worker (`contextvars.copy_context()`, ou a instrumentação de threading) e fique de olho em traces órfãos com um único span `execute_tool`.
- **Limites de tamanho de atributo.** Backends rejeitam ou truncam valores grandes, e o SDK tem o seu próprio `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`. Mascare e trunque você mesmo, para o corte acontecer onde você escolheu.
- **Descarte na fila do batch.** Sob carga, o `BatchSpanProcessor` descarta spans quando a fila enche. Acompanhe os logs do próprio SDK e dimensione a fila para o seu pico, não para a sua média.
- **Streaming.** Registre `gen_ai.response.time_to_first_chunk` e feche o span quando o stream terminar, não quando o primeiro chunk chegar. Um span que fecha cedo faz toda chamada com streaming parecer rápida.

Fazer tracing de um agente é, na maior parte, disciplina sobre onde cada informação fica. Dê aos spans os nomes que as convenções GenAI definem, defina os atributos relevantes para amostragem na criação, deixe o conteúdo desligado por padrão e mascarado quando ligado, carimbe tenant e feature a partir do baggage, calcule dinheiro a partir de tokens fora do store de traces e pendure avaliações e feedback no trace id. Aí as perguntas da segunda de manhã, por que esse cliente recebeu uma resposta ruim e quem está gastando o dinheiro, viram consultas em vez de investigações.
