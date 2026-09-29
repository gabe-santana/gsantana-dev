import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/prompt-caching-kv-cache.md
const enginePath = defineDiagram((t) => {
  const node = {
    req: (col: number, row: number, more = {}) =>
      n("req", col, row, "muted", t("Request tokens", "Tokens da requisição"), t("tools, system, history, turn", "tools, system, histórico"), more),
    hash: (col: number, row: number, more = {}) =>
      n("hash", col, row, "blue", t("Hash full blocks", "Hash dos blocos cheios"), t("16 tokens + parent hash", "16 tokens + hash do pai"), more),
    lookup: (col: number, row: number, more = {}) =>
      n("lookup", col, row, "violet", t("Longest cached prefix", "Maior prefixo em cache"), t("walk until first miss", "anda até a 1ª falha"), more),
    reuse: (col: number, row: number, more = {}) =>
      n("reuse", col, row, "accent", t("Reuse KV blocks", "Reusa blocos de KV"), t("no prefill for them", "sem prefill para eles"), more),
    prefill: (col: number, row: number, more = {}) =>
      n("prefill", col, row, "amber", t("Prefill the rest", "Prefill do resto"), t("compute K, V per layer", "calcula K, V por camada"), more),
    pool: (col: number, row: number, more = {}) =>
      n("pool", col, row, "violet", t("KV block pool", "Pool de blocos KV"), t("refcounted, LRU eviction", "refcount, despejo LRU"), more),
    decode: (col: number, row: number, more = {}) =>
      n("decode", col, row, "blue", t("Decode loop", "Loop de decode"), t("1 token/step, reads all KV", "1 token/passo, lê todo o KV"), more),
  };
  const hit = t("hit", "acerto");
  const miss = t("miss", "falha");
  return {
    title: t("PREFIX CACHE", "CACHE DE PREFIXO"),
    heading: t("WHAT THE ENGINE DOES WITH YOUR PROMPT", "O QUE O ENGINE FAZ COM O SEU PROMPT"),
    accessible: t(
      "A request's tokens are cut into full blocks of 16 tokens, and each block is hashed together with the hash of the block before it. The engine walks those hashes against its block table and stops at the first miss: everything before that point is the longest cached prefix. Cached blocks are reused with no prefill. The remaining tokens are prefilled, which computes their keys and values in every layer, and their new blocks go into the KV block pool, which is reference counted and evicts least recently used blocks. Then the decode loop generates one token per step, reading the whole KV cache each time.",
      "Os tokens de uma requisição são cortados em blocos cheios de 16 tokens, e cada bloco recebe um hash junto com o hash do bloco anterior. O engine percorre esses hashes na tabela de blocos e para na primeira falha: tudo antes desse ponto é o maior prefixo em cache. Os blocos em cache são reaproveitados sem prefill. Os tokens restantes passam pelo prefill, que calcula as chaves e valores deles em todas as camadas, e os blocos novos entram no pool de blocos de KV, que conta referências e despeja os menos usados recentemente. Depois o loop de decode gera um token por passo, lendo o cache de KV inteiro a cada vez."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 104,
      nodes: [node.req(0, 0), node.hash(1, 0), node.lookup(2, 0), node.reuse(3, 0), node.pool(1, 1), node.prefill(2, 1), node.decode(3, 1)],
      edges: [
        e("req", "hash", { tone: "muted" }),
        e("hash", "lookup", { tone: "blue" }),
        e("lookup", "reuse", { tone: "accent", label: hit }),
        e("lookup", "prefill", { tone: "amber", label: miss }),
        e("prefill", "pool", { tone: "violet", label: t("stores", "guarda") }),
        e("reuse", "decode", { tone: "accent" }),
        e("prefill", "decode", { tone: "amber" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      nodes: [
        node.req(0, 0),
        node.hash(1, 0),
        node.lookup(0.5, 1, { w: 220 }),
        node.reuse(0, 2),
        node.prefill(1, 2),
        node.decode(0, 3),
        node.pool(1, 3),
      ],
      edges: [
        e("req", "hash", { tone: "muted" }),
        e("hash", "lookup", { tone: "blue" }),
        e("lookup", "reuse", { tone: "accent", label: hit, labelSide: "left" }),
        e("lookup", "prefill", { tone: "amber", label: miss, labelSide: "right" }),
        e("prefill", "pool", { tone: "violet" }),
        e("reuse", "decode", { tone: "accent" }),
        e("pool", "decode", { tone: "violet" }),
      ],
    },
  };
});

const blockChain = defineDiagram((t) => {
  const blocks = [
    [t("Block 1", "Bloco 1"), t("tools JSON", "JSON das tools")],
    [t("Block 2", "Bloco 2"), t("system prompt", "system prompt")],
    [t("Block 3", "Bloco 3"), t("history", "histórico")],
    [t("Block 4", "Bloco 4"), t("new turn", "turno novo")],
  ] as const;
  const shared = t("same bytes, same hashes: reused", "mesmos bytes, mesmos hashes: reuso");
  const build = (mobile: boolean) => {
    const at = (i: number, request: 0 | 1) => (mobile ? { col: request, row: i } : { col: i, row: request });
    const nodes = [0, 1].flatMap((request) =>
      blocks.map(([title, detail], i) => {
        const { col, row } = at(i, request as 0 | 1);
        const diverged = request === 1 && i >= 2;
        const label = request === 0 ? `A · ${title}` : `B · ${title}`;
        const text = diverged ? (i === 2 ? t("history changed", "histórico mudou") : t("recomputed", "recalculado")) : detail;
        return n(`${request ? "b" : "a"}${i}`, col, row, diverged ? "danger" : i < 2 ? "accent" : "blue", label, text);
      })
    );
    const chainEdges = ["a", "b"].flatMap((r) =>
      [0, 1, 2].map((i) => e(`${r}${i}`, `${r}${i + 1}`, { tone: r === "b" && i >= 1 ? "danger" : "muted" }))
    );
    return {
      cols: mobile ? 2 : 4,
      rows: mobile ? 4 : 2,
      rowH: mobile ? 92 : 104,
      padTop: 56,
      zones: [
        mobile
          ? { col: 0, row: 0, span: 2, rowSpan: 2, tone: "accent" as const, dashed: true, label: shared }
          : { col: 0, row: 0, span: 2, rowSpan: 2, tone: "accent" as const, dashed: true, label: shared },
      ],
      nodes,
      edges: chainEdges,
    };
  };
  return {
    title: t("BLOCK HASHES", "HASHES DE BLOCO"),
    heading: t("A HASH COVERS EVERYTHING BEFORE IT", "UM HASH COBRE TUDO QUE VEM ANTES"),
    accessible: t(
      "Two requests, A and B, are split into four blocks each. Each block's hash is computed from its own tokens and the hash of the previous block, so it identifies the whole prefix up to that point. Blocks 1 and 2, holding the tools JSON and the system prompt, have the same bytes in both requests, so they have the same hashes and request B reuses them. In block 3 the history of B differs from A, so its hash differs, and so does the hash of every block after it, even if their tokens were identical: from there on, B is recomputed.",
      "Duas requisições, A e B, são divididas em quatro blocos cada. O hash de cada bloco é calculado a partir dos próprios tokens e do hash do bloco anterior, então ele identifica o prefixo inteiro até aquele ponto. Os blocos 1 e 2, com o JSON das tools e o system prompt, têm os mesmos bytes nas duas requisições, então têm os mesmos hashes e a requisição B os reaproveita. No bloco 3 o histórico de B é diferente do de A, então o hash muda, e muda também o hash de todos os blocos seguintes, mesmo que os tokens deles fossem idênticos: dali em diante, B é recalculada."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

const promptLayout = defineDiagram((t) => {
  const seg = {
    tools: [t("Tools", "Tools"), t("sorted by name, canonical JSON", "ordenadas por nome, JSON canônico")],
    system: [t("System prompt", "System prompt"), t("frozen: no clock, no user name", "congelado: sem relógio, sem nome")],
    history: [t("Conversation history", "Histórico da conversa"), t("append-only, never rewritten", "só cresce, nunca reescrito")],
    turn: [t("New turn", "Turno novo"), t("retrieved context, time, question", "contexto recuperado, hora, pergunta")],
  } as const;
  const when = {
    tools: t("changes per release", "muda por release"),
    system: t("changes per release", "muda por release"),
    history: t("grows per turn", "cresce por turno"),
    turn: t("changes per request", "muda por requisição"),
  };
  const tone = { tools: "accent", system: "accent", history: "blue", turn: "amber" } as const;
  const pill = { system: t("breakpoint 1", "breakpoint 1"), history: t("breakpoint 2", "breakpoint 2") } as Record<string, string>;
  const keys = ["tools", "system", "history", "turn"] as const;
  return {
    title: t("PROMPT LAYOUT", "LAYOUT DO PROMPT"),
    heading: t("STABLE FIRST, VOLATILE LAST", "ESTÁVEL PRIMEIRO, VOLÁTIL POR ÚLTIMO"),
    accessible: t(
      "The prompt is ordered from the most stable part to the most volatile one. First the tool definitions, sorted by name and serialized as canonical JSON, which change only with a release. Then the system prompt, frozen, with no clock and no user name in it, which also changes only with a release; the first cache breakpoint goes on its last block. Then the conversation history, append-only and never rewritten, which grows every turn; the second breakpoint goes on the last block of the history and moves forward each turn. Last comes the new turn, with retrieved context, the current time and the question, which changes on every request and is the only part billed at the full input price.",
      "O prompt é ordenado da parte mais estável para a mais volátil. Primeiro as definições das tools, ordenadas por nome e serializadas como JSON canônico, que só mudam com um release. Depois o system prompt, congelado, sem relógio e sem nome de usuário, que também só muda com um release; o primeiro breakpoint de cache fica no último bloco dele. Depois o histórico da conversa, que só cresce e nunca é reescrito, e aumenta a cada turno; o segundo breakpoint fica no último bloco do histórico e avança a cada turno. Por último vem o turno novo, com o contexto recuperado, a hora atual e a pergunta, que muda a cada requisição e é a única parte cobrada pelo preço cheio de input."
    ),
    desktop: {
      cols: [2, 1.2],
      rows: 4,
      rowH: 92,
      nodes: [
        ...keys.map((k, row) => n(k, 0, row, tone[k], seg[k][0], seg[k][1], { pill: pill[k] })),
        ...keys.map((k, row) => n(`${k}-when`, 1, row, "muted", when[k], undefined, { h: 36 })),
      ],
      edges: [
        e("tools", "system", { tone: "accent", fromShift: -150, toShift: -150 }),
        e("system", "history", { tone: "blue", fromShift: -150, toShift: -150 }),
        e("history", "turn", { tone: "amber", fromShift: -150, toShift: -150 }),
        ...keys.map((k) => e(k, `${k}-when`, { tone: "muted" as const, dashed: true, arrow: "none" as const })),
      ],
    },
    mobile: {
      cols: 1,
      rows: 4,
      rowH: 96,
      nodes: keys.map((k, row) =>
        n(k, 0, row, tone[k], seg[k][0], [seg[k][1], when[k]], { pill: pill[k], w: 270 })
      ),
      edges: [
        e("tools", "system", { tone: "accent", fromShift: 90, toShift: 90 }),
        e("system", "history", { tone: "blue", fromShift: 90, toShift: 90 }),
        e("history", "turn", { tone: "amber", fromShift: 90, toShift: 90 }),
      ],
    },
  };
});

export const promptCachingDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "pckv-engine-path": enginePath,
  "pckv-block-chain": blockChain,
  "pckv-prompt-layout": promptLayout,
};
