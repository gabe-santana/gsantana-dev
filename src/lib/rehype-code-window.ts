import { visit } from "unist-util-visit";
import type { Element, ElementContent, Root } from "hast";

interface LanguageInfo {
  name: string;
  icon: string;
  color: string;
}

const LANGUAGES: Record<string, LanguageInfo> = {
  python: { name: "Python", icon: "py", color: "#4b8bbe" },
  csharp: { name: "C#", icon: "C#", color: "#a179dc" },
  hcl: { name: "Terraform", icon: "tf", color: "#9d7ae0" },
  bash: { name: "Shell", icon: "$_", color: "#89e051" },
  sh: { name: "Shell", icon: "$_", color: "#89e051" },
  shell: { name: "Shell", icon: "$_", color: "#89e051" },
  json: { name: "JSON", icon: "{}", color: "#e8c547" },
  ts: { name: "TypeScript", icon: "TS", color: "#3b8fdb" },
  typescript: { name: "TypeScript", icon: "TS", color: "#3b8fdb" },
  sql: { name: "SQL", icon: "db", color: "#e38c00" },
  yaml: { name: "YAML", icon: "yml", color: "#e0564c" },
  rego: { name: "Rego", icon: "rg", color: "#8fb3c0" },
  markdown: { name: "Markdown", icon: "md", color: "#519aba" },
  java: { name: "Java", icon: "J", color: "#e0843a" },
  ini: { name: "INI", icon: "ini", color: "#a9b4c2" },
  http: { name: "HTTP", icon: "http", color: "#e3664f" },
  dockerfile: { name: "Dockerfile", icon: "dk", color: "#2496ed" },
  text: { name: "Plain Text", icon: "txt", color: "#8b93a7" },
  plaintext: { name: "Plain Text", icon: "txt", color: "#8b93a7" },
};

const COPY_ICON: Element = {
  type: "element",
  tagName: "svg",
  properties: {
    className: ["code-copy-idle"],
    viewBox: "0 0 16 16",
    width: 14,
    height: 14,
    ariaHidden: "true",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
  },
  children: [
    { type: "element", tagName: "rect", properties: { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1.5" }, children: [] },
    { type: "element", tagName: "path", properties: { d: "M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" }, children: [] },
  ],
};

const CHECK_ICON: Element = {
  type: "element",
  tagName: "svg",
  properties: {
    className: ["code-copy-done"],
    viewBox: "0 0 16 16",
    width: 14,
    height: 14,
    ariaHidden: "true",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  children: [{ type: "element", tagName: "path", properties: { d: "M3 8.5l3.2 3L13 4.5" }, children: [] }],
};

function el(tagName: string, className: string, children: ElementContent[], properties = {}): Element {
  return { type: "element", tagName, properties: { className: [className], ...properties }, children };
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function languageInfo(language: string): LanguageInfo {
  return (
    LANGUAGES[language] ?? {
      name: language.toUpperCase(),
      icon: language.slice(0, 3),
      color: "#8b93a7",
    }
  );
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

// rehype-pretty-code writes its data-* attributes as raw keys, not hast's
// camelCase property names, so accept both spellings.
function hasData(node: Element, name: string): boolean {
  const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `data-${name}` in node.properties || `data${camel[0]!.toUpperCase()}${camel.slice(1)}` in node.properties;
}

function isCodeFigure(node: Element): boolean {
  return node.tagName === "figure" && hasData(node, "rehype-pretty-code-figure");
}

/**
 * Wraps every rehype-pretty-code block in an editor window: a tab bar with
 * the file name (or the language) and a copy button, and a gutter width
 * sized to the line count. The copy button ships `hidden` because it needs
 * JS; components/code-blocks.tsx reveals it and labels it per locale.
 */
export function rehypeCodeWindow() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (!isCodeFigure(node)) return;
      const pre = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "pre"
      );
      if (!pre) return;

      const caption = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "figcaption"
      );
      const language = String(pre.properties["data-language"] ?? pre.properties.dataLanguage ?? "plaintext");
      const info = languageInfo(language);
      const title = caption ? caption.children.map(textOf).join("").trim() : "";
      const isTerminal = title.toLowerCase() === "terminal";

      const code = pre.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code"
      );
      const lines = code?.children.filter(
        (child) => child.type === "element" && hasData(child, "line")
      ).length ?? 0;

      const bar = el(
        "figcaption",
        "code-window-bar",
        [
          el("span", "code-window-tab", [
            el("span", "code-window-icon", [text(isTerminal ? ">_" : info.icon)], {
              ariaHidden: "true",
              style: `color:${isTerminal ? "#89e051" : info.color}`,
            }),
            el("span", "code-window-name", [text(title || info.name)]),
          ]),
          el("span", "code-window-actions", [
            ...(title ? [el("span", "code-window-lang", [text(info.name)])] : []),
            el("button", "code-copy", [COPY_ICON, CHECK_ICON, el("span", "code-copy-label", [])], {
              type: "button",
              hidden: true,
            }),
          ]),
        ],
        { dataPagefindIgnore: "" }
      );

      node.properties.className = ["code-window"];
      node.properties.style = `--code-digits:${Math.max(2, String(lines).length)}`;
      node.children = [bar, pre];
    });
  };
}
