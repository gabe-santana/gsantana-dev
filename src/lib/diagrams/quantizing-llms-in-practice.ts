import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/quantizing-llms-in-practice.md

const granularity = defineDiagram((t) => {
  const kinds = {
    tensor: [t("Per-tensor", "Por tensor"), t("1 scale per matrix", "1 escala por matriz"), t("no overhead", "sem custo extra")],
    channel: [t("Per-channel", "Por canal"), t("1 scale per output row", "1 escala por linha de saída"), t("+16 bits per row", "+16 bits por linha")],
    group: [t("Group-wise", "Por grupo"), t("1 scale per 32 to 128 weights", "1 escala a cada 32 a 128 pesos"), t("+0.125 to 0.5 bits per weight", "+0,125 a 0,5 bit por peso")],
  } as const;
  const effects = {
    tensor: [t("Outlier hits all", "Outlier atinge tudo"), t("64.6% error on the other rows", "64,6% de erro nas outras linhas")],
    channel: [t("Outlier hits its row", "Outlier atinge a linha"), t("0.90% error on the other rows", "0,90% de erro nas outras linhas")],
    group: [t("Outlier hits its group", "Outlier atinge o grupo"), t("the rest of the row is spared", "o resto da linha fica intacto")],
  } as const;
  const uses = {
    tensor: [t("Fine for FP8 only", "Serve só para FP8"), t("floats keep relative precision", "floats mantêm precisão relativa")],
    channel: [t("Standard for INT8", "Padrão para INT8"), t("weights, LLM.int8(), SmoothQuant", "pesos, LLM.int8(), SmoothQuant")],
    group: [t("Standard for INT4", "Padrão para INT4"), t("GPTQ, AWQ, GGUF, NF4", "GPTQ, AWQ, GGUF, NF4")],
  } as const;
  const phone = {
    tensor: [t("1 scale per matrix", "1 escala por matriz"), t("no overhead", "sem custo extra"), t("Hits everything", "Atinge tudo")],
    channel: [t("1 scale per row", "1 escala por linha"), t("+16 bits per row", "+16 bits por linha"), t("Hits its row", "Atinge a linha")],
    group: [t("1 scale per 32 to 128", "1 escala a cada 32 a 128"), t("+0.125 to 0.5 bit/weight", "+0,125 a 0,5 bit/peso"), t("Hits its group", "Atinge o grupo")],
  } as const;
  const ids = ["tensor", "channel", "group"] as const;
  const tones = { tensor: "danger", channel: "amber", group: "accent" } as const;
  return {
    title: t("GRANULARITY", "GRANULARIDADE"),
    heading: t("WHO SHARES A SCALE", "QUEM DIVIDE A MESMA ESCALA"),
    accessible: t(
      "Three ways to assign quantization scales to a weight matrix. Per-tensor uses one scale for the whole matrix at no storage cost, so a single outlier stretches the scale for every weight: in the test, one spiked weight raised the INT8 error on the other rows to 64.6%. Per-channel uses one scale per output row for 16 extra bits per row, so an outlier only hurts its own row, and the other rows stayed at 0.90% error. Group-wise uses one scale for every 32 to 128 consecutive weights, costing 0.125 to 0.5 extra bits per weight, so an outlier only hurts its group. Per-tensor scales are typical for FP8, per-channel for INT8, and group-wise for INT4 and below (GPTQ, AWQ, GGUF, NF4).",
      "Três jeitos de atribuir escalas de quantização a uma matriz de pesos. Por tensor usa uma escala para a matriz inteira, sem custo de armazenamento, então um único outlier estica a escala de todos os pesos: no teste, um peso inflado levou o erro INT8 das outras linhas a 64,6%. Por canal usa uma escala por linha de saída, com 16 bits extras por linha, então o outlier só prejudica a própria linha, e as outras ficaram em 0,90% de erro. Por grupo usa uma escala a cada 32 a 128 pesos consecutivos, com 0,125 a 0,5 bit extra por peso, então o outlier só prejudica o seu grupo. Escalas por tensor são típicas de FP8, por canal de INT8 e por grupo de INT4 para baixo (GPTQ, AWQ, GGUF, NF4)."
    ),
    desktop: {
      cols: 3,
      rows: 3,
      rowH: 104,
      nodeH: 58,
      nodes: ids.flatMap((id, col) => [
        n(id, col, 0, tones[id], kinds[id][0], [kinds[id][1], kinds[id][2]]),
        n(`${id}-effect`, col, 1, tones[id], effects[id][0], effects[id][1]),
        n(`${id}-use`, col, 2, "muted", uses[id][0], uses[id][1]),
      ]),
      edges: ids.flatMap((id) => [
        e(id, `${id}-effect`, { tone: tones[id] }),
        e(`${id}-effect`, `${id}-use`, { tone: "muted", dashed: true }),
      ]),
    },
    mobile: {
      cols: 2,
      rows: 3,
      rowH: 96,
      nodes: ids.flatMap((id, row) => [
        n(id, 0, row, tones[id], kinds[id][0], [phone[id][0], phone[id][1]]),
        n(`${id}-effect`, 1, row, tones[id], phone[id][2], uses[id][0]),
      ]),
      edges: ids.map((id) => e(id, `${id}-effect`, { tone: tones[id] })),
    },
  };
});

const outliers = defineDiagram((t) => {
  const x = [t("Activations X", "Ativações X"), t("most |x| below 1", "quase todo |x| abaixo de 1"), t("channel 1095 near 39, always", "canal 1095 perto de 39, sempre")] as const;
  const naive = [t("Naive A8 per-tensor", "A8 ingênuo por tensor"), t("the outlier sets the scale", "o outlier define a escala"), t("small values round to 0", "valores pequenos viram 0")] as const;
  const int8 = [t("LLM.int8()", "LLM.int8()"), t("outlier dims stay FP16", "dims outlier ficam em FP16"), t("the rest INT8 per token", "o resto INT8 por token")] as const;
  const smooth = [t("SmoothQuant", "SmoothQuant"), t("X / s and W times s", "X / s e W vezes s"), t("then plain W8A8", "depois W8A8 comum")] as const;
  const phone = {
    naive: [t("small values go to 0", "pequenos viram 0"), t("75% error", "75% de erro"), t("unusable", "inutilizável")],
    int8: [t("rest INT8 per token", "resto INT8 por token"), t("0.9% error", "0,9% de erro"), t("407 dims in FP16", "407 dims em FP16")],
    smooth: [t("then W8A8", "depois W8A8"), t("2.5% error", "2,5% de erro"), t("all INT8", "tudo INT8")],
  } as const;
  const results = {
    naive: [t("75% output error", "75% de erro na saída"), t("unusable", "inutilizável")],
    int8: [t("0.9% output error", "0,9% de erro na saída"), t("but 407 of 1536 dims in FP16", "mas 407 de 1536 dims em FP16")],
    smooth: [t("2.5% output error", "2,5% de erro na saída"), t("every dim in INT8", "todas as dims em INT8")],
  } as const;
  return {
    title: t("OUTLIERS", "OUTLIERS"),
    heading: t("SMOLLM2, LAYER 28", "SMOLLM2, CAMADA 28"),
    accessible: t(
      "The input to the down projection of layer 28 in SmolLM2-135M has most values below 1, but channel 1095 sits near 39 on every token. Three ways to run that matrix multiplication in 8 bits, with weights in INT8 per channel. Naive per-tensor INT8 activations let the outlier set the scale, small values round to zero, and the output error on ordinary tokens is 75%, which is unusable. LLM.int8() keeps the outlier feature dimensions in FP16 and quantizes the rest per token: 0.9% error, but 407 of the 1536 dimensions end up in FP16. SmoothQuant divides each activation channel by a factor s and multiplies the matching weight column by s, then runs plain W8A8: 2.5% error with every dimension in INT8.",
      "A entrada da projeção down da camada 28 do SmolLM2-135M tem quase todos os valores abaixo de 1, mas o canal 1095 fica perto de 39 em todo token. Três jeitos de fazer essa multiplicação de matrizes em 8 bits, com pesos INT8 por canal. Ativações INT8 ingênuas por tensor deixam o outlier definir a escala, os valores pequenos viram zero e o erro na saída dos tokens comuns é 75%, inutilizável. O LLM.int8() mantém as dimensões outlier em FP16 e quantiza o resto por token: 0,9% de erro, mas 407 das 1536 dimensões acabam em FP16. O SmoothQuant divide cada canal de ativação por um fator s e multiplica a coluna de pesos correspondente por s, e então roda W8A8 comum: 2,5% de erro com todas as dimensões em INT8."
    ),
    desktop: {
      cols: 3,
      rows: 3,
      rowH: 108,
      nodeH: 58,
      nodes: [
        n("x", 1, 0, "muted", x[0], [x[1], x[2]], { w: 260 }),
        n("naive", 0, 1, "danger", naive[0], [naive[1], naive[2]]),
        n("int8", 1, 1, "violet", int8[0], [int8[1], int8[2]]),
        n("smooth", 2, 1, "accent", smooth[0], [smooth[1], smooth[2]]),
        n("naive-r", 0, 2, "danger", results.naive[0], results.naive[1]),
        n("int8-r", 1, 2, "violet", results.int8[0], results.int8[1]),
        n("smooth-r", 2, 2, "accent", results.smooth[0], results.smooth[1]),
      ],
      edges: [
        e("x", "naive", { tone: "danger" }),
        e("x", "int8", { tone: "violet" }),
        e("x", "smooth", { tone: "accent" }),
        e("naive", "naive-r", { tone: "danger" }),
        e("int8", "int8-r", { tone: "violet" }),
        e("smooth", "smooth-r", { tone: "accent" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 100,
      nodeH: 56,
      nodes: [
        n("x", 0.5, 0, "muted", x[0], [x[1], t("channel 1095 near 39", "canal 1095 perto de 39")], { w: 240 }),
        n("naive", 0, 1, "danger", t("A8 per-tensor", "A8 por tensor"), [t("outlier sets scale", "outlier define a escala"), phone.naive[0]]),
        n("int8", 0, 2, "violet", int8[0], [t("outliers in FP16", "outliers em FP16"), phone.int8[0]]),
        n("smooth", 0, 3, "accent", smooth[0], [smooth[1], phone.smooth[0]]),
        n("naive-r", 1, 1, "danger", phone.naive[1], phone.naive[2]),
        n("int8-r", 1, 2, "violet", phone.int8[1], phone.int8[2]),
        n("smooth-r", 1, 3, "accent", phone.smooth[1], phone.smooth[2]),
      ],
      edges: [
        e("x", "naive", { tone: "muted", route: "u-left", offset: 6 }),
        e("x", "int8", { tone: "muted", route: "u-left", offset: 6 }),
        e("x", "smooth", { tone: "muted", route: "u-left", offset: 6 }),
        e("naive", "naive-r", { tone: "danger" }),
        e("int8", "int8-r", { tone: "violet" }),
        e("smooth", "smooth-r", { tone: "accent" }),
      ],
    },
  };
});

const evaluation = defineDiagram((t) => {
  const fail = t("fails", "falhou");
  const nodes = {
    candidate: [t("Quantized model", "Modelo quantizado"), t("one change at a time", "uma mudança por vez")],
    ppl: [t("Perplexity", "Perplexidade"), [t("held-out text", "texto separado"), t("catches breakage", "pega quebras")]],
    kl: [t("KL vs baseline", "KL vs baseline"), [t("per token, top-1 flips", "por token, trocas top-1"), t("catches drift", "pega desvios")]],
    tasks: [t("Task evals", "Evals de tarefa"), [t("your prompts, graded", "seus prompts, avaliados"), t("catches regressions", "pega regressões")]],
    ship: [t("Ship it", "Publique"), t("keep the numbers", "guarde os números")],
    back: [t("Back off one step", "Recue um passo"), [t("more bits, smaller groups,", "mais bits, grupos menores,"), t("keep sensitive layers", "preserve camadas sensíveis")]],
  } as const;
  return {
    title: t("MEASURE", "MEDIR"),
    heading: t("CHEAP CHECKS FIRST", "CHECAGENS BARATAS PRIMEIRO"),
    accessible: t(
      "The evaluation loop for a quantized model, changing one setting at a time. First perplexity on held-out text, which takes seconds and catches outright breakage. Then the KL divergence against the BF16 baseline and the rate of top-1 token flips, per token, which catch drift that perplexity averages away. Then task evaluations on your own graded prompts, which catch the regressions that matter. Passing all three means ship it and keep the numbers. Failing any of them means backing off one step: more bits, smaller groups, or keeping the sensitive layers in higher precision, and measuring again.",
      "O ciclo de avaliação de um modelo quantizado, mudando uma configuração por vez. Primeiro a perplexidade em texto separado, que leva segundos e pega quebras evidentes. Depois a divergência KL contra o baseline BF16 e a taxa de trocas do token top-1, por token, que pegam desvios que a perplexidade dilui na média. Depois as avaliações de tarefa nos seus próprios prompts avaliados, que pegam as regressões que importam. Passar nas três significa publicar e guardar os números. Falhar em qualquer uma significa recuar um passo: mais bits, grupos menores ou manter as camadas sensíveis em precisão maior, e medir de novo."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 118,
      nodeH: 62,
      nodes: [
        n("candidate", 0, 0, "muted", nodes.candidate[0], nodes.candidate[1]),
        n("ppl", 1, 0, "blue", nodes.ppl[0], [...nodes.ppl[1]]),
        n("kl", 2, 0, "violet", nodes.kl[0], [...nodes.kl[1]]),
        n("tasks", 3, 0, "amber", nodes.tasks[0], [...nodes.tasks[1]]),
        n("back", 1, 1, "danger", nodes.back[0], [...nodes.back[1]], { span: 2, w: 340 }),
        n("ship", 3.1, 1, "accent", nodes.ship[0], nodes.ship[1], { w: 120 }),
      ],
      edges: [
        e("candidate", "ppl", { tone: "blue" }),
        e("ppl", "kl", { tone: "violet" }),
        e("kl", "tasks", { tone: "amber" }),
        e("tasks", "ship", { tone: "accent", fromShift: 18 }),
        e("ppl", "back", { tone: "danger", dashed: true, toShift: -91, label: fail, labelTone: "danger" }),
        e("kl", "back", { tone: "danger", dashed: true, toShift: 91 }),
        e("tasks", "back", { tone: "danger", dashed: true, fromShift: -60, toShift: 155 }),
        e("back", "candidate", { tone: "muted", route: "hv", label: t("measure again", "meça de novo") }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 5,
      rowH: 92,
      nodeH: 56,
      nodes: [
        n("candidate", 0, 0, "muted", nodes.candidate[0], nodes.candidate[1]),
        n("ppl", 0, 1, "blue", nodes.ppl[0], nodes.ppl[1][0]),
        n("kl", 0, 2, "violet", nodes.kl[0], nodes.kl[1][0]),
        n("tasks", 0, 3, "amber", nodes.tasks[0], nodes.tasks[1][0]),
        n("ship", 0, 4, "accent", nodes.ship[0], nodes.ship[1]),
        n("back", 1, 2, "danger", nodes.back[0], [t("more bits,", "mais bits,"), t("smaller groups", "grupos menores")]),
      ],
      edges: [
        e("candidate", "ppl", { tone: "blue" }),
        e("ppl", "kl", { tone: "violet" }),
        e("kl", "tasks", { tone: "amber" }),
        e("tasks", "ship", { tone: "accent" }),
        e("ppl", "back", { tone: "danger", dashed: true, route: "hv", toShift: -30 }),
        e("kl", "back", { tone: "danger", dashed: true }),
        e("tasks", "back", { tone: "danger", dashed: true, route: "hv" }),
        e("back", "candidate", { tone: "muted", route: "vh", fromShift: 30 }),
      ],
    },
  };
});

export const quantizationDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "quantize-granularity": granularity,
  "quantize-outliers": outliers,
  "quantize-eval-loop": evaluation,
};
