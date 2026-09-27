import type { Layout } from "@/lib/diagrams/types";

/**
 * Geometry mistakes a hand-written diagram spec can make: boxes on top of
 * each other, content outside the canvas, broken coordinates. Returns one
 * message per problem; tests/diagrams.test.ts runs it on every layout.
 */
export function layoutProblems(layout: Layout): string[] {
  const problems: string[] = [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= layout.width && y <= layout.height;

  layout.nodes.forEach((node, i) => {
    const values = [node.x, node.y, node.w, node.h];
    if (values.some((v) => !Number.isFinite(v))) problems.push(`node "${node.title}" has invalid geometry`);
    if (node.w <= 0 || node.h <= 0) problems.push(`node "${node.title}" has no size`);
    if (!inside(node.x, node.y) || !inside(node.x + node.w, node.y + node.h + (node.pill ? 24 : 0))) {
      problems.push(`node "${node.title}" leaves the canvas`);
    }
    layout.nodes.slice(i + 1).forEach((other) => {
      const overlap =
        node.x < other.x + other.w && other.x < node.x + node.w && node.y < other.y + other.h && other.y < node.y + node.h;
      if (overlap) problems.push(`nodes "${node.title}" and "${other.title}" overlap`);
    });
  });

  layout.edges.forEach((edge, i) => {
    if (edge.points.length < 2) problems.push(`edge ${i} has fewer than two points`);
    for (const [x, y] of edge.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) problems.push(`edge ${i} has invalid points`);
      else if (!inside(x, y)) problems.push(`edge ${i} leaves the canvas at ${Math.round(x)},${Math.round(y)}`);
    }
  });

  for (const zone of layout.zones) {
    if (!inside(zone.x, zone.y) || !inside(zone.x + zone.w, zone.y + zone.h)) {
      problems.push(`zone "${zone.label ?? ""}" leaves the canvas`);
    }
  }

  for (const label of layout.labels) {
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) problems.push(`label "${label.text}" has invalid position`);
    else if (!inside(label.x, label.y)) problems.push(`label "${label.text}" is outside the canvas`);
  }

  return problems;
}
