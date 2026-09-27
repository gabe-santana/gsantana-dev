import type { DiagramNode, Edge, Label, Layout, Point, Tone, Zone } from "@/lib/diagrams/types";

/**
 * A small grid layout engine, so a diagram is described by where things
 * sit and how they connect, not by pixel coordinates. Columns and rows may
 * be fractional (col: 0.5 centers a node between the first two columns).
 */

export interface GridNode {
  id: string;
  col: number;
  row: number;
  /** Columns the box spans. Default 1. */
  span?: number;
  title: string;
  detail?: string | string[];
  tone?: Tone;
  shape?: DiagramNode["shape"];
  pill?: string;
  /** Fixed size, centered in its cell range. */
  w?: number;
  h?: number;
}

export type Route = "auto" | "hv" | "vh" | "hvh" | "straight" | "u-right" | "u-left" | "u-bottom" | "u-top";

export interface GridEdge {
  from: string;
  to: string;
  /**
   * auto: straight when aligned, otherwise out the bottom (or top), across
   * the gap, and in the top (or bottom). hv / vh: one elbow. hvh: out a
   * side, a vertical run between the columns, in the facing side. u-*: leaves and
   * re-enters on the same side, running parallel outside both boxes.
   */
  route?: Route;
  tone?: Tone;
  dashed?: boolean;
  arrow?: Edge["arrow"];
  flow?: boolean;
  width?: number;
  /** Moves the start / end point along the side it sits on. */
  fromShift?: number;
  toShift?: number;
  /** Distance of a u-* route from the boxes. Default 22. */
  offset?: number;
  /** Where the middle run of an auto or hvh route sits in the gap, 0..1. Default 0.5. */
  bend?: number;
  label?: string;
  labelTone?: Label["tone"];
  /** Segment carrying the label; defaults to the one that reads best for the route. */
  labelAt?: "start" | "mid" | "end";
  labelSide?: "left" | "right" | "above" | "below";
  labelDx?: number;
  labelDy?: number;
}

export interface GridZone {
  col: number;
  row: number;
  span?: number;
  rowSpan?: number;
  label?: string;
  tone: Tone;
  dashed?: boolean;
  filled?: boolean;
  /** Extra padding inside the cell range, for nested zones. */
  inset?: number;
  insetX?: number;
}

export interface GridNote extends Omit<Label, "x" | "y"> {
  col: number;
  row: number;
  dx?: number;
  dy?: number;
}

export interface GridSpec {
  width: number;
  /** Column count, or relative column widths. */
  cols: number | number[];
  rows: number;
  rowH?: number;
  nodeH?: number;
  gapX?: number;
  padX?: number;
  padTop?: number;
  padBottom?: number;
  nodes: GridNode[];
  edges?: GridEdge[];
  zones?: GridZone[];
  notes?: GridNote[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const cx = (r: Rect) => r.x + r.w / 2;
const cy = (r: Rect) => r.y + r.h / 2;

type Side = "top" | "bottom" | "left" | "right";

function side(r: Rect, which: Side, shift = 0): Point {
  switch (which) {
    case "top":
      return [cx(r) + shift, r.y];
    case "bottom":
      return [cx(r) + shift, r.y + r.h];
    case "left":
      return [r.x, cy(r) + shift];
    case "right":
      return [r.x + r.w, cy(r) + shift];
  }
}

function clipToRect(r: Rect, [tx, ty]: Point): Point {
  const dx = tx - cx(r);
  const dy = ty - cy(r);
  if (dx === 0 && dy === 0) return [cx(r), cy(r)];
  const t = Math.min(dx === 0 ? Infinity : r.w / 2 / Math.abs(dx), dy === 0 ? Infinity : r.h / 2 / Math.abs(dy));
  return [cx(r) + dx * t, cy(r) + dy * t];
}

function route(a: Rect, b: Rect, edge: GridEdge): Point[] {
  const dx = cx(b) - cx(a);
  const dy = cy(b) - cy(a);
  const fs = edge.fromShift ?? 0;
  const ts = edge.toShift ?? 0;
  const offset = edge.offset ?? 22;
  switch (edge.route ?? "auto") {
    case "straight": {
      const start = clipToRect(a, [cx(b), cy(b)]);
      return [start, clipToRect(b, [cx(a), cy(a)])];
    }
    case "hv": {
      const start = side(a, dx > 0 ? "right" : "left", fs);
      const end = side(b, dy > 0 ? "top" : "bottom", ts);
      return [start, [end[0], start[1]], end];
    }
    case "vh": {
      const start = side(a, dy > 0 ? "bottom" : "top", fs);
      const end = side(b, dx > 0 ? "left" : "right", ts);
      return [start, [start[0], end[1]], end];
    }
    case "hvh": {
      const start = side(a, dx > 0 ? "right" : "left", fs);
      const end = side(b, dx > 0 ? "left" : "right", ts);
      if (Math.abs(start[1] - end[1]) < 1) return [start, end];
      const mid = start[0] + (end[0] - start[0]) * (edge.bend ?? 0.5);
      return [start, [mid, start[1]], [mid, end[1]], end];
    }
    case "u-right":
    case "u-left": {
      const right = edge.route === "u-right";
      const start = side(a, right ? "right" : "left", fs);
      const end = side(b, right ? "right" : "left", ts);
      const x = right ? Math.max(a.x + a.w, b.x + b.w) + offset : Math.min(a.x, b.x) - offset;
      return [start, [x, start[1]], [x, end[1]], end];
    }
    case "u-bottom":
    case "u-top": {
      const bottom = edge.route === "u-bottom";
      const start = side(a, bottom ? "bottom" : "top", fs);
      const end = side(b, bottom ? "bottom" : "top", ts);
      const y = bottom ? Math.max(a.y + a.h, b.y + b.h) + offset : Math.min(a.y, b.y) - offset;
      return [start, [start[0], y], [end[0], y], end];
    }
    case "auto": {
      if (Math.abs(dy) < 1) return [side(a, dx > 0 ? "right" : "left", fs), side(b, dx > 0 ? "left" : "right", ts)];
      const start = side(a, dy > 0 ? "bottom" : "top", fs);
      const end = side(b, dy > 0 ? "top" : "bottom", ts);
      if (Math.abs(start[0] - end[0]) < 1) return [start, [start[0], end[1]]];
      const mid = start[1] + (end[1] - start[1]) * (edge.bend ?? 0.5);
      return [start, [start[0], mid], [end[0], mid], end];
    }
  }
}

function edgeLabel(points: Point[], edge: GridEdge): Label | null {
  if (!edge.label) return null;
  const count = points.length - 1;
  const defaultIndex =
    edge.route === "hv" || edge.route === "vh" ? 0 : count === 3 ? (edge.route?.startsWith("u-") || edge.route === "hvh" ? 1 : 2) : 0;
  const index =
    edge.labelAt === "start" ? 0 : edge.labelAt === "end" ? count - 1 : edge.labelAt === "mid" ? Math.floor(count / 2) : defaultIndex;
  const [x1, y1] = points[index] ?? [0, 0];
  const [x2, y2] = points[index + 1] ?? [x1, y1];
  const mx = (x1 + x2) / 2 + (edge.labelDx ?? 0);
  const my = (y1 + y2) / 2 + (edge.labelDy ?? 0);
  const vertical = Math.abs(x1 - x2) < 1;
  const where = edge.labelSide ?? (vertical ? "right" : "above");
  const base = { text: edge.label, tone: edge.labelTone ?? "muted", size: 10, bg: true } as const;
  switch (where) {
    case "right":
      return { ...base, x: mx + 7, y: my, align: "left" };
    case "left":
      return { ...base, x: mx - 7, y: my, align: "right" };
    case "below":
      return { ...base, x: mx, y: my + 10, align: "center" };
    case "above":
      return { ...base, x: mx, y: my - 10, align: "center" };
  }
}

export function gridLayout(spec: GridSpec): Layout {
  const padX = spec.padX ?? 16;
  const padTop = spec.padTop ?? 48;
  const padBottom = spec.padBottom ?? 16;
  const rowH = spec.rowH ?? 96;
  const nodeH = spec.nodeH ?? 54;
  const gapX = spec.gapX ?? 36;
  const weights = typeof spec.cols === "number" ? Array.from({ length: spec.cols }, () => 1) : spec.cols;
  const total = weights.reduce((sum, w) => sum + w, 0);
  const usable = spec.width - padX * 2;
  const widths = weights.map((w) => (w / total) * usable);
  const starts = widths.reduce<number[]>((acc, w) => [...acc, (acc.at(-1) ?? padX) + w], [padX]);

  const colX = (c: number) => {
    const i = Math.min(Math.floor(c), widths.length - 1);
    return (starts[i] ?? padX) + (c - i) * (widths[i] ?? 0);
  };
  const rowY = (r: number) => padTop + r * rowH;

  const rects = new Map<string, Rect>();
  const nodes: DiagramNode[] = spec.nodes.map((n) => {
    const detail = n.detail === undefined ? undefined : Array.isArray(n.detail) ? n.detail : [n.detail];
    const left = colX(n.col);
    const right = colX(n.col + (n.span ?? 1));
    const w = n.w ?? right - left - gapX;
    const h = n.h ?? nodeH + Math.max(0, (detail?.length ?? 0) - 1) * 15;
    const rect = { x: (left + right) / 2 - w / 2, y: rowY(n.row) + (rowH - h) / 2, w, h };
    rects.set(n.id, rect);
    return { ...rect, tone: n.tone ?? "muted", title: n.title, detail, shape: n.shape, pill: n.pill };
  });

  const labels: Label[] = [];
  const edges: Edge[] = (spec.edges ?? []).map((e) => {
    const a = rects.get(e.from);
    const b = rects.get(e.to);
    if (!a || !b) throw new Error(`diagram edge ${e.from} -> ${e.to} references an unknown node`);
    const points = route(a, b, e);
    const label = edgeLabel(points, e);
    if (label) labels.push(label);
    return { points, tone: e.tone ?? "muted", dashed: e.dashed, arrow: e.arrow, flow: e.flow, width: e.width };
  });

  const zones: Zone[] = (spec.zones ?? []).map((z) => {
    const inset = z.inset ?? 0;
    const insetX = z.insetX ?? inset;
    const x = colX(z.col) + gapX / 2 - 12 + insetX;
    const right = colX(z.col + (z.span ?? 1)) - gapX / 2 + 12 - insetX;
    // A labeled zone starts a little above its first row, so the label sits
    // in the gap instead of on top of the boxes.
    const y = rowY(z.row) + (z.label ? -6 : 4) + inset;
    // Ends above the next row's label gap, so stacked zones never touch.
    const bottom = rowY(z.row + (z.rowSpan ?? 1)) - 12 - inset;
    return { x, y, w: right - x, h: bottom - y, tone: z.tone, label: z.label, dashed: z.dashed, filled: z.filled };
  });

  for (const note of spec.notes ?? []) {
    const { col, row, dx = 0, dy = 0, ...rest } = note;
    labels.push({ ...rest, x: colX(col + 0.5) + dx, y: rowY(row) + rowH / 2 + dy });
  }

  return {
    width: spec.width,
    height: padTop + spec.rows * rowH + padBottom,
    zones,
    nodes,
    edges,
    labels,
  };
}
