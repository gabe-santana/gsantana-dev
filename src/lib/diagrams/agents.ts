import { defineDiagram, e, n, type T } from "@/lib/diagrams/define";
import type { GridEdge, GridNode, GridNote } from "@/lib/diagrams/grid";
import type { Tone } from "@/lib/diagrams/types";

// content/posts/*/deterministic-tool-calling.md
function toolGateSpec(t: T, mobile: boolean) {
  const steps: { title: string; detail: string; short: string; codes: string[]; tone?: Tone }[] = [
    { title: t("0 · Loop guard", "0 · Guarda de loop"), detail: t("step budget for the session exceeded?", "orçamento de passos da sessão estourou?"), short: t("step budget exceeded?", "orçamento estourou?"), codes: ["STEP_LIMIT"] },
    { title: t("1 · Resolve", "1 · Resolve"), detail: t("known tool? on this caller's allowlist?", "tool conhecida? na allowlist do chamador?"), short: t("known? allowed?", "conhecida? permitida?"), codes: ["UNKNOWN_TOOL", "TOOL_NOT_ALLOWED"] },
    { title: t("2 · Parse", "2 · Parse"), detail: t("a valid JSON object?", "um objeto JSON válido?"), short: t("valid JSON object?", "JSON válido?"), codes: ["INVALID_JSON"] },
    { title: t("3 · Schema", "3 · Schema"), detail: t("types, enums, patterns, units, no extras", "tipos, enums, padrões, unidades, nada a mais"), short: t("types, enums, no extras", "tipos, enums, nada a mais"), codes: ["INVALID_ARGUMENTS"] },
    { title: t("4 · Idempotency", "4 · Idempotência"), detail: t("same call done already? repeated too often?", "mesma chamada já feita? repetida demais?"), short: t("done already? looping?", "já feita? em loop?"), codes: ["replay", "LOOP_DETECTED"], tone: "amber" },
    { title: t("5 · Business rules", "5 · Regras de negócio"), detail: t("order exists? currency and amount ok?", "pedido existe? moeda e valor ok?"), short: t("order, currency, amount?", "pedido, moeda, valor?"), codes: ["ORDER_NOT_FOUND", "..."] },
    { title: t("6 · Policy", "6 · Política"), detail: t("within this caller's limits?", "dentro dos limites do chamador?"), short: t("within the limits?", "dentro dos limites?"), codes: ["POLICY_LIMIT"] },
    { title: t("7 · Confirmation", "7 · Confirmação"), detail: t("high risk and not approved by a human?", "alto risco e sem aprovação humana?"), short: t("high risk, not approved?", "alto risco, sem aprovação?"), codes: ["CONFIRMATION_REQUIRED"], tone: "amber" },
    { title: t("8 · Execute", "8 · Executa"), detail: t("handler + bounded retries, same key", "handler + retries limitados, mesma chave"), short: t("handler + bounded retries", "handler + retries limitados"), codes: ["UPSTREAM_UNAVAILABLE"] },
  ];
  const nodes: GridNode[] = [
    n("output", 0, 0, "blue", t("Model output", "Saída do modelo"), mobile ? t("name + raw JSON args", "nome + args em JSON") : t("tool name + raw JSON arguments", "nome da tool + argumentos em JSON cru")),
  ];
  const edges: GridEdge[] = [];
  steps.forEach((step, i) => {
    const row = i + 1;
    const id = `step${i}`;
    const tone = step.tone ?? "danger";
    nodes.push(n(id, 0, row, "accent", step.title, mobile ? step.short : step.detail));
    const code = `code${i}`;
    if (mobile && step.codes.length > 1) {
      nodes.push(n(code, 1, row, tone, step.codes[0] ?? "", step.codes.slice(1).join(" · ")));
    } else {
      nodes.push(n(code, 1, row, tone, step.codes.join(" · "), undefined, { shape: "pill", h: mobile ? 28 : 30 }));
    }
    edges.push(e(i === 0 ? "output" : `step${i - 1}`, id, { tone: "accent" }));
    edges.push(e(id, code, { tone, width: 1.25, flow: false }));
  });
  nodes.push(
    n("result", 0, 10, "blue", "ToolResult", mobile
      ? ["{ ok, code, message, data }", t("to the model + audit log", "para o modelo + log de auditoria")]
      : t("{ ok, code, message, data } to the model and the audit log", "{ ok, code, message, data } para o modelo e o log de auditoria"))
  );
  edges.push(e("step8", "result", { tone: "accent" }));
  const notes: GridNote[] = [{ col: 1, row: 0, text: t("STOPS WITH", "PARA COM"), tone: "danger", size: 10, weight: 700, align: "center" }];
  return {
    cols: mobile ? [1, 1] : [3, 2],
    rows: 11,
    rowH: mobile ? 56 : 58,
    nodeH: mobile ? 44 : 46,
    nodes,
    edges,
    notes,
  };
}

export const toolCallGates = defineDiagram((t) => ({
  title: t("TOOL CALLS", "CHAMADAS DE TOOL"),
  heading: t("NINE GATES BEFORE ANYTHING RUNS", "NOVE PORTÕES ANTES DE EXECUTAR"),
  accessible: t(
    "The model output, a tool name plus raw JSON arguments, passes nine checks in order, and each one can stop the call with a typed code. 0, loop guard: step budget exceeded, STEP_LIMIT. 1, resolve: unknown tool or not on the caller's allowlist, UNKNOWN_TOOL or TOOL_NOT_ALLOWED. 2, parse: not a valid JSON object, INVALID_JSON. 3, schema: wrong types, enums, patterns or units, or extra fields, INVALID_ARGUMENTS. 4, idempotency: the same call already done replays its result, and too many repeats return LOOP_DETECTED. 5, business rules such as the order existing and the currency and amount matching, ORDER_NOT_FOUND and similar. 6, policy: outside the caller's limits, POLICY_LIMIT. 7, confirmation: high risk without human approval, CONFIRMATION_REQUIRED. 8, execute: the handler with bounded retries and the same key, UPSTREAM_UNAVAILABLE. The result is a ToolResult with ok, code, message and data, sent back to the model and to the audit log.",
    "A saída do modelo, um nome de tool mais argumentos em JSON cru, passa por nove verificações em ordem, e cada uma pode parar a chamada com um código tipado. 0, guarda de loop: orçamento de passos estourado, STEP_LIMIT. 1, resolução: tool desconhecida ou fora da allowlist do chamador, UNKNOWN_TOOL ou TOOL_NOT_ALLOWED. 2, parse: não é um objeto JSON válido, INVALID_JSON. 3, schema: tipos, enums, padrões ou unidades errados, ou campos a mais, INVALID_ARGUMENTS. 4, idempotência: a mesma chamada já feita devolve o resultado salvo, e repetições demais retornam LOOP_DETECTED. 5, regras de negócio, como o pedido existir e a moeda e o valor baterem, ORDER_NOT_FOUND e parecidos. 6, política: fora dos limites do chamador, POLICY_LIMIT. 7, confirmação: alto risco sem aprovação humana, CONFIRMATION_REQUIRED. 8, execução: o handler com retries limitados e a mesma chave, UPSTREAM_UNAVAILABLE. O resultado é um ToolResult com ok, code, message e data, devolvido ao modelo e ao log de auditoria."
  ),
  desktop: toolGateSpec(t, false),
  mobile: toolGateSpec(t, true),
}));

// content/posts/*/multi-agent-orchestration.md (1 of 3)
export const supervisorPattern = defineDiagram((t) => {
  const specialists = [
    ["logs", t("Logs", "Logs")],
    ["metrics", t("Metrics", "Métricas")],
    ["deploys", "Deploys"],
  ] as const;
  const build = (mobile: boolean) => ({
    cols: 3,
    rows: 5,
    rowH: mobile ? 80 : 88,
    nodes: [
      n("request", 1, 0, "muted", t("Request", "Requisição")),
      n("supervisor", 1, 1, "accent", "Supervisor", mobile ? undefined : t("owns state, budgets, trace id", "dono do estado, orçamento, trace id")),
      ...specialists.map(([id, title], col) => n(id, col, 2, "violet", title, mobile ? undefined : t("no peer calls", "sem chamar pares"))),
      n("aggregate", 1, 3, "accent", t("Aggregate", "Agrega")),
      n("finalizer", 1, 4, "blue", "Finalizer"),
      n("report", 2, 4, "muted", t("Report", "Relatório")),
    ],
    edges: [
      e("request", "supervisor", { tone: "accent" }),
      ...specialists.map(([id]) => e("supervisor", id, { tone: "violet" })),
      ...specialists.map(([id]) => e(id, "aggregate", { tone: "accent" })),
      e("aggregate", "finalizer", { tone: "blue" }),
      e("finalizer", "report", { tone: "blue" }),
    ],
    notes: mobile ? [] : [{ col: 2, row: 1, text: t("parallel when independent", "em paralelo quando independentes"), tone: "muted" as const, size: 10, align: "center" as const }],
  });
  return {
    title: t("MULTI-AGENT", "MULTIAGENTE"),
    heading: t("SUPERVISOR AND SPECIALISTS", "SUPERVISOR E ESPECIALISTAS"),
    accessible: t(
      "A request goes to a supervisor that owns the state, the budgets and the trace id. It sends tasks to three specialists, logs, metrics and deploys, in parallel when they are independent; specialists never call each other. Their results come back to an aggregate step, which passes them to a finalizer that writes the report.",
      "Uma requisição vai para um supervisor, dono do estado, dos orçamentos e do trace id. Ele manda tarefas para três especialistas, logs, métricas e deploys, em paralelo quando são independentes; especialistas nunca chamam uns aos outros. Os resultados voltam para uma etapa de agregação, que os passa para um finalizer que escreve o relatório."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

// content/posts/*/multi-agent-orchestration.md (2 of 3)
export const agentPipeline = defineDiagram((t) => {
  const stages = [
    ["request", t("Request", "Requisição"), "muted", undefined],
    ["extract", t("Extract", "Extrai"), "violet", t("typed", "tipado")],
    ["classify", t("Classify", "Classifica"), "violet", t("typed", "tipado")],
    ["draft", t("Draft reply", "Rascunho"), "violet", t("typed", "tipado")],
    ["policy", t("Policy check", "Checa política"), "violet", t("typed", "tipado")],
    ["output", t("Output", "Saída"), "accent", undefined],
  ] as const;
  const edges = stages.slice(1).map(([id], i) => e(stages[i]?.[0] ?? "", id, { tone: "violet" }));
  return {
    title: t("MULTI-AGENT", "MULTIAGENTE"),
    heading: t("A FIXED PIPELINE", "UM PIPELINE FIXO"),
    accessible: t(
      "A fixed pipeline: the request goes through extract, classify, draft reply and policy check, in that order, to the output. Every stage hands the next one a typed result.",
      "Um pipeline fixo: a requisição passa por extrair, classificar, rascunhar a resposta e checar a política, nessa ordem, até a saída. Cada etapa entrega à seguinte um resultado tipado."
    ),
    desktop: {
      cols: 6,
      rows: 1,
      gapX: 28,
      nodes: stages.map(([id, title, tone, detail], col) => n(id, col, 0, tone, title, detail)),
      edges,
    },
    mobile: {
      cols: 1,
      rows: 6,
      rowH: 62,
      nodeH: 44,
      nodes: stages.map(([id, title, tone, detail], row) => n(id, 0, row, tone, title, detail, { w: 210 })),
      edges,
    },
  };
});

// content/posts/*/multi-agent-orchestration.md (3 of 3)
export const agentHandoff = defineDiagram((t) => {
  const user = t("User", "Usuário");
  const triage = t("Triage agent", "Agente de triagem");
  const billing = t("Billing agent", "Agente de cobrança");
  const finish = t("Finish", "Encerra");
  return {
    title: t("MULTI-AGENT", "MULTIAGENTE"),
    heading: t("HANDOFFS WITH A SUMMARY", "HANDOFFS COM RESUMO"),
    accessible: t(
      "The user talks to a triage agent, which hands the conversation off to a billing agent with handoff(billing, summary). The user then talks to the billing agent, which either finishes or hands the conversation back to triage with handoff(triage, summary).",
      "O usuário conversa com um agente de triagem, que passa a conversa para um agente de cobrança com handoff(billing, summary). O usuário então conversa com o agente de cobrança, que encerra ou devolve a conversa para a triagem com handoff(triage, summary)."
    ),
    desktop: {
      cols: [2, 3, 3, 2],
      rows: 2,
      nodes: [
        n("user", 0, 0, "muted", user),
        n("triage", 1, 0, "accent", triage, undefined, { w: 150 }),
        n("billing", 2, 0, "violet", billing, undefined, { w: 150 }),
        n("user2", 3, 0, "muted", user),
        n("finish", 2, 1, "blue", finish, undefined, { w: 120 }),
      ],
      edges: [
        e("user", "triage", { tone: "muted", arrow: "both" }),
        e("triage", "billing", { tone: "accent", label: "handoff(billing, summary)", labelTone: "accent", labelDy: -24 }),
        e("billing", "user2", { tone: "muted", arrow: "both" }),
        e("billing", "finish", { tone: "blue", fromShift: 30, toShift: 30 }),
        e("billing", "triage", { tone: "violet", dashed: true, route: "u-bottom", fromShift: -40, label: "handoff(triage, summary)", labelTone: "violet", labelSide: "below" }),
      ],
    },
    mobile: {
      cols: [3, 2],
      rows: 4,
      nodes: [
        n("user", 0, 0, "muted", user, undefined, { w: 160 }),
        n("triage", 0, 1, "accent", triage, undefined, { w: 160 }),
        n("billing", 0, 2, "violet", billing, undefined, { w: 160 }),
        n("user2", 1, 2, "muted", user),
        n("finish", 0, 3, "blue", finish, undefined, { w: 120 }),
      ],
      edges: [
        e("user", "triage", { tone: "muted", arrow: "both" }),
        e("triage", "billing", { tone: "accent", label: "handoff(billing)", labelTone: "accent" }),
        e("billing", "user2", { tone: "muted", arrow: "both" }),
        e("billing", "finish", { tone: "blue" }),
        e("billing", "triage", { tone: "violet", dashed: true, route: "u-left", offset: 12 }),
      ],
      // Along the dashed return line, which runs down the left edge.
      notes: [{ col: 0, row: 1.5, text: "handoff(triage)", tone: "violet", size: 9, align: "center", vertical: true, dx: -104 }],
    },
  };
});

// content/posts/*/mcp-server-from-scratch-python.md
export const mcpIntegrations = defineDiagram((t) => {
  const tools = [t("Docs", "Docs"), "Tickets", "CRM"];
  const servers = [t("Docs server", "Servidor de docs"), t("Tickets server", "Servidor de tickets"), t("CRM server", "Servidor de CRM")];
  const hosts = ["Host A", "Host B", "Host C"];
  const without = t("WITHOUT MCP · N × M", "SEM MCP · N × M");
  const withMcp = t("WITH MCP · N + M", "COM MCP · N + M");
  const build = (mobile: boolean) => {
    const top = mobile ? 3.4 : 0;
    const col = mobile ? [0, 1, 2] : [4, 5, 6];
    const nodes: GridNode[] = [
      ...hosts.map((title, row) => n(`a${row}`, 0, row, "blue", title)),
      ...tools.map((title, row) => n(`t${row}`, 2, row, "muted", title)),
      ...hosts.map((title, row) => n(`b${row}`, col[0] ?? 0, top + row, "blue", title)),
      n("mcp", col[1] ?? 0, top + 1, "accent", "MCP", mobile ? undefined : t("one protocol", "um protocolo")),
      ...servers.map((title, row) =>
        mobile ? n(`s${row}`, col[2] ?? 0, top + row, "accent", tools[row] ?? "", t("server", "servidor")) : n(`s${row}`, col[2] ?? 0, top + row, "accent", title)
      ),
    ];
    const edges: GridEdge[] = [
      ...hosts.flatMap((_, a) => tools.map((__, b) => e(`a${a}`, `t${b}`, { route: "straight", tone: "danger", arrow: "none", width: 1 }))),
      ...hosts.map((_, row) => e(`b${row}`, "mcp", { route: "straight", tone: "accent" })),
      ...servers.map((_, row) => e("mcp", `s${row}`, { route: "straight", tone: "accent" })),
    ];
    return {
      cols: mobile ? [3, 1.6, 3] : [3, 1.2, 3, 0.8, 3, 2.4, 3],
      rows: mobile ? 6.4 : 3,
      rowH: mobile ? 62 : 80,
      nodeH: mobile ? 40 : 44,
      gapX: mobile ? 16 : 20,
      zones: [
        { col: 0, row: 0, span: 3, rowSpan: 3, tone: "danger" as const, dashed: true, label: without },
        { col: col[0] ?? 0, row: top, span: 3, rowSpan: 3, tone: "accent" as const, dashed: true, label: withMcp },
      ],
      nodes,
      edges,
    };
  };
  return {
    title: "MCP",
    heading: t("FROM N × M TO N + M", "DE N × M PARA N + M"),
    accessible: t(
      "Without MCP, every host (A, B and C) needs its own integration with every tool (Docs, Tickets and CRM): three times three, N × M connections. With MCP, each host speaks one protocol and each tool is exposed once as an MCP server (Docs server, Tickets server, CRM server): N + M connections.",
      "Sem MCP, cada host (A, B e C) precisa de uma integração própria com cada ferramenta (Docs, Tickets e CRM): três vezes três, N × M conexões. Com MCP, cada host fala um protocolo e cada ferramenta é exposta uma vez como servidor MCP (servidor de docs, de tickets e de CRM): N + M conexões."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

// content/posts/*/securing-mcp-servers.md
export const mcpTrustBoundaries = defineDiagram((t) => {
  const boundary = t("SERVER TRUST BOUNDARY", "FRONTEIRA DO SERVIDOR");
  const untrusted = t("Untrusted text", "Texto não confiável");
  const enforce = t("Enforcement layer", "Camada de controle");
  return {
    title: "MCP",
    heading: t("WHERE THE BOUNDARIES ARE", "ONDE FICAM AS FRONTEIRAS"),
    accessible: t(
      "The user talks to the host, which runs the model and the MCP client. Untrusted text reaches the model too: web pages, tickets, tool outputs and tool descriptions. The host calls the MCP server over HTTP with a bearer token, and the server calls the downstream API with its own credential. Inside the server's trust boundary, an enforcement layer applies scopes, validation, approvals, rate limits and an audit log.",
      "O usuário conversa com o host, que roda o modelo e o cliente MCP. Texto não confiável também chega ao modelo: páginas web, tickets, saídas de tools e descrições de tools. O host chama o servidor MCP por HTTP com um bearer token, e o servidor chama a API downstream com a própria credencial. Dentro da fronteira de confiança do servidor, uma camada de controle aplica escopos, validação, aprovações, rate limits e log de auditoria."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      zones: [{ col: 2, row: 1, rowSpan: 2, tone: "accent", dashed: true, label: boundary }],
      nodes: [
        n("untrusted", 1, 0, "danger", untrusted, [t("web pages, tickets,", "páginas web, tickets,"), t("tool outputs, descriptions", "saídas e descrições de tools")]),
        n("user", 0, 1, "muted", t("User", "Usuário")),
        n("host", 1, 1, "blue", "Host", t("model + MCP client", "modelo + cliente MCP")),
        n("server", 2, 1, "accent", t("MCP server", "Servidor MCP"), t("HTTP + bearer token in", "recebe HTTP + bearer token")),
        n("api", 3, 1, "muted", t("Downstream API", "API downstream"), t("server's own credential", "credencial do servidor")),
        n("enforce", 2, 2, "amber", enforce, [t("scopes, validation, approvals,", "escopos, validação, aprovações,"), t("rate limits, audit log", "rate limits, log de auditoria")]),
      ],
      edges: [
        e("untrusted", "host", { tone: "danger", dashed: true }),
        e("user", "host", { tone: "blue" }),
        e("host", "server", { tone: "accent" }),
        e("server", "api", { tone: "muted" }),
        e("server", "enforce", { tone: "amber", dashed: true, arrow: "none" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 90,
      zones: [{ col: 0, row: 2, span: 2, tone: "accent", dashed: true, label: boundary }],
      nodes: [
        n("untrusted", 1, 0, "danger", untrusted, [t("web pages, tickets,", "páginas web, tickets,"), t("tool outputs", "saídas de tools")]),
        n("user", 0, 1, "muted", t("User", "Usuário")),
        n("host", 1, 1, "blue", "Host", t("model + MCP client", "modelo + cliente MCP")),
        n("enforce", 0, 2, "amber", enforce, [t("scopes, approvals,", "escopos, aprovações,"), t("rate limits, audit", "rate limits, auditoria")]),
        n("server", 1, 2, "accent", t("MCP server", "Servidor MCP"), "HTTP + bearer token"),
        n("api", 1, 3, "muted", t("Downstream API", "API downstream"), t("server's own credential", "credencial do servidor")),
      ],
      edges: [
        e("untrusted", "host", { tone: "danger", dashed: true }),
        e("user", "host", { tone: "blue" }),
        e("host", "server", { tone: "accent" }),
        e("server", "enforce", { tone: "amber", dashed: true, arrow: "none" }),
        e("server", "api", { tone: "muted" }),
      ],
    },
  };
});
