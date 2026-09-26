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
  headings: TocHeading[];
  /**
   * Stable, locale-independent article key: reading progress is saved under
   * it and it names the comment thread, so both follow the article across
   * languages.
   */
  articleKey: string;
}

export function ArticleLayout({
  locale,
  dict,
  header,
  lead,
  contentHtml,
  headings,
  articleKey,
}: ArticleLayoutProps) {
  const hasToc = headings.length >= 2;
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

        {hasToc ? (
          <div className="lg:hidden">
            <MobileTableOfContents headings={headings} labels={tocLabels} />
          </div>
        ) : null}

        {lead}

        <ReadingProgressBar
          slug={articleKey}
          targetId="post-content"
          label={dict.article.readingProgress}
        />

        <div
          id="post-content"
          className="prose-post prose prose-lg prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

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
