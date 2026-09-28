import { defineDiagram, e, n } from "@/lib/diagrams/define";

// components/projects/project-showcase.tsx: architecture sketches for repos that ship none.

export const chariotServices = defineDiagram((t) => {
  const nodes = {
    ui: [t("Player UI", "Interface do jogador"), t("web client", "cliente web")],
    matchmaking: [t("Match Making", "Match Making"), t("pairs players", "junta os jogadores")],
    cgs: ["CGS", t("real-time games, sockets", "partidas em tempo real, sockets")],
    management: [t("Match Management", "Match Management"), t("match data, PGN", "dados da partida, PGN")],
    analyser: [t("Board Analyser", "Board Analyser"), t("Stockfish, live and batch", "Stockfish, ao vivo e em lote")],
    validation: [t("Game validation", "Validação"), t("legal moves, clocks", "lances legais, relógio")],
  } as const;
  return {
    title: "CHARIOT",
    heading: t("EVENT-DRIVEN CHESS SERVICES", "SERVIÇOS DE XADREZ ORIENTADOS A EVENTOS"),
    accessible: t(
      "The player UI asks the Match Making service for a game; it creates the match in the Match Management service, which returns a match token. The UI then plays over a socket with CGS, the Chariot Game Server, which validates every move and clock, saves the match PGN to Match Management and sends positions to the Board Analyser, backed by Stockfish, for live and batch analysis.",
      "A interface do jogador pede uma partida ao serviço de Match Making, que cria a partida no Match Management e devolve um token. A interface então joga por socket com o CGS, o servidor de jogo do Chariot, que valida cada lance e o relógio, salva o PGN da partida no Match Management e manda as posições para o Board Analyser, com Stockfish, para análise ao vivo e em lote."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      rowH: 104,
      nodes: [
        n("ui", 1.5, 0, "accent", nodes.ui[0], nodes.ui[1], { w: 220 }),
        n("matchmaking", 0, 1, "violet", nodes.matchmaking[0], nodes.matchmaking[1]),
        n("cgs", 2.5, 1, "amber", nodes.cgs[0], nodes.cgs[1], { w: 240 }),
        n("management", 1, 2, "violet", nodes.management[0], nodes.management[1]),
        n("analyser", 2, 2, "blue", nodes.analyser[0], nodes.analyser[1]),
        n("validation", 3, 2, "blue", nodes.validation[0], nodes.validation[1]),
      ],
      edges: [
        e("ui", "matchmaking", { tone: "violet", route: "hv" }),
        e("ui", "cgs", { tone: "amber", route: "hv", label: "socket" }),
        e("matchmaking", "management", { tone: "violet", route: "vh" }),
        e("cgs", "management", { tone: "amber", route: "vh" }),
        e("cgs", "analyser", { tone: "blue" }),
        e("cgs", "validation", { tone: "blue" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 3,
      rowH: 92,
      nodes: [
        n("ui", 0.5, 0, "accent", nodes.ui[0], nodes.ui[1], { w: 200 }),
        n("matchmaking", 0, 1, "violet", nodes.matchmaking[0]),
        n("cgs", 1, 1, "amber", nodes.cgs[0], t("sockets, validation", "sockets, validação")),
        n("management", 0, 2, "violet", nodes.management[0], "PGN"),
        n("analyser", 1, 2, "blue", nodes.analyser[0], "Stockfish"),
      ],
      edges: [
        e("ui", "matchmaking", { tone: "violet" }),
        e("ui", "cgs", { tone: "amber" }),
        e("matchmaking", "management", { tone: "violet" }),
        e("cgs", "management", { tone: "amber", route: "straight" }),
        e("cgs", "analyser", { tone: "blue" }),
      ],
    },
  };
});

export const reachUpFlow = defineDiagram((t) => {
  const beacons = [t("BLE beacons", "Beacons BLE"), t("UUID, RSSI, major/minor", "UUID, RSSI, major/minor")] as const;
  const app = [t("Flutter app", "App Flutter"), t("voice search, narrator", "busca por voz, narrador")] as const;
  const api = [t("Web API", "Web API"), t("ASP.NET Core, JWT", "ASP.NET Core, JWT")] as const;
  const db = ["MySQL", t("stores, floors, visits", "lojas, andares, visitas")] as const;
  const mall = [t("Mall managers", "Gestão do shopping"), t("ads, visit reports", "anúncios, relatórios")] as const;
  return {
    title: "REACHUP",
    heading: t("INDOOR LOCATION FROM BLUETOOTH BEACONS", "LOCALIZAÇÃO INDOOR POR BEACONS BLUETOOTH"),
    accessible: t(
      "Bluetooth Low Energy beacons spread around the mall broadcast their UUID, signal strength and major and minor ids. The Flutter app estimates where the visitor is from those signals and guides them by voice to stores, bathrooms and restaurants. It talks to an ASP.NET Core Web API with JWT authentication, backed by MySQL, where mall managers publish announcements and read visit reports.",
      "Beacons Bluetooth Low Energy espalhados pelo shopping transmitem o UUID, a força do sinal e os ids major e minor. O app Flutter estima onde o visitante está a partir desses sinais e o guia por voz até lojas, banheiros e restaurantes. Ele conversa com uma Web API em ASP.NET Core com autenticação JWT, sobre MySQL, onde a gestão do shopping publica anúncios e lê relatórios de visitas."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 104,
      nodes: [
        n("beacons", 0, 0, "blue", beacons[0], beacons[1]),
        n("app", 1, 0, "accent", app[0], app[1]),
        n("api", 2, 0, "violet", api[0], api[1]),
        n("db", 3, 0, "muted", db[0], db[1]),
        n("mall", 2, 1, "amber", mall[0], mall[1]),
      ],
      edges: [
        e("beacons", "app", { tone: "blue" }),
        e("app", "api", { tone: "accent" }),
        e("api", "db", { tone: "violet" }),
        e("mall", "api", { tone: "amber" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 3,
      rowH: 92,
      nodes: [
        n("beacons", 0, 0, "blue", beacons[0], "RSSI"),
        n("app", 1, 0, "accent", app[0], t("voice guide", "guia por voz")),
        n("mall", 0, 1, "amber", mall[0], t("reports", "relatórios")),
        n("api", 1, 1, "violet", api[0], "JWT"),
        n("db", 1, 2, "muted", db[0]),
      ],
      edges: [
        e("beacons", "app", { tone: "blue" }),
        e("app", "api", { tone: "accent" }),
        e("mall", "api", { tone: "amber" }),
        e("api", "db", { tone: "violet" }),
      ],
    },
  };
});

export const trackMeFlow = defineDiagram((t) => {
  const tracker = [t("Arduino tracker", "Rastreador Arduino"), t("embedded, in the vehicle", "embarcado, no veículo")] as const;
  const api = [t("Track API", "Track API"), t("ASP.NET Core on Azure", "ASP.NET Core na Azure")] as const;
  const db = ["MongoDB", t("locations, change streams", "posições, change streams")] as const;
  const app = [t("Flutter app", "App Flutter"), t("live map of the vehicle", "mapa ao vivo do veículo")] as const;
  return {
    title: "TRACK-ME",
    heading: t("FROM THE CAR TO A LIVE MAP", "DO CARRO A UM MAPA AO VIVO"),
    accessible: t(
      "An embedded Arduino tracker in the vehicle posts its location to the Track API, an ASP.NET Core service deployed to Azure. The API stores each point in MongoDB, whose change streams notify the API of new positions, and the Flutter app shows the vehicle moving on a live map.",
      "Um rastreador embarcado com Arduino no veículo envia a posição para a Track API, um serviço ASP.NET Core publicado na Azure. A API grava cada ponto no MongoDB, cujos change streams avisam a API das novas posições, e o app Flutter mostra o veículo se movendo num mapa ao vivo."
    ),
    desktop: {
      cols: 3,
      rows: 2,
      rowH: 104,
      nodes: [
        n("tracker", 0, 0, "amber", tracker[0], tracker[1]),
        n("api", 1, 0, "violet", api[0], api[1]),
        n("db", 2, 0, "muted", db[0], db[1]),
        n("app", 1, 1, "accent", app[0], app[1]),
      ],
      edges: [
        e("tracker", "api", { tone: "amber", label: "POST" }),
        e("api", "db", { tone: "violet" }),
        e("db", "app", { tone: "accent", route: "vh" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 3,
      rowH: 92,
      nodes: [
        n("tracker", 0.5, 0, "amber", tracker[0], t("in the vehicle", "no veículo"), { w: 220 }),
        n("api", 0, 1, "violet", api[0], "ASP.NET Core"),
        n("db", 1, 1, "muted", db[0], "change streams"),
        n("app", 0.5, 2, "accent", app[0], t("live map", "mapa ao vivo"), { w: 220 }),
      ],
      edges: [
        e("tracker", "api", { tone: "amber" }),
        e("api", "db", { tone: "violet" }),
        e("db", "app", { tone: "accent" }),
      ],
    },
  };
});

export const microServiceGateway = defineDiagram((t) => {
  const client = [t("Client", "Cliente"), "Bearer JWT"] as const;
  const gateway = [t("API gateway", "API gateway"), t("Ocelot, routes, auth", "Ocelot, rotas, auth")] as const;
  const users = ["user-service", "Azure Functions"] as const;
  const posts = ["post-service", "Azure Functions"] as const;
  const db = ["MongoDB", "Docker Compose"] as const;
  return {
    title: "STUPID-MICRO-SERVICE-ARCH",
    heading: t("ONE GATEWAY, FUNCTIONS BEHIND IT", "UM GATEWAY, FUNCTIONS ATRÁS DELE"),
    accessible: t(
      "A client calls a single Ocelot API gateway with a bearer token. The gateway checks authentication and maps each public route to a downstream Azure Function: the user service or the post service, which both store their documents in MongoDB, run with Docker Compose.",
      "Um cliente chama um único API gateway Ocelot com um bearer token. O gateway confere a autenticação e mapeia cada rota pública para uma Azure Function: o serviço de usuários ou o de posts, que guardam os documentos no MongoDB, rodando com Docker Compose."
    ),
    desktop: {
      cols: 4,
      rows: 2,
      rowH: 96,
      nodes: [
        n("client", 0, 0.5, "muted", client[0], client[1]),
        n("gateway", 1, 0.5, "accent", gateway[0], gateway[1]),
        n("users", 2, 0, "violet", users[0], users[1]),
        n("posts", 2, 1, "violet", posts[0], posts[1]),
        n("db", 3, 0.5, "amber", db[0], db[1]),
      ],
      edges: [
        e("client", "gateway", { tone: "muted" }),
        e("gateway", "users", { tone: "accent", route: "hvh" }),
        e("gateway", "posts", { tone: "accent", route: "hvh" }),
        e("users", "db", { tone: "violet", route: "hvh" }),
        e("posts", "db", { tone: "violet", route: "hvh" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      rowH: 84,
      nodes: [
        n("client", 0.5, 0, "muted", client[0], client[1], { w: 200 }),
        n("gateway", 0.5, 1, "accent", gateway[0], "Ocelot", { w: 200 }),
        n("users", 0, 2, "violet", users[0]),
        n("posts", 1, 2, "violet", posts[0]),
        n("db", 0.5, 3, "amber", db[0], undefined, { w: 200 }),
      ],
      edges: [
        e("client", "gateway", { tone: "muted" }),
        e("gateway", "users", { tone: "accent" }),
        e("gateway", "posts", { tone: "accent" }),
        e("users", "db", { tone: "violet" }),
        e("posts", "db", { tone: "violet" }),
      ],
    },
  };
});

export const projectDiagrams = {
  "project-chariot": chariotServices,
  "project-reachup": reachUpFlow,
  "project-track-me": trackMeFlow,
  "project-micro-service-arch": microServiceGateway,
};
