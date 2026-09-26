import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { newsStories, type NewsStory } from "@/lib/news";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.news.title,
    description: dict.news.metaDescription,
    alternates: alternatesFor(lang, "/news"),
  };
}

function StoryMeta({ story, locale }: { story: NewsStory; locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase text-muted">
      <span className="text-accent">{dict.news.categories[story.category]}</span>
      <span aria-hidden="true" className="text-border">/</span>
      <span>{story.publisher}</span>
      <span aria-hidden="true" className="text-border">/</span>
      <time dateTime={story.date}>{formatDate(story.date, locale)}</time>
    </p>
  );
}

export default async function NewsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const lead = newsStories.find((story) => story.slug === "gpt-6-sol-luna")!;
  const side = newsStories.filter((story) =>
    ["copilot-weekly-releases", "github-ships-more-css", "agentic-autofix-copilot-memory"].includes(story.slug)
  );
  const latest = newsStories.filter((story) => story !== lead && !side.includes(story));

  return (
    <Container className="pb-24 pt-12 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <p className="font-mono text-xs uppercase text-accent">{dict.news.issue}</p>
          <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">{dict.news.title}</h1>
          <p className="mt-3 max-w-xl text-muted">{dict.news.description}</p>
        </div>
        <p className="font-mono text-xs text-muted">{dict.news.asOf}</p>
      </div>

      <section aria-labelledby="news-lead" className="mt-9">
        <h2 id="news-lead" className="mb-5 font-mono text-xs uppercase text-muted">
          {dict.news.lead}
        </h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <article className="min-w-0">
            <Link href={localePath(lang, `/news/${lead.slug}`)} className="group block">
              <div className="relative aspect-[16/9] overflow-hidden border border-border bg-surface">
                {lead.image && (
                  <Image
                    src={mediaUrl(lead.image)}
                    alt={dict.news.waferAlt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 620px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="mt-5"><StoryMeta story={lead} locale={lang} /></div>
              <h3 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-foreground transition-colors group-hover:text-accent sm:text-4xl">
                {lead.copy[lang].title}
              </h3>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted">{lead.copy[lang].summary}</p>
              <span className="mt-5 inline-block font-mono text-xs text-accent">
                {dict.news.readStory} <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          </article>

          <div className="divide-y divide-border border-y border-border lg:border-t-0">
            {side.map((story, index) => (
              <article key={story.slug} className="py-5 first:pt-0 last:pb-0 lg:first:pt-0">
                <Link href={localePath(lang, `/news/${story.slug}`)} className="group block">
                  {index === 0 && story.image && (
                    <div className="relative mb-4 aspect-[16/8] overflow-hidden bg-surface">
                      <Image
                        src={mediaUrl(story.image)}
                        alt={dict.news.codeAlt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 350px"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <StoryMeta story={story} locale={lang} />
                  <h3 className={`mt-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-accent ${index === 0 ? "text-xl" : "text-lg"}`}>
                    {story.copy[lang].title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{story.copy[lang].summary}</p>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="news-latest" className="mt-16 border-t border-border pt-7">
        <h2 id="news-latest" className="mb-6 text-xl font-semibold">{dict.news.latest}</h2>
        <div className="divide-y divide-border border-b border-border">
          {latest.map((story) => (
            <article key={story.slug} className="py-6 first:pt-0">
              <Link
                href={localePath(lang, `/news/${story.slug}`)}
                className="group grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-8"
              >
                <div>
                  <p className="font-mono text-[11px] uppercase text-accent">
                    {dict.news.categories[story.category]}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-accent sm:text-2xl">
                    {story.copy[lang].title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{story.copy[lang].summary}</p>
                </div>
                <p className="flex flex-wrap gap-x-2 self-start font-mono text-xs text-muted sm:justify-end sm:text-right">
                  <span>{story.publisher}</span>
                  <time dateTime={story.date}>{formatDate(story.date, lang)}</time>
                </p>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
}
