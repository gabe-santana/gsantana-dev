import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getPostSlugs } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

const publicRoot = path.join(process.cwd(), "public");

describe("article covers", () => {
  it.each(locales)("covers every post and principle in %s", (locale) => {
    for (const slug of getPostSlugs(locale)) {
      const cover = path.join(publicRoot, "posts", slug, "cover.webp");
      expect(fs.existsSync(cover), cover).toBe(true);
    }

    for (const { category, slug } of getAllPrinciples(locale)) {
      const cover = path.join(publicRoot, "principles", category, slug, "cover.webp");
      expect(fs.existsSync(cover), cover).toBe(true);
    }
  });

  it("covers every news story", () => {
    for (const story of newsStories) {
      const imagePath = new URL(story.image, "https://gsantana.dev").pathname;
      expect(imagePath).toBe(`/news/${story.slug}/cover.webp`);
      expect(fs.existsSync(path.join(publicRoot, imagePath.slice(1)))).toBe(true);
    }
  });
});
