import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/lora-fine-tuning-first-principles.md
const loraDecisionFlow = defineDiagram((t) => {
  const node = {
    start: (col: number, row: number, w: number) =>
      n("start", col, row, "muted", t("The model fails a task", "O modelo falha numa tarefa"), t("measured on your eval set", "medido no seu eval set"), { w }),
    know: (col: number, row: number, w?: number) =>
      n("know", col, row, "violet", t("Missing facts?", "Faltam fatos?"), t("docs, prices, policies", "docs, preços, regras"), w ? { w } : {}),
    behave: (col: number, row: number, w?: number) =>
      n("behave", col, row, "violet", t("Missing behavior?", "Comportamento?"), t("format, style, task", "formato, estilo, tarefa"), w ? { w } : {}),
    rag: (col: number, row: number, w?: number) =>
      n("rag", col, row, "accent", "RAG", t("retrieve at query time", "busca na consulta"), w ? { w } : {}),
    prompt: (col: number, row: number, w?: number) =>
      n("prompt", col, row, "amber", "Prompt + few-shot", t("always the baseline", "sempre o baseline"), w ? { w } : {}),
    ft: (col: number, row: number, w?: number) =>
      n("ft", col, row, "danger", t("LoRA fine-tune", "Fine-tune LoRA"), t("when prompting plateaus", "se o prompt estaciona"), w ? { w } : {}),
    both: (col: number, row: number, w: number) =>
      n("both", col, row, "blue", t("Combine them", "Combine os dois"), t("tuned model reads retrieved docs", "modelo ajustado lê docs recuperados"), { w }),
  };
  const plateau = t("eval plateaus", "eval estaciona");
  return {
    title: "FINE-TUNE?",
    heading: t("FACTS IN CONTEXT, BEHAVIOR IN WEIGHTS", "FATOS NO CONTEXTO, COMPORTAMENTO NOS PESOS"),
    accessible: t(
      "Start from a task the model fails, measured on an eval set. If what is missing is facts, such as documents, prices or policies, use retrieval-augmented generation and supply them at query time. If what is missing is a behavior, such as a format, a style or a narrow task, start with a prompt and few-shot examples as the baseline. Only when the eval score plateaus with prompting, fine-tune with LoRA. Many production systems combine both: a tuned model that reads retrieved documents.",
      "Comece por uma tarefa em que o modelo falha, medida num eval set. Se o que falta são fatos, como documentos, preços ou políticas, use geração aumentada por recuperação e entregue esses fatos na hora da consulta. Se o que falta é um comportamento, como um formato, um estilo ou uma tarefa estreita, comece com um prompt e exemplos few-shot como baseline. Só quando o score do eval estaciona com prompting, faça fine-tuning com LoRA. Muitos sistemas em produção combinam os dois: um modelo ajustado que lê documentos recuperados."
    ),
    desktop: {
      cols: 4,
      rows: 4,
      nodes: [
        node.start(1.5, 0, 280),
        node.know(0.5, 1, 220),
        node.behave(2.5, 1, 220),
        node.rag(0.5, 2, 220),
        node.prompt(2.5, 2, 220),
        node.both(0.5, 3, 240),
        node.ft(2.5, 3, 220),
      ],
      edges: [
        e("start", "know", { tone: "violet" }),
        e("start", "behave", { tone: "violet" }),
        e("know", "rag", { tone: "accent", label: t("yes", "sim") }),
        e("behave", "prompt", { tone: "amber", label: t("yes", "sim") }),
        e("prompt", "ft", { tone: "danger", label: plateau }),
        e("ft", "both", { tone: "blue", dashed: true }),
        e("rag", "both", { tone: "blue", dashed: true }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 5,
      nodes: [
        node.start(0.5, 0, 250),
        node.know(0, 1),
        node.behave(1, 1),
        node.rag(0, 2),
        node.prompt(1, 2),
        node.ft(1, 3),
        node.both(0.5, 4, 250),
      ],
      edges: [
        e("start", "know", { tone: "violet" }),
        e("start", "behave", { tone: "violet" }),
        e("know", "rag", { tone: "accent" }),
        e("behave", "prompt", { tone: "amber" }),
        e("prompt", "ft", { tone: "danger", label: plateau }),
        e("rag", "both", { tone: "blue", dashed: true, toShift: -84 }),
        e("ft", "both", { tone: "blue", dashed: true, toShift: 84 }),
      ],
    },
  };
});

const loraForwardPass = defineDiagram((t) => {
  const node = {
    x: (col: number, row: number, w?: number) =>
      n("x", col, row, "muted", t("Input x", "Entrada x"), t("k = 576 features", "k = 576 features"), w ? { w } : {}),
    w: (col: number, row: number, span = 1) =>
      n("w", col, row, "blue", t("W, frozen", "W, congelada"), [t("d x k, never updated", "d x k, nunca muda"), t("331,776 values", "331.776 valores")], { span }),
    a: (col: number, row: number) =>
      n("a", col, row, "violet", "A, r x k", [t("random init", "init aleatória"), t("trainable", "treinável")]),
    b: (col: number, row: number) =>
      n("b", col, row, "violet", "B, d x r", [t("starts at zero", "começa em zero"), t("then x alpha / r", "depois x alpha / r")]),
    sum: (col: number, row: number, w?: number) =>
      n("sum", col, row, "accent", "h = Wx + BAx", t("same shape as Wx", "mesmo formato de Wx"), w ? { w } : {}),
  };
  return {
    title: "LORA",
    heading: t("A FROZEN PATH AND A LOW-RANK DETOUR", "UM CAMINHO CONGELADO E UM DESVIO DE BAIXO RANK"),
    accessible: t(
      "The input x, with k features, takes two paths. The frozen path multiplies it by the pretrained weight W, a d by k matrix that is never updated. The trainable path multiplies it by A, an r by k matrix with random initialization, then by B, a d by r matrix that starts at zero, and scales the result by alpha over r. The two results are added, so the layer output h has the same shape as before. Because B starts at zero, the layer starts out identical to the pretrained one.",
      "A entrada x, com k features, segue dois caminhos. O caminho congelado a multiplica pelo peso pré-treinado W, uma matriz d por k que nunca é atualizada. O caminho treinável a multiplica por A, uma matriz r por k com inicialização aleatória, depois por B, uma matriz d por r que começa em zero, e escala o resultado por alpha sobre r. Os dois resultados são somados, então a saída h da camada tem o mesmo formato de antes. Como B começa em zero, a camada começa idêntica à pré-treinada."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      nodes: [node.x(0, 1), node.w(1, 0, 2), node.a(1, 2), node.b(2, 2), node.sum(3, 1)],
      edges: [
        e("x", "w", { tone: "blue", route: "vh" }),
        e("x", "a", { tone: "violet", route: "vh" }),
        e("a", "b", { tone: "violet", label: "r = 16" }),
        e("w", "sum", { tone: "blue", route: "hv" }),
        e("b", "sum", { tone: "violet", route: "hv" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      nodes: [node.x(0.5, 0, 250), node.w(0, 1), node.a(1, 1), node.b(1, 2), node.sum(0.5, 3, 250)],
      edges: [
        e("x", "w", { tone: "blue" }),
        e("x", "a", { tone: "violet" }),
        e("a", "b", { tone: "violet", label: "r = 16" }),
        e("w", "sum", { tone: "blue", toShift: -84 }),
        e("b", "sum", { tone: "violet", toShift: 84 }),
      ],
    },
  };
});

const loraServing = defineDiagram((t) => {
  const node = {
    src: (col: number, row: number, w: number) =>
      n("src", col, row, "violet", t("Base + adapter", "Base + adapter"), t("134.5M frozen, 4.9M trained", "134,5M congelados, 4,9M treinados"), { w }),
    merge: (col: number, row: number, w?: number) =>
      n("merge", col, row, "accent", t("Merge into W", "Merge em W"), "W + (alpha/r) BA", w ? { w } : {}),
    server: (col: number, row: number, w?: number) =>
      n("server", col, row, "amber", t("Keep separate", "Separados"), t("base loaded once", "base carregada 1 vez"), w ? { w } : {}),
    single: (col: number, row: number, w?: number) =>
      n("single", col, row, "accent", t("One plain model", "Um modelo comum"), [t("no extra latency", "sem latência extra"), t("one task per copy", "uma tarefa por cópia")], w ? { w } : {}),
    triage: (col: number, row: number) =>
      n("triage", col, row, "amber", t("Triage adapter", "Triagem"), t("one per request", "um por requisição")),
    style: (col: number, row: number) =>
      n("style", col, row, "amber", t("Style adapter", "Estilo"), t("one per request", "um por requisição")),
  };
  return {
    title: t("SERVING", "SERVINDO"),
    heading: t("MERGE FOR ONE TASK, SWAP FOR MANY", "MERGE PARA UMA TAREFA, TROCA PARA VÁRIAS"),
    accessible: t(
      "A trained adapter can reach production two ways. Merged: the update alpha over r times B A is added into W once, and the result is a plain model with no extra latency that does one task per copy. Separate: a multi-LoRA server loads the base model once and keeps many small adapters, such as a triage adapter and a style adapter, choosing one per request.",
      "Um adapter treinado pode chegar à produção de dois jeitos. Com merge: a atualização alpha sobre r vezes B A é somada em W uma vez, e o resultado é um modelo comum, sem latência extra, que faz uma tarefa por cópia. Separado: um servidor multi-LoRA carrega o modelo base uma vez e mantém vários adapters pequenos, como um de triagem e um de estilo, escolhendo um por requisição."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      nodes: [
        node.src(1.5, 0, 280),
        node.merge(0.5, 1, 220),
        node.server(2.5, 1, 220),
        node.single(0.5, 2, 220),
        node.triage(2, 2),
        node.style(3, 2),
      ],
      edges: [
        e("src", "merge", { tone: "accent" }),
        e("src", "server", { tone: "amber" }),
        e("merge", "single", { tone: "accent" }),
        e("server", "triage", { tone: "amber" }),
        e("server", "style", { tone: "amber" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      nodes: [
        node.src(0.5, 0, 250),
        node.merge(0, 1),
        node.server(1, 1),
        node.single(0, 2),
        node.triage(1, 2),
        node.style(1, 3),
      ],
      edges: [
        e("src", "merge", { tone: "accent" }),
        e("src", "server", { tone: "amber" }),
        e("merge", "single", { tone: "accent" }),
        e("server", "triage", { tone: "amber" }),
        e("server", "style", { tone: "amber", route: "u-right", offset: 8 }),
      ],
    },
  };
});

export const loraDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "lora-decision-flow": loraDecisionFlow,
  "lora-forward-pass": loraForwardPass,
  "lora-serving": loraServing,
};
