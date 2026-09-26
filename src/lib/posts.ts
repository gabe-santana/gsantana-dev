import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { Locale } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import type { TocHeading } from "@/lib/rehype-extract-headings";

// Content lives in one folder per locale (posts/en-us, posts/pt-br). A post
// keeps the same file name in every locale, so switching language maps to
// the same slug.
export const POSTS_ROOT = path.join(process.cwd(), "posts");

export function postsDirectory(locale: Locale): string {
  return path.join(POSTS_ROOT, locale);
}

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
  tags: string[];
  cover?: string;
  draft?: boolean;
}

export interface PostSummary extends PostFrontmatter {
  slug: string;
  readingMinutes: number;
}

export interface Post extends PostSummary {
  contentHtml: string;
  headings: TocHeading[];
}

function isPublished(frontmatter: PostFrontmatter): boolean {
  return process.env.NODE_ENV === "development" || !frontmatter.draft;
}

export function minutesToRead(content: string): number {
  return Math.max(1, Math.round(readingTime(content).minutes));
}

/** Top-level .md files only — subfolders (like principles/) are not posts. */
export function getPostSlugs(locale: Locale): string[] {
  const dir = postsDirectory(locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

function readPostFile(locale: Locale, slug: string) {
  const raw = fs.readFileSync(path.join(postsDirectory(locale), `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  return { frontmatter: data as PostFrontmatter, content };
}

export async function getPostBySlug(locale: Locale, slug: string): Promise<Post> {
  const { frontmatter, content } = readPostFile(locale, slug);
  const { html, headings } = await renderMarkdown(content);

  return {
    ...frontmatter,
    slug,
    readingMinutes: minutesToRead(content),
    contentHtml: html,
    headings,
  };
}

export function getAllPostSummaries(locale: Locale): PostSummary[] {
  return getPostSlugs(locale)
    .map((slug) => {
      const { frontmatter, content } = readPostFile(locale, slug);
      return { ...frontmatter, slug, readingMinutes: minutesToRead(content) };
    })
    .filter(isPublished)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
