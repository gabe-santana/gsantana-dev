---
title: "Como modelos de embedding aprendem: treino contrastivo e o que isso muda na busca"
description: "Como o treino contrastivo molda um modelo de embedding, e os detalhes de prefixo, pooling, normalização e truncamento que decidem se ele recupera bem nos seus dados."
date: 2026-09-10
tags: [Embeddings, RAG, Python, Evaluation]
tldr:
  - "Um modelo de embedding é treinado com InfoNCE: puxa a consulta para perto da sua passagem e a afasta do resto do batch. Prefixos, pooling e normalização vêm desse treino, e o seu código precisa respeitá-los."
  - "Num pequeno conjunto de suporte interno de TI, um fine-tuning de um minuto do e5-small-v2 com negativos do batch e negativos difíceis levou o recall@1 fora do treino de 0,698 para 0,854, e a média escondeu uma fatia que piorou."
  - "Truncar dimensões sem renormalizar cortou pela metade o recall@1 em 64 dims no modelo base; uma loss Matryoshka manteve 32 dims em 0,844 de recall@1. Meça com os seus próprios pares rotulados, fatia por fatia."
---

Imagine um bot interno de helpdesk. Um funcionário digita "the vpn disconnects when I'm working from a hotel", e o bot explica, cheio de confiança, como redefinir a senha do Harbor, o cliente de acesso remoto da empresa. O artigo certo existe. Ele se chama "Harbor troubleshooting", fala de wifi de hotel e está na terceira posição. Ninguém do time escreveu "vpn" na base de conhecimento, porque internamente todo mundo chama aquilo de Harbor.

O primeiro instinto do time é trocar por um modelo de embedding maior. O segundo é baixar o limiar de similaridade. Nenhum dos dois encosta no problema real: o modelo foi treinado com a web pública, nunca ouviu falar do Harbor, e um punhado de detalhes de como o pipeline o chama (prefixos, pooling, normalização, quantas dimensões são guardadas) foi copiado de um tutorial sem ninguém saber por que importam. Este post é sobre como modelos de embedding aprendem, porque depois que você enxerga o objetivo de treino, esses detalhes deixam de parecer curiosidade. Depois fazemos fine-tuning de um modelo num conjunto pequeno e realista de domínio e medimos tudo com números reais.

## O problema e o contexto

Um modelo de embedding parece uma caixa-preta que transforma texto em vetor, e a maior parte do código de RAG o trata assim: chama `encode()`, guarda o resultado, calcula similaridade de cosseno na hora da consulta. Só que o vetor só significa alguma coisa em relação a como o modelo foi treinado. O objetivo de treino decide quais textos ficam perto uns dos outros. Os dados de treino decidem o que "perto" quer dizer para o seu vocabulário. E um conjunto de convenções embutidas durante o treino (um prefixo nas consultas, um pooling específico dos estados dos tokens, normalização para tamanho 1, uma temperatura que molda a distribuição das notas) faz parte da interface, mesmo que nada na API obrigue você a segui-las.

Quando reviso pipelines de busca que rendem abaixo do esperado, o modelo raramente é o problema sozinho. Muito mais vezes ele está sendo usado de um jeito diferente de como foi treinado: o pooling errado, o prefixo de consulta nos documentos, vetores truncados para caber no tamanho de uma coluna, um limiar ajustado para um modelo e reaproveitado em outro. Nada disso lança erro. Só deixa a busca alguns pontos pior, em silêncio, e o LLM lá em cima disfarça o buraco com respostas fluentes.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Embedding é só o estado oculto do modelo, né? Pega o vetor [CLS] de qualquer BERT e pronto.</span>
    </div>
  </div>
</div>

Um BERT cru foi treinado para prever tokens mascarados, não para colocar frases parecidas perto umas das outras, e os vetores de frase dele são ruins para similaridade: o artigo do Sentence-BERT mostrou que a saída [CLS] do BERT e a média dos vetores de token do BERT foram piores que a simples média de embeddings GloVe em similaridade semântica. O [Sentence-BERT (Reimers e Gurevych, 2019)](https://arxiv.org/abs/1908.10084) fechou essa lacuna fazendo fine-tuning do BERT numa estrutura siamesa, para que a similaridade de cosseno passasse a ter significado. E mesmo com um modelo de embedding de verdade, o pooling precisa ser o mesmo do treino. No conjunto de dados mais abaixo, pegar o vetor [CLS] do `e5-small-v2` (treinado com mean pooling) em vez da média derrubou o recall@1 de 0,788 para 0,669 em 480 consultas. Mesmos pesos, mesmo texto, uma linha de código.

## Mergulho na arquitetura

### Bi-encoders e cross-encoders

Existem duas formas de usar um transformer para julgar se uma passagem responde a uma consulta.

<div id="emb-bi-vs-cross-encoder-slot"></div>

Um **bi-encoder** codifica a consulta e a passagem separadamente, cada uma num vetor, e compara os vetores. Como as passagens nunca veem a consulta, dá para codificar o corpus inteiro uma vez, offline, e colocar num índice vetorial. Uma busca custa uma passada pela consulta mais comparações rápidas de vetores. O artigo do Sentence-BERT coloca a diferença em números: achar o par mais parecido entre 10.000 frases leva cerca de 65 horas com o BERT como cross-encoder e cerca de 5 segundos com embeddings do SBERT.

Um **cross-encoder** concatena a consulta e a passagem numa única entrada, deixa a atenção correr pelos dois textos e devolve uma única nota de relevância. Ele enxerga interações que um bi-encoder não enxerga (esta palavra da consulta nega aquela frase da passagem), então é mais preciso, mas precisa de uma passada por par e nada pode ser pré-calculado. Por isso a arquitetura padrão é um bi-encoder (muitas vezes ao lado do BM25, como na [busca híbrida com RRF](/pt-br/blog/hybrid-search-bm25-vectors-rrf/)) para trazer algumas dezenas de candidatos, e depois um cross-encoder para reordená-los. Tudo neste post é sobre o lado do bi-encoder, a parte que decide o que o reranker vai ter a chance de ver.

### Pooling: média, CLS ou último token

Um transformer devolve um vetor por token. Um bi-encoder precisa de um vetor por texto, então alguma coisa tem que agregá-los:

- **Mean pooling** tira a média dos vetores dos tokens, ignorando o padding. O Sentence-BERT usa por padrão, e o E5 também: o [model card do e5-small-v2](https://huggingface.co/intfloat/e5-small-v2) tira a média dos últimos estados ocultos sobre os tokens que não são padding.
- **CLS pooling** pega o estado final do primeiro token. Os [modelos BGE](https://huggingface.co/BAAI/bge-small-en-v1.5) são treinados assim.
- **Last-token pooling** pega o último token que não é padding, que num modelo só-decoder é a única posição que prestou atenção na entrada inteira. Embedders baseados em LLM, como o [e5-mistral-7b-instruct](https://huggingface.co/intfloat/e5-mistral-7b-instruct), usam esse.

Nenhum deles é melhor em geral. O que importa é que o pooling na inferência seja o mesmo do treino, porque o treino moldou a representação em torno dele. O bug clássico do mean pooling é o padding: se você tira a média sem a attention mask, o tamanho do texto mais longo do batch muda todos os embeddings do batch.

### Treino contrastivo e InfoNCE

Os modelos de embedding modernos são treinados de forma contrastiva. Você tem pares (uma consulta e uma passagem que a responde) e o modelo aprende a dar ao par verdadeiro uma nota maior que a de qualquer combinação errada. A loss que quase todo mundo usa é a InfoNCE, apresentada para aprendizado de representações por [van den Oord et al. (2018)](https://arxiv.org/abs/1807.03748). Para a consulta `i`, com passagem positiva `d_i` e passagens candidatas `d_1 .. d_N`:

`loss_i = -log( exp(s(q_i, d_i) / t) / sum_j exp(s(q_i, d_j) / t) )`

onde `s` é a similaridade de cosseno e `t` é uma temperatura. Leia como um problema de classificação: o modelo recebe N candidatos, aplica softmax nas similaridades e é penalizado pelo log negativo da probabilidade que deu ao certo. Com N candidatos e nenhum conhecimento, a loss é `log(N)`; um modelo perfeito a leva para perto de zero.

O truque que deixa isso barato são os **negativos do batch** (in-batch negatives). Coloque B pares num batch, codifique todas as consultas e todas as passagens e calcule a matriz de similaridade B x B inteira. A diagonal guarda os pares verdadeiros; toda célula fora da diagonal é um negativo de graça, já que a passagem da consulta 3 quase certamente não responde à consulta 7. Um batch de 32 pares dá a cada consulta 31 negativos pelo preço de codificar 64 textos. O [DPR (Karpukhin et al., 2020)](https://arxiv.org/abs/2004.04906) treinou assim, somando um negativo difícil recuperado pelo BM25 por pergunta, e superou um BM25 forte do Lucene por 9 a 19 pontos absolutos em acurácia de recuperação no top-20 em QA de domínio aberto.

<div id="emb-infonce-training-step-slot"></div>

### Temperatura

Dividir os cossenos por `t` antes do softmax controla o quão concentrada é a distribuição. O cosseno vive em [-1, 1], então sem escala os logits ficam próximos demais para o softmax expressar confiança. Com `t = 0,05`, uma diferença de 0,1 no cosseno vira uma diferença de 2 no logit, e a loss se concentra nos negativos com nota mais próxima da do positivo. O [SimCSE (Gao et al., 2021)](https://arxiv.org/abs/2104.08821) encontrou 0,05 como o melhor valor no cenário deles, e com essa temperatura o cosseno ganhou do produto escalar puro. O E5 usou 0,01.

A temperatura deixa uma impressão digital visível. O card do e5-small-v2 avisa que as notas de cosseno dele se concentram entre 0,7 e 1,0 por causa da temperatura baixa no treino, e que só a ordem relativa importa. Nos meus dados, dois artigos da base sem relação entre si tiveram cosseno médio de 0,817 com o modelo base. Esse número vai importar mais adiante.

### Negativos difíceis, e os negativos que não são

Negativos aleatórios do batch são quase sempre fáceis. Um artigo sobre cota de impressão é trivialmente diferente de uma pergunta sobre VPN caindo, então o modelo aprende pouco com ele. **Negativos difíceis** são passagens que parecem relevantes mas não são: a mesma ferramenta com outro problema, a mesma mensagem de erro em outra plataforma. Eles obrigam o modelo a aprender a distinção que realmente importa para você. Por isso o DPR acrescentou negativos do BM25, por isso o SimCSE supervisionado usa contradições de NLI como negativos difíceis, e por isso o [GTE (Li et al., 2023)](https://arxiv.org/abs/2308.03281) observa que, na sua etapa de fine-tuning, "a large batch size is unnecessary since hard negatives can already provide a reliable gradient estimation". O GTE também aumenta o conjunto de negativos de graça, contrastando consultas com outras consultas do batch e documentos com documentos, não só consultas com documentos.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então quanto mais difícil, melhor. Vou pegar os 10 primeiros resultados do meu retriever atual, tirar a resposta rotulada e usar os outros 9 como negativos.</span>
    </div>
  </div>
</div>

Esse é o caminho mais rápido para ensinar um modelo a rejeitar respostas certas. Os rótulos são incompletos: quem anota marca uma ou duas passagens boas e nunca olha o resto. O [RocketQA (Qu et al., 2020)](https://arxiv.org/abs/2010.08191) conferiu manualmente passagens do MS MARCO bem ranqueadas que não estavam rotuladas como positivas e descobriu que cerca de 70% eram, na verdade, positivas ou muito relevantes. Treinar com elas como negativos deixou o retriever deles bem pior, e a correção foi filtrar os candidatos com um cross-encoder antes. Minere negativos de uma faixa de ranking (digamos, da posição 10 à 50, não da 1 à 10), filtre com um reranker ou construa os negativos a partir de uma estrutura em que você confia, como "mesma ferramenta, outro problema" mais abaixo.

Falsos negativos também aparecem dentro de um batch sem mineração nenhuma. Se duas consultas do batch têm a mesma passagem positiva (comum quando um artigo da base responde a várias perguntas), o positivo de cada uma aparece como "negativo" na linha da outra. A loss então pede que o modelo prefira uma passagem a ela mesma, o que é impossível, e essas linhas nunca descem abaixo de `log(2)`. A correção é uma máscara: excluir toda célula fora da diagonal que contenha a mesma passagem que o positivo da linha.

### Prefixos assimétricos

Consulta e passagem são tipos diferentes de texto. "harbor drops at hotel" é curto e vago; o artigo é longo e declarativo. Muitos modelos deixam o encoder saber de que lado ele está codificando. O E5 foi treinado com os prefixos `query: ` e `passage: `, e [o artigo dele (Wang et al., 2022)](https://arxiv.org/abs/2212.03533) relata que foi o primeiro modelo a superar o BM25 no benchmark BEIR em zero-shot sem dados rotulados. O model card é explícito: use `query: ` e `passage: ` para recuperação assimétrica, `query: ` dos dois lados para tarefas simétricas como similaridade, e espere degradação sem eles. Embedders com instruções vão além: o e5-mistral coloca uma instrução de tarefa só do lado da consulta, e o BGE v1.5 recomenda uma instrução nas consultas de recuperação, avisando que sem ela a perda é pequena.

O prefixo não é enfeite. No treino, o modelo aprendeu a colocar o texto com `query: ` numa região do espaço voltada para o texto com `passage: `. Esqueça o prefixo, ou coloque o errado nos documentos, e você consulta a partir de um lugar para o qual o modelo nunca foi treinado. Vamos medir quanto isso custa.

### Anisotropia e normalização

Transformers pré-treinados produzem representações anisotrópicas: [Ethayarajh (2019)](https://arxiv.org/abs/1909.00512) mostrou que embeddings contextuais ocupam um cone estreito do espaço, então quaisquer dois textos têm cosseno alto. O SimCSE analisou isso com o arcabouço de alinhamento e uniformidade de [Wang e Isola (2020)](https://arxiv.org/abs/2005.10242) e mostrou que o objetivo contrastivo "achata" o espectro de valores singulares e espalha os embeddings de forma mais uniforme, porque empurrar negativos para longe é exatamente o que a uniformidade pede.

Duas consequências práticas. Primeiro, o valor absoluto de um cosseno depende do modelo: 0,8 pode significar "sem relação" num modelo e "quase duplicado" em outro. Segundo, normalize. A InfoNCE é treinada sobre cosseno, então a geometria do modelo vive na esfera unitária. Normalize todo vetor para tamanho 1 ao guardá-lo, e aí cosseno, produto escalar e (de forma monotônica) distância euclidiana dão o mesmo ranking, que é o que você quer ao [configurar o banco vetorial](/pt-br/blog/vector-database-performance-settings/).

### Representações Matryoshka

O armazenamento cresce linearmente com as dimensões, e o custo de cada comparação também. O [Matryoshka Representation Learning (Kusupati et al., 2022)](https://arxiv.org/abs/2205.13147) treina o modelo para que as primeiras k dimensões sejam um bom embedding sozinhas, para vários k aninhados ao mesmo tempo. A implementação é quase constrangedora de tão simples: calcule a mesma loss contrastiva nas primeiras 32, 64, 128, 256 e em todas as dimensões, e tire a média. O artigo relata embeddings até 14x menores na classificação do ImageNet com a mesma acurácia, e ganhos de velocidade reais de até 14x em recuperação em larga escala no ImageNet-1K e 4K.

O porém: truncar só funciona se o modelo foi treinado para isso, e um vetor truncado deixa de ter tamanho 1. Se o seu índice guarda vetores normalizados no tamanho cheio e depois cortados, o produto escalar passa a medir também quanto da norma de cada vetor calhou de cair nas primeiras k dimensões.

## Implementação na prática

Tudo abaixo rodou num notebook: `intfloat/e5-small-v2` (12 camadas, 384 dimensões, cerca de 130 MB de pesos), PyTorch 2.11 e transformers 5.17, numa GPU de notebook de 8 GB que chegou a cerca de 2 GB no pico. Uma rodada de treino leva mais ou menos um minuto, com avaliação. Sem sentence-transformers: a ideia é ver cada peça.

### InfoNCE do zero, com conferência numérica

A loss cabe em poucas linhas quando você a enxerga como entropia cruzada sobre uma matriz de similaridade. A máscara de falsos negativos é a única parte sutil.

```python title="infonce.py"
import math

import torch
import torch.nn.functional as F


def info_nce(q, d, temperature=0.05, pos_ids=None, doc_ids=None):
    """q: (B, H) queries. d: (N, H) documents, where d[i] is the positive of q[i]
    and rows B..N-1 are extra (hard) negatives. Every other row is a negative."""
    q = F.normalize(q, dim=-1)
    d = F.normalize(d, dim=-1)
    logits = q @ d.T / temperature                      # (B, N) scaled cosine similarities
    targets = torch.arange(q.size(0), device=q.device)  # the positive sits on the diagonal
    if pos_ids is not None:
        # A "negative" that is actually the same document as the positive is a false negative:
        # mask it out instead of pushing the query away from its own answer.
        same = pos_ids[:, None] == doc_ids[None, :]
        same[targets, targets] = False
        logits = logits.masked_fill(same, float("-inf"))
    return F.cross_entropy(logits, targets)


def info_nce_by_hand(q, d, temperature):
    """The same loss, one query at a time, with nothing but math."""
    total = 0.0
    for i in range(len(q)):
        sims = [F.cosine_similarity(q[i], d[j], dim=0).item() / temperature for j in range(len(d))]
        total += -(sims[i] - math.log(sum(math.exp(s) for s in sims)))
    return total / len(q)


if __name__ == "__main__":
    torch.manual_seed(0)
    q, d = torch.randn(4, 8), torch.randn(6, 8)
    for t in (1.0, 0.05):
        print(f"t={t}: torch={info_nce(q, d, t).item():.6f} by_hand={info_nce_by_hand(q, d, t):.6f}")
    print(f"chance level log(N) = {math.log(6):.6f}")

    aligned = d[:4] + 0.1 * torch.randn(4, 8)
    print(f"aligned queries, t=0.05: {info_nce(aligned, d, 0.05).item():.6f}")

    pos_ids = torch.tensor([0, 1, 2, 2])
    doc_ids = torch.tensor([0, 1, 2, 2, 7, 8])
    dup = d.clone()
    dup[3] = dup[2]  # queries 2 and 3 share an answer, so each one's positive is in the other's row
    dup_q = dup[:4] + 0.1 * torch.randn(4, 8)
    print(f"duplicate positive, unmasked: {info_nce(dup_q, dup, 0.05).item():.6f}")
    print(f"duplicate positive, masked:   {info_nce(dup_q, dup, 0.05, pos_ids, doc_ids).item():.6f}")
```

```text title="output"
t=1.0: torch=1.881182 by_hand=1.881182
t=0.05: torch=8.538165 by_hand=8.538165
chance level log(N) = 1.791759
aligned queries, t=0.05: 0.001479
duplicate positive, unmasked: 0.346596
duplicate positive, masked:   0.000022
```

A loss vetorizada e o laço concordam até a sexta casa decimal nas duas temperaturas. Com vetores aleatórios e `t = 1`, a loss fica perto do acaso (`log 6 = 1,79`); com `t = 0,05`, os mesmos vetores aleatórios custam 8,5, porque o softmax mais afiado pune com força os erros confiantes. Consultas próximas das suas passagens levam a loss quase a zero.

As duas últimas linhas são o problema dos falsos negativos em miniatura. As consultas 2 e 3 compartilham uma passagem. Sem máscara, cada uma, no melhor caso, divide a probabilidade entre duas colunas idênticas, então cada uma custa exatamente `log 2 = 0,693`, e a média do batch fica presa em `2 x 0,693 / 4 = 0,3466`, por melhor que o modelo fique. Com máscara, a loss vai a zero, como deveria.

### Um pequeno conjunto de busca de domínio

Gerei um conjunto sintético, mas realista, de suporte interno de TI: 12 ferramentas internas com nomes inventados (Harbor é o cliente de acesso remoto, Keystone o portal de SSO, Beacon o autenticador, Quill o serviço de impressão, e assim por diante), 5 tipos de problema para cada uma (falha de login, configuração em dispositivo novo, um código de erro, um problema de desempenho, um pedido de acesso), ou seja, 60 passagens de base de conhecimento. Cada passagem ganha 8 consultas no estilo de funcionário, que se referem à ferramenta pelo nome interno ou pelo que as pessoas realmente chamam ("the vpn", "mfa", "the printer", "outlook"). O conjunto é em inglês porque o e5-small-v2 é um modelo só de inglês.

```python title="data.py (excerpt)"
SYSTEMS = {
    "harbor": dict(
        name="Harbor", kind="remote access client", aliases=["the vpn", "vpn", "remote access", "Harbor"],
        code="HB-417", code_means="the device certificate expired", code_fix="open Atlas Self Service and run 'Renew device certificate', then restart Harbor",
        signin_cause="Harbor caches your old password for 24 hours after a change", signin_fix="choose 'Forget saved credentials' in the tray menu and sign in again",
        setup="install Harbor from Atlas Self Service, pick the 'Corp-Full' profile and approve the Beacon push",
        perf_user="disconnects when I'm working from a hotel", perf_symptom="drops every few minutes on hotel wifi", perf_cause="captive portals and UDP blocking on public networks", perf_fix="switch the transport to 'TCP 443' under Settings, Advanced",
        access="access to the lab network segment", approver="your manager and the Network team", form="the 'Network segment access' form in the service desk",
        action="connect from home",
    ),
    # ... 11 more tools: keystone, beacon, relay, quill, atlas, ledger, pulse, vault, dock, forge, switchboard
}

ISSUES = ["signin", "setup", "error", "perf", "access"]

PASSAGES = {
    "signin": "{name} ({kind}): cannot sign in. Most often {signin_cause}. To fix it, {signin_fix}. If it still fails, open a ticket in the {name} queue.",
    "setup": "Setting up {name} on a new device. {kind_cap}. Steps: {setup}. Your settings follow your account, nothing needs to be copied from the old device.",
    "error": "{name} error {code}. This error means {code_means}. Resolution: {code_fix}. The code shows up when you try to {action}.",
    "perf": "{name} troubleshooting: it {perf_symptom}. Cause: {perf_cause}. Workaround: {perf_fix}.",
    "access": "Requesting {access} in {name}. Approval comes from {approver}. File {form}; it usually takes one business day once approved.",
}

# QUERIES holds 8 employee-style templates per issue, e.g. "{alias} keeps rejecting my password
# but it works everywhere else", "what does {code} mean", "{alias} is acting up, it {perf_user}".


def build(seed: int = 7):
    rng = random.Random(seed)
    corpus, queries = [], []
    for s_i, (key, s) in enumerate(SYSTEMS.items()):
        fields = dict(s, kind_cap=s["kind"][0].upper() + s["kind"][1:])
        for i_i, issue in enumerate(ISSUES):
            pid = f"{key}-{issue}"
            corpus.append({"id": pid, "system": key, "issue": issue, "text": PASSAGES[issue].format(**fields)})
            # One issue per system is held out entirely: its article never appears in training.
            split = "test" if i_i == s_i % len(ISSUES) else "train"
            for q_i, template in enumerate(QUERIES[issue]):
                alias = s["aliases"][q_i % len(s["aliases"])]
                text = template.format(alias=alias, **{k: v for k, v in fields.items() if k != "alias"})
                queries.append({"text": text, "pos": pid, "split": split})
    rng.shuffle(queries)
    return corpus, queries
```

```text title="output"
passages=60 train_queries=384 test_queries=96
```

A divisão entre treino e teste é a decisão de desenho mais importante. Não dividi as consultas aleatoriamente, porque aí o teste perguntaria sobre artigos que o modelo já viu pareados com perguntas quase idênticas, e o fine-tuning pareceria mágica. Em vez disso, um artigo inteiro por ferramenta fica de fora: as 8 consultas dele são o teste, e o artigo nunca é usado no treino, nem como negativo. No caso do Harbor, o artigo separado é o de login: o modelo treina com as perguntas de configuração, erro, desempenho e acesso do Harbor e, no teste, precisa achar o artigo de login do Harbor para perguntas que nunca viu. A busca sempre roda contra as 60 passagens. Isso fica mais perto da situação real: artigos novos e perguntas novas aparecem depois que você treina.

### Codificação, pooling e métricas

```python title="embed.py (excerpt)"
import json

import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

MODEL = "intfloat/e5-small-v2"
device = "cuda" if torch.cuda.is_available() else "cpu"


def load(path=MODEL):
    return AutoTokenizer.from_pretrained(path), AutoModel.from_pretrained(path).to(device)


def pool(hidden, mask, how="mean"):
    if how == "cls":
        return hidden[:, 0]
    if how == "last":  # decoder-style models: the last non-padding token (right padding assumed)
        return hidden[torch.arange(hidden.size(0)), mask.sum(1) - 1]
    mask = mask.unsqueeze(-1).to(hidden.dtype)
    return (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)  # padding must not count


def embed(tok, model, texts, prefix="", how="mean", max_len=96):
    batch = tok([prefix + t for t in texts], padding=True, truncation=True, max_length=max_len, return_tensors="pt").to(device)
    out = model(**batch).last_hidden_state
    return pool(out, batch["attention_mask"], how)


@torch.no_grad()
def encode(tok, model, texts, prefix="", how="mean", bs=64):
    model.eval()
    return torch.cat([embed(tok, model, texts[i:i + bs], prefix, how) for i in range(0, len(texts), bs)]).float().cpu()


def evaluate(Q, D, pos_idx, dims=None, renorm=True):
    """Q, D: raw embeddings. pos_idx[i]: row of D that answers query i.
    dims: keep only the first `dims` coordinates. renorm=False keeps vectors that were
    normalized at full size and then cut, scored by plain dot product."""
    Q, D = F.normalize(Q, dim=-1), F.normalize(D, dim=-1)
    if dims:
        Q, D = Q[:, :dims], D[:, :dims]
        if renorm:
            Q, D = F.normalize(Q, dim=-1), F.normalize(D, dim=-1)
    scores = Q @ D.T
    pos_scores = scores[torch.arange(len(Q)), pos_idx]
    rank = (scores > pos_scores[:, None]).sum(1) + 1  # 1 = the right passage came first
    return {
        "R@1": (rank <= 1).float().mean().item(),
        "R@5": (rank <= 5).float().mean().item(),
        "MRR": (1.0 / rank).mean().item(),
        "nDCG@10": torch.where(rank <= 10, 1 / torch.log2(rank.float() + 1), torch.zeros(len(rank))).mean().item(),
    }
```

`load_data()` e `fmt()` (carregar o JSON e imprimir) foram omitidos. Com exatamente uma passagem relevante por consulta, as métricas ficam simples: recall@k é "a resposta estava entre as k primeiras", MRR é a média de `1 / rank`, e nDCG@10 é `1 / log2(rank + 1)` quando a resposta está entre as 10 primeiras e zero caso contrário. São os números em que confio para uma etapa de busca, como defendi em [como montar um conjunto de teste de recuperação para RAG](/pt-br/blog/rag-evaluation-retrieval-test-set/).

### Linha de base: prefixos e pooling

Antes de treinar qualquer coisa: como o modelo de fábrica se sai, e quanto as convenções importam? Como o modelo base não viu nenhuma dessas consultas, posso avaliá-lo nas 480 para ter números mais firmes.

```text title="output"
base model, all 480 queries
  query: / passage:  R@1=0.788 R@5=0.938 MRR=0.855
  no query prefix    R@1=0.781 R@5=0.940 MRR=0.849
  no prefixes        R@1=0.775 R@5=0.935 MRR=0.845
  query: on both     R@1=0.740 R@5=0.917 MRR=0.815
  CLS pooling        R@1=0.669 R@5=0.865 MRR=0.750
```

Isso é mais sutil que "use sempre o prefixo". Esquecer o prefixo da consulta custou menos de um ponto de recall@1 aqui, e tirar os dois prefixos, cerca de 1,3 ponto. Em texto curto de helpdesk, cheio de palavras-chave, o e5-small-v2 é bem tolerante. O erro que doeu foi o de copiar e colar: `query: ` nas passagens também, que é o que acontece quando um único helper `embed()` com o prefixo fixo no código é usado tanto para indexar quanto para buscar. Isso custou 4,8 pontos de recall@1. O pooling errado custou 11,9. Nenhuma dessas configurações lançou erro ou produziu um resultado obviamente quebrado; elas só ranquearam pior.

Nas 96 consultas separadas para teste (as que servem para julgar o fine-tuning), a configuração correta tem:

```text title="output"
query: / passage:          R@1=0.698 R@5=0.927 MRR=0.790 nDCG@10=0.832
```

### O laço de treino

Transformers puro, AdamW, mean pooling, temperatura 0,05, batches de 32 consultas. Para os negativos difíceis, uso uma estrutura em que confio em vez de minerar: para cada consulta, uma passagem aleatória da mesma ferramenta com outro problema, restrita aos artigos de treino. A máscara de falsos negativos vem ligada por padrão.

```python title="train.py"
import argparse
import random

import torch
import torch.nn.functional as F

from data import ISSUES
from embed import embed, encode, evaluate, fmt, load, load_data
from infonce import info_nce

p = argparse.ArgumentParser()
p.add_argument("--hard", action="store_true", help="add one hard negative per query")
p.add_argument("--no-mask", action="store_true", help="leave false negatives in the batch")
p.add_argument("--matryoshka", action="store_true", help="apply the loss at 384/256/128/64/32 dims")
p.add_argument("--epochs", type=int, default=8)
p.add_argument("--seed", type=int, default=0)
p.add_argument("--bs", type=int, default=32)
p.add_argument("--save", default="")
args = p.parse_args()

random.seed(args.seed)
torch.manual_seed(args.seed)
corpus, row, train, test = load_data()
tok, model = load()
docs = [p["text"] for p in corpus]
train_ids = {q["pos"] for q in train}  # held-out articles are never used, not even as negatives
DIMS = [384, 256, 128, 64, 32] if args.matryoshka else [384]


def hard_negative(pid):
    system, issue = pid.split("-", 1)
    return f"{system}-{random.choice([i for i in ISSUES if i != issue and f'{system}-{i}' in train_ids])}"


def score(m):
    Q = encode(tok, m, [q["text"] for q in test], "query: ")
    D = encode(tok, m, docs, "passage: ")
    return evaluate(Q, D, torch.tensor([row[q["pos"]] for q in test]))


print("before:", fmt(score(model)))
opt = torch.optim.AdamW(model.parameters(), lr=3e-5, weight_decay=0.01)
bs, collisions = args.bs, 0
for epoch in range(args.epochs):
    random.shuffle(train)
    model.train()
    for i in range(0, len(train) - bs + 1, bs):
        batch = train[i:i + bs]
        pos_ids = [q["pos"] for q in batch]
        doc_ids = pos_ids + ([hard_negative(pid) for pid in pos_ids] if args.hard else [])
        collisions += len(pos_ids) - len(set(pos_ids))
        q = embed(tok, model, [x["text"] for x in batch], "query: ")
        d = embed(tok, model, [docs[row[pid]] for pid in doc_ids], "passage: ")
        ids = torch.tensor([row[pid] for pid in doc_ids], device=q.device)
        mask = {} if args.no_mask else {"pos_ids": ids[:bs], "doc_ids": ids}
        loss = sum(info_nce(q[:, :k], d[:, :k], 0.05, **mask) for k in DIMS) / len(DIMS)
        opt.zero_grad()
        loss.backward()
        opt.step()
    print(f"epoch {epoch + 1} loss={loss.item():.4f}")

print(f"duplicate positives seen in batches: {collisions}")
print("after: ", fmt(score(model)))
print(f"peak GPU memory: {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB")
if args.save:
    model.save_pretrained(args.save)
    tok.save_pretrained(args.save)
```

A variante Matryoshka é a única linha que calcula `loss`: a mesma InfoNCE nas primeiras `k` dimensões para cada `k`, com média. Nada mais muda.

```bash title="terminal"
python train.py --hard
```

```text title="output"
before: R@1=0.698 R@5=0.927 MRR=0.790 nDCG@10=0.832
epoch 1 loss=0.4975
epoch 2 loss=0.2709
epoch 3 loss=0.0805
epoch 4 loss=0.0502
epoch 5 loss=0.0119
epoch 6 loss=0.0051
epoch 7 loss=0.0055
epoch 8 loss=0.0075
duplicate positives seen in batches: 751
after:  R@1=0.854 R@5=0.979 MRR=0.905 nDCG@10=0.929
peak GPU memory: 2030 MiB
```

Em artigos que o modelo nunca viu no treino, o recall@1 foi de 0,698 para 0,854 e o MRR de 0,790 para 0,905, em 96 passos do otimizador e cerca de 75 segundos de relógio, avaliação incluída. O modelo aprendeu que "the vpn" é o Harbor e que "mfa" é o Beacon, e aplicou isso a tipos de pergunta que nunca tinha visto pareados para aquela ferramenta. O contador de duplicatas mostra por que a máscara existe: com 48 artigos de treino e 32 consultas por batch, cerca de 8 linhas por batch compartilhavam o positivo com outra linha.

### Os negativos difíceis e a máscara fizeram diferença?

Uma rodada não prova nada, então repeti cada configuração com três seeds.

| Configuração (batch 32) | R@1, seeds 0 / 1 / 2 | MRR, seeds 0 / 1 / 2 |
|---|---|---|
| Só negativos do batch | 0.854 / 0.854 / 0.854 | 0.906 / 0.904 / 0.903 |
| + 1 negativo difícil por consulta | 0.854 / 0.854 / 0.854 | 0.905 / 0.907 / 0.908 |
| + negativo difícil, sem máscara de falsos negativos | 0.854 / 0.865 / 0.844 | 0.900 / 0.920 / 0.894 |

Com batch 32, as três são indistinguíveis. É um resultado real, não uma falha do experimento, e tem explicação clara: com só 60 artigos, um batch de 32 consultas já cobre a maior parte das ferramentas, então a passagem "mesma ferramenta, outro problema" geralmente já está no batch como negativo de graça. O negativo difícil acrescenta pouco ao que a amostragem aleatória já tinha dado. As rodadas sem máscara oscilam mais entre seeds, mas não perdem de forma clara.

Para os negativos do batch se comportarem mais como num corpus real com milhares de artigos, em que um batch aleatório quase nunca contém a passagem que confunde, reduzi o batch para 8 consultas (`--bs 8`) e repeti a comparação.

| Configuração (batch 8) | R@1, seeds 0 / 1 / 2 | MRR, seeds 0 / 1 / 2 |
|---|---|---|
| Só negativos do batch | 0.844 / 0.833 / 0.865 | 0.900 / 0.897 / 0.909 |
| + 1 negativo difícil por consulta | 0.865 / 0.854 / 0.875 | 0.912 / 0.905 / 0.925 |

Agora o negativo difícil ganha em todas as seeds, por uma ou duas consultas em 96 no recall@1 e cerca de um ponto de MRR. É pouco, mas na mesma direção três vezes em três, e é o regime que importa: quando o corpus é muito maior que o batch, os negativos aleatórios são fáceis, e o negativo difícil é a única coisa que ensina ao modelo que o artigo de login do Beacon não responde a uma pergunta de configuração do Beacon.

### Truncando dimensões, com e sem renormalizar

Agora a pergunta que toda fatura de banco vetorial acaba levantando: dá para guardar menos dimensões? Para cada modelo, mantive as primeiras `k` dimensões e avaliei de dois jeitos: renormalizado (cosseno nos vetores truncados) e cru (vetores normalizados em 384 dims, depois cortados, avaliados com produto escalar, que é o que acontece se você trunca vetores unitários já guardados e deixa o índice em produto interno).

```text title="output"
base e5-small-v2
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.698        0.698       0.790        0.790
 256       0.635        0.615       0.742        0.714
 128       0.531        0.417       0.665        0.527
  64       0.458        0.229       0.584        0.347
  32       0.312        0.198       0.424        0.330

fine-tuned
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.854        0.854       0.905        0.905
 256       0.854        0.854       0.904        0.902
 128       0.833        0.833       0.884        0.882
  64       0.802        0.802       0.850        0.851
  32       0.729        0.771       0.810        0.843

fine-tuned + MRL
dims  R@1 renorm  R@1 raw-dot  MRR renorm  MRR raw-dot
 384       0.854        0.854       0.902        0.902
 256       0.854        0.854       0.900        0.899
 128       0.865        0.854       0.903        0.891
  64       0.854        0.812       0.895        0.858
  32       0.844        0.792       0.896        0.866
```

Três coisas chamam atenção. O modelo base, que nunca foi treinado para truncamento, piora de forma constante, e esquecer de renormalizar deixa tudo muito pior: em 64 dimensões, o recall@1 é 0,458 renormalizado e 0,229 cru, a metade. Com a loss Matryoshka, 32 dimensões (um doze avos do armazenamento) mantiveram o recall@1 em 0,844, contra 0,854 no tamanho cheio, e o MRR quase não se mexeu. O modelo com fine-tuning comum fica no meio, e em 32 dims o produto escalar cru calhou de ganhar da renormalização, um lembrete de que com 96 consultas alguns pontos estão dentro do ruído. A regra de renormalizar continua sendo a que vale seguir: é a única versão que bate com a forma como o modelo foi treinado.

## Checagem de realidade em produção

### A média esconde a fatia que piorou

Este é o resultado que me deixou feliz por não ter parado no número principal. O recall@1 do teste, separado por tipo de problema, antes e depois do fine-tuning:

```text title="output"
held-out R@1 by issue type
  intfloat/e5-small-v2   signin=0.458 (n=24)  setup=0.667 (n=24)  error=1.000 (n=16)  perf=0.500 (n=16)  access=1.000 (n=16)
  ckpt-plain             signin=1.000 (n=24)  setup=1.000 (n=24)  error=1.000 (n=16)  perf=0.125 (n=16)  access=1.000 (n=16)
```

Login e configuração foram para 100%. As perguntas de desempenho desabaram de 0,500 para 0,125. Todo erro depois do treino foi a mesma confusão: perguntas como "the password manager no longer fills in logins on internal sites" ou "email is super slow and I can't find old messages" agora trazem o artigo de login da ferramenta. O modelo aprendeu um atalho com os dados de treino: consulta que fala de login ou de não encontrar alguma coisa é problema de login. O recall@1 agregado ainda subiu 15,6 pontos, então um painel com um número só teria colocado isso em produção sem pestanejar.

Com um conjunto de treino de verdade, é aqui que você acrescentaria formulações mais variadas para a fatia fraca, negativos que separam especificamente o par que confunde (o artigo de login da ferramenta como negativo difícil das perguntas de desempenho dela) e manteria o relatório por fatia no CI. Fatie pelo que importa para os seus usuários: produto, tipo de documento, idioma, tamanho da consulta.

### O MTEB é onde você começa, seus pares rotulados são onde você decide

O [MTEB (Muennighoff et al., 2022)](https://arxiv.org/abs/2210.07316) cobre 8 tipos de tarefa, 58 conjuntos de dados e 112 idiomas, e o próprio resumo conclui que nenhum método de embedding domina em todas as tarefas. Use-o para escolher três ou quatro modelos do tamanho que você pode pagar. Depois decida com os seus dados: algumas centenas de consultas reais com as passagens que as respondem, avaliadas com recall@k, MRR e nDCG exatamente como acima. Nomes internos como Harbor não estão em nenhum benchmark público, e é justamente neles que os modelos se diferenciam.

### O fine-tuning move a distribuição inteira das notas

Depois do fine-tuning, o cosseno médio entre dois artigos diferentes da base caiu de 0,817 para 0,037. Treinar com temperatura 0,05 num domínio estreito espalhou os artigos pela esfera, bem longe da faixa de 0,7 a 1,0 onde vive o modelo base.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Ótimo, o modelo com fine-tuning é melhor. Vou usá-lo nas consultas e gerar embeddings só dos documentos novos, os vetores antigos estão bons.</span>
    </div>
  </div>
</div>

Os vetores antigos são de outro espaço. O fine-tuning mexeu em todas as passagens, então comparar uma consulta do modelo novo com documentos do modelo antigo é comparar coordenadas de dois mapas diferentes. Trocar o modelo de embedding significa gerar de novo os embeddings do corpus inteiro, construir um índice novo ao lado do antigo e virar a chave quando ele estiver completo. O mesmo vale para qualquer coisa calibrada em notas: um limiar de "sem resposta boa" de 0,8 ajustado no modelo base rejeitaria quase tudo depois do fine-tuning. Reajuste os limiares no conjunto rotulado toda vez que o modelo mudar, e prefira lógica baseada em ranking (top k, reciprocal rank fusion) sempre que der.

### Trate as convenções como um contrato versionado

Tudo o que afetou os números acima deve ficar ao lado do índice como metadado: id e revisão do modelo, prefixo da consulta, prefixo da passagem, pooling, normalização, dimensões guardadas e a métrica de similaridade. Coloque indexação e consulta atrás de um único módulo que lê esse registro, para que o prefixo não divirja entre o job de ingestão e a API. Uma checagem na inicialização que gera o embedding de uma consulta fixa de teste e o compara com um vetor guardado pega a maioria dos desencontros com uma linha.

### Trunque só modelos treinados para isso

Se você quer 128 ou 64 dimensões, use um modelo treinado com objetivo Matryoshka (ou treine um, é uma linha), renormalize depois de truncar e confira se a coluna de vetores e a métrica de distância no banco batem com o que você realmente guarda. No modelo base acima, cortar para 128 dims custou 16,7 pontos de recall@1 mesmo renormalizando. No modelo MRL, nada. Combine truncamento com quantização com cuidado e meça os dois juntos; o [post sobre configurações de banco vetorial](/pt-br/blog/vector-database-performance-settings/) cobre o lado do armazenamento.

### Poucos dados, limites honestos

Este experimento é pequeno de propósito: 60 passagens sintéticas curtas, 384 consultas de treino, um minuto de GPU. Ele mostra a mecânica e os modos de falha, não o tamanho do ganho que você vai ter. Artigos reais são mais longos (o chunking importa, e 96 tokens de `max_len` os cortariam), consultas reais são mais bagunçadas, e fine-tuning com algumas centenas de pares pode fazer o modelo esquecer conhecimento geral. Mantenha uma fatia de consultas genéricas na avaliação para pegar isso, comece de um modelo que já se sai razoavelmente bem, use learning rate baixo e poucas épocas, e compare antes com as alternativas mais baratas: busca híbrida com BM25 já pega nomes exatos como "Harbor" e códigos de erro.

Modelos de embedding não são oráculos mágicos de similaridade. São classificadores treinados para escolher a passagem certa dentro de um batch, e cada convenção em volta deles (o prefixo, o pooling, a norma unitária, a impressão digital da temperatura nas notas, quantas dimensões sobrevivem ao truncamento) é uma sobra desse treino. Respeite as convenções, avalie com os seus próprios pares rotulados, fatia por fatia, e faça fine-tuning quando o seu vocabulário for o problema. Depois gere os embeddings de tudo de novo, porque o mapa mudou.
