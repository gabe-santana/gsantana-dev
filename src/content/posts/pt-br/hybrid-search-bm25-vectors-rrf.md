---
title: "Busca híbrida que funciona: BM25, vetores e Reciprocal Rank Fusion"
description: "Combine BM25 e vetores para encontrar termos exatos e sentido, com reranking quando preciso."
date: 2025-11-02
tags: [RAG, Search, Python, Embeddings]
tldr:
  - "A busca vetorial borra tokens exatos como códigos de erro e SKUs; o BM25 os encontra, então rode os dois retrievers lado a lado."
  - "Junte os rankings com Reciprocal Rank Fusion (soma de 1/(k + rank), k perto de 60): usa posições e ignora escalas de score incompatíveis."
  - "Reordene os candidatos fundidos com um cross-encoder: a fusão decide o que sobrevive, o reranking decide a ordem final."
---

Imagine um bot de suporte rodando em cima de milhares de artigos de troubleshooting. O usuário digita "o que significa ERR-4012 na API de checkout?" e o bot responde com um parágrafo lindamente escrito sobre... timeouts de pagamento em geral. O artigo que tem literalmente `ERR-4012` no título existe. Ele só nunca chegou na janela de contexto, porque a busca vetorial achou que outros três artigos "pareciam" mais próximos.

Esse é o jeito mais comum de um sistema de RAG falhar em produção, e não tem nada a ver com o LLM. É um problema de retrieval, e a correção é antiga, sem glamour e extremamente eficaz: rodar um retriever por palavra-chave ao lado do retriever vetorial e juntar os dois rankings com Reciprocal Rank Fusion. Vamos construir isso direito, da intuição ao código e às coisas que te mordem depois do deploy.

## O problema e o contexto

Embeddings são compressão. Um modelo pega um chunk de texto e espreme o significado dele em algumas centenas ou alguns milhares de números de ponto flutuante. É exatamente por isso que eles são ótimos com paráfrase: "meu cartão foi recusado" e "o pagamento não foi aprovado" ficam perto um do outro, mesmo sem compartilhar nenhuma palavra.

Essa mesma compressão é o que te prejudica com tokens exatos. Pense num embedding como uma foto de uma multidão tirada de um helicóptero: dá para ver que é um show, mais ou menos quantas pessoas tem ali e qual é o clima. Não dá para ler o nome no crachá de ninguém. Códigos de erro, SKUs, números de nota fiscal, strings de versão, sobrenomes raros e codinomes internos de projeto são os crachás. Para o modelo de embedding, `ERR-4012` e `ERR-4021` são quase a mesma foto, e `SKU-88213-B` é basicamente ruído que vira pedaços de subpalavras sem muito significado próprio.

Consultas típicas em que a busca vetorial pura sofre:

| Tipo de consulta | Exemplo | Por que embeddings sofrem |
|---|---|---|
| Códigos de erro | `ERR-4012 checkout` | Códigos quase idênticos viram vetores parecidos |
| Identificadores de produto | `SKU-88213-B dimensões` | Tokens raros, quebrados em subpalavras sem sentido |
| Versões | `breaking changes na 3.11.2` | Números carregam pouco peso semântico |
| Nomes raros | `renovação contrato Kowalczyk` | Nomes próprios fora da distribuição de treino |
| Chaves de configuração | `max_inflight_requests default` | Identificadores em snake case parecem palavras genéricas |

A busca por palavra-chave tem a personalidade oposta. Ela não faz ideia de que "recusado" e "não aprovado" são parentes, mas se o documento contém `ERR-4012` e sua consulta contém `ERR-4012`, ela acha toda vez, e ainda coloca no topo justamente porque o token é raro.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Não dá só pra trocar por um modelo de embedding maior? O caro com certeza sabe o que é ERR-4012.</span>
    </div>
  </div>
</div>

Um modelo maior te dá semântica melhor, não uma memória melhor para strings arbitrárias. Seus códigos de erro foram inventados pelo seu time no trimestre passado; nenhum modelo viu isso no treino, e nenhuma quantidade de parâmetros transforma um vetor denso num índice de match exato. Você até pode fazer fine-tuning dos embeddings no seu domínio, e isso ajuda um pouco, mas é muito trabalho para aproximar algo que o BM25 faz de graça. Use cada ferramenta para aquilo em que ela é boa.

### Como o BM25 pontua um documento

O BM25 é a função de ranking padrão por trás da maioria dos motores de busca por palavra-chave (Lucene, Elasticsearch, OpenSearch, o lado full text do Azure AI Search e vários outros). Para cada termo da consulta, ele combina três ideias:

1. **Frequência do termo (TF)**: um documento que menciona o termo mais vezes provavelmente é mais relevante, mas com retornos decrescentes. A décima menção agrega bem menos que a primeira. O parâmetro `k1` (normalmente algo entre 1.2 e 2.0) controla a velocidade dessa saturação.
2. **Frequência inversa nos documentos (IDF)**: termos raros valem mais que termos comuns. "o" aparece em todo lugar e não diz nada; `ERR-4012` aparece em dois documentos e diz muita coisa.
3. **Normalização por tamanho**: um documento longo naturalmente tem mais palavras, então as contagens de termos dele são descontadas em relação ao tamanho médio dos documentos. O parâmetro `b` (normalmente 0.75) controla a força desse desconto.

Em forma de fórmula, para uma consulta Q e um documento D:

```text
score(D, Q) = Σ over terms q in Q of
              IDF(q) * ( f(q, D) * (k1 + 1) ) / ( f(q, D) + k1 * (1 - b + b * |D| / avgdl) )

f(q, D) = how many times q appears in D
|D|     = length of D in tokens
avgdl   = average document length in the corpus
```

A parte do IDF é o motivo de a busca por palavra-chave ser tão boa com identificadores: quanto mais raro o token, maior o impulso. É exatamente o contrário de como os embeddings tratam tokens raros.

## Mergulho na arquitetura

A arquitetura são dois retrievers rodando em paralelo sobre os mesmos chunks, uma etapa de fusão, um reranker opcional e, por fim, o LLM:

<div id="hybrid-search-slot"></div>

Os dois retrievers são baratos e independentes, então você roda os dois em paralelo. A pergunta interessante é a caixa do meio: como juntar duas listas ranqueadas que foram produzidas por funções de pontuação completamente diferentes?

### Por que somar os scores crus não funciona

A primeira ideia que todo mundo tem é "só soma os scores". O problema é o seguinte. Scores de BM25 não têm limite e dependem do corpus: um match forte pode dar 7.3 num índice e 23.8 em outro, e a faixa muda conforme você adiciona documentos. Similaridade de cosseno vive entre -1 e 1, e na maioria dos modelos de embedding modernos os resultados úteis se amontoam numa faixa estreita (digamos, tudo que é relevante fica entre 0.72 e 0.86). Somar 18.4 com 0.81 significa que, na prática, o retriever vetorial não tem voto nenhum.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Fácil: normaliza os dois pra 0-1 com min-max e depois soma. Resolvido, né?</span>
    </div>
  </div>
</div>

É melhor que nada, e alguns sistemas usam mistura de scores normalizados com sucesso, mas é frágil. O min-max depende do melhor e do pior score de cada lista específica, então um outlier estica todo o resto. Uma consulta em que o BM25 não acha nada realmente relevante ainda produz um "1.0" para o resultado menos pior. E as distribuições têm formatos diferentes: uma lista de BM25 costuma ter um vencedor destacado e uma cauda longa, enquanto scores de cosseno são achatados e agrupados. Depois da normalização, uma diferença minúscula de cosseno e um abismo no BM25 podem parecer iguais. Você acaba ajustando pesos por tipo de consulta, o que é sinal de que a abordagem está brigando com você.

### Reciprocal Rank Fusion: jogue fora os scores, fique com a ordem

O RRF, apresentado por Cormack, Clarke e Büttcher em 2009, contorna o problema inteiro ignorando os scores. Ele olha só para a posição de cada documento em cada lista:

```text
RRF(d) = Σ over retrievers r of  1 / (k + rank_r(d))

rank_r(d) = 1-based position of d in retriever r's list
k         = smoothing constant, 60 in the original paper
```

Um documento em 1º lugar no BM25 ganha 1/61 ≈ 0.0164 daquela lista. Em 10º, ganha 1/70 ≈ 0.0143. Um documento que não aparece numa lista simplesmente não ganha nada dela. Documentos que aparecem nas duas listas acumulam duas contribuições, então a concordância entre os retrievers é recompensada naturalmente.

A analogia que eu gosto é a de um festival de música com dois jurados que usam fichas de avaliação completamente diferentes. Um dá nota de 0 a 10, o outro de 0 a 1.000 e é muito pão-duro. Tirar a média das notas cruas não faz sentido. Mas perguntar a cada jurado "quais foram seus favoritos, em ordem?" e combinar essas ordens é justo, porque uma ordem significa a mesma coisa, não importa como o jurado pontua.

O que o `k` faz: ele controla o quanto as primeiras posições dominam. Com um `k` pequeno (digamos 1), o 1º lugar ganha 1/2 e o 2º ganha 1/3, uma diferença enorme, então o resultado combinado segue o retriever que estiver mais confiante. Com `k = 60`, a curva é suave: o 1º e o 5º lugar diferem só uns 6%, então um documento que está razoável nas duas listas vence um documento excelente numa lista e ausente da outra. Esse comportamento de consenso costuma ser o que você quer em RAG.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então 60 é um número mágico que eu nunca devo mexer?</span>
    </div>
  </div>
</div>

Não é mágico, é só um default bem testado que teve bom desempenho em vários datasets nos experimentos originais. É um ótimo ponto de partida e muitas vezes você nunca precisa mudar. Se a sua avaliação mostrar que os matches exatos continuam perdendo a votação, você tem duas alavancas melhores do que mexer no `k`: dar um peso para cada retriever (multiplicando a contribuição dele) ou ajustar quantos candidatos cada retriever contribui. Vamos ver as duas no código.

### Onde entra o reranker

O RRF te dá uma boa lista de candidatos, mas ele não sabe nada sobre a consulta além do que os dois retrievers viram. Um reranker cross-encoder lê a consulta e cada candidato juntos, numa única passada pelo modelo, e devolve um score de relevância. Essa leitura conjunta o deixa muito mais preciso que um bi-encoder (seu modelo de embedding, que codifica consulta e documento separadamente), e muito mais lento, porque ele não consegue pré-calcular nada. Por isso você roda ele só no top 20 a 50 da fusão, nunca no corpus inteiro.

| Etapa | O que enxerga | Ponto forte | Perfil de custo |
|---|---|---|---|
| BM25 | Tokens | Termos exatos, identificadores raros | Muito barato, índice invertido |
| Busca vetorial | Embeddings pré-calculados | Paráfrase, significado | Barato por consulta, índice ANN |
| RRF | Só posições | Fusão justa, sem calibração | Desprezível |
| Cross-encoder | Consulta e documento juntos | Relevância refinada | Caro, cresce com o número de candidatos |

## Implementação na prática

Vamos montar o pipeline inteiro em Python com `rank_bm25`, `sentence-transformers` e numpy. Ele roda em memória, o que é perfeito para entender e prototipar; depois mapeamos a mesma ideia para Postgres e Azure AI Search.

```bash title="terminal"
pip install rank-bm25 sentence-transformers numpy
```

### Tokenização primeiro (sério)

A linha mais importante de um setup de BM25 para conteúdo técnico é o tokenizador. Um `text.split()` ingênuo trata `ERR-4012.`, com o ponto final grudado, como um token diferente de `ERR-4012`. Um tokenizador que quebra em todo caractere não alfanumérico transforma `ERR-4012` em `err` e `4012`, que aí dão match com todo documento que tenha "err" ou o número 4012. A gente quer identificadores inteiros.

```python title="hybrid_search.py"
import re
from collections import defaultdict

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

# Mantém identificadores como "err-4012", "sku-88213-b" e "v3.11.2" como um único token
TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:[-_.][a-z0-9]+)*")


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


documents = [
    {"id": "kb-101", "text": "ERR-4012: checkout API rejects the cart when the session token expired."},
    {"id": "kb-102", "text": "Payment timeouts: how to retry declined card transactions safely."},
    {"id": "kb-103", "text": "ERR-4021: inventory service returns stale stock for SKU-88213-B."},
    {"id": "kb-104", "text": "Why was my payment refused? Common reasons a card gets declined."},
    {"id": "kb-105", "text": "Session management: refreshing expired tokens in the checkout flow."},
]
doc_ids = [doc["id"] for doc in documents]
doc_texts = [doc["text"] for doc in documents]
```

### Os dois retrievers

O BM25 trabalha com tokens; o retriever vetorial trabalha com embeddings normalizados, então a similaridade de cosseno vira só um produto escalar. Os dois devolvem uma lista ranqueada de ids de documentos, que é tudo de que o RRF precisa.

```python title="hybrid_search.py"
bm25 = BM25Okapi([tokenize(text) for text in doc_texts])

embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
doc_embeddings = embedder.encode(doc_texts, normalize_embeddings=True)


def bm25_search(query: str, top_k: int = 50) -> list[str]:
    scores = bm25.get_scores(tokenize(query))
    order = np.argsort(scores)[::-1][:top_k]
    # Descarta documentos com score zero: não compartilham nenhum termo com a consulta
    return [doc_ids[i] for i in order if scores[i] > 0]


def vector_search(query: str, top_k: int = 50) -> list[str]:
    query_embedding = embedder.encode(query, normalize_embeddings=True)
    similarities = doc_embeddings @ query_embedding  # cosseno, já que os dois estão normalizados
    order = np.argsort(similarities)[::-1][:top_k]
    return [doc_ids[i] for i in order]
```

Repare na assimetria: o BM25 pode legitimamente devolver menos resultados (sem termos em comum, sem match), enquanto a busca vetorial sempre devolve `top_k` vizinhos, relevantes ou não. Isso não é problema para o RRF, e é um dos motivos pelos quais ele se comporta bem: um retriever sem nada útil a dizer simplesmente contribui com menos votos.

### A função de fusão

Aqui está o coração do post. Ela recebe qualquer quantidade de listas ranqueadas, pesos opcionais por lista, e devolve os ids ordenados pelo score combinado.

```python title="hybrid_search.py"
def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
    weights: list[float] | None = None,
) -> list[tuple[str, float]]:
    if weights is None:
        weights = [1.0] * len(rankings)
    if len(weights) != len(rankings):
        raise ValueError("weights must have one entry per ranking")

    fused_scores: dict[str, float] = defaultdict(float)
    for ranking, weight in zip(rankings, weights):
        for rank, doc_id in enumerate(ranking, start=1):
            fused_scores[doc_id] += weight / (k + rank)

    return sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)
```

Umas quinze linhas, sem normalização de score, sem calibração, funciona com dois retrievers ou com cinco.

### Reranking e o pipeline completo

O cross-encoder lê pares (consulta, trecho) e devolve um score de relevância por par. A gente só passa para ele os candidatos da fusão.

```python title="hybrid_search.py"
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
text_by_id = dict(zip(doc_ids, doc_texts))


def hybrid_search(
    query: str,
    retriever_top_k: int = 50,
    rerank_top_n: int = 20,
    final_top_n: int = 5,
    use_reranker: bool = True,
) -> list[str]:
    keyword_ids = bm25_search(query, top_k=retriever_top_k)
    semantic_ids = vector_search(query, top_k=retriever_top_k)

    fused = reciprocal_rank_fusion([keyword_ids, semantic_ids], k=60)
    candidate_ids = [doc_id for doc_id, _ in fused[:rerank_top_n]]

    if not use_reranker:
        return candidate_ids[:final_top_n]

    pairs = [(query, text_by_id[doc_id]) for doc_id in candidate_ids]
    rerank_scores = reranker.predict(pairs)
    order = np.argsort(rerank_scores)[::-1]
    return [candidate_ids[i] for i in order[:final_top_n]]


if __name__ == "__main__":
    for query in ["what does ERR-4012 mean", "the bank rejected my purchase"]:
        print(query, "->", hybrid_search(query, final_top_n=3))
```

Rode e olhe cada lista separadamente antes da fusão. Na consulta com `ERR-4012`, o BM25 devolve exatamente um resultado, o `kb-101`, porque `err-4012` é um token raro e nenhum outro documento o contém. A lista vetorial também coloca o `kb-101` em primeiro neste corpus minúsculo, mas ela nunca volta vazia: preenche o ranking com os vizinhos mais próximos, relacionados ou não. A segunda consulta não tem nenhuma palavra em comum com o `kb-102` ("the bank rejected my purchase" contra "retry declined card transactions"), então o BM25 nunca o recupera, enquanto os embeddings o colocam em segundo. O RRF o mantém na lista de candidatos, em quarto, porque só um retriever votou nele; o cross-encoder então o leva para o top três final. Essa é a divisão de trabalho: a fusão decide o que sobrevive, o reranking decide a ordem.

<div class="callout tip" data-title="Dica">
  <p>Sempre registre em log os rankings individuais (<code>keyword_ids</code>, <code>semantic_ids</code>) ao lado do combinado, pelo menos em staging. Quando uma consulta dá errado, a primeira pergunta é "qual retriever deixou passar?", e você não consegue responder isso só com a lista combinada.</p>
</div>

### A mesma ideia no Postgres com pgvector

Se seus chunks já moram no Postgres, você não precisa de um motor de busca separado. O full text search te dá o lado de palavra-chave (repare que o `ts_rank_cd` não é exatamente BM25, mas é relevância baseada em ranking sobre um índice GIN invertido, que é o que o RRF precisa), e o pgvector te dá o lado vetorial. O RRF vira um `FULL OUTER JOIN` sobre as posições.

```sql title="hybrid_search.sql"
-- Setup único: a config 'simple' coloca em minúsculas mas não faz stemming, o que é mais amigável para códigos
ALTER TABLE documents
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX documents_search_tsv_idx ON documents USING GIN (search_tsv);
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);

-- $1 = texto da consulta, $2 = embedding da consulta
WITH keyword AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) AS rank
  FROM (
    SELECT id, ts_rank_cd(search_tsv, query) AS score
    FROM documents, websearch_to_tsquery('simple', $1) AS query
    WHERE search_tsv @@ query
    ORDER BY score DESC
    LIMIT 50
  ) AS kw
),
semantic AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY distance) AS rank
  FROM (
    SELECT id, embedding <=> $2 AS distance
    FROM documents
    ORDER BY embedding <=> $2
    LIMIT 50
  ) AS nn
)
SELECT
  COALESCE(keyword.id, semantic.id) AS id,
  COALESCE(1.0 / (60 + keyword.rank), 0.0)
    + COALESCE(1.0 / (60 + semantic.rank), 0.0) AS rrf_score
FROM keyword
FULL OUTER JOIN semantic ON keyword.id = semantic.id
ORDER BY rrf_score DESC
LIMIT 20;
```

As subconsultas internas com `ORDER BY ... LIMIT` fazem diferença: elas deixam o Postgres usar os índices HNSW e GIN e calcular as posições só sobre o top 50, em vez de ranquear a tabela inteira. O jeito como o Postgres tokeniza códigos com hífen depende do parser, então teste seus identificadores reais com `ts_debug('simple', 'ERR-4012')` antes de confiar.

### O Azure AI Search faz o RRF por você

O Azure AI Search executa uma consulta híbrida quando a requisição tem tanto `search_text` quanto uma consulta vetorial, e junta os dois conjuntos de resultados com RRF do lado do serviço. Você pode opcionalmente ligar o semantic ranker por cima, que faz o papel do reranker.

```python title="azure_hybrid_search.py"
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

from hybrid_search import embedder  # mesmo modelo usado para indexar o contentVector

search_client = SearchClient(
    endpoint="https://<your-service>.search.windows.net",
    index_name="kb-articles",
    credential=AzureKeyCredential("<your-query-key>"),
)

query = "what does ERR-4012 mean"
query_embedding = embedder.encode(query, normalize_embeddings=True).tolist()

results = search_client.search(
    search_text=query,  # lado BM25
    vector_queries=[
        VectorizedQuery(vector=query_embedding, k_nearest_neighbors=50, fields="contentVector")
    ],
    top=20,  # combinado por RRF dentro do serviço
)

for result in results:
    print(result["id"], result["@search.score"])
```

Lembre que o embedding da consulta precisa vir do mesmo modelo que você usou para indexar o `contentVector`. Misturar modelos é um bug silencioso e doloroso: tudo devolve resultado, e nada está bem certo.

## Checagem de realidade em produção

O código acima é a parte fácil. Aqui está o que realmente decide se a busca híbrida ajuda ou só adiciona peças móveis.

### Ajuste fino: top-k, pesos e k

Comece com os defaults e mude uma coisa de cada vez, sempre contra um conjunto de avaliação:

- **Top-k por retriever**: 50 para cada um é um começo razoável. Pequeno demais (5 ou 10) e o RRF fica com pouco material; a graça toda é pegar o documento que um dos retrievers colocou em 30º. Grande demais e você basicamente adiciona ruído que custa tempo de reranker.
- **Pesos**: se seus usuários digitam muitos identificadores, um peso como `[1.5, 1.0]` para BM25 versus vetores empurra os matches exatos para cima sem calar a semântica. Alguns times vão além e detectam tokens com cara de identificador na consulta (uma regex como a do `TOKEN_PATTERN` mais uma checagem de dígito) e aumentam o peso do BM25 só nessas consultas.
- **k**: deixe em 60, a não ser que a avaliação diga o contrário. Valores menores deixam a fusão mais "o vencedor leva tudo".

### Latência e custo do reranking

Um cross-encoder pontua cada par de candidato, então o custo cresce linearmente com a quantidade de candidatos que você manda. Um modelo pequeno como o MiniLM acima é rápido em GPU e tolerável em CPU para umas duas dezenas de candidatos; rerankers maiores são perceptivelmente mais precisos e perceptivelmente mais lentos. APIs de rerank hospedadas tiram a infraestrutura das suas costas, mas adicionam um salto de rede e uma conta por chamada.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o reranker é a peça mais inteligente, por que não pular a fusão e só reranquear o top 500 de cada retriever?</span>
    </div>
  </div>
</div>

Porque você estaria pagando 1.000 passadas caras pelo modelo a cada pergunta do usuário para resgatar documentos em 400º lugar, que quase nunca importam. Cada etapa existe para encolher o conjunto de candidatos de forma barata antes da próxima, que é mais cara: os retrievers vão de milhões para uns cem, o RRF de cem para uns vinte, o reranker de vinte para o punhado que o LLM realmente lê. Meça o quanto o reranker melhora suas métricas; se o ganho for pequeno para os seus dados, remover ele é uma otimização de latência perfeitamente válida.

### Avalie com as consultas que doem

Não avalie busca híbrida só com perguntas genéricas; a busca vetorial já vai bem nelas e você vai concluir que o híbrido não agrega nada. Monte um conjunto rotulado que inclua de propósito consultas com identificadores: códigos de erro, SKUs, números de ticket, strings de versão, nomes de pessoas. Depois compare o recall@k do BM25 sozinho, dos vetores sozinhos, do RRF e do RRF com reranker.

```python title="evaluate.py"
import numpy as np

from hybrid_search import bm25_search, hybrid_search, vector_search

# Cada consulta aponta para os ids dos chunks que realmente respondem a ela
eval_set = {
    "what does ERR-4012 mean": {"kb-101"},
    "stock wrong for SKU-88213-B": {"kb-103"},
    "my card payment was refused": {"kb-104", "kb-102"},
}


def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant)


strategies = {
    "bm25": lambda q: bm25_search(q),
    "vector": lambda q: vector_search(q),
    "rrf": lambda q: hybrid_search(q, final_top_n=10, use_reranker=False),
    "rrf+rerank": lambda q: hybrid_search(q, final_top_n=10),
}

for name, search in strategies.items():
    recalls = [recall_at_k(search(q), relevant, k=3) for q, relevant in eval_set.items()]
    print(f"{name:>10}  recall@3 = {np.mean(recalls):.2f}")
```

Fatie os resultados por tipo de consulta. O padrão típico é que os vetores ganham nas consultas de paráfrase, o BM25 ganha nas consultas com identificador e o RRF fica perto do melhor dos dois em cada fatia. Se o RRF estiver claramente pior que um dos retrievers numa fatia, olhe para os pesos ou para a qualidade dos candidatos do outro retriever, não para o `k`.

<div class="callout warning" data-title="Atenção">
  <p>Recall é medido no retrieval, não na resposta final. Um chunk pode ser recuperado e mesmo assim ser ignorado ou mal interpretado pelo LLM. Acompanhe as métricas de retrieval (<code>recall@k</code>, MRR) e a qualidade da resposta separadamente, ou você não vai saber qual camada consertar.</p>
</div>

### Modos de falha para ficar de olho

- **Tokenização de códigos**: o analyzer do seu motor de busca pode quebrar `ERR-4012` no hífen ou picotar `v3.11.2` em pedaços. Teste seus identificadores reais contra o analyzer de verdade. No Elasticsearch, OpenSearch ou Azure AI Search você pode precisar de um analyzer customizado ou de um campo keyword separado para códigos.
- **Stemming**: ótimo para prosa ("correndo" casa com "correr"), prejudicial para identificadores e nomes de produto. Um padrão comum são dois campos: um com stemming para o texto e outro sem stemming para os códigos, ambos consultados no lado de palavra-chave.
- **Texto multilíngue**: o BM25 depende do idioma (stop words, stemmers, palavras compostas), enquanto modelos de embedding multilíngues lidam com similaridade entre idiomas. Para um corpus que mistura inglês e português, use analyzers por idioma ou um neutro, e espere que o lado vetorial carregue as consultas entre idiomas.
- **Índices desatualizados**: dois retrievers significam dois índices que precisam ficar sincronizados. Se um documento é atualizado no vector store mas não no índice de palavra-chave, o RRF vai alegremente combinar uma versão antiga com uma nova. Atualize os dois a partir do mesmo pipeline de ingestão, com a mesma chave de chunk, e monitore a contagem de documentos de cada lado.
- **Ids de chunk diferentes**: o RRF junta por id. Se um índice usa `doc-12#3` e o outro `doc-12_chunk3`, nada nunca se sobrepõe e você perde o benefício do consenso sem perceber.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então com busca híbrida meu RAG está resolvido e posso parar de me preocupar com retrieval?</span>
    </div>
  </div>
</div>

Significa que você parou de perder as vitórias fáceis. Estratégia de chunking, filtros de metadados, reescrita de consulta e atualização dos dados continuam importando, e eles vão aparecer na sua avaliação assim que o problema dos identificadores sumir. A boa notícia é que busca híbrida com RRF é uma das melhorias mais baratas da caixa de ferramentas de RAG: um índice a mais, uma função curta, e uma classe inteira de bugs do tipo "a resposta estava bem ali!" desaparece. Monte o conjunto de avaliação, rode as quatro estratégias e deixe os números dizerem se o reranker paga a latência que custa.
