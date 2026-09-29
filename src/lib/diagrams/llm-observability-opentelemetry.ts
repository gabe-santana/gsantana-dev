import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/llm-observability-opentelemetry.md

const llmobsTraceTree = defineDiagram((t) => {
  const node = {
    root: (col: number, row: number, w: number) =>
      n("root", col, row, "violet", "invoke_agent support-agent", [
        t("app.feature, app.tenant.id", "app.feature, app.tenant.id"),
        t("tokens summed over calls", "tokens somados das chamadas"),
      ], { w }),
    chat1: (col: number, row: number, w?: number) =>
      n("chat1", col, row, "accent", "chat orion-mini", [t("finish: tool_call", "finish: tool_call"), t("865 in, 24 out", "865 entrada, 24 saída")], { w }),
    tool1: (col: number, row: number, w?: number) =>
      n("tool1", col, row, "danger", "execute_tool", ["lookup_tracking", "error.type: timeout"], { w }),
    tool2: (col: number, row: number, w?: number) =>
      n("tool2", col, row, "amber", "execute_tool", ["lookup_tracking", t("retry, ok", "retry, ok")], { w }),
    chat2: (col: number, row: number, w?: number) =>
      n("chat2", col, row, "accent", "chat orion-mini", [t("finish: stop", "finish: stop"), "cache_read: 850"], { w }),
    evalEvent: (col: number, row: number, w?: number) =>
      n("eval", col, row, "blue", t("Evaluation event", "Evento de avaliação"), [t("Relevance 4.0, pass", "Relevance 4.0, pass"), t("parented to the chat", "filho do chat")], { w }),
    feedback: (col: number, row: number, w?: number) =>
      n("feedback", col, row, "muted", t("User feedback", "Feedback do usuário"), [t("thumbs down, later", "polegar para baixo, depois"), t("same trace id", "mesmo trace id")], { w }),
  };
  return {
    title: t("TRACE TREE", "ÁRVORE DO TRACE"),
    heading: t("5 SPANS, 2 EVENTS", "5 SPANS, 2 EVENTOS"),
    accessible: t(
      "One user question produces one trace. The root span is invoke_agent support-agent, which carries the feature and tenant attributes and the token totals. Under it, in order: a chat span on orion-mini that ends with finish reason tool_call (865 input and 24 output tokens), an execute_tool lookup_tracking span that fails with error.type timeout, a second execute_tool span that retries and succeeds, and a final chat span that ends with finish reason stop and reads 850 tokens from the provider cache. An evaluation event with a Relevance score of 4.0 is parented to the final chat span, and a thumbs-down user feedback event that arrives later is attached to the root span through the same trace id.",
      "Uma pergunta do usuário gera um trace. O span raiz é invoke_agent support-agent, que carrega os atributos de feature e tenant e os totais de tokens. Abaixo dele, em ordem: um span chat no orion-mini que termina com finish reason tool_call (865 tokens de entrada e 24 de saída), um span execute_tool lookup_tracking que falha com error.type timeout, um segundo span execute_tool que tenta de novo e funciona, e um span chat final que termina com finish reason stop e lê 850 tokens do cache do provedor. Um evento de avaliação com nota de Relevance 4.0 é filho do span chat final, e um evento de feedback negativo do usuário, que chega depois, se liga ao span raiz pelo mesmo trace id."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 110,
      nodes: [
        node.feedback(0, 0),
        node.root(1.5, 0, 300),
        node.evalEvent(3, 0),
        node.chat1(0, 1),
        node.tool1(1, 1),
        node.tool2(2, 1),
        node.chat2(3, 1),
      ],
      edges: [
        e("root", "chat1", { tone: "violet", fromShift: -90 }),
        e("root", "tool1", { tone: "violet", fromShift: -30 }),
        e("root", "tool2", { tone: "violet", fromShift: 30 }),
        e("root", "chat2", { tone: "violet", fromShift: 90, toShift: -30 }),
        e("feedback", "root", { tone: "muted", dashed: true }),
        e("eval", "chat2", { tone: "blue", dashed: true, fromShift: 30, toShift: 30 }),
      ],
    },
    mobile: {
      cols: [1, 4],
      rows: 7,
      nodes: [
        node.root(1, 0, 250),
        node.chat1(1, 1),
        node.tool1(1, 2),
        node.tool2(1, 3),
        node.chat2(1, 4),
        node.evalEvent(1, 5),
        node.feedback(1, 6),
      ],
      edges: [
        e("root", "chat1", { tone: "violet", route: "u-left", offset: 18 }),
        e("root", "tool1", { tone: "violet", route: "u-left", offset: 18 }),
        e("root", "tool2", { tone: "violet", route: "u-left", offset: 18 }),
        e("root", "chat2", { tone: "violet", route: "u-left", offset: 18 }),
        e("eval", "chat2", { tone: "blue", dashed: true }),
        e("feedback", "root", { tone: "muted", dashed: true, route: "u-left", offset: 44 }),
      ],
    },
  };
});

const llmobsPipeline = defineDiagram((t) => {
  const node = {
    agent: (col: number, row: number) => n("agent", col, row, "violet", t("Agent code", "Código do agente"), t("spans + events", "spans + eventos")),
    baggage: (col: number, row: number) => n("baggage", col, row, "muted", t("Stamp context", "Carimba contexto"), t("tenant, feature", "tenant, feature")),
    redact: (col: number, row: number) => n("redact", col, row, "danger", t("Redaction", "Mascaramento"), t("scrub, truncate", "mascara, trunca")),
    exporter: (col: number, row: number) => n("exporter", col, row, "blue", t("OTLP exporter", "Exporter OTLP"), t("batched", "em lote")),
    content: (col: number, row: number) =>
      n("content", col, row, "muted", t("Content store", "Store de conteúdo"), [t("opt-in, own access", "opt-in, acesso próprio")]),
    collector: (col: number, row: number) => n("collector", col, row, "blue", "Collector", t("second redaction", "segundo filtro")),
    spanmetrics: (col: number, row: number) => n("spanmetrics", col, row, "amber", "spanmetrics", t("100% of spans", "100% dos spans")),
    metrics: (col: number, row: number) => n("metrics", col, row, "amber", t("Metrics store", "Store de métricas"), t("dashboards, alerts", "dashboards, alertas")),
    tail: (col: number, row: number) => n("tail", col, row, "accent", t("Tail sampling", "Tail sampling"), t("errors, slow, 10%", "erros, lentos, 10%")),
    traces: (col: number, row: number) => n("traces", col, row, "accent", t("Trace backend", "Backend de traces"), t("Tempo, Jaeger...", "Tempo, Jaeger...")),
    evals: (col: number, row: number) => n("evals", col, row, "violet", t("Online evals", "Avaliações online"), t("judge a sample", "julgam uma amostra")),
  };
  return {
    title: "PIPELINE",
    heading: t("REDACT FIRST, SAMPLE LATER", "MASCARA ANTES, AMOSTRA DEPOIS"),
    accessible: t(
      "The agent code creates spans and events. A baggage processor stamps tenant and feature on every span, a redaction processor scrubs and truncates content attributes, and a batched OTLP exporter sends the result to an OpenTelemetry Collector. Content, when captured at all, can go to a separate content store with its own access control. The Collector applies a second redaction pass, then feeds two paths: the spanmetrics connector turns 100% of the spans into latency and error metrics for dashboards and alerts, and tail sampling keeps errors, slow traces and 10% of the rest for the trace backend (Tempo, Jaeger or Application Insights). Online evaluations judge the sampled traces and their scores feed the metrics store.",
      "O código do agente cria spans e eventos. Um processor de baggage carimba tenant e feature em todo span, um processor de mascaramento limpa e trunca os atributos de conteúdo, e um exporter OTLP em lote envia o resultado para um OpenTelemetry Collector. O conteúdo, quando capturado, pode ir para um store de conteúdo separado, com controle de acesso próprio. O Collector aplica um segundo filtro de mascaramento e alimenta dois caminhos: o connector spanmetrics transforma 100% dos spans em métricas de latência e erro para dashboards e alertas, e o tail sampling guarda erros, traces lentos e 10% do resto para o backend de traces (Tempo, Jaeger ou Application Insights). Avaliações online julgam os traces amostrados e as notas alimentam o store de métricas."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      nodes: [
        node.agent(0, 0), node.baggage(1, 0), node.redact(2, 0), node.exporter(3, 0),
        node.content(0, 1), node.metrics(1, 1), node.spanmetrics(2, 1), node.collector(3, 1),
        node.evals(1, 2), node.traces(2, 2), node.tail(3, 2),
      ],
      edges: [
        e("agent", "baggage", { tone: "violet" }),
        e("baggage", "redact", { tone: "muted" }),
        e("redact", "exporter", { tone: "danger" }),
        e("agent", "content", { tone: "muted", dashed: true }),
        e("exporter", "collector", { tone: "blue", label: "OTLP" }),
        e("collector", "spanmetrics", { tone: "amber" }),
        e("spanmetrics", "metrics", { tone: "amber" }),
        e("collector", "tail", { tone: "accent" }),
        e("tail", "traces", { tone: "accent" }),
        e("traces", "evals", { tone: "violet" }),
        e("evals", "metrics", { tone: "violet", label: t("scores", "notas") }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 6,
      nodes: [
        node.agent(0, 0), node.baggage(1, 0),
        node.content(0, 1), node.redact(1, 1),
        node.collector(0, 2), node.exporter(1, 2),
        node.tail(0, 3), node.spanmetrics(1, 3),
        node.traces(0, 4), node.metrics(1, 4),
        node.evals(0, 5),
      ],
      edges: [
        e("agent", "baggage", { tone: "violet" }),
        e("baggage", "redact", { tone: "muted" }),
        e("agent", "content", { tone: "muted", dashed: true }),
        e("redact", "exporter", { tone: "danger" }),
        e("exporter", "collector", { tone: "blue" }),
        e("collector", "tail", { tone: "accent", fromShift: -30, toShift: -30 }),
        e("collector", "spanmetrics", { tone: "amber", fromShift: 30 }),
        e("tail", "traces", { tone: "accent", fromShift: -30, toShift: -30 }),
        e("spanmetrics", "metrics", { tone: "amber" }),
        e("traces", "evals", { tone: "violet", fromShift: -30, toShift: -30 }),
        e("evals", "metrics", { tone: "violet", fromShift: 40 }),
      ],
    },
  };
});

export const llmObservabilityDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "llmobs-trace-tree": llmobsTraceTree,
  "llmobs-pipeline": llmobsPipeline,
};
