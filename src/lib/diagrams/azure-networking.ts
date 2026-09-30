import { defineDiagram, e, n } from "@/lib/diagrams/define";

const hubSpoke = defineDiagram((t) => {
  const nodes = [
    n("premises", 0, 0, "muted", t("Corporate network", "Rede corporativa"), t("VPN / ExpressRoute", "VPN / ExpressRoute")),
    n("gateway", 0, 1, "blue", t("Hub gateway", "Gateway do hub"), t("Hybrid connectivity", "Conectividade híbrida")),
    n("dns", 2, 1, "violet", t("Shared DNS", "DNS compartilhado"), t("Private Resolver + zones", "Private Resolver + zonas")),
    n("firewall", 1, 1, "amber", t("Azure Firewall", "Azure Firewall"), t("Explicit transit routes", "Rotas explícitas de trânsito")),
    n("app", 0, 3, "accent", t("App spoke", "Spoke de aplicação"), [t("Peering with hub", "Peering com o hub"), t("Application subnets", "Sub-redes da aplicação")]),
    n("data", 2, 3, "blue", t("Data spoke", "Spoke de dados"), [t("Peering with hub", "Peering com o hub"), t("Data subnets", "Sub-redes de dados")]),
    n("transit", 0, 4, "danger", t("Peering is not transitive", "Peering não é transitivo"), [
      t("Spoke-to-spoke: configure routes, forwarding and firewall policy", "Entre spokes: configurar rotas, encaminhamento e política do firewall"),
      t("Gateway transit also needs explicit peering settings", "Trânsito pelo gateway também exige configuração explícita no peering"),
    ], { span: 3 }),
  ];
  const edges = [
    e("premises", "gateway", { tone: "blue", arrow: "both" }),
    e("firewall", "app", { tone: "accent", arrow: "both", flow: false }),
    e("firewall", "data", { tone: "blue", arrow: "both", flow: false }),
  ];
  return {
    title: t("HUB AND SPOKES", "HUB E SPOKES"),
    heading: t("TOPOLOGY, NOT IMPLICIT TRANSIT", "TOPOLOGIA, NÃO TRÂNSITO IMPLÍCITO"),
    accessible: t(
      "A corporate network connects by VPN or ExpressRoute to the hub gateway. The hub contains three distinct services: the gateway for hybrid connectivity, Azure Firewall for routed inspection, and shared DNS with Private Resolver and private zones. The application and data spokes each peer with the hub. The spoke lines represent peering adjacency to the hub, not peering to a firewall resource or automatic packet forwarding. Peering is not transitive: app-to-data traffic through the firewall requires explicit routes in both directions, forwarded-traffic settings and firewall rules. Gateway transit and use of a remote gateway require their own peering settings; DNS zone links and resolution must also be configured.",
      "A rede corporativa conecta-se por VPN ou ExpressRoute ao gateway do hub. O hub contém três serviços distintos: gateway para conectividade híbrida, Azure Firewall para inspeção do tráfego roteado e DNS compartilhado com Private Resolver e zonas privadas. Os spokes de aplicação e dados têm peering com o hub. As linhas dos spokes representam adjacência ao hub, não peering com o recurso de firewall nem encaminhamento automático de pacotes. Peering não é transitivo: tráfego entre aplicação e dados pelo firewall exige rotas explícitas nos dois sentidos, permissão de tráfego encaminhado e regras de firewall. Trânsito pelo gateway e uso do gateway remoto exigem configurações próprias de peering; vínculos de zonas DNS e resolução também precisam ser configurados."
    ),
    desktop: {
      cols: 3, rows: 5, rowH: 116, nodeH: 60,
      zones: [{ col: 0, row: 1, span: 3, tone: "muted", label: t("HUB VNET", "VNET DO HUB") }],
      nodes, edges,
    },
    mobile: {
      cols: 1, rows: 8.5, rowH: 112, nodeH: 60, gapX: 60,
      zones: [{ col: 0, row: 1, rowSpan: 3, tone: "muted", label: t("HUB VNET", "VNET DO HUB") }],
      nodes: nodes.map((node, index) => ({
        ...node, col: 0, row: index < 4 ? index : index + 1, span: 1,
        ...(node.id === "transit" ? {
          row: 7.25,
          detail: [
            t("Between spokes: routes + forwarding", "Entre spokes: rotas + encaminhamento"),
            t("Firewall policy + return path", "Política do firewall + rota de retorno"),
            t("Gateway transit: explicit settings", "Trânsito no gateway: configurar"),
          ],
        } : {}),
      })),
      edges: [edges[0]!, edges[1]!, e("firewall", "data", { route: "u-right", offset: 16, tone: "blue", arrow: "both", flow: false })],
    },
  };
});

const routeSelection = defineDiagram((t) => {
  const nodes = [
    n("destination", 0, 0, "muted", t("Destination: 10.42.2.10", "Destino: 10.42.2.10"), t("Generic routed IP, not a Private Endpoint", "IP roteado genérico, não um Private Endpoint"), { span: 3 }),
    n("default", 0, 1, "muted", t("0.0.0.0/0 UDR", "0.0.0.0/0 UDR"), [t("Matches: /0", "Corresponde: /0"), t("Next hop: edge NVA", "Próximo salto: NVA de borda")]),
    n("bgp", 1, 1, "blue", t("10.42.0.0/16 BGP", "10.42.0.0/16 BGP"), [t("Matches: /16", "Corresponde: /16"), t("Next hop: gateway", "Próximo salto: gateway")]),
    n("specific", 2, 1, "accent", t("10.42.2.0/24 UDR", "10.42.2.0/24 UDR"), [t("Matches: /24, selected", "Corresponde: /24, escolhida"), t("Next hop: 10.0.1.4", "Próximo salto: 10.0.1.4")]),
    n("winner", 0, 2, "accent", t("Longest prefix wins", "Vence o prefixo mais longo"), [
      t("/24 is more specific than /16 and /0", "/24 é mais específico que /16 e /0"),
      t("Equal prefix: UDR > BGP > system, in the general case", "Prefixo igual: UDR > BGP > sistema, no caso geral"),
    ], { span: 3 }),
    n("hop", 0, 3, "amber", t("Forward to 10.0.1.4", "Encaminhar para 10.0.1.4"), t("Virtual appliance: forwarding, policy and return route still required", "Appliance virtual: ainda exige encaminhamento, política e rota de retorno"), { span: 3 }),
  ];
  return {
    title: t("ROUTE SELECTION", "SELEÇÃO DE ROTAS"),
    heading: t("PREFIX BEFORE SOURCE", "PREFIXO ANTES DA ORIGEM"),
    accessible: t(
      "For a generic destination 10.42.2.10, three active candidate routes match: a 0.0.0.0/0 UDR toward an edge appliance, a 10.42.0.0/16 BGP route toward a gateway, and a 10.42.2.0/24 UDR toward virtual appliance 10.0.1.4. Longest-prefix matching selects the /24 UDR over both /16 BGP and /0 UDR. Route source priority does not override a longer prefix. For equal prefixes, the general precedence is UDR, BGP, then system routes; Azure has special routing cases. This example deliberately excludes Private Endpoint routing. The selected appliance must still forward and allow traffic, and the return path must be configured.",
      "Para o destino genérico 10.42.2.10, três rotas candidatas ativas correspondem: UDR 0.0.0.0/0 para um appliance de borda, rota BGP 10.42.0.0/16 para um gateway e UDR 10.42.2.0/24 para o appliance virtual 10.0.1.4. A correspondência pelo prefixo mais longo escolhe a UDR /24 sobre a rota BGP /16 e a UDR /0. A prioridade da origem da rota não supera um prefixo mais longo. Para prefixos iguais, a precedência geral é UDR, BGP e rotas de sistema; o Azure tem casos especiais de roteamento. Este exemplo exclui deliberadamente o roteamento de Private Endpoint. O appliance escolhido ainda precisa encaminhar e permitir o tráfego, com rota de retorno configurada."
    ),
    desktop: {
      cols: 3, rows: 4, rowH: 124, nodeH: 60, nodes,
      edges: [
        e("destination", "default", { fromShift: -160, dashed: true }),
        e("destination", "bgp", { tone: "blue", dashed: true }),
        e("destination", "specific", { fromShift: 160, tone: "accent" }),
        e("specific", "winner", { tone: "accent", toShift: 160 }),
        e("winner", "hop", { tone: "accent" }),
      ],
    },
    mobile: {
      cols: 1, rows: 6, rowH: 128, nodeH: 62, gapX: 60,
      nodes: nodes.map((node, index) => ({
        ...node, col: 0, row: index, span: 1,
        ...(node.id === "destination" ? { detail: [t("Generic routed IP", "IP roteado genérico"), t("Not a Private Endpoint", "Não é um Private Endpoint")] } : {}),
        ...(node.id === "winner" ? { detail: [t("/24 wins over /16 and /0", "/24 vence /16 e /0"), t("Same prefix, general rule:", "Mesmo prefixo, regra geral:"), t("UDR > BGP > system", "UDR > BGP > sistema")] } : {}),
        ...(node.id === "hop" ? { detail: [t("Virtual appliance", "Appliance virtual"), t("Forwarding + policy + return route", "Encaminhamento + política + retorno")] } : {}),
      })),
      edges: [
        e("destination", "specific", { tone: "accent", route: "u-right", offset: 16 }),
        e("specific", "winner", { tone: "accent" }),
        e("winner", "hop", { tone: "accent" }),
      ],
    },
  };
});

const privateDns = defineDiagram((t) => {
  const nodes = [
    n("app", 1, 0, "accent", t("Corporate app", "App corporativa"), [t("orders.database.windows.net", "orders.database.windows.net"), t("Resolve first, then connect", "Resolver, depois conectar")]),
    n("corporate", 0, 0, "blue", t("Corporate DNS", "DNS corporativo"), [t("Conditional forwarder", "Encaminhador condicional"), t("database.windows.net", "database.windows.net")]),
    n("resolver", 0, 1, "blue", t("Private Resolver", "Private Resolver"), [t("Inbound endpoint: 10.0.0.4", "Endpoint de entrada: 10.0.0.4"), t("Reachable over private network", "Acessível pela rede privada")]),
    n("zone", 0, 2, "violet", t("Linked private zone", "Zona privada vinculada"), [t("privatelink.database.windows.net", "privatelink.database.windows.net"), t("Link to resolver VNet", "Vínculo à VNet do resolver")]),
    n("answer", 0, 3, "blue", t("DNS answer", "Resposta DNS"), [t("orders: A = 10.42.2.10", "orders: A = 10.42.2.10"), t("Returned to the app", "Retorna para a aplicação")]),
    n("routing", 1, 1, "accent", t("Private routing", "Roteamento privado"), [t("VPN / ExpressRoute + VNet routes", "VPN / ExpressRoute + rotas VNet"), t("Data does not cross the resolver", "Dados não passam pelo resolver")]),
    n("endpoint", 1, 2, "accent", t("Private Endpoint", "Private Endpoint"), [t("10.42.2.10", "10.42.2.10"), t("Approved SQL connection", "Conexão SQL aprovada")]),
    n("sql", 1, 3, "amber", t("Azure SQL", "Azure SQL"), [t("TLS + database authentication", "TLS + autenticação no banco"), t("Network access is not identity", "Acesso de rede não é identidade")]),
  ];
  const edges = [
    e("app", "corporate", { tone: "blue", dashed: true }),
    e("corporate", "resolver", { tone: "blue", dashed: true }),
    e("resolver", "zone", { tone: "violet", dashed: true }),
    e("zone", "answer", { tone: "blue", dashed: true }),
    e("app", "routing", { tone: "accent" }),
    e("routing", "endpoint", { tone: "accent" }),
    e("endpoint", "sql", { tone: "accent" }),
  ];
  return {
    title: t("PRIVATE DNS", "DNS PRIVADO"),
    heading: t("RESOLUTION IS NOT THE DATA PATH", "RESOLUÇÃO NÃO É O CAMINHO DOS DADOS"),
    accessible: t(
      "The corporate application resolves orders.database.windows.net through corporate DNS. A conditional forwarder for database.windows.net sends the query over private connectivity to Azure DNS Private Resolver's inbound endpoint, 10.0.0.4. The public SQL name aliases to orders.privatelink.database.windows.net; the private zone privatelink.database.windows.net is linked to the resolver VNet and contains the orders A record 10.42.2.10. That private answer returns to the application. Dashed blue and violet lines show DNS resolution, not SQL traffic. Separately, solid green lines show the application connecting over VPN or ExpressRoute and private VNet routes to Private Endpoint 10.42.2.10, then to Azure SQL through the approved private link. The application retains the SQL hostname for TLS and authentication. A DNS answer alone supplies neither a working route nor database authorization.",
      "A aplicação corporativa resolve orders.database.windows.net pelo DNS corporativo. Um encaminhador condicional para database.windows.net envia a consulta pela conectividade privada ao endpoint de entrada do Azure DNS Private Resolver, 10.0.0.4. O nome público do SQL é um alias de orders.privatelink.database.windows.net; a zona privada privatelink.database.windows.net está vinculada à VNet do resolver e contém o registro A orders com 10.42.2.10. Essa resposta privada retorna à aplicação. Linhas tracejadas azuis e violetas representam resolução DNS, não tráfego SQL. Separadamente, linhas verdes contínuas mostram a aplicação conectando-se por VPN ou ExpressRoute e rotas privadas de VNet ao Private Endpoint 10.42.2.10 e, depois, ao Azure SQL pelo vínculo privado aprovado. A aplicação mantém o hostname SQL para TLS e autenticação. Uma resposta DNS, sozinha, não fornece rota funcional nem autorização no banco."
    ),
    desktop: {
      cols: 2, rows: 4, rowH: 132, nodeH: 64, gapX: 48,
      zones: [
        { col: 0, row: 0, rowSpan: 4, tone: "blue", label: t("1. DNS LOOKUP", "1. CONSULTA DNS") },
        { col: 1, row: 0, rowSpan: 4, tone: "accent", label: t("2. DATA CONNECTION", "2. CONEXÃO DE DADOS") },
      ],
      nodes, edges,
    },
    mobile: {
      cols: 1, rows: 9, rowH: 122, nodeH: 64, gapX: 60,
      zones: [
        { col: 0, row: 1, rowSpan: 4, tone: "blue", label: t("1. DNS LOOKUP", "1. CONSULTA DNS") },
        { col: 0, row: 6, rowSpan: 3, tone: "accent", label: t("2. DATA CONNECTION", "2. CONEXÃO DE DADOS") },
      ],
      nodes: nodes.map((node, index) => ({ ...node, col: 0, row: index < 5 ? index : index + 1 })),
      edges: edges.map((edge) => edge.from === "app" && edge.to === "routing"
        ? { ...edge, route: "u-right" as const, offset: 18 }
        : edge),
    },
  };
});

const ingress = defineDiagram((t) => {
  const nodes = [
    n("clients", 0, 0, "muted", t("Clients", "Clientes"), t("Public HTTPS", "HTTPS público")),
    n("frontdoor", 1, 0, "blue", t("Front Door + WAF", "Front Door + WAF"), [t("Global edge", "Borda global"), t("HTTP filtering + routing", "Filtro HTTP + roteamento")]),
    n("restriction", 2, 0, "danger", t("Origin access gate", "Acesso à origem"), [t("Allow Front Door backend", "Permitir backend Front Door"), t("Validate X-Azure-FDID", "Validar X-Azure-FDID")]),
    n("app", 2, 1, "accent", t("Regional origin app", "App de origem regional"), [t("HTTPS + health probes", "HTTPS + sondas de saúde"), t("Outbound VNet integration", "Integração VNet de saída")]),
    n("endpoint", 1, 1, "violet", t("Private Endpoint", "Private Endpoint"), [t("Storage private IP", "IP privado do Storage"), t("Private DNS + routes", "DNS privado + rotas")]),
    n("storage", 0, 1, "amber", t("Storage", "Storage"), [t("Private link approved", "Vínculo privado aprovado"), t("Identity + data roles", "Identidade + papéis de dados")]),
    n("warning", 0, 2, "danger", t("Origin lockdown is explicit", "Bloqueio da origem é explícito"), [
      t("Front Door does not automatically block direct origin access", "Front Door não bloqueia automaticamente o acesso direto à origem"),
      t("Deny other sources; a Storage Private Endpoint does not protect ingress", "Negar outras origens; o Private Endpoint do Storage não protege a entrada"),
    ], { span: 3 }),
  ];
  const edges = [
    e("clients", "frontdoor", { tone: "blue" }),
    e("frontdoor", "restriction", { tone: "blue" }),
    e("restriction", "app", { tone: "accent" }),
    e("app", "endpoint", { tone: "violet" }),
    e("endpoint", "storage", { tone: "amber" }),
  ];
  return {
    title: t("INGRESS AND DATA", "ENTRADA E DADOS"),
    heading: t("TWO DIFFERENT TRUST BOUNDARIES", "DUAS FRONTEIRAS DE CONFIANÇA"),
    accessible: t(
      "Clients send public HTTPS requests to Azure Front Door with WAF, which filters and routes requests to a regional application origin. This example uses a public origin with explicit restrictions: allow the AzureFrontDoor.Backend service tag, validate X-Azure-FDID against the expected Front Door profile, and deny other traffic. Header validation alone is insufficient. The access gate represents origin configuration, not a separate Azure service. Configure origin TLS and health probes. Front Door does not automatically prevent clients from bypassing it. Separately, the application's outbound VNet integration, private DNS and routing allow access to a Storage Private Endpoint and then the storage account. Approve the private endpoint connection, configure Storage public network access separately, and grant the application appropriate data-plane permissions. The Storage Private Endpoint secures the data path, not the application's public ingress.",
      "Clientes enviam requisições HTTPS públicas ao Azure Front Door com WAF, que filtra e roteia para uma aplicação de origem regional. Este exemplo usa origem pública com restrições explícitas: permitir a service tag AzureFrontDoor.Backend, validar X-Azure-FDID com o perfil Front Door esperado e negar os demais acessos. Validar apenas o cabeçalho é insuficiente. A barreira de acesso representa configuração da origem, não um serviço Azure separado. Configurar TLS e sondas de saúde da origem. Front Door não impede automaticamente que clientes o contornem. Separadamente, a integração VNet de saída da aplicação, DNS privado e roteamento permitem acesso ao Private Endpoint do Storage e depois à conta de armazenamento. Aprovar a conexão privada, configurar separadamente o acesso público do Storage e conceder permissões de dados adequadas à aplicação. O Private Endpoint do Storage protege o caminho dos dados, não a entrada pública da aplicação."
    ),
    desktop: { cols: 3, rows: 3, rowH: 132, nodeH: 62, nodes, edges },
    mobile: {
      cols: 1, rows: 7.5, rowH: 120, nodeH: 62, gapX: 40,
      nodes: nodes.map((node, index) => ({
        ...node, col: 0, row: index, span: 1,
        ...(node.id === "warning" ? {
          row: 6.25,
          detail: [
            t("Deny direct access to the origin", "Negar acesso direto à origem"),
            t("Front Door does not do this for you", "Front Door não faz isso sozinho"),
            t("Storage PE protects only the data path", "PE do Storage protege só os dados"),
          ],
        } : {}),
      })),
      edges,
    },
  };
});

const troubleshooting = defineDiagram((t) => {
  const steps = [
    n("dns", 0, 0, "blue", t("1. DNS", "1. DNS"), t("Expected name and IP?", "Nome e IP esperados?")),
    n("route", 0, 1, "accent", t("2. Route", "2. Rota"), t("Next hop and return path?", "Próximo salto e retorno?")),
    n("tcp", 0, 2, "amber", t("3. TCP / policy", "3. TCP / política"), t("Port allowed end to end?", "Porta permitida ponta a ponta?")),
    n("tls", 0, 3, "violet", t("4. TLS", "4. TLS"), t("Hostname and trust valid?", "Hostname e confiança válidos?")),
    n("http", 0, 4, "danger", t("5. HTTP / identity", "5. HTTP / identidade"), t("Correct request and permissions?", "Requisição e permissões corretas?")),
  ];
  const evidence = [
    n("dns-evidence", 1, 0, "blue", t("Resolution evidence", "Evidências de resolução"), [t("nslookup / Resolve-DnsName", "nslookup / Resolve-DnsName"), t("CNAME chain, A record, resolver used", "Cadeia CNAME, registro A, resolver usado")]),
    n("route-evidence", 1, 1, "accent", t("Routing evidence", "Evidências de roteamento"), [t("Effective routes + Network Watcher next hop", "Rotas efetivas + próximo salto no Network Watcher"), t("Prefix, source and reverse route", "Prefixo, origem e rota inversa")]),
    n("tcp-evidence", 1, 2, "amber", t("Transport evidence", "Evidências de transporte"), [t("Test-NetConnection + Connection troubleshoot", "Test-NetConnection + Connection troubleshoot"), t("Effective NSG rules, firewall logs, SYN / ACK", "Regras NSG efetivas, logs do firewall, SYN / ACK")]),
    n("tls-evidence", 1, 3, "violet", t("Handshake evidence", "Evidências do handshake"), [t("openssl s_client with -servername", "openssl s_client com -servername"), t("SNI, certificate chain, expiry and trust", "SNI, cadeia, validade e confiança do certificado")]),
    n("http-evidence", 1, 4, "danger", t("Application evidence", "Evidências da aplicação"), [t("curl -v, status code and request ID", "curl -v, status HTTP e ID da requisição"), t("App / WAF logs, token audience, data roles", "Logs app / WAF, audience do token, papéis de dados")]),
  ];
  const edges = steps.slice(1).map((step, index) => e(steps[index]!.id, step.id, { tone: step.tone }));
  return {
    title: t("TROUBLESHOOTING", "DIAGNÓSTICO"),
    heading: t("PROVE EACH LAYER", "COMPROVE CADA CAMADA"),
    accessible: t(
      "Investigate from the failing application's environment, in order. First DNS: record the queried name, resolver, CNAME chain and expected A record using nslookup or Resolve-DnsName. Second routing: inspect effective routes and Network Watcher next hop where supported, including the selected prefix, route source and return path. Third TCP and policy: test the actual destination port with Test-NetConnection or Connection troubleshoot, correlate effective NSG rules, firewall logs and SYN/ACK evidence. Fourth TLS: use openssl s_client with the real hostname in -servername, checking SNI, certificate chain, expiry and trust. Fifth HTTP and identity: inspect curl -v output, HTTP status, request IDs, application and WAF logs, token audience and data-plane roles. A successful lower layer does not prove the next one works, and a 403 is not automatically a routing failure. Capture evidence before changing configuration; use equivalent platform diagnostics where VM-specific tools are unavailable.",
      "Investigue a partir do ambiente da aplicação com falha, em ordem. Primeiro DNS: registre nome consultado, resolver, cadeia CNAME e registro A esperado usando nslookup ou Resolve-DnsName. Segundo roteamento: inspecione rotas efetivas e próximo salto do Network Watcher quando suportados, incluindo prefixo escolhido, origem da rota e retorno. Terceiro TCP e política: teste a porta real do destino com Test-NetConnection ou Connection troubleshoot e correlacione regras NSG efetivas, logs do firewall e evidências SYN/ACK. Quarto TLS: use openssl s_client com o hostname real em -servername, verificando SNI, cadeia do certificado, validade e confiança. Quinto HTTP e identidade: inspecione curl -v, status HTTP, IDs de requisição, logs da aplicação e do WAF, audience do token e papéis de dados. Sucesso em uma camada não comprova a seguinte, e um 403 não é automaticamente falha de roteamento. Colete evidências antes de alterar configurações; use diagnósticos equivalentes da plataforma quando ferramentas específicas de VM não estiverem disponíveis."
    ),
    desktop: {
      cols: [2, 3], rows: 5, rowH: 128, nodeH: 62,
      nodes: [...steps, ...evidence],
      edges: [...edges, ...steps.map((step, index) => e(step.id, evidence[index]!.id, { tone: step.tone, dashed: true, arrow: "none" as const }))],
    },
    mobile: {
      cols: 1, rows: 5, rowH: 164, nodeH: 68, gapX: 36,
      nodes: steps.map((step, index) => ({
        ...step,
        detail: [
          step.detail as string,
          ...[
            [t("nslookup / Resolve-DnsName", "nslookup / Resolve-DnsName"), t("Resolver, CNAME, A record", "Resolver, CNAME, registro A")],
            [t("Effective routes + next hop", "Rotas efetivas + próximo salto"), t("Network Watcher; return route", "Network Watcher; rota de retorno")],
            [t("Test-NetConnection; SYN / ACK", "Test-NetConnection; SYN / ACK"), t("NSG rules + firewall logs", "Regras NSG + logs do firewall")],
            [t("openssl s_client -servername", "openssl s_client -servername"), t("SNI + certificate chain + expiry", "SNI + cadeia + validade")],
            [t("curl -v; status + request ID", "curl -v; status + ID da requisição"), t("App / WAF logs; token + roles", "Logs app / WAF; token + papéis")],
          ][index]!,
        ],
      })),
      edges,
    },
  };
});

export const azureNetworkingDiagrams = {
  "azure-network-hub-spoke": hubSpoke,
  "azure-network-route-selection": routeSelection,
  "azure-network-private-dns": privateDns,
  "azure-network-ingress": ingress,
  "azure-network-troubleshooting": troubleshooting,
};