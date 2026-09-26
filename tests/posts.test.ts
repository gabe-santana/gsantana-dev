import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n";
import { getAllPostSummaries, getPostSlugs } from "@/lib/posts";

describe.each(locales)("posts (%s)", (locale) => {
  it("finds the markdown posts on disk", () => {
    const slugs = getPostSlugs(locale);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(slug).not.toMatch(/\.md$/);
  });

  it("never treats the principles folder as a post", () => {
    expect(getPostSlugs(locale)).not.toContain("principles");
  });

  it("gives every post a TL;DR of 2 to 4 non-empty takeaways", () => {
    for (const post of getAllPostSummaries(locale)) {
      expect(Array.isArray(post.tldr), `${post.slug} has a tldr list`).toBe(true);
      expect(post.tldr.length, `${post.slug} tldr size`).toBeGreaterThanOrEqual(2);
      expect(post.tldr.length, `${post.slug} tldr size`).toBeLessThanOrEqual(4);
      for (const item of post.tldr) {
        expect(typeof item === "string" && item.trim().length > 0, `${post.slug} tldr item`).toBe(true);
        expect(item, `${post.slug} tldr has no em dash`).not.toContain("—");
      }
    }
  });

  it("exposes dates as YYYY-MM-DD strings, even when unquoted in YAML", () => {
    for (const post of getAllPostSummaries(locale)) {
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("sorts posts by date, newest first", () => {
    const dates = getAllPostSummaries(locale).map((post) => post.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("includes reading time and required frontmatter fields", () => {
    const post = getAllPostSummaries(locale)[0];
    if (!post) throw new Error("no posts found");
    expect(post.title).toBeTruthy();
    expect(post.description).toBeTruthy();
    expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});
