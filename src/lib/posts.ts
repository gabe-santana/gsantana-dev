import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { renderMarkdown } from "@/lib/markdown";
import type { TocHeading } from "@/lib/rehype-extract-headings";

export const POSTS_DIRECTORY = path.join(process.cwd(), "posts");

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
  readingTime: string;
}

export interface Post extends PostSummary {
  contentHtml: string;
  headings: TocHeading[];
}

function isPublished(frontmatter: PostFrontmatter): boolean {
  return process.env.NODE_ENV === "development" || !frontmatter.draft;
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIRECTORY)) return [];
  return fs
    .readdirSync(POSTS_DIRECTORY)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

function readPostFile(slug: string): { frontmatter: PostFrontmatter; content: string } {
  const fullPath = path.join(POSTS_DIRECTORY, `${slug}.md`);
  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);
  return { frontmatter: data as PostFrontmatter, content };
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const { frontmatter, content } = readPostFile(slug);
  const { html, headings } = await renderMarkdown(content);

  return {
    ...frontmatter,
    slug,
    readingTime: readingTime(content).text,
    contentHtml: html,
    headings,
  };
}

export function getAllPostSummaries(): PostSummary[] {
  const summaries = getPostSlugs()
    .map((slug) => {
      const { frontmatter, content } = readPostFile(slug);
      return {
        ...frontmatter,
        slug,
        readingTime: readingTime(content).text,
      };
    })
    .filter(isPublished)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return summaries;
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPostSummaries()) {
    for (const tag of post.tags ?? []) tags.add(tag);
  }
  return Array.from(tags).sort();
}
