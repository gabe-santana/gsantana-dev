import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/context-engineering-long-running-agents.md
const ctxEngPolicyLoop = defineDiagram((t) => {
  const yes = t("yes", "sim");
  const no = t("no", "não");
  return {
    title: t("CONTEXT POLICY", "POLÍTICA DE CONTEXTO"),
    heading: t("CHEAPEST FIX FIRST", "O MAIS BARATO PRIMEIRO"),
    accessible: t(
      "Before every request the manager counts the tokens of the history plus the new turn. If the total is under the 30k trigger, the request goes out as is. Otherwise it first clears stale tool results: every call stays in the history, but the payloads of all but the three newest results become short stubs, and only if that frees at least 10k tokens. If the context is still over 20k after clearing, it compacts: older turns become one summary that carries the task, decisions, open tasks, errors, file paths and the notes file, and the last ten messages stay word for word. Then the request is sent, with the stable system prompt and tools first so the prompt cache keeps working.",
      "Antes de cada requisição o gerenciador conta os tokens do histórico mais o turno novo. Se o total está abaixo do gatilho de 30k, a requisição sai como está. Se não, ele primeiro limpa resultados de ferramenta antigos: toda chamada continua no histórico, mas o payload de todos os resultados, menos os três mais novos, vira um stub curto, e só se isso liberar pelo menos 10k tokens. Se o contexto continua acima de 20k depois da limpeza, ele compacta: os turnos antigos viram um resumo com a tarefa, as decisões, as tarefas abertas, os erros, os caminhos de arquivo e o arquivo de notas, e as últimas dez mensagens ficam palavra por palavra. Aí a requisição é enviada, com o system prompt e as ferramentas estáveis primeiro, para o cache de prompt continuar funcionando."
    ),
    desktop: {
      cols: [1.3, 1],
      rows: 5,
      gapX: 60,
      nodes: [
        n("turn", 0, 0, "muted", t("History + new turn", "Histórico + turno novo"), t("count tokens (tiktoken)", "conta tokens (tiktoken)")),
        n("over", 0, 1, "violet", t("Over the 30k trigger?", "Acima do gatilho de 30k?")),
        n("clear", 0, 2, "accent", t("Clear stale tool results", "Limpa resultados antigos"), [
          t("keep the call, drop the payload", "mantém a chamada, tira o payload"),
          t("only when it frees 10k or more", "só quando libera 10k ou mais"),
        ]),
        n("still", 0, 3, "violet", t("Still over 20k?", "Ainda acima de 20k?")),
        n("compact", 0, 4, "amber", t("Compact old turns", "Compacta turnos antigos"), [
          t("summary + notes file", "resumo + arquivo de notas"),
          t("last 10 messages verbatim", "últimas 10 mensagens intactas"),
        ]),
        n("send", 1, 4, "blue", t("Send request", "Envia a requisição"), t("stable prefix first", "prefixo estável primeiro")),
      ],
      edges: [
        e("turn", "over", { tone: "muted" }),
        e("over", "clear", { tone: "accent", label: yes, labelTone: "accent" }),
        e("clear", "still", { tone: "accent" }),
        e("still", "compact", { tone: "amber", label: yes, labelTone: "amber" }),
        e("compact", "send", { tone: "amber" }),
        e("over", "send", { tone: "blue", route: "hv", toShift: 40, label: no, labelAt: "start" }),
        e("still", "send", { tone: "blue", route: "hv", toShift: -20, label: no, labelAt: "start" }),
      ],
    },
    mobile: {
      cols: [1.5, 1],
      rows: 5,
      nodes: [
        n("turn", 0, 0, "muted", t("History + turn", "Histórico + turno"), t("count tokens", "conta tokens")),
        n("over", 0, 1, "violet", t("Over 30k?", "Acima de 30k?")),
        n("clear", 0, 2, "accent", t("Clear old results", "Limpa resultados"), [t("keep calls, drop payloads", "mantém chamadas"), t("only if it frees 10k+", "só se liberar 10k+")]),
        n("still", 0, 3, "violet", t("Still over 20k?", "Ainda acima de 20k?")),
        n("compact", 0, 4, "amber", t("Compact old turns", "Compacta o antigo"), [t("summary + notes", "resumo + notas"), t("last 10 kept", "últimas 10 ficam")]),
        n("send", 1, 4, "blue", t("Send", "Envia")),
      ],
      edges: [
        e("turn", "over", { tone: "muted" }),
        e("over", "clear", { tone: "accent", label: yes, labelTone: "accent" }),
        e("clear", "still", { tone: "accent" }),
        e("still", "compact", { tone: "amber", label: yes, labelTone: "amber" }),
        e("compact", "send", { tone: "amber" }),
        e("over", "send", { tone: "blue", route: "hv", toShift: 24, label: no, labelAt: "start" }),
        e("still", "send", { tone: "blue", route: "hv", toShift: -12, label: no, labelAt: "start" }),
      ],
    },
  };
});

const ctxEngWindowAnatomy = defineDiagram((t) => {
  const inside = t("INSIDE THE WINDOW", "DENTRO DA JANELA");
  const outside = t("OUTSIDE, ON DEMAND", "FORA, SOB DEMANDA");
  const stack = {
    system: [t("System prompt + tools", "System prompt + ferramentas"), t("stable prefix, cached", "prefixo estável, em cache")],
    summary: [t("Summary of old turns", "Resumo dos turnos antigos"), t("task, decisions, TODOs, errors", "tarefa, decisões, TODOs, erros")],
    stubs: [t("Cleared tool results", "Resultados limpos"), t("call kept, first error kept", "chamada e primeiro erro ficam")],
    recent: [t("Recent turns", "Turnos recentes"), t("last 10 messages, verbatim", "últimas 10 mensagens, intactas")],
    newest: [t("Newest tool results", "Resultados mais novos"), t("the 3 newest, in full", "os 3 mais novos, completos")],
  } as const;
  return {
    title: t("CONTEXT WINDOW", "JANELA DE CONTEXTO"),
    heading: t("WHAT THE MODEL SEES", "O QUE O MODELO VÊ"),
    accessible: t(
      "Each request carries five layers, in order: the system prompt and tool definitions, which never change and stay in the prompt cache; one summary of the old turns with the task, decisions, open tasks and errors; the cleared tool results, where each call stays but its payload became a short stub that keeps the first error line; the recent turns word for word; and the newest three tool results in full. Outside the window, and pulled in only when needed, are the prompt cache, the NOTES.md file the agent writes and reads (copied into the summary at compaction), sub-agents that explore in their own context and return one to two thousand tokens, and files and search that the agent reads just in time.",
      "Cada requisição leva cinco camadas, em ordem: o system prompt e as definições de ferramentas, que nunca mudam e ficam no cache de prompt; um resumo dos turnos antigos com a tarefa, as decisões, as tarefas abertas e os erros; os resultados de ferramenta limpos, em que cada chamada fica mas o payload virou um stub curto que guarda a primeira linha de erro; os turnos recentes palavra por palavra; e os três resultados de ferramenta mais novos, completos. Fora da janela, e trazidos só quando necessário, estão o cache de prompt, o arquivo NOTES.md que o agente escreve e lê (copiado para o resumo na compactação), subagentes que exploram no próprio contexto e devolvem mil a dois mil tokens, e arquivos e busca que o agente lê na hora em que precisa."
    ),
    desktop: {
      cols: [1.35, 1],
      rows: 5,
      gapX: 110,
      nodes: [
        n("system", 0, 0, "blue", stack.system[0], stack.system[1]),
        n("summary", 0, 1, "amber", stack.summary[0], stack.summary[1]),
        n("stubs", 0, 2, "muted", stack.stubs[0], stack.stubs[1]),
        n("recent", 0, 3, "accent", stack.recent[0], stack.recent[1]),
        n("newest", 0, 4, "accent", stack.newest[0], stack.newest[1]),
        n("cache", 1, 0, "blue", t("Prompt cache", "Cache de prompt"), t("reads cost a fraction", "leitura custa uma fração")),
        n("notes", 1, 1, "violet", "NOTES.md", t("the agent writes and reads it", "o agente escreve e lê")),
        n("sub", 1, 3, "violet", t("Sub-agent", "Subagente"), t("explores in its own context", "explora no próprio contexto")),
        n("files", 1, 4, "violet", t("Files and search", "Arquivos e busca"), t("read_file, grep, just in time", "read_file, grep, na hora")),
      ],
      zones: [
        { col: 0, row: 0, rowSpan: 5, label: inside, tone: "accent", dashed: true },
        { col: 1, row: 0, rowSpan: 5, label: outside, tone: "violet", dashed: true },
      ],
      edges: [
        e("system", "cache", { tone: "blue", arrow: "both", flow: false }),
        e("notes", "summary", { tone: "violet", label: t("at compaction", "na compactação") }),
        e("sub", "recent", { tone: "violet", label: t("1-2k tokens", "1-2k tokens") }),
        e("files", "newest", { tone: "violet", label: t("on demand", "sob demanda") }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 7.5,
      nodes: [
        n("system", 0, 0, "blue", t("System + tools", "System + ferramentas"), t("stable prefix, cached", "prefixo estável, em cache"), { span: 2 }),
        n("summary", 0, 1, "amber", t("Summary of old turns", "Resumo do que é antigo"), t("task, decisions, TODOs", "tarefa, decisões, TODOs"), { span: 2 }),
        n("stubs", 0, 2, "muted", t("Cleared results", "Resultados limpos"), t("call and first error kept", "chamada e 1º erro ficam"), { span: 2 }),
        n("recent", 0, 3, "accent", t("Recent turns", "Turnos recentes"), t("last 10, verbatim", "últimas 10, intactas"), { span: 2 }),
        n("newest", 0, 4, "accent", t("Newest results", "Resultados novos"), t("3 kept in full", "3 completos"), { span: 2 }),
        n("notes", 0, 5.4, "violet", "NOTES.md", t("into the summary", "vai para o resumo")),
        n("sub", 1, 5.4, "violet", t("Sub-agent", "Subagente"), t("returns 1-2k", "devolve 1-2k")),
        n("files", 0, 6.4, "violet", t("Files, search", "Arquivos, busca"), t("just in time", "sob demanda")),
        n("cache", 1, 6.4, "blue", t("Prompt cache", "Cache de prompt"), t("cheap reads", "leitura barata")),
      ],
      zones: [
        { col: 0, row: 0, span: 2, rowSpan: 5, label: inside, tone: "accent", dashed: true },
        { col: 0, row: 5.25, span: 2, rowSpan: 2.25, label: outside, tone: "violet", dashed: true },
      ],
    },
  };
});

export const contextEngineeringDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "ctx-eng-policy-loop": ctxEngPolicyLoop,
  "ctx-eng-window-anatomy": ctxEngWindowAnatomy,
};
