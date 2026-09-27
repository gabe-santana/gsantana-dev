// Shared by the blog page (a Server Component) and the client-side canvas:
// values exported from a "use client" module reach the server only as
// client references, so the list of diagrams and their markers live here.
export const SIGHTLINE_DIAGRAMS = ["system", "ingestion", "query"] as const;
export type SightlineDiagramKind = (typeof SIGHTLINE_DIAGRAMS)[number];

export function sightlineDiagramMarker(kind: SightlineDiagramKind): string {
  return `<div id="sightline-${kind}-slot"></div>`;
}
