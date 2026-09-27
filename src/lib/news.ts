import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { locales, type Locale } from "@/lib/i18n";
import { CONTENT_ROOT } from "@/lib/posts";

export type NewsCategory = "ai" | "engineering" | "security";

interface NewsCopy {
  title: string;
  summary: string;
  body: string[];
  analysis: string;
}

export interface NewsStory {
  slug: string;
  date: string;
  category: NewsCategory;
  publisher: string;
  sourceUrl: string;
  sources: { url: string; label: Record<Locale, string> }[];
  image: string;
  copy: Record<Locale, NewsCopy>;
}

/**
 * One file per story and locale (content/news/<locale>/<slug>.md). The
 * frontmatter repeats the story's shared fields in every locale;
 * tests/news.test.ts keeps them identical across languages.
 */
interface NewsFrontmatter {
  title: string;
  summary: string;
  date: string;
  /** Tiebreak between stories published on the same date: lower comes first. */
  order?: number;
  category: NewsCategory;
  publisher: string;
  sourceUrl: string;
  image: string;
  sources: { url: string; label: string }[];
  /** The opening paragraphs, shown before the analysis in the markdown body. */
  lead: string[];
}

export function newsDirectory(locale: Locale): string {
  return path.join(CONTENT_ROOT, "news", locale);
}

function readNewsFile(locale: Locale, slug: string) {
  const { data, content } = matter(fs.readFileSync(path.join(newsDirectory(locale), `${slug}.md`), "utf8"));
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
  return { frontmatter: { ...data, date } as NewsFrontmatter, analysis: content.trim() };
}

function loadNewsStories(): NewsStory[] {
  const [primary, ...others] = locales;
  const slugs = fs
    .readdirSync(newsDirectory(primary))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));

  const stories = slugs.map((slug) => {
    const files = { [primary]: readNewsFile(primary, slug) } as Record<Locale, ReturnType<typeof readNewsFile>>;
    for (const locale of others) files[locale] = readNewsFile(locale, slug);
    const shared = files[primary].frontmatter;

    return {
      story: {
        slug,
        date: shared.date,
        category: shared.category,
        publisher: shared.publisher ?? "",
        sourceUrl: shared.sourceUrl,
        image: shared.image,
        sources: shared.sources.map((source, index) => ({
          url: source.url,
          label: Object.fromEntries(
            locales.map((locale) => [locale, files[locale].frontmatter.sources[index]?.label ?? source.label])
          ) as Record<Locale, string>,
        })),
        copy: Object.fromEntries(
          locales.map((locale) => {
            const { frontmatter, analysis } = files[locale];
            return [locale, { title: frontmatter.title, summary: frontmatter.summary, body: frontmatter.lead, analysis }];
          })
        ) as Record<Locale, NewsCopy>,
      },
      order: shared.order ?? 0,
    };
  });

  return stories
    .sort((a, b) => b.story.date.localeCompare(a.story.date) || a.order - b.order)
    .map(({ story }) => story);
}

// Read once per build process; the static export never loads news at request time.
export const newsStories: NewsStory[] = loadNewsStories();

export function getNewsStory(slug: string): NewsStory | undefined {
  return newsStories.find((story) => story.slug === slug);
}
