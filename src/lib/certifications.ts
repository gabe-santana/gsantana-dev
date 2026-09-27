import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Locale } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { CONTENT_ROOT, minutesToRead } from "@/lib/posts";
import type { TocHeading } from "@/lib/rehype-extract-headings";

export type CertificationKind = "question" | "training" | "guide";

interface CertificationFrontmatter {
  title: string;
  description: string;
  date: string;
  exam: string;
  kind: CertificationKind;
  videoEmbed?: string;
  sourceUrl?: string;
}

export interface CertificationSummary extends CertificationFrontmatter {
  slug: string;
  readingMinutes: number;
}

export interface CertificationArticle extends CertificationSummary {
  contentHtml: string;
  headings: TocHeading[];
}

function directory(locale: Locale): string {
  return path.join(CONTENT_ROOT, "certifications", locale);
}

export function getCertificationSlugs(locale: Locale): string[] {
  const dir = directory(locale);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

function readCertification(locale: Locale, slug: string) {
  const raw = fs.readFileSync(path.join(directory(locale), `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
  return {
    frontmatter: { ...data, date } as CertificationFrontmatter,
    content,
  };
}

export function getAllCertificationSummaries(locale: Locale): CertificationSummary[] {
  return getCertificationSlugs(locale)
    .map((slug) => {
      const { frontmatter, content } = readCertification(locale, slug);
      return { ...frontmatter, slug, readingMinutes: minutesToRead(content) };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getCertificationBySlug(locale: Locale, slug: string): Promise<CertificationArticle> {
  const { frontmatter, content } = readCertification(locale, slug);
  const { html, headings } = await renderMarkdown(content);
  return {
    ...frontmatter,
    slug,
    readingMinutes: minutesToRead(content),
    contentHtml: html,
    headings,
  };
}
