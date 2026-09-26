import { visit } from "unist-util-visit";
import type { Root } from "hast";

/**
 * Adds loading="lazy" and decoding="async" to every <img> in post content
 * (markdown images and raw HTML alike), so the browser only downloads images
 * as the reader scrolls near them and decodes them off the main thread.
 * An explicit loading attribute written in the markdown is respected.
 */
export function rehypeLazyImages() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;
      node.properties.loading ??= "lazy";
      node.properties.decoding ??= "async";
    });
  };
}
