// Plain data describing a canvas diagram. Diagrams are computed on the
// server (lib/diagrams/*) and handed to the client component as props, so
// a page only ships its own diagrams and the renderer never needs the specs.

export type Tone = "accent" | "amber" | "blue" | "violet" | "muted" | "danger";
export type Point = [number, number];

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  label?: string;
  dashed?: boolean;
  filled?: boolean;
}

export interface DiagramNode {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  title: string;
  /** Muted lines under the title. */
  detail?: string[];
  /** Small badge drawn just under the box. */
  pill?: string;
  /** "box" (default), "pill" (a tinted chip, e.g. an error code) or "dot" (a graph vertex). */
  shape?: "box" | "pill" | "dot";
}

export interface Edge {
  points: Point[];
  tone: Tone;
  dashed?: boolean;
  /** Which ends get an arrowhead. Default "end". */
  arrow?: "end" | "both" | "none";
  /** Animate a dot along the edge. Default true for solid edges. */
  flow?: boolean;
  width?: number;
}

export interface Label {
  x: number;
  y: number;
  text: string;
  tone?: Tone | "text";
  size?: number;
  weight?: number;
  align?: CanvasTextAlign;
  vertical?: boolean;
  /** Paint the canvas background behind the text, so it stays legible over lines. */
  bg?: boolean;
}

/** Coordinates are in a virtual space `width` wide; the canvas scales it to fit. */
export interface Layout {
  width: number;
  height: number;
  zones: Zone[];
  nodes: DiagramNode[];
  edges: Edge[];
  labels: Label[];
}

export interface Diagram {
  /** Short name in the top-left corner, e.g. "SIGHTLINE". */
  title: string;
  /** Muted caption in the top-right corner. */
  heading: string;
  /** Screen-reader and no-JavaScript description of the whole diagram. */
  accessible: string;
  desktop: Layout;
  /** Drawn when the canvas is narrower than 560px. */
  mobile: Layout;
}
