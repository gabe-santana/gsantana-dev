import fs from "node:fs";
import matter from "gray-matter";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n";
import { newsDirectory, newsStories } from "@/lib/news";

const SHARED_FIELDS = ["date", "order", "category", "publisher", "sourceUrl", "image"] as const;

function frontmatter(locale: (typeof locales)[number], slug: string) {
  return matter(fs.readFileSync(path.join(newsDirectory(locale), `${slug}.md`), "utf8")).data;
}

describe("news stories", () => {
  it("has one markdown file per story in every locale", () => {
    const [first, ...rest] = locales.map((locale) =>
      fs.readdirSync(newsDirectory(locale)).filter((file) => file.endsWith(".md")).sort()
    );
    for (const files of rest) expect(files).toEqual(first);
    expect(newsStories).toHaveLength(first!.length);
  });

  it("keeps the shared fields and source links identical across locales", () => {
    for (const { slug } of newsStories) {
      const [base, ...others] = locales.map((locale) => frontmatter(locale, slug));
      for (const other of others) {
        for (const field of SHARED_FIELDS) expect(other[field], `${slug} ${field}`).toEqual(base![field]);
        expect(other.sources.map((s: { url: string }) => s.url), `${slug} sources`).toEqual(
          base!.sources.map((s: { url: string }) => s.url)
        );
      }
    }
  });

  it("gives every story localized copy and an analysis body", () => {
    for (const story of newsStories) {
      for (const locale of locales) {
        const copy = story.copy[locale];
        expect(copy.title, `${story.slug} ${locale} title`).toBeTruthy();
        expect(copy.summary, `${story.slug} ${locale} summary`).toBeTruthy();
        expect(copy.body.length, `${story.slug} ${locale} lead`).toBeGreaterThan(0);
        expect(copy.analysis, `${story.slug} ${locale} analysis`).toMatch(/^## /);
        for (const source of story.sources) expect(source.label[locale]).toBeTruthy();
      }
    }
  });

  it("lists stories newest first", () => {
    const dates = newsStories.map((story) => story.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
