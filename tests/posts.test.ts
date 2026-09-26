import { describe, expect, it } from "vitest";
import { getAllPostSummaries, getPostSlugs } from "@/lib/posts";

describe("posts", () => {
  it("finds the markdown posts on disk", () => {
    const slugs = getPostSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(slug).not.toMatch(/\.md$/);
    }
  });

  it("sorts posts by date, newest first", () => {
    const posts = getAllPostSummaries();
    const dates = posts.map((post) => post.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it("includes reading time and required frontmatter fields", () => {
    const [post] = getAllPostSummaries();
    expect(post).toBeDefined();
    expect(post.title).toBeTruthy();
    expect(post.description).toBeTruthy();
    expect(post.readingTime).toMatch(/min/);
  });
});
