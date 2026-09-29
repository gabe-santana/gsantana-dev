import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/embedding-models-contrastive-training.md

const biVsCross = defineDiagram((t) => {
  const labels = {
    query: t("Query", "Consulta"),
    passage: t("Passage", "Passagem"),
    encoder: t("Encoder", "Encoder"),
    cosine: "cosine(q, d)",
    pair: t("Query + passage", "Consulta + passagem"),
    transformer: "Transformer",
    score: t("Relevance score", "Nota de relevância"),
  };
  return {
    title: t("TWO ENCODERS", "DOIS ENCODERS"),
    heading: t("COMPARE VECTORS, OR READ TOGETHER", "COMPARAR VETORES OU LER JUNTOS"),
    accessible: t(
      "Two ways to score a query against a passage. A bi-encoder runs the query and the passage through the same encoder separately, pools each into one vector, and compares the two vectors with a cosine similarity. Passages are encoded once, offline, and stored in an index, so a search costs one query encoding plus fast vector comparisons. A cross-encoder concatenates the query and the passage into one input, lets attention run across both texts, and outputs a single relevance score. It is more accurate but needs one forward pass per query and passage pair, so it only fits as a reranker over a short candidate list.",
      "Duas formas de dar nota a uma passagem para uma consulta. Um bi-encoder passa a consulta e a passagem pelo mesmo encoder separadamente, faz o pooling de cada uma em um vetor e compara os dois vetores com similaridade de cosseno. As passagens são codificadas uma vez, offline, e guardadas num índice, então uma busca custa uma codificação da consulta mais comparações rápidas de vetores. Um cross-encoder concatena a consulta e a passagem numa única entrada, deixa a atenção correr pelos dois textos e devolve uma única nota de relevância. É mais preciso, mas precisa de uma passada por par de consulta e passagem, então só cabe como reranker sobre uma lista curta de candidatos."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      rowH: 98,
      padTop: 58,
      zones: [
        { col: 0, row: 0, span: 2, rowSpan: 3, tone: "accent", dashed: true, label: t("BI-ENCODER: RETRIEVAL", "BI-ENCODER: RECUPERAÇÃO") },
        { col: 2, row: 0, span: 2, rowSpan: 3, tone: "amber", dashed: true, label: t("CROSS-ENCODER: RERANKING", "CROSS-ENCODER: RERANKING") },
      ],
      nodes: [
        n("bq", 0, 0, "accent", labels.query, t("encoded at search time", "codificada na hora da busca")),
        n("bd", 1, 0, "violet", labels.passage, t("encoded once, offline", "codificada uma vez, offline")),
        n("bqe", 0, 1, "accent", labels.encoder, t("pool to 384 dims", "pooling em 384 dims")),
        n("bde", 1, 1, "violet", labels.encoder, t("same weights", "mesmos pesos")),
        n("bsim", 0.5, 2, "blue", labels.cosine, t("one dot product per passage", "um produto escalar por passagem"), { w: 250 }),
        n("cin", 2.5, 0, "amber", labels.pair, t("one joint input, [SEP] between", "uma entrada só, [SEP] no meio"), { w: 250 }),
        n("cenc", 2.5, 1, "amber", labels.transformer, t("attention across both texts", "atenção pelos dois textos"), { w: 250 }),
        n("cscore", 2.5, 2, "danger", labels.score, t("one forward pass per pair", "uma passada por par"), { w: 250 }),
      ],
      edges: [
        e("bq", "bqe", { tone: "accent" }),
        e("bd", "bde", { tone: "violet" }),
        e("bqe", "bsim", { tone: "accent" }),
        e("bde", "bsim", { tone: "violet" }),
        e("cin", "cenc", { tone: "amber" }),
        e("cenc", "cscore", { tone: "amber" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 6,
      rowH: 86,
      padTop: 58,
      zones: [
        { col: 0, row: 0, span: 2, rowSpan: 3, tone: "accent", dashed: true, label: t("BI-ENCODER: RETRIEVAL", "BI-ENCODER: RECUPERAÇÃO") },
        { col: 0, row: 3, span: 2, rowSpan: 3, tone: "amber", dashed: true, label: t("CROSS-ENCODER: RERANKING", "CROSS-ENCODER: RERANKING") },
      ],
      nodes: [
        n("bq", 0, 0, "accent", labels.query, t("at search time", "na hora da busca")),
        n("bd", 1, 0, "violet", labels.passage, t("once, offline", "uma vez, offline")),
        n("bqe", 0, 1, "accent", labels.encoder, t("384 dims", "384 dims")),
        n("bde", 1, 1, "violet", labels.encoder, t("same weights", "mesmos pesos")),
        n("bsim", 0.5, 2, "blue", labels.cosine, t("cheap per passage", "barato por passagem"), { w: 220 }),
        n("cin", 0.5, 3, "amber", labels.pair, t("one joint input", "uma entrada só"), { w: 220 }),
        n("cenc", 0.5, 4, "amber", labels.transformer, t("attention across both", "atenção pelos dois"), { w: 220 }),
        n("cscore", 0.5, 5, "danger", labels.score, t("one pass per pair", "uma passada por par"), { w: 220 }),
      ],
      edges: [
        e("bq", "bqe", { tone: "accent" }),
        e("bd", "bde", { tone: "violet" }),
        e("bqe", "bsim", { tone: "accent" }),
        e("bde", "bsim", { tone: "violet" }),
        e("cin", "cenc", { tone: "amber" }),
        e("cenc", "cscore", { tone: "amber" }),
      ],
    },
  };
});

const trainingStep = defineDiagram((t) => {
  const labels = {
    pairs: t("32 training pairs", "32 pares de treino"),
    hard: t("Hard negatives", "Negativos difíceis"),
    encoder: t("Shared encoder", "Encoder"),
    norm: t("Normalize", "Normalizar"),
    matrix: t("Similarity matrix", "Matriz de similaridade"),
    temp: t("Divide by temperature", "Temperatura"),
    mask: t("Mask false negatives", "Falsos negativos"),
    loss: t("Cross-entropy", "Entropia cruzada"),
  };
  const details = {
    pairs: [t("query + its", "consulta + sua"), t("positive passage", "passagem positiva")],
    hard: [t("same tool,", "mesma ferramenta,"), t("different issue", "outro problema")],
    encoder: [t("query: and passage:", "compartilhado, prefixos"), t("prefixes", "query: e passage:")],
    norm: [t("unit length,", "tamanho 1,"), t("cosine = dot", "cosseno = produto")],
    matrix: [t("32 queries x", "32 consultas x"), t("64 passages", "64 passagens")],
    temp: [t("t = 0.05 sharpens", "dividir por t = 0,05"), t("the softmax", "afia o softmax")],
    mask: [t("same passage,", "mascarar a mesma"), t("off the diagonal", "passagem fora da diagonal")],
    loss: [t("target: the", "alvo: a célula"), t("diagonal cell", "da diagonal")],
  };
  return {
    title: "INFONCE",
    heading: t("ONE TRAINING STEP WITH IN-BATCH NEGATIVES", "UM PASSO DE TREINO COM NEGATIVOS DO BATCH"),
    accessible: t(
      "One training step of a bi-encoder with the InfoNCE loss. A batch of 32 query and positive passage pairs is joined by one hard negative passage per query, chosen from the same tool but a different issue. The shared encoder embeds the queries with the query prefix and the passages with the passage prefix, and every vector is normalized to unit length. The result is a similarity matrix of 32 queries by 64 passages. Each cosine is divided by a temperature of 0.05, cells where another row holds the same passage as a query's positive are masked out as false negatives, and a row-wise cross-entropy treats the diagonal cell as the correct class. Every other passage in the batch is a free negative.",
      "Um passo de treino de um bi-encoder com a loss InfoNCE. Um batch de 32 pares de consulta e passagem positiva ganha um negativo difícil por consulta, escolhido da mesma ferramenta mas de outro problema. O encoder compartilhado gera os embeddings das consultas com o prefixo query e das passagens com o prefixo passage, e todo vetor é normalizado para tamanho 1. O resultado é uma matriz de similaridade de 32 consultas por 64 passagens. Cada cosseno é dividido por uma temperatura de 0,05, as células em que outra linha tem a mesma passagem que o positivo da consulta são mascaradas como falsos negativos, e uma entropia cruzada por linha trata a célula da diagonal como a classe correta. Toda outra passagem do batch vira um negativo de graça."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 104,
      padTop: 54,
      nodes: [
        n("pairs", 0, 0, "muted", labels.pairs, details.pairs),
        n("hard", 1, 0, "amber", labels.hard, details.hard),
        n("enc", 2, 0, "accent", labels.encoder, details.encoder),
        n("norm", 3, 0, "accent", labels.norm, details.norm),
        n("matrix", 3, 1, "violet", labels.matrix, details.matrix),
        n("temp", 2, 1, "violet", labels.temp, details.temp),
        n("mask", 1, 1, "danger", labels.mask, details.mask),
        n("loss", 0, 1, "blue", labels.loss, details.loss),
      ],
      edges: [
        e("pairs", "hard", { tone: "muted" }),
        e("hard", "enc", { tone: "amber" }),
        e("enc", "norm", { tone: "accent" }),
        e("norm", "matrix", { tone: "accent" }),
        e("matrix", "temp", { tone: "violet" }),
        e("temp", "mask", { tone: "violet" }),
        e("mask", "loss", { tone: "danger" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 92,
      padTop: 54,
      nodes: [
        n("pairs", 0, 0, "muted", labels.pairs, t("query + positive", "consulta + positivo")),
        n("hard", 1, 0, "amber", labels.hard, t("same tool, other issue", "mesma ferramenta")),
        n("enc", 0, 1, "accent", "Encoder", t("shared, with prefixes", "compartilhado, prefixos")),
        n("norm", 1, 1, "accent", labels.norm, t("unit length", "tamanho 1")),
        n("matrix", 1, 2, "violet", t("Similarities", "Similaridades"), "32 x 64"),
        n("temp", 0, 2, "violet", t("Temperature", "Temperatura"), t("t = 0.05", "t = 0,05")),
        n("mask", 0, 3, "danger", t("Mask", "Máscara"), t("false negatives", "falsos negativos")),
        n("loss", 1, 3, "blue", labels.loss, t("target: diagonal", "alvo: diagonal")),
      ],
      edges: [
        e("pairs", "enc", { tone: "muted" }),
        e("hard", "enc", { tone: "amber" }),
        e("enc", "norm", { tone: "accent" }),
        e("norm", "matrix", { tone: "accent" }),
        e("matrix", "temp", { tone: "violet" }),
        e("temp", "mask", { tone: "violet" }),
        e("mask", "loss", { tone: "danger" }),
      ],
    },
  };
});

export const embeddingTrainingDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "emb-bi-vs-cross-encoder": biVsCross,
  "emb-infonce-training-step": trainingStep,
};
