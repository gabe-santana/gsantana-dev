import { visit } from "unist-util-visit";
import type { Root } from "hast";

// Code fence metadata (```python title="app.py") lives in `node.data.meta`,
// which rehype-raw drops when it re-parses the tree. These two plugins stash
// it in an attribute before rehype-raw and put it back after, so
// rehype-pretty-code can still read it (file-name tabs, line highlights).

const ATTR = "dataCodeMeta";

export function rehypeStashCodeMeta() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const meta = (node.data as { meta?: string } | undefined)?.meta;
      if (node.tagName === "code" && meta) node.properties[ATTR] = meta;
    });
  };
}

export function rehypeRestoreCodeMeta() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const meta = node.properties[ATTR];
      if (node.tagName !== "code" || typeof meta !== "string") return;
      node.data = { ...node.data, meta } as typeof node.data;
      delete node.properties[ATTR];
    });
  };
}
