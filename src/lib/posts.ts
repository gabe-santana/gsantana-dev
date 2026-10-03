import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { Locale } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import type { TocHeading } from "@/lib/rehype-extract-headings";

// All markdown lives under content/<type>/<locale> (posts, principles,
// certifications, news). An article keeps the same file name in every
// locale, so switching language maps to the same slug.
export const CONTENT_ROOT = path.join(process.cwd(), "content");

export function postsDirectory(locale: Locale): string {
  return path.join(CONTENT_ROOT, "posts", locale);
}

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
  tags: string[];
  cover?: string;
  /** Embed URL of a video shown in place of the cover at the top of the post (the cover still feeds cards and OG). */
  video?: string;
  /**
   * Narrated version of this locale's post: a root-relative MP3 path on the
   * media CDN, resolved via mediaUrl(). Posts without it show no player.
   */
  audio?: string;
  /** Length of the audio in seconds, shown before any audio loads. Required with `audio`. */
  audioSeconds?: number;
  draft?: boolean;
  /** 2 to 4 short takeaways shown in the TL;DR box. Required (tests enforce it). */
  tldr: string[];
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

/** Top-level .md files only, so a subfolder never turns into a post. */
export function getPostSlugs(locale: Locale): string[] {
  const dir = postsDirectory(locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

// YAML turns an unquoted `date: 2025-11-02` into a Date object; keep it as
// "YYYY-MM-DD" so sorting, <time dateTime> and feeds all get the same string.
function normalizeDate(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function readPostFile(locale: Locale, slug: string) {
  const raw = fs.readFileSync(path.join(postsDirectory(locale), `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const frontmatter = { ...data, date: normalizeDate(data.date) } as PostFrontmatter;
  return { frontmatter, content };
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
