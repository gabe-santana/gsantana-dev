import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/llm-as-judge-calibration.md
const calibrationLoop = defineDiagram((t) => {
  const node = {
    sample: [t("Sample traffic", "Amostre o tráfego"), t("real prompts, every slice", "prompts reais, toda fatia")],
    label: [t("Label twice", "Rotule duas vezes"), t("two humans, blind", "duas pessoas, às cegas")],
    adjudicate: [t("Adjudicate", "Arbitre"), t("settle disagreements", "resolva as divergências")],
    frozen: [t("Calibration set", "Base de calibração"), t("versioned, 200+ items", "versionada, 200+ itens")],
    judge: [t("Run the judge", "Rode o juiz"), t("both orders, pinned", "duas ordens, fixado")],
    report: [t("Agreement report", "Concordância"), t("kappa, QWK, swaps", "kappa, QWK, trocas")],
    gate: [t("Gate", "Portão"), t("near the human ceiling?", "perto do teto humano?")],
    ship: [t("Production judge", "Juiz em produção"), t("model + prompt + rubric", "modelo + prompt + rubrica")],
  } as const;
  const make = (id: keyof typeof node, col: number, row: number, tone: Parameters<typeof n>[3]) =>
    n(id, col, row, tone, node[id][0], node[id][1]);
  return {
    title: t("JUDGE CALIBRATION", "CALIBRAÇÃO DO JUIZ"),
    heading: t("MEASURE THE RULER BEFORE YOU USE IT", "MEÇA A RÉGUA ANTES DE USAR"),
    accessible: t(
      "The calibration loop. Sample real traffic across every slice, have two people label each item blind, adjudicate their disagreements and freeze the result as a versioned calibration set of at least a couple hundred items. Run the judge on that set in both answer orders with a pinned model. Compute an agreement report with Cohen's kappa, quadratic weighted kappa and swap consistency. A gate checks whether the judge comes close to the agreement between the two humans. Only then does the judge, identified by model, prompt and rubric version, go to production. Any change to the judge sends it back through the same run on the same set.",
      "O ciclo de calibração. Amostre tráfego real de todas as fatias, peça a duas pessoas que rotulem cada item às cegas, arbitre as divergências e congele o resultado como um conjunto de calibração versionado com pelo menos algumas centenas de itens. Rode o juiz nesse conjunto nas duas ordens de resposta, com o modelo fixado. Calcule um relatório de concordância com o kappa de Cohen, o kappa ponderado quadrático e a consistência nas trocas. Um portão verifica se o juiz chega perto da concordância entre as duas pessoas. Só então o juiz, identificado por modelo, prompt e versão da rubrica, vai para produção. Qualquer mudança no juiz o manda de volta para a mesma rodada no mesmo conjunto."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 104,
      gapX: 26,
      padBottom: 44,
      nodes: [
        make("sample", 0, 0, "muted"),
        make("label", 1, 0, "blue"),
        make("adjudicate", 2, 0, "blue"),
        make("frozen", 3, 0, "accent"),
        make("judge", 3, 1, "violet"),
        make("report", 2, 1, "violet"),
        make("gate", 1, 1, "amber"),
        make("ship", 0, 1, "accent"),
      ],
      edges: [
        e("sample", "label", { tone: "muted" }),
        e("label", "adjudicate", { tone: "blue" }),
        e("adjudicate", "frozen", { tone: "blue" }),
        e("frozen", "judge", { tone: "accent" }),
        e("judge", "report", { tone: "violet" }),
        e("report", "gate", { tone: "violet" }),
        e("gate", "ship", { tone: "amber", label: t("pass", "passou"), labelTone: "amber" }),
        e("ship", "judge", {
          route: "u-bottom",
          tone: "amber",
          dashed: true,
          label: t("any judge change re-runs the set", "qualquer mudança no juiz roda o conjunto de novo"),
          labelTone: "amber",
          labelSide: "below",
          labelDy: -2,
        }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      padX: 30,
      padBottom: 20,
      nodes: [
        make("sample", 0, 0, "muted"),
        make("label", 1, 0, "blue"),
        make("frozen", 0, 1, "accent"),
        make("adjudicate", 1, 1, "blue"),
        make("judge", 0, 2, "violet"),
        make("report", 1, 2, "violet"),
        make("ship", 0, 3, "accent"),
        make("gate", 1, 3, "amber"),
      ],
      edges: [
        e("sample", "label", { tone: "muted" }),
        e("label", "adjudicate", { tone: "blue" }),
        e("adjudicate", "frozen", { tone: "blue" }),
        e("frozen", "judge", { tone: "accent" }),
        e("judge", "report", { tone: "violet" }),
        e("report", "gate", { tone: "violet" }),
        e("gate", "ship", { tone: "amber" }),
        e("ship", "judge", { route: "u-left", tone: "amber", dashed: true, offset: 18 }),
      ],
    },
  };
});

const swapTest = defineDiagram((t) => {
  const pair = [t("Answer pair", "Par de respostas"), t("ours and baseline, same prompt", "a nossa e a baseline, mesmo prompt")] as const;
  const first = [t("Call 1", "Chamada 1"), t("ours shown first", "a nossa aparece primeiro")] as const;
  const second = [t("Call 2", "Chamada 2"), t("baseline shown first", "a baseline aparece primeiro")] as const;
  const same = [t("Same winner?", "Mesmo vencedor?"), t("map slots back to systems", "traduza posição em sistema")] as const;
  const keep = [t("Keep the verdict", "Mantenha o veredito"), t("win, loss or tie", "vitória, derrota ou empate")] as const;
  const tie = [t("Count as a tie", "Conte como empate"), t("and log the flip", "e registre a inversão")] as const;
  const yes = t("yes", "sim");
  const no = t("no", "não");
  const build = (mobile: boolean) => ({
    cols: mobile ? 2 : 4,
    rows: 4,
    rowH: mobile ? 86 : 92,
    nodes: [
      n("pair", mobile ? 0.5 : 1.5, 0, "muted", pair[0], pair[1], { w: mobile ? 250 : 280 }),
      n("first", mobile ? 0 : 0.5, 1, "violet", first[0], first[1], mobile ? {} : { w: 240 }),
      n("second", mobile ? 1 : 2.5, 1, "violet", second[0], second[1], mobile ? {} : { w: 240 }),
      n("same", mobile ? 0.5 : 1.5, 2, "amber", same[0], same[1], { w: mobile ? 250 : 280 }),
      n("keep", mobile ? 0 : 0.5, 3, "accent", keep[0], keep[1], mobile ? {} : { w: 240 }),
      n("tie", mobile ? 1 : 2.5, 3, "danger", tie[0], tie[1], mobile ? {} : { w: 240 }),
    ],
    edges: [
      e("pair", "first", { tone: "muted" }),
      e("pair", "second", { tone: "muted" }),
      e("first", "same", { tone: "violet" }),
      e("second", "same", { tone: "violet" }),
      e("same", "keep", { tone: "accent", label: yes, labelTone: "accent" as const }),
      e("same", "tie", { tone: "danger", label: no, labelTone: "danger" as const }),
    ],
  });
  return {
    title: t("SWAP TEST", "TESTE DE TROCA"),
    heading: t("A WIN HAS TO SURVIVE BOTH ORDERS", "VITÓRIA SÓ SE SOBREVIVER À TROCA"),
    accessible: t(
      "The position swap test. Each answer pair, ours and the baseline for the same prompt, is judged twice: in call 1 our answer is shown first, in call 2 the baseline is shown first. Both verdicts are mapped from slot positions back to systems. If both calls name the same winner, or both call it a tie, the verdict is kept. If they disagree, the pair counts as a tie and the flip is logged, because the order of the answers decided it, not their content.",
      "O teste de troca de posição. Cada par de respostas, a nossa e a da baseline para o mesmo prompt, é julgado duas vezes: na chamada 1 a nossa resposta aparece primeiro, na chamada 2 a baseline aparece primeiro. Os dois veredictos são traduzidos de posição para sistema. Se as duas chamadas apontam o mesmo vencedor, ou ambas dão empate, o veredito é mantido. Se discordam, o par conta como empate e a inversão é registrada, porque quem decidiu foi a ordem das respostas, não o conteúdo."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

export const llmJudgeDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "llm-judge-calibration-loop": calibrationLoop,
  "llm-judge-swap-test": swapTest,
};
