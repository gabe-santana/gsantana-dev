import { getAllCertificationSummaries } from "@/lib/certifications";
import { type Locale } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

export type RelatedKind = "blog" | "principles" | "certifications" | "news";

export interface RelatedItem {
  kind: RelatedKind;
  path: string;
  title: string;
  description: string;
}

interface Candidate extends RelatedItem {
  key: string;
  date: string;
  category?: string;
  exam?: string;
  tags?: string[];
  isWip?: boolean;
}

const STOP_WORDS = new Set([
  "about", "after", "and", "are", "como", "com", "das", "dos", "for", "from",
  "into", "mais", "para", "por", "que", "sem", "the", "uma", "with", "your",
]);
const BROAD_TERMS = new Set([
  "ai", "architecture", "arquitetura", "azure", "cloud", "dados", "data",
  "engineering", "nuvem", "software", "sistemas", "system", "systems", "tecnologia",
]);

function words(value: string): Set<string> {
  return new Set(
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
      .map((word) => word.startsWith("migrat") || word.startsWith("migra") ? "migration" : word)
  );
}

function candidates(locale: Locale): Candidate[] {
  return [
    ...getAllPostSummaries(locale).map((post) => ({
      key: post.slug,
      kind: "blog" as const,
      path: `/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      date: post.date,
      tags: post.tags,
    })),
    ...getAllPrinciples(locale).map((principle) => ({
      key: principle.key,
      kind: "principles" as const,
      path: principle.path,
      title: principle.title,
      description: principle.short,
      date: "",
      category: principle.category,
      isWip: principle.isWip,
    })),
    ...getAllCertificationSummaries(locale).map((article) => ({
      key: `certifications/${article.slug}`,
      kind: "certifications" as const,
      path: `/certifications/${article.slug}`,
      title: article.title,
      description: article.description,
      date: article.date,
      exam: article.exam,
    })),
    ...newsStories.map((story) => ({
      key: `news/${story.slug}`,
      kind: "news" as const,
      path: `/news/${story.slug}`,
      title: story.copy[locale].title,
      description: story.copy[locale].summary,
      date: story.date,
      category: story.category,
    })),
  ];
}

function relevance(current: Candidate, item: Candidate): number {
  let score = current.kind === item.kind ? 2 : 0;
  if (current.category && current.category === item.category) score += 6;
  if (current.exam && current.exam === item.exam) score += 8;

  const currentTags = new Set(current.tags?.map((tag) => tag.toLowerCase()));
  for (const tag of item.tags ?? []) {
    if (currentTags.has(tag.toLowerCase())) score += 5;
  }

  const currentWords = words(`${current.title} ${current.description} ${current.tags?.join(" ") ?? ""}`);
  const itemWords = words(`${item.title} ${item.description} ${item.tags?.join(" ") ?? ""}`);
  const currentTitleWords = words(current.title);
  const itemTitleWords = words(item.title);
  for (const word of currentWords) {
    if (itemWords.has(word)) {
      score += !BROAD_TERMS.has(word) && currentTitleWords.has(word) && itemTitleWords.has(word) ? 4 : 1;
    }
  }
  return score;
}

export function getRelatedItems(locale: Locale, currentKey: string, limit = 3): RelatedItem[] {
  const items = candidates(locale);
  const current = items.find((item) => item.key === currentKey);
  if (!current) return [];

  return items
    .filter((item) => item.key !== currentKey && !item.isWip && !(current.kind === "certifications" && item.kind === "news"))
    .map((item) => ({ item, score: relevance(current, item) }))
    .sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date) || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item: { kind, path, title, description } }) => ({ kind, path, title, description }));
}
