import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n";
import {
  findPrinciple,
  getAllPrinciples,
  getPrinciple,
  isPlaceholder,
  PRINCIPLE_CATEGORIES,
} from "@/lib/principles";

describe.each(locales)("principles (%s)", (locale) => {
  const principles = getAllPrinciples(locale);

  it("loads principles from every category folder", () => {
    const categories = new Set(principles.map((p) => p.category));
    for (const category of PRINCIPLE_CATEGORIES) expect(categories).toContain(category);
  });

  it("builds locale-free paths and shared article keys", () => {
    const principle = findPrinciple(locale, "cloud", "cost-optimization");
    expect(principle?.path).toBe("/principles/cloud/cost-optimization");
    expect(principle?.key).toBe("principles/cloud/cost-optimization");
  });

  it("flags placeholder principles as work in progress", () => {
    expect(findPrinciple(locale, "cloud", "cost-optimization")?.isWip).toBe(false);
    expect(isPlaceholder("## 🚧 Under Construction 🚧\n\nTemporarily unavailable.")).toBe(true);
    expect(isPlaceholder("## 🚧 Em Construção 🚧\n\nTemporariamente indisponível.")).toBe(true);
    expect(isPlaceholder("## Introduction\n\nA finished principle.")).toBe(false);
  });

  it("has no em dashes and no broken diagrams in any principle", async () => {
    for (const summary of principles) {
      const { contentHtml } = await getPrinciple(locale, summary);
      expect(contentHtml, `${summary.key} has an em dash`).not.toContain("—");
      const figures = contentHtml.match(/<figure class="diagram"[\s\S]*?<\/figure>/g) ?? [];
      for (const figure of figures) {
        // A blank line inside the raw HTML ends the block, and markdown then
        // wraps the rest of the SVG in <p> tags.
        expect(figure, `${summary.key} has a diagram split by markdown`).not.toContain("<p>");
        expect(figure, `${summary.key} has a diagram without an SVG`).toContain("</svg>");
      }
    }
  }, 60_000);

  it("lists written principles before placeholders within a category", () => {
    for (const category of PRINCIPLE_CATEGORIES) {
      const flags = principles.filter((p) => p.category === category).map((p) => p.isWip);
      expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    }
  });
});
