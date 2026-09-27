import type { Diagram, DiagramNode, Edge, Label, Layout, Point, Tone, Zone } from "@/lib/diagrams/types";

export const DIAGRAM_BACKGROUND = "#0b1018";

const colors: Record<Tone | "text" | "surface" | "border", string> = {
  text: "#edf2f7",
  surface: "#111923",
  border: "#2b3442",
  accent: "#5eead4",
  amber: "#f3bf70",
  blue: "#60a5fa",
  violet: "#a78bfa",
  muted: "#9ba7b8",
  danger: "#f87171",
};

function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, weight: number, font: string) {
  let current = size;
  do {
    ctx.font = `${weight} ${current}px ${font}`;
    if (ctx.measureText(value).width <= maxWidth) break;
    current -= 0.5;
  } while (current > 8);
}

function drawZone(ctx: CanvasRenderingContext2D, zone: Zone, font: string) {
  const color = colors[zone.tone];
  ctx.beginPath();
  ctx.roundRect(zone.x, zone.y, zone.w, zone.h, zone.filled ? 5 : 8);
  ctx.fillStyle = withAlpha(color, zone.filled ? 0.14 : 0.035);
  ctx.fill();
  ctx.setLineDash(zone.dashed ? [5, 4] : []);
  ctx.strokeStyle = withAlpha(color, zone.dashed ? 0.4 : 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  if (zone.label) {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fitText(ctx, zone.label, zone.w - 24, 10, 700, font);
    ctx.fillStyle = color;
    ctx.fillText(zone.label, zone.x + 12, zone.y + 12);
  }
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, cx: number, top: number, font: string) {
  ctx.font = `600 10px ${font}`;
  const width = ctx.measureText(text).width + 16;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top, width, 18, 9);
  ctx.fillStyle = withAlpha(colors.danger, 0.1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(colors.danger, 0.45);
  ctx.stroke();
  ctx.fillStyle = colors.danger;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, top + 9.5);
}

function drawNode(ctx: CanvasRenderingContext2D, item: DiagramNode, font: string) {
  const accent = colors[item.tone];
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (item.shape === "dot") {
    const radius = Math.min(item.w, item.h) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.16);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    fitText(ctx, item.title, radius * 1.6, 11, 700, font);
    ctx.fillStyle = colors.text;
    ctx.fillText(item.title, cx, cy + 0.5);
    return;
  }

  const pill = item.shape === "pill";
  ctx.beginPath();
  ctx.roundRect(item.x, item.y, item.w, item.h, pill ? Math.min(item.h / 2, 12) : 6);
  ctx.fillStyle = pill ? withAlpha(accent, 0.1) : colors.surface;
  ctx.fill();
  ctx.strokeStyle = pill ? withAlpha(accent, 0.55) : colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (!pill) {
    ctx.fillStyle = accent;
    ctx.fillRect(item.x + 1, item.y + 9, 2, item.h - 18);
  }

  const detail = item.detail ?? [];
  const lineGap = 15;
  const top = cy - (detail.length * lineGap) / 2;
  fitText(ctx, item.title, item.w - 18, pill ? 12 : 13, 700, font);
  ctx.fillStyle = pill ? accent : colors.text;
  ctx.fillText(item.title, cx, detail.length ? top - 1 : cy);
  detail.forEach((line, index) => {
    fitText(ctx, line, item.w - 16, 11, 400, font);
    ctx.fillStyle = colors.muted;
    ctx.fillText(line, cx, top + 17 + index * lineGap);
  });

  if (item.pill) drawPill(ctx, item.pill, cx, item.y + item.h + 6, font);
}

function segments(points: Point[]): [Point, Point][] {
  return points.slice(1).map((point, i) => [points[i] ?? point, point]);
}

function pathLength(points: Point[]): number {
  return segments(points).reduce((total, [[x1, y1], [x2, y2]]) => total + Math.hypot(x2 - x1, y2 - y1), 0);
}

function pointAt(points: Point[], distance: number): Point {
  let remaining = distance;
  for (const [[x1, y1], [x2, y2]] of segments(points)) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    remaining -= length;
  }
  return points[points.length - 1] ?? [0, 0];
}

function arrowhead(ctx: CanvasRenderingContext2D, [px, py]: Point, [ex, ey]: Point) {
  const angle = Math.atan2(ey - py, ex - px);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - 5.5 * Math.cos(angle - 0.5), ey - 5.5 * Math.sin(angle - 0.5));
  ctx.lineTo(ex - 5.5 * Math.cos(angle + 0.5), ey - 5.5 * Math.sin(angle + 0.5));
  ctx.closePath();
  ctx.fill();
}

function drawEdge(ctx: CanvasRenderingContext2D, edge: Edge, progress: number | null) {
  const all = segments(edge.points);
  const first = all[0];
  const last = all.at(-1);
  if (!first || !last) return;
  const color = colors[edge.tone];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = edge.width ?? 1.5;
  ctx.globalAlpha = 0.75;
  ctx.setLineDash(edge.dashed ? [5, 4] : []);
  ctx.beginPath();
  edge.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);

  const arrow = edge.arrow ?? "end";
  if (arrow !== "none") arrowhead(ctx, last[0], last[1]);
  if (arrow === "both") arrowhead(ctx, first[1], first[0]);

  ctx.globalAlpha = 1;
  if (progress !== null && (edge.flow ?? !edge.dashed)) {
    const [dx, dy] = pointAt(edge.points, pathLength(edge.points) * progress);
    ctx.beginPath();
    ctx.arc(dx, dy, 2.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, label: Label, font: string) {
  ctx.save();
  ctx.font = `${label.weight ?? 400} ${label.size ?? 11}px ${font}`;
  ctx.textAlign = label.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.translate(label.x, label.y);
  if (label.vertical) ctx.rotate(-Math.PI / 2);
  if (label.bg) {
    const width = ctx.measureText(label.text).width;
    const size = label.size ?? 11;
    const left = label.align === "center" ? -width / 2 : label.align === "right" ? -width : 0;
    ctx.fillStyle = DIAGRAM_BACKGROUND;
    ctx.fillRect(left - 4, -size / 2 - 3, width + 8, size + 6);
  }
  ctx.fillStyle = !label.tone || label.tone === "text" ? colors.text : colors[label.tone];
  ctx.fillText(label.text, 0, 0);
  ctx.restore();
}

/** Paints one layout; `time` drives the flow dots, `null` draws a still frame. */
export function drawDiagram(ctx: CanvasRenderingContext2D, diagram: Diagram, layout: Layout, time: number | null, font: string) {
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = DIAGRAM_BACKGROUND;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 12px ${font}`;
  ctx.fillStyle = colors.text;
  ctx.fillText(diagram.title, 16, 26);
  const titleWidth = ctx.measureText(diagram.title).width;
  ctx.textAlign = "right";
  fitText(ctx, diagram.heading, layout.width - titleWidth - 48, 10, 500, font);
  ctx.fillStyle = colors.muted;
  ctx.fillText(diagram.heading, layout.width - 16, 26);

  layout.zones.forEach((zone) => drawZone(ctx, zone, font));
  const phase = time === null ? null : (time / 1800) % 1;
  layout.edges.forEach((edge, index) => drawEdge(ctx, edge, phase === null ? null : (phase + index * 0.17) % 1));
  layout.nodes.forEach((item) => drawNode(ctx, item, font));
  layout.labels.forEach((label) => drawLabel(ctx, label, font));
}
