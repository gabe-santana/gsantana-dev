---
title: "Seu banco vetorial está lento por causa destas 5 configurações"
description: "Ajuste HNSW, filtros e precisão dos vetores medindo recall e latência, não pelos valores padrão."
date: 2026-03-10
tags: [RAG, Vector Search, HNSW, Python, Performance]
tldr:
  - "Meça o recall@k contra a busca exata por força bruta numa amostra dos seus próprios dados antes de mexer em qualquer configuração do índice."
  - "Ajuste o ef_search por consulta para o recall e a latency que você precisa, e defina M e ef_construction uma vez no build."
  - "Reduza memória com quantização e menos dimensões, e nunca pós-filtre um top-k aproximado sem conferir quantos resultados sobram."
---

Um protótipo típico de RAG roda em cima de alguns milhares de chunks e responde em milissegundos. Aí chega o corpus de verdade: milhões de chunks, vários tenants, filtros de metadados em toda requisição. A latency vai subindo, o nó do banco precisa de mais RAM do que qualquer um orçou, e a qualidade das respostas cai um pouco sem um único erro nos logs.

Na maioria das vezes o culpado é um punhado de configurações deixadas no default ou copiadas de um tutorial feito para outro dataset. Busca vetorial é aproximada por design, então velocidade e qualidade são sempre um trade-off. A pergunta é se você escolhe esse trade-off de propósito ou descobre ele em produção. Vamos ver as cinco configurações que decidem isso e montar um benchmark que mostra a curva na sua própria máquina.

## O problema e o contexto

O retrieval no RAG se resume a uma operação: dado um vetor de consulta, encontrar os k vetores armazenados mais parecidos com ele. O jeito exato é força bruta. Compare a consulta com todos os vetores, ordene, pegue os k primeiros. É simples, sempre correto e escala linearmente: dez vezes mais vetores, dez vezes mais trabalho, em toda consulta.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que não usar só busca exata? Produto escalar é barato e computador é rápido.</span>
    </div>
  </div>
</div>

Para um corpus pequeno, use mesmo: busca exata sobre dezenas de milhares de vetores é perfeitamente razoável e não precisa de tuning nenhum. O problema é a aritmética em escala. Um milhão de vetores com 1536 dimensões dá cerca de 1,5 bilhão de multiplicações e somas por consulta, lendo uns 6 GB de memória a cada vez. Coloque usuários concorrentes e a CPU e a banda de memória acabam rápido. Índices de approximate nearest neighbor (ANN) pulam quase todas essas comparações, e o preço é que às vezes eles perdem um vizinho verdadeiro.

Esse preço tem nome: **recall@k**, a fração do top k verdadeiro (da busca exata) que o índice realmente devolveu. Um recall@10 de 0,95 significa que um resultado em cada vinte, em média, não é o que a busca exata teria devolvido. No RAG, um vizinho perdido é um chunk que o modelo nunca vê, possivelmente o que tinha a resposta.

Então toda decisão neste post é um movimento ao longo de uma curva: recall num eixo, latency (e memória) no outro.

## Mergulho na arquitetura

A maioria dos bancos vetoriais hoje usa HNSW (Hierarchical Navigable Small World) por padrão, incluindo pgvector, Qdrant, Weaviate, Milvus e serviços gerenciados de busca. As cinco configurações abaixo valem para todos eles, mesmo quando o botão tem outro nome.

### Como o HNSW funciona, intuitivamente

O HNSW monta um grafo em que cada vetor é um nó ligado a alguns dos seus vizinhos próximos. Em cima dessa camada base ele adiciona camadas mais esparsas, cada uma com um subconjunto aleatório dos nós, como faixas expressas numa rodovia.

```text
 Layer 2   A ─────────────────────────── F            few nodes, long jumps
           │                              │
 Layer 1   A ────── C ──────── E ──────── F ─── H     more nodes, medium jumps
           │        │          │          │     │
 Layer 0   A ─ B ─ C ─ D ─ E ─ F ─ G ─ H ─ I ─ J      every node, short links

 Search: enter at the top, hop greedily toward the query,
         drop a layer, repeat, then explore a candidate list on layer 0.
```

A busca entra pela camada do topo e caminha de forma gulosa em direção à consulta até nenhum vizinho estar mais perto, depois desce uma camada e repete com saltos menores. Na camada de baixo ela mantém uma lista dos melhores candidatos encontrados até ali e continua expandindo essa lista. O tamanho dela é o coração do trade-off.

### Configuração 1: M e ef_construction (o formato do grafo)

**M** é o número de ligações que cada nó mantém (a camada de baixo normalmente permite o dobro). Mais ligações significam mais caminhos até os vizinhos verdadeiros, então a caminhada gulosa empaca menos e o recall sobe para o mesmo esforço de consulta. Os custos são memória, inserts mais lentos e um build mais lento.

**ef_construction** é o tamanho da lista de candidatos usada para escolher os vizinhos de cada nó novo. Valores maiores geram um grafo melhor ao custo de tempo de build, sem mudar a memória.

Os dois são fixados no build, e mudar qualquer um significa reconstruir o índice. Os defaults comuns ficam por volta de M = 16 e ef_construction entre 64 e 200, um ponto de partida sensato para a maioria das cargas de embeddings de texto.

### Configuração 2: ef_search (o esforço por consulta)

**ef_search** (chamado de `ef` no hnswlib e de `hnsw.ef_search` no pgvector) é o tamanho da lista de candidatos durante a consulta. Ele precisa ser pelo menos k. Valores pequenos são rápidos e perdem vizinhos; valores grandes exploram mais o grafo e se aproximam do resultado exato. Diferente do M, dá para mudar a qualquer momento sem rebuild, e em muitos engines por consulta ou por sessão.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então eu coloco ef_search em 1000 e M em 64, tenho recall perfeito e nunca mais penso nisso?</span>
    </div>
  </div>
</div>

Você teria um recall excelente e pagaria por ele em toda consulta, além de um índice maior e mais lento. A curva de recall achata rápido: sair de um ef_search baixo para um moderado compra um salto grande de recall, sair de alto para muito alto não compra quase nada e continua somando latency. Encontre o joelho dessa curva para os seus dados e escolha a configuração mais barata que atinge a sua meta de recall. Um M maior desloca a curva inteira para cima; se isso vale a memória extra é exatamente o que o benchmark abaixo responde.

### Configuração 3: precisão dos vetores (quantização)

Por padrão, cada dimensão é um float de 32 bits. Isso costuma ser mais precisão do que o ranking por similaridade precisa. A conta de memória para 1 milhão de vetores com 1536 dimensões:

| Formato | Bytes por dimensão | 1M x 1536 | Impacto típico no recall |
|---|---|---|---|
| float32 | 4 | 1M x 1536 x 4 = 6.144.000.000 bytes (cerca de 6,1 GB) | Referência |
| float16 | 2 | cerca de 3,1 GB | Normalmente desprezível |
| int8 (escalar) | 1 | cerca de 1,5 GB | Pequeno, recuperável com rescoring |
| binário (1 bit) | 1/8 | 1M x 1536 / 8 = cerca de 192 MB | Grande, exige rescoring e muitas dimensões |

O grafo vem por cima. Com M = 16, a camada de baixo guarda até 32 ids de vizinhos por nó: 32 x 4 bytes = 128 bytes por vetor, cerca de 128 MB por milhão, mais um pouco para as camadas de cima. Com 1536 dimensões os vetores dominam, então a precisão é a maior alavanca de memória.

O truque padrão para recuperar qualidade é o **rescoring**: busque mais candidatos do que precisa usando os vetores comprimidos e depois reordene essa lista curta com os vetores em precisão total, guardados num armazenamento mais barato. Quanto mais agressiva a compressão, maior a lista curta.

### Configuração 4: estratégia de filtro

Consultas reais têm filtros: tenant, idioma, tipo de documento, grupos de acesso. O jeito como o engine combina esses filtros com a busca ANN importa demais.

- **Pós-filtro:** pegue o top k aproximado e depois descarte as linhas que não passam no filtro. Simples, e quebrado para filtros seletivos: se só 1% dos vetores casa, o top 10 normalmente tem zero ou um deles.
- **Pré-filtro:** restrinja os candidatos primeiro e depois busque. Correto, mas pular nós que não casam durante a caminhada no grafo pode derrubar o recall em filtros muito seletivos, e alguns engines caem para força bruta sobre as linhas que casam (o que é ok quando esse conjunto é pequeno).
- **Scans iterativos:** continue caminhando no grafo até encontrar k resultados filtrados ou bater um limite.
- **Particionamento:** dê a cada tenant grande o seu próprio índice, coleção ou partição. O filtro desaparece, ao custo de mais objetos para gerenciar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Meu filtro é só WHERE tenant_id = 42. O banco cuida disso para mim, né?</span>
    </div>
  </div>
</div>

Ele cuida do jeito que foi projetado para cuidar, e isso pode ser pós-filtro. No pgvector, um scan do índice HNSW devolve até ef_search candidatos e o WHERE é aplicado depois. Um tenant pequeno pode receber dois resultados quando pediu dez, e nenhum erro avisa. Saiba qual estratégia o seu engine usa para o formato da sua consulta.

### Configuração 5: dimensões do embedding

Cada dimensão custa memória e processamento em toda comparação. Um modelo de 3072 dimensões precisa do dobro da RAM de um de 1536 e do quádruplo de um de 768. Dois caminhos:

- **Modelos menores.** Muitos modelos compactos com 384 a 1024 dimensões fazem retrieval muito bem em texto de domínio. Teste com as suas próprias consultas, não só com leaderboards.
- **Embeddings truncáveis.** Alguns modelos são treinados para que as primeiras N dimensões funcionem sozinhas como embedding (Matryoshka representation learning), e várias APIs expõem isso como um parâmetro de dimensões. Truncar de 1536 para 512 corta dois terços da memória, normalmente com uma perda modesta de qualidade. Renormalize depois de truncar se usar cosseno ou produto escalar.

Dimensões são a configuração mais cara de mudar depois, porque isso significa gerar embeddings de todo o corpus de novo. Decida cedo, com medições.

## Implementação na prática

O benchmark usa só `hnswlib` e `numpy` (`pip install hnswlib numpy`). Ele gera vetores agrupados com seed fixa (embeddings reais formam aglomerados, não são uniformes), calcula o ground truth por força bruta e depois mede o recall@10 e a latency média por consulta individual para vários valores de ef_search e dois valores de M.

<div class="callout warning" data-title="Atenção">
  <p>O <code>hnswlib</code> é publicado no PyPI só como código-fonte, então o <code>pip</code> compila o pacote e precisa de um compilador C++: <code>build-essential</code> no Linux, as Xcode Command Line Tools no macOS e o Visual Studio Build Tools ("Desktop development with C++") no Windows. Sem ele a instalação falha; rodar o benchmark dentro de um container Linux é o caminho mais rápido.</p>
</div>

```python title="benchmark.py"
import time

import hnswlib
import numpy as np

DIM = 128
N_VECTORS = 50_000
N_QUERIES = 200
K = 10
SEED = 42


def make_clustered_vectors(n: int, dim: int, n_clusters: int, rng: np.random.Generator) -> np.ndarray:
    # Embeddings reais formam aglomerados (assuntos, idiomas, templates), então agrupe os dados
    centers = rng.normal(size=(n_clusters, dim))
    labels = rng.integers(0, n_clusters, size=n)
    vectors = centers[labels] + rng.normal(scale=1.5, size=(n, dim))
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)  # norma unitária, como a maioria das APIs de embedding
    return vectors.astype(np.float32)


def exact_top_k(data: np.ndarray, queries: np.ndarray, k: int) -> np.ndarray:
    # Ground truth por força bruta: em vetores unitários, similaridade de cosseno é só um produto escalar
    scores = queries @ data.T
    top = np.argpartition(-scores, k, axis=1)[:, :k]
    order = np.argsort(-np.take_along_axis(scores, top, axis=1), axis=1)
    return np.take_along_axis(top, order, axis=1)


def recall_at_k(found: np.ndarray, truth: np.ndarray) -> float:
    hits = sum(len(set(f) & set(t)) for f, t in zip(found, truth))
    return hits / truth.size


def build_index(data: np.ndarray, m: int, ef_construction: int) -> tuple[hnswlib.Index, float]:
    index = hnswlib.Index(space="cosine", dim=data.shape[1])
    index.init_index(max_elements=len(data), ef_construction=ef_construction, M=m, random_seed=SEED)
    start = time.perf_counter()
    index.add_items(data, np.arange(len(data)), num_threads=1)  # uma thread deixa o build reproduzível
    return index, time.perf_counter() - start


def run_queries(index: hnswlib.Index, queries: np.ndarray, ef_search: int) -> tuple[np.ndarray, float]:
    index.set_ef(ef_search)  # ef_search precisa ser >= K
    labels = []
    start = time.perf_counter()
    for query in queries:  # uma consulta por vez, como uma requisição de API
        found, _ = index.knn_query(query, k=K, num_threads=1)
        labels.append(found[0])
    avg_ms = (time.perf_counter() - start) / len(queries) * 1000
    return np.array(labels), avg_ms


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]

    start = time.perf_counter()
    truth = exact_top_k(data, queries, K)
    exact_ms = (time.perf_counter() - start) / len(queries) * 1000
    print(f"exact search (numpy, batched): {exact_ms:.3f} ms/query\n")

    for m in (8, 32):
        index, build_s = build_index(data, m=m, ef_construction=100)
        print(f"M={m:<3} ef_construction=100  build {build_s:.1f}s")
        print(f"  {'ef_search':>9}  {'recall@10':>9}  {'avg latency':>11}")
        for ef_search in (10, 20, 50, 100, 200, 400):
            found, avg_ms = run_queries(index, queries, ef_search)
            print(f"  {ef_search:>9}  {recall_at_k(found, truth):>9.3f}  {avg_ms:>8.3f} ms")
        print()


if __name__ == "__main__":
    main()
```

Leia as duas tabelas lado a lado. Com M = 8, o recall no menor ef_search é ruim, sobe forte e depois achata perto de 1,0 enquanto a latency continua subindo. Com M = 32, a curva inteira fica mais alta e atinge o mesmo recall com um ef_search bem menor, enquanto o build demora mais. Nessa escala de brinquedo as latências são minúsculas e ruidosas, então foque na tendência e rode mais de uma vez. A distância entre busca exata e aproximada cresce muito conforme o N aumenta; aumente o `N_VECTORS` se tiver RAM.

Agora, precisão. Este script compara quanta qualidade de ranking sobrevive em cada formato:

```python title="quantization.py"
import numpy as np

from benchmark import DIM, K, N_QUERIES, N_VECTORS, SEED, exact_top_k, make_clustered_vectors, recall_at_k


def top_k(scores: np.ndarray, k: int) -> np.ndarray:
    return np.argsort(-scores, axis=1)[:, :k]


def rescore(candidates: np.ndarray, data: np.ndarray, queries: np.ndarray) -> np.ndarray:
    # Reordena uma lista curta barata com os vetores float32 completos
    return np.array([cand[np.argsort(-(data[cand] @ q))[:K]] for cand, q in zip(candidates, queries)])


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]
    truth = exact_top_k(data, queries, K)

    # float16: metade da memória, erro de arredondamento minúsculo
    f16 = top_k(queries.astype(np.float16) @ data.astype(np.float16).T, K)

    # int8: um quarto da memória. Os vetores armazenados são quantizados, a consulta continua float32
    scale = np.abs(data).max(axis=0) / 127
    stored_int8 = np.round(data / scale).astype(np.int8)
    i8 = top_k(queries @ (stored_int8.astype(np.float32) * scale).T, K)

    # binário: 1 bit por dimensão (o sinal), 1/32 da memória
    bits_data = np.where(data > 0, 1, -1).astype(np.int32)
    bits_queries = np.where(queries > 0, 1, -1).astype(np.int32)
    binary_scores = bits_queries @ bits_data.T
    binary = top_k(binary_scores, K)

    print(f"{'format':<24} {'bytes/vector':>12} {'recall@10':>10}")
    rows = [
        ("float32 (exact)", DIM * 4, truth),
        ("float16", DIM * 2, f16),
        ("int8 scalar", DIM, i8),
        ("binary", DIM // 8, binary),
    ]
    for oversample in (10, 50):
        shortlist = top_k(binary_scores, K * oversample)
        rows.append((f"binary + rescore x{oversample}", DIM // 8, rescore(shortlist, data, queries)))
    for name, size, found in rows:
        print(f"{name:<24} {size:>12} {recall_at_k(found, truth):>10.3f}")


if __name__ == "__main__":
    main()
```

Espere que o float16 fique quase indistinguível do float32 e que o int8 perca um pouco. O binário sozinho vai parecer péssimo, e isso é uma lição, não um bug: 128 bits é grosseiro demais para ordenar esses vetores, e uma lista curta maior no rescoring recupera boa parte da perda. O binário costuma ser aplicado em embeddings com muitas dimensões (1024 para cima) e oversampling generoso, e o rescoring ainda precisa dos vetores float32 em algum lugar, só que fora do índice quente.

Por fim, a armadilha do filtro, com tenants desbalanceados (um deles com cerca de 1% das linhas):

```python title="filtering.py"
import numpy as np

from benchmark import DIM, K, N_QUERIES, N_VECTORS, SEED, build_index, make_clustered_vectors


def main() -> None:
    rng = np.random.default_rng(SEED)
    all_vectors = make_clustered_vectors(N_VECTORS + N_QUERIES, DIM, n_clusters=50, rng=rng)
    data, queries = all_vectors[:N_VECTORS], all_vectors[N_VECTORS:]

    # Tenants desbalanceados: um cliente grande, alguns médios e um pequeno (cerca de 1% das linhas)
    tenants = rng.choice(["big", "medium-a", "medium-b", "small"], size=N_VECTORS, p=[0.7, 0.15, 0.14, 0.01])

    index, _ = build_index(data, m=16, ef_construction=100)
    index.set_ef(400)  # ef_search precisa ser >= o maior k que vamos pedir

    for tenant in ("big", "small"):
        allowed = np.flatnonzero(tenants == tenant)
        print(f"tenant={tenant} ({len(allowed)} vectors)")
        for fetch_k in (K, 100, 400):
            labels, _ = index.knn_query(queries, k=fetch_k)
            # Pós-filtro: busca em tudo e depois descarta as linhas de outros tenants
            kept = [[label for label in row if tenants[label] == tenant][:K] for row in labels]
            avg_returned = np.mean([len(row) for row in kept])
            short = np.mean([len(row) < K for row in kept]) * 100
            print(f"  fetch k={fetch_k:<4} avg results {avg_returned:5.1f} of {K}, {short:5.1f}% of queries short")

        # Particionamento: um índice pequeno por tenant sempre devolve K (se o tenant tiver K linhas)
        tenant_index, _ = build_index(data[allowed], m=16, ef_construction=100)
        tenant_index.set_ef(100)
        labels, _ = tenant_index.knn_query(queries, k=K)
        print(f"  per-tenant index  avg results {labels.shape[1]:5.1f} of {K}\n")


if __name__ == "__main__":
    main()
```

Para o tenant grande, buscar exatamente k já perde resultados, e o oversampling resolve isso barato. Para o tenant pequeno, mesmo um oversampling grande deixa a maioria das consultas incompleta, enquanto o índice por tenant devolve um top 10 cheio todas as vezes. Esse é o argumento para scans iterativos ou particionamento quando os filtros são seletivos.

Os mesmos botões existem no pgvector. A operator class do índice precisa bater com o operador da consulta (`vector_cosine_ops` com `<=>`), senão o índice não é usado:

```sql title="index.sql (excerpt)"
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
    id bigserial PRIMARY KEY,
    tenant_id int NOT NULL,
    content text NOT NULL,
    embedding vector(1536) NOT NULL
);

-- Configurações de build: M e ef_construction. Mais memória acelera o build.
SET maintenance_work_mem = '4GB';
CREATE INDEX chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Configuração de consulta: ef_search (default 40), restrita a esta transação
BEGIN;
SET LOCAL hnsw.ef_search = 100;
SELECT id, content
FROM chunks
WHERE tenant_id = 42
ORDER BY embedding <=> $1
LIMIT 10;
COMMIT;
```

Essa consulta tem exatamente o comportamento de pós-filtro descrito antes. Versões mais novas do pgvector adicionam opções que ajudam, como index scans iterativos e um tipo `halfvec` de meia precisão. Disponibilidade e sintaxe dependem da versão que você roda, então confira as release notes dela antes de contar com essas opções.

<div class="callout tip" data-title="Dica">
  <p>Como o <code>ef_search</code> é uma configuração de consulta, dá para rodar níveis de esforço diferentes para cargas diferentes no mesmo índice: um valor mais baixo para buscas estilo autocomplete, um mais alto para o caminho do RAG, em que um chunk perdido custa uma resposta. No pgvector, o <code>SET LOCAL</code> dentro de uma transação impede que a mudança vaze para outras consultas numa conexão de pool.</p>
</div>

## Checagem de realidade em produção

**Meça nos seus próprios dados.** Vetores sintéticos mostram o formato da curva, não os seus números. Exporte uma amostra de embeddings reais e algumas centenas de consultas reais, calcule o top k exato offline e varra ef_search e M contra ele. O recall@k mede o índice, não o pipeline inteiro; combine com checagens de qualidade de retrieval como as de [Chunking Enterprise Documents Without Losing Meaning](/pt-br/blog/chunking-enterprise-documents/).

**Planeje tempo de build e memória de rebuild.** Builds de HNSW pesam na CPU e ficam bem mais lentos quando o grafo não cabe mais na memória de build, e reconstruir enquanto o índice antigo atende tráfego pode exigir memória para os dois.

<div class="callout warning" data-title="Atenção">
  <p>Se o nó foi dimensionado para exatamente uma cópia do índice, um rebuild (para mudar <code>M</code>, <code>ef_construction</code>, dimensões ou quantização) pode jogá-lo em swap ou estourar a memória no meio do horário comercial. Dimensione para duas cópias, ou faça o build num nó separado e depois troque.</p>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Saiu um modelo de embedding novo que pontua melhor no leaderboard. Posso só trocar na sexta-feira?</span>
    </div>
  </div>
</div>

Só se você gerar embeddings de tudo de novo antes. Vetores de modelos diferentes vivem em espaços diferentes, então consultas do modelo novo contra documentos do modelo antigo geram rankings sem sentido, em silêncio. Trocar de modelo significa gerar embeddings de todo o corpus de novo (custo de API ou horas de GPU), construir um índice novo, validar a qualidade e fazer a troca mantendo o índice antigo para rollback. Guarde o nome e a versão do modelo ao lado de cada vetor.

**Fique de olho nos vizinhos barulhentos.** Em clusters compartilhados, a ingestão em massa de um tenant ou um rebuild competem com as consultas de todo mundo, e a latency p99 sofre primeiro. Separe ingestão de atendimento, limite as cargas em massa e dê aos tenants muito grandes a sua própria partição.

**Monitore o drift de recall.** Inserts, deletes e updates mudam o grafo, os dados mudam, e alguém uma hora baixa o ef_search para resolver um alerta de latency. Rode um job agendado que amostra algumas centenas de consultas recentes, calcula o top k exato sobre os dados atuais (ou um shard representativo) e registra o recall@k ao lado da latency. Alerte sobre recall do mesmo jeito que alerta sobre latency.

Um checklist rápido antes de culpar o banco:

- Existe uma baseline de recall@k contra a busca exata, medida em dados reais?
- O ef_search foi escolhido a partir de uma curva medida, ou ficou no default?
- M e ef_construction foram escolhidos para este dataset, e a memória de rebuild está no orçamento?
- A precisão (float32, float16, int8, binário) se justifica pela pressão de memória e pelo recall medido?
- As consultas filtradas devolvem k resultados para os seus menores tenants?
- As dimensões são as menores que a sua meta de qualidade permite?

Nenhuma dessas cinco configurações é exótica, e cada uma é uma troca consciente entre recall, latency e memória. Coloque um benchmark de pé, encontre o joelho da sua curva e ajuste de propósito, em vez de esperar a produção escolher o trade-off por você.
