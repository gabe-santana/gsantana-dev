import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, localePath, locales } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { mediaUrl } from "@/lib/media";
import { getNewsStory, newsStories } from "@/lib/news";
import { getRelatedItems } from "@/lib/related-items";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => newsStories.map((story) => ({ lang, slug: story.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const story = getNewsStory(slug);
  if (!story) return {};
  return {
    title: story.copy[lang].title,
    description: story.copy[lang].summary,
    alternates: alternatesFor(lang, `/news/${slug}`),
    openGraph: { type: "article", publishedTime: story.date, images: [mediaUrl(story.image)] },
  };
}

export default async function NewsStoryPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const story = getNewsStory(slug);
  if (!story) notFound();
  const dict = getDictionary(lang);
  const copy = story.copy[lang];
  const references = [
    `- [${dict.news.readSource}](${story.sourceUrl})`,
    ...story.sources.map((source) => `- [${source.label[lang]}](${source.url})`),
  ];
  const markdown = [
    ...copy.body,
    copy.analysis,
    `## ${dict.news.source}\n\n${references.join("\n")}`,
  ].join("\n\n");
  const { html, headings } = await renderMarkdown(markdown);

  return (
    <ArticleLayout
      locale={lang}
      dict={dict}
      articleKey={`news/${story.slug}`}
      relatedItems={getRelatedItems(lang, `news/${story.slug}`)}
      contentHtml={html}
      headings={headings}
      header={
        <>
          <nav aria-label="Breadcrumb" className="mb-6 font-mono text-xs uppercase">
            <Link href={localePath(lang, "/news")} className="text-accent hover:underline">
              {dict.news.title}
            </Link>
            <span aria-hidden="true" className="mx-2 text-muted">/</span>
            <span className="text-muted">{dict.news.categories[story.category]}</span>
          </nav>
          <p data-pagefind-ignore className="flex flex-wrap gap-x-3 text-sm text-muted">
            <time dateTime={story.date}>{formatDate(story.date, lang)}</time>
            <span aria-hidden="true">&middot;</span>
            <span>{story.publisher}</span>
          </p>
          <h1 className="mt-4 break-words text-4xl font-bold leading-tight tracking-tight">{copy.title}</h1>
          <p className="mt-4 text-lg text-muted">{copy.summary}</p>
        </>
      }
      lead={
        <div className="relative mb-10 aspect-[16/9] overflow-hidden border border-border/60">
          <Image
            src={mediaUrl(story.image)}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 768px, 100vw"
            priority
          />
        </div>
      }
    />
  );
}
