import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Locale } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { CONTENT_ROOT, minutesToRead } from "@/lib/posts";
import type { TocHeading } from "@/lib/rehype-extract-headings";

export function principlesDirectory(locale: Locale): string {
  return path.join(CONTENT_ROOT, "principles", locale);
}

// The folder a principle lives in is its category; this list sets the order.
// Display names come from the dictionaries (principles.categories). A new
// category folder must be added here and there to show up.
export const PRINCIPLE_CATEGORIES = ["cloud", "enterprise", "solution"] as const;

export type PrincipleCategory = (typeof PRINCIPLE_CATEGORIES)[number];

// Placeholder principles carry one of these headings. They're still built as
// pages (so shared links don't 404) but listed as "coming soon", not linked.
const WIP_MARKERS = ["Em Construção", "Under Construction"];

export function isPlaceholder(content: string): boolean {
  return WIP_MARKERS.some((marker) => content.includes(marker));
}

interface PrincipleFrontmatter {
  title: string;
  short: string;
  /** Optional takeaways shown in the TL;DR box, like posts. */
  tldr?: string[];
}

export interface PrincipleSummary extends PrincipleFrontmatter {
  slug: string;
  category: PrincipleCategory;
  readingMinutes: number;
  isWip: boolean;
  /** Path without the locale prefix, e.g. /principles/cloud/reliability */
  path: string;
  /**
   * Shared by every locale: reading progress and comments follow the
   * article, not the language. Namespaced so it can't collide with a post.
   */
  key: string;
}

export interface Principle extends PrincipleSummary {
  tldr?: string[];
  contentHtml: string;
  headings: TocHeading[];
}

function readPrincipleFile(locale: Locale, category: PrincipleCategory, slug: string) {
  const raw = fs.readFileSync(
    path.join(principlesDirectory(locale), category, `${slug}.md`),
    "utf8"
  );
  const { data, content } = matter(raw);
  return { frontmatter: data as PrincipleFrontmatter, content };
}

function toSummary(
  locale: Locale,
  category: PrincipleCategory,
  slug: string
): PrincipleSummary {
  const { frontmatter, content } = readPrincipleFile(locale, category, slug);
  return {
    title: frontmatter.title,
    short: frontmatter.short,
    slug,
    category,
    readingMinutes: minutesToRead(content),
    isWip: isPlaceholder(content),
    path: `/principles/${category}/${slug}`,
    key: `principles/${category}/${slug}`,
  };
}

export function getAllPrinciples(locale: Locale): PrincipleSummary[] {
  return PRINCIPLE_CATEGORIES.flatMap((category) => {
    const dir = path.join(principlesDirectory(locale), category);
    if (!fs.existsSync(dir)) return [];
    return (
      fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".md"))
        .map((file) => toSummary(locale, category, file.replace(/\.md$/, "")))
        // Readable principles first, then placeholders; alphabetical within each.
        .sort(
          (a, b) =>
            Number(a.isWip) - Number(b.isWip) || a.title.localeCompare(b.title)
        )
    );
  });
}

export function findPrinciple(
  locale: Locale,
  category: string,
  slug: string
): PrincipleSummary | undefined {
  return getAllPrinciples(locale).find(
    (principle) => principle.category === category && principle.slug === slug
  );
}

export async function getPrinciple(
  locale: Locale,
  summary: PrincipleSummary
): Promise<Principle> {
  const { frontmatter, content } = readPrincipleFile(locale, summary.category, summary.slug);
  const { html, headings } = await renderMarkdown(content);
  return { ...summary, tldr: frontmatter.tldr, contentHtml: html, headings };
}
