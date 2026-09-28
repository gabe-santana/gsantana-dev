import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/laya-email-security-screener.md
export const layaScreenerPipeline = defineDiagram((t) => {
  const laya = t("Laya · one forward pass", "Laya · uma passada");
  const signals = t("Signals · plain code", "Sinais · código comum");
  const verdicts = {
    deliver: t("Deliver", "Entregar"),
    warn: t("Warn", "Alertar"),
    quarantine: t("Quarantine", "Quarentena"),
  };
  return {
    title: "LAYA-CLASSIFIER",
    heading: t("THE TEXT AND THE EVIDENCE, READ SEPARATELY", "O TEXTO E AS EVIDÊNCIAS, LIDOS SEPARADOS"),
    accessible: t(
      "An incoming email is parsed into its headers, body, links and attachments. The sender, subject and body go to Laya, which answers five typed questions in one forward pass, routed to the English or the multilingual checkpoint. The headers, links and attachments go to deterministic checks: SPF, DKIM and DMARC results, lookalike domains, links whose text hides their destination, and attachments that can run code. A policy combines Laya's probabilities with those facts into one of three verdicts: deliver, warn or quarantine.",
      "Um e-mail que chega é separado em cabeçalhos, corpo, links e anexos. O remetente, o assunto e o corpo vão para o Laya, que responde cinco perguntas tipadas numa única passada, roteadas para o checkpoint em inglês ou o multilíngue. Os cabeçalhos, links e anexos vão para verificações determinísticas: resultados de SPF, DKIM e DMARC, domínios parecidos, links cujo texto esconde o destino e anexos que podem executar código. Uma política combina as probabilidades do Laya com esses fatos em um de três veredictos: entregar, alertar ou quarentena."
    ),
    desktop: {
      cols: 4,
      rows: 5,
      rowH: 100,
      nodes: [
        n("email", 1.5, 0, "muted", t("Incoming email", "E-mail recebido"), t(".eml: headers, body, links, files", ".eml: cabeçalhos, corpo, links, anexos"), { w: 260 }),
        n("parse", 1.5, 1, "muted", t("Parse", "Parse"), t("Python's email package, HTML to text", "pacote email do Python, HTML em texto"), { w: 260 }),
        n("laya", 0, 2, "violet", laya, [
          t("reads the sender, subject and body", "lê o remetente, o assunto e o corpo"),
          t("answers 5 typed questions", "responde 5 perguntas tipadas"),
        ], { span: 2 }),
        n("signals", 2, 2, "amber", signals, [
          t("reads the headers, links and files", "lê os cabeçalhos, links e anexos"),
          t("SPF, DKIM, DMARC, lookalikes", "SPF, DKIM, DMARC, domínios parecidos"),
        ], { span: 2 }),
        n("policy", 1.5, 3, "accent", t("Policy", "Política"), t("Laya's risk + the evidence", "risco do Laya + as evidências"), { w: 260 }),
        n("deliver", 0.5, 4, "accent", verdicts.deliver, undefined, { w: 150 }),
        n("warn", 1.5, 4, "amber", verdicts.warn, undefined, { w: 150 }),
        n("quarantine", 2.5, 4, "danger", verdicts.quarantine, undefined, { w: 150 }),
      ],
      edges: [
        e("email", "parse", { tone: "muted" }),
        e("parse", "laya", { tone: "violet" }),
        e("parse", "signals", { tone: "amber" }),
        e("laya", "policy", { tone: "violet" }),
        e("signals", "policy", { tone: "amber" }),
        e("policy", "deliver", { tone: "accent" }),
        e("policy", "warn", { tone: "amber" }),
        e("policy", "quarantine", { tone: "danger" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 6,
      rowH: 92,
      nodes: [
        n("email", 0.5, 0, "muted", t("Incoming email", "E-mail recebido"), t("headers, body, links, files", "cabeçalhos, corpo, links, anexos"), { w: 250 }),
        n("parse", 0.5, 1, "muted", "Parse", t("Python's email package", "pacote email do Python"), { w: 250 }),
        n("laya", 0, 2, "violet", "Laya", [t("5 questions", "5 perguntas"), t("1 forward pass", "1 passada")]),
        n("signals", 1, 2, "amber", t("Signals", "Sinais"), [t("headers, links", "cabeçalhos, links"), t("attachments", "anexos")]),
        n("policy", 0.5, 3, "accent", t("Policy", "Política"), t("Laya's risk + evidence", "risco do Laya + evidências"), { w: 250 }),
        n("deliver", 0, 4, "accent", verdicts.deliver),
        n("warn", 1, 4, "amber", verdicts.warn),
        n("quarantine", 0.5, 5, "danger", verdicts.quarantine, undefined, { w: 160 }),
      ],
      edges: [
        e("email", "parse", { tone: "muted" }),
        e("parse", "laya", { tone: "violet" }),
        e("parse", "signals", { tone: "amber" }),
        e("laya", "policy", { tone: "violet" }),
        e("signals", "policy", { tone: "amber" }),
        e("policy", "deliver", { tone: "accent" }),
        e("policy", "warn", { tone: "amber" }),
        e("policy", "quarantine", { tone: "danger", route: "straight" }),
      ],
    },
  };
});

export const layaVerdictRules = defineDiagram((t) => {
  const yes = t("yes", "sim");
  const no = t("no", "não");
  const checks = {
    decisive: [t("Decisive signal?", "Sinal decisivo?"), t("disguised link, executable or HTML file", "link disfarçado, executável ou HTML")],
    hard: [t("Hard evidence + some suspicion?", "Evidência forte + alguma suspeita?"), t("high-severity signal, Laya risk ≥ 0.3", "sinal grave, risco do Laya ≥ 0,3")],
    sure: [t("Is Laya confident?", "O Laya está confiante?"), t("Laya risk ≥ 0.5", "risco do Laya ≥ 0,5")],
    any: [t("Anything suspicious?", "Algo suspeito?"), t("any signal, or Laya risk ≥ 0.3", "qualquer sinal, ou risco do Laya ≥ 0,3")],
  } as const;
  const build = (mobile: boolean) => ({
    cols: mobile ? [1.9, 1] : [2.2, 1],
    rows: 5,
    rowH: mobile ? 84 : 86,
    nodes: [
      ...(Object.entries(checks) as [keyof typeof checks, readonly [string, string]][]).map(([id, [title, detail]], row) =>
        n(id, 0, row, "violet", mobile && id === "hard" ? t("Evidence + suspicion?", "Evidência + suspeita?") : title, detail)
      ),
      n("deliver", 0, 4, "accent", t("Deliver", "Entregar")),
      n("quarantine", 1, 1, "danger", t("Quarantine", "Quarentena")),
      n("warn", 1, 3, "amber", t("Warn", "Alertar")),
    ],
    edges: [
      e("decisive", "hard", { tone: "muted", label: no, labelSide: "right" as const }),
      e("hard", "sure", { tone: "muted", label: no, labelSide: "right" as const }),
      e("sure", "any", { tone: "muted", label: no, labelSide: "right" as const }),
      e("any", "deliver", { tone: "muted", label: no, labelSide: "right" as const }),
      e("decisive", "quarantine", { tone: "danger", route: "hv" as const, label: yes, labelTone: "danger" as const, labelAt: "start" as const }),
      e("hard", "quarantine", { tone: "danger", label: yes, labelTone: "danger" as const }),
      e("sure", "quarantine", { tone: "danger", route: "hv" as const, label: yes, labelTone: "danger" as const, labelAt: "start" as const }),
      e("any", "warn", { tone: "amber", label: yes, labelTone: "amber" as const }),
    ],
  });
  return {
    title: t("VERDICT", "VEREDICTO"),
    heading: t("EVIDENCE FIRST, THEN LAYA'S CONFIDENCE", "EVIDÊNCIA PRIMEIRO, DEPOIS A CONFIANÇA DO LAYA"),
    accessible: t(
      "The policy asks four questions in order. A decisive signal, such as a link whose text hides its destination or an executable or HTML attachment, quarantines the email. Otherwise, a high-severity signal together with a Laya risk of at least 0.3 quarantines it. Otherwise, a Laya risk of at least 0.5 quarantines it on its own. Otherwise, any signal or a Laya risk of at least 0.3 produces a warning. Everything else is delivered. Laya's risk is the higher of its phishing answer and its social engineering score.",
      "A política faz quatro perguntas em ordem. Um sinal decisivo, como um link cujo texto esconde o destino ou um anexo executável ou HTML, manda o e-mail para a quarentena. Se não, um sinal grave junto com um risco do Laya de pelo menos 0,3 manda para a quarentena. Se não, um risco do Laya de pelo menos 0,5 manda sozinho para a quarentena. Se não, qualquer sinal ou um risco do Laya de pelo menos 0,3 gera um alerta. O resto é entregue. O risco do Laya é o maior entre a resposta sobre phishing e a pontuação de engenharia social."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

export const layaDiagrams = {
  "laya-screener-pipeline": layaScreenerPipeline,
  "laya-verdict-rules": layaVerdictRules,
};
