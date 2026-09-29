import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/structured-outputs-constrained-decoding.md

const decodeStep = defineDiagram((t) => {
  const node = {
    prefix: (col: number, row: number) =>
      n("prefix", col, row, "muted", t("Prompt + output so far", "Prompt + saída até aqui"), t("tokens 1 to t", "tokens 1 a t")),
    model: (col: number, row: number) =>
      n("model", col, row, "violet", t("Model forward pass", "Forward pass do modelo"), t("one score per token", "uma nota por token")),
    state: (col: number, row: number) =>
      n("state", col, row, "amber", t("Grammar state", "Estado da gramática"), t("e.g. inside a string", "ex.: dentro de uma string")),
    mask: (col: number, row: number) =>
      n("mask", col, row, "amber", t("Allowed-token mask", "Máscara de tokens"), t("index lookup or parser", "consulta ao índice ou parser")),
    masked: (col: number, row: number) =>
      n("masked", col, row, "accent", t("Masked logits", "Logits mascarados"), t("rejected tokens get -inf", "tokens rejeitados viram -inf")),
    pick: (col: number, row: number) =>
      n("pick", col, row, "accent", t("Sample or argmax", "Amostra ou argmax"), t("only legal tokens remain", "só sobram tokens válidos")),
  };
  const append = t("append token", "anexa o token");
  const advance = t("advance state", "avança o estado");
  return {
    title: t("DECODING STEP", "PASSO DE DECODING"),
    heading: t("THE MODEL SCORES, THE GRAMMAR VETOES", "O MODELO PONTUA, A GRAMÁTICA VETA"),
    accessible: t(
      "One step of constrained decoding. The prompt and the output so far go through the model's forward pass, which produces one score, a logit, for every token in the vocabulary. In parallel, the current grammar state, for example inside a string, yields a mask of allowed tokens, either from a precomputed index or from a parser. The mask sets the logits of rejected tokens to minus infinity. Sampling or argmax then picks among the legal tokens only. The chosen token is appended to the output and advances the grammar state, and the loop repeats.",
      "Um passo de decoding com restrição. O prompt e a saída até aqui passam pelo forward pass do modelo, que produz uma nota, um logit, para cada token do vocabulário. Em paralelo, o estado atual da gramática, por exemplo dentro de uma string, gera uma máscara de tokens permitidos, vinda de um índice pré-calculado ou de um parser. A máscara coloca menos infinito nos logits dos tokens rejeitados. A amostragem ou o argmax escolhe então só entre os tokens válidos. O token escolhido é anexado à saída e avança o estado da gramática, e o ciclo se repete."
    ),
    desktop: {
      cols: 3,
      rows: 4,
      nodes: [node.prefix(0, 0), node.state(2, 0), node.model(0, 1), node.mask(2, 1), node.masked(1, 2), node.pick(1, 3)],
      edges: [
        e("prefix", "model", { tone: "violet" }),
        e("state", "mask", { tone: "amber" }),
        e("model", "masked", { tone: "violet", label: t("logits", "logits"), labelAt: "start", labelSide: "left" }),
        e("mask", "masked", { tone: "amber", label: t("mask", "máscara"), labelAt: "start", labelSide: "right" }),
        e("masked", "pick", { tone: "accent" }),
        e("pick", "prefix", { tone: "muted", dashed: true, route: "u-left", label: append, labelSide: "right" }),
        e("pick", "state", { tone: "muted", dashed: true, route: "u-right", label: advance, labelSide: "left" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      padX: 26,
      nodes: [
        n("prefix", 0, 0, "muted", t("Output so far", "Saída até aqui"), t("prompt + tokens", "prompt + tokens")),
        n("state", 1, 0, "amber", t("Grammar state", "Estado"), t("inside a string", "dentro da string")),
        n("model", 0, 1, "violet", t("Model", "Modelo"), t("a logit per token", "um logit por token")),
        n("mask", 1, 1, "amber", t("Token mask", "Máscara"), t("index or parser", "índice ou parser")),
        n("masked", 0.5, 2, "accent", t("Masked logits", "Logits mascarados"), t("rejected get -inf", "rejeitados: -inf"), { w: 190 }),
        n("pick", 0.5, 3, "accent", t("Pick a token", "Escolhe o token"), t("legal tokens only", "só tokens válidos"), { w: 190 }),
      ],
      edges: [
        e("prefix", "model", { tone: "violet" }),
        e("state", "mask", { tone: "amber" }),
        e("model", "masked", { tone: "violet" }),
        e("mask", "masked", { tone: "amber" }),
        e("masked", "pick", { tone: "accent" }),
        e("pick", "prefix", { tone: "muted", dashed: true, route: "u-left", offset: 14 }),
        e("pick", "state", { tone: "muted", dashed: true, route: "u-right", offset: 14 }),
      ],
    },
  };
});

const compilePipeline = defineDiagram((t) => {
  const node = {
    schema: (col: number, row: number) => n("schema", col, row, "muted", "JSON Schema", t("or Pydantic, Zod", "ou Pydantic, Zod")),
    grammar: (col: number, row: number) =>
      n("grammar", col, row, "blue", t("Grammar", "Gramática"), t("regex or CFG", "regex ou CFG")),
    automaton: (col: number, row: number) =>
      n("automaton", col, row, "violet", t("Automaton", "Autômato"), t("FSM, or PDA if nested", "FSM, ou PDA se aninhado")),
    index: (col: number, row: number) =>
      n("index", col, row, "accent", t("Token index", "Índice de tokens"), t("state to allowed tokens", "estado para tokens")),
    vocab: (col: number, row: number) =>
      n("vocab", col, row, "amber", t("Tokenizer vocabulary", "Vocabulário"), t("multi-char pieces", "tokens de vários chars")),
    cache: (col: number, row: number, span: number) =>
      n("cache", col, row, "muted", t("Compiled once, cached per schema", "Compilado uma vez, cache por schema"), t("the first request pays for it", "a primeira requisição paga"), { span }),
  };
  const engines = [
    n("outlines", 0, 2, "muted", "Outlines", t("regex to FSM, index", "regex para FSM, índice")),
    n("xgrammar", 1, 2, "muted", "XGrammar", t("PDA, cached masks", "PDA, máscaras em cache")),
    n("llg", 2, 2, "muted", "llguidance", t("Earley, mask per step", "Earley, máscara por passo")),
    n("gbnf", 3, 2, "muted", "llama.cpp GBNF", t("grammar rules, stack", "regras, pilha")),
  ];
  const where = t("WHERE THE ENGINES DIFFER", "ONDE OS MOTORES DIFEREM");
  return {
    title: t("SCHEMA TO MASK", "DO SCHEMA À MÁSCARA"),
    heading: t("THE EXPENSIVE PART HAPPENS BEFORE DECODING", "O CUSTO ALTO VEM ANTES DO DECODING"),
    accessible: t(
      "The compile pipeline behind structured outputs. A JSON Schema, often generated from Pydantic or Zod, becomes a grammar: a regular expression for flat schemas or a context-free grammar for nested ones. The grammar becomes an automaton: a finite-state machine, or a pushdown automaton when nesting needs a stack. Combined with the tokenizer vocabulary, whose tokens span several characters, it yields a token index that maps each state to the tokens allowed there. The result is compiled once and cached per schema, so the first request pays for it. The engines differ in how they do this: Outlines compiles a regex to an FSM and indexes it, XGrammar uses a pushdown automaton with cached masks for context-independent tokens, llguidance runs an Earley parser and computes the mask at each step, and llama.cpp interprets GBNF grammar rules with a stack.",
      "O pipeline de compilação por trás de structured outputs. Um JSON Schema, muitas vezes gerado de Pydantic ou Zod, vira uma gramática: uma expressão regular para schemas planos ou uma gramática livre de contexto para os aninhados. A gramática vira um autômato: uma máquina de estados finitos, ou um autômato de pilha quando o aninhamento pede uma pilha. Combinado com o vocabulário do tokenizer, cujos tokens têm vários caracteres, ele gera um índice que mapeia cada estado para os tokens permitidos ali. O resultado é compilado uma vez e guardado em cache por schema, então a primeira requisição paga o custo. Os motores diferem em como fazem isso: o Outlines compila uma regex para uma FSM e a indexa, o XGrammar usa um autômato de pilha com máscaras em cache para tokens independentes de contexto, o llguidance roda um parser de Earley e calcula a máscara a cada passo, e o llama.cpp interpreta regras GBNF com uma pilha."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      zones: [{ col: 0, row: 2, span: 4, tone: "muted", dashed: true, label: where }],
      nodes: [
        node.schema(0, 0), node.grammar(1, 0), node.automaton(2, 0), node.index(3, 0),
        node.cache(0, 1, 2), node.vocab(2, 1),
        ...engines,
      ],
      edges: [
        e("schema", "grammar", { tone: "blue" }),
        e("grammar", "automaton", { tone: "violet" }),
        e("automaton", "index", { tone: "accent" }),
        e("vocab", "index", { tone: "amber", route: "hv" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 6,
      zones: [{ col: 0, row: 4, span: 2, rowSpan: 2, tone: "muted", dashed: true, label: where }],
      nodes: [
        node.schema(0, 0), node.grammar(1, 0),
        n("automaton", 1, 1, "violet", t("Automaton", "Autômato"), t("FSM, or PDA", "FSM, ou PDA")),
        n("vocab", 0, 1, "amber", t("Vocabulary", "Vocabulário"), t("multi-char tokens", "tokens multi-char")),
        n("index", 1, 2, "accent", t("Token index", "Índice de tokens"), t("state to tokens", "estado para tokens")),
        n("cache", 0, 3, "muted", t("Cached per schema", "Cache por schema"), t("first request pays", "a 1a requisição paga"), { span: 2, w: 250 }),
        n("outlines", 0, 4, "muted", "Outlines", t("regex, FSM index", "regex, índice FSM")),
        n("xgrammar", 1, 4, "muted", "XGrammar", t("PDA, cached masks", "PDA, máscaras")),
        n("llg", 0, 5, "muted", "llguidance", t("Earley, per step", "Earley, por passo")),
        n("gbnf", 1, 5, "muted", "llama.cpp", t("GBNF rules", "regras GBNF")),
      ],
      edges: [
        e("schema", "grammar", { tone: "blue" }),
        e("grammar", "automaton", { tone: "violet" }),
        e("automaton", "index", { tone: "accent" }),
        e("vocab", "index", { tone: "amber", route: "vh" }),
      ],
    },
  };
});

const guarantees = defineDiagram((t) => {
  const node = {
    gen: n("gen", 0, 0, "accent", t("Constrained generation", "Geração com restrição"), t("every prefix is valid JSON so far", "todo prefixo é JSON válido até ali")),
    finish: n("finish", 0, 1, "blue", t("Did it finish?", "Terminou?"), t("stop reason, not length or refusal", "fim normal, sem limite ou recusa")),
    parse: n("parse", 0, 2, "violet", t("Parse + Pydantic", "Parse + Pydantic"), t("the constraints the grammar dropped", "as restrições que a gramática ignorou")),
    semantic: n("semantic", 0, 3, "violet", t("Semantic checks", "Checagens semânticas"), t("grounded in the source, cross-field rules", "ancorado na fonte, regras entre campos")),
    accept: n("accept", 0, 4, "accent", t("Accept", "Aceita")),
    budget: n("budget", 1, 1, "amber", t("Raise the budget", "Aumenta o limite"), t("or handle the refusal", "ou trata a recusa")),
    retry: n("retry", 1, 2, "amber", t("Retry with the error", "Retry com o erro"), t("change the input", "mude a entrada")),
    review: n("review", 1, 3, "danger", t("Typed failure", "Falha tipada"), t("human review, never a guess", "revisão humana, nunca um chute")),
  };
  const yes = t("yes", "sim");
  const ok = t("valid", "válido");
  const build = (mobile: boolean) => ({
    cols: mobile ? [1.25, 1] : [1.5, 1],
    rows: 5,
    rowH: mobile ? 86 : 88,
    nodes: mobile
      ? [
          n("gen", 0, 0, "accent", t("Constrained output", "Saída restrita"), t("valid prefix at every step", "prefixo válido a cada passo")),
          n("finish", 0, 1, "blue", t("Finished?", "Terminou?"), t("not length, not refusal", "sem limite, sem recusa")),
          n("parse", 0, 2, "violet", "Pydantic", t("constraints the grammar dropped", "o que a gramática ignorou")),
          n("semantic", 0, 3, "violet", t("Semantic checks", "Checagem semântica"), t("grounded, cross-field", "ancorado, entre campos")),
          node.accept,
          n("budget", 1, 1, "amber", t("More budget", "Mais tokens"), t("or handle refusal", "ou trata recusa")),
          n("retry", 1, 2, "amber", t("Retry", "Retry"), t("with the error", "com o erro")),
          n("review", 1, 3, "danger", t("Typed failure", "Falha tipada"), t("human review", "revisão humana")),
        ]
      : Object.values(node),
    edges: [
      e("gen", "finish", { tone: "muted" }),
      e("finish", "parse", { tone: "muted", label: yes, labelSide: "right" as const }),
      e("parse", "semantic", { tone: "muted", label: ok, labelSide: "right" as const }),
      e("semantic", "accept", { tone: "accent", label: ok, labelSide: "right" as const }),
      e("finish", "budget", { tone: "amber" }),
      e("parse", "retry", { tone: "amber" }),
      e("semantic", "review", { tone: "danger" }),
    ],
  });
  return {
    title: t("AFTER THE GRAMMAR", "DEPOIS DA GRAMÁTICA"),
    heading: t("SYNTAX IS FREE, MEANING IS YOUR JOB", "SINTAXE VEM GRÁTIS, SIGNIFICADO É COM VOCÊ"),
    accessible: t(
      "The checks that still run after constrained generation. Constrained generation guarantees only that every prefix is valid so far. First, check that generation finished normally, not because it hit the token limit or refused; otherwise raise the budget or handle the refusal. Then parse and validate with Pydantic, which enforces the constraints the grammar dropped; on failure, retry with the error and a changed input. Then run semantic checks, such as whether values are grounded in the source and cross-field rules hold; on failure, return a typed failure for human review instead of a guess. Only then accept the result.",
      "As checagens que ainda rodam depois da geração com restrição. A geração com restrição garante só que todo prefixo é válido até ali. Primeiro, confira se a geração terminou normalmente, e não por bater no limite de tokens ou por recusa; se não, aumente o limite ou trate a recusa. Depois, faça o parse e valide com Pydantic, que aplica as restrições que a gramática ignorou; se falhar, faça retry com o erro e uma entrada diferente. Depois, rode checagens semânticas, como se os valores estão ancorados na fonte e se as regras entre campos valem; se falhar, devolva uma falha tipada para revisão humana em vez de um chute. Só então aceite o resultado."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

export const structuredOutputsDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "soc-decode-step": decodeStep,
  "soc-compile-pipeline": compilePipeline,
  "soc-guarantees": guarantees,
};
