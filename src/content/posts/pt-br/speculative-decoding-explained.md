---
title: "Decodificação especulativa explicada: rascunhe barato, verifique numa passada"
description: "Como um rascunho barato e uma única passada do modelo alvo aceleram a decodificação de LLMs mantendo exatamente a distribuição de saída do alvo, com código executável e medições reais."
date: 2026-07-24
tags: [LLM, Inference, Performance, Python]
tldr:
  - "Decodificar um token por vez é limitado pela leitura dos pesos da memória, então avaliar k+1 posições numa passada do alvo custa quase o mesmo que avaliar uma."
  - "Um rascunho barato propõe k tokens, o alvo confere todos numa passada, e a regra min(1, p/q) com reamostragem do resíduo mantém a distribuição de saída exatamente igual à do alvo."
  - "O ganho depende da taxa de aceitação, do custo do rascunho e do tamanho do batch: compensa para saída previsível e limitada por latência, e pode perder em servidores cheios, amostragem criativa ou modelos minúsculos."
---

Um time com quem trabalhei tinha um modelo de 70B atrás de um assistente interno, gerando uns 30 tokens por segundo por usuário num único nó. O dashboard da GPU mostrava a banda de memória no talo e os tensor cores quase parados. Alguém leu que decodificação especulativa dá "geração 2x a 3x mais rápida com saídas idênticas", ligou a opção no motor de serving com um modelo de rascunho pequeno, e o gráfico de latência dos horários tranquilos melhorou mesmo. Aí chegou o tráfego de segunda de manhã, o batch encheu, e o throughput por GPU caiu.

Os dois resultados são o mesmo mecanismo funcionando como foi projetado. A decodificação especulativa gasta computação ociosa para comprar latência, e quando a computação deixa de estar ociosa a troca se inverte. Este post explica por que o decode é limitado por memória, como funciona o ciclo de rascunho e verificação, a regra de amostragem por rejeição que torna a distribuição de saída comprovadamente idêntica à do alvo, a matemática do speedup e a família de variantes (modelos de rascunho, prompt lookup, Medusa, EAGLE, lookahead). Depois implemento o algoritmo em numpy e provo empiricamente a afirmação sobre a distribuição, imprimo a tabela de speedup e cronometro assisted generation de verdade com dois modelos pequenos no meu notebook, incluindo as execuções em que ficou mais lento. O Júnior Inocente também está aqui.

## O problema e o contexto

Um modelo autorregressivo produz um token por passada (forward pass), e cada token depende do anterior. Não dá para calcular o token 51 antes de saber o token 50. Essa dependência sequencial é o problema inteiro.

O que encarece não é a aritmética. Durante o decode, uma única sequência passa um token novo pela rede, e cada camada precisa ler suas matrizes de pesos inteiras da memória da GPU para multiplicá-las por esse único vetor. Para um modelo de 7B em 16 bits, são uns 14 GB de pesos por token. Uma H100 SXM move cerca de 3,35 TB/s da HBM, então só transmitir os pesos leva uns 4 ms, um teto de mais ou menos 240 tokens por segundo antes mesmo de contar o KV cache. A conta desse token é de cerca de 2 FLOPs por parâmetro, 14 GFLOP, que os cerca de 990 TFLOPS densos em BF16 da mesma GPU terminariam em uns 14 microssegundos. Os tensor cores passam quase o passo inteiro esperando a memória. O prefill (processar o prompt) é o oposto: milhares de tokens dividem cada leitura dos pesos, então ele é limitado por computação.

Essa diferença é a brecha. Se você já tem vários tokens candidatos, pode passar todos pelo modelo alvo numa única passada. Os pesos são lidos uma vez, as posições extras vão de carona numa computação que estaria ociosa de qualquer jeito, e a passada leva mais ou menos o mesmo tempo que uma passada de um token só. Você ganha a distribuição de próximo token do modelo alvo em cada uma dessas posições. O truque está em de onde vêm os candidatos e em como decidir quais manter sem mudar o que o modelo teria dito.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se a GPU fica ociosa no decode, é só juntar mais usuários no batch. Isso usa a computação e a gente não precisa de nada disso.</span>
    </div>
  </div>
</div>

Batching é a ferramenta certa para throughput, e é o que servidores com continuous batching fazem. Só que não ajuda o usuário que está olhando o texto aparecer: a sequência dele continua precisando de uma passada completa por token, e um batch maior normalmente deixa cada passada um pouco mais lenta, não mais rápida. A decodificação especulativa ataca a latência por sequência: deixa uma sequência avançar vários tokens por passada do alvo. Guarde isto: as duas técnicas se alimentam da mesma computação ociosa. É por isso que brigam em produção, e é por isso que a história da segunda de manhã aconteceu.

## Mergulho na arquitetura

### O ciclo de rascunho e verificação

A ideia foi publicada de forma independente por dois grupos: Leviathan, Kalman e Matias em [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) (ICML 2023, 2x a 3x no T5-XXL), e Chen et al., na DeepMind, em [Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) (2x a 2,5x no Chinchilla 70B num ambiente distribuído). O ciclo é o mesmo nos dois.

<div id="specdec-loop-slot"></div>

Um **rascunho** barato propõe k tokens de forma autorregressiva e, para cada um, registra a própria distribuição de probabilidade q. O **alvo**, caro, então roda uma passada sobre o prefixo mais esses k tokens. Como um transformer causal produz uma distribuição de próximo token em cada posição, essa única passada gera k+1 distribuições: p1 para julgar o primeiro token do rascunho, p2 para o segundo, e assim por diante, mais uma distribuição extra para a posição depois do último token rascunhado.

A verificação anda da esquerda para a direita. Cada token do rascunho é aceito ou rejeitado por uma regra probabilística (próxima seção). Na primeira rejeição a rodada termina, e a distribuição do alvo naquela posição fornece um token corrigido. Se os k sobreviverem, a distribuição extra fornece um token bônus de graça. De qualquer forma, uma passada do alvo produz entre 1 e k+1 tokens, nunca menos que a decodificação normal.

Dois detalhes de contabilidade importam nos motores reais. O alvo acrescentou entradas no KV cache para as k posições rascunhadas, então as entradas depois da primeira rejeição precisam ser descartadas (truncando o cache ou voltando um ponteiro). O rascunho tem o próprio KV cache e precisa ser revertido do mesmo jeito. Nenhum dos dois é difícil, mas é onde as implementações escondem bugs.

### A regra de amostragem por rejeição

Para um token x do rascunho numa posição, o rascunho atribuiu probabilidade q(x) e o alvo atribui p(x). A regra:

1. Aceite x com probabilidade `min(1, p(x) / q(x))`. Se o alvo gosta de x pelo menos tanto quanto o rascunho, x é sempre aceito. Se o rascunho estava confiante demais, x sobrevive só parte das vezes.
2. Se x for rejeitado, amostre um substituto da distribuição residual `max(0, p - q)`, normalizada, e encerre a rodada.
3. Se os k tokens forem aceitos, amostre um token bônus da última distribuição do alvo.

<div id="specdec-accept-rule-slot"></div>

Eis por que isso é exato, e não uma aproximação. A probabilidade de a rodada produzir o token x nessa posição é a chance de o rascunho ter proposto x e ele ter sido aceito, mais a chance de uma rejeição qualquer seguida do resíduo escolhendo x:

- Proposto e aceito: `q(x) * min(1, p(x)/q(x)) = min(p(x), q(x))`.
- A probabilidade total de aceitação é `alpha = soma sobre x de min(p(x), q(x))`, então uma rejeição acontece com probabilidade `1 - alpha`.
- O resíduo dá a x a probabilidade `max(0, p(x) - q(x)) / (1 - alpha)`, porque a massa do resíduo também soma `1 - alpha`.
- Rejeitado e reamostrado para x: `(1 - alpha) * max(0, p(x) - q(x)) / (1 - alpha) = max(0, p(x) - q(x))`.

Some as duas: `min(p, q) + max(0, p - q) = p(x)`. Cada token sai distribuído exatamente como o alvo o teria amostrado, condicionado ao mesmo prefixo, e por indução a sequência inteira também. Nada no argumento depende de o rascunho ser bom. Um rascunho péssimo só reduz alpha, que é a taxa de aceitação por token e vale `1 - TV(p, q)`, um menos a distância de variação total entre as duas distribuições.

A decodificação greedy é o caso degenerado: p põe toda a massa no argmax do alvo, então um token do rascunho é aceito exatamente quando é igual a esse argmax, e o "resíduo" é o próprio argmax. É por isso que assisted generation greedy reproduz a saída greedy normal token por token (a menos de ponto flutuante, assunto ao qual eu volto).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Para que esse resíduo estranho? Quando um token do rascunho for rejeitado, é só amostrar um token novo de p. É a distribuição do próprio alvo, então tem que estar certo.</span>
    </div>
  </div>
</div>

Parece seguro e tem viés. Os tokens em que p é maior que q já estão sub-representados entre os tokens aceitos do rascunho, e os tokens em que q é maior que p já receberam toda a sua parte de p pela aceitação. Amostrar de p puro depois de uma rejeição dá aos tokens superpropostos uma segunda chance que eles não merecem, então eles saem vezes demais. O resíduo `max(0, p - q)` é exatamente a massa de probabilidade que a etapa de aceitação deixou de entregar, nada mais. A seção prática mede isso: com p puro como fallback, a distância de variação total até a distribuição verdadeira fica travada em torno de 0,107, não importa quantas amostras você tire.

Existe também um esquema exato mais simples que alguns motores usam para amostragem: sortear um token do alvo em cada posição e manter o token do rascunho só enquanto os dois coincidirem. Também é sem perdas, já que todo token emitido foi amostrado de p, mas a taxa de aceitação é `soma de p(x) * q(x)`, menor que `soma de min(p(x), q(x))`. No meu modelo de brinquedo abaixo, isso dá de 0,39 a 0,55 por contexto em vez de 0,67 a 0,86. A regra de rejeição é a que extrai o máximo de aceitação de um dado rascunho.

### Quanto mais rápido: a matemática

Se cada token do rascunho é aceito de forma independente com probabilidade alpha, o número de tokens que uma rodada produz é a sequência aceita mais o token corrigido ou bônus. Leviathan et al. dão o valor esperado:

`E[tokens por passada do alvo] = (1 - alpha^(k+1)) / (1 - alpha)`

Cresce com k, mas satura em `1 / (1 - alpha)`: com alpha = 0,8, você nunca passa de 5 tokens por passada em média, por mais longo que seja o rascunho. E rascunhar não é de graça. Chame de c o custo de um passo do rascunho relativo a um passo do alvo. Uma rodada custa `k * c + 1` unidades de passo do alvo, então o speedup esperado é:

`speedup = (1 - alpha^(k+1)) / ((1 - alpha) * (k * c + 1))`

Essa fórmula já conta a maior parte da história de produção. Um alpha maior vale mais que qualquer outra coisa. Um k maior só ajuda enquanto o próximo token rascunhado tem boa chance de sobreviver, e a partir daí você paga c por tokens que vão para o lixo. E c não é a razão entre os parâmetros: um rascunho 10x menor costuma ser muito mais que 10x mais barato em FLOPs, mas não em tempo de relógio, porque com batch 1 o rascunho também é limitado por memória, tem seu próprio overhead de lançamento de kernels e roda k vezes em sequência. A seção prática imprime a tabela.

### A família de rascunhos

Tudo depois de "o alvo verifica os palpites numa passada" é compartilhado. A pesquisa desde 2023 é basicamente sobre palpites melhores e palpites mais baratos.

<div id="specdec-drafters-slot"></div>

**Um modelo de rascunho separado.** A receita original: um modelo pequeno da mesma família e com o mesmo tokenizer, como um 1B rascunhando para um 70B. Fácil de adotar e não exige treino, mas agora você hospeda dois modelos, e a qualidade do rascunho no seu tráfego decide tudo.

**Prompt lookup e rascunho por n-gramas.** Nenhum modelo: procure os últimos tokens gerados em algum ponto anterior do contexto e proponha o que veio depois deles lá. Apresentado no repositório [prompt-lookup-decoding](https://github.com/apoorvumang/prompt-lookup-decoding), que relata cerca de 2,4x em média para sumarização e perguntas sobre contexto, e hoje disponível no Hugging Face transformers como `prompt_lookup_num_tokens` e no vLLM como o método n-gram. Brilha quando a saída copia a entrada: edição de código, extração, respostas de RAG que citam as fontes; e não faz nada por texto livre.

**Medusa.** O [Medusa](https://arxiv.org/abs/2401.10774) (Cai et al., 2024) adiciona cabeças de decodificação extras sobre o último estado oculto do alvo, cada uma prevendo um token mais à frente, e verifica várias continuações candidatas de uma vez com tree attention. O artigo relata mais de 2,2x com o backbone congelado (Medusa-1) e de 2,3x a 3,6x quando o backbone é ajustado junto (Medusa-2). Ele também propõe um esquema de "typical acceptance" que aceita mais tokens abrindo mão da garantia de distribuição exata, então confira qual regra de aceitação você está usando.

**EAGLE.** O [EAGLE](https://arxiv.org/abs/2401.15077) (Li et al., 2024) rascunha no nível das features: uma cabeça pequena faz autorregressão sobre as features da penúltima camada do alvo, alimentada com a sequência de tokens adiantada em um passo, o que remove boa parte da incerteza do rascunho. Relata speedup de latência de 2,7x a 3,5x no LLaMA2-Chat 70B preservando a distribuição de saída. O [EAGLE-2](https://arxiv.org/abs/2406.16858) torna a árvore de rascunho dinâmica com base na confiança do rascunho, e o [EAGLE-3](https://arxiv.org/abs/2503.01840) volta a prever tokens diretamente, funde features de várias camadas e relata até 6,5x de speedup, além de 1,38x de throughput com batch 64 no SGLang.

**Lookahead decoding.** O [Lookahead](https://arxiv.org/abs/2402.02057) (Fu et al., 2024) não precisa de modelo de rascunho nem de base de dados. Ele roda iteração de Jacobi dentro do alvo, chutando várias posições futuras em paralelo, junta os n-gramas que esses chutes produzem num conjunto e verifica candidatos desse conjunto na mesma passada. O artigo relata até 1,8x no MT-bench e até 4x em completação de código com várias GPUs.

**Cabeças de predição multi-token treinadas com o modelo.** Alguns modelos já vêm com isso embutido. O [relatório do DeepSeek-V3](https://arxiv.org/abs/2412.19437) treina módulos de multi-token prediction (MTP) como objetivo auxiliar e observa que eles podem ser reaproveitados para decodificação especulativa, e os motores de serving expõem MTP como método de rascunho.

Em 2026, os principais motores de serving abertos trazem vários desses. A [documentação de speculative decoding do vLLM](https://docs.vllm.ai/en/latest/features/speculative_decoding/) lista EAGLE, MTP, modelos de rascunho, PARD e MLP speculators como métodos baseados em modelo, e n-gram e suffix decoding como métodos leves, todos configurados por um único `speculative_config` com um `method` e `num_speculative_tokens`.

## Implementação na prática

Quatro partes, todas executadas por mim: uma implementação em numpy que prova a afirmação sobre a distribuição, uma checagem da fórmula de aceitação, a tabela de speedup e medições reais com Hugging Face transformers.

### Amostragem especulativa em numpy, com prova

A linguagem de brinquedo tem 4 tokens. O alvo é um modelo de bigramas aleatório (a distribuição do próximo token depende do token anterior), e o rascunho é o alvo borrado com ruído, ou seja, um modelo pior da mesma linguagem. As sequências têm 4 tokens, o que dá 256 resultados possíveis cujas probabilidades exatas dá para calcular só com o alvo. Se a amostragem especulativa é exata, sua distribuição empírica sobre esses 256 resultados precisa convergir para a exata, no mesmo ritmo que amostrar diretamente do alvo.

```python title="speculative_sampling.py"
import itertools
import math

import numpy as np

V = 4  # vocabulary size
L = 4  # tokens per sampled sequence, so there are V**L = 256 possible outcomes
BOS = 0

setup = np.random.default_rng(2)
# The target: a random bigram "language model". Row t is p(next token | previous token t).
P = setup.dirichlet(np.ones(V), size=V)
# The draft: a weaker model of the same language, the target blurred with noise.
Q = 0.55 * P + 0.45 * setup.dirichlet(np.ones(V), size=V)


def sample(rng, dist):
    return int(np.searchsorted(np.cumsum(dist), rng.random() * dist.sum(), side="right"))


def speculative_step(rng, prev, k, buggy=False):
    # 1. The draft proposes k tokens, one cheap call each.
    drafted, q_rows, ctx = [], [], prev
    for _ in range(k):
        q = Q[ctx]
        x = sample(rng, q)
        drafted.append(x)
        q_rows.append(q)
        ctx = x
    # 2. The target scores all k+1 positions at once: this is the single forward pass.
    p_rows = P[[prev] + drafted]
    # 3. Accept draft token i with probability min(1, p(x)/q(x)); stop at the first rejection.
    out = []
    for i, x in enumerate(drafted):
        p, q = p_rows[i], q_rows[i]
        if rng.random() < min(1.0, p[x] / q[x]):
            out.append(x)
            continue
        # On rejection, sample from the residual max(0, p - q), renormalized.
        fix = p if buggy else np.maximum(p - q, 0.0)
        out.append(sample(rng, fix))
        return out, i
    # 4. Every draft token survived: the target's last row gives one more token for free.
    out.append(sample(rng, p_rows[k]))
    return out, k


def generate(rng, k, length=L, buggy=False):
    seq, target_calls, accepted = [], 0, 0
    while len(seq) < length:
        prev = seq[-1] if seq else BOS
        new, n_ok = speculative_step(rng, prev, k, buggy)
        seq += new
        target_calls += 1
        accepted += n_ok
    return tuple(seq[:length]), target_calls, accepted


def generate_plain(rng, length=L):
    seq, prev = [], BOS
    for _ in range(length):
        prev = sample(rng, P[prev])
        seq.append(prev)
    return tuple(seq)


def exact_joint():
    joint = {}
    for seq in itertools.product(range(V), repeat=L):
        prob, prev = 1.0, BOS
        for tok in seq:
            prob *= P[prev, tok]
            prev = tok
        joint[seq] = prob
    return joint


def chi_square_p(stat, df):
    # Wilson-Hilferty: (X/df)^(1/3) is close to normal, good enough for a sanity check.
    z = ((stat / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    return 0.5 * math.erfc(z / math.sqrt(2))


def compare(samples, joint):
    n = len(samples)
    counts = {}
    for s in samples:
        counts[s] = counts.get(s, 0) + 1
    tv = 0.5 * sum(abs(counts.get(s, 0) / n - p) for s, p in joint.items())
    # Chi-square needs about 5 expected hits per cell, so rare outcomes share one pooled cell.
    cells, rare_obs, rare_exp = [], 0, 0.0
    for s, p in joint.items():
        if n * p >= 5:
            cells.append((counts.get(s, 0), n * p))
        else:
            rare_obs, rare_exp = rare_obs + counts.get(s, 0), rare_exp + n * p
    if rare_exp > 0:
        cells.append((rare_obs, rare_exp))
    stat = sum((o - e) ** 2 / e for o, e in cells)
    return tv, chi_square_p(stat, len(cells) - 1)


if __name__ == "__main__":
    joint = exact_joint()
    print("alpha per context:", np.round(np.minimum(P, Q).sum(axis=1), 3))
    print()
    print(f"{'N':>8} {'sampler':<12} {'TV':>7} {'chi2 p':>8}")
    for n in (1_000, 10_000, 100_000, 400_000):
        rng = np.random.default_rng(n)
        runs = {
            "target only": [generate_plain(rng) for _ in range(n)],
            "speculative": [generate(rng, k=3)[0] for _ in range(n)],
            "buggy": [generate(rng, k=3, buggy=True)[0] for _ in range(n)],
        }
        for name, samples in runs.items():
            tv, p = compare(samples, joint)
            print(f"{n:>8} {name:<12} {tv:>7.4f} {p:>8.4f}")
```

A flag `buggy` é o fallback do Júnior Inocente: amostrar de p puro em vez do resíduo. O script só precisa de numpy (rodei com numpy 2.5.3):

```bash title="terminal"
python speculative_sampling.py
```

```text title="saída"
alpha per context: [0.672 0.692 0.856 0.863]

       N sampler           TV   chi2 p
    1000 target only   0.1631   0.0564
    1000 speculative   0.1630   0.6063
    1000 buggy         0.2099   0.0000
   10000 target only   0.0545   0.0546
   10000 speculative   0.0524   0.0995
   10000 buggy         0.1199   0.0000
  100000 target only   0.0160   0.4631
  100000 speculative   0.0184   0.0096
  100000 buggy         0.1062   0.0000
  400000 target only   0.0084   0.0232
  400000 speculative   0.0078   0.4405
  400000 buggy         0.1075   0.0000
```

Leia primeiro a coluna TV. Com 1.000 amostras, até amostrar direto do alvo fica a 0,16 da distribuição exata, porque 256 resultados e 1.000 sorteios é simplesmente ruidoso. Conforme N cresce, "target only" e "speculative" encolhem juntos, mais ou menos como `1 / sqrt(N)`, e com 400.000 amostras os dois ficam abaixo de 0,01. O amostrador com bug se estabiliza em cerca de 0,107 e fica lá: mais amostras só deixam o viés mais fácil de ver.

Os p-valores do qui-quadrado pedem uma nota honesta. Para um amostrador correto, eles deveriam parecer números aleatórios uniformes entre 0 e 1, o que significa que um valor pequeno de vez em quando é esperado. O 0,0096 do amostrador especulativo com N = 100.000 parece alarmante isolado, e o "target only" tem um 0,0232 também. Para conferir que eu não estava me enganando, rodei de novo os dois amostradores corretos com 30 sementes diferentes e N = 30.000: os p-valores se espalharam de 0,001 a 0,82 para o alvo puro e de 0,17 a 0,98 para o especulativo, os dois com cara de amostrador correto. O com bug imprime 0,0000 todas as vezes.

### Taxa de aceitação e tokens por passada

A fórmula de tokens esperados assume um alpha único e constante. No modelo de brinquedo, alpha depende do contexto (de 0,67 a 0,86), então vale conferir o quanto a fórmula se sustenta com uma média medida:

```python title="acceptance.py"
import numpy as np

from speculative_sampling import BOS, speculative_step

rng = np.random.default_rng(42)
STEPS = 50_000

print(f"{'k':>2} {'alpha':>6} {'tokens/call':>12} {'formula':>8}")
for k in (1, 2, 3, 4, 6, 8):
    prev, emitted, judged, accepted = BOS, 0, 0, 0
    for _ in range(STEPS):
        new, n_ok = speculative_step(rng, prev, k)
        emitted += len(new)
        accepted += n_ok
        # The scan stops at the first rejection, so only n_ok + 1 draft tokens get judged (k if all pass).
        judged += min(n_ok + 1, k)
        prev = new[-1]
    alpha = accepted / judged
    formula = (1 - alpha ** (k + 1)) / (1 - alpha)
    print(f"{k:>2} {alpha:>6.3f} {emitted / STEPS:>12.3f} {formula:>8.3f}")
```

```text title="saída"
 k  alpha  tokens/call  formula
 1  0.785        1.785    1.785
 2  0.782        2.396    2.393
 3  0.784        2.887    2.878
 4  0.781        3.254    3.242
 6  0.781        3.782    3.760
 8  0.780        4.067    4.054
```

O alpha medido fica estável em cerca de 0,78 para todo k, e a fórmula prevê os tokens por chamada do alvo com erro abaixo de 1%, mesmo com a aceitação variando por contexto. Repare nos retornos decrescentes: ir de k = 1 para k = 2 rende 0,6 token por passada, ir de k = 6 para k = 8 rende 0,3 rascunhando dois tokens a mais. Com um rascunho de verdade, que custa alguma coisa, esses últimos tokens são por onde o speedup vaza.

### A tabela de speedup

Agora entra o custo do rascunho. `c = 0.05` é um rascunho barato (uma cabeça estilo EAGLE, ou um modelo de rascunho 20x mais barato por passo), e `c = 0.2` é um modelo de rascunho pequeno, mas não minúsculo em relação ao alvo:

```python title="speedup_table.py"
def expected_tokens(alpha, k):
    # Tokens produced per target forward pass (Leviathan et al. 2023, eq. 1).
    return (1 - alpha ** (k + 1)) / (1 - alpha)


def speedup(alpha, k, c):
    # c = cost of one draft step divided by the cost of one target step.
    return expected_tokens(alpha, k) / (k * c + 1)


ALPHAS = (0.5, 0.6, 0.7, 0.8, 0.9)
KS = (1, 2, 3, 4, 5, 6, 8)

for c in (0.05, 0.2):
    print(f"speedup, draft cost c = {c}")
    print("alpha " + "".join(f"{f'k={k}':>7}" for k in KS) + "   best k")
    for a in ALPHAS:
        row = [speedup(a, k, c) for k in KS]
        best = max(range(1, 21), key=lambda k: speedup(a, k, c))
        print(f"{a:<6}" + "".join(f"{s:>7.2f}" for s in row) + f"   {best} ({speedup(a, best, c):.2f}x)")
    print()
```

```text title="saída"
speedup, draft cost c = 0.05
alpha     k=1    k=2    k=3    k=4    k=5    k=6    k=8   best k
0.5      1.43   1.59   1.63   1.61   1.57   1.53   1.43   3 (1.63x)
0.6      1.52   1.78   1.89   1.92   1.91   1.87   1.77   4 (1.92x)
0.7      1.62   1.99   2.20   2.31   2.35   2.35   2.28   6 (2.35x)
0.8      1.71   2.22   2.57   2.80   2.95   3.04   3.09   8 (3.09x)
0.9      1.81   2.46   2.99   3.41   3.75   4.01   4.38   13 (4.67x)

speedup, draft cost c = 0.2
alpha     k=1    k=2    k=3    k=4    k=5    k=6    k=8   best k
0.5      1.25   1.25   1.17   1.08   0.98   0.90   0.77   1 (1.25x)
0.6      1.33   1.40   1.36   1.28   1.19   1.10   0.95   2 (1.40x)
0.7      1.42   1.56   1.58   1.54   1.47   1.39   1.23   3 (1.58x)
0.8      1.50   1.74   1.85   1.87   1.84   1.80   1.66   4 (1.87x)
0.9      1.58   1.94   2.15   2.28   2.34   2.37   2.36   7 (2.37x)
```

Três coisas saltam aos olhos. O melhor k muda com alpha, então um k fixo está errado para a maior parte do seu tráfego. Com um rascunho caro e aceitação mediana, um rascunho longo é prejuízo líquido (0,77x com alpha 0,5 e k = 8). E os números de manchete de "3x" precisam de alpha em torno de 0,8 ou mais com um rascunho barato, e é por isso que cabeças estilo EAGLE, que custam uma fração de uma camada, ganham de modelos de rascunho separados. Esse modelo também é otimista: ignora o overhead de contabilidade (rollback do KV, amostragem, Python), que pesa muito em modelos pequenos, como a próxima seção mostra.

### Uma medição real com transformers

Agora a coisa de verdade, com Hugging Face transformers 5.17 e torch 2.11. O alvo é o [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) e o rascunho é o [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct): mesma família, mesmo tokenizer, cerca de 1 GB de download somando os dois. Assisted generation é um argumento só, `assistant_model=`, e prompt lookup é `prompt_lookup_num_tokens=`. No transformers 5.17, o assistente por padrão rascunha até 20 tokens e para antes quando a confiança cai abaixo de 0,4; fixei k = 5 com agenda constante para os números ficarem fáceis de interpretar. Um forward hook no alvo conta as passadas, e os modos rodam em rodízio para que um vizinho barulhento na máquina atrase todos por igual.

```python title="bench_assisted.py"
import statistics
import sys
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

DEVICE = sys.argv[1] if len(sys.argv) > 1 else "cpu"
DTYPE = torch.bfloat16 if DEVICE == "cuda" else torch.float32
TARGET = "HuggingFaceTB/SmolLM2-360M-Instruct"
DRAFT = "HuggingFaceTB/SmolLM2-135M-Instruct"
NEW_TOKENS = 192
REPEATS = 5

CODE = '''def load_orders(path):
    orders = []
    with open(path) as f:
        for line in f:
            order_id, customer, amount, status = line.strip().split(",")
            if status == "paid":
                orders.append({"id": order_id, "customer": customer, "amount": float(amount)})
    return orders
'''
PROMPTS = {
    "code edit": f"Add type hints and a docstring to this function. Return the full function.\n\n{CODE}",
    "story": "Write a short story about a lighthouse keeper who finds a message in a bottle.",
}

tok = AutoTokenizer.from_pretrained(TARGET)
target = AutoModelForCausalLM.from_pretrained(TARGET, dtype=DTYPE).to(DEVICE).eval()
draft = AutoModelForCausalLM.from_pretrained(DRAFT, dtype=DTYPE).to(DEVICE).eval()

calls = {"target": 0}
target.register_forward_hook(lambda *_: calls.__setitem__("target", calls["target"] + 1))


def encode(prompt):
    messages = [{"role": "user", "content": prompt}]
    return tok.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt", return_dict=True).to(DEVICE)


def run(inputs, seed, **kwargs):
    torch.manual_seed(seed)
    if DEVICE == "cuda":
        torch.cuda.synchronize()
    calls["target"] = 0
    start = time.perf_counter()
    out = target.generate(**inputs, max_new_tokens=NEW_TOKENS, pad_token_id=tok.eos_token_id, **kwargs)
    if DEVICE == "cuda":
        torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    new = out[0, inputs["input_ids"].shape[1]:]
    return new, elapsed, calls["target"]


def first_diff(a, b):
    n = min(len(a), len(b))
    diff = (a[:n] != b[:n]).nonzero()
    return int(diff[0]) if len(diff) else (None if len(a) == len(b) else n)


def bench(inputs, modes):
    for kwargs in modes.values():
        run(inputs, seed=0, **kwargs)  # warm-up
    results = {name: [] for name in modes}
    # Round-robin, so a noisy neighbour on the machine slows every mode alike.
    for i in range(REPEATS):
        for name, kwargs in modes.items():
            results[name].append(run(inputs, seed=i, **kwargs))
    summary = {}
    for name, rs in results.items():
        tps = statistics.median(len(r[0]) / r[1] for r in rs)
        per_call = statistics.median(len(r[0]) / r[2] for r in rs)
        summary[name] = (rs[0][0], tps)
        print(f"  {name:<22} {tps:>7.1f} tok/s  {per_call:>5.2f} tok/target call  ({len(rs[0][0])} tokens)")
    return summary


draft.generation_config.num_assistant_tokens = 5
draft.generation_config.num_assistant_tokens_schedule = "constant"
draft.generation_config.assistant_confidence_threshold = 0.0

print(f"device={DEVICE} dtype={DTYPE} torch threads={torch.get_num_threads()}")
greedy = {
    "plain": dict(do_sample=False),
    "draft model, k=5": dict(do_sample=False, assistant_model=draft),
    "prompt lookup, k=10": dict(do_sample=False, prompt_lookup_num_tokens=10),
}
sampled = {
    "plain": dict(do_sample=True, temperature=1.0, top_k=0, top_p=1.0),
    "draft model, k=5": dict(do_sample=True, temperature=1.0, top_k=0, top_p=1.0, assistant_model=draft),
}
with torch.inference_mode():
    for label, prompt in PROMPTS.items():
        inputs = encode(prompt)
        print(f"[{label}] greedy")
        g = bench(inputs, greedy)
        base, base_tps = g["plain"]
        for name in ("draft model, k=5", "prompt lookup, k=10"):
            tokens, tps = g[name]
            print(f"  {name}: {tps / base_tps:.2f}x, first token that differs from plain: {first_diff(base, tokens)}")
        print(f"[{label}] sampling, temperature=1.0")
        s = bench(inputs, sampled)
        print(f"  draft model, k=5: {s['draft model, k=5'][1] / s['plain'][1]:.2f}x")
```

@@BENCH@@

## Checagem de realidade em produção

O brinquedo prova o algoritmo, e o notebook prova que o algoritmo não é o speedup. Estas são as coisas que decidem se compensa num deploy de verdade.

### O tamanho do batch come a computação grátis

Tudo acima se apoia em computação ociosa durante o decode. Um motor de serving sob carga alta preenche essa computação com tokens de outros usuários via continuous batching. Quando o batch fica grande o bastante para o decode passar a ser limitado por computação, as k posições extras por sequência deixam de ser grátis: verificar 5 tokens rascunhados para 64 sequências custa FLOPs de verdade, e cada token rejeitado é computação que você tirou da requisição de outra pessoa. A documentação do vLLM diz isso sem rodeios: os métodos baseados em modelo dão os ganhos altos com QPS baixo, quando o objetivo é latência.

Não é uma regra rígida que a especulação morre com batch 8. O [MagicDec](https://arxiv.org/abs/2408.11049) mostra que, com contextos longos, em que ler o KV cache domina cada passo, o decode continua limitado por memória mesmo com batches de 32 a 256, e relata até 2,51x no Llama 3.1 8B com um rascunho que usa KV cache esparso. O EAGLE-3 relata 1,38x de throughput com batch 64 no SGLang. A lição é medir na sua concorrência e no seu tamanho de contexto reais, e preferir motores que ajustam ou desligam a especulação conforme a carga cresce (o vLLM lista speculative decoding dinâmico entre as opções).

### A aceitação depende do conteúdo

Alpha não é uma propriedade do par de modelos. É uma propriedade do par de modelos no seu tráfego, com as suas configurações de amostragem. Meu prompt de edição de código era basicamente cópia, então tanto o rascunho quanto o prompt lookup foram bem; o prompt da história não tinha nada para copiar. A temperatura também pesa: com temperatura alta a distribuição do alvo se espalha e os palpites do rascunho batem menos com ela. Registre a taxa de aceitação por rota (tokens por passada do alvo basta) e decida por tipo de carga. Extração, edição de código e respostas de RAG são boas candidatas; escrita criativa aberta com temperatura 1,0 normalmente não é.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>É matematicamente sem perdas, então posso ligar em produção sem rodar nossas avaliações de novo.</span>
    </div>
  </div>
</div>

A matemática é exata na aritmética real. A sua GPU não é. Verificar cinco tokens numa passada roda kernels diferentes, com ordens de redução diferentes, das cinco passadas de um token, e em bf16 isso muda os últimos bits dos logits. Quando dois tokens estão quase empatados, o argmax vira, e dali em diante a sequência diverge. Minha execução greedy com prompt lookup na GPU divergiu do greedy normal no token 14. A documentação do vLLM diz o mesmo sobre a implementação deles: as saídas podem variar por causa da precisão de ponto flutuante e do tamanho do batch. A distribuição está certa, as saídas individuais não são idênticas bit a bit, e algumas variantes (a typical acceptance do Medusa, esquemas de verificação relaxados) nem preservam a distribuição. Rode as avaliações de novo e fixe a configuração que você avaliou.

### Custo e memória do rascunho são custos reais

Um modelo de rascunho separado precisa dos próprios pesos e do próprio KV cache na mesma GPU, memória que você daria a um batch maior ou a um contexto mais longo. Ele precisa do mesmo tokenizer (o transformers tem um modo de universal assisted decoding para tokenizers diferentes, ao preço de retokenizar). Suas passadas são sequenciais e limitadas por latência, então o c da fórmula costuma ser pior do que a razão entre parâmetros sugere, como meu notebook mostrou. E no transformers especificamente, assisted generation só suporta batch size 1 (o código-fonte da 5.17 lança "assisted generate is only supported for batch_size = 1"), o que faz dele uma ferramenta de latência para um único fluxo, não uma estratégia de serving.

### Ajuste o k e meça as coisas certas

A tabela já disse: o melhor k depende de alpha e de c, e um k fixo está errado para a maioria das requisições. Use rascunho adaptativo quando o motor oferecer (a agenda heurística e o limiar de confiança do transformers, as árvores dinâmicas do EAGLE-2, as opções dinâmicas do vLLM), e faça uma varredura de `num_speculative_tokens` contra tráfego real quando não oferecer.

Depois meça o que o usuário sente. O tempo até o primeiro token não melhora (o rascunho adiciona um pouco de prefill próprio). A latência média entre tokens melhora, mas agora os tokens chegam em rajadas, que algumas interfaces de streaming renderizam de um jeito estranho. Acompanhe tokens por passada do alvo como indicador antecedente, tokens por segundo por requisição para latência e tokens por segundo por GPU para custo, na sua concorrência real. Se o último cair no pico, a especulação está tirando do batch.

A decodificação especulativa é um dos poucos truques de inferência que são ao mesmo tempo exatos e simples: chute barato, verifique numa passada, mantenha os chutes que o alvo teria feito de qualquer jeito e corrija o primeiro que ele não faria. A regra de rejeição garante a distribuição do alvo; nada garante o speedup. Meça alpha no seu tráfego, lembre que a computação grátis pertence ao batch no horário de pico, e o "2x a 3x" vira uma decisão em vez de uma esperança.
