import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/llm-serving-continuous-batching.md

const prefillDecode = defineDiagram((t) => {
  const prefill = t("Prefill", "Prefill");
  const decode = t("Decode step", "Passo de decode");
  const kv = t("KV cache", "KV cache");
  return {
    title: t("ONE REQUEST", "UMA REQUISIÇÃO"),
    heading: t("TWO PHASES, TWO BOTTLENECKS", "DUAS FASES, DOIS GARGALOS"),
    accessible: t(
      "A prompt enters prefill, which processes all of its tokens in one forward pass. Prefill is compute-bound, writes the keys and values of every prompt token into the KV cache and produces the first token, which ends the time to first token. Then the request enters the decode loop: every step reads all the model weights and the whole KV cache of the sequence, produces one token, appends one entry to the cache and repeats until an end-of-sequence token or max_tokens. Decode is memory-bandwidth-bound, and the gap between tokens is the time per output token.",
      "Um prompt entra no prefill, que processa todos os tokens dele numa única passada. O prefill é limitado por computação, grava as chaves e os valores de cada token do prompt no KV cache e produz o primeiro token, que encerra o tempo até o primeiro token. Depois a requisição entra no loop de decode: cada passo lê todos os pesos do modelo e o KV cache inteiro da sequência, produz um token, acrescenta uma entrada ao cache e repete até um token de fim de sequência ou max_tokens. O decode é limitado por largura de banda de memória, e o intervalo entre tokens é o tempo por token de saída."
    ),
    desktop: {
      cols: 3,
      rows: 3,
      rowH: 104,
      nodes: [
        n("prompt", 0, 0, "muted", t("Prompt", "Prompt"), t("hundreds of tokens at once", "centenas de tokens de uma vez")),
        n("prefill", 1, 0, "violet", prefill, [t("all prompt tokens, one pass", "todos os tokens, uma passada"), t("compute-bound", "limitado por computação")]),
        n("first", 2, 0, "accent", t("First token", "Primeiro token"), t("TTFT ends here", "o TTFT termina aqui")),
        n("weights", 0, 1, "muted", t("Weights", "Pesos"), [t("about 16 GB for 8B BF16", "cerca de 16 GB para 8B BF16"), t("read in full every step", "lidos inteiros a cada passo")]),
        n("kv", 1, 1, "blue", kv, [t("grows by one entry per token", "cresce uma entrada por token"), t("read in full every step", "lido inteiro a cada passo")]),
        n("decode", 1, 2, "amber", decode, [t("one token per sequence", "um token por sequência"), t("memory-bandwidth-bound", "limitado por banda de memória")]),
        n("next", 2, 2, "accent", t("Next token", "Próximo token"), t("the gap is TPOT / ITL", "o intervalo é o TPOT / ITL")),
      ],
      edges: [
        e("prompt", "prefill", { tone: "muted" }),
        e("prefill", "first", { tone: "accent" }),
        e("prefill", "kv", { tone: "violet", label: t("writes", "grava") }),
        e("kv", "decode", { tone: "blue", arrow: "both", label: t("reads all, appends 1", "lê tudo, acrescenta 1") }),
        e("weights", "decode", { tone: "muted", route: "vh" }),
        e("decode", "next", { tone: "amber" }),
        e("next", "decode", { tone: "amber", route: "u-bottom", dashed: true, offset: 14, label: t("until EOS or max_tokens", "até EOS ou max_tokens"), labelSide: "below", labelDy: -4 }),
      ],
      padBottom: 36,
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 92,
      nodes: [
        n("prompt", 0, 0, "muted", t("Prompt", "Prompt"), t("many tokens", "muitos tokens")),
        n("prefill", 1, 0, "violet", prefill, t("compute-bound", "limitado por computação")),
        n("first", 0, 1, "accent", t("First token", "Primeiro token"), t("TTFT ends", "fim do TTFT")),
        n("kv", 1, 1, "blue", kv, t("read every step", "lido a cada passo")),
        n("weights", 0, 2, "muted", t("Weights", "Pesos"), t("read every step", "lidos a cada passo")),
        n("decode", 1, 2, "amber", t("Decode", "Decode"), t("bandwidth-bound", "limitado por banda")),
        n("next", 1, 3, "accent", t("Next token", "Próximo token"), t("gap is TPOT", "intervalo é o TPOT")),
      ],
      edges: [
        e("prompt", "prefill", { tone: "muted" }),
        e("prefill", "first", { tone: "accent", fromShift: -40 }),
        e("prefill", "kv", { tone: "violet", fromShift: 20, toShift: 20 }),
        e("kv", "decode", { tone: "blue", arrow: "both" }),
        e("weights", "decode", { tone: "muted" }),
        e("decode", "next", { tone: "amber" }),
        e("next", "decode", { tone: "amber", route: "u-right", dashed: true, offset: 10 }),
      ],
    },
  };
});

const iterationScheduler = defineDiagram((t) => {
  const queue = t("Waiting queue", "Fila de espera");
  const scheduler = t("Scheduler", "Scheduler");
  const step = t("GPU iteration", "Iteração na GPU");
  const pool = t("KV block pool", "Pool de blocos KV");
  const finished = t("Finished", "Concluída");
  const stream = t("Stream to clients", "Stream de saída");
  return {
    title: t("CONTINUOUS BATCHING", "CONTINUOUS BATCHING"),
    heading: t("REBUILT EVERY ITERATION", "REFEITO A CADA ITERAÇÃO"),
    accessible: t(
      "Requests wait in a queue. Before every GPU iteration the scheduler admits waiting requests when the KV block pool has room, and preempts the newest running request when it runs out. The iteration runs one decode token for every running sequence first, then fills the rest of its token budget with prefill chunks. Each iteration streams one token per decoding sequence to the clients. A sequence that emits an end-of-sequence token leaves the batch right away and its blocks go back to the pool, so the next iteration can admit someone new.",
      "As requisições esperam numa fila. Antes de cada iteração na GPU, o scheduler admite requisições da fila quando o pool de blocos KV tem espaço e preempta a requisição mais nova em execução quando o espaço acaba. A iteração roda primeiro um token de decode para cada sequência em execução e depois preenche o resto do orçamento de tokens com pedaços de prefill. Cada iteração envia um token por sequência em decode para os clientes. Uma sequência que emite o token de fim sai do batch na hora e seus blocos voltam ao pool, então a próxima iteração pode admitir outra requisição."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 110,
      padTop: 64,
      nodes: [
        n("queue", 0, 0, "muted", queue, t("FCFS, Poisson arrivals", "FCFS, chegadas Poisson")),
        n("scheduler", 1, 0, "violet", scheduler, [t("admits and preempts", "admite e preempta"), t("token budget per step", "orçamento de tokens")]),
        n("step", 2, 0, "amber", step, [t("all decodes first", "todos os decodes antes"), t("then prefill chunks", "depois, o prefill")]),
        n("stream", 3, 0, "accent", stream, t("one token per sequence", "um token por sequência")),
        n("pool", 1, 1, "blue", pool, t("16-token blocks", "blocos de 16 tokens")),
        n("finished", 2, 1, "muted", finished, t("EOS or max_tokens", "EOS ou max_tokens")),
      ],
      edges: [
        e("queue", "scheduler", { tone: "muted", label: t("admit", "admite") }),
        e("scheduler", "step", { tone: "violet" }),
        e("step", "stream", { tone: "accent" }),
        e("step", "scheduler", { tone: "amber", route: "u-top", dashed: true, offset: 18, label: t("next iteration", "próxima iteração") }),
        e("scheduler", "pool", { tone: "blue", arrow: "both", label: t("allocate", "aloca") }),
        e("step", "finished", { tone: "muted", label: t("leaves now", "sai na hora") }),
        e("finished", "pool", { tone: "blue", label: t("frees", "libera"), labelSide: "below" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 90,
      nodes: [
        n("queue", 0.5, 0, "muted", queue, t("FCFS arrivals", "chegadas FCFS"), { w: 220 }),
        n("pool", 0, 1, "blue", pool, t("16-token blocks", "blocos de 16")),
        n("scheduler", 1, 1, "violet", scheduler, t("admits, preempts", "admite, preempta")),
        n("finished", 0, 2, "muted", finished, t("EOS, max_tokens", "EOS, max_tokens")),
        n("step", 1, 2, "amber", t("GPU iteration", "Iteração GPU"), t("decodes, then prefill", "decodes, depois prefill")),
        n("stream", 1, 3, "accent", t("Stream out", "Stream"), t("1 token each", "1 token cada")),
      ],
      edges: [
        e("queue", "scheduler", { tone: "muted", toShift: 30 }),
        e("scheduler", "pool", { tone: "blue", arrow: "both" }),
        e("scheduler", "step", { tone: "violet" }),
        e("step", "finished", { tone: "muted" }),
        e("finished", "pool", { tone: "blue" }),
        e("step", "stream", { tone: "accent" }),
        e("step", "scheduler", { tone: "amber", route: "u-right", dashed: true, offset: 8 }),
      ],
    },
  };
});

const pagedKv = defineDiagram((t) => {
  const contiguous = t("CONTIGUOUS: RESERVE PROMPT + MAX_TOKENS", "CONTÍGUO: RESERVA PROMPT + MAX_TOKENS");
  const paged = t("PAGED: 16-TOKEN BLOCKS ON DEMAND", "PAGINADO: BLOCOS DE 16 TOKENS SOB DEMANDA");
  return {
    title: t("KV MEMORY", "MEMÓRIA KV"),
    heading: t("SAME REQUESTS, TWO ALLOCATORS", "MESMAS REQUISIÇÕES, DOIS ALOCADORES"),
    accessible: t(
      "Two ways to lay out the KV cache of the same requests. Contiguous allocation reserves prompt plus max_tokens for each request up front: sequence A uses 1,100 of its 1,924 reserved slots, sequence B uses 350 of 1,324, and the free space left between reservations is too small for the next request, which waits. Paged allocation gives each sequence a block table that maps its logical blocks to physical blocks anywhere in a shared pool of 16-token blocks, allocated only as tokens arrive. The only waste is the unfilled part of each sequence's last block, and blocks holding a common prompt prefix can be shared.",
      "Duas formas de organizar o KV cache das mesmas requisições. A alocação contígua reserva prompt mais max_tokens para cada requisição logo de início: a sequência A usa 1.100 das 1.924 posições reservadas, a sequência B usa 350 de 1.324, e o espaço livre que sobra entre as reservas é pequeno demais para a próxima requisição, que espera. A alocação paginada dá a cada sequência uma tabela de blocos que mapeia blocos lógicos para blocos físicos em qualquer lugar de um pool compartilhado de blocos de 16 tokens, alocados só quando os tokens chegam. O único desperdício é a parte não preenchida do último bloco de cada sequência, e blocos com um prefixo de prompt em comum podem ser compartilhados."
    ),
    desktop: {
      cols: 3,
      rows: 3,
      rowH: 100,
      padTop: 56,
      zones: [
        { col: 0, row: 0, span: 3, tone: "danger", dashed: true, label: contiguous },
        { col: 0, row: 1, span: 3, rowSpan: 2, tone: "accent", label: paged },
      ],
      nodes: [
        n("a", 0, 0, "amber", t("Sequence A", "Sequência A"), t("1,100 used of 1,924", "1.100 usadas de 1.924")),
        n("b", 1, 0, "amber", t("Sequence B", "Sequência B"), t("350 used of 1,324", "350 usadas de 1.324")),
        n("gap", 2, 0, "danger", t("Leftover gap", "Sobra livre"), t("too small for the next one", "pequena demais pra próxima")),
        n("ta", 0, 1, "violet", t("Block table A", "Tabela de blocos A"), t("logical 0..68 to any block", "lógicos 0..68 em qualquer bloco")),
        n("tb", 2, 1, "violet", t("Block table B", "Tabela de blocos B"), t("logical 0..21 to any block", "lógicos 0..21 em qualquer bloco")),
        n("pool", 1, 2, "blue", t("Shared block pool", "Pool compartilhado"), [t("allocated as tokens arrive", "alocado conforme os tokens chegam"), t("waste: part of the last block", "desperdício: parte do último bloco")], { w: 250 }),
      ],
      edges: [
        e("ta", "pool", { tone: "violet", route: "vh" }),
        e("tb", "pool", { tone: "violet", route: "vh" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 3,
      rowH: 92,
      padTop: 56,
      zones: [
        { col: 0, row: 0, span: 2, tone: "danger", dashed: true, label: t("CONTIGUOUS", "CONTÍGUO") },
        { col: 0, row: 1, span: 2, rowSpan: 2, tone: "accent", label: t("PAGED", "PAGINADO") },
      ],
      nodes: [
        n("a", 0, 0, "amber", t("Seq A", "Seq A"), t("1,100 of 1,924", "1.100 de 1.924")),
        n("b", 1, 0, "amber", t("Seq B", "Seq B"), t("350 of 1,324", "350 de 1.324")),
        n("ta", 0, 1, "violet", t("Table A", "Tabela A"), t("any block", "qualquer bloco")),
        n("tb", 1, 1, "violet", t("Table B", "Tabela B"), t("any block", "qualquer bloco")),
        n("pool", 0.5, 2, "blue", t("Block pool", "Pool de blocos"), t("waste: last block only", "sobra: só o último bloco"), { w: 220 }),
      ],
      edges: [
        e("ta", "pool", { tone: "violet", toShift: -40 }),
        e("tb", "pool", { tone: "violet", toShift: 40 }),
      ],
    },
  };
});

export const llmServingDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "llmserve-prefill-decode": prefillDecode,
  "llmserve-iteration-scheduler": iterationScheduler,
  "llmserve-paged-kv": pagedKv,
};
