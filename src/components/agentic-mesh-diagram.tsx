"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";

type DiagramNode = { name: string; detail: string };

const copy = {
  "en-us": {
    map: "SYSTEM MAP",
    query: "LIVE QUESTION PATH",
    ingest: "ASYNC INGESTION PATH",
    state: "Users, documents, chats, runs",
    accessible:
      "AgenticMesh architecture. Live questions flow from Next.js through FastAPI, Qdrant retrieval, the RAG agent, and Azure AI Foundry generation. Document ingestion flows from upload through FastAPI, Redis, Celery, Azure AI embeddings, and Qdrant. PostgreSQL stores application state.",
    live: [
      { name: "Next.js", detail: "Browser" },
      { name: "FastAPI", detail: "REST + SSE" },
      { name: "Qdrant", detail: "Retrieval" },
      { name: "RAG Agent", detail: "Context" },
      { name: "Azure AI", detail: "Generation" },
    ],
    batch: [
      { name: "Document", detail: ".txt / .md / .pdf" },
      { name: "FastAPI", detail: "Upload" },
      { name: "Redis", detail: "Queue" },
      { name: "Celery", detail: "Worker" },
      { name: "Azure AI", detail: "Embeddings" },
      { name: "Qdrant", detail: "Vectors" },
    ],
  },
  "pt-br": {
    map: "MAPA DO SISTEMA",
    query: "CONSULTA EM TEMPO REAL",
    ingest: "INGESTÃO ASSÍNCRONA",
    state: "Usuários, documentos, chats, execuções",
    accessible:
      "Arquitetura do AgenticMesh. A consulta passa por Next.js, FastAPI, busca no Qdrant, agente RAG e geração no Azure AI Foundry. A ingestão de documentos passa por upload, FastAPI, Redis, Celery, embeddings no Azure AI e Qdrant. PostgreSQL armazena o estado da aplicação.",
    live: [
      { name: "Next.js", detail: "Navegador" },
      { name: "FastAPI", detail: "REST + SSE" },
      { name: "Qdrant", detail: "Busca" },
      { name: "Agente RAG", detail: "Contexto" },
      { name: "Azure AI", detail: "Geração" },
    ],
    batch: [
      { name: "Documento", detail: ".txt / .md / .pdf" },
      { name: "FastAPI", detail: "Envio" },
      { name: "Redis", detail: "Fila" },
      { name: "Celery", detail: "Worker" },
      { name: "Azure AI", detail: "Embeddings" },
      { name: "Qdrant", detail: "Vetores" },
    ],
  },
} satisfies Record<Locale, {
  map: string;
  query: string;
  ingest: string;
  state: string;
  accessible: string;
  live: DiagramNode[];
  batch: DiagramNode[];
}>;

const colors = {
  background: "#0b1018",
  surface: "#111923",
  border: "#2b3442",
  text: "#edf2f7",
  muted: "#9ba7b8",
  live: "#5eead4",
  ingest: "#f3bf70",
};

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number, font: string) {
  let current = size;
  do {
    ctx.font = `${weight} ${current}px ${font}`;
    if (ctx.measureText(value).width <= maxWidth) break;
    current -= 0.5;
  } while (current > 9);
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  font: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillRect(x + 1, y + 10, 2, height - 20);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  fitText(ctx, node.name, width - 16, 13, 700, font);
  ctx.fillStyle = colors.text;
  ctx.fillText(node.name, x + width / 2, y + height / 2 - 10);

  fitText(ctx, node.detail, width - 14, 11, 400, font);
  ctx.fillStyle = colors.muted;
  ctx.fillText(node.detail, x + width / 2, y + height / 2 + 12);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
  progress: number,
  vertical: boolean,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - 3.5, endY - 4);
    ctx.lineTo(endX + 3.5, endY - 4);
  } else {
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - 4, endY - 3.5);
    ctx.lineTo(endX - 4, endY + 3.5);
  }
  ctx.closePath();
  ctx.fill();

  const dotX = startX + (endX - startX) * progress;
  const dotY = startY + (endY - startY) * progress;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 2.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiagram(ctx: CanvasRenderingContext2D, width: number, height: number, locale: Locale, time: number, font: string) {
  const labels = copy[locale];
  const mobile = width < 540;
  const phase = (time / 1700) % 1;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 12px ${font}`;
  ctx.fillStyle = colors.text;
  ctx.fillText("AGENTICMESH", 16, 28);
  ctx.textAlign = "right";
  ctx.font = `500 10px ${font}`;
  ctx.fillStyle = colors.muted;
  ctx.fillText(labels.map, width - 16, 28);

  if (mobile) {
    const margin = 16;
    const gap = 12;
    const columnWidth = (width - margin * 2 - gap) / 2;
    const nodeHeight = 58;
    const step = 72;
    const top = 96;

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 62);
    ctx.lineTo(width / 2, 531);
    ctx.stroke();

    [labels.query, labels.ingest].forEach((label, index) => {
      const x = index === 0 ? margin : margin + columnWidth + gap;
      ctx.textAlign = "left";
      fitText(ctx, label, columnWidth, 10, 700, font);
      ctx.fillStyle = index === 0 ? colors.live : colors.ingest;
      ctx.fillText(label, x, 72);
    });

    [labels.live, labels.batch].forEach((nodes, column) => {
      const x = column === 0 ? margin : margin + columnWidth + gap;
      const accent = column === 0 ? colors.live : colors.ingest;
      nodes.forEach((node, index) => {
        const y = top + index * step;
        drawNode(ctx, node, x, y, columnWidth, nodeHeight, accent, font);
        if (index < nodes.length - 1) {
          drawArrow(
            ctx,
            x + columnWidth / 2,
            y + nodeHeight + 2,
            x + columnWidth / 2,
            y + step - 3,
            accent,
            (phase + index * 0.16) % 1,
            true,
          );
        }
      });
    });

    drawState(ctx, 16, 565, width - 32, 66, labels.state, font, true);
  } else {
    const margin = 20;
    const liveGap = 16;
    const liveWidth = (width - margin * 2 - liveGap * (labels.live.length - 1)) / labels.live.length;
    const batchGap = 12;
    const batchWidth = (width - margin * 2 - batchGap * 5) / 6;
    const nodeHeight = 68;

    ctx.textAlign = "left";
    ctx.font = `700 11px ${font}`;
    ctx.fillStyle = colors.live;
    ctx.fillText(labels.query, margin, 72);
    ctx.fillStyle = colors.ingest;
    ctx.fillText(labels.ingest, margin, 224);
    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(margin, 190);
    ctx.lineTo(width - margin, 190);
    ctx.stroke();

    labels.live.forEach((node, index) => {
      const x = margin + index * (liveWidth + liveGap);
      drawNode(ctx, node, x, 91, liveWidth, nodeHeight, colors.live, font);
      if (index < labels.live.length - 1) {
        drawArrow(ctx, x + liveWidth + 3, 125, x + liveWidth + liveGap - 3, 125, colors.live, (phase + index * 0.24) % 1, false);
      }
    });

    labels.batch.forEach((node, index) => {
      const x = margin + index * (batchWidth + batchGap);
      drawNode(ctx, node, x, 243, batchWidth, nodeHeight, colors.ingest, font);
      if (index < labels.batch.length - 1) {
        drawArrow(ctx, x + batchWidth + 1, 277, x + batchWidth + batchGap - 2, 277, colors.ingest, (phase + index * 0.16) % 1, false);
      }
    });

    drawState(ctx, margin, 362, width - margin * 2, 56, labels.state, font, false);
  }
}

function drawState(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  detail: string,
  font: string,
  mobile: boolean,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fillStyle = colors.surface;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.stroke();
  ctx.fillStyle = colors.muted;
  ctx.font = `700 12px ${font}`;
  ctx.textAlign = "left";
  ctx.fillText("PostgreSQL", x + 16, y + (mobile ? 21 : height / 2));
  ctx.font = `400 11px ${font}`;
  ctx.fillStyle = colors.muted;
  if (mobile) {
    fitText(ctx, detail, width - 32, 11, 400, font);
    ctx.fillText(detail, x + 16, y + 44);
  } else {
    ctx.textAlign = "right";
    ctx.fillText(detail, x + width - 16, y + height / 2);
  }
}

export function AgenticMeshDiagram({ locale }: { locale: Locale }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const font = getComputedStyle(canvas).fontFamily;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let active = true;
    let frame = 0;
    let lastPaint = 0;

    const paint = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(rect.width * scale);
      const pixelHeight = Math.round(rect.height * scale);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawDiagram(ctx, rect.width, rect.height, locale, time, font);
    };

    const tick = (time: number) => {
      if (time - lastPaint >= 33) {
        paint(time);
        lastPaint = time;
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      paint(performance.now());
      if (visible && !motion.matches) frame = requestAnimationFrame(tick);
    };

    const resize = new ResizeObserver(sync);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    intersection.observe(canvas);
    motion.addEventListener("change", sync);
    document.fonts.ready.then(sync);
    sync();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", sync);
    };
  }, [locale]);

  return (
    <figure className="agentic-mesh-diagram">
      <canvas ref={canvasRef} role="img" aria-label={copy[locale].accessible}>
        {copy[locale].accessible}
      </canvas>
    </figure>
  );
}
