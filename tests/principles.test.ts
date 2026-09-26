import { describe, expect, it } from "vitest";
import { getPostSlugs } from "@/lib/posts";
import {
  findPrinciple,
  getAllPrinciples,
  PRINCIPLE_CATEGORIES,
} from "@/lib/principles";

describe("principles", () => {
  const principles = getAllPrinciples();

  it("loads principles from every category folder", () => {
    const categories = new Set(principles.map((p) => p.category));
    for (const category of PRINCIPLE_CATEGORIES) {
      expect(categories).toContain(category.id);
    }
  });

  it("builds namespaced hrefs and progress keys", () => {
    const principle = findPrinciple("cloud", "cost-optimization");
    expect(principle).toBeDefined();
    expect(principle?.href).toBe("/principles/cloud/cost-optimization");
    expect(principle?.progressKey).toBe("principles/cloud/cost-optimization");
  });

  it("flags placeholder principles as work in progress", () => {
    expect(findPrinciple("cloud", "cost-optimization")?.isWip).toBe(false);
    expect(findPrinciple("cloud", "security")?.isWip).toBe(true);
  });

  it("lists written principles before placeholders within a category", () => {
    for (const category of PRINCIPLE_CATEGORIES) {
      const flags = principles
        .filter((p) => p.category === category.id)
        .map((p) => p.isWip);
      expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    }
  });

  it("keeps principles out of the regular blog post list", () => {
    expect(getPostSlugs()).not.toContain("principles");
  });
});
