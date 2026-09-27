import { defineDiagram, e, n, type T } from "@/lib/diagrams/define";
import type { GridEdge, GridNode, GridNote } from "@/lib/diagrams/grid";

// content/posts/*/chunking-enterprise-documents.md
export const chunkingPipeline = defineDiagram((t) => {
  const node = {
    docs: (col: number, row: number) => n("docs", col, row, "muted", "PDF · DOCX · HTML", t("source files", "arquivos de origem")),
    extract: (col: number, row: number) =>
      n("extract", col, row, "blue", t("Layout-aware extraction", "Extração com layout"), [
        t("OCR, reading order,", "OCR, ordem de leitura,"),
        t("tables", "tabelas"),
      ]),
    parser: (col: number, row: number) => n("parser", col, row, "blue", t("Block parser", "Parser de blocos"), t("Markdown in", "recebe Markdown")),
    tree: (col: number, row: number) => n("tree", col, row, "violet", t("Section tree", "Árvore de seções"), t("heading paths", "caminhos de títulos")),
    children: (col: number, row: number) =>
      n("children", col, row, "accent", t("Child chunks", "Chunks filhos"), [t("breadcrumb + blocks", "breadcrumb + blocos"), "metadata + parent_id"]),
    parents: (col: number, row: number) =>
      n("parents", col, row, "amber", t("Parent sections", "Seções pai"), [t("full text by id", "texto completo por id"), "document store"]),
    query: (col: number, row: number) => n("query", col, row, "muted", t("Query", "Consulta")),
    search: (col: number, row: number) => n("search", col, row, "accent", t("Search children", "Busca nos filhos")),
    hits: (col: number, row: number) => n("hits", col, row, "accent", t("Top-k child hits", "Top-k de filhos")),
    dedupe: (col: number, row: number) => n("dedupe", col, row, "amber", t("Dedupe parent ids", "Dedup de parent ids")),
  };
  const embed = t("embed + index", "embedding + índice");
  const fetch = t("fetch by parent_id", "busca por parent_id");
  return {
    title: "CHUNKING",
    heading: t("INDEX CHILDREN, ANSWER WITH PARENTS", "INDEXA FILHOS, RESPONDE COM PAIS"),
    accessible: t(
      "PDF, DOCX and HTML files go through layout-aware extraction (its own problem: OCR, reading order, tables), which produces Markdown for a block parser. The parser builds a section tree with heading paths. The tree yields child chunks (breadcrumb plus blocks, metadata and a parent_id), which are embedded and indexed, and parent sections with their full text keyed by id in a document store. At query time the search runs over children, the top-k child hits are deduplicated by parent id, and the parent sections are fetched by parent_id.",
      "Arquivos PDF, DOCX e HTML passam por uma extração com layout (um problema à parte: OCR, ordem de leitura, tabelas), que gera Markdown para um parser de blocos. O parser monta uma árvore de seções com os caminhos de títulos. A árvore gera chunks filhos (breadcrumb mais blocos, metadados e um parent_id), que viram embeddings e vão para o índice, e seções pai com o texto completo por id num document store. Na consulta, a busca roda nos filhos, o top-k de filhos é deduplicado por parent id e as seções pai são buscadas por parent_id."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      nodes: [
        node.docs(0, 0), node.extract(1, 0), node.parser(2, 0), node.tree(3, 0),
        node.children(1, 1), node.parents(3, 1),
        node.query(0, 2), node.search(1, 2), node.hits(2, 2), node.dedupe(3, 2),
      ],
      edges: [
        e("docs", "extract", { tone: "blue" }),
        e("extract", "parser", { tone: "blue" }),
        e("parser", "tree", { tone: "violet" }),
        e("tree", "children", { tone: "accent" }),
        e("tree", "parents", { tone: "amber" }),
        e("children", "search", { tone: "accent", label: embed }),
        e("query", "search", { tone: "accent" }),
        e("search", "hits", { tone: "accent" }),
        e("hits", "dedupe", { tone: "amber" }),
        e("dedupe", "parents", { tone: "amber", label: fetch }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 5,
      nodes: [
        node.docs(0, 0), node.extract(1, 0),
        node.tree(0, 1), node.parser(1, 1),
        node.children(0, 2), node.parents(1, 2),
        node.search(0, 3), node.query(1, 3),
        node.hits(0, 4), node.dedupe(1, 4),
      ],
      edges: [
        e("docs", "extract", { tone: "blue" }),
        e("extract", "parser", { tone: "blue" }),
        e("parser", "tree", { tone: "violet" }),
        e("tree", "children", { tone: "accent", fromShift: -30, toShift: -30 }),
        e("tree", "parents", { tone: "amber", fromShift: 30 }),
        e("children", "search", { tone: "accent", fromShift: -30, toShift: -30, label: embed }),
        e("query", "search", { tone: "accent" }),
        e("search", "hits", { tone: "accent" }),
        e("hits", "dedupe", { tone: "amber" }),
        e("dedupe", "parents", { tone: "amber", route: "u-right", offset: 10 }),
      ],
    },
  };
});

// content/posts/*/hybrid-search-bm25-vectors-rrf.md
export const hybridSearch = defineDiagram((t) => ({
  title: t("HYBRID SEARCH", "BUSCA HÍBRIDA"),
  heading: t("TWO RETRIEVERS, ONE RANKING", "DOIS BUSCADORES, UM RANKING"),
  accessible: t(
    "The user query runs in parallel against a BM25 full-text index and a vector (ANN) search, each returning its top 50 ids in rank order. Reciprocal Rank Fusion merges the two lists and keeps the top 20 to 30. An optional cross-encoder reranker narrows them to the top 5 to 8, which go to the LLM as context.",
    "A pergunta do usuário roda em paralelo num índice de texto completo BM25 e numa busca vetorial (ANN), e cada um devolve seus 50 melhores ids em ordem. A Reciprocal Rank Fusion junta as duas listas e mantém os 20 a 30 primeiros. Um reranker cross-encoder opcional reduz para os 5 a 8 melhores, que vão para o LLM como contexto."
  ),
  desktop: {
    cols: 4,
    rows: 2,
    nodes: [
      n("query", 0, 0.5, "muted", t("User query", "Pergunta do usuário")),
      n("bm25", 1, 0, "amber", "BM25", t("full text, top 50 ids", "texto completo, top 50 ids")),
      n("vector", 1, 1, "violet", t("Vector search", "Busca vetorial"), t("ANN, top 50 ids", "ANN, top 50 ids")),
      n("rrf", 2, 0.5, "accent", t("RRF fusion", "Fusão RRF"), t("keeps top 20-30", "mantém top 20-30")),
      n("rerank", 3, 0, "blue", "Reranker", [t("cross-encoder, optional", "cross-encoder, opcional"), t("keeps top 5-8", "mantém top 5-8")]),
      n("llm", 3, 1, "blue", t("LLM with context", "LLM com contexto")),
    ],
    edges: [
      e("query", "bm25", { route: "hvh", tone: "amber" }),
      e("query", "vector", { route: "hvh", tone: "violet" }),
      e("bm25", "rrf", { route: "hvh", tone: "amber" }),
      e("vector", "rrf", { route: "hvh", tone: "violet" }),
      e("rrf", "rerank", { route: "hvh", tone: "accent" }),
      e("rerank", "llm", { tone: "blue" }),
    ],
  },
  mobile: {
    cols: 2,
    rows: 5,
    nodes: [
      n("query", 0.5, 0, "muted", t("User query", "Pergunta do usuário")),
      n("bm25", 0, 1, "amber", "BM25", "top 50 ids"),
      n("vector", 1, 1, "violet", t("Vector (ANN)", "Vetorial (ANN)"), "top 50 ids"),
      n("rrf", 0.5, 2, "accent", t("RRF fusion", "Fusão RRF"), t("keeps top 20-30", "mantém top 20-30")),
      n("rerank", 0.5, 3, "blue", "Reranker", [t("cross-encoder, optional", "cross-encoder, opcional"), t("keeps top 5-8", "mantém top 5-8")]),
      n("llm", 0.5, 4, "blue", t("LLM with context", "LLM com contexto")),
    ],
    edges: [
      e("query", "bm25", { tone: "amber", fromShift: -30 }),
      e("query", "vector", { tone: "violet", fromShift: 30 }),
      e("bm25", "rrf", { tone: "amber", toShift: -30 }),
      e("vector", "rrf", { tone: "violet", toShift: 30 }),
      e("rrf", "rerank", { tone: "accent" }),
      e("rerank", "llm", { tone: "blue" }),
    ],
  },
}));

// content/posts/*/rag-evaluation-retrieval-test-set.md
export const ragEvaluation = defineDiagram((t) => {
  const forEach = t("FOR EACH QUESTION", "PARA CADA PERGUNTA");
  return {
    title: t("RAG EVALUATION", "AVALIAÇÃO DE RAG"),
    heading: t("SCORES THAT CAN FAIL A BUILD", "NOTAS QUE REPROVAM O BUILD"),
    accessible: t(
      "golden/v1.jsonl holds each question, its expected document ids and its source. The runner loads and validates it, then for each question calls retriever.search(q, k) to score recall@k, hit rate and MRR, and passes the retrieved chunks to generate(q, chunks) to score faithfulness, claims against chunks, with an optional LLM judge. pytest thresholds turn the scores into a CI pass or fail plus a JSON report.",
      "O golden/v1.jsonl guarda cada pergunta, os ids de documentos esperados e a fonte. O runner carrega e valida o arquivo e, para cada pergunta, chama retriever.search(q, k) para medir recall@k, hit rate e MRR, e passa os chunks recuperados para generate(q, chunks) para medir fidelidade, afirmações contra chunks, com um LLM juiz opcional. Limites no pytest transformam as notas em aprovação ou reprovação no CI, mais um relatório JSON."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      zones: [{ col: 2, row: 0, span: 2, rowSpan: 2, tone: "muted", dashed: true, label: forEach }],
      nodes: [
        n("golden", 0, 0, "muted", "golden/v1.jsonl", [t("question, expected ids,", "pergunta, ids esperados,"), t("source", "fonte")]),
        n("load", 1, 0, "blue", t("Load + validate", "Carrega + valida")),
        n("retr", 2, 0, "accent", t("Retrieve", "Recupera"), "retriever.search(q, k)"),
        n("rmetrics", 3, 0, "accent", t("Retrieval metrics", "Métricas de busca"), "recall@k · hit rate · MRR"),
        n("gen", 2, 1, "violet", t("Generate", "Gera"), "generate(q, chunks)"),
        n("faith", 3, 1, "violet", t("Faithfulness", "Fidelidade"), [t("claims vs chunks", "afirmações vs chunks"), t("optional LLM judge", "LLM juiz opcional")]),
        n("pytest", 3, 2, "amber", t("pytest thresholds", "Limites no pytest")),
        n("ci", 2, 2, "blue", t("CI pass / fail", "CI passa / falha"), t("+ JSON report", "+ relatório JSON")),
      ],
      edges: [
        e("golden", "load", { tone: "blue" }),
        e("load", "retr", { tone: "accent" }),
        e("retr", "rmetrics", { tone: "accent" }),
        e("retr", "gen", { tone: "violet", label: "chunks" }),
        e("gen", "faith", { tone: "violet" }),
        e("faith", "pytest", { tone: "amber" }),
        e("rmetrics", "pytest", { tone: "amber", route: "u-right", offset: 16 }),
        e("pytest", "ci", { tone: "blue" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      zones: [{ col: 0, row: 1, span: 2, rowSpan: 2, tone: "muted", dashed: true, label: forEach }],
      nodes: [
        n("golden", 0, 0, "muted", "golden/v1.jsonl", t("questions + expected ids", "perguntas + ids esperados")),
        n("load", 1, 0, "blue", t("Load + validate", "Carrega + valida")),
        n("retr", 0, 1, "accent", t("Retrieve", "Recupera"), "search(q, k)"),
        n("rmetrics", 1, 1, "accent", t("Retrieval metrics", "Métricas de busca"), "recall@k · MRR"),
        n("gen", 0, 2, "violet", t("Generate", "Gera"), "generate(q, chunks)"),
        n("faith", 1, 2, "violet", t("Faithfulness", "Fidelidade"), [t("claims vs chunks", "afirmações vs chunks"), t("LLM judge optional", "LLM juiz opcional")]),
        n("ci", 0, 3, "blue", t("CI pass / fail", "CI passa / falha"), t("+ JSON report", "+ relatório JSON")),
        n("pytest", 1, 3, "amber", t("pytest thresholds", "Limites no pytest")),
      ],
      edges: [
        e("golden", "load", { tone: "blue" }),
        e("load", "retr", { tone: "accent", bend: 0.25, toShift: 50 }),
        e("retr", "rmetrics", { tone: "accent" }),
        e("retr", "gen", { tone: "violet" }),
        e("gen", "faith", { tone: "violet" }),
        e("faith", "pytest", { tone: "amber" }),
        e("rmetrics", "pytest", { tone: "amber", route: "u-right", offset: 10 }),
        e("pytest", "ci", { tone: "blue" }),
      ],
    },
  };
});

// content/posts/*/rag-api-azure-container-apps-terraform.md
export const containerAppsRagApi = defineDiagram((t) => {
  const environment = t("CONTAINER APPS ENVIRONMENT", "AMBIENTE DO CONTAINER APPS");
  const app = t("Container app rag-api", "Container app rag-api");
  return {
    title: "AZURE",
    heading: t("RAG API ON CONTAINER APPS", "API DE RAG NO CONTAINER APPS"),
    accessible: t(
      "Internet traffic reaches the container app rag-api over HTTPS inside a Container Apps environment: ingress on port 8000, probes on /healthz, 1 to 5 replicas scaled by an HTTP rule, and a user-assigned managed identity. The environment sends console and system logs to Log Analytics. With that identity, the app pulls its image from Azure Container Registry (AcrPull, admin user off) and reads the model-api-key secret from Key Vault in RBAC mode (Key Vault Secrets User). It calls the external model or search endpoint (MODEL_ENDPOINT) over HTTPS.",
      "O tráfego da internet chega ao container app rag-api por HTTPS dentro de um ambiente do Container Apps: ingress na porta 8000, probes em /healthz, de 1 a 5 réplicas escaladas por uma regra HTTP e uma identidade gerenciada atribuída pelo usuário. O ambiente manda os logs de console e de sistema para o Log Analytics. Com essa identidade, o app baixa a imagem do Azure Container Registry (AcrPull, usuário admin desligado) e lê o segredo model-api-key do Key Vault em modo RBAC (Key Vault Secrets User). Ele chama o endpoint externo de modelo ou busca (MODEL_ENDPOINT) por HTTPS."
    ),
    desktop: {
      cols: 3,
      rows: 3.35,
      zones: [{ col: 0, row: 1, span: 2, tone: "accent", label: environment }],
      nodes: [
        n("internet", 0.5, 0, "muted", "Internet", "HTTPS"),
        n("api", 0.5, 1, "accent", app, [
          t("ingress :8000, probes /healthz", "ingress :8000, probes /healthz"),
          t("1..5 replicas, managed identity", "1..5 réplicas, identidade gerenciada"),
        ]),
        n("logs", 2, 1, "muted", "Log Analytics", t("console + system logs", "logs de console e sistema")),
        n("acr", 0, 2.35, "blue", "Container Registry", t("admin user off", "usuário admin desligado")),
        n("kv", 1, 2.35, "amber", "Key Vault", [t("RBAC mode", "modo RBAC"), "secret: model-api-key"]),
        n("model", 2, 2.35, "violet", t("Model / search API", "API de modelo / busca"), "MODEL_ENDPOINT"),
      ],
      edges: [
        e("internet", "api", { tone: "accent" }),
        e("api", "logs", { tone: "muted" }),
        e("api", "acr", { tone: "blue", bend: 0.6, label: t("pull image (AcrPull)", "baixa a imagem (AcrPull)") }),
        e("api", "kv", { tone: "amber", bend: 0.6, label: t("read secret", "lê o segredo") }),
        e("api", "model", { tone: "violet", fromShift: 40, bend: 0.25, label: "HTTPS" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 92,
      zones: [{ col: 0, row: 1, span: 2, tone: "accent", label: environment, insetX: 6 }],
      nodes: [
        n("internet", 1, 0, "muted", "Internet", "HTTPS"),
        n("api", 0, 1, "accent", app, [
          t("ingress :8000, /healthz", "ingress :8000, /healthz"),
          t("1..5 replicas, managed identity", "1..5 réplicas, identidade gerenciada"),
        ], { span: 2 }),
        n("logs", 0, 2, "muted", "Log Analytics", t("console + system", "console + sistema")),
        n("model", 1, 2, "violet", t("Model API", "API de modelo"), "MODEL_ENDPOINT"),
        n("acr", 0, 3, "blue", "Container Registry", "AcrPull"),
        n("kv", 1, 3, "amber", "Key Vault", "model-api-key"),
      ],
      edges: [
        e("internet", "api", { tone: "accent", toShift: 84 }),
        e("api", "logs", { tone: "muted", fromShift: -40 }),
        e("api", "model", { tone: "violet", fromShift: 40 }),
        e("api", "acr", { tone: "blue", route: "u-left", offset: 10 }),
        e("api", "kv", { tone: "amber", route: "u-right", offset: 10 }),
      ],
    },
  };
});

// content/posts/*/vector-database-performance-settings.md
function hnswSpec(t: T, mobile: boolean) {
  const letters = "ABCDEFGHIJ".split("");
  const layers: string[][] = [["A", "F"], ["A", "C", "E", "F", "H"], letters];
  const size = mobile ? 20 : 28;
  const nodes: GridNode[] = [];
  const edges: GridEdge[] = [];
  layers.forEach((present, row) => {
    const layer = 2 - row;
    for (const letter of present) {
      const target = layer === 0 && letter === "I";
      nodes.push(n(`${letter}${layer}`, letters.indexOf(letter) + 1, row, target ? "amber" : "accent", letter, undefined, { shape: "dot", w: size, h: size }));
    }
    present.slice(1).forEach((letter, i) => {
      edges.push(e(`${present[i]}${layer}`, `${letter}${layer}`, { arrow: "none", flow: false, width: 1.25 }));
    });
    if (layer > 0) {
      for (const letter of present) edges.push(e(`${letter}${layer}`, `${letter}${layer - 1}`, { arrow: "none", dashed: true, width: 1 }));
    }
  });
  const path: [string, string][] = [["A2", "F2"], ["F2", "F1"], ["F1", "H1"], ["H1", "H0"], ["H0", "I0"]];
  for (const [from, to] of path) edges.push(e(from, to, { tone: "amber", width: 2.25 }));

  const layerNames = mobile ? ["L2", "L1", "L0"] : [t("Layer 2", "Camada 2"), t("Layer 1", "Camada 1"), t("Layer 0", "Camada 0")];
  const layerHints = [
    t("few nodes, long jumps", "poucos nós, saltos longos"),
    t("more nodes, medium jumps", "mais nós, saltos médios"),
    t("every node, short links", "todos os nós, links curtos"),
  ];
  const notes: GridNote[] = layerNames.flatMap((name, row) => [
    { col: 0, row, text: name, tone: "text", size: mobile ? 11 : 12, weight: 700, align: "center", dy: mobile ? 0 : -7 },
    ...(mobile ? [] : [{ col: 0, row, text: layerHints[row] ?? "", tone: "muted" as const, size: 9, align: "center" as const, dy: 9 }]),
  ]);
  notes.push(
    { col: 1, row: 0, text: t("entry point", "ponto de entrada"), tone: "amber", size: mobile ? 9 : 10, align: "center", dy: mobile ? -18 : -24 },
    { col: 9, row: 2, text: t("nearest to the query", "mais perto da consulta"), tone: "amber", size: mobile ? 9 : 10, align: "center", dy: mobile ? 20 : 26 }
  );
  const summary = mobile
    ? [t("Enter at the top, hop greedily toward the query,", "Entre no topo, salte em direção à consulta,"), t("drop a layer, repeat, then explore layer 0.", "desça uma camada, repita e explore a camada 0.")]
    : [
        t("Search: enter at the top, hop greedily toward the query, drop a layer, repeat,", "Busca: entre no topo, salte gulosamente em direção à consulta, desça uma camada, repita"),
        t("then explore a candidate list on layer 0.", "e então explore uma lista de candidatos na camada 0."),
      ];
  // The column whose center lands on the middle of the canvas, given the wider label column.
  summary.forEach((text, i) => notes.push({ col: mobile ? 4.7 : 4.4, row: 3, text, tone: "muted", size: mobile ? 10 : 11, align: "center", dy: i * 16 - 6 }));
  return {
    cols: [mobile ? 1.6 : 2.2, ...letters.map(() => 1)],
    rows: 3.8,
    rowH: mobile ? 58 : 70,
    padTop: 52,
    nodes,
    edges,
    notes,
  };
}

export const hnswLayers = defineDiagram((t) => ({
  title: "HNSW",
  heading: t("A GRAPH WITH EXPRESS LANES", "UM GRAFO COM PISTAS EXPRESSAS"),
  accessible: t(
    "HNSW as three layers of the same graph. Layer 2 holds a few nodes, A and F, with long jumps; layer 1 holds more, A, C, E, F and H, with medium jumps; layer 0 holds every node from A to J with short links. Each node in an upper layer also exists in the layers below it. A search enters at A on the top layer, hops greedily toward the query (A to F), drops a layer, continues (F to H), drops again, and ends near the query at I, where it explores a candidate list on layer 0.",
    "O HNSW como três camadas do mesmo grafo. A camada 2 tem poucos nós, A e F, com saltos longos; a camada 1 tem mais, A, C, E, F e H, com saltos médios; a camada 0 tem todos os nós de A a J, com links curtos. Cada nó de uma camada de cima também existe nas de baixo. A busca entra por A na camada do topo, salta de forma gulosa em direção à consulta (de A para F), desce uma camada, continua (de F para H), desce de novo e termina perto da consulta, em I, onde explora uma lista de candidatos na camada 0."
  ),
  desktop: hnswSpec(t, false),
  mobile: hnswSpec(t, true),
}));
