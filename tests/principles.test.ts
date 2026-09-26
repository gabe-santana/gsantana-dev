import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n";
import {
  findPrinciple,
  getAllPrinciples,
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
    expect(findPrinciple(locale, "cloud", "security")?.isWip).toBe(true);
  });

  it("lists written principles before placeholders within a category", () => {
    for (const category of PRINCIPLE_CATEGORIES) {
      const flags = principles.filter((p) => p.category === category).map((p) => p.isWip);
      expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    }
  });
});
