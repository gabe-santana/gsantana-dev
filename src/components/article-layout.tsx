import { AuthorCard } from "@/components/author-card";
import { Comments } from "@/components/comments";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import {
  MobileTableOfContents,
  TableOfContents,
} from "@/components/table-of-contents";
import type { Dictionary } from "@/lib/dictionaries";
import { isGiscusConfigured } from "@/lib/giscus";
import { localeConfig, type Locale } from "@/lib/i18n";
import type { TocHeading } from "@/lib/rehype-extract-headings";

interface ArticleLayoutProps {
  locale: Locale;
  dict: Dictionary;
  header: React.ReactNode;
  /** Rendered between the header and the body, e.g. a cover image. */
  lead?: React.ReactNode;
  contentHtml: string;
  contentInsert?: { marker: string; content: React.ReactNode };
  headings: TocHeading[];
  /**
   * Stable, locale-independent article key: reading progress is saved under
   * it and it names the comment thread, so both follow the article across
   * languages.
   */
  articleKey: string;
  /** Key takeaways shown in a TL;DR box right under the header. */
  tldr?: string[];
}

export function ArticleLayout({
  locale,
  dict,
  header,
  lead,
  contentHtml,
  contentInsert,
  headings,
  articleKey,
  tldr,
}: ArticleLayoutProps) {
  const hasToc = headings.length >= 2;
  const markerIndex = contentInsert ? contentHtml.indexOf(contentInsert.marker) : -1;
  const tocLabels = {
    onThisPage: dict.article.onThisPage,
    backToTop: dict.article.backToTop,
  };

  return (
    <div
      className={`mx-auto w-full px-6 py-24 ${
        hasToc
          ? "max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16"
          : "max-w-5xl"
      }`}
    >
      <article className="mx-auto w-full min-w-0 max-w-2xl">
        <header className="mb-10">{header}</header>

        {tldr?.length ? (
          <aside
            aria-labelledby="tldr-label"
            className="mb-10 rounded-2xl border border-accent/30 bg-accent/[0.05] px-5 py-4 sm:px-6 sm:py-5"
          >
            <p
              id="tldr-label"
              className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-accent"
            >
              {dict.article.tldr}
            </p>
            <ul className="space-y-2 text-[0.95rem] leading-relaxed text-foreground/90">
              {tldr.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        {lead}

        {hasToc ? (
          <div className="lg:hidden">
            <MobileTableOfContents headings={headings} labels={tocLabels} />
          </div>
        ) : null}

        <ReadingProgressBar
          slug={articleKey}
          targetId="post-content"
          label={dict.article.readingProgress}
        />

        {contentInsert && markerIndex >= 0 ? (
          <div id="post-content" className="prose-post prose prose-lg prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: contentHtml.slice(0, markerIndex) }} />
            {contentInsert.content}
            <div
              dangerouslySetInnerHTML={{
                __html: contentHtml.slice(markerIndex + contentInsert.marker.length),
              }}
            />
          </div>
        ) : (
          <div
            id="post-content"
            className="prose-post prose prose-lg prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}

        <AuthorCard locale={locale} dict={dict} />

        {isGiscusConfigured ? (
          <Comments
            term={articleKey}
            lang={localeConfig[locale].giscusLang}
            labels={dict.comments}
          />
        ) : null}
      </article>

      {hasToc ? (
        <aside className="hidden lg:block">
          <TableOfContents headings={headings} labels={tocLabels} />
        </aside>
      ) : null}
    </div>
  );
}
