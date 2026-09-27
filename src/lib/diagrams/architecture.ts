import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/multi-cloud-patterns.md
export const multiCloudReference = defineDiagram((t) => {
  const federated = t("federated trust", "confiança federada");
  const interconnect = t("private interconnect", "interconexão privada");
  const otel = t("OTel collector", "Coletor OTel");
  return {
    title: "MULTI-CLOUD",
    heading: t("AZURE + AWS, ONE CONTROL PLANE", "AZURE + AWS, UM PLANO DE CONTROLE"),
    accessible: t(
      "GitHub repositories and Actions deploy to both clouds with OIDC tokens and no stored cloud keys, through federated trust with each. In Azure, a hub VNet with firewall and DNS connects spokes for ERP and identity and for the AI platform (Azure OpenAI), with Key Vault for Azure secrets and Entra ID as the workforce identity provider. In AWS, a Transit Gateway or hub VPC connects spokes for e-commerce on EKS and analytics on a data lake, with Secrets Manager for AWS secrets and IAM Identity Center. The two hubs talk over a private interconnect, ExpressRoute to Direct Connect through a colocation partner, and Entra ID federates into IAM Identity Center with SAML or OIDC. OpenTelemetry collectors in each cloud feed one observability backend for logs, metrics, traces and SLOs.",
      "Os repositórios e o Actions do GitHub fazem deploy nas duas nuvens com tokens OIDC e sem chaves de nuvem guardadas, por confiança federada com cada uma. No Azure, uma VNet hub com firewall e DNS conecta spokes de ERP e identidade e da plataforma de IA (Azure OpenAI), com o Key Vault para os segredos do Azure e o Entra ID como provedor de identidade dos funcionários. Na AWS, um Transit Gateway ou VPC hub conecta spokes de e-commerce no EKS e de analytics num data lake, com o Secrets Manager para os segredos da AWS e o IAM Identity Center. Os dois hubs conversam por uma interconexão privada, ExpressRoute com Direct Connect via um parceiro de colocation, e o Entra ID federa no IAM Identity Center com SAML ou OIDC. Coletores OpenTelemetry em cada nuvem alimentam um backend único de observabilidade para logs, métricas, traces e SLOs."
    ),
    desktop: {
      cols: 5,
      rows: 6,
      zones: [
        { col: 0, row: 1, span: 2, rowSpan: 4, tone: "blue", label: "AZURE" },
        { col: 3, row: 1, span: 2, rowSpan: 4, tone: "amber", label: "AWS" },
      ],
      nodes: [
        n("github", 2, 0, "muted", "GitHub", [t("repos + Actions", "repos + Actions"), t("OIDC, no cloud keys", "OIDC, sem chaves")]),
        n("azHub", 0, 1, "blue", t("Hub VNet", "VNet hub"), t("firewall, DNS", "firewall, DNS"), { span: 2 }),
        n("awsHub", 3, 1, "amber", "Transit Gateway", t("hub VPC", "VPC hub"), { span: 2 }),
        n("erp", 0, 2, "blue", "ERP + identity", "spoke"),
        n("ai", 1, 2, "blue", t("AI platform", "Plataforma de IA"), "Azure OpenAI"),
        n("ecom", 3, 2, "amber", "E-commerce", "EKS"),
        n("analytics", 4, 2, "amber", "Analytics", "data lake"),
        n("kv", 0, 3, "blue", "Key Vault", t("Azure secrets", "segredos do Azure")),
        n("entra", 1, 3, "blue", "Entra ID", t("workforce IdP", "IdP dos funcionários")),
        n("iam", 3, 3, "amber", "Identity Center", "AWS IAM"),
        n("sm", 4, 3, "amber", "Secrets Manager", t("AWS secrets", "segredos da AWS")),
        n("azOtel", 0.5, 4, "muted", otel),
        n("awsOtel", 3.5, 4, "muted", otel),
        n("obs", 1.5, 5, "accent", t("Observability backend", "Backend de observabilidade"), t("logs, metrics, traces, SLOs", "logs, métricas, traces, SLOs"), { span: 2 }),
      ],
      edges: [
        e("github", "azHub", { tone: "muted", fromShift: -30, bend: 0.15, label: federated }),
        e("github", "awsHub", { tone: "muted", fromShift: 30, bend: 0.15, label: federated }),
        e("azHub", "awsHub", { tone: "accent", arrow: "both", width: 2.5, label: interconnect, labelTone: "accent" }),
        e("azHub", "erp", { tone: "blue", fromShift: -30 }),
        e("azHub", "ai", { tone: "blue", fromShift: 30 }),
        e("awsHub", "ecom", { tone: "amber", fromShift: -30 }),
        e("awsHub", "analytics", { tone: "amber", fromShift: 30 }),
        e("entra", "iam", { tone: "violet", label: "SAML / OIDC", labelTone: "violet" }),
        e("azOtel", "obs", { tone: "accent" }),
        e("awsOtel", "obs", { tone: "accent" }),
      ],
      notes: [{ col: 2, row: 1, text: "ExpressRoute ↔ Direct Connect", tone: "muted", size: 9, align: "center", dy: 14 }],
    },
    mobile: {
      cols: 2,
      rows: 7,
      rowH: 86,
      zones: [
        { col: 0, row: 1, rowSpan: 5, tone: "blue", label: "AZURE", insetX: 7 },
        { col: 1, row: 1, rowSpan: 5, tone: "amber", label: "AWS", insetX: 7 },
      ],
      nodes: [
        n("github", 0.5, 0, "muted", "GitHub", t("OIDC, no cloud keys", "OIDC, sem chaves")),
        n("azHub", 0, 1, "blue", t("Hub VNet", "VNet hub"), "firewall, DNS"),
        n("awsHub", 1, 1, "amber", "Transit Gateway", t("hub VPC", "VPC hub")),
        n("azSpokes", 0, 2, "blue", "Spokes", ["ERP + identity", "AI (Azure OpenAI)"]),
        n("awsSpokes", 1, 2, "amber", "Spokes", ["E-commerce (EKS)", "Analytics (data lake)"]),
        n("kv", 0, 3, "blue", "Key Vault"),
        n("sm", 1, 3, "amber", "Secrets Manager"),
        n("entra", 0, 4, "blue", "Entra ID", t("workforce IdP", "IdP dos funcionários")),
        n("iam", 1, 4, "amber", "Identity Center", "AWS IAM"),
        n("azOtel", 0, 5, "muted", otel),
        n("awsOtel", 1, 5, "muted", otel),
        n("obs", 0.5, 6, "accent", t("Observability", "Observabilidade"), t("logs, metrics, traces, SLOs", "logs, métricas, traces, SLOs")),
      ],
      edges: [
        e("github", "azHub", { tone: "muted", bend: 0.2 }),
        e("github", "awsHub", { tone: "muted", bend: 0.2 }),
        e("azHub", "awsHub", { tone: "accent", arrow: "both", width: 2.5, label: interconnect, labelTone: "accent", labelSide: "below", labelDy: 24 }),
        e("azHub", "azSpokes", { tone: "blue" }),
        e("awsHub", "awsSpokes", { tone: "amber" }),
        e("entra", "iam", { tone: "violet", label: "SAML / OIDC", labelTone: "violet", labelSide: "below", labelDy: 24 }),
        e("azOtel", "obs", { tone: "accent" }),
        e("awsOtel", "obs", { tone: "accent" }),
      ],
    },
  };
});

// content/posts/*/resilient-dotnet-api-polly.md
export const pollyPipeline = defineDiagram((t) => {
  const rings = [
    { tone: "amber" as const, label: t("TOTAL TIMEOUT · 8 s", "TIMEOUT TOTAL · 8 s") },
    { tone: "blue" as const, label: t("RETRY · 3×, EXPONENTIAL + JITTER", "RETRY · 3×, EXPONENCIAL + JITTER") },
    { tone: "violet" as const, label: t("CIRCUIT BREAKER · 50% / 30 s", "CIRCUIT BREAKER · 50% / 30 s") },
    { tone: "accent" as const, label: t("PER-ATTEMPT TIMEOUT · 2 s", "TIMEOUT POR TENTATIVA · 2 s") },
  ];
  const build = (mobile: boolean) => ({
    cols: 1,
    rows: 4,
    rowH: mobile ? 80 : 96,
    zones: rings.map((ring, i) => ({ col: 0, row: 1, rowSpan: 3, tone: ring.tone, label: ring.label, inset: i * (mobile ? 16 : 22) })),
    // On phones the ring labels reach past the middle, so the request comes in on the right.
    nodes: [
      n("request", mobile ? 0.3 : 0, 0, "muted", t("Request", "Requisição"), undefined, { w: mobile ? 120 : 160 }),
      n("call", 0, 2, "muted", t("HTTP call to pricing", "Chamada HTTP ao pricing"), undefined, { w: mobile ? 230 : 260 }),
    ],
    edges: [e("request", "call", { tone: "accent", toShift: mobile ? 100 : 0 })],
  });
  return {
    title: "POLLY",
    heading: t("OUTERMOST STRATEGY ADDED FIRST", "A ESTRATÉGIA DE FORA ENTRA PRIMEIRO"),
    accessible: t(
      "The Polly v8 resilience pipeline as nested layers around the HTTP call to the pricing service, from the outside in: a total timeout of 8 seconds, a retry of up to 3 attempts with exponential backoff and jitter, a circuit breaker that opens at a 50% failure ratio for 30 seconds, and a per-attempt timeout of 2 seconds. The request enters through the outermost layer.",
      "O pipeline de resiliência do Polly v8 como camadas em volta da chamada HTTP ao serviço de pricing, de fora para dentro: um timeout total de 8 segundos, um retry de até 3 tentativas com backoff exponencial e jitter, um circuit breaker que abre com 50% de falhas por 30 segundos e um timeout de 2 segundos por tentativa. A requisição entra pela camada mais externa."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

// content/posts/*/serverless-cost-governance.md
export const costControlLoop = defineDiagram((t) => {
  const stages = {
    limits: [t("1 · Limits", "1 · Limites"), [
      t("preventive", "preventivo"),
      t("concurrency caps", "tetos de concorrência"),
      t("max instances", "máximo de instâncias"),
      t("bounded retries + DLQ", "retries limitados + DLQ"),
      t("log retention, sampling", "retenção e amostragem"),
    ]],
    telemetry: [t("2 · Telemetry", "2 · Telemetria"), [
      t("detective", "detectivo"),
      t("invocations, duration", "invocações, duração"),
      t("throttles, errors, DLQ", "throttles, erros, DLQ"),
      t("log volume", "volume de logs"),
      t("cost per 1,000 requests", "custo por 1.000 requisições"),
    ]],
    budgets: [t("3 · Budgets", "3 · Orçamentos"), [
      t("backstop", "rede de segurança"),
      t("forecasted + actual", "previsto + real"),
      t("alerts per tag or scope", "alertas por tag ou escopo"),
      t("action groups / SNS", "action groups / SNS"),
    ]],
    owners: [t("4 · Owners + automation", "4 · Donos + automação"), [
      t("on-call gets paged", "o plantão é acionado"),
      t("runbook: lower the caps,", "runbook: baixar os tetos,"),
      t("disable the trigger,", "desligar o trigger,"),
      t("fix the bug", "corrigir o bug"),
    ]],
  } as const;
  const build = (mobile: boolean) => ({
    cols: 2,
    rows: 2,
    rowH: mobile ? 150 : 150,
    gapX: mobile ? 18 : 90,
    nodes: [
      n("limits", 0, 0, "accent", stages.limits[0], [...stages.limits[1]]),
      n("telemetry", 1, 0, "blue", stages.telemetry[0], [...stages.telemetry[1]]),
      n("budgets", 1, 1, "amber", stages.budgets[0], [...stages.budgets[1]]),
      n("owners", 0, 1, "violet", stages.owners[0], [...stages.owners[1]]),
    ],
    edges: [
      e("limits", "telemetry", { tone: "blue" }),
      e("telemetry", "budgets", { tone: "amber" }),
      e("budgets", "owners", { tone: "violet" }),
      e("owners", "limits", { tone: "accent" }),
    ],
    notes: mobile ? [] : [{ col: 0.5, row: 0.5, text: t("feedback loop", "ciclo de feedback"), tone: "muted" as const, size: 11, align: "center" as const }],
  });
  return {
    title: "SERVERLESS",
    heading: t("COST GOVERNANCE AS A CONTROL LOOP", "GOVERNANÇA DE CUSTO COMO CICLO"),
    accessible: t(
      "Cost governance as a four-stage loop. 1, limits, preventive: concurrency caps, max instances, bounded retries with a dead-letter queue, log retention and sampling. 2, telemetry, detective: invocations and duration, throttles, errors and DLQ depth, log volume, cost per 1,000 requests. 3, budgets, the backstop: forecasted and actual spend, alerts per tag or scope, action groups or SNS. 4, owners and automation: on-call gets paged and the runbook lowers caps, disables the trigger and fixes the bug, which feeds back into the limits.",
      "Governança de custo como um ciclo de quatro etapas. 1, limites, preventivo: tetos de concorrência, máximo de instâncias, retries limitados com dead-letter queue, retenção e amostragem de logs. 2, telemetria, detectivo: invocações e duração, throttles, erros e profundidade da DLQ, volume de logs, custo por 1.000 requisições. 3, orçamentos, a rede de segurança: gasto previsto e real, alertas por tag ou escopo, action groups ou SNS. 4, donos e automação: o plantão é acionado e o runbook baixa os tetos, desliga o trigger e corrige o bug, o que volta para os limites."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

// content/posts/*/strangler-fig-migration.md
export const stranglerFigFlow = defineDiagram((t) => {
  const build = (mobile: boolean) => ({
    cols: 2,
    rows: 4,
    rowH: mobile ? 88 : 96,
    nodes: [
      n("clients", 0.5, 0, "muted", t("Clients", "Clientes"), t("web, mobile, partners", "web, mobile, parceiros")),
      n("facade", 0.5, 1, "accent", t("Facade", "Fachada"), [
        t("gateway / reverse proxy", "gateway / reverse proxy"),
        t("route table, canary %, rollback", "rotas, canary %, rollback"),
      ]),
      n("monolith", 0, 2, "muted", t("Monolith", "Monolito"), mobile
        ? [t("orders + the rest", "pedidos + o resto"), t("90% of customers", "90% de clientes")]
        : [t("/api/orders/* and the rest", "/api/orders/* e o resto"), t("+ 90% of /api/customers/*", "+ 90% de /api/customers/*")]),
      n("customers", 1, 2, "accent", t("Customers service", "Serviço de clientes"), [
        t("+ anti-corruption layer", "+ camada anticorrupção"),
        mobile ? t("10% of customers", "10% de clientes") : t("canary: 10% of /api/customers/*", "canary: 10% de /api/customers/*"),
      ]),
      n("db", 0, 3, "muted", t("Legacy DB", "Banco legado")),
    ],
    edges: [
      e("clients", "facade", { tone: "muted" }),
      e("facade", "monolith", { tone: "muted", fromShift: -30 }),
      e("facade", "customers", { tone: "accent", fromShift: 30 }),
      e("monolith", "db", { tone: "muted" }),
      e("db", "customers", { tone: "amber", route: "hv", label: t("CDC events", "eventos CDC"), labelTone: "amber" }),
    ],
  });
  return {
    title: "STRANGLER FIG",
    heading: t("REQUEST FLOW", "FLUXO DAS REQUISIÇÕES"),
    accessible: t(
      "Clients (web, mobile and partners) call a facade, a gateway or reverse proxy that owns the route table, the canary percentage and the rollback. It sends /api/orders/* and everything else to the monolith, and /api/customers/* to the new customers service for 10% of traffic, while the other 90% still goes to the monolith. The customers service includes an anti-corruption layer. The monolith keeps writing to the legacy database, whose changes reach the customers service as CDC events.",
      "Os clientes (web, mobile e parceiros) chamam uma fachada, um gateway ou reverse proxy dono da tabela de rotas, do percentual de canary e do rollback. Ela manda /api/orders/* e todo o resto para o monolito, e /api/customers/* para o novo serviço de clientes em 10% do tráfego, enquanto os outros 90% ainda vão para o monolito. O serviço de clientes inclui uma camada anticorrupção. O monolito continua gravando no banco legado, cujas mudanças chegam ao serviço de clientes como eventos CDC."
    ),
    desktop: build(false),
    mobile: build(true),
  };
});

// content/posts/*/idempotency-keys-in-practice.md
export const idempotencyFlow = defineDiagram((t) => {
  const node = {
    request: (col: number, row: number) => n("request", col, row, "muted", t("Request", "Requisição"), "scope · key · body"),
    fingerprint: (col: number, row: number) =>
      n("fingerprint", col, row, "blue", "Fingerprint", [t("SHA-256 of method,", "SHA-256 de método,"), "path, query, body"]),
    insert: (col: number, row: number) => n("insert", col, row, "blue", "INSERT in_progress", t("atomic, unique (scope, key)", "atômico, único (scope, key)")),
    handler: (col: number, row: number) => n("handler", col, row, "accent", t("Run handler", "Executa o handler"), t("row inserted", "linha inserida")),
    unprocessable: (col: number, row: number) =>
      n("unprocessable", col, row, "danger", "422 Unprocessable", t("other fingerprint", "outro fingerprint")),
    conflict: (col: number, row: number) =>
      n("conflict", col, row, "amber", "409 Conflict", [t("+ Retry-After", "+ Retry-After"), t("still in progress", "ainda em andamento")]),
    replay: (col: number, row: number) =>
      n("replay", col, row, "accent", "Replay", [t("stored status, headers, body", "status, headers e body salvos"), t("row completed", "linha completed")]),
    store: (col: number, row: number) => n("store", col, row, "accent", "2xx / 4xx", [t("store the response", "guarda a resposta"), "state = completed"]),
    remove: (col: number, row: number) =>
      n("remove", col, row, "danger", t("5xx / exception", "5xx / exceção"), [t("delete the row", "apaga a linha"), t("key can be retried", "a chave pode ser reusada")]),
  };
  return {
    title: t("IDEMPOTENCY", "IDEMPOTÊNCIA"),
    heading: t("ONE KEY, FOUR OUTCOMES", "UMA CHAVE, QUATRO DESFECHOS"),
    accessible: t(
      "A request carries a scope, a key and a body. The server computes a fingerprint, SHA-256 of method, path, query and body, and tries to insert the row (scope, key, fingerprint, state in_progress), atomically, with (scope, key) unique. If the insert succeeds, the handler runs: a 2xx or 4xx response is stored and the state becomes completed; a 5xx or an exception deletes the row so the key can be retried. If the row already exists with another fingerprint, the answer is 422 Unprocessable Content; if it is still in progress, 409 Conflict with Retry-After; if it is completed, the stored status, headers and body are replayed.",
      "Uma requisição traz um scope, uma chave e um body. O servidor calcula um fingerprint, SHA-256 de método, path, query e body, e tenta inserir a linha (scope, key, fingerprint, estado in_progress), de forma atômica, com (scope, key) único. Se o insert funciona, o handler roda: uma resposta 2xx ou 4xx é guardada e o estado vira completed; um 5xx ou uma exceção apaga a linha para a chave poder ser reusada. Se a linha já existe com outro fingerprint, a resposta é 422 Unprocessable Content; se ainda está em andamento, 409 Conflict com Retry-After; se está completed, o status, os headers e o body salvos são repetidos."
    ),
    desktop: {
      cols: 4,
      rows: 5,
      rowH: 92,
      nodes: [
        node.request(0, 0), node.fingerprint(0, 1), node.insert(0, 2),
        node.handler(0, 3), node.unprocessable(1, 3), node.conflict(2, 3), node.replay(3, 3),
        node.store(0, 4), node.remove(1, 4),
      ],
      edges: [
        e("request", "fingerprint", { tone: "blue" }),
        e("fingerprint", "insert", { tone: "blue" }),
        e("insert", "handler", { tone: "accent" }),
        e("insert", "unprocessable", { tone: "danger" }),
        e("insert", "conflict", { tone: "amber" }),
        e("insert", "replay", { tone: "accent" }),
        e("handler", "store", { tone: "accent" }),
        e("handler", "remove", { tone: "danger" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 6,
      rowH: 88,
      nodes: [
        node.request(0.5, 0), node.fingerprint(0.5, 1), node.insert(0.5, 2),
        node.handler(0, 3), node.unprocessable(1, 3),
        node.store(0, 4), node.conflict(1, 4),
        node.remove(0, 5), node.replay(1, 5),
      ],
      edges: [
        e("request", "fingerprint", { tone: "blue" }),
        e("fingerprint", "insert", { tone: "blue" }),
        e("insert", "handler", { tone: "accent", fromShift: -30 }),
        e("insert", "unprocessable", { tone: "danger", fromShift: 30 }),
        e("insert", "conflict", { tone: "amber", route: "u-right", fromShift: -8, offset: 10 }),
        e("insert", "replay", { tone: "accent", route: "u-right", fromShift: 8, offset: 16 }),
        e("handler", "store", { tone: "accent" }),
        e("handler", "remove", { tone: "danger", route: "u-left", offset: 10 }),
      ],
    },
  };
});
