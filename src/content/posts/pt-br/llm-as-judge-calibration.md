---
title: "Um LLM-as-a-judge em que dá para confiar: calibre o avaliador antes de acreditar na nota"
description: "Meça os vieses de posição, de tamanho e de autopreferência de um juiz LLM, e a concordância dele com humanos corrigida pelo acaso, antes que as notas decidam alguma coisa."
date: 2026-08-01
tags: [LLMs, Evaluation, Python, Statistics]
tldr:
  - "Um juiz é um instrumento de medida: compare-o com dois anotadores humanos usando concordância corrigida pelo acaso (kappa de Cohen, kappa ponderado para escalas ordinais), nunca só com a porcentagem de concordância."
  - "Rode toda comparação par a par nas duas ordens, estime explicitamente os efeitos de tamanho e de mesma família e reporte as taxas de vitória com intervalos de confiança por bootstrap sobre os prompts."
  - "Versione o juiz como modelo mais prompt mais rubrica e rode o conjunto de calibração de novo a cada mudança: um juiz novo pode mexer dez pontos nas notas enquanto o sistema avaliado continua parado."
---

Você muda o system prompt do seu assistente de suporte, roda a suíte de avaliação e o dashboard acende: o prompt novo vence 74% das comparações par a par contra o antigo, com um LLM como juiz. Você publica. Duas semanas depois, as lideranças do suporte avisam que as respostas ficaram mais longas e não ficaram melhores. O cliente rola três parágrafos para achar a única frase de que precisava. Ninguém mentiu e nenhum código estava errado. O juiz simplesmente gosta de resposta longa, o prompt novo faz o modelo escrever mais, e ninguém nunca tinha medido o quanto o gosto do juiz e o gosto das pessoas divergem.

Em [Avaliando RAG como engenheiro](/pt-br/blog/rag-evaluation-retrieval-test-set/), o LLM judge era a camada opcional e meio suspeita por cima das métricas determinísticas de retrieval. Este post é só sobre esse juiz: os vieses que ele comprovadamente tem, como desenhar a avaliação para dar menos espaço a eles e como medir o juiz contra humanos com estatísticas que não o favorecem. Tudo na parte prática roda offline com numpy, usando um juiz simulado cujos vieses você liga um de cada vez. O Júnior Inocente também está aqui.

## O problema e o contexto

Um juiz LLM é um instrumento de medida, e instrumentos têm dois tipos de erro. Ruído é a parte aleatória: avalie a mesma resposta duas vezes e você recebe duas notas diferentes. Viés é a parte sistemática: o juiz prefere a primeira resposta que lê, ou a mais longa, ou a escrita por um modelo da mesma família que ele. O ruído diminui quando você faz a média de mais itens. O viés não diminui nada. Ele só passa a ser medido com mais precisão, o que deixa o número errado com cara de mais confiável.

O artigo que todo mundo cita para dizer que "juiz LLM funciona" é [Zheng et al., 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"](https://arxiv.org/abs/2306.05685). A manchete é verdadeira: o GPT-4 como juiz concordou com as preferências de especialistas humanos no MT-Bench em 85% dos casos (sem contar empates), enquanto dois humanos concordaram entre si em 81%. O mesmo artigo também é o melhor catálogo do que dá errado. Com o prompt padrão, o GPT-4 manteve o veredito depois de trocar as duas respostas de lugar em só 65% dos casos, e em 30% favoreceu a resposta que vinha primeiro, fosse qual fosse. O Claude-v1 foi consistente em 23,8% dos casos. Um ataque de "lista repetitiva", em que a resposta é inflada com cópias reescritas dos próprios pontos, enganou o Claude-v1 e o GPT-3.5 em 91,3% das vezes (o GPT-4, em 8,7%). Em questões de matemática, o GPT-4 errou 14 de 20 julgamentos com o prompt padrão, mesmo em problemas que ele resolvia quando perguntado separadamente: as respostas no contexto o induziram ao erro.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Um artigo mostrou que o juiz concorda com especialistas tanto quanto os especialistas concordam entre si. E os modelos melhoraram desde então. Por que eu calibraria alguma coisa?</span>
    </div>
  </div>
</div>

Porque concordância não é propriedade de um modelo. Ela pertence ao conjunto de modelo, prompt, rubrica e distribuição de dados. Os 85% foram medidos em 80 perguntas abertas do MT-Bench, par a par, sem empates, contra um grupo específico de especialistas. A sua tarefa pode ser avaliar respostas sobre reembolso contra uma política, em português, numa escala de 1 a 5, e nada naquele artigo diz como o juiz se comporta aí. Modelos de juiz mais novos reduziram alguns desses efeitos, mas nada na literatura permite supor que eles são zero na sua tarefa. Medir sai barato perto de tomar uma decisão com base num número enviesado.

## Mergulho na arquitetura

### Os vieses que você deve esperar

**Viés de posição.** O juiz prefere uma resposta pelo lugar que ela ocupa no prompt. Além de Zheng et al., [Wang et al., 2023, "Large Language Models are not Fair Evaluators"](https://arxiv.org/abs/2305.17926) mostraram até onde isso vai: com o ChatGPT como avaliador, o Vicuna-13B conseguia vencer o próprio ChatGPT em 66 de 80 perguntas só trocando a ordem em que as respostas apareciam. A correção deles, Balanced Position Calibration, é a mesma ideia do teste de troca mais abaixo: avalie as duas ordens e combine.

**Viés de verbosidade.** Respostas mais longas ganham notas maiores, acrescentem algo ou não. O efeito é forte a ponto de o AlpacaEval, um benchmark automático bem usado, ter hoje uma variante com controle de tamanho: [Dubois et al., 2024](https://arxiv.org/abs/2404.04475) ajustam uma regressão que prevê a preferência do juiz a partir da diferença de tamanho e de outras variáveis e depois leem a preferência com diferença de tamanho zero. Esse ajuste sozinho elevou a correlação do benchmark com o Chatbot Arena de 0,94 para 0,98.

**Autopreferência.** O juiz tende a favorecer texto produzido por ele mesmo ou pela sua família de modelos. Zheng et al. viram o GPT-4 se favorecer com uma taxa de vitória 10% maior e o Claude-v1 com 25%, e tiveram o cuidado de dizer que os dados não bastavam para provar um viés. [Panickssery et al., 2024](https://arxiv.org/abs/2404.13076) foram além: os modelos reconhecem as próprias saídas melhor do que o acaso, e, depois de fine-tuning, a força do autorreconhecimento teve correlação linear com a força da autopreferência. O [artigo do G-Eval](https://arxiv.org/abs/2303.16634) levantou a mesma preocupação, um juiz que favorece texto gerado por LLM em vez de texto escrito por pessoas.

**Leniência.** Juízes puxam para o "aprovado". [Thakur et al., 2024, "Judging the Judges"](https://arxiv.org/abs/2406.12624) viram que os modelos juízes tendem a marcar respostas como corretas mesmo quando elas não cumprem totalmente as instruções, e que só os maiores juízes chegaram razoavelmente perto do alinhamento humano. A leniência se esconde muito bem atrás da porcentagem de concordância, como a parte prática mostra.

**Avaliação fraca em raciocínio difícil.** Um juiz que precisa verificar uma derivação enquanto compara duas respostas muitas vezes simplesmente não verifica. É para isso que existe a avaliação guiada por referência (mais sobre ela abaixo).

### Par a par ou pontual

A avaliação pontual (uma resposta, uma nota) escala linearmente, dá números absolutos que você acompanha ao longo do tempo e serve para barrar um único sistema. O ponto fraco é a própria escala: "4 de 5" significa o que o juiz acha que significa hoje, e um pequeno deslocamento nesse significado mexe em todas as notas de uma vez. Leniência e deriva de escala atingem a avaliação pontual em cheio.

A avaliação par a par (duas respostas, escolha uma ou declare empate) é mais próxima de como as pessoas julgam qualidade de fato, e deslocamentos constantes se anulam: um juiz generoso com as duas respostas ainda precisa escolher uma. Os custos: as comparações crescem com o número de sistemas, o resultado é relativo (60% de vitória contra uma baseline ruim diz pouco) e aparece o viés de posição, que a avaliação pontual não tem.

Meu padrão: par a par para escolher entre dois candidatos (prompt A ou B, modelo X ou Y), pontual com critérios binários para barrar um sistema ao longo do tempo. Qualquer que seja a escolha, o procedimento de calibração é o mesmo: pessoas rotulam os mesmos itens e você mede a concordância.

### Rubricas que prendem o juiz

Uma instrução vaga ("dê uma nota de 1 a 10 para a utilidade") entrega ao gosto do próprio juiz a tarefa de definir a escala, e é nesse gosto que os vieses moram. Duas técnicas tiram espaço dele.

**Escalas ancoradas.** Cada ponto da escala ganha uma descrição concreta e observável, de preferência amarrada a uma referência. Cinco pontos com âncoras ganham de dez pontos sem elas, porque um juiz (e uma pessoa) não distingue com confiança um 6 de um 7, mas distingue "um fato secundário está errado" de "o fato principal está errado".

```text title="rubric-correctness.txt"
Score the answer's correctness against the reference answer.
5: every fact agrees with the reference and nothing important is missing
4: the facts agree, one minor detail is missing or vague
3: the main fact is right, a secondary fact is wrong or missing
2: the main fact is wrong or missing, but the answer is on topic
1: wrong, off topic, or refuses a question it should answer
Length, tone and formatting do not change the score.
```

**Critérios binários.** Melhor ainda: quebre o julgamento em perguntas de sim ou não, cada uma sobre uma propriedade observável, e derive a nota delas. "Todo número da resposta bate com a referência?" é uma pergunta que o juiz responde com muito mais consistência do que "quão precisa ela é, de 1 a 5?". Critérios binários também são mais fáceis de rotular para pessoas, o que importa, porque os rótulos humanos são a sua verdade de referência. E eles tornam a divergência depurável: em vez de "o juiz deu 3, eu dei 4", você fica com "o juiz acha que o C3 foi cumprido, a política diz que não".

**Avaliação guiada por referência.** Dê ao juiz uma resposta de referência escrita ou aprovada por uma pessoa. Em Zheng et al., a taxa de erro do GPT-4 em comparações de matemática caiu de 14 de 20 com o prompt padrão para 6 de 20 com chain-of-thought e 3 de 20 quando o prompt incluía uma resposta de referência. O [Prometheus](https://arxiv.org/abs/2310.08491) foi construído em torno do mesmo par de entradas, uma rubrica de pontuação e uma resposta de referência, e chegou a uma correlação de Pearson de 0,897 com avaliadores humanos. A referência transforma "isto está certo?" em "isto bate com aquilo?", uma tarefa bem mais fácil.

Mais um hábito da mesma literatura: peça o raciocínio antes do veredito e coloque o veredito por último no formato de saída, para que a nota venha depois de o juiz olhar os critérios, e não seja justificada depois.

### Medindo concordância: a porcentagem não basta

A porcentagem de concordância responde "com que frequência o juiz deu o mesmo rótulo que a pessoa?". Ela ignora com que frequência os dois concordariam por acaso. Se 62% das suas respostas merecem aprovação, um juiz que aprova tudo concorda com a pessoa em 62% das vezes sem trazer informação nenhuma.

O [kappa de Cohen](https://en.wikipedia.org/wiki/Cohen%27s_kappa) corrige isso. Ele compara a concordância observada `p_o` com a concordância `p_e` que você esperaria se os dois avaliadores rotulassem de forma independente, cada um com as próprias frequências de rótulo: `kappa = (p_o - p_e) / (1 - p_e)`. Zero é o nível do acaso, um é concordância perfeita, negativo é pior que o acaso. O juiz que aprova tudo fica com exatamente zero. Lembre da peculiaridade conhecida do kappa, documentada por [Feinstein e Cicchetti em 1990](https://pubmed.ncbi.nlm.nih.gov/2348207): com categorias muito desbalanceadas, uma concordância alta pode vir com um kappa baixo. É o kappa funcionando como deveria quando um rótulo domina, mas isso significa que você sempre deve reportar o equilíbrio dos rótulos ao lado dele.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Nosso juiz bate com o aprovado ou reprovado humano em 68% das vezes. Não é incrível, mas é bem melhor que cara ou coroa, então claramente tem sinal ali.</span>
    </div>
  </div>
</div>

Cara ou coroa é a linha de base errada. A linha de base é o juiz mais burro que conhece as frequências dos rótulos, e num conjunto em que a maioria das respostas passa, "aprovar tudo" já ganha da moeda. No harness abaixo, um juiz leniente chega exatamente a esses 68% de concordância em aprovado ou reprovado, num conjunto em que aprovar tudo leva 62% de graça. O kappa dele é 0,21: mal passa do acaso. Os 68% eram, na maior parte, a taxa de base falando.

Para escalas ordinais, o kappa simples é duro demais: ele trata um 4 contra um 5 como a mesma falha que um 1 contra um 5. O kappa ponderado ([Cohen, 1968](https://doi.org/10.1037/h0026256)) dá a cada divergência uma penalidade que cresce com a distância, de forma linear ou quadrática. O kappa ponderado quadrático (QWK) é a escolha usual para rubricas de 1 a 5. Ele tem um ponto cego próprio, que o código vai mostrar: um juiz que é sempre exatamente um ponto generoso demais não acerta nenhuma nota exata e ainda assim tira QWK acima de 0,7. Por isso, reporte o QWK e o desvio médio juntos.

Vale conhecer duas alternativas. Thakur et al. usaram o pi de Scott em vez do kappa de Cohen, porque o kappa de Cohen calcula a concordância ao acaso a partir da distribuição de rótulos de cada avaliador, o que perdoa em parte um juiz com distribuição torta, e essa distorção é justamente parte do que você quer pegar. O [alfa de Krippendorff](https://www.asc.upenn.edu/sites/default/files/2021-03/Computing%20Krippendorff's%20Alpha-Reliability.pdf) generaliza a mesma ideia para qualquer número de avaliadores, rótulos faltantes e dados nominais, ordinais ou intervalares. Use-o quando tiver três anotadores e nem todos tiverem rotulado todos os itens.

Qualquer que seja a estatística, compare o juiz com o teto humano: a concordância entre duas pessoas nos mesmos itens. Não dá para esperar que o juiz concorde com uma pessoa mais do que as pessoas concordam entre si, e se dois dos seus anotadores chegam a um QWK de só 0,5, o problema é a rubrica, não o juiz.

### Incerteza: taxa de vitória sem intervalo é chute

Uma taxa de vitória de 0,56 em 100 prompts e uma de 0,56 em 1.000 prompts são afirmações diferentes. O jeito honesto mais simples de anexar incerteza é o bootstrap de percentis ([Efron, 1979](https://doi.org/10.1214/aos/1176344552)): reamostre seus itens com reposição milhares de vezes, recalcule a estatística em cada reamostragem e pegue os percentis 2,5 e 97,5. Funciona para taxa de vitória, kappa e diferença entre dois juízes sem nenhuma fórmula de distribuição.

A única regra que importa: reamostre a unidade que é independente. Essa unidade é o prompt, não o julgamento individual. As duas ordens de uma troca, e as duas respostas para o mesmo prompt, andam juntas em toda reamostragem. Quando você compara dois juízes ou dois sistemas nos mesmos prompts, reamostre os prompts uma vez e calcule a diferença dentro de cada reamostragem (um bootstrap pareado). Esse intervalo é bem mais estreito que dois intervalos independentes e é ele que responde à pergunta que você de fato fez.

### O ciclo de calibração

Tudo isso cabe num ciclo que roda antes de o juiz ganhar confiança, e de novo sempre que qualquer parte do juiz muda:

<div id="llm-judge-calibration-loop-slot"></div>

O conjunto de calibração é amostrado do tráfego real, cobrindo toda fatia que importa, rotulado por duas pessoas de forma independente, arbitrado onde elas divergem e congelado com uma versão. O juiz roda nele nas duas ordens, com o modelo fixado. O relatório traz kappa, QWK, consistência nas trocas e os efeitos de viés estimados. O portão compara esses números com o teto humano. O que vai para produção é a trinca de modelo, prompt e versão da rubrica, e não "o juiz".

## Implementação na prática

O código abaixo é Python 3.14 puro com numpy. Chamadas a um juiz de verdade exigem chaves de API e custam dinheiro, então a maquinaria de calibração roda contra um juiz simulado: uma função que enxerga a qualidade real de cada resposta através de ruído, com controles separados para leniência, verbosidade, autopreferência e viés de posição. Girar um controle de cada vez mostra qual métrica pega qual viés. A integração com um modelo real vem no fim, marcada claramente como ilustrativa.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # no Windows: .venv\Scripts\activate
pip install numpy
```

### Kappa e kappa ponderado do zero

```python title="agreement.py"
from collections.abc import Sequence

import numpy as np


def confusion_matrix(a: Sequence, b: Sequence, categories: Sequence) -> np.ndarray:
    index = {c: i for i, c in enumerate(categories)}
    matrix = np.zeros((len(categories), len(categories)))
    for x, y in zip(a, b, strict=True):
        matrix[index[x], index[y]] += 1
    return matrix


def percent_agreement(a: Sequence, b: Sequence) -> float:
    return float(np.mean(np.asarray(a) == np.asarray(b)))


def cohen_kappa(a: Sequence, b: Sequence, categories: Sequence) -> float:
    counts = confusion_matrix(a, b, categories)
    p = counts / counts.sum()
    observed = np.trace(p)
    # Chance agreement: each rater keeps their own label frequencies, labels drawn independently
    expected = float(p.sum(axis=1) @ p.sum(axis=0))
    if expected == 1.0:
        return float("nan")
    return float((observed - expected) / (1 - expected))


def weighted_kappa(a: Sequence, b: Sequence, categories: Sequence, weights: str = "quadratic") -> float:
    """categories must be in scale order: a 1 vs 5 disagreement costs more than 4 vs 5."""
    counts = confusion_matrix(a, b, categories)
    p = counts / counts.sum()
    expected = np.outer(p.sum(axis=1), p.sum(axis=0))
    i, j = np.indices(p.shape)
    distance = np.abs(i - j) / (len(categories) - 1)
    penalty = {"linear": distance, "quadratic": distance**2}[weights]
    chance_disagreement = float((penalty * expected).sum())
    if chance_disagreement == 0.0:
        return float("nan")
    return 1.0 - float((penalty * p).sum()) / chance_disagreement
```

O kappa ponderado está escrito como divergência sobre a divergência ao acaso, a forma que generaliza para penalidades. Os ramos com `nan` cobrem o caso degenerado em que os dois avaliadores usaram um único rótulo: a concordância além do acaso não é definida aí, e devolver 1.0 esconderia o problema.

Estatística feita à mão precisa ser conferida contra um valor publicado antes que qualquer coisa dependa dela. O artigo da Wikipedia sobre o kappa de Cohen tem um exemplo resolvido com 50 propostas de bolsa e resultado declarado de 0,40:

```python title="check_agreement.py"
import numpy as np

from agreement import cohen_kappa, percent_agreement, weighted_kappa

# Reference: the grant-proposal example in Wikipedia's Cohen's kappa article.
# 50 proposals: both yes 20, A yes and B no 5, A no and B yes 10, both no 15.
# Published values: p_o = 0.70, p_e = 0.50, kappa = 0.40.
a = ["yes"] * 25 + ["no"] * 25
b = ["yes"] * 20 + ["no"] * 5 + ["yes"] * 10 + ["no"] * 15
kappa = cohen_kappa(a, b, ["yes", "no"])
print(f"percent agreement {percent_agreement(a, b):.2f}  kappa {kappa:.4f}")
assert abs(kappa - 0.40) < 1e-12

# With two categories every weighting scheme collapses to plain kappa
for scheme in ("linear", "quadratic"):
    assert abs(weighted_kappa(a, b, ["yes", "no"], scheme) - kappa) < 1e-12

# Ordinal case: one rater is always exactly one point above the other
rng = np.random.default_rng(0)
human = rng.integers(1, 5, size=500)  # 1..4
judge = human + 1                     # 2..5, off by one every time
scale = [1, 2, 3, 4, 5]
print(f"off-by-one judge: exact {percent_agreement(human, judge):.2f}  "
      f"kappa {cohen_kappa(human, judge, scale):+.3f}  "
      f"linear {weighted_kappa(human, judge, scale, 'linear'):+.3f}  "
      f"quadratic {weighted_kappa(human, judge, scale, 'quadratic'):+.3f}")
```

```text title="terminal"
$ python check_agreement.py
percent agreement 0.70  kappa 0.4000
off-by-one judge: exact 0.00  kappa -0.226  linear +0.337  quadratic +0.717
```

O valor de referência bate, e o colapso no caso binário se confirma. A segunda linha é a lição sobre escalas ordinais. Um juiz que é sempre um ponto generoso demais nunca acerta a nota exata, e o kappa simples o chama de pior que o acaso, o que é duro demais: ele acompanha a pessoa perfeitamente, só que deslocado. O kappa quadrático dá 0,717, o que é gentil demais: um juiz que infla todas as notas é um problema para qualquer limite absoluto. Nenhum dos dois números conta a história sozinho; o desvio médio conta.

Também conferi as duas funções contra o `cohen_kappa_score` do scikit-learn em 200 pares aleatórios de 300 notas cada, sem peso, com peso linear e com peso quadrático. A maior diferença absoluta foi `2.22e-16`, ruído de ponto flutuante. Você não precisa do scikit-learn no resto do post.

### Um mundo sintético com um juiz que você pode enviesar

O conjunto de dados simula 400 prompts, cada um respondido por dois sistemas. "Ours" é o candidato. Ele é um pouco melhor em média, escreve cerca do dobro de tokens e vem da mesma família de modelos que o juiz. Aqui o tamanho não carrega nenhuma informação sobre qualidade, de propósito. Dois anotadores simulados rotulam cada resposta de forma independente na escala de 1 a 5, e o anotador 1 também dá uma preferência par a par.

```python title="world.py"
from dataclasses import dataclass

import numpy as np

SCALE = [1, 2, 3, 4, 5]


@dataclass(frozen=True)
class Answer:
    system: str     # "ours" (same model family as the judge) or "baseline"
    quality: float  # latent truth in 0..1; a real judge never sees it
    tokens: int


@dataclass(frozen=True)
class Item:
    ours: Answer
    baseline: Answer
    human: dict[str, int]    # annotator 1, 1..5 per system
    human_2: dict[str, int]  # annotator 2, same answers, labeled blind
    human_pref: str          # "ours", "baseline" or "tie"


def to_score(x: float) -> int:
    return int(np.clip(np.rint(1 + 4 * x), 1, 5))


def make_dataset(n: int = 400, seed: int = 11) -> list[Item]:
    rng = np.random.default_rng(seed)
    items = []
    for _ in range(n):
        difficulty = rng.normal(0, 0.15)
        q_base = float(np.clip(0.66 + difficulty + rng.normal(0, 0.12), 0, 1))
        q_ours = float(np.clip(0.69 + difficulty + rng.normal(0, 0.12), 0, 1))
        # Ours writes about twice as much, and length says nothing about quality here
        ours = Answer("ours", q_ours, int(rng.lognormal(np.log(340), 0.3)))
        base = Answer("baseline", q_base, int(rng.lognormal(np.log(170), 0.3)))
        human = {a.system: to_score(a.quality + rng.normal(0, 0.07)) for a in (ours, base)}
        human_2 = {a.system: to_score(a.quality + rng.normal(0, 0.07)) for a in (ours, base)}
        diff = q_ours - q_base + rng.normal(0, 0.04)
        pref = "ours" if diff > 0.05 else "baseline" if diff < -0.05 else "tie"
        items.append(Item(ours, base, human, human_2, pref))
    return items


@dataclass
class SimulatedJudge:
    """Stands in for an LLM judge, with each known bias as a dial."""

    noise: float = 0.07
    leniency: float = 0.0     # added to every perceived quality
    verbosity: float = 0.0    # added per 100 tokens above 250
    self_pref: float = 0.0    # added when the answer comes from the judge's own family
    position: float = 0.0     # added to whichever answer is shown first
    tie_band: float = 0.05
    seed: int = 0

    def __post_init__(self) -> None:
        self.rng = np.random.default_rng(self.seed)

    def _perceived(self, answer: Answer) -> float:
        return (
            answer.quality
            + self.leniency
            + self.verbosity * (answer.tokens - 250) / 100
            + self.self_pref * (answer.system == "ours")
        )

    def score(self, answer: Answer) -> int:
        return to_score(self._perceived(answer) + self.rng.normal(0, self.noise))

    def compare(self, first: Answer, second: Answer) -> str:
        margin = self._perceived(first) - self._perceived(second) + self.position + self.rng.normal(0, self.noise)
        return "first" if margin > self.tie_band else "second" if margin < -self.tie_band else "tie"
```

O juiz simulado tem o mesmo nível de ruído de um anotador humano e sorteia ruído novo a cada chamada, então perguntar duas vezes pode dar duas respostas, como num modelo real. Vale contar um bug que cometi enquanto escrevia isto: criar um `SimulatedJudge(seed=1)` novo para cada resposta dá a todas as respostas o mesmo sorteio de ruído, um erro correlacionado que fez um juiz sem viés parecer seis pontos generoso demais. Pipelines reais têm a mesma falha quando um cache ou uma seed fixa deixa amostras "independentes" idênticas.

### O teste de troca

<div id="llm-judge-swap-test-slot"></div>

Cada par é julgado duas vezes, uma em cada ordem. Os vereditos são traduzidos de posição ("first", "second") de volta para sistema, e uma vitória só conta quando sobrevive à troca. É a regra conservadora de Zheng et al.: chame o juiz nas duas ordens e só declare vitória quando a mesma resposta for preferida nas duas vezes.

```python title="pairwise.py"
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np

from world import Answer, Item

Compare = Callable[[Answer, Answer], str]  # (first, second) -> "first" | "second" | "tie"
OUTCOME = {"ours": 1.0, "tie": 0.5, "baseline": 0.0}


@dataclass(frozen=True)
class SwapReport:
    consistent: float       # same system wins (or tie) in both orders
    first_both: float       # the answer in slot 1 won both times: pure position bias
    second_both: float
    verdicts: list[str]     # per item, ties where the two orders disagree
    single_order: list[str] # what a one-call judge (ours always first) would have said


def swap_test(compare: Compare, items: Sequence[Item]) -> SwapReport:
    verdicts, single, kinds = [], [], Counter()
    for item in items:
        ab = compare(item.ours, item.baseline)
        ba = compare(item.baseline, item.ours)
        v1 = {"first": "ours", "second": "baseline", "tie": "tie"}[ab]
        v2 = {"first": "baseline", "second": "ours", "tie": "tie"}[ba]
        single.append(v1)
        if v1 == v2:
            kinds["consistent"] += 1
            verdicts.append(v1)
        else:
            # Conservative rule from Zheng et al.: a win must survive the swap
            kinds[f"{ab}_{ba}"] += 1
            verdicts.append("tie")
    n = len(items)
    return SwapReport(
        consistent=kinds["consistent"] / n,
        first_both=kinds["first_first"] / n,
        second_both=kinds["second_second"] / n,
        verdicts=verdicts,
        single_order=single,
    )


def win_rate(verdicts: Sequence[str]) -> float:
    return float(np.mean([OUTCOME[v] for v in verdicts]))
```

`first_both` é a impressão digital do viés de posição: a resposta da posição 1 venceu nas duas chamadas, então o conteúdo nunca importou. `single_order` registra o que você teria reportado com uma chamada por par e a nossa resposta sempre primeiro, um arranjo surpreendentemente comum quando o candidato entra simplesmente como "Answer A".

### Intervalos de confiança por bootstrap

```python title="bootstrap.py"
from collections.abc import Callable

import numpy as np


def bootstrap_ci(
    statistic: Callable[[np.ndarray], float],
    n_items: int,
    n_boot: int = 5000,
    level: float = 0.95,
    seed: int = 7,
) -> tuple[float, float, float]:
    """Percentile bootstrap over items. statistic receives an array of item indices."""
    rng = np.random.default_rng(seed)
    samples = np.array([statistic(rng.integers(0, n_items, n_items)) for _ in range(n_boot)])
    low, high = np.nanquantile(samples, [(1 - level) / 2, (1 + level) / 2])
    return statistic(np.arange(n_items)), float(low), float(high)
```

A estatística recebe índices de itens, não valores. É isso que mantém a reamostragem no nível do prompt: o que quer que a estatística calcule (uma taxa de vitória, um kappa entre dois vetores de rótulos, a diferença entre dois juízes), ela calcula sobre os mesmos prompts reamostrados.

### O harness de calibração

Cinco juízes, um controle cada: um justo, um leniente, um com viés de posição, um que recompensa tamanho e um que prefere a própria família. Todas as métricas da seção de arquitetura, lado a lado, com o segundo anotador humano como teto.

```python title="harness.py"
import numpy as np

from agreement import cohen_kappa, percent_agreement, weighted_kappa
from bootstrap import bootstrap_ci
from pairwise import swap_test, win_rate
from world import SCALE, SimulatedJudge, make_dataset

JUDGES = {
    "fair": SimulatedJudge(seed=1),
    "lenient": SimulatedJudge(leniency=0.25, seed=2),
    "position": SimulatedJudge(position=0.10, seed=3),
    "verbose": SimulatedJudge(verbosity=0.06, seed=4),
    "self-pref": SimulatedJudge(self_pref=0.08, seed=5),
}

items = make_dataset()
answers = [a for it in items for a in (it.ours, it.baseline)]
human = np.array([it.human[a.system] for it in items for a in (it.ours, it.baseline)])
human_2 = np.array([it.human_2[a.system] for it in items for a in (it.ours, it.baseline)])
tokens = np.array([a.tokens for a in answers])
is_ours = np.array([a.system == "ours" for a in answers])


def bias_effects(residual: np.ndarray) -> tuple[float, float]:
    # Our system is both the long one and the judge's sibling, so a raw
    # correlation can't tell the two biases apart: fit them jointly.
    X = np.column_stack([np.ones_like(tokens, dtype=float), tokens / 100, is_ours])
    _, per_100_tokens, own_family = np.linalg.lstsq(X, residual, rcond=None)[0]
    return float(per_100_tokens), float(own_family)


def pointwise_row(name: str, scores: np.ndarray) -> str:
    passed, human_passed = scores >= 4, human >= 4
    residual = scores - human
    length_effect, self_effect = bias_effects(residual)
    return (
        f"{name:<10} {percent_agreement(scores, human):>5.2f} {cohen_kappa(scores, human, SCALE):>6.2f} "
        f"{weighted_kappa(scores, human, SCALE):>6.2f} {percent_agreement(passed, human_passed):>6.2f} "
        f"{cohen_kappa(passed, human_passed, [True, False]):>6.2f} {residual.mean():>+7.2f} "
        f"{length_effect:>+8.2f} {self_effect:>+6.2f}"
    )


print(f"{len(items)} prompts, {len(answers)} answers, human pass rate {np.mean(human >= 4):.2f}")
print("\nPOINTWISE (1-5 scale, pass = 4 or 5)")
print(f"{'judge':<10} {'exact':>5} {'kappa':>6} {'qwk':>6} {'pass%':>6} {'passk':>6} {'offset':>7} {'len/100':>8} {'self':>6}")
print(pointwise_row("human-2", human_2))
for name, judge in JUDGES.items():
    print(pointwise_row(name, np.array([judge.score(a) for a in answers])))

human_pref = [it.human_pref for it in items]
prefs = ["ours", "tie", "baseline"]
wr, lo, hi = bootstrap_ci(lambda idx: win_rate([human_pref[i] for i in idx]), len(items))
print(f"\nPAIRWISE (ours vs baseline), human win rate {wr:.3f} [{lo:.3f}, {hi:.3f}]")
print(f"{'judge':<10} {'agree':>5} {'kappa':>6} {'consist':>7} {'1st-1st':>7} {'2nd-2nd':>7} {'one-call':>8}  {'swapped win rate [95% CI]'}")
for name, judge in JUDGES.items():
    report = swap_test(judge.compare, items)
    v = report.verdicts
    wr, lo, hi = bootstrap_ci(lambda idx: win_rate([v[i] for i in idx]), len(items))
    print(
        f"{name:<10} {percent_agreement(v, human_pref):>5.2f} {cohen_kappa(v, human_pref, prefs):>6.2f} "
        f"{report.consistent:>7.2f} {report.first_both:>7.2f} {report.second_both:>7.2f} "
        f"{win_rate(report.single_order):>8.3f}  {wr:.3f} [{lo:.3f}, {hi:.3f}]"
    )
```

`bias_effects` é a mesma ideia do AlpacaEval com controle de tamanho, em miniatura: faça a regressão do erro do juiz sobre as variáveis suspeitas e leia os coeficientes. Aqui isso importa porque os dois suspeitos estão confundidos. O nosso sistema escreve respostas longas e é parente do juiz, então qualquer viés para um dos lados aparece como "o juiz gosta do nosso". Estimar os dois ao mesmo tempo separa um do outro.

```text title="terminal"
$ python harness.py
400 prompts, 800 answers, human pass rate 0.62

POINTWISE (1-5 scale, pass = 4 or 5)
judge      exact  kappa    qwk  pass%  passk  offset  len/100   self
human-2     0.71   0.58   0.81   0.86   0.70   -0.00    -0.00  +0.04
fair        0.68   0.52   0.78   0.85   0.69   -0.02    +0.01  -0.05
lenient     0.28   0.02   0.44   0.68   0.21   +0.81    +0.01  -0.04
position    0.71   0.57   0.80   0.86   0.71   -0.01    -0.02  -0.00
verbose     0.64   0.48   0.75   0.81   0.61   +0.01    +0.22  -0.02
self-pref   0.67   0.51   0.76   0.84   0.66   +0.14    -0.00  +0.29

PAIRWISE (ours vs baseline), human win rate 0.555 [0.512, 0.596]
judge      agree  kappa consist 1st-1st 2nd-2nd one-call  swapped win rate [95% CI]
fair        0.71   0.57    0.71    0.02    0.02    0.564  0.559 [0.520, 0.595]
lenient     0.74   0.61    0.69    0.01    0.02    0.536  0.545 [0.507, 0.581]
position    0.60   0.43    0.40    0.27    0.00    0.776  0.546 [0.516, 0.575]
verbose     0.59   0.36    0.74    0.02    0.02    0.752  0.740 [0.705, 0.771]
self-pref   0.68   0.50    0.76    0.01    0.02    0.721  0.708 [0.671, 0.741]
```

Leia linha a linha.

**O teto.** Duas pessoas com o mesmo ruído concordam exatamente em 71% das vezes, com QWK de 0,81. O juiz justo fica logo abaixo (0,78). É assim que "bom" se parece: perto do teto, desvio perto de zero, nenhum efeito de tamanho ou de família. Mesmo o par humano só concorda exatamente em 71% das vezes, então um portão em "90% de concordância exata" reprovaria todo juiz e toda pessoa.

**Leniente.** É o juiz do cartão do Júnior Inocente. A concordância em aprovado ou reprovado é 0,68, enquanto aprovar tudo daria 0,62 neste conjunto. O kappa em aprovado ou reprovado é 0,21, o QWK é 0,44, o desvio é de +0,81 ponto. Agora olhe a tabela par a par: o juiz leniente concorda com a preferência humana em 74% das vezes, tão bem quanto o justo. Um deslocamento constante se anula quando o juiz precisa escolher entre duas respostas. Leniência é doença da avaliação pontual.

**Posição.** Invisível na tabela pontual, já que há uma resposta por chamada e nada para vir primeiro. Na tabela par a par, é gritante: só 40% dos pares mantêm o veredito depois da troca, e em 27% dos pares a posição 1 venceu as duas vezes. A taxa de vitória com uma chamada só, com a nossa resposta sempre na posição 1, é 0,776, contra uma taxa humana de 0,555. Com a troca e os empates nas inversões, a taxa cai para 0,546, dentro do intervalo humano. O teste de troca pega o viés de posição e ainda cura a maior parte dele, ao custo de uma segunda chamada.

**Verboso.** O coeficiente de tamanho é +0,22 ponto a cada 100 tokens e o de família é zero, então a regressão atribui o viés ao tamanho. Na tabela par a par, a taxa de vitória é 0,740, com intervalo de [0,705, 0,771], longe dos 0,555 humanos. E a consistência nas trocas é 0,74, maior que a do juiz justo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O juiz verboso tem a melhor consistência nas trocas da tabela inteira. Então ele é o juiz mais confiável, certo?</span>
    </div>
  </div>
</div>

Ele é o que erra com mais confiabilidade. A consistência nas trocas testa uma coisa só: se a ordem das respostas mudou o veredito. Um juiz que sempre prefere a resposta mais longa é perfeitamente consistente, porque a mais longa continua mais longa nas duas ordens. Cada checagem cobre um viés. O teste de troca cobre posição; tamanho e família precisam da regressão; leniência precisa do desvio e de uma estatística corrigida pelo acaso. Nenhuma delas substitui a concordância com humanos, e o kappa par a par de 0,36 do juiz verboso é o número que deveria ter barrado o lançamento da história do começo.

**Autopreferência.** O coeficiente de família é +0,29, sem efeito de tamanho, e a taxa de vitória de 0,708 [0,671, 0,741] de novo exclui o número humano. Sem a regressão, este juiz e o verboso pareceriam idênticos no agregado: os dois preferem "ours". Numa avaliação real, você os separaria do mesmo jeito ou, melhor ainda, quebraria a confusão já no desenho: inclua no conjunto de calibração respostas longas de outras famílias e respostas curtas da família do juiz.

### Deriva do juiz: a régua muda

Chega um modelo de juiz novo. Ele é mais barato e melhor nos benchmarks públicos, e você troca. Veja o que isso pode fazer com um dashboard, com o sistema avaliado congelado:

```python title="drift.py"
import numpy as np

from agreement import weighted_kappa
from bootstrap import bootstrap_ci
from pairwise import swap_test, win_rate
from world import SCALE, SimulatedJudge, make_dataset

items = make_dataset()
ours = [it.ours for it in items]
human = np.array([it.human["ours"] for it in items])
human_2 = np.array([it.human_2["ours"] for it in items])

# Same outputs, same prompt, same rubric: only the judge model changed
judge_v1 = SimulatedJudge(seed=1)
judge_v2 = SimulatedJudge(leniency=0.03, verbosity=0.03, seed=9)
old = np.array([judge_v1.score(a) for a in ours])
new = np.array([judge_v2.score(a) for a in ours])

for name, scores in (("human", human), ("human-2", human_2), ("judge v1", old), ("judge v2", new)):
    rate, lo, hi = bootstrap_ci(lambda idx: float(np.mean(scores[idx] >= 4)), len(items))
    print(f"{name:<9} pass rate {rate:.3f} [{lo:.3f}, {hi:.3f}]")

shift, lo, hi = bootstrap_ci(lambda idx: float(np.mean(new[idx] >= 4) - np.mean(old[idx] >= 4)), len(items))
print(f"v2 - v1   pass rate {shift:+.3f} [{lo:+.3f}, {hi:+.3f}]  (paired, same items)")
print(f"qwk v1 vs human {weighted_kappa(old, human, SCALE):.3f}  "
      f"v2 vs human {weighted_kappa(new, human, SCALE):.3f}  "
      f"v1 vs v2 {weighted_kappa(old, new, SCALE):.3f}")

print("\nhow wide is the win-rate interval? (fair judge, swapped)")
verdicts = swap_test(SimulatedJudge(seed=1).compare, items).verdicts
for n in (50, 100, 200, 400):
    rate, lo, hi = bootstrap_ci(lambda idx: win_rate([verdicts[i] for i in idx]), n)
    print(f"n={n:<4} win rate {rate:.3f} [{lo:.3f}, {hi:.3f}]  width {hi - lo:.3f}")
```

```text title="terminal"
$ python drift.py
human     pass rate 0.630 [0.583, 0.677]
human-2   pass rate 0.637 [0.590, 0.685]
judge v1  pass rate 0.625 [0.580, 0.670]
judge v2  pass rate 0.725 [0.680, 0.767]
v2 - v1   pass rate +0.100 [+0.065, +0.138]  (paired, same items)
qwk v1 vs human 0.821  v2 vs human 0.768  v1 vs v2 0.768

how wide is the win-rate interval? (fair judge, swapped)
n=50   win rate 0.540 [0.430, 0.640]  width 0.210
n=100  win rate 0.565 [0.490, 0.635]  width 0.145
n=200  win rate 0.573 [0.525, 0.625]  width 0.100
n=400  win rate 0.537 [0.499, 0.574]  width 0.075
```

O juiz novo é só um pouco mais leniente e um pouco mais fã de tamanho (controles em 0,03), e a taxa de aprovação das mesmas saídas congeladas salta dez pontos, com um intervalo pareado de [+0,065, +0,138] que exclui zero com folga. No dashboard, isso parece um ótimo release. As pessoas, a única régua que não mudou, continuam dizendo 0,63. O QWK de 0,768 entre v1 e v2 é o alerta rápido: dois juízes que deveriam ser intercambiáveis precisam concordar entre si pelo menos tão bem quanto cada um concorda com uma pessoa.

O segundo bloco responde "de quantos itens eu preciso?". Com 50 prompts, o intervalo de 95% de uma taxa de vitória tem 21 pontos de largura: não dá para distinguir 0,45 de 0,64. Com 200, são 10 pontos; com 400, 7,5. Para conjuntos de calibração, eu começo com 200 prompts rotulados e cresço para 400 nas fatias que importam. Repare também que a taxa de vitória com n=400 aqui é 0,537, enquanto o harness reportou 0,559 para o mesmo juiz justo: sorteios aleatórios diferentes do mesmo juiz mexeram dois pontos no resultado. A variância entre execuções também faz parte do instrumento, e é por isso que o intervalo importa mais que a estimativa pontual.

### Onde entra o juiz de verdade

Esta parte é **ilustrativa**: não rodei contra nenhum provedor, porque isso exige chaves e um conjunto de calibração real. Conferi que o código compila e que o mapeamento das ordens e o tratamento de falhas de parse se comportam como descrito, usando um `complete` falso que devolve JSON fixo. O que importa é o formato: rubrica com critérios binários e referência, raciocínio antes do veredito, as duas ordens, falhas de parse separadas de derrotas e um identificador explícito do juiz gravado em todo veredito.

```python title="judge_client.py"
import json
from collections.abc import Callable
from dataclasses import dataclass

# Illustrative: wrap your provider's SDK in this signature (pinned model id, temperature 0).
Complete = Callable[[str], str]

JUDGE_ID = "support-pairwise/rubric-v3/judge-model-2026-06-01"

PROMPT = """You compare two answers to the same customer question.
Use only the criteria below. Length is not a criterion: extra text counts only
if it satisfies a criterion the other answer misses.

C1 answers the question that was asked, not a nearby one
C2 every number, date and limit agrees with the reference answer
C3 promises nothing the policy excerpt does not allow
C4 tells the customer the next step when an action is needed

Question:
{question}

Reference answer (written by support staff):
{reference}

Answer 1:
{first}

Answer 2:
{second}

For each answer write one short reason, then true or false for C1 to C4.
Decide the winner last. Reply with JSON only:
{{"answer_1": {{"reason": "...", "C1": true, "C2": true, "C3": true, "C4": false}},
 "answer_2": {{"reason": "...", "C1": true, "C2": false, "C3": true, "C4": true}},
 "winner": "1"}}
winner is "1", "2" or "tie".
"""


@dataclass(frozen=True)
class PairVerdict:
    winner: str | None  # "ours", "baseline", "tie", or None when unparseable
    flipped: bool       # the two orders disagreed
    judge_id: str = JUDGE_ID


def _winner(raw: str) -> str | None:
    try:
        data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
    except ValueError:
        return None
    winner = data.get("winner") if isinstance(data, dict) else None
    return {"1": "first", "2": "second", "tie": "tie"}.get(winner)


def judge_pair(complete: Complete, question: str, reference: str, ours: str, baseline: str) -> PairVerdict:
    ab = _winner(complete(PROMPT.format(question=question, reference=reference, first=ours, second=baseline)))
    ba = _winner(complete(PROMPT.format(question=question, reference=reference, first=baseline, second=ours)))
    if ab is None or ba is None:
        # Missing, not a loss: a parse failure must never count against either side
        return PairVerdict(None, False)
    v1 = {"first": "ours", "second": "baseline", "tie": "tie"}[ab]
    v2 = {"first": "baseline", "second": "ours", "tie": "tie"}[ba]
    return PairVerdict(v1 if v1 == v2 else "tie", v1 != v2)
```

O `compare` que o harness recebe tem o mesmo contrato das chamadas internas de `judge_pair`, então o teste de troca, o bootstrap e as estatísticas de concordância rodam sem mudança sobre vereditos reais. Guarde também os booleanos de cada critério. Quando o juiz discorda de uma pessoa, o critério que virou é o caminho mais rápido para uma rubrica melhor.

## Checagem de realidade em produção

### Seus rótulos humanos são o teto, e eles também derivam

Tudo acima assume que os rótulos humanos estão certos. Dois anotadores, rotulando às cegas, com a mesma rubrica que o juiz recebe; meça a concordância entre eles antes de medir a do juiz e arbitre as divergências até chegar a um rótulo final. Quando duas pessoas cuidadosas discordam muito, a rubrica é ambígua, e nenhum juiz conserta isso.

Espere que a rubrica mude enquanto vocês rotulam. [Shankar et al., 2024, "Who Validates the Validators?"](https://arxiv.org/abs/2404.12272) deram nome a isso, criteria drift: as pessoas precisam de critérios para avaliar saídas, mas é avaliando saídas que elas descobrem seus critérios. É normal. Versione a rubrica e o conjunto de calibração juntos e não compare números de concordância entre versões diferentes da rubrica.

### Fixe o juiz e versione a régua

Um juiz é a trinca de versão do modelo, prompt e rubrica. Mude qualquer um dos três e você tem um instrumento novo, então grave o id do juiz ao lado de toda nota, como o `judge_client.py` faz, e rode o conjunto de calibração de novo antes que os números do juiz novo entrem no mesmo gráfico dos antigos. Evite aliases de modelo que passam em silêncio para um snapshot novo. Quando o provedor aposentar a versão fixada, trate a migração como uma troca de juiz, com a checagem de deriva acima: refaça a linha de base, não emende a série histórica.

<div class="callout warning" data-title="Atenção">
  <p>Nunca compare notas produzidas por juízes diferentes como se fossem a mesma métrica. Um salto de dez pontos depois de trocar o juiz é uma troca de régua até o conjunto de calibração dizer o contrário. Se você precisa de continuidade, avalie um conjunto fixo de saídas antigas com os dois juízes e publique o deslocamento.</p>
</div>

### Mantenha o juiz fora da própria família

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Vamos usar como juiz o mesmo modelo que a gente coloca em produção. É o mais forte que temos em contrato e ele já conhece o nosso domínio.</span>
    </div>
  </div>
</div>

Esse é justamente o arranjo em que a autopreferência com certeza pesa: toda comparação entre o seu sistema e um concorrente, ou entre o seu prompt novo e uma resposta escrita por uma pessoa, é julgada por um parente de um dos lados. Panickssery et al. ligam a autopreferência ao autorreconhecimento, e um modelo reconhece melhor que tudo o texto da própria família. Use um juiz de outra família quando comparar sistemas, ou pelo menos inclua a família como variável na regressão de viés, e coloque saídas de várias famílias no conjunto de calibração para que o efeito possa ser medido. Se a política da empresa só deixa você usar uma família, reporte o efeito de família medido ao lado de toda taxa de vitória.

### Custo

Um juiz calibrado custa mais que um ingênuo. O teste de troca dobra as chamadas par a par. Raciocínio antes do veredito multiplica os tokens de saída. Comparar k sistemas par a par custa k(k-1)/2 comparações por prompt. Uma rodada de calibração é pequena (algumas centenas de prompts, duas vezes), mas uma regressão noturna sobre milhares de prompts pesa. O que mantém isso viável:

- **APIs de batch.** Avaliação não precisa de resposta em tempo real. Tanto a [Message Batches API da Anthropic](https://platform.claude.com/docs/en/build-with-claude/batch-processing) quanto a [Batch API da OpenAI](https://developers.openai.com/api/docs/guides/batch) cobram requisições em batch a 50% do preço síncrono, com resultado em até 24 horas.
- **Prompt caching.** Coloque a parte estática (instruções, rubrica, exemplos few-shot) primeiro e a parte variável (pergunta, referência, respostas) por último, para que o prefixo longo fique em cache entre as chamadas.
- **Uma cascata.** Checagens determinísticas primeiro (formato, campos obrigatórios, números contra a referência, como no post de RAG), e o juiz só para o que elas não conseguem decidir.
- **Amostragem.** Avalie uma amostra estratificada do tráfego de produção, não tudo. O bootstrap diz de que tamanho a amostra precisa ser para o intervalo de que você precisa.

A parte cara não são os tokens, é o tempo de rotulagem humana, e é também a única coisa que faz todos os outros números do seu dashboard significarem algo.

### Coisas menores que mordem

- **Empates.** Decida de antemão quanto vale um empate (0,5 neste post) e se o juiz pode declarar um. Forçar uma escolha infla o viés de posição, porque o juiz precisa desempatar empates genuínos de algum jeito, e costuma desempatar pela posição.
- **Falhas de parse.** Uma resposta do juiz que não passa no parse é dado faltante. Contá-la como derrota de um lado, ou como reprovação, coloca os bugs do seu parser dentro da métrica. Acompanhe a taxa de falha de parse como um número próprio.
- **Fatias.** A concordância pode ser alta na média e ruim numa fatia (documentos longos, um idioma, recusas). Reporte o kappa por fatia nas fatias sobre as quais você toma decisões, com intervalos, já que fatias são pequenas.
- **Controle de tamanho nos relatórios.** Mesmo com uma boa rubrica, reporte a diferença de tamanho das respostas ao lado de qualquer taxa de vitória. Se o vencedor também é 60% mais longo, mostre o número com controle de tamanho ou pelo menos o coeficiente da regressão.

Um juiz LLM é um instrumento de medida. Antes de confiar nas leituras dele, você mede o instrumento: contra duas pessoas, com estatísticas que descontam o acaso, nas duas ordens, com os vieses suspeitos estimados explicitamente e um intervalo em cada número. O código para isso são algumas centenas de linhas de numpy. A disciplina é a parte difícil: fixe o juiz, versione a régua e rode o conjunto de calibração de novo sempre que algo no juiz mudar. Faça isso, e uma taxa de vitória de 74% vira uma afirmação que você consegue defender diante das lideranças do suporte, em vez de uma que elas derrubam por você.
