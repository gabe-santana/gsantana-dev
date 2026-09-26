import { visit } from "unist-util-visit";
import type { ElementContent, Root } from "hast";

export interface TocHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/**
 * Collects h2/h3 headings into the caller-provided array. Must run after
 * rehype-slug so every heading already has its id.
 */
export function rehypeExtractHeadings({ headings }: { headings: TocHeading[] }) {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;

      const id = node.properties.id;
      if (typeof id !== "string") return;

      headings.push({
        id,
        text: node.children.map(textOf).join("").trim(),
        depth: node.tagName === "h2" ? 2 : 3,
      });
    });
  };
}
