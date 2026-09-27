import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { layoutProblems } from "@/lib/diagrams/check";
import { diagramIds, diagramMarkerIds, getDiagram } from "@/lib/diagrams";
import { locales } from "@/lib/i18n";
import { CONTENT_ROOT } from "@/lib/posts";

const markdownFiles = (fs.readdirSync(CONTENT_ROOT, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".md"))
  .map((file) => path.join(CONTENT_ROOT, file));

// A fenced block that draws boxes and arrows with characters: the site
// draws diagrams on canvas instead (lib/diagrams).
function textDiagrams(markdown: string): string[] {
  return [...markdown.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)]
    .filter(([, lang = "", body = ""]) => {
      if (!/^(text|txt)?(\s|$)/.test(lang.trim())) return false;
      return /[─│┌┐└┘├┤┬┴┼═║╔╗╚╝▶▼◀▲►→←↓↑]/.test(body) || /(-{2,}>|<-{2,}|\+-{3,}|==>|\s->\s)/.test(body);
    })
    .map(([block]) => block.slice(0, 80));
}

describe("canvas diagrams", () => {
  it.each(locales)("lays out every %s diagram without overlaps or overflow", (locale) => {
    for (const id of diagramIds) {
      const diagram = getDiagram(id, locale)!;
      expect(layoutProblems(diagram.desktop), `${id} desktop`).toEqual([]);
      expect(layoutProblems(diagram.mobile), `${id} mobile`).toEqual([]);
    }
  });

  it.each(locales)("keeps em dashes out of every %s diagram", (locale) => {
    for (const id of diagramIds) {
      expect(JSON.stringify(getDiagram(id, locale)), id).not.toContain("—");
    }
  });

  it("resolves every diagram marker in the content", () => {
    for (const file of markdownFiles) {
      for (const id of diagramMarkerIds(fs.readFileSync(file, "utf8"))) {
        if (id === "agentic-mesh-canvas") continue;
        expect(diagramIds, `${path.relative(CONTENT_ROOT, file)} uses ${id}`).toContain(id);
      }
    }
  });

  it("has no diagrams drawn as text", () => {
    for (const file of markdownFiles) {
      expect(textDiagrams(fs.readFileSync(file, "utf8")), path.relative(CONTENT_ROOT, file)).toEqual([]);
    }
  });
});
