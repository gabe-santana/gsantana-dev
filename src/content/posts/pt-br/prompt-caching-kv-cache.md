---
title: "Prompt caching a partir do KV cache: por que seu agente paga preço cheio pelo mesmo prompt"
description: "Como o KV cache e o cache de prefixo funcionam dentro dos engines de inferência, e como montar prompts de agentes para o prompt caching dos provedores realmente acertar."
date: 2026-07-08
tags: [LLM, AI Agents, Python, Performance]
tldr:
  - "Prompt caching é reuso de KV cache: o engine guarda as chaves e os valores que já calculou para um prefixo, então um acerto pula o prefill desses tokens e os cobra por uma fração do preço de input."
  - "É um match estrito de prefixo sobre blocos com hash: um byte alterado (um timestamp, uma tool reordenada, um JSON sem ordenação) invalida tudo que vem depois, então o conteúdo estável vai primeiro e o volátil por último."
  - "Meça pelos campos de usage de cada resposta, não uma vez só: tokens em cache sobre o total de tokens do prompt é o número que avisa que um refactor dobrou a conta em silêncio."
---

Imagine um agente de atendimento com doze tools, um system prompt de umas mil e quatrocentas palavras e conversas de seis a dez turnos. Todo turno reenvia tudo isso, mais o histórico, mais três chunks recuperados da base de conhecimento. O time ligou o prompt caching semanas atrás e seguiu em frente. A fatura diz outra coisa: os tokens de input em cache são cerca de um por cento do total. Alguém colocou `Current time: {now}` na primeira linha do system prompt para o modelo parar de errar datas, e o registro de tools é montado juntando dicionários de plugins, então o JSON das tools sai numa ordem diferente dependendo de qual worker atende a requisição.

Nenhuma das duas mudanças está errada isoladamente. As duas destroem a única propriedade da qual o cache depende: que o começo do prompt seja idêntico, byte a byte, entre requisições. Este post vai de baixo para cima. O que o KV cache realmente guarda e por que o prefill é a parte cara, como os engines de inferência transformam isso num cache de prefixo com hashes de bloco encadeados, o que a Anthropic e a OpenAI expõem por cima disso e, depois, a engenharia: um layout de prompt que mantém estável a parte estável, uma simulação que mostra quanto custa cada erro e como ler os campos de usage para perceber quando quebra. O Júnior Inocente também aparece.

## O problema e o contexto

Um agente é um loop que chama uma API sem estado. Cada iteração envia as definições das tools, o system prompt, a conversa inteira até ali, os resultados das tools e o turno novo do usuário. A resposta do modelo tem algumas centenas de tokens; o prompt tem milhares, e cresce a cada turno. Nos agentes que construí, os tokens de input dominam a conta com folga, e a maior parte deles são os mesmos tokens que o modelo viu uma requisição antes.

Recalcular esses tokens é desperdício puro, e toda stack séria de serving sabe disso. Engines de inferência como vLLM e SGLang guardam o estado de atenção dos prefixos que já processaram e o reaproveitam. Os provedores expõem o mesmo mecanismo como prompt caching: a Anthropic cobra leituras de cache a um décimo do preço base de input na maioria dos modelos, e a OpenAI aplica um desconto automático em prompts acima de 1.024 tokens. O ganho de latência também é real, já que o tempo até o primeiro token é dominado pelo processamento do prompt.

O problema é que o cache é um match estrito de prefixo. Ele não entende o seu prompt, ele compara bytes (na verdade tokens, o que dá no mesmo). Se qualquer coisa muda na posição N, tudo a partir de N é falha, e nada avisa. Sem erro, sem warning, a resposta é idêntica. O único sinal é um campo no objeto de usage que a maior parte do código nunca lê.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Cache é trabalho do provedor. Coloquei o cache_control, a documentação diz que funciona, pronto.</span>
    </div>
  </div>
</div>

O provedor faz cache de qualquer prefixo que você mandar. Se esse prefixo se repete ou não é decidido inteiramente pelo seu código de montagem do prompt, e esse código muda o tempo todo: alguém coloca uma feature flag no system prompt, um upgrade de biblioteca reordena chaves de JSON, uma tool nova é inserida no meio da lista. O marcador é a parte fácil. Manter estáveis os bytes na frente dele é uma propriedade de engenharia do seu código e, como qualquer outra propriedade, regride se nada a verifica.

## Mergulho na arquitetura

### O que o KV cache guarda

Um transformer só de decoder gera um token por vez, e cada token novo presta atenção em todos os tokens anteriores. Em cada camada, cada token é projetado numa query, numa key e num value. A query do token novo é comparada com as keys de todos os tokens anteriores, e os pesos resultantes misturam os values deles. As keys e values dos tokens passados nunca mudam depois de calculados, porque um token só enxerga o que veio antes dele. Então o engine os calcula uma vez e guarda: esse armazenamento é o KV cache.

O tamanho é fácil de calcular. Para cada token do contexto, cada camada guarda um vetor de key e um vetor de value por KV head:

`bytes por token = 2 x camadas x kv_heads x head_dim x bytes_por_valor`

O termo `kv_heads` é onde a arquitetura pesa. A atenção multi-head clássica tem um KV head por head de query. A [multi-query attention](https://arxiv.org/abs/1911.02150) compartilha um único KV head entre todos os heads de query, e a [grouped-query attention](https://arxiv.org/abs/2305.13245) fica no meio, compartilhando cada KV head com um grupo. O Llama 2 7B usa multi-head completa, com 32 KV heads; o Llama 3.1 8B tem a mesma profundidade e o mesmo tamanho de head, mas 8 KV heads, o que deixa o KV cache dele quatro vezes menor por token. A calculadora da seção prática coloca números reais nisso: 512 KiB por token no Llama 2 7B, 128 KiB no Llama 3.1 8B, 320 KiB no Llama 3.1 70B. Um prompt de agente com 8.000 tokens no modelo de 70B ocupa 2,5 GiB de memória de GPU só de KV cache.

Esse é o primeiro motivo pelo qual o cache de prefixo não sai de graça para o provedor: prefixos em cache ocupam a mesma memória de GPU de que as requisições em execução precisam, então todo cache também é uma política de despejo.

### Prefill é a parte cara, decode é a parte lenta

Atender uma requisição tem duas fases. O **prefill** passa o prompt inteiro pelo modelo numa única passada. Todos os tokens do prompt são conhecidos de antemão, então o trabalho é feito de grandes multiplicações de matrizes sobre milhares de tokens de uma vez, o que mantém ocupadas as unidades de cálculo da GPU. O custo cresce com o tamanho do prompt e determina o tempo até o primeiro token. O **decode** gera um token por passo. Cada passo faz pouca aritmética, mas precisa ler da memória todos os pesos do modelo e o KV cache inteiro para produzir um único token, então é limitado pela banda de memória e não pelo cálculo.

Um acerto de cache elimina o trabalho de prefill dos tokens em cache. Ele não deixa o decode mais rápido (o decode continua lendo o cache inteiro), mas para um agente cujo prompt é 20 vezes maior que a resposta, é no prefill que estão a conta de input e boa parte do tempo até o primeiro token. Medi as duas fases num modelo minúsculo, em CPU, na seção prática: o prefill de 2.048 tokens levou 6,3 segundos, enquanto reaproveitar um prefixo de 1.920 tokens em cache e fazer prefill só dos últimos 128 levou 0,56 segundo, com os mesmos logits do próximo token dentro do ruído de ponto flutuante. São números de modelo pequeno em CPU, mas o formato é o mesmo em qualquer lugar: o trabalho que você pula é proporcional aos tokens que você não recalcula.

### De um KV cache para um cache de prefixo

O KV cache de uma requisição vive só enquanto a requisição dura. Compartilhá-lo entre requisições exige duas coisas: um layout de memória que permita a requisições dividir partes de um cache, e um jeito de descobrir que uma requisição nova começa com um prefixo que já está na memória.

O layout veio do [PagedAttention](https://arxiv.org/abs/2309.06180), o paper por trás do vLLM. Em vez de um buffer contínuo por requisição, o KV cache é dividido em blocos de tamanho fixo (16 tokens é um tamanho típico), e cada requisição tem uma tabela de blocos que mapeia as posições lógicas dos tokens para blocos físicos, do jeito que um sistema operacional mapeia páginas virtuais para frames físicos. Duas requisições podem apontar para o mesmo bloco físico, com uma contagem de referências para saber quando ele fica livre.

Achar o prefixo compartilhado é o trabalho do [automatic prefix caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html). O vLLM calcula o hash de cada bloco cheio a partir dos tokens do bloco junto com o hash do bloco anterior, mais chaves extras para qualquer coisa que mude o cálculo (o id de um adapter LoRA, os hashes das imagens do bloco, um cache salt por tenant). Uma requisição nova é cortada em blocos, os hashes são calculados em ordem, e o engine os percorre na tabela até a primeira falha. Tudo antes da falha é reaproveitado; tudo depois é calculado e inserido. Só blocos cheios entram no cache, e blocos que ninguém referencia são despejados do menos usado recentemente para o mais usado.

<div id="pckv-engine-path-slot"></div>

O [RadixAttention](https://arxiv.org/abs/2312.07104) do SGLang chega ao mesmo resultado com outra estrutura de dados: uma radix tree sobre sequências de tokens, em que cada aresta guarda uma sequência de tokens e os tensores de KV correspondentes, com despejo LRU e um scheduler que prioriza requisições que compartilham prefixos longos em cache. Os detalhes mudam, o contrato é idêntico. Uma entrada de cache é identificada pela sequência completa de tokens que levou até ela.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Para que encadear os hashes? Faz o hash de cada bloco sozinho e o mesmo parágrafo é reaproveitado onde quer que apareça. Muito mais acertos.</span>
    </div>
  </div>
</div>

Mais acertos, todos errados. As keys e values de um token não são função só do token. Da segunda camada em diante, o estado oculto de um token é uma mistura de tudo que veio antes dele, e a posição entra via encoding posicional. O mesmo parágrafo depois de outro system prompt produz keys e values diferentes em quase todas as camadas, então reaproveitá-los mudaria a saída do modelo em silêncio. O hash encadeado codifica exatamente essa dependência: o hash de um bloco identifica o bloco e todo o prefixo dele, e é por isso que um único byte alterado no começo do prompt invalida todos os blocos seguintes.

<div id="pckv-block-chain-slot"></div>

### O que os provedores expõem

Os provedores rodam essa maquinaria em escala e vendem o resultado, com preços e regras que moldam como você deve montar os prompts. Os números abaixo vêm da documentação oficial no momento em que escrevo; eles mudam, então confira as páginas linkadas antes de montar uma planilha em cima deles.

A **Anthropic** ([documentação de prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) deixa o cache explícito e cobrado nos dois sentidos. Você marca até quatro breakpoints com `cache_control: {"type": "ephemeral"}` em blocos de conteúdo, ou coloca um único `cache_control` no nível da requisição e deixa a API posicionar o breakpoint no último bloco que pode entrar em cache e avançá-lo conforme a conversa cresce. O prompt é renderizado numa ordem fixa, `tools`, depois `system`, depois `messages`, então um breakpoint no último bloco do system coloca em cache as tools e o system prompt juntos. O preço é relativo ao preço base de input do modelo: uma escrita custa 1,25x com o TTL padrão de 5 minutos ou 2x com o TTL de 1 hora (`"ttl": "1h"`), e uma leitura custa 0,1x na maioria dos modelos. O TTL é renovado toda vez que a entrada é lida. Existe um tamanho mínimo para entrar em cache que depende do modelo, por exemplo 1.024 tokens no Claude Sonnet 4.5 e 4.6 e 4.096 no Claude Opus 4.5 e 4.6 e no Haiku 4.5; abaixo disso a requisição simplesmente não entra em cache, sem erro. Cada breakpoint olha no máximo 20 blocos para trás em busca de uma entrada anterior. Os caches são isolados por workspace, e uma entrada só fica disponível para leitura quando a resposta que a escreve começa a ser transmitida.

A resposta conta o que aconteceu em três campos: `cache_creation_input_tokens` (escritos nesta requisição, cobrados pelo preço de escrita), `cache_read_input_tokens` (servidos do cache) e `input_tokens`, que é só a parte depois do último breakpoint. O tamanho do prompt é a soma dos três. Um objeto `cache_creation` separa as escritas por TTL (`ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`).

A **OpenAI** ([guia de prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Prompt Caching 201](https://developers.openai.com/cookbook/examples/prompt_caching_201)) faz tudo automaticamente. Qualquer prompt com 1.024 tokens ou mais é elegível, e os acertos são contados em incrementos de 128 tokens. As requisições são roteadas para as máquinas por um hash de aproximadamente os primeiros 256 tokens, opcionalmente combinado com um `prompt_cache_key` que você envia para manter o tráfego relacionado junto; uma mesma combinação de prefixo e chave é bem atendida até umas 15 requisições por minuto, e depois disso o tráfego transborda para mais máquinas que ainda não têm o cache. A retenção em memória dura algo como 5 a 10 minutos de inatividade, até uma hora, e os modelos compatíveis aceitam `prompt_cache_retention: "24h"` para retenção estendida. Não há sobretaxa de escrita; os tokens em cache são cobrados com um desconto que depende do modelo (50% no GPT-4o, 75% no GPT-4.1 e 90% na família GPT-5, segundo o cookbook). A contagem chega em `usage.prompt_tokens_details.cached_tokens` no Chat Completions e em `usage.input_tokens_details.cached_tokens` na Responses API e, nos dois casos, está incluída no total de tokens do prompt em vez de somada a ele.

Duas interfaces bem diferentes, uma regra por baixo: o cache guarda prefixos, e o prefixo é o que o seu código colocou primeiro.

### Desenhando o prompt para o cache

Tudo decorre de ordenar o prompt pela frequência com que cada parte muda, da mais estável para a menos estável.

<div id="pckv-prompt-layout-slot"></div>

**Tools primeiro, determinísticas.** As definições das tools são renderizadas antes de tudo na Anthropic e fazem parte do prefixo roteado na OpenAI, então precisam ser idênticas byte a byte. Ordene por nome, serialize com chaves ordenadas e separadores fixos, e monte a partir de um registro estático, não da ordem que um carregador de plugins ou um `set` produz. Não adicione nem remova tools a cada turno para implementar modos; um modo fica melhor como dado na conversa. É a mesma disciplina que deixa a chamada de tools segura em primeiro lugar, e escrevi sobre ela em [Deterministic Tool Calling](/pt-br/blog/deterministic-tool-calling/): um registro estático, validado e versionado também é um registro que entra em cache.

**System prompt congelado.** Sem relógio, sem id de requisição, sem nome de usuário, sem seções condicionais ligadas por feature flags. Cada variante do system prompt é uma entrada de cache separada, e um valor por requisição dentro dele faz de cada requisição uma entrada nova que ninguém nunca lê.

**Histórico só cresce.** O prompt da requisição anterior deve reaparecer, sem mudanças, como prefixo da próxima. Isso significa nunca editar, reordenar ou renderizar de novo turnos anteriores, e manter o contexto recuperado de um turno passado exatamente onde ele estava, em vez de trocá-lo num espaço compartilhado de "contexto" a cada turno. Num agente de RAG (do tipo que descrevi em [Agentic Mesh Architecture](/pt-br/blog/agentic-mesh-architecture-rag-agents/)) esse é o erro mais comum: chunks recuperados colocados logo depois do system prompt, trocados a cada turno, invalidando toda a conversa que vem atrás deles.

**Conteúdo volátil por último.** Os chunks recuperados para este turno, a hora atual e a pergunta vão na mensagem mais nova do usuário, depois do último breakpoint. Eles pagam o preço cheio de input uma vez e, do turno seguinte em diante, fazem parte do histórico em cache.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas o modelo precisa saber que dia é hoje. A hora atual tem que ir no system prompt.</span>
    </div>
  </div>
</div>

Ele precisa saber, não precisa saber na posição zero. Coloque a hora no turno mais novo do usuário, que já é parte da cauda volátil de qualquer jeito, e o modelo lê do mesmo jeito. Se alguma restrição de produto obrigar a colocá-la no system prompt, diminua a resolução: uma data muda uma vez por dia, o que custa uma escrita fria por prefixo por dia em vez de uma por requisição. Um timestamp com segundos na primeira linha é a linha de código mais cara do agente.

## Implementação na prática

Quatro peças de Python: uma calculadora de memória de KV, uma medição do prefill contra um prefixo em cache num modelo real, uma simulação de um cache de prefixo com hash de blocos sobre tráfego de agente com layouts bons e ruins, e um módulo pequeno que lê os campos de cache das respostas dos provedores. As três primeiras rodaram na minha máquina e as saídas abaixo foram copiadas dessas execuções. As chamadas aos provedores no final são ilustrativas, como explico lá.

### Memória de KV cache em poucas linhas

```python title="kv_memory.py"
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelConfig:
    name: str
    layers: int
    kv_heads: int
    head_dim: int
    bytes_per_value: int = 2  # bf16 / fp16


def kv_bytes_per_token(cfg: ModelConfig) -> int:
    # One K and one V vector per KV head, per layer, for every token in the context.
    return 2 * cfg.layers * cfg.kv_heads * cfg.head_dim * cfg.bytes_per_value


def fmt(n: float) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024:
            return f"{n:,.1f} {unit}"
        n /= 1024
    return f"{n:,.1f} TiB"


MODELS = [
    ModelConfig("Llama-2-7B (MHA)", layers=32, kv_heads=32, head_dim=128),
    ModelConfig("Llama-3.1-8B (GQA)", layers=32, kv_heads=8, head_dim=128),
    ModelConfig("Qwen2.5-7B (GQA)", layers=28, kv_heads=4, head_dim=128),
    ModelConfig("Llama-3.1-70B (GQA)", layers=80, kv_heads=8, head_dim=128),
    ModelConfig("Llama-3.1-70B, FP8 KV", layers=80, kv_heads=8, head_dim=128, bytes_per_value=1),
]

if __name__ == "__main__":
    free_for_kv = 40 * 1024**3  # an example budget: GPU memory left for KV after weights
    print(f"{'model':<24}{'per token':>12}{'8K prompt':>12}{'128K ctx':>12}{'8K seqs in 40 GiB':>20}")
    for cfg in MODELS:
        per_token = kv_bytes_per_token(cfg)
        print(
            f"{cfg.name:<24}{fmt(per_token):>12}{fmt(per_token * 8192):>12}"
            f"{fmt(per_token * 131072):>12}{free_for_kv // (per_token * 8192):>20,}"
        )
```

```text title="terminal"
$ python kv_memory.py
model                      per token   8K prompt    128K ctx   8K seqs in 40 GiB
Llama-2-7B (MHA)           512.0 KiB     4.0 GiB    64.0 GiB                  10
Llama-3.1-8B (GQA)         128.0 KiB     1.0 GiB    16.0 GiB                  40
Qwen2.5-7B (GQA)            56.0 KiB   448.0 MiB     7.0 GiB                  91
Llama-3.1-70B (GQA)        320.0 KiB     2.5 GiB    40.0 GiB                  16
Llama-3.1-70B, FP8 KV      160.0 KiB     1.2 GiB    20.0 GiB                  32
```

As configurações são as publicadas (camadas, KV heads e tamanho de head vindos do config de cada modelo). Olhe a última coluna: com 40 GiB reservados para KV, um modelo de 70B comporta 16 prompts simultâneos de 8K tokens em bf16. Cada prefixo em cache que um provedor mantém disputa esse espaço com requisições que estão rodando agora, e é por isso que os caches têm TTLs curtos e despejo LRU, e por isso que um prefixo que ninguém lê por alguns minutos desaparece.

### Medindo o prefill contra um prefixo em cache

Para ver o custo do prefill de verdade, rodei o [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) com Hugging Face Transformers em CPU (4 threads, float32). O script monta um prompt de 2.048 tokens a partir de um prefixo "estável" de 1.920 tokens e um sufixo "volátil" de 128 tokens, e compara um prefill frio de tudo contra reaproveitar o KV cache do prefixo e fazer prefill só do sufixo. Ele também confere se os dois caminhos produzem os mesmos logits e mede alguns passos de decode.

```python title="prefill_vs_cached.py"
import copy
import statistics
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from kv_memory import ModelConfig, fmt, kv_bytes_per_token

MODEL_ID = "HuggingFaceTB/SmolLM2-135M"
torch.set_num_threads(4)
torch.manual_seed(0)

tok = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float32).eval()
cfg = model.config
head_dim = cfg.hidden_size // cfg.num_attention_heads
spec = ModelConfig(MODEL_ID, cfg.num_hidden_layers, cfg.num_key_value_heads, head_dim, bytes_per_value=4)

# A long, stable prefix (think: tool definitions + system prompt) and a short, volatile suffix.
prefix_ids = torch.randint(1000, cfg.vocab_size - 1000, (1, 1920))
suffix_ids = torch.randint(1000, cfg.vocab_size - 1000, (1, 128))
full_ids = torch.cat([prefix_ids, suffix_ids], dim=1)


def timed(fn, repeats=5):
    samples = []
    for i in range(repeats):
        start = time.perf_counter()
        out = fn(i)
        samples.append(time.perf_counter() - start)
    return out, statistics.median(samples)


with torch.inference_mode():
    # Cold: prefill all 2,048 tokens.
    cold_out, cold_s = timed(lambda i: model(full_ids, use_cache=True))
    stored = sum(layer.keys.nbytes + layer.values.nbytes for layer in cold_out.past_key_values.layers)

    # Build the prefix cache once, then reuse a copy of it for every "request".
    prefix_out = model(prefix_ids, use_cache=True)
    copies = [copy.deepcopy(prefix_out.past_key_values) for _ in range(5)]  # the engine keeps blocks; we copy
    warm_out, warm_s = timed(lambda i: model(suffix_ids, past_key_values=copies[i], use_cache=True))

    # Same next-token logits either way: the cache is an exact shortcut, not an approximation.
    max_diff = (cold_out.logits[:, -1] - warm_out.logits[:, -1]).abs().max().item()

    # Decode: one token at a time on top of the full context.
    cache = cold_out.past_key_values
    next_id = cold_out.logits[:, -1].argmax(-1, keepdim=True)
    step_times = []
    for _ in range(32):
        start = time.perf_counter()
        step = model(next_id, past_key_values=cache, use_cache=True)
        step_times.append(time.perf_counter() - start)
        cache = step.past_key_values
        next_id = step.logits[:, -1].argmax(-1, keepdim=True)


print(f"model: {MODEL_ID}  layers={spec.layers} kv_heads={spec.kv_heads} head_dim={spec.head_dim}")
print(f"formula, per token:          {fmt(kv_bytes_per_token(spec))}")
print(f"measured cache for 2048 tok: {fmt(stored)}  (formula: {fmt(kv_bytes_per_token(spec) * 2048)})")
print(f"cold prefill, 2048 tokens:   {cold_s * 1000:7.1f} ms")
print(f"cached prefix + 128 tokens:  {warm_s * 1000:7.1f} ms  ({cold_s / warm_s:.1f}x faster)")
print(f"max |logit diff| cold/warm:  {max_diff:.2e}")
print(f"decode, per token:           {statistics.median(step_times) * 1000:7.1f} ms")
print(f"prefill, per token:          {cold_s / 2048 * 1000:7.2f} ms")
```

```text title="terminal"
$ python prefill_vs_cached.py
model: HuggingFaceTB/SmolLM2-135M  layers=30 kv_heads=3 head_dim=64
formula, per token:          45.0 KiB
measured cache for 2048 tok: 90.0 MiB  (formula: 90.0 MiB)
cold prefill, 2048 tokens:    6253.7 ms
cached prefix + 128 tokens:    557.0 ms  (11.2x faster)
max |logit diff| cold/warm:  1.91e-05
decode, per token:              58.2 ms
prefill, per token:             3.05 ms
```

Três coisas para tirar daqui. A fórmula bate com os tensores que a biblioteca realmente alocou, byte a byte. Reaproveitar o prefixo reduziu o tempo até o primeiro token em 11x, e o ideal aqui é cerca de 16x (2.048 tokens contra 128); o resto é atenção sobre o contexto longo em cache e ruído numa máquina compartilhada, então leia a razão como "uma ordem de grandeza", não como benchmark. E os logits diferem em 2e-5, arredondamento de float32: um acerto de cache dá a mesma saída do modelo, não uma aproximação dela.

A linha do decode mostra a outra assimetria: 58 ms para um token contra 3 ms por token durante o prefill. Numa CPU com um modelo minúsculo, parte disso é overhead por passo e não banda de memória, então não extrapole a razão para uma GPU. A direção vale em qualquer lugar: o prefill processa tokens em lote, o decode paga uma passada completa pelos pesos e pelo cache a cada token.

### Simulando um cache de prefixo sobre tráfego de agente

Agora a parte que importa para o seu código de prompt. O simulador abaixo implementa o lado do engine (hashes SHA-256 encadeados por bloco, blocos de 16 tokens, só blocos cheios em cache, despejo LRU) e passa por ele um tráfego realista de agente: 60 sessões de atendimento de 8 turnos, intercaladas em ordem aleatória, com 12 definições de tools, um system prompt de 1.400 palavras, três chunks recuperados por turno, uma pergunta e uma resposta. O tokenizador separa palavras e pontuação, o que conta um pouco a mais de tokens no JSON do que um BPE real, mas serve para medir prefixos compartilhados.

Ele renderiza o mesmo tráfego com quatro layouts. O ruim tem o relógio na primeira linha do system prompt, o contexto recuperado num espaço logo depois do system prompt e um JSON de tools cuja ordem de chaves varia (como acontece quando o registro é montado com dicionários mesclados em tempo de execução). Cada correção remove um erro.

```python title="prefix_cache_sim.py"
import hashlib
import json
import random
import re
from collections import OrderedDict
from dataclasses import dataclass

BLOCK = 16  # tokens per KV block, a typical engine block size


class Tokenizer:
    """Words and punctuation as tokens: cruder than BPE, close enough to count prefixes."""

    def __init__(self) -> None:
        self.vocab: dict[str, int] = {}

    def encode(self, text: str) -> list[int]:
        return [self.vocab.setdefault(piece, len(self.vocab)) for piece in re.findall(r"\w+|[^\w\s]", text)]


class PrefixCache:
    """Hash-chained full blocks with LRU eviction, the way automatic prefix caching works."""

    def __init__(self, capacity_blocks: int) -> None:
        self.capacity = capacity_blocks
        self.blocks: OrderedDict[bytes, None] = OrderedDict()

    def lookup_and_insert(self, tokens: list[int]) -> int:
        parent = b""
        cached = 0
        missed = False
        for start in range(0, len(tokens) - BLOCK + 1, BLOCK):
            # A block's identity is its tokens AND everything before it, via the parent hash.
            block_hash = hashlib.sha256(parent + repr(tokens[start:start + BLOCK]).encode()).digest()
            if not missed and block_hash in self.blocks:
                self.blocks.move_to_end(block_hash)
                cached += BLOCK
            else:
                missed = True  # after the first miss, nothing further down the chain can hit
                self.blocks[block_hash] = None
                if len(self.blocks) > self.capacity:
                    self.blocks.popitem(last=False)
            parent = block_hash
        return cached


def make_tools(rng: random.Random) -> list[dict]:
    names = ["search_orders", "get_order", "refund_order", "search_kb", "get_customer", "update_address",
             "create_ticket", "escalate", "get_invoice", "send_email", "check_stock", "schedule_callback"]
    tools = []
    for name in names:
        props = {f"{name}_arg{i}": {"type": rng.choice(["string", "integer", "boolean"]),
                                    "description": " ".join(rng.choices(WORDS, k=12))} for i in range(6)}
        tools.append({"name": name, "description": " ".join(rng.choices(WORDS, k=40)),
                      "input_schema": {"type": "object", "properties": props, "required": list(props)[:2]}})
    return tools


WORDS = ("order customer refund policy invoice shipping address account payment status carrier warehouse "
         "return window days escalate agent verify identity email phone ticket priority product stock "
         "discount coupon region currency tax receipt delivery tracking damaged missing late cancel").split()


def shuffled_keys(value, rng: random.Random):
    """What a dict built from a set, or merged from plugins, looks like: same content, different order."""
    if isinstance(value, dict):
        items = list(value.items())
        rng.shuffle(items)
        return {k: shuffled_keys(v, rng) for k, v in items}
    if isinstance(value, list):
        return [shuffled_keys(v, rng) for v in value]
    return value


@dataclass
class Layout:
    name: str
    timestamp_on_top: bool
    context_in_system: bool
    unstable_tools: bool


def render(layout: Layout, tools, system: str, history: list[str], context: str, question: str,
           now: str, rng: random.Random) -> tuple[str, str]:
    """Returns the prompt and the new user turn, as it should be kept in history."""
    if layout.unstable_tools:
        tool_block = json.dumps(shuffled_keys(tools, rng))
    else:
        tool_block = json.dumps(sorted(tools, key=lambda t: t["name"]), sort_keys=True, separators=(",", ":"))
    head = f"Current time: {now}\n" if layout.timestamp_on_top else ""
    tail = "" if layout.timestamp_on_top else f"\n(current time: {now})"
    if layout.context_in_system:
        turn = "User: " + question + tail
        return "\n".join([tool_block, head + system, "Context:\n" + context, *history, turn]), turn
    turn = "Context:\n" + context + "\nUser: " + question + tail
    return "\n".join([tool_block, head + system, *history, turn]), turn


def simulate(layout: Layout, sessions=60, turns=8, seed=7) -> tuple[int, int]:
    rng = random.Random(seed)
    tokenizer = Tokenizer()
    tools = make_tools(random.Random(1))
    system = " ".join(random.Random(2).choices(WORDS, k=1400))
    corpus = [" ".join(random.Random(100 + i).choices(WORDS, k=150)) for i in range(300)]
    cache = PrefixCache(capacity_blocks=60_000)

    state = {s: {"turn": 0, "history": []} for s in range(sessions)}
    total = cached = 0
    clock = 0
    while state:
        sid = rng.choice(list(state))
        session = state[sid]
        clock += rng.randint(1, 20)
        now = f"2026-07-08T{9 + clock // 3600:02d}:{clock // 60 % 60:02d}:{clock % 60:02d}Z"
        question = " ".join(rng.choices(WORDS, k=30))
        context = "\n".join(rng.sample(corpus, 3))
        prompt, turn = render(layout, tools, system, session["history"], context, question, now, rng)
        tokens = tokenizer.encode(prompt)
        total += len(tokens)
        cached += cache.lookup_and_insert(tokens)

        answer = " ".join(rng.choices(WORDS, k=120))
        # Append-only history: the turn is kept exactly as it was sent, then the answer after it.
        session["history"].append(f"{turn}\nAssistant: {answer}")
        session["turn"] += 1
        if session["turn"] == turns:
            del state[sid]
    return total, cached


LAYOUTS = [
    Layout("bad: clock on top, context in system, tools drift", True, True, True),
    Layout("fix 1: deterministic tool JSON", True, True, False),
    Layout("fix 2: + clock moved to the end", False, True, False),
    Layout("good: + context appended, never rewritten", False, False, False),
]

if __name__ == "__main__":
    print(f"{'layout':<52}{'prompt tok':>11}{'cached':>8}{'billed':>10}")
    for layout in LAYOUTS:
        total, cached = simulate(layout)
        # Anthropic-style multipliers: misses are written at 1.25x, hits read at 0.1x (uncached is 1.0x).
        billed = (total - cached) * 1.25 + cached * 0.10
        print(f"{layout.name:<52}{total:>11,}{cached / total:>8.1%}{billed / 1e6:>9.2f}M")
```

```text title="terminal"
$ python prefix_cache_sim.py
layout                                               prompt tok  cached    billed
bad: clock on top, context in system, tools drift     2,833,920    1.0%     3.51M
fix 1: deterministic tool JSON                        2,833,920   58.7%     1.63M
fix 2: + clock moved to the end                       2,858,400   82.7%     0.85M
good: + context appended, never rewritten             3,617,760   91.8%     0.70M
```

"Billed" está em equivalentes de token sem cache, usando os multiplicadores da Anthropic e tratando toda falha como escrita de cache, que é mais ou menos o que o cache automático faz. Leia as linhas como uma história.

O layout ruim coloca 1% em cache e fatura 3,51M equivalentes de token para 2,83M tokens de prompt. É pior do que não ter cache nenhum: com o cache desligado, essas requisições custariam 2,83M. Você paga o prêmio de escrita em todo token e quase não lê nada de volta. Essa é a fatura do parágrafo de abertura.

Só o JSON determinístico das tools já leva a 58,7%, porque o bloco de tools (uns 3.500 tokens aqui) agora é um prefixo estável compartilhado por todas as requisições de todas as sessões. O relógio no topo do system prompt continua quebrando tudo que vem atrás. Mover o relógio para o fim do turno do usuário deixa o system prompt entrar no prefixo compartilhado: 82,7%. O que sobra é o contexto recuperado logo depois do system prompt, trocado a cada turno, o que significa que o histórico da conversa atrás dele nunca é reaproveitado.

O layout bom mantém o contexto de cada turno naquele turno, para sempre. Ele envia mais tokens no total (3,62M, já que o contexto antigo fica no histórico em vez de ser trocado) e mesmo assim é de longe o mais barato: 91,8% em cache, 0,70M faturado, cinco vezes menos que o layout ruim, sem mudar o que o modelo vê em cada requisição, só onde cada coisa fica.

### Lendo os campos de cache nas respostas

A taxa de acerto tem que vir do provedor, porque só ele sabe o que tinha em cache. As duas APIs reportam de formas diferentes, e a diferença importa: o `input_tokens` da Anthropic exclui os tokens em cache, enquanto a contagem de tokens de prompt da OpenAI os inclui. Um normalizador pequeno evita errar isso nos dashboards.

```python title="cache_usage.py"
from dataclasses import dataclass


@dataclass(frozen=True)
class CacheUsage:
    uncached: int  # billed at the full input price
    written: int   # billed at the cache-write price (Anthropic only; 0 elsewhere)
    read: int      # billed at the cache-read price

    @property
    def prompt_tokens(self) -> int:
        return self.uncached + self.written + self.read

    @property
    def hit_rate(self) -> float:
        return self.read / self.prompt_tokens if self.prompt_tokens else 0.0


def from_anthropic(usage: dict) -> CacheUsage:
    # input_tokens is only what came after the last breakpoint, not the prompt size.
    return CacheUsage(
        uncached=usage["input_tokens"],
        written=usage.get("cache_creation_input_tokens") or 0,
        read=usage.get("cache_read_input_tokens") or 0,
    )


def from_openai_chat(usage: dict) -> CacheUsage:
    # prompt_tokens already includes the cached ones.
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)
    return CacheUsage(uncached=usage["prompt_tokens"] - cached, written=0, read=cached)


def from_openai_responses(usage: dict) -> CacheUsage:
    cached = (usage.get("input_tokens_details") or {}).get("cached_tokens", 0)
    return CacheUsage(uncached=usage["input_tokens"] - cached, written=0, read=cached)


def input_cost(u: CacheUsage, base_per_mtok: float, write_mult: float, read_mult: float) -> float:
    return (u.uncached + u.written * write_mult + u.read * read_mult) * base_per_mtok / 1e6


if __name__ == "__main__":
    # Hand-written payloads in the documented shapes, not captured from a live call.
    anthropic_turn = {"input_tokens": 212, "cache_creation_input_tokens": 1_480, "cache_read_input_tokens": 48_300,
                      "output_tokens": 390, "cache_creation": {"ephemeral_5m_input_tokens": 1_480,
                                                               "ephemeral_1h_input_tokens": 0}}
    openai_chat_turn = {"prompt_tokens": 50_120, "completion_tokens": 390,
                        "prompt_tokens_details": {"cached_tokens": 49_152}}

    a = from_anthropic(anthropic_turn)
    o = from_openai_chat(openai_chat_turn)
    print(f"anthropic: prompt={a.prompt_tokens:,} read={a.read:,} written={a.written:,} hit={a.hit_rate:.1%}")
    print(f"  cost at $3/MTok, 1.25x write, 0.1x read: ${input_cost(a, 3.0, 1.25, 0.10):.4f}"
          f"  (uncached: ${a.prompt_tokens * 3.0 / 1e6:.4f})")
    print(f"openai:    prompt={o.prompt_tokens:,} read={o.read:,} hit={o.hit_rate:.1%}")
    print(f"  cost at $1.25/MTok, 0.1x read:          ${input_cost(o, 1.25, 0.0, 0.10):.4f}"
          f"  (uncached: ${o.prompt_tokens * 1.25 / 1e6:.4f})")
```

```text title="terminal"
$ python cache_usage.py
anthropic: prompt=49,992 read=48,300 written=1,480 hit=96.6%
  cost at $3/MTok, 1.25x write, 0.1x read: $0.0207  (uncached: $0.1500)
openai:    prompt=50,120 read=49,152 hit=98.1%
  cost at $1.25/MTok, 0.1x read:          $0.0074  (uncached: $0.0626)
```

Os payloads no `__main__` foram escritos à mão seguindo os nomes de campo documentados, não capturados de chamadas reais, e os preços são parâmetros de exemplo, então coloque o preço atual do seu modelo. O formato que eles mostram é o de um turno saudável de agente: uma leitura grande (toda a conversa anterior), uma escrita pequena (a última resposta mais o turno novo) e uma cauda minúscula sem cache. Repare que a contagem em cache da OpenAI, 49.152, é múltipla de 128, como a documentação descreve.

### Colocando breakpoints na requisição

Não rodei os dois trechos a seguir: eles precisam de chaves de API e de uma conta paga, e não quis apresentar números que não medi. Eles seguem os formatos de requisição documentados e ligam o layout acima a chamadas reais. Na Anthropic, a combinação que uso em loops de agente é um breakpoint explícito no último bloco do system (a parte cara e compartilhada ganha um ponto de leitura garantido) mais o cache automático no nível da requisição para a conversa que cresce.

```python title="agent_turn_anthropic.py (ilustrativo)"
import json

import anthropic

from cache_usage import from_anthropic

client = anthropic.Anthropic()

TOOLS = sorted(json.load(open("tools.json")), key=lambda t: t["name"])  # static registry, fixed order
SYSTEM_PROMPT = open("system_prompt.md").read()                         # frozen: no clock, no user data


def agent_turn(history: list[dict], context: str, question: str, now: str):
    new_turn = {"role": "user", "content": f"Context:\n{context}\n\n{question}\n\n(current time: {now})"}
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        tools=TOOLS,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        cache_control={"type": "ephemeral"},  # automatic breakpoint that follows the history
        messages=[*history, new_turn],
    )
    usage = from_anthropic(response.usage.model_dump())
    history += [new_turn, {"role": "assistant", "content": response.content}]  # append-only
    return response, usage
```

Na OpenAI não há marcadores; as alavancas são a mesma ordenação e um `prompt_cache_key` que mantém o tráfego de um tenant ou de uma versão do agente nas máquinas que têm o prefixo dele.

```python title="agent_turn_openai.py (ilustrativo)"
from openai import OpenAI

from cache_usage import from_openai_chat

client = OpenAI()


def agent_turn(messages: list[dict], tools: list[dict], tenant: str):
    response = client.chat.completions.create(
        model="gpt-5",
        messages=messages,             # developer prompt first, history append-only, new turn last
        tools=tools,                   # same list, same order, every request
        prompt_cache_key=f"support-agent:v12:{tenant}",
    )
    return response, from_openai_chat(response.usage.model_dump())
```

## Checagem de realidade em produção

### Taxa de acerto é métrica, então crie alerta

A falha de cache mais cara é uma regressão, não uma primeira implementação ruim. Funciona quando alguém escreve, depois uma mudança na montagem do prompt (uma flag no system prompt, uma feature que apara o histórico, uma tool nova inserida em ordem alfabética no meio) derruba a taxa de acerto para zero, e as requisições continuam dando certo. Registre `uncached`, `written` e `read` por requisição, com a rota e a versão do prompt, faça um gráfico da proporção de leitura e alerte quando ela cair depois de um deploy. Também mantenho um teste de integração por agente que envia a mesma requisição duas vezes e verifica que a segunda reporta tokens em cache; custa centavos e pega a maioria das regressões antes de chegarem à fatura. Quando a proporção cair, faça o diff dos corpos renderizados de duas chamadas consecutivas: o primeiro byte diferente dentro da parte compartilhada é o seu invalidador.

### TTLs, formato do tráfego e concorrência

Um TTL de 5 minutos renovado a cada leitura significa que um agente movimentado mantém o prefixo quente indefinidamente, enquanto um tenant que manda uma requisição a cada dez minutos paga uma escrita fria toda vez. O TTL de 1 hora da Anthropic ajuda nesse intervalo, mas dobra o preço de escrita, então o ponto de equilíbrio muda: com o TTL de 5 minutos, duas requisições já ganham de não ter cache (1,25 + 0,1 = 1,35 contra 2,0); com o TTL de 1 hora você precisa de três (2,0 + 0,1 + 0,1 = 2,2 contra 3,0). Escolha por rota, com base no intervalo real entre requisições que compartilham um prefixo.

A concorrência tem sua própria armadilha: uma entrada só fica disponível para leitura quando a resposta que a escreve começa a ser transmitida, então um fan-out de 20 sub-agentes em paralelo sobre o mesmo contexto novo escreve 20 vezes e não lê nada. Mande uma requisição, espere o primeiro token transmitido e só então faça o fan-out. Na OpenAI, o equivalente é o limite de roteamento: prefixos muito quentes transbordam para além das máquinas que têm o cache, e um `prompt_cache_key` grosso demais (uma chave para todo o tráfego) concentra carga, enquanto um fino demais (uma chave por requisição) espalha tanto que nada é compartilhado.

### Limites invisíveis

Prompts abaixo do tamanho mínimo do modelo não entram em cache, em silêncio. Um prompt de 3.000 tokens entra em cache num modelo com mínimo de 1.024 tokens e não entra num com mínimo de 4.096, então uma migração de modelo pode mudar a sua taxa de acerto sem nenhuma mudança de código. Na Anthropic, cada breakpoint só olha 20 blocos para trás em busca de uma entrada anterior, então um único turno de agente que acrescenta uma sequência longa de blocos de texto e de tools pode deixar a entrada anterior fora de alcance; um breakpoint intermediário em turnos muito longos resolve. E trocar de modelo no meio da conversa, ou mudar a lista de tools, começa do zero: os caches são por modelo, e as definições das tools ficam bem na frente do prefixo.

### Isolamento é uma propriedade de segurança

Um cache compartilhado é um canal lateral de tempo: se um acerto é mensuravelmente mais rápido, uma requisição consegue descobrir se outra pessoa mandou o mesmo prefixo há pouco. [Gu et al.](https://arxiv.org/abs/2502.07776) auditaram APIs reais e encontraram compartilhamento global de cache entre usuários em sete provedores, incluindo a OpenAI, na época do estudo. A documentação atual dos provedores isola os caches por organização (e, na Anthropic, por workspace), mas se você roda o seu próprio engine, esse isolamento é trabalho seu: no vLLM, um `cache_salt` por tenant faz os hashes de bloco serem diferentes entre fronteiras de confiança. Não compartilhe prefixos em cache entre tenants cujos prompts tenham qualquer coisa confidencial, e lembre que o cache guarda o que quer que o prompt tinha.

### Self-hosted: roteamento e memória são a taxa de acerto

Na sua própria frota de vLLM ou SGLang, o cache mora na memória de GPU de cada réplica. Um load balancer round-robin espalha os turnos de uma conversa entre réplicas, e cada réplica paga um prefill frio. Roteie por sessão ou por um hash do prefixo para que a mesma conversa caia na mesma réplica, e acompanhe as métricas de acerto do cache de prefixo que cada engine exporta. A memória é a outra alavanca: cada GiB gasto com pesos ou com um batch maior é um GiB que não guarda prefixos, e sob pressão o LRU despeja justamente as conversas longas e ociosas que você esperava reaproveitar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Para economizar tokens vou tirar a mensagem mais antiga a cada turno. Uma janela deslizante mantém o prompt pequeno.</span>
    </div>
  </div>
</div>

Uma janela deslizante muda o começo da conversa a cada turno, que é a pior coisa que você pode fazer com um cache de prefixo. Tudo depois do system prompt falha em toda requisição e, com o prêmio de escrita, você acaba pagando mais que o preço cheio por um prompt menor. Deixe o histórico crescer enquanto ele está em cache a um décimo do preço e, quando ele realmente ficar longo demais, compacte raramente e em passos grandes (resuma a primeira metade uma vez, depois volte a acrescentar). Uma escrita fria a cada algumas dezenas de turnos é barata; uma a cada turno é o layout ruim da simulação com passos extras.

Prompt caching parece um recurso de faturamento, e na verdade é uma propriedade do seu código: o engine reaproveita keys e values de qualquer prefixo que já viu, o provedor vende esse reuso a um décimo do preço, e a montagem do seu prompt decide se existe um prefixo para reaproveitar. Coloque as tools e o system prompt primeiro e mantenha os dois congelados, trate o histórico como algo que só cresce, empurre tudo que é volátil para o fim e leia os campos de usage em toda resposta. Para o agente de atendimento da abertura, a correção são duas linhas movidas, um registro de tools ordenado e um teste, e a simulação acima mostra quanto isso vale.
