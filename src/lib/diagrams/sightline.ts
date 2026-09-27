import type { Locale } from "@/lib/i18n";
import type { Diagram, DiagramNode, Edge, Label, Layout, Tone } from "@/lib/diagrams/types";

// Hand-placed layouts for the three diagrams in the Sightline post
// (content/posts/*/sightline-video-compliance-intelligence.md).

const copy = {
  "en-us": {
    system: {
      heading: "SYSTEM MAP",
      accessible:
        "Sightline system map. Analysts reach app-service on AWS App Runner over HTTPS, the only public entry point. Inside a single VPC with no NAT gateway, app-service and the two Lambda jobs, transcriber-job and embedding-job, reach Amazon Transcribe, Amazon Bedrock, Amazon S3 Vectors, Amazon S3, Amazon EventBridge and Amazon RDS only through VPC endpoints and security groups.",
      analysts: ["Analysts", "browser"],
      vpc: "ONE VPC · NO NAT GATEWAY",
      app: "APP · PUBLIC",
      jobs: "JOBS · PRIVATE",
      ai: "AI · MANAGED",
      storage: "STORAGE",
      bus: "ENDPOINTS + SECURITY GROUPS",
      appService: ["app-service", "App Runner · Next.js"],
      transcriber: ["transcriber-job", "Lambda · Python"],
      embedder: ["embedding-job", "Lambda · Python"],
      transcribe: ["Transcribe", "speech to text"],
      bedrock: ["Bedrock", "Titan + Claude"],
      vectors: ["S3 Vectors", "semantic index"],
      s3: ["Amazon S3", "video + transcripts"],
      events: ["EventBridge", "event backbone"],
      rds: ["Amazon RDS", "segments + status"],
      note: ["Only app-service faces the internet,", "and nothing inside can reach it."],
    },
    ingestion: {
      heading: "INGESTION · 3 HOPS",
      accessible:
        "Ingestion in three EventBridge hops. Hop 1: a video lands in S3 under videos/, rule 1 invokes transcriber-job, which starts an asynchronous Amazon Transcribe job. Hop 2: Transcribe writes its JSON to transcribe-output/, rule 2 invokes transcriber-job again to group words into segments, save them in RDS and publish a transcript_ready event. Hop 3: rule 3 invokes embedding-job for that one video, which embeds each segment with Bedrock Titan and writes the vectors to S3 Vectors. Every rule retries 3 times and then sends the event to its own dead-letter queue.",
      hops: [["HOP 1", "upload"], ["HOP 2", "Transcribe done"], ["HOP 3", "domain event"]],
      dlq: "3 retries · DLQ",
      upload: ["Amazon S3", "videos/{id}/"],
      rule1: ["Rule 1", "Object Created"],
      start: ["transcriber-job", "start the job"],
      transcribe: ["Transcribe", "async batch job"],
      output: ["Amazon S3", "transcribe-output/"],
      rule2: ["Rule 2", "Object Created"],
      parse: ["transcriber-job", "segments → RDS"],
      ready: ["transcript_ready", "custom event"],
      rule3: ["Rule 3", "transcript_ready"],
      embed: ["embedding-job", "one video per event"],
      titan: ["Bedrock", "Titan v2 · 1024d"],
      vectors: ["S3 Vectors", "put_vectors"],
      writes: "writes JSON",
      publishes: "put_events",
    },
    query: {
      heading: "QUERY · GROUNDED BY CONSTRUCTION",
      accessible:
        "Query path. The question is embedded with Bedrock Titan and searched in S3 Vectors for the top 5 transcript segments. Bedrock Claude only returns which excerpt indices are relevant and a claim for each. The route then assembles each finding with the video_id, timestamp_s and score taken from the search hit itself, never from the model. The response is validated against a strict JSON Schema with Ajv: valid responses return 200, invalid ones become a typed 502 error. With no hits, the answer is an empty findings array.",
      question: ["Question", "POST /api/query"],
      titan: ["Bedrock Titan", "embed the question"],
      vectors: ["S3 Vectors", "top 5 segments"],
      claude: ["Bedrock Claude", "indices + claims"],
      assemble: ["Assemble findings", "citations from the hit"],
      validate: ["Ajv validation", "strict schema"],
      response: ["Response", "200 · findings[]"],
      error: ["502 · typed error", ""],
      cite: "video_id · timestamp_s",
      score: "score → confidence",
      plan: "indices · claims",
      empty: "no hits → findings: [] is a valid answer",
    },
  },
  "pt-br": {
    system: {
      heading: "MAPA DO SISTEMA",
      accessible:
        "Mapa do sistema Sightline. Analistas acessam o app-service no AWS App Runner por HTTPS, o único ponto de entrada público. Dentro de uma única VPC sem NAT gateway, o app-service e os dois jobs Lambda, transcriber-job e embedding-job, alcançam Amazon Transcribe, Amazon Bedrock, Amazon S3 Vectors, Amazon S3, Amazon EventBridge e Amazon RDS apenas por VPC endpoints e security groups.",
      analysts: ["Analistas", "navegador"],
      vpc: "UMA VPC · SEM NAT GATEWAY",
      app: "APP · PÚBLICO",
      jobs: "JOBS · PRIVADO",
      ai: "IA · GERENCIADA",
      storage: "ARMAZENAMENTO",
      bus: "ENDPOINTS + SECURITY GROUPS",
      appService: ["app-service", "App Runner · Next.js"],
      transcriber: ["transcriber-job", "Lambda · Python"],
      embedder: ["embedding-job", "Lambda · Python"],
      transcribe: ["Transcribe", "fala para texto"],
      bedrock: ["Bedrock", "Titan + Claude"],
      vectors: ["S3 Vectors", "índice semântico"],
      s3: ["Amazon S3", "vídeos + transcrições"],
      events: ["EventBridge", "barramento de eventos"],
      rds: ["Amazon RDS", "segmentos + status"],
      note: ["Só o app-service fica exposto à internet,", "e nada lá dentro consegue alcançá-la."],
    },
    ingestion: {
      heading: "INGESTÃO · 3 ETAPAS",
      accessible:
        "Ingestão em três etapas do EventBridge. Etapa 1: um vídeo chega ao S3 em videos/, a regra 1 invoca o transcriber-job, que inicia um job assíncrono do Amazon Transcribe. Etapa 2: o Transcribe grava seu JSON em transcribe-output/, a regra 2 invoca o transcriber-job de novo para agrupar palavras em segmentos, salvá-los no RDS e publicar um evento transcript_ready. Etapa 3: a regra 3 invoca o embedding-job para aquele vídeo, que gera embeddings de cada segmento com o Bedrock Titan e grava os vetores no S3 Vectors. Cada regra tenta 3 vezes e depois manda o evento para sua própria dead-letter queue.",
      hops: [["ETAPA 1", "upload"], ["ETAPA 2", "Transcribe pronto"], ["ETAPA 3", "evento de domínio"]],
      dlq: "3 tentativas · DLQ",
      upload: ["Amazon S3", "videos/{id}/"],
      rule1: ["Regra 1", "Object Created"],
      start: ["transcriber-job", "inicia o job"],
      transcribe: ["Transcribe", "job em lote assíncrono"],
      output: ["Amazon S3", "transcribe-output/"],
      rule2: ["Regra 2", "Object Created"],
      parse: ["transcriber-job", "segmentos → RDS"],
      ready: ["transcript_ready", "evento customizado"],
      rule3: ["Regra 3", "transcript_ready"],
      embed: ["embedding-job", "um vídeo por evento"],
      titan: ["Bedrock", "Titan v2 · 1024d"],
      vectors: ["S3 Vectors", "put_vectors"],
      writes: "grava o JSON",
      publishes: "put_events",
    },
    query: {
      heading: "CONSULTA · ANCORADA POR CONSTRUÇÃO",
      accessible:
        "Caminho da consulta. A pergunta vira embedding com o Bedrock Titan e é buscada no S3 Vectors, que devolve os 5 segmentos de transcrição mais próximos. O Bedrock Claude só devolve quais índices de trechos são relevantes e uma afirmação para cada um. A rota então monta cada finding com o video_id, o timestamp_s e o score do próprio resultado da busca, nunca do modelo. A resposta é validada contra um JSON Schema estrito com Ajv: respostas válidas voltam com 200, inválidas viram um erro 502 tipado. Sem resultados, a resposta é um array findings vazio.",
      question: ["Pergunta", "POST /api/query"],
      titan: ["Bedrock Titan", "embedding da pergunta"],
      vectors: ["S3 Vectors", "top 5 segmentos"],
      claude: ["Bedrock Claude", "índices + afirmações"],
      assemble: ["Monta os findings", "citações vêm da busca"],
      validate: ["Validação Ajv", "schema estrito"],
      response: ["Resposta", "200 · findings[]"],
      error: ["502 · erro tipado", ""],
      cite: "video_id · timestamp_s",
      score: "score → confidence",
      plan: "índices · afirmações",
      empty: "sem resultados → findings: [] é resposta válida",
    },
  },
} as const satisfies Record<Locale, unknown>;

type Pair = readonly [string, string] | string[];
const hopTone = (i: number): Tone => (i === 0 ? "accent" : i === 1 ? "blue" : "amber");
const node = (x: number, y: number, w: number, h: number, tone: Tone, [title, detail]: Pair, pill?: string): DiagramNode => ({
  x, y, w, h, tone, title, detail: detail ? [detail] : undefined, pill,
});

function systemDiagram(locale: Locale): Diagram {
  const c = copy[locale].system;
  const desktop: Layout = {
    width: 760,
    height: 470,
    zones: [
      { x: 150, y: 48, w: 594, h: 370, tone: "muted", label: c.vpc, dashed: true },
      { x: 166, y: 76, w: 170, h: 124, tone: "accent", label: c.app },
      { x: 166, y: 216, w: 170, h: 188, tone: "amber", label: c.jobs },
      { x: 350, y: 76, w: 24, h: 328, tone: "blue", filled: true },
      { x: 388, y: 76, w: 166, h: 240, tone: "blue", label: c.ai },
      { x: 566, y: 114, w: 166, h: 248, tone: "muted", label: c.storage },
    ],
    nodes: [
      node(16, 110, 118, 56, "muted", c.analysts),
      node(181, 110, 140, 56, "accent", c.appService),
      node(181, 252, 140, 50, "amber", c.transcriber),
      node(181, 330, 140, 50, "amber", c.embedder),
      node(403, 105, 136, 46, "blue", c.transcribe),
      node(403, 183, 136, 46, "blue", c.bedrock),
      node(403, 261, 136, 46, "blue", c.vectors),
      node(581, 144, 136, 46, "muted", c.s3),
      node(581, 222, 136, 46, "muted", c.events),
      node(581, 300, 136, 46, "muted", c.rds),
    ],
    edges: [
      { points: [[134, 138], [181, 138]], tone: "accent" },
      { points: [[321, 138], [350, 138]], tone: "accent" },
      { points: [[321, 277], [350, 277]], tone: "amber" },
      { points: [[321, 355], [350, 355]], tone: "amber" },
      { points: [[374, 128], [403, 128]], tone: "blue" },
      { points: [[374, 206], [403, 206]], tone: "blue" },
      { points: [[374, 284], [403, 284]], tone: "blue" },
      { points: [[374, 167], [581, 167]], tone: "muted" },
      { points: [[374, 245], [581, 245]], tone: "muted" },
      { points: [[374, 323], [581, 323]], tone: "muted" },
    ],
    labels: [
      { x: 157, y: 126, text: "HTTPS", tone: "accent", size: 9, weight: 700, align: "center" },
      { x: 362, y: 240, text: c.bus, tone: "blue", size: 9, weight: 700, align: "center", vertical: true },
      { x: 447, y: 438, text: c.note[0], tone: "muted", size: 11, align: "center" },
      { x: 447, y: 454, text: c.note[1], tone: "muted", size: 11, align: "center" },
    ],
  };
  const mobile: Layout = {
    width: 360,
    height: 660,
    zones: [
      { x: 12, y: 118, w: 336, h: 482, tone: "muted", label: c.vpc, dashed: true },
      { x: 24, y: 144, w: 312, h: 86, tone: "accent", label: c.app },
      { x: 24, y: 242, w: 312, h: 86, tone: "amber", label: c.jobs },
      { x: 24, y: 342, w: 312, h: 24, tone: "blue", filled: true },
      { x: 24, y: 380, w: 152, h: 206, tone: "blue", label: c.ai },
      { x: 184, y: 380, w: 152, h: 206, tone: "muted", label: c.storage },
    ],
    nodes: [
      node(110, 50, 140, 48, "muted", c.analysts),
      node(70, 170, 220, 48, "accent", c.appService),
      node(36, 268, 138, 48, "amber", c.transcriber),
      node(186, 268, 138, 48, "amber", c.embedder),
      node(34, 404, 132, 46, "blue", c.transcribe),
      node(34, 460, 132, 46, "blue", c.bedrock),
      node(34, 516, 132, 46, "blue", c.vectors),
      node(194, 404, 132, 46, "muted", c.s3),
      node(194, 460, 132, 46, "muted", c.events),
      node(194, 516, 132, 46, "muted", c.rds),
    ],
    edges: [
      { points: [[180, 98], [180, 170]], tone: "accent" },
      { points: [[180, 218], [180, 342]], tone: "accent" },
      { points: [[105, 316], [105, 342]], tone: "amber" },
      { points: [[255, 316], [255, 342]], tone: "amber" },
      { points: [[150, 366], [150, 404]], tone: "blue" },
      { points: [[310, 366], [310, 404]], tone: "muted" },
    ],
    labels: [
      { x: 188, y: 110, text: "HTTPS", tone: "accent", size: 9, weight: 700, align: "left" },
      { x: 180, y: 355, text: c.bus, tone: "blue", size: 9, weight: 700, align: "center" },
      { x: 180, y: 624, text: c.note[0], tone: "muted", size: 11, align: "center" },
      { x: 180, y: 640, text: c.note[1], tone: "muted", size: 11, align: "center" },
    ],
  };
  return { title: "SIGHTLINE", heading: c.heading, accessible: c.accessible, desktop, mobile };
}

function ingestionDiagram(locale: Locale): Diagram {
  const c = copy[locale].ingestion;
  const col = (i: number) => 100 + i * 172;
  const row = (i: number) => 70 + i * 118;
  const w = 138;
  const h = 56;
  const desktop: Layout = {
    width: 760,
    height: 400,
    zones: [],
    nodes: [
      node(col(0), row(0), w, h, "accent", c.upload),
      node(col(1), row(0), w, h, "accent", c.rule1, c.dlq),
      node(col(2), row(0), w, h, "accent", c.start),
      node(col(3), row(0), w, h, "accent", c.transcribe),
      node(col(3), row(1), w, h, "blue", c.output),
      node(col(2), row(1), w, h, "blue", c.rule2, c.dlq),
      node(col(1), row(1), w, h, "blue", c.parse),
      node(col(0), row(1), w, h, "blue", c.ready),
      node(col(0), row(2), w, h, "amber", c.rule3, c.dlq),
      node(col(1), row(2), w, h, "amber", c.embed),
      node(col(2), row(2), w, h, "amber", c.titan),
      node(col(3), row(2), w, h, "amber", c.vectors),
    ],
    edges: [
      ...[0, 1, 2].map((i): Edge => ({ points: [[col(i) + w, row(0) + 28], [col(i + 1), row(0) + 28]], tone: "accent" })),
      { points: [[col(3) + w / 2, row(0) + h], [col(3) + w / 2, row(1)]], tone: "accent" },
      ...[3, 2, 1].map((i): Edge => ({ points: [[col(i), row(1) + 28], [col(i - 1) + w, row(1) + 28]], tone: "blue" })),
      { points: [[col(0) + w / 2, row(1) + h], [col(0) + w / 2, row(2)]], tone: "blue" },
      ...[0, 1, 2].map((i): Edge => ({ points: [[col(i) + w, row(2) + 28], [col(i + 1), row(2) + 28]], tone: "amber" })),
    ],
    labels: [
      ...c.hops.flatMap(([hop, detail], i): Label[] => [
        { x: 16, y: row(i) + 20, text: hop, tone: hopTone(i), size: 11, weight: 700 },
        { x: 16, y: row(i) + 38, text: detail, tone: "muted", size: 10 },
      ]),
      { x: col(3) + w / 2 + 8, y: row(0) + h + 32, text: c.writes, tone: "muted", size: 10 },
      { x: col(0) + w / 2 + 8, y: row(1) + h + 32, text: c.publishes, tone: "muted", size: 10 },
    ],
  };

  // Phones: each hop is a 2x2 snake (left to right, down, right to left).
  const left = 20;
  const right = 190;
  const mw = 150;
  const mh = 46;
  const starts = (i: number) => 50 + i * 172;
  const mobileHops: [Pair, Pair, Pair, Pair][] = [
    [c.upload, [c.rule1[0], c.dlq], c.start, c.transcribe],
    [c.output, [c.rule2[0], c.dlq], c.parse, c.ready],
    [[c.rule3[0], c.dlq], c.embed, c.titan, c.vectors],
  ];
  const mobile: Layout = {
    width: 360,
    height: 550,
    zones: [],
    nodes: mobileHops.flatMap(([a, b, cc, d], i) => {
      const top = starts(i) + 12;
      return [
        node(left, top, mw, mh, hopTone(i), a),
        node(right, top, mw, mh, hopTone(i), b),
        node(right, top + 72, mw, mh, hopTone(i), cc),
        node(left, top + 72, mw, mh, hopTone(i), d),
      ];
    }),
    edges: [0, 1, 2].flatMap((i): Edge[] => {
      const top = starts(i) + 12;
      const tone = hopTone(i);
      const edges: Edge[] = [
        { points: [[left + mw, top + 23], [right, top + 23]], tone },
        { points: [[right + mw / 2, top + mh], [right + mw / 2, top + 72]], tone },
        { points: [[right, top + 95], [left + mw, top + 95]], tone },
      ];
      if (i < 2) {
        edges.push({ points: [[left + 75, top + 118], [left + 75, starts(i + 1) + 12]], tone });
      }
      return edges;
    }),
    labels: [
      ...c.hops.map(([hop, detail], i): Label => ({
        x: 340, y: starts(i) + 2, text: `${hop} · ${detail}`, tone: hopTone(i), size: 10, weight: 700, align: "right",
      })),
      { x: left + 83, y: starts(1) - 16, text: c.writes, tone: "muted", size: 10 },
      { x: left + 83, y: starts(2) - 16, text: c.publishes, tone: "muted", size: 10 },
    ],
  };
  return { title: "SIGHTLINE", heading: c.heading, accessible: c.accessible, desktop, mobile };
}

function queryDiagram(locale: Locale): Diagram {
  const c = copy[locale].query;
  const w = 150;
  const h = 56;
  const col = (i: number) => 20 + i * 188;
  const center = (i: number) => col(i) + w / 2;
  const desktop: Layout = {
    width: 760,
    height: 390,
    zones: [],
    nodes: [
      node(col(0), 70, w, h, "muted", c.question),
      node(col(1), 70, w, h, "blue", c.titan),
      node(col(2), 70, w, h, "accent", c.vectors),
      node(col(3), 70, w, h, "blue", c.claude),
      node(col(2), 236, w, h, "accent", c.assemble),
      node(col(1), 236, w, h, "accent", c.validate),
      node(col(0), 236, w, h, "accent", c.response),
      node(col(1), 330, w, 32, "danger", c.error),
    ],
    edges: [
      { points: [[col(0) + w, 98], [col(1), 98]], tone: "blue" },
      { points: [[col(1) + w, 98], [col(2), 98]], tone: "blue" },
      { points: [[col(2) + w, 98], [col(3), 98]], tone: "blue" },
      { points: [[center(2), 126], [center(2), 236]], tone: "accent" },
      { points: [[center(3), 126], [center(3), 264], [col(2) + w, 264]], tone: "blue" },
      { points: [[col(2), 264], [col(1) + w, 264]], tone: "accent" },
      { points: [[col(1), 264], [col(0) + w, 264]], tone: "accent" },
      { points: [[center(1), 292], [center(1), 330]], tone: "danger", dashed: true },
    ],
    labels: [
      { x: center(2) + 8, y: 168, text: c.cite, tone: "accent", size: 10, weight: 700 },
      { x: center(2) + 8, y: 184, text: c.score, tone: "muted", size: 10 },
      { x: center(3) - 8, y: 214, text: c.plan, tone: "blue", size: 10, weight: 700, align: "right" },
      { x: col(2), y: 350, text: c.empty, tone: "muted", size: 10 },
    ],
  };
  const x = 60;
  const mw = 240;
  const mh = 46;
  const ys = (i: number) => (i < 4 ? 52 + i * 66 : 332 + (i - 4) * 66);
  const mobile: Layout = {
    width: 360,
    height: 610,
    zones: [],
    nodes: [
      node(x, ys(0), mw, mh, "muted", c.question),
      node(x, ys(1), mw, mh, "blue", c.titan),
      node(x, ys(2), mw, mh, "accent", c.vectors),
      node(x, ys(3), mw, mh, "blue", c.claude),
      node(x, ys(4), mw, mh, "accent", c.assemble),
      node(x, ys(5), mw, mh, "accent", c.validate),
      node(x, ys(6), mw, mh, "accent", c.response),
      node(x, 534, mw, 30, "danger", c.error),
    ],
    edges: [
      ...[0, 1, 2].map((i): Edge => ({ points: [[180, ys(i) + mh], [180, ys(i + 1)]], tone: "blue" })),
      { points: [[180, ys(3) + mh], [180, ys(4)]], tone: "blue" },
      { points: [[x + mw, ys(2) + 23], [336, ys(2) + 23], [336, ys(4) + 23], [x + mw, ys(4) + 23]], tone: "accent" },
      ...[4, 5].map((i): Edge => ({ points: [[180, ys(i) + mh], [180, ys(i + 1)]], tone: "accent" })),
      { points: [[x, ys(5) + 23], [36, ys(5) + 23], [36, 549], [x, 549]], tone: "danger", dashed: true },
    ],
    labels: [
      { x: 348, y: (ys(2) + ys(4)) / 2 + 23, text: c.cite, tone: "accent", size: 9, weight: 700, align: "center", vertical: true },
      { x: 188, y: ys(3) + mh + 20, text: c.plan, tone: "blue", size: 9, weight: 700 },
      { x: 180, y: 590, text: c.empty, tone: "muted", size: 10, align: "center" },
    ],
  };
  return { title: "SIGHTLINE", heading: c.heading, accessible: c.accessible, desktop, mobile };
}

export const sightlineDiagrams: Record<string, (locale: Locale) => Diagram> = {
  "sightline-system": systemDiagram,
  "sightline-ingestion": ingestionDiagram,
  "sightline-query": queryDiagram,
};
