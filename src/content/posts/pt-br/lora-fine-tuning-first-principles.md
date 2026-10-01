---
title: "LoRA a partir dos primeiros princípios: quando o fine-tuning ganha de RAG e de prompt"
description: "Decida com evals quando o fine-tuning compensa, depois construa LoRA do zero em PyTorch e treine um modelo de 135M para fazer a triagem de tickets de suporte."
date: 2026-08-25
tags: [LLM, Fine-Tuning, PyTorch, Python]
tldr:
  - "Fine-tuning ensina comportamento (um formato, um estilo, uma política específica), não fatos novos: fatos vão para o contexto via RAG, e o prompt é a linha de base que todo fine-tune precisa superar numa eval separada."
  - "LoRA congela W e aprende uma atualização de rank baixo escalada por alpha / r, com B começando em zero para o treino partir exatamente do modelo base; aplique em todas as camadas lineares e o adapter continua com poucos MB."
  - "Num modelo de 135M, 4,9M de parâmetros treináveis levaram o exact match na eval separada de 6,5% (3-shot) para 88,0%; a mesma rodada também mostrou as falhas clássicas: eval vazada, template divergente e esquecimento."
---

Um time de produto quer a triagem automática dos tickets de suporte: uma categoria, uma prioridade e o id do pedido, em JSON que um serviço de roteamento consiga consumir. A primeira tentativa é um prompt num modelo grande hospedado, e funciona, a um custo por ticket que o financeiro percebe assim que o volume aparece. A segunda tentativa é um modelo pequeno que o time pode rodar por conta própria, com o mesmo prompt. Ele devolve texto corrido, depois JSON quebrado, depois JSON válido com a prioridade errada metade das vezes. Alguém diz "vamos fazer fine-tuning", outra pessoa diz "a gente devia usar RAG", e a reunião termina sem ninguém dizer o que cada uma dessas opções resolveria.

Este post trata de tomar essa decisão com evidência e, depois, da ferramenta que você provavelmente vai usar quando a resposta for "fine-tuning": LoRA. Vamos derivar a técnica, escrever a camada do zero em PyTorch com um teste unitário que prova a matemática do merge e treinar o SmolLM2-135M-Instruct exatamente nessa tarefa de triagem numa GPU de notebook, com números reais de antes e depois. O Júnior Inocente vem junto, como sempre.

## O problema e o contexto

Existem três alavancas para mudar o que um modelo faz, e elas resolvem problemas diferentes.

**Prompt** muda a entrada. Instruções, um schema, alguns exemplos. Não custa nada tentar, dá para desfazer em segundos e, com um modelo capaz, vai surpreendentemente longe. É a linha de base, e qualquer outra opção precisa superá-la no seu conjunto de eval para justificar a complexidade.

**Recuperação (RAG)** muda o contexto. Na hora da consulta você busca os documentos, preços, políticas ou tickets de que a resposta depende e os coloca na frente do modelo. É assim que um modelo "sabe" coisas com que não foi treinado, e coisas que mudaram ontem. As partes difíceis são a qualidade da recuperação e o chunking, que abordei em [avaliando a recuperação com um conjunto de teste real](/pt-br/blog/rag-evaluation-retrieval-test-set/) e [chunking de documentos corporativos](/pt-br/blog/chunking-enterprise-documents/).

**Fine-tuning** muda os pesos. Você mostra ao modelo muitos pares de entrada e saída e ajusta os parâmetros até ele produzir essas saídas. O que ele aprende bem é *comportamento*: um formato de saída, um tom, uma política de rotulagem, um padrão de chamada de ferramenta, uma tarefa específica feita do mesmo jeito toda vez. O que ele aprende mal são fatos novos.

Essa última frase não é questão de gosto. [Ovadia et al. (2023)](https://arxiv.org/abs/2312.05934) compararam a injeção de conhecimento por fine-tuning não supervisionado com RAG e viram que RAG venceu de forma consistente, tanto para conhecimento que o modelo tinha visto no pré-treino quanto para conhecimento totalmente novo. [Gekhman et al. (2024)](https://arxiv.org/abs/2405.05904) foram além: exemplos de fine-tuning que introduzem conhecimento novo são aprendidos bem mais devagar do que exemplos coerentes com o que o modelo já sabe, e, à medida que o modelo finalmente se ajusta a eles, a tendência a alucinar aumenta. O resumo deles é o que eu guardo na cabeça: os modelos adquirem conhecimento factual principalmente no pré-treino, e o fine-tuning ensina como usá-lo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Fácil: a gente faz fine-tuning do modelo com a documentação do produto e pronto, ele conhece o produto. Sem recuperação, sem banco vetorial.</span>
    </div>
  </div>
</div>

Ele vai aprender a *soar* como a sua documentação. Não vai lembrar com confiabilidade o prazo de reembolso do plano enterprise, não consegue dizer o que mudou no release da semana passada e não consegue citar de onde veio uma resposta. Quando a documentação muda, você treina de novo. Fatos ficam no contexto, onde podem ser atualizados, filtrados por permissão e citados. Se você também quer respostas no formato da casa, faça fine-tuning para o formato e continue recuperando os fatos: as duas coisas combinam bem.

Então a decisão é uma pergunta sobre o que está faltando, e o único jeito honesto de respondê-la é medir.

<div id="lora-decision-flow-slot"></div>

Na prática o fluxo é este. Monte o conjunto de eval primeiro: algumas centenas de entradas reais com as saídas certas, separadas de modo que nada nelas se pareça demais com os dados de treino (mais sobre isso abaixo, porque é onde a maioria dos resultados de fine-tuning mente sem fazer barulho). Rode a linha de base com prompt nele, incluindo few-shot. Se as falhas são "não sabia X", conserte a recuperação. Se as falhas são "sabia o bastante, mas não seguiu o formato ou a política", e mais trabalho no prompt parou de mexer no número, o fine-tuning entra na mesa. Ele também entra quando um modelo grande com um prompt longo já passa na eval e o objetivo é obter o mesmo comportamento de um modelo menor, mais barato e mais rápido que você pode rodar por conta própria. É exatamente a história da triagem lá de cima.

## Mergulho na arquitetura

### Por que o fine-tuning completo é caro

O fine-tuning completo atualiza todos os parâmetros. Com AdamW em precisão mista, uma conta comum dá uns 16 bytes por parâmetro antes das ativações: os pesos e gradientes em 16 bits, uma cópia mestre dos pesos em 32 bits e dois momentos do otimizador em 32 bits. Para um modelo de 7B, isso passa de 100 GB, e cada variante com fine-tuning é uma cópia completa do modelo em disco. Se você quer uma variante por cliente ou por tarefa, armazena e serve N modelos completos.

### A ideia do rank baixo

[Hu et al. (2021)](https://arxiv.org/abs/2106.09685) partiram de uma observação: a mudança que um fine-tune faz numa matriz de pesos pré-treinada tem "rank intrínseco" baixo. Você não precisa de uma matriz `d x k` inteira de parâmetros livres para expressá-la. Então o LoRA congela o peso pré-treinado `W` e aprende a atualização como o produto de duas matrizes finas:

- `A` com formato `r x k`, inicializada aleatoriamente.
- `B` com formato `d x r`, inicializada com zeros.
- `r` é o rank, bem menor que `d` e `k` (8, 16, 64).

O forward pass da camada vira `h = W x + (alpha / r) * B A x`. O caminho congelado faz o que sempre fez. O caminho treinável é um desvio por um gargalo de largura `r`, escalado por `alpha / r` e somado de volta.

<div id="lora-forward-pass-slot"></div>

A economia de parâmetros sai direto dos formatos. Uma atualização completa de uma matriz `d x k` tem `d * k` valores; a atualização LoRA tem `r * (d + k)`. Para o `q_proj` do modelo que vamos treinar (576 por 576), são 331.776 valores contra 18.432 com rank 16, cerca de 5,6%. Para uma projeção de 4096 por 4096 num modelo de 7B, são 16,8 milhões contra 131.072, menos de 1%. O resultado de destaque do artigo, no GPT-3 175B adaptando só as projeções de query e value com rank 4, foi uma redução de 10.000 vezes nos parâmetros treináveis, 3 vezes menos memória de GPU e checkpoints que encolheram de 350 GB para 35 MB.

A memória cai porque os pesos congelados não precisam de gradientes nem de estado do otimizador. Você ainda guarda os pesos base e as ativações, mas os momentos do Adam agora existem só para o adapter.

### Por que B começa em zero

No passo 0, `B A` é uma matriz de zeros, então o modelo encapsulado é *exatamente* o modelo pré-treinado. O treino parte do comportamento que você mediu na linha de base, e não de uma versão perturbada aleatoriamente dele. Também importa qual dos dois é zero. Se os dois fossem zero, os dois gradientes seriam zero e nada jamais treinaria: o gradiente de `A` é proporcional a `B`, e o gradiente de `B` é proporcional a `A x`. Com `A` aleatória e `B` zerada, o primeiro passo move `B`, e do segundo passo em diante os dois se movem. O teste unitário abaixo verifica exatamente isso.

O artigo inicializa `A` com uma gaussiana; a biblioteca PEFT do Hugging Face usa Kaiming-uniform para `A` e zeros para `B` por padrão. Qualquer um funciona; o zero em `B` é a parte que importa.

### Rank e alpha

O fator `alpha / r` existe para você não ter que reajustar a learning rate toda vez que muda `r`. O artigo define `alpha` como o primeiro `r` testado e deixa assim. A prática comum hoje é `alpha = 2r` (16 e 32 é a configuração que uso abaixo). Um refinamento que vale conhecer: o [rsLoRA (Kalajdzievski, 2023)](https://arxiv.org/abs/2312.03732) argumenta que `alpha / r` encolhe demais a atualização em ranks altos e propõe `alpha / sqrt(r)`, que mantém o aprendizado estável conforme o rank cresce. O PEFT expõe isso como `use_rslora=True`.

Sobre o rank em si, o artigo original viu que ranks muito baixos (até 1 ou 2 para as projeções de query e value do GPT-3) eram competitivos. Esse resultado era para adaptar só a atenção, em tarefas que pedem uma mudança pequena. Para um comportamento específico como o nosso formato de triagem, 8 a 16 é de sobra. Quando o alvo é amplo (um idioma novo, um domínio de código com muitos dados), o rank começa a pesar: [Biderman et al. (2024)](https://arxiv.org/abs/2405.09673) viram que o fine-tuning completo em código e matemática aprende perturbações com rank de 10 a 100 vezes o das configurações típicas de LoRA, e que ali o LoRA ficou abaixo do fine-tuning completo. O mesmo artigo achou o lado bom: o LoRA esquece menos do que o modelo base sabia fazer fora do domínio alvo.

### Quais módulos adaptar

O artigo original adaptou só `W_q` e `W_v` "por simplicidade", e muito tutorial ainda copia isso. Dois resultados posteriores dizem para adaptar todas as camadas lineares. O [artigo do QLoRA](https://arxiv.org/abs/2305.14314) viu que aplicar LoRA em todas as camadas lineares do bloco transformer era necessário para igualar o fine-tuning completo em 16 bits, e que o número de camadas adaptadas importava mais do que o rank. O [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/) (2025), da Thinking Machines, chegou à mesma conclusão especialmente para as camadas MLP, onde mora a maior parte dos parâmetros: LoRA só na atenção ficou para trás mesmo quando o rank foi aumentado para igualar a contagem de parâmetros. O mesmo texto viu que a melhor learning rate para LoRA ficava consistentemente em cerca de 10 vezes a do fine-tuning completo.

Num bloco no estilo Llama, isso significa sete alvos: `q_proj`, `k_proj`, `v_proj`, `o_proj` na atenção e `gate_proj`, `up_proj`, `down_proj` no MLP. O atalho do PEFT para isso é `target_modules="all-linear"`. Medi a diferença na nossa tarefa mais abaixo, e ela não foi sutil.

### QLoRA: quantize a parte congelada

Se os pesos base estão congelados, eles não precisam ser guardados em 16 bits. O QLoRA mantém o modelo base em **NF4** de 4 bits (NormalFloat, um tipo de dado pensado para pesos com distribuição normal), dequantiza cada bloco na hora para um tipo de cálculo de 16 bits na multiplicação de matrizes e faz o backpropagation através dele até adapters LoRA de 16 bits. Mais duas peças fazem tudo caber: **quantização dupla** (quantizar as próprias constantes de quantização de cada bloco) e **otimizadores paginados**, que usam memória unificada para empurrar o estado do otimizador para a RAM da CPU durante picos de memória em vez de quebrar com out-of-memory. O resultado de destaque foi o fine-tuning de um modelo de 65B numa única GPU de 48 GB, igualando o desempenho do fine-tuning em 16 bits nos benchmarks deles.

A lição prática: uma base de 7B em 4 bits ocupa uns 4 GB de pesos, e é isso que torna rotina o fine-tuning de modelos de 7B a 8B numa única GPU de consumo. O custo é um pouco de velocidade (dequantização em todo forward) e uma sutileza na hora do merge, tratada mais abaixo.

<div class="callout info" data-title="Info">
  <p>Este post não roda QLoRA: o modelo tem 135M de parâmetros, pequeno o bastante para ficar em 32 bits, e a máquina não tem o bitsandbytes instalado. Tudo sobre o LoRA em si se aplica diretamente, já que o QLoRA muda a forma como os pesos congelados são armazenados, e não o funcionamento do adapter.</p>
</div>

## Implementação na prática

O ambiente: SmolLM2-135M-Instruct (um modelo de arquitetura Llama com 30 camadas, hidden size 576 e 134,5M de parâmetros), PyTorch 2.11, Transformers 5.17 e uma RTX 5050 de notebook com 8 GB, compartilhada. Sem PEFT: escrevemos o adapter nós mesmos, o que é curto e deixa cada peça móvel visível.

### Uma camada LoRA do zero

```python title="lora-triage/lora.py"
import math

import torch
from torch import nn


class LoRALinear(nn.Module):
    """A frozen nn.Linear plus a trainable low-rank update: W x + (alpha / r) B A x."""

    def __init__(self, base: nn.Linear, r: int = 16, alpha: int = 32, dropout: float = 0.0):
        super().__init__()
        self.base = base
        for p in self.base.parameters():
            p.requires_grad_(False)
        self.r = r
        self.scale = alpha / r
        device = base.weight.device
        # A starts random and B starts at zero, so B @ A == 0 and the wrapped
        # model is exactly the base model at step 0.
        self.lora_A = nn.Parameter(torch.empty(r, base.in_features, device=device))
        self.lora_B = nn.Parameter(torch.zeros(base.out_features, r, device=device))
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def delta_weight(self) -> torch.Tensor:
        return (self.lora_B @ self.lora_A) * self.scale

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        update = self.dropout(x).to(self.lora_A.dtype) @ self.lora_A.T @ self.lora_B.T
        return self.base(x) + (update * self.scale).to(x.dtype)


def inject_lora(model: nn.Module, targets: set[str], r: int = 16, alpha: int = 32, dropout: float = 0.0) -> nn.Module:
    for p in model.parameters():
        p.requires_grad_(False)
    for parent in list(model.modules()):
        for name, child in list(parent.named_children()):
            if name in targets and isinstance(child, nn.Linear):
                setattr(parent, name, LoRALinear(child, r=r, alpha=alpha, dropout=dropout))
    return model


@torch.no_grad()
def merge_lora(model: nn.Module) -> nn.Module:
    """Fold every adapter into its base weight and put the plain nn.Linear back."""
    for parent in list(model.modules()):
        for name, child in list(parent.named_children()):
            if isinstance(child, LoRALinear):
                child.base.weight += child.delta_weight().to(child.base.weight.dtype)
                setattr(parent, name, child.base)
    return model


def lora_state_dict(model: nn.Module) -> dict[str, torch.Tensor]:
    return {k: v.detach().cpu() for k, v in model.state_dict().items() if "lora_" in k}


def count_parameters(model: nn.Module) -> tuple[int, int]:
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    return trainable, total
```

Dois detalhes merecem atenção. O forward pass calcula `x @ A.T @ B.T` em vez de montar `B @ A`: o caminho fino custa `r * (d + k)` multiplicações e somas por token em vez de `d * k`. E `merge_lora` é só a álgebra do forward pass aplicada uma vez: `W x + s * B A x = (W + s * B A) x`, então somar `s * B A` em `W` dá um `nn.Linear` comum que calcula a mesma coisa.

### Provando a matemática com testes

```python title="lora-triage/test_lora.py"
import torch
from torch import nn

from lora import LoRALinear, count_parameters, inject_lora, merge_lora


def make_layer(r: int = 4) -> LoRALinear:
    torch.manual_seed(0)
    return LoRALinear(nn.Linear(64, 32), r=r, alpha=2 * r)


def test_starts_as_the_base_layer():
    layer = make_layer()
    x = torch.randn(8, 64)
    assert torch.equal(layer(x), layer.base(x))


def test_merged_weight_matches_adapter_forward():
    layer = make_layer()
    nn.init.normal_(layer.lora_B, std=0.1)  # pretend we trained
    x = torch.randn(8, 64)
    with torch.no_grad():
        adapter_out = layer(x)
        merged = nn.Linear(64, 32)
        merged.load_state_dict(layer.base.state_dict())
        merged.weight += layer.delta_weight()
        merged_out = merged(x)
    assert (adapter_out - merged_out).abs().max() < 1e-5


def test_only_the_adapter_trains():
    layer = make_layer()
    layer(torch.randn(8, 64)).sum().backward()
    assert layer.base.weight.grad is None
    assert layer.lora_A.grad is not None and layer.lora_B.grad is not None
    # B is zero at step 0, so A's first gradient is zero too; B's is not.
    assert layer.lora_A.grad.abs().sum() == 0
    assert layer.lora_B.grad.abs().sum() > 0


def test_parameter_count_is_r_times_in_plus_out():
    model = inject_lora(nn.Sequential(nn.Linear(576, 1536), nn.ReLU(), nn.Linear(1536, 576)), targets={"0", "2"}, r=16)
    trainable, _ = count_parameters(model)
    assert trainable == 16 * (576 + 1536) * 2


def test_merge_lora_restores_plain_linears():
    torch.manual_seed(0)
    model = inject_lora(nn.Sequential(nn.Linear(16, 16), nn.Linear(16, 4)), targets={"0", "1"}, r=2)
    for m in model.modules():
        if isinstance(m, LoRALinear):
            nn.init.normal_(m.lora_B, std=0.1)
    x = torch.randn(3, 16)
    with torch.no_grad():
        before = model(x)
        merge_lora(model)
        after = model(x)
    assert all(type(m) is nn.Linear for m in model)
    assert (before - after).abs().max() < 1e-5
```

```bash title="terminal"
$ python -m pytest -q test_lora.py
.....                                                                    [100%]
5 passed in 1.57s
```

O terceiro teste é o argumento da inicialização com zero, lá de cima, na forma de uma asserção: depois de um backward pass, `B` tem gradiente e o gradiente de `A` é exatamente zero.

### A tarefa e os dados

A tarefa é a triagem da abertura: entra uma mensagem de suporte em texto livre, sai um objeto JSON com `category` (billing, bug, account, shipping ou feature_request), `priority` (high, normal ou low) e `order_id` (um id `ORD-#####` ou null). A prioridade segue uma política da casa: high quando o cliente diz que está bloqueado, perdendo dinheiro ou prestes a cancelar; low quando diz que não é urgente, ou para qualquer pedido de funcionalidade; normal nos outros casos. É um alvo típico de fine-tuning: uma tarefa específica, um formato fixo e uma política fácil de enunciar, mas que precisa ser aplicada do mesmo jeito toda vez.

Os dados são sintéticos, então todo rótulo é sabidamente correto. O gerador compõe cada mensagem a partir de uma saudação, um template da categoria, uma pista de prioridade e uma despedida. A decisão importante é a divisão: **os três últimos templates de cada categoria e as duas últimas pistas de cada nível de prioridade nunca aparecem no treino**. O conjunto de teste separado é montado só com eles, então mede se o modelo aprendeu a política ou decorou frases.

```python title="lora-triage/make_data.py (trecho)"
import json
import random

# Each category has templates; the last 3 of each list are held out, so the
# test set asks the model to generalize to phrasings it never saw.
TEMPLATES = {
    "billing": [
        "I was charged twice for {order}, can you refund one of them?",
        "My invoice for {order} shows the wrong amount.",
        # ... 10 templates per category, 5 categories
    ],
    # "bug", "account", "shipping", "feature_request"
}

# Priority comes from cues in the text, never from the category alone
# (except feature requests, which are always low).
CUES = {
    "high": [
        "This is blocking our whole team.",
        "We have a launch tomorrow and this is stopping us.",
        "Fix this today or we cancel.",
        "Nobody here can work until this is solved.",
        "Our customers are complaining right now.",
        "This is costing us money every hour.",
    ],
    # "normal" and "low": 6 cues each, the last 2 held out
}

SYSTEM = (
    "You triage customer support messages. Reply with JSON only, with exactly these keys: "
    '"category" (one of billing, bug, account, shipping, feature_request), '
    '"priority" (from the impact the customer states: high if they say they are blocked, losing money or about to cancel; '
    "low if they say it is not urgent or it is a feature request; normal otherwise), "
    '"order_id" (the ORD-##### id in the message, or null).'
)


def make_example(rng: random.Random, split: str) -> dict:
    category = rng.choice(list(TEMPLATES))
    pool = TEMPLATES[category]
    template = rng.choice(pool[:7] if split == "train" else pool[7:])
    if category == "feature_request":
        priority = "low"
    else:
        priority = rng.choice(["high", "normal", "low"])
    cues = CUES[priority]
    cue = rng.choice(cues[:4] if split == "train" else cues[4:])
    order_id = f"ORD-{rng.randint(10000, 99999)}"
    if "{order}" in template:
        text = template.format(order=rng.choice([order_id, f"order {order_id}", f"my order {order_id}"]))
    else:
        text, order_id = template, None
    parts = [rng.choice(GREETINGS), text, cue, rng.choice(SIGNOFFS)]
    message = " ".join(p for p in parts if p)
    if rng.random() < 0.2:
        message = message.lower()
    label = {"category": category, "priority": priority, "order_id": order_id}
    return {"message": message, "label": label, "answer": json.dumps(label)}


if __name__ == "__main__":
    splits = {
        "train": build(600, "train", seed=1),
        "test_seen": build(200, "train", seed=2),  # same templates as train: the leaky eval
        "test_heldout": build(200, "heldout", seed=3),  # templates and cues never trained on
    }
    # ... writes the three .jsonl files and counts exact duplicates
```

```bash title="terminal"
$ python make_data.py
test_seen: 200 rows, 3 identical to a training message
test_heldout: 200 rows, 0 identical to a training message
```

Uma linha do conjunto separado fica assim:

```json title="test_heldout.jsonl (uma linha)"
{"message": "Hi, I need my order ORD-62053 delivered to my office instead of my home. Nothing is broken, just asking. Thanks, Maria", "label": {"category": "shipping", "priority": "low", "order_id": "ORD-62053"}, "answer": "{\"category\": \"shipping\", \"priority\": \"low\", \"order_id\": \"ORD-62053\"}"}
```

`test_seen` está ali de propósito, como a eval em que você *não* deve confiar: combinações aleatórias novas dos templates de treino, três delas idênticas a uma linha de treino.

### Infraestrutura compartilhada e a linha de base com prompt

```python title="lora-triage/triage.py"
import json

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from make_data import SYSTEM

MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct"
KEYS = ("category", "priority", "order_id")


def load(device: str = "cuda"):
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).to(device)
    return tok, model


def read_jsonl(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def chat_prompt(tok, message: str, shots: list[dict] = ()) -> str:
    turns = [{"role": "system", "content": SYSTEM}]
    for shot in shots:
        turns += [{"role": "user", "content": shot["message"]}, {"role": "assistant", "content": shot["answer"]}]
    turns.append({"role": "user", "content": message})
    return tok.apply_chat_template(turns, tokenize=False, add_generation_prompt=True)


def raw_prompt(tok, message: str) -> str:
    return f"{SYSTEM}\n\nMessage: {message}\nJSON:"


@torch.no_grad()
def generate(tok, model, prompts: list[str], batch_size: int = 32, max_new_tokens: int = 40) -> list[str]:
    tok.padding_side = "left"
    outputs = []
    for i in range(0, len(prompts), batch_size):
        batch = tok(prompts[i : i + batch_size], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
        out = model.generate(**batch, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tok.pad_token_id)
        outputs += tok.batch_decode(out[:, batch["input_ids"].shape[1] :], skip_special_tokens=True)
    return outputs


def score(outputs: list[str], rows: list[dict]) -> dict[str, float]:
    totals = dict.fromkeys(("valid_json", *KEYS, "exact"), 0)
    for text, row in zip(outputs, rows):
        try:
            pred = json.loads(text.strip())
        except json.JSONDecodeError:
            continue
        if not isinstance(pred, dict) or set(pred) != set(KEYS):
            continue
        totals["valid_json"] += 1
        hits = [pred[k] == row["label"][k] for k in KEYS]
        for k, hit in zip(KEYS, hits):
            totals[k] += hit
        totals["exact"] += all(hits)
    return {k: v / len(rows) for k, v in totals.items()}
```

A pontuação é rígida de propósito: uma saída só conta se fizer parse, tiver exatamente as três chaves e cada campo bater exatamente. `exact` significa os três campos certos, que é o que o serviço de roteamento precisa. A decodificação gulosa deixa tudo determinístico.

```python title="lora-triage/baseline.py"
from triage import chat_prompt, generate, load, read_jsonl, score

tok, model = load()
model.eval()
train = read_jsonl("train.jsonl")
test = read_jsonl("test_heldout.jsonl")
shots = [next(r for r in train if r["label"]["category"] == c) for c in ("billing", "shipping", "feature_request")]

for name, prompts in {
    "zero-shot": [chat_prompt(tok, r["message"]) for r in test],
    "3-shot": [chat_prompt(tok, r["message"], shots) for r in test],
}.items():
    outputs = generate(tok, model, prompts)
    metrics = score(outputs, test)
    print(f"{name:10}", " ".join(f"{k}={v:.1%}" for k, v in metrics.items()))
    print("  sample:", repr(outputs[0][:120]))
```

```bash title="terminal"
$ python baseline.py
zero-shot  valid_json=0.0% category=0.0% priority=0.0% order_id=0.0% exact=0.0%
  sample: 'The PDF you generate has blank pages in the middle. Only when you get a chance.'
3-shot     valid_json=100.0% category=33.5% priority=47.0% order_id=35.5% exact=6.5%
  sample: '{"category": "shipping", "priority": "high", "order_id": "ORD-73944"}'
```

Este é o resultado mais instrutivo do post. Em zero-shot, o modelo de 135M ignora as instruções e repete a mensagem. Três exemplos resolvem o *formato* por completo: 100% de JSON válido. Eles não resolvem o *conteúdo*: 33,5% em categoria mal passa dos 20% de um chute entre cinco, e a saída de exemplo mostra o modelo inventando um id de pedido para uma mensagem que não tem nenhum. Um modelo pequeno consegue imitar a forma de uma resposta a partir de poucos exemplos, mas não consegue seguir uma política que lê num system prompt. É para essa lacuna que existe o fine-tuning.

Para ser justo com o prompt: um modelo de fronteira tiraria bem mais que 6,5% com este prompt. Não rodei um aqui, e num projeto real essa rodada é a régua. A comparação honesta é "modelo grande com prompt" contra "modelo pequeno ajustado" em acurácia, custo por chamada e latência.

### Treinando só os adapters

```python title="lora-triage/train.py"
import argparse
import random
import time

import torch

from lora import count_parameters, inject_lora, lora_state_dict
from triage import chat_prompt, load, read_jsonl

ALL_LINEAR = {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}

parser = argparse.ArgumentParser()
parser.add_argument("--r", type=int, default=16)
parser.add_argument("--alpha", type=int, default=32)
parser.add_argument("--targets", default="all")
parser.add_argument("--lr", type=float, default=1e-3)
parser.add_argument("--epochs", type=int, default=2)
parser.add_argument("--rows", type=int, default=600)
parser.add_argument("--out", default="adapter.pt")
args = parser.parse_args()

torch.manual_seed(0)
tok, model = load()
targets = ALL_LINEAR if args.targets == "all" else set(args.targets.split(","))
inject_lora(model, targets, r=args.r, alpha=args.alpha)
trainable, total = count_parameters(model)
print(f"trainable params: {trainable:,} of {total:,} ({trainable / total:.2%})")


def encode(row: dict) -> tuple[list[int], list[int]]:
    prompt = tok(chat_prompt(tok, row["message"]), add_special_tokens=False)["input_ids"]
    answer = tok(row["answer"] + "<|im_end|>", add_special_tokens=False)["input_ids"]
    # Loss only on the answer: the model should learn to write the JSON,
    # not to reproduce the system prompt it will always be given.
    return prompt + answer, [-100] * len(prompt) + answer


examples = [encode(r) for r in read_jsonl("train.jsonl")[: args.rows]]
batch_size, micro_batch = 16, 4
steps = args.epochs * ((len(examples) + batch_size - 1) // batch_size)
params = [p for p in model.parameters() if p.requires_grad]
optimizer = torch.optim.AdamW(params, lr=args.lr, weight_decay=0.0)
scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lambda s: min(1.0, (s + 1) / 10) * max(0.0, 1 - s / steps))

model.train()
torch.cuda.reset_peak_memory_stats()
start = time.perf_counter()
step = 0
for epoch in range(args.epochs):
    random.Random(epoch).shuffle(examples)
    epoch_loss = 0.0
    for i in range(0, len(examples), batch_size):
        batch = examples[i : i + batch_size]
        # Micro-batches of 4 with gradient accumulation keep activations (and
        # the 49k-wide logits) small enough for a shared 8 GB laptop GPU.
        for j in range(0, len(batch), micro_batch):
            micro = batch[j : j + micro_batch]
            width = max(len(ids) for ids, _ in micro)
            input_ids = torch.tensor([ids + [tok.pad_token_id] * (width - len(ids)) for ids, _ in micro], device="cuda")
            labels = torch.tensor([lab + [-100] * (width - len(lab)) for _, lab in micro], device="cuda")
            attention = torch.tensor([[1] * len(ids) + [0] * (width - len(ids)) for ids, _ in micro], device="cuda")
            with torch.autocast("cuda", dtype=torch.bfloat16):
                loss = model(input_ids=input_ids, attention_mask=attention, labels=labels).loss
            (loss * len(micro) / len(batch)).backward()
            epoch_loss += loss.item() * len(micro)
        torch.nn.utils.clip_grad_norm_(params, 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        step += 1
    print(f"epoch {epoch + 1}: loss {epoch_loss / len(examples):.4f}")

elapsed = time.perf_counter() - start
print(f"{step} steps in {elapsed:.1f}s, peak GPU memory {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB")
state = lora_state_dict(model)
torch.save({"r": args.r, "alpha": args.alpha, "targets": sorted(targets), "state": state}, args.out)
print(f"adapter: {sum(v.numel() for v in state.values()):,} values, {sum(v.numel() * v.element_size() for v in state.values()) / 2**20:.1f} MiB in fp32")
```

Três escolhas importam mais que o resto. O texto de treino passa pelo **mesmo chat template** que o modelo vai ver em produção (`chat_prompt`, a mesma função que a eval usa). A **loss é mascarada** para os tokens da resposta, então o gradiente vai para o JSON, e não para o system prompt. E a resposta termina com `<|im_end|>`, o token de fim de turno do template, para o modelo aprender a parar. A learning rate de 1e-3 é maior do que você usaria num fine-tuning completo, em linha com o resultado de "cerca de 10x" citado acima.

```bash title="terminal"
$ python train.py
trainable params: 4,884,480 of 139,399,488 (3.50%)
epoch 1: loss 0.1569
epoch 2: loss 0.0075
76 steps in 251.9s, peak GPU memory 2103 MiB
adapter: 4,884,480 values, 18.6 MiB in fp32
```

São 4,9M de parâmetros treináveis: 162.816 por camada nas sete projeções, vezes 30 camadas. O arquivo do adapter tem 18,6 MiB; o modelo base que ele modifica tem uns 270 MB em bf16. Os 252 segundos foram medidos com outro job usando a mesma GPU a 95% de utilização; uma rodada anterior da mesma configuração sem acumulação de gradiente levou 85 segundos, mas chegou a um pico de 5.655 MiB, e é por isso que o script publicado usa micro-batches.

### A eval, o merge e o que quebrou

```python title="lora-triage/evaluate.py"
import sys

import torch

from lora import inject_lora, merge_lora
from triage import chat_prompt, generate, load, raw_prompt, read_jsonl, score

checkpoint = torch.load(sys.argv[1] if len(sys.argv) > 1 else "adapter.pt")
tok, model = load()
inject_lora(model, set(checkpoint["targets"]), r=checkpoint["r"], alpha=checkpoint["alpha"])
missing = model.load_state_dict(checkpoint["state"], strict=False)
assert not missing.unexpected_keys
model.eval()

seen = read_jsonl("test_seen.jsonl")
heldout = read_jsonl("test_heldout.jsonl")


def report(name: str, outputs: list[str], rows: list[dict]) -> None:
    metrics = score(outputs, rows)
    print(f"{name:22}", " ".join(f"{k}={v:.1%}" for k, v in metrics.items()))


heldout_prompts = [chat_prompt(tok, r["message"]) for r in heldout]
adapter_outputs = generate(tok, model, heldout_prompts)
report("lora / seen templates", generate(tok, model, [chat_prompt(tok, r["message"]) for r in seen]), seen)
report("lora / held-out", adapter_outputs, heldout)
report("lora / raw prompt", generate(tok, model, [raw_prompt(tok, r["message"]) for r in heldout]), heldout)

probe = tok(heldout_prompts[:8], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
with torch.no_grad():
    before = model(**probe).logits
    merge_lora(model)
    after = model(**probe).logits
print(f"max |logit diff| after merge: {(before - after).abs().max().item():.2e}")
merged_outputs = generate(tok, model, heldout_prompts)
print(f"merged outputs identical to adapter outputs: {merged_outputs == adapter_outputs}")

for row, out in list(zip(heldout, adapter_outputs))[:200]:
    if out.strip() != row["answer"]:
        print("MISS", repr(row["message"]), "->", out.strip())
```

```bash title="terminal"
$ python evaluate.py
lora / seen templates  valid_json=100.0% category=100.0% priority=98.0% order_id=100.0% exact=98.0%
lora / held-out        valid_json=100.0% category=95.5% priority=91.5% order_id=100.0% exact=88.0%
lora / raw prompt      valid_json=100.0% category=81.0% priority=86.0% order_id=100.0% exact=70.0%
max |logit diff| after merge: 1.29e-03
merged outputs identical to adapter outputs: True
MISS 'the invite link for my teammate says it expired. our customers are complaining right now.' -> {"category": "bug", "priority": "normal", "order_id": null}
MISS 'Hello team, Saving a draft wipes the text I typed. Only when you get a chance. Thanks, Maria' -> {"category": "feature_request", "priority": "low", "order_id": null}
MISS 'Hello team, The discount code was not applied to ORD-48242. This is costing us money every hour. - Priya' -> {"category": "shipping", "priority": "high", "order_id": "ORD-48242"}
MISS 'hey My payment failed but the money left my account anyway. Our customers are complaining right now. Thanks, Maria' -> {"category": "account", "priority": "normal", "order_id": null}
```

(O script imprime os 24 erros; quatro aparecem aqui.) Linha por linha:

**O exact match na eval separada foi de 6,5% (3-shot) para 88,0%**, com 100% de JSON válido e 100% nos ids de pedido. Para um modelo de 135M, 600 linhas sintéticas e alguns minutos de treino, esse é o argumento inteiro a favor do fine-tuning de um comportamento específico.

**A eval com templates vistos diz 98,0%.** Mesmo modelo, mesma rodada, dez pontos a mais, porque essas linhas reaproveitam frases com que o modelo treinou. Se o único conjunto de teste fosse 20% aleatórios das linhas geradas, o relatório teria dito 98%.

**O merge é exato até o arredondamento de ponto flutuante.** Incorporar cada adapter em `W` mudou os logits em no máximo 0,0013 (ordem de acumulação em fp32 ao longo de 30 camadas), e as 200 saídas gulosas foram idênticas antes e depois.

**Os erros seguem um padrão.** 10 dos 24 contêm "Our customers are complaining right now", uma pista de prioridade alta do conjunto separado que o modelo nunca viu; ele aprendeu as quatro pistas de treino melhor do que o conceito por trás delas. Vários erros de categoria mostram um atalho: todo template de shipping contém um id de pedido, então um id de pedido numa mensagem de billing inédita ("The discount code was not applied to ORD-48242") puxa a previsão para shipping. Os dois se resolvem com dados, e não com hiperparâmetros: pistas mais variadas e exemplos de billing com ids de pedido.

A linha do prompt cru é um modo de falha à parte, tratado na próxima seção.

### Duas ablações: menos módulos, menos linhas

```bash title="terminal"
$ python train.py --r 8 --alpha 16 --targets q_proj,v_proj --out adapter_qv.pt
trainable params: 460,800 of 134,975,808 (0.34%)
epoch 1: loss 0.2928
epoch 2: loss 0.0662
76 steps in 140.4s, peak GPU memory 1665 MiB
adapter: 460,800 values, 1.8 MiB in fp32
$ python evaluate.py adapter_qv.pt
lora / seen templates  valid_json=100.0% category=77.0% priority=73.0% order_id=100.0% exact=56.5%
lora / held-out        valid_json=100.0% category=66.0% priority=72.0% order_id=100.0% exact=51.0%
lora / raw prompt      valid_json=23.0% category=9.5% priority=14.5% order_id=21.0% exact=6.0%
```

A configuração clássica do artigo original (rank 8 só nas projeções de query e value) chegou a 51,0% de exact match na eval separada, contra 88,0% com as sete projeções, com os mesmos dados, a mesma learning rate e o mesmo número de passos. Uma disputa mais justa ajustaria learning rate e passos para cada configuração, o que eu não fiz; isso poderia fechar parte da diferença. Mas bate com o que os resultados do QLoRA e da Thinking Machines preveem, e o adapter tinha 1,8 MiB contra 18,6. O tamanho do arquivo não é onde você quer economizar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Quarenta exemplos sobram pra uma coisa simples assim. Olha, a loss de treino foi pra 0,02, está praticamente perfeito.</span>
    </div>
  </div>
</div>

```bash title="terminal"
$ python train.py --rows 40 --epochs 15 --out adapter_tiny.pt
epoch 14: loss 0.0222
epoch 15: loss 0.0209
45 steps in 92.8s, peak GPU memory 2076 MiB
adapter: 4,884,480 values, 18.6 MiB in fp32
$ python evaluate.py adapter_tiny.pt
lora / seen templates  valid_json=100.0% category=82.5% priority=64.5% order_id=100.0% exact=58.0%
lora / held-out        valid_json=100.0% category=77.5% priority=69.0% order_id=100.0% exact=57.5%
```

Loss de treino 0,02, exact match na eval separada 57,5%. Com 40 linhas e 15 épocas, o modelo decorou essas 40 respostas; a loss de treino mede o quanto ele reproduz o próprio conjunto de treino, que é justamente aquilo em que você nunca vai colocá-lo para rodar. Quarenta linhas não cobrem nem as combinações de cinco categorias, três prioridades e os casos de id de pedido com variedade suficiente para separar a política da frase. O único número que diz se ele aprendeu a tarefa é o medido em dados que ele não viu.

## Checagem de realidade em produção

### Vazamento de dados faz todo fine-tune parecer ótimo

A diferença de dez pontos entre `test_seen` e `test_heldout` veio de um brinquedo controlado. Em projetos reais o vazamento é mais traiçoeiro: tickets quase duplicados do mesmo cliente dos dois lados da divisão, a mesma thread de email dividida entre treino e teste, mensagens de sistema geradas por template, ou um conjunto de teste tirado da mesma semana dos dados de treino quando o tráfego de produção vem do mês seguinte. Divida pela unidade que generaliza (cliente, thread, documento, janela de tempo), deduplique com correspondência aproximada e mantenha desde o primeiro dia um pequeno conjunto de teste congelado contra o qual ninguém ajusta nada. A disciplina é a mesma de [montar um conjunto de teste de recuperação](/pt-br/blog/rag-evaluation-retrieval-test-set/): uma eval vale o que vale a sua divisão.

### Chat template divergente

As linhas de `raw prompt` rodaram o modelo ajustado nas mesmas mensagens, formatadas sem o chat template: mesmo texto de sistema, mesma mensagem, só sem os marcadores de papel `<|im_start|>`. O exact match na eval separada caiu de 88,0% para 70,0%, e no adapter de rank 8 em q,v o JSON válido caiu de 100% para 23%. O adapter aprendeu um comportamento *condicionado à sequência exata de tokens com que foi treinado*.

Isso morde em produção de formas silenciosas. A stack de serving aplica um template diferente do script de treino, uma versão mais nova do tokenizer muda o template, uma string de prompt montada à mão pula o turno de sistema e o template insere o system prompt padrão (o do SmolLM2 é "You are a helpful AI assistant named SmolLM, trained by Hugging Face"), ou falta o generation prompt e o modelo continua o turno do usuário. Use `apply_chat_template` no treino e no serving, fixe a versão do tokenizer junto com o adapter e rode a eval pelo caminho de serving, e não só pelo código de treino.

### Esquecimento catastrófico, ou comportamento que vaza

Fiz três perguntas sem relação com a tarefa ao modelo base e ao ajustado, sem o system prompt da triagem:

```python title="lora-triage/forgetting.py"
import torch

from lora import inject_lora
from triage import generate, load

QUESTIONS = ["What is the capital of France?", "Write a haiku about the sea.", "Give me one tip for writing clean Python."]

tok, model = load()
prompts = [tok.apply_chat_template([{"role": "user", "content": q}], tokenize=False, add_generation_prompt=True) for q in QUESTIONS]
base = generate(tok, model, prompts, max_new_tokens=30)
checkpoint = torch.load("adapter.pt")
inject_lora(model, set(checkpoint["targets"]), r=checkpoint["r"], alpha=checkpoint["alpha"])
model.load_state_dict(checkpoint["state"], strict=False)
tuned = generate(tok, model, prompts, max_new_tokens=30)
for q, b, t in zip(QUESTIONS, base, tuned):
    print(f"Q: {q}\n  base:  {b.strip()!r}\n  tuned: {t.strip()!r}")
```

```bash title="terminal"
$ python forgetting.py
Q: What is the capital of France?
  base:  'The capital of France is Paris.'
  tuned: '{"capital": "france"}'
Q: Write a haiku about the sea.
  base:  'The waves crash against the shore,\nA symphony of sound, a symphony of life.\nThe salty scent of the sea, a welcome sight,'
  tuned: '{"sea" "waves" "laugh" "laugh" "laugh" "laugh" "laugh" "laugh"'
Q: Give me one tip for writing clean Python.
  base:  "One tip for writing clean Python is to use the `re` module for regular expressions. Here's a simple example:\n\n```python\nimport"
  tuned: '{"tip": "use a clean version of your code"}'
```

Depois de 600 exemplos de uma única tarefa, o modelo ajustado responde *tudo* em JSON. Para um endpoint dedicado de triagem, tudo bem, dá até para chamar de funcionalidade. Para um modelo que também precisa conversar, é uma regressão que a sua eval de triagem nunca vai ver, porque ela só testa triagem. Três mitigações, na ordem em que recorro a elas: manter o adapter separado e ativá-lo só para a tarefa (próxima seção); misturar alguns dados de instrução gerais no treino para o modelo manter os outros comportamentos; e acrescentar à eval uma pequena suíte de "capacidade geral", para o esquecimento aparecer como número. Biderman et al. viram que o LoRA esquece menos que o fine-tuning completo, e "menos" ainda não é zero, como um modelo de 135M com 3,5% dos parâmetros retreinados deixa bem claro.

### Fazer o merge ou manter os adapters separados

<div id="lora-serving-slot"></div>

**Fazer o merge** incorpora `(alpha / r) * B A` em `W` e entrega um checkpoint comum com a arquitetura original. Ele roda em qualquer stack de inferência, sem latência extra, que é exatamente a propriedade que o artigo enfatiza. O preço é uma cópia completa do modelo por tarefa, e o adapter não pode mais ser desligado.

**Manter os adapters separados** significa um modelo base na memória da GPU e muitos adapters pequenos ao lado. O vLLM suporta isso diretamente: suba o servidor com `--enable-lora` e `--lora-modules triage=/path/to/adapter`, ajuste `max_loras` e `max_lora_rank` e escolha o adapter por requisição pelo campo `model`, como descrito na [documentação de LoRA](https://docs.vllm.ai/en/latest/features/lora.html) dele. Sistemas como o [S-LoRA](https://arxiv.org/abs/2311.03285) levam isso a milhares de adapters simultâneos numa GPU, com um pool de memória unificado para os pesos dos adapters e o KV cache. O próprio artigo do LoRA aponta o trade-off: depois que você incorpora `A` e `B` em `W`, agrupar requisições de tarefas diferentes num mesmo forward pass deixa de ser simples. O caminho sem merge custa duas matmuls finas a mais por camada adaptada, o que um kernel em batch esconde quase todo.

Minha regra: uma tarefa, volume alto, adapter estável, então merge. Variantes por tenant, retreino frequente ou testes A/B entre adapters, então mantenha separados. Em qualquer caso, avalie o artefato que você realmente serve. O merge acima foi exato em fp32; fazer o merge em pesos bf16 acrescenta arredondamento, e com um adapter QLoRA o adapter foi treinado contra pesos *NF4 dequantizados*, então fazer o merge nos pesos originais de 16 bits (ou requantizar o resultado) produz um modelo um pouco diferente do que você treinou. Normalmente não tem problema. O "normalmente" é o que a eval serve para checar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se rank 16 é bom, rank 256 deve ser melhor. Vamos colocar no máximo pra garantir.</span>
    </div>
  </div>
</div>

Rank compra capacidade, e para um comportamento específico a capacidade não é o gargalo: os erros de triagem acima vêm de lacunas nos dados, e um adapter maior decoraria as pistas de treino com ainda mais afinco. Rank mais alto significa mais memória, um arquivo maior e mais espaço para overfitting num dataset pequeno e, com a escala simples `alpha / r`, também muda o tamanho efetivo do passo, então a learning rate que você ajustou deixa de significar a mesma coisa. Comece com 8 ou 16 em todas as camadas lineares e só aumente o rank quando a eval separada (e não a loss de treino) mostrar que o modelo está com underfitting num dataset grande e variado. Se for subir muito, olhe a escala do rsLoRA.

### Coisas menores que mordem

- **Tokens de pad e EOS.** O SmolLM2 usa `<|im_end|>` para os dois. Se você mascarar o padding pelo id do EOS nos labels, o modelo nunca aprende a parar. Mascare pela attention mask (como o script faz) e mantenha o token real de fim de turno nos labels.
- **Padding à esquerda na geração.** A decodificação em batch com padding à direita coloca tokens de pad entre o prompt e a resposta. O treino pode fazer padding à direita; a geração faz à esquerda.
- **Versione o adapter junto com a base.** Um adapter é um diff contra um checkpoint exato. Guarde a revisão do modelo base, a revisão do tokenizer, os módulos alvo, o rank e o alpha ao lado dos pesos, como o `train.py` guarda `r`, `alpha` e `targets`.
- **Dados sintéticos ensinam padrões sintéticos.** O atalho do id de pedido acima veio da forma como escrevi os templates. Tickets reais vão revelar outros atalhos; coloque amostras do tráfego real na eval assim que tiver.

O fine-tuning se justifica quando o problema é comportamento e a linha de base com prompt estacionou numa eval em que você confia. O LoRA deixa isso barato: congele o modelo, aprenda `B A` com `B` começando em zero, adapte todas as camadas lineares e você ganha um adapter medido em megabytes, que pode passar por merge para uma única tarefa ou ser trocado a quente entre vários. Num modelo de 135M, isso levou uma tarefa de triagem de 6,5% para 88,0% de exact match em poucos minutos num notebook, e a mesma tarde mostrou uma eval vazada, um template divergente e um modelo que responde "What is the capital of France?" em JSON. A matemática cabe em dez linhas. A eval é a parte que decide se essas dez linhas valeram a pena.
