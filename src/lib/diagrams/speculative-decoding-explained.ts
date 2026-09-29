import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/speculative-decoding-explained.md

const specdecLoop = defineDiagram((t) => {
  const nodes = {
    prefix: [t("Prefix", "Prefixo"), t("tokens so far", "tokens até aqui")],
    draft: [t("Draft", "Rascunho"), t("k cheap steps", "k passos baratos")],
    proposals: [t("k proposals", "k propostas"), t("x1 ... xk and q(x)", "x1 ... xk e q(x)")],
    target: [t("Target", "Alvo"), t("one pass, k+1 rows", "uma passada, k+1 linhas")],
    verify: [t("Verify", "Verificar"), t("left to right", "da esquerda à direita")],
    emit: [t("Emit n + 1", "Emite n + 1"), t("n accepted + 1 fix", "n aceitos + 1 correção")],
  } as const;
  const node = (id: keyof typeof nodes, col: number, row: number, tone: Parameters<typeof n>[3]) =>
    n(id, col, row, tone, nodes[id][0], nodes[id][1]);
  const edges = (mobile: boolean) => [
    e("prefix", "draft", { tone: "violet" as const }),
    e("draft", "proposals", { tone: "violet" as const }),
    e("proposals", "target", { tone: "amber" as const }),
    e("target", "verify", { tone: "amber" as const }),
    e("verify", "emit", { tone: "accent" as const, label: mobile ? undefined : t("accepted prefix", "prefixo aceito") }),
    e("emit", "prefix", { tone: "accent" as const, dashed: true, label: t("repeat", "repete"), labelSide: "right" as const }),
  ];
  return {
    title: t("SPECULATIVE DECODING", "DECODIFICAÇÃO ESPECULATIVA"),
    heading: t("ONE ROUND", "UMA RODADA"),
    accessible: t(
      "One round of speculative decoding. From the current prefix, a cheap draft model proposes k tokens one at a time, keeping its probabilities q. The expensive target model then scores the prefix plus all k proposals in a single forward pass, which yields k+1 next-token distributions p. The proposals are verified left to right: each is accepted or rejected by the rejection sampling rule, and the scan stops at the first rejection. The round emits the n accepted tokens plus one more token, either a corrected token after a rejection or a bonus token when all k were accepted, and the next round starts from the longer prefix.",
      "Uma rodada de decodificação especulativa. A partir do prefixo atual, um modelo de rascunho barato propõe k tokens, um de cada vez, guardando as probabilidades q. O modelo alvo, caro, então avalia o prefixo mais as k propostas numa única passada, o que gera k+1 distribuições de próximo token p. As propostas são verificadas da esquerda para a direita: cada uma é aceita ou rejeitada pela regra de amostragem por rejeição, e a varredura para na primeira rejeição. A rodada emite os n tokens aceitos mais um token, que é uma correção depois de uma rejeição ou um bônus quando os k foram aceitos, e a próxima rodada começa do prefixo mais longo."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 104,
      padTop: 56,
      zones: [
        { col: 1, row: 0, span: 2, tone: "violet", dashed: true, label: t("cheap, sequential", "barato, sequencial") },
        { col: 3, row: 0, rowSpan: 2, tone: "amber", dashed: true, label: t("expensive, parallel", "caro, paralelo") },
      ],
      nodes: [node("prefix", 0, 0, "muted"), node("draft", 1, 0, "violet"), node("proposals", 2, 0, "violet"), node("target", 3, 0, "amber"), node("verify", 3, 1, "amber"), node("emit", 0, 1, "accent")],
      edges: edges(false),
    },
    mobile: {
      cols: 2,
      rows: 4,
      padTop: 56,
      zones: [{ col: 1, row: 0, rowSpan: 2, tone: "violet", dashed: true, label: t("cheap", "barato") }],
      nodes: [node("prefix", 0, 0, "muted"), node("draft", 1, 0, "violet"), node("proposals", 1, 1, "violet"), node("target", 1, 2, "amber"), node("verify", 1, 3, "amber"), node("emit", 0, 3, "accent")],
      edges: edges(true),
    },
  };
});

const specdecAcceptRule = defineDiagram((t) => {
  const build = (mobile: boolean) => ({
    cols: mobile ? [1.5, 1] : [1.3, 1],
    gapX: mobile ? 18 : 90,
    rows: 4,
    rowH: mobile ? 86 : 92,
    nodes: [
      n("next", 0, 0, "muted", t("Draft token x", "Token x do rascunho"), t("q(x) from draft, p(x) from target", "q(x) do rascunho, p(x) do alvo")),
      n("cmp", 0, 1, "violet", "p(x) >= q(x) ?", t("target likes it at least as much", "o alvo gosta tanto quanto ou mais")),
      n("coin", 0, 2, "violet", t("Coin flip", "Sorteio"), t("keep if u < p(x) / q(x)", "mantém se u < p(x) / q(x)")),
      n("reject", 0, 3, "danger", t("Reject, resample", "Rejeita, reamostra"), t("from max(0, p - q), then stop", "de max(0, p - q), e para")),
      n("accept", 1, 1, "accent", t("Accept x", "Aceita x"), mobile ? t("judge the next", "julga o próximo") : t("then judge the next", "e julga o próximo")),
      n("bonus", 1, 0, "amber", t("Bonus token", "Token bônus"), t("sampled from p(k+1)", "amostrado de p(k+1)")),
    ],
    edges: [
      e("next", "cmp", { tone: "muted" as const }),
      e("cmp", "accept", { tone: "accent" as const, label: t("yes", "sim"), labelTone: "accent" as const }),
      e("cmp", "coin", { tone: "muted" as const, label: t("no", "não"), labelSide: "right" as const }),
      e("coin", "accept", { tone: "accent" as const, route: "hv" as const, label: t("keep", "mantém"), labelTone: "accent" as const, labelAt: "start" as const }),
      e("coin", "reject", { tone: "danger" as const, label: t("else", "senão"), labelTone: "danger" as const, labelSide: "right" as const }),
      e("accept", "bonus", { tone: "amber" as const, label: t("after the k-th", "após o k-ésimo"), labelTone: "amber" as const, labelSide: "right" as const }),
    ],
  });
  return {
    title: t("VERIFICATION", "VERIFICAÇÃO"),
    heading: t("THE RULE THAT KEEPS IT EXACT", "A REGRA QUE MANTÉM TUDO EXATO"),
    accessible: t(
      "The acceptance rule for one draft token x, with draft probability q(x) and target probability p(x). If p(x) is at least q(x), x is accepted. Otherwise a uniform random number u is drawn and x is kept only if u is below p(x) divided by q(x). If it is not kept, the token is rejected: a replacement is sampled from the residual distribution max(0, p minus q), normalized, and the round stops. After an acceptance the next draft token is judged the same way, and when all k draft tokens are accepted the target's last distribution provides one bonus token.",
      "A regra de aceitação para um token x do rascunho, com probabilidade q(x) no rascunho e p(x) no alvo. Se p(x) for pelo menos q(x), x é aceito. Se não, sorteia-se um número uniforme u e x só fica se u for menor que p(x) dividido por q(x). Se não ficar, o token é rejeitado: um substituto é amostrado da distribuição residual max(0, p menos q), normalizada, e a rodada termina. Depois de uma aceitação, o próximo token do rascunho é julgado do mesmo jeito, e quando os k tokens são aceitos a última distribuição do alvo fornece um token bônus."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

const specdecDrafters = defineDiagram((t) => {
  const drafters = [
    ["draft", "violet", t("Draft model", "Modelo de rascunho"), t("small LM, same vocab", "LM pequeno, mesmo vocab")],
    ["lookup", "amber", t("Prompt lookup", "Prompt lookup"), t("n-grams copied from input", "n-gramas copiados da entrada")],
    ["medusa", "blue", "Medusa", t("extra heads on the target", "cabeças extras no alvo")],
    ["eagle", "accent", "EAGLE", t("tiny head on target features", "cabeça leve nas features")],
    ["lookahead", "muted", "Lookahead", t("Jacobi guesses, n-gram pool", "chutes de Jacobi, n-gramas")],
  ] as const;
  const shifts = [-104, -52, 0, 52, 104];
  const build = (mobile: boolean) => ({
    cols: mobile ? [1.35, 1] : [1.3, 0.3, 1, 1],
    rows: mobile ? 6 : 5,
    rowH: mobile ? 76 : 72,
    nodes: [
      ...drafters.map(([id, tone, title, detail], row) => n(id, 0, row, tone, title, detail)),
      n("target", mobile ? 1 : 2, 2, "amber", t("Target verifies", "Alvo verifica"), [t("one forward pass", "uma passada"), t("tree or chain", "árvore ou cadeia")], { h: 300 }),
      mobile
        ? n("out", 1, 5, "accent", t("Same dist.", "Mesma dist."), t("as target alone", "do alvo sozinho"))
        : n("out", 3, 2, "accent", t("Same distribution", "Mesma distribuição"), t("as the target alone", "que o alvo sozinho")),
    ],
    edges: [
      ...drafters.map(([id, tone], i) => e(id, "target", { tone, route: "hvh" as const, toShift: shifts[i], bend: mobile ? 0.5 : 0.6 })),
      e("target", "out", { tone: "accent" as const }),
    ],
  });
  return {
    title: t("DRAFTERS", "RASCUNHOS"),
    heading: t("WHERE THE GUESSES COME FROM", "DE ONDE VÊM OS PALPITES"),
    accessible: t(
      "Five ways to produce draft tokens, all verified the same way. A separate small draft model that shares the target's vocabulary. Prompt lookup, which copies n-grams that already appear in the input. Medusa, extra decoding heads trained on top of the target model. EAGLE, a small head that drafts from the target's own hidden features. Lookahead decoding, which uses Jacobi iteration guesses and an n-gram pool without any extra model. Every drafter feeds the target model, which verifies the guesses in one forward pass, as a chain or as a tree, and with the rejection sampling rule the output keeps the target's distribution.",
      "Cinco formas de produzir tokens de rascunho, todas verificadas do mesmo jeito. Um modelo de rascunho pequeno e separado que compartilha o vocabulário do alvo. Prompt lookup, que copia n-gramas que já aparecem na entrada. Medusa, cabeças de decodificação extras treinadas sobre o modelo alvo. EAGLE, uma cabeça pequena que rascunha a partir das features internas do próprio alvo. Lookahead decoding, que usa chutes da iteração de Jacobi e um conjunto de n-gramas sem nenhum modelo extra. Todos alimentam o modelo alvo, que verifica os palpites numa passada, em cadeia ou em árvore, e com a regra de amostragem por rejeição a saída mantém a distribuição do alvo."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

export const speculativeDecodingDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "specdec-loop": specdecLoop,
  "specdec-accept-rule": specdecAcceptRule,
  "specdec-drafters": specdecDrafters,
};
