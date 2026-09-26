import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { renderMarkdown } from "@/lib/markdown";
import type { TocHeading } from "@/lib/rehype-extract-headings";

export const PRINCIPLES_DIRECTORY = path.join(process.cwd(), "posts", "principles");

// The folder a principle lives in is its category; this list sets the order
// and display names. A new category folder must be added here to show up.
export const PRINCIPLE_CATEGORIES = [
  { id: "cloud", label: "Cloud Architecture" },
  { id: "enterprise", label: "Enterprise Architecture" },
  { id: "solution", label: "Solution Architecture" },
] as const;

export type PrincipleCategory = (typeof PRINCIPLE_CATEGORIES)[number]["id"];

// Placeholder principles all carry this heading. They're still built as pages
// (so shared links don't 404) but listed as "coming soon" instead of linked.
const WIP_MARKER = "Em Construção";

interface PrincipleFrontmatter {
  title: string;
  short: string;
}

export interface PrincipleSummary extends PrincipleFrontmatter {
  slug: string;
  category: PrincipleCategory;
  categoryLabel: string;
  readingTime: string;
  isWip: boolean;
  href: string;
  /** Namespaced so it can never collide with a blog post slug. */
  progressKey: string;
}

export interface Principle extends PrincipleSummary {
  contentHtml: string;
  headings: TocHeading[];
}

function readPrincipleFile(category: PrincipleCategory, slug: string) {
  const raw = fs.readFileSync(
    path.join(PRINCIPLES_DIRECTORY, category, `${slug}.md`),
    "utf8"
  );
  const { data, content } = matter(raw);
  return { frontmatter: data as PrincipleFrontmatter, content };
}

function toSummary(
  category: (typeof PRINCIPLE_CATEGORIES)[number],
  slug: string
): PrincipleSummary {
  const { frontmatter, content } = readPrincipleFile(category.id, slug);
  return {
    title: frontmatter.title,
    short: frontmatter.short,
    slug,
    category: category.id,
    categoryLabel: category.label,
    readingTime: readingTime(content).text,
    isWip: content.includes(WIP_MARKER),
    href: `/principles/${category.id}/${slug}`,
    progressKey: `principles/${category.id}/${slug}`,
  };
}

export function getAllPrinciples(): PrincipleSummary[] {
  return PRINCIPLE_CATEGORIES.flatMap((category) => {
    const dir = path.join(PRINCIPLES_DIRECTORY, category.id);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => toSummary(category, file.replace(/\.md$/, "")))
      // Readable principles first, then placeholders; alphabetical within each.
      .sort(
        (a, b) =>
          Number(a.isWip) - Number(b.isWip) || a.title.localeCompare(b.title)
      );
  });
}

export function findPrinciple(
  category: string,
  slug: string
): PrincipleSummary | undefined {
  return getAllPrinciples().find(
    (principle) => principle.category === category && principle.slug === slug
  );
}

export async function getPrinciple(summary: PrincipleSummary): Promise<Principle> {
  const { content } = readPrincipleFile(summary.category, summary.slug);
  const { html, headings } = await renderMarkdown(content);
  return { ...summary, contentHtml: html, headings };
}
