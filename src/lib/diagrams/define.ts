import type { Locale } from "@/lib/i18n";
import { gridLayout, type GridEdge, type GridNode, type GridSpec } from "@/lib/diagrams/grid";
import type { Diagram, Tone } from "@/lib/diagrams/types";

/** Picks the label for the page's language. */
export type T = (en: string, pt: string) => string;

export interface DiagramSpec {
  title: string;
  heading: string;
  accessible: string;
  desktop: Omit<GridSpec, "width">;
  /** Phones: 360 virtual pixels wide, tighter rows. */
  mobile: Omit<GridSpec, "width">;
}

const MOBILE_DEFAULTS = { width: 360, padX: 12, gapX: 18, rowH: 84, nodeH: 50 } as const;

export function defineDiagram(build: (t: T) => DiagramSpec): (locale: Locale) => Diagram {
  return (locale) => {
    const t: T = (en, pt) => (locale === "pt-br" ? pt : en);
    const spec = build(t);
    return {
      title: spec.title,
      heading: spec.heading,
      accessible: spec.accessible,
      desktop: gridLayout({ width: 760, ...spec.desktop }),
      mobile: gridLayout({ ...MOBILE_DEFAULTS, ...spec.mobile }),
    };
  };
}

/** Shorthand for a node: n("api", 1, 0, "accent", "Orders API", ["detail"]). */
export function n(
  id: string,
  col: number,
  row: number,
  tone: Tone,
  title: string,
  detail?: string | string[],
  more: Partial<GridNode> = {}
): GridNode {
  return { id, col, row, tone, title, detail, ...more };
}

/** Shorthand for an edge: e("api", "db", { label: "writes" }). */
export function e(from: string, to: string, more: Partial<GridEdge> = {}): GridEdge {
  return { from, to, ...more };
}
