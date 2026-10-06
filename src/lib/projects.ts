// The repositories gabe-santana created on GitHub that have code (forks, the
// profile README repo and empty repos left out), shown on the About page. Project copy is content,
// like a post, so it lives here in both languages instead of the dictionaries.
import type { Locale } from "@/lib/i18n";

export interface Localized {
  en: string;
  pt: string;
}

export function localized(text: Localized, locale: Locale): string {
  return locale === "pt-br" ? text.pt : text.en;
}

export type ProjectMedia =
  | {
      kind: "image";
      src: string;
      alt: Localized;
      width: number;
      height: number;
      /** browser: window chrome; phone: device frame; paper: light drawing on a card; plain: as is. */
      frame: "browser" | "phone" | "paper" | "plain";
    }
  | { kind: "diagram"; id: string }
  /** Drawn by the page itself, for repos with nothing to show yet. */
  | { kind: "art"; id: "isometric" }
  | { kind: "code"; lang: string; title: string; code: string };

export interface Project {
  repo: string;
  /** Display name when it differs from the repo name. */
  name?: string;
  /** "2021" or "2022 to 2026" style span, from the repo's creation to its last push. */
  years: string;
  stars?: number;
  stack: string[];
  tagline: Localized;
  description: Localized;
  highlights?: Localized[];
  media: ProjectMedia;
  /** Floating shots layered over the main media in the showcase. */
  extras?: ProjectMedia[];
  /** Shown full width under the row, for media that only reads when large (a wide demo). */
  gallery?: ProjectMedia[];
  /** Blog post slug that tells the story in depth. */
  post?: string;
}


const img = (
  src: string,
  width: number,
  height: number,
  frame: Extract<ProjectMedia, { kind: "image" }>["frame"],
  en: string,
  pt: string
): ProjectMedia => ({ kind: "image", src, width, height, frame, alt: { en, pt } });

export const featuredProjects: Project[] = [
  {
    repo: "corollary",
    name: "Corollary",
    years: "2022 · 2026",
    stars: 17,
    stack: ["Python", "mypy strict", "Claude", "OpenAI-compatible", "Ollama", "MkDocs"],
    tagline: {
      en: "An agent runtime that keeps every conclusion tied to the evidence behind it.",
      pt: "Um runtime de agentes que mantém cada conclusão presa à evidência que a sustenta.",
    },
    description: {
      en: "Agents usually keep their state as a message log, so a wrong fact at step 3 is read at step 40 with the same trust as a verified tool result. Corollary stores beliefs instead: every claim records what it follows from, and a truth maintenance system retracts each conclusion that depended on a corrected input and re-derives only those. The model just proposes claims; the runtime validates them, runs the tools and builds every context from the beliefs still in force.",
      pt: "Agentes costumam guardar o estado como um log de mensagens, então um fato errado no passo 3 é lido no passo 40 com a mesma confiança de um resultado de ferramenta verificado. O Corollary guarda crenças no lugar: cada afirmação registra de onde ela vem, e um sistema de manutenção de verdade retira cada conclusão que dependia de uma entrada corrigida e deriva de novo só essas. O modelo apenas propõe afirmações; o runtime as valida, executa as ferramentas e monta todo contexto a partir das crenças que continuam valendo.",
    },
    highlights: [
      { en: "Correct one input and only its dependents change: 12 of 20 conclusions in the demo, with zero model calls", pt: "Corrija uma entrada e só o que dependia dela muda: 12 de 20 conclusões no demo, sem nenhuma chamada ao modelo" },
      { en: "Answers ship with a proof a deterministic verifier checks: arithmetic, citations and dates", pt: "As respostas vêm com uma prova que um verificador determinístico confere: contas, citações e datas" },
    ],
    media: img("/projects/corollary/logo.png?v=1", 1254, 1254, "plain", "The Corollary logo: a blue and violet ribbon folded into a C around a violet dot.", "O logo do Corollary: uma fita azul e violeta dobrada em C em volta de um ponto violeta."),
    gallery: [
      img("/projects/corollary/demo.gif?v=1", 960, 470, "browser", "Corollary's belief graph: Q2 revenue is corrected, the conclusions that depended on it go OUT and are re-derived, and an independent risk belief stays untouched.", "O grafo de crenças do Corollary: a receita do 2º trimestre é corrigida, as conclusões que dependiam dela saem (OUT) e são derivadas de novo, e uma crença de risco independente fica intocada."),
    ],
  },
  {
    repo: "ReachUp",
    name: "ReachUp!",
    years: "2020 · 2024",
    stars: 7,
    stack: ["Dart", "Flutter", "MobX", "ASP.NET Core", "MySQL", "BLE beacons", "TypeScript"],
    tagline: {
      en: "Google Maps for the inside of a mall, built for people who can't see it.",
      pt: "Um Google Maps para dentro do shopping, feito para quem não pode vê-lo.",
    },
    description: {
      en: "An indoor location app for blind and visually impaired visitors. Bluetooth beacons around the mall tell the phone where it is, and the app guides the visitor by voice to stores, bathrooms and restaurants. It helps anyone in a hurry too, and mall managers get visit reports and a channel for announcements.",
      pt: "Um app de localização indoor para pessoas cegas e com baixa visão. Beacons Bluetooth espalhados pelo shopping dizem ao celular onde ele está, e o app guia o visitante por voz até lojas, banheiros e restaurantes. Ajuda também qualquer um com pressa, e a gestão do shopping recebe relatórios de visitas e um canal de anúncios.",
    },
    highlights: [
      { en: "Distance from each beacon's RSSI and TxPower, zones from major and minor ids", pt: "Distância pelo RSSI e TxPower de cada beacon, zonas pelos ids major e minor" },
      { en: "A narrator mode and voice search across the whole app", pt: "Modo narrador e busca por voz no app inteiro" },
    ],
    media: img("/projects/reachup/map.webp?v=1", 540, 960, "phone", "ReachUp's indoor map with the visitor's position among the stores.", "O mapa indoor do ReachUp com a posição do visitante entre as lojas."),
    extras: [
      img("/projects/reachup/login.webp?v=1", 540, 960, "phone", "ReachUp's sign-in screen.", "A tela de entrada do ReachUp."),
      img("/projects/reachup/menu.webp?v=1", 540, 960, "phone", "The side menu with the map, announcements, narrator and feedback.", "O menu lateral com mapa, anúncios, narrador e feedback."),
      img("/projects/reachup/beacons.webp?v=1", 1400, 528, "paper", "The beacon layout mapped over a floor plan of the mall.", "A distribuição dos beacons sobre a planta do shopping."),
      { kind: "diagram", id: "project-reachup" },
    ],
  },
  {
    repo: "agentic-mesh",
    name: "AgenticMesh",
    years: "2026",
    stack: ["Python", "FastAPI", "Celery", "Qdrant", "PostgreSQL", "Redis", "Next.js", "Azure AI Foundry", "Docker"],
    tagline: {
      en: "A distributed platform for AI agents and enterprise RAG.",
      pt: "Uma plataforma distribuída de agentes de IA e RAG enterprise.",
    },
    description: {
      en: "Upload your documents, chat with an agent that answers from them and cites its sources, and open the trace behind every answer: how long retrieval and generation took, which chunks came back with what score, and the exact system prompt the model saw.",
      pt: "Você sobe seus documentos, conversa com um agente que responde a partir deles citando as fontes e abre o trace de cada resposta: quanto tempo levaram a busca e a geração, quais trechos voltaram com qual score e o prompt de sistema exato que o modelo recebeu.",
    },
    highlights: [
      { en: "Token-by-token streaming over SSE, rendered as Markdown", pt: "Streaming token a token por SSE, renderizado em Markdown" },
      { en: "Async ingestion: Celery workers chunk, embed and index into Qdrant", pt: "Ingestão assíncrona: workers Celery quebram, geram embeddings e indexam no Qdrant" },
      { en: "Six services, one docker compose up", pt: "Seis serviços, um docker compose up" },
    ],
    media: img("/projects/agentic-mesh/demo.webp?v=1", 960, 316, "browser", "AgenticMesh demo: a PDF is ingested, the chat answers with citations and the pipeline trace opens.", "Demo do AgenticMesh: um PDF é ingerido, o chat responde com citações e o trace do pipeline abre."),
    extras: [
      img("/projects/agentic-mesh/chat.webp?v=1", 1280, 820, "browser", "The chat with a Markdown answer and the pipeline trace panel.", "O chat com uma resposta em Markdown e o painel de trace do pipeline."),
      img("/projects/agentic-mesh/documents.webp?v=1", 1280, 435, "browser", "Document management: uploads, ingestion status and deletion.", "Gestão de documentos: uploads, status da ingestão e exclusão."),
    ],
    post: "agentic-mesh-architecture-rag-agents",
  },
  {
    repo: "laya-classifier",
    years: "2026",
    stack: ["Python", "Laya", "PyTorch", "FastAPI", "ModernBERT"],
    tagline: {
      en: "An email security screener where the model reads and the code checks.",
      pt: "Um filtro de segurança de e-mail em que o modelo lê e o código confere.",
    },
    description: {
      en: "Laya, an open-weights decision model, answers five typed questions about each email in one forward pass, in English and Portuguese. Plain code checks what a model shouldn't guess, like DMARC, lookalike domains and disguised links, and a short policy turns both into deliver, warn or quarantine.",
      pt: "O Laya, um modelo de decisão de pesos abertos, responde cinco perguntas tipadas sobre cada e-mail numa única passada, em inglês e português. Código comum confere o que um modelo não deve adivinhar, como DMARC, domínios parecidos e links disfarçados, e uma política curta transforma os dois em entregar, alertar ou quarentena.",
    },
    highlights: [
      { en: "9 of 10 attacks caught, no legitimate email quarantined", pt: "9 de 10 ataques pegos, nenhum e-mail legítimo em quarentena" },
      { en: "About 60 ms per email on a laptop GPU", pt: "Cerca de 60 ms por e-mail numa GPU de notebook" },
    ],
    media: img("/posts/laya-email-security-screener/demo.gif", 1100, 653, "browser", "The laya-classifier dashboard screening a sample inbox.", "O painel do laya-classifier analisando uma caixa de entrada de exemplo."),
    extras: [img("/posts/laya-email-security-screener/cover.webp", 1600, 900, "plain", "Emails passing through a scanner gate into deliver, warn and quarantine lanes.", "E-mails passando por um portal de análise para as filas de entregar, alertar e quarentena.")],
    post: "laya-email-security-screener",
  },
  {
    repo: "sightline",
    name: "Sightline",
    years: "2026",
    stack: ["Terraform", "AWS", "Bedrock", "Transcribe", "EventBridge", "Lambda", "App Runner", "RDS"],
    tagline: {
      en: "Autonomous video and audio intelligence for AI agents.",
      pt: "Inteligência autônoma de vídeo e áudio para agentes de IA.",
    },
    description: {
      en: "Turns hours of recorded video into auditable answers. Every finding comes back as schema-validated JSON with a video ID, a timestamp and a confidence score, and the model never gets to invent either of the first two.",
      pt: "Transforma horas de vídeo gravado em respostas auditáveis. Cada achado volta como JSON validado por schema, com ID do vídeo, timestamp e confiança, e o modelo nunca pode inventar os dois primeiros.",
    },
    highlights: [
      { en: "Ingestion in three EventBridge hops, each with retries and a dead-letter queue", pt: "Ingestão em três saltos de EventBridge, cada um com retry e dead-letter queue" },
      { en: "Private subnets, no NAT gateway: every AWS service through a VPC endpoint", pt: "Subnets privadas, sem NAT gateway: todo serviço AWS por VPC endpoint" },
    ],
    media: img("/posts/sightline-video-compliance-intelligence/cover.webp", 1600, 900, "plain", "Sightline cover: video frames becoming timestamped findings.", "Capa do Sightline: quadros de vídeo virando achados com timestamp."),
    extras: [img("/projects/sightline/infra.webp?v=1", 671, 681, "paper", "Sightline on AWS: App Runner, RDS and two Lambda functions in private subnets, calling Bedrock, EventBridge, Transcribe and S3.", "Sightline na AWS: App Runner, RDS e duas Lambdas em subnets privadas, chamando Bedrock, EventBridge, Transcribe e S3.")],
    post: "sightline-video-compliance-intelligence",
  },
  {
    repo: "hybrid-cloud-mcp-agentic-framework",
    name: "Hybrid MCP Agent Orchestrator",
    years: "2026",
    stack: ["Terraform", "Vertex AI", "Gemini", "MCP", "Cloud Run", "OKE", "Oracle ATP", "Kafka", "BGP"],
    tagline: {
      en: "Google Cloud's AI reasoning over Oracle Cloud's data, bridged by MCP.",
      pt: "O raciocínio de IA do Google Cloud sobre os dados da Oracle Cloud, com MCP no meio.",
    },
    description: {
      en: "A reference architecture for data sovereignty without giving up innovation: Gemini agents on Vertex AI run tools directly against an Oracle Autonomous Database through Model Context Protocol servers on OKE, over a site-to-site HA VPN, without copying the data out.",
      pt: "Uma arquitetura de referência para soberania de dados sem abrir mão de inovação: agentes Gemini no Vertex AI executam tools direto sobre um Oracle Autonomous Database por meio de servidores MCP no OKE, através de uma HA VPN site-to-site, sem copiar os dados para fora.",
    },
    highlights: [
      { en: "IPsec IKEv2 with AES-256-GCM, BGP routing, zero-overlap CIDRs", pt: "IPsec IKEv2 com AES-256-GCM, roteamento BGP, CIDRs sem sobreposição" },
      { en: "MTU clamped to 1460 bytes so MCP's JSON-RPC payloads never fragment in the tunnel", pt: "MTU fixado em 1460 bytes para os payloads JSON-RPC do MCP não fragmentarem no túnel" },
    ],
    media: img("/projects/hybrid-cloud-mcp-agentic-framework/architecture.webp?v=1", 2400, 553, "paper", "Oracle Cloud VCN and Google Cloud VPC connected by an IPsec tunnel between the DRG and the HA VPN.", "VCN da Oracle Cloud e VPC do Google Cloud ligadas por um túnel IPsec entre o DRG e a HA VPN."),
  },
  {
    repo: "gsantana-dev",
    name: "gsantana.dev",
    years: "2026",
    stack: ["Next.js", "TypeScript", "Cloudflare Pages", "D1", "R2", "Pagefind", "Tailwind"],
    tagline: { en: "This site.", pt: "Este site." },
    description: {
      en: "A statically exported Next.js site on Cloudflare, in two languages, where every page is built ahead of time. The few things that need a server, like the newsletter, GitHub sign-in and synced reading progress, are small Pages Functions on D1.",
      pt: "Um site Next.js exportado estaticamente na Cloudflare, em dois idiomas, em que toda página é gerada antes. O pouco que precisa de servidor, como a newsletter, o login com GitHub e o progresso de leitura sincronizado, são Pages Functions pequenas sobre D1.",
    },
    highlights: [
      { en: "Serverless full-text search that downloads only the chunks a query needs", pt: "Busca full-text sem servidor que baixa só os pedaços que a consulta precisa" },
      { en: "Diagrams drawn on canvas from one spec for both languages and screen sizes", pt: "Diagramas desenhados em canvas a partir de uma spec para os dois idiomas e tamanhos de tela" },
    ],
    media: img("/projects/gsantana-dev/home.webp?v=1", 1440, 900, "browser", "The gsantana.dev home page.", "A página inicial do gsantana.dev."),
  },
  {
    repo: "track-me",
    name: "Track me",
    years: "2021",
    stars: 2,
    stack: ["C#", "ASP.NET Core", "MongoDB", "Flutter", "Arduino", "Azure App Service"],
    tagline: {
      en: "Vehicle tracking, from an Arduino in the car to a live map.",
      pt: "Rastreamento de veículos, de um Arduino no carro até um mapa ao vivo.",
    },
    description: {
      en: "My final project in electronics and automation: an embedded Arduino tracker rides in the vehicle and posts its position to an ASP.NET Core API, MongoDB change streams push every new point, and a Flutter app follows the vehicle on the map.",
      pt: "Meu TCC de eletrônica e automação: um rastreador embarcado com Arduino vai no veículo e envia a posição para uma API ASP.NET Core, os change streams do MongoDB empurram cada ponto novo e um app Flutter acompanha o veículo no mapa.",
    },
    highlights: [{ en: "The API deploys to Azure App Service from GitHub Actions", pt: "A API é publicada na Azure App Service pelo GitHub Actions" }],
    media: { kind: "diagram", id: "project-track-me" },
  },
];

export const labProjects: Project[] = [
  {
    repo: "gabe-language",
    name: "Gabe language",
    years: "2021",
    stars: 4,
    stack: ["C", "x86", "Make"],
    tagline: { en: "A compiler written from scratch, for a language of my own.", pt: "Um compilador escrito do zero, para uma linguagem minha." },
    description: {
      en: "Gabe is a small, strongly typed functional language with C-like syntax, compiled for Linux on x86. The lexer and tokens are hand-written in C, to learn every stage from lexical analysis to code generation.",
      pt: "Gabe é uma linguagem funcional pequena e fortemente tipada, com sintaxe parecida com C, compilada para Linux em x86. O lexer e os tokens são escritos à mão em C, para aprender cada etapa, da análise léxica à geração de código.",
    },
    media: {
      kind: "code",
      lang: "rust",
      title: "examples/main.gab",
      code: `sumTwo = (n1: int, n2: int): int => n1 + n2;

main = (argc: int, argv: Array<string>): int => {
    sum: int = sumTwo(1, 1);
    return 0;
}`,
    },
  },
  {
    repo: "py-chess",
    years: "2022",
    stack: ["Python", "pygame"],
    tagline: { en: "A chess engine in Python, starting from the board.", pt: "Uma engine de xadrez em Python, começando pelo tabuleiro." },
    description: {
      en: "The game state, move handling and a pygame board with its piece sprites, with notes toward alpha-beta search and an evaluation function.",
      pt: "O estado do jogo, os movimentos e um tabuleiro em pygame com peças próprias, com anotações rumo à busca alfa-beta e a uma função de avaliação.",
    },
    media: img("/projects/py-chess/board.webp?v=1", 632, 670, "plain", "The py-chess board in its starting position.", "O tabuleiro do py-chess na posição inicial."),
  },
  {
    repo: "8-bit-computer",
    name: "Bart, an 8-bit computer",
    years: "2021",
    stack: ["Digital electronics", "Computer architecture"],
    tagline: { en: "A computer from logic gates up.", pt: "Um computador a partir das portas lógicas." },
    description: {
      en: "The architecture of an 8-bit computer in the spirit of Malvino's Digital Computer Electronics: program counter, memory address register, 16-byte RAM, instruction register, accumulator, ALU and output register on one bus.",
      pt: "A arquitetura de um computador de 8 bits no espírito do Digital Computer Electronics, do Malvino: contador de programa, registrador de endereço, RAM de 16 bytes, registrador de instrução, acumulador, ULA e registrador de saída num só barramento.",
    },
    media: img("/projects/8-bit-computer/schematic.webp?v=1", 1100, 1087, "paper", "Block diagram of the 8-bit computer's registers, ALU and control unit on a shared bus.", "Diagrama de blocos dos registradores, da ULA e da unidade de controle do computador de 8 bits num barramento comum."),
  },
  {
    repo: "quantum",
    years: "2022",
    stars: 4,
    stack: ["Q#", ".NET"],
    tagline: { en: "First steps in quantum programming.", pt: "Primeiros passos em programação quântica." },
    description: {
      en: "Small Q# programs on the .NET quantum SDK: putting a qubit in superposition, measuring it, and quantum arithmetic operations.",
      pt: "Programas pequenos em Q# no SDK quântico do .NET: colocar um qubit em superposição, medi-lo e operações aritméticas quânticas.",
    },
    media: {
      kind: "code",
      lang: "csharp",
      title: "theory/superposition.qs",
      code: `operation MeasureSuperposition() : Result {
    use q = Qubit();    // starts in |0>
    H(q);               // |0> and |1> at once
    return MResetZ(q);  // measure, then reset
}`,
    },
  },
  {
    repo: "stupid-micro-service-arch",
    years: "2022",
    stars: 1,
    stack: ["C#", "Ocelot", "Azure Functions", "MongoDB", "Docker"],
    tagline: { en: "Microservices, the smallest version that still counts.", pt: "Microsserviços, na menor versão que ainda conta." },
    description: {
      en: "An Ocelot API gateway that authenticates bearer tokens and routes each public path to an Azure Function, with user and post services on MongoDB.",
      pt: "Um API gateway Ocelot que autentica bearer tokens e roteia cada caminho público para uma Azure Function, com serviços de usuários e posts sobre MongoDB.",
    },
    media: { kind: "diagram", id: "project-micro-service-arch" },
  },
  {
    repo: "rest-api-template",
    years: "2021",
    stack: ["C#", ".NET 5", "EF Core", "Docker", "DDD"],
    tagline: { en: "A REST API template in DDD layers.", pt: "Um template de API REST em camadas DDD." },
    description: {
      en: "A starting point for .NET 5 APIs: application services with DTOs and mappers, a domain core with repository interfaces, infrastructure on Entity Framework, all in Docker.",
      pt: "Um ponto de partida para APIs .NET 5: serviços de aplicação com DTOs e mappers, um núcleo de domínio com interfaces de repositório, infraestrutura em Entity Framework, tudo em Docker.",
    },
    media: {
      kind: "code",
      lang: "plaintext",
      title: "src",
      code: `Application/   services, DTOs, mappers
Domain/        entities
Domain.Core/   repository and service interfaces
Domain.Services/
Infra/         Entity Framework, repositories
Services/API/  controllers, Dockerfile`,
    },
  },
  {
    repo: "ecomm-api",
    years: "2021",
    stack: ["C#", "ASP.NET Core", "EF Core"],
    tagline: { en: "A generic Web API for e-commerce.", pt: "Uma Web API genérica para e-commerce." },
    description: {
      en: "Products and categories behind a generic repository and a unit of work, so each new entity gets its CRUD for free.",
      pt: "Produtos e categorias atrás de um repositório genérico e de um unit of work, para cada entidade nova ganhar o CRUD de graça.",
    },
    media: {
      kind: "code",
      lang: "csharp",
      title: "Repositories/BaseRepository.cs",
      code: `public class BaseRepository<T> : IBaseRepository<T> where T : class
{
    public async Task<T> Get(int id) =>
        await _context.Set<T>().FindAsync(id);

    public async Task<IEnumerable<T>> GetAll() =>
        await _context.Set<T>().ToListAsync();
}`,
    },
  },
  {
    repo: "web-api-elixir",
    years: "2021",
    stack: ["Elixir", "Phoenix", "Ecto"],
    tagline: { en: "A JSON API on Phoenix.", pt: "Uma API JSON em Phoenix." },
    description: {
      en: "A Phoenix API scaffold with Ecto, a JSON pipeline and LiveDashboard telemetry in development.",
      pt: "A base de uma API Phoenix com Ecto, um pipeline JSON e telemetria no LiveDashboard em desenvolvimento.",
    },
    media: {
      kind: "code",
      lang: "elixir",
      title: "lib/webapi_web/router.ex",
      code: `pipeline :api do
  plug :accepts, ["json"]
end

scope "/api", WebapiWeb do
  pipe_through :api
end`,
    },
  },
  {
    repo: "elixir-guide",
    years: "2021",
    stack: ["Elixir"],
    tagline: { en: "Notes on Elixir, one concept per file.", pt: "Anotações de Elixir, um conceito por arquivo." },
    description: {
      en: "Pattern matching, the match operator and the pin operator, written as runnable scripts with the output next to each line.",
      pt: "Pattern matching, o operador de match e o pin operator, escritos como scripts executáveis com a saída ao lado de cada linha.",
    },
    media: {
      kind: "code",
      lang: "elixir",
      title: "pattern_matching/pin_operator.exs",
      code: `x = 1
^x = 2              # ** (MatchError)
[^x, 2, 3] = [1, 2, 3]
{y, ^x} = {2, 1}
[head | _] = [1, 2, 3]`,
    },
  },
  {
    repo: "wake-up-dude-it-is-time-to-code-in-pascal",
    name: "Wake up dude, it's time to code in Pascal",
    years: "2021",
    stack: ["Pascal"],
    tagline: { en: "Classic algorithms, in a classic language.", pt: "Algoritmos clássicos, numa linguagem clássica." },
    description: {
      en: "Dijkstra's shortest path over an adjacency matrix, bubble sort and quicksort, in Pascal.",
      pt: "O caminho mínimo de Dijkstra sobre uma matriz de adjacência, bubble sort e quicksort, em Pascal.",
    },
    media: {
      kind: "code",
      lang: "pascal",
      title: "geografical-algorithms/dijkstra.pas",
      code: `for I := 1 to N do
  if (D[C, I] <> 0) and (not ExpA[I]) then
  begin
    NewDA := DA[C] + D[C, I];
    if NewDA < DA[I] then
    begin
      DA[I] := NewDA;
      Ant[I] := C
    end
  end;`,
    },
  },
  {
    repo: "iso-game",
    years: "2021",
    stack: ["Godot", "GDScript"],
    tagline: { en: "An isometric game in Godot.", pt: "Um jogo isométrico em Godot." },
    description: {
      en: "The first commits of an isometric game in the Godot engine.",
      pt: "Os primeiros commits de um jogo isométrico na engine Godot.",
    },
    media: { kind: "art", id: "isometric" },
  },
];


export const projectCount = featuredProjects.length + labProjects.length;
