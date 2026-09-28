import { Fragment } from "react";
import { AuthorCard } from "@/components/author-card";
import { CodeBlocks } from "@/components/code-blocks";
import { Comments } from "@/components/comments";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { RelatedItems } from "@/components/related-items";
import { ShareBar } from "@/components/share-bar";
import {
  MobileTableOfContents,
  TableOfContents,
} from "@/components/table-of-contents";
import type { Dictionary } from "@/lib/dictionaries";
import { isGiscusConfigured } from "@/lib/giscus";
import { localeConfig, type Locale } from "@/lib/i18n";
import type { TocHeading } from "@/lib/rehype-extract-headings";
import type { RelatedItem } from "@/lib/related-items";
import { pageUrl } from "@/lib/seo";
import { SEARCH_SECTION_FILTER, type SearchResultKind } from "@/lib/search";

export interface ContentInsert {
  marker: string;
  content: React.ReactNode;
}

type ContentPart = { html: string } | { insert: React.ReactNode };

function splitContent(contentHtml: string, inserts: ContentInsert[]): ContentPart[] {
  const found = inserts
    .map((insert) => ({ ...insert, index: contentHtml.indexOf(insert.marker) }))
    .filter((insert) => insert.index >= 0)
    .sort((a, b) => a.index - b.index);
  const parts: ContentPart[] = [];
  let cursor = 0;
  for (const insert of found) {
    parts.push({ html: contentHtml.slice(cursor, insert.index) }, { insert: insert.content });
    cursor = insert.index + insert.marker.length;
  }
  parts.push({ html: contentHtml.slice(cursor) });
  return parts;
}

interface ArticleLayoutProps {
  locale: Locale;
  dict: Dictionary;
  header: React.ReactNode;
  /** Rendered between the header and the body, e.g. a cover image. */
  lead?: React.ReactNode;
  contentHtml: string;
  /** Client components (e.g. canvas diagrams) spliced into the HTML where each marker appears. */
  contentInserts?: ContentInsert[];
  headings: TocHeading[];
  /**
   * Stable, locale-independent article key: reading progress is saved under
   * it and it names the comment thread, so both follow the article across
   * languages.
   */
  articleKey: string;
  /** The site section this article belongs to; the search index files it under that section. */
  section: SearchResultKind;
  /** Key takeaways shown in a TL;DR box right under the header. */
  tldr?: string[];
  relatedItems?: RelatedItem[];
  /** What the share bar shares: the article's path (without the locale) and title. */
  share: { path: string; title: string };
}

export function ArticleLayout({
  locale,
  dict,
  header,
  lead,
  contentHtml,
  contentInserts = [],
  headings,
  articleKey,
  section,
  tldr,
  relatedItems = [],
  share,
}: ArticleLayoutProps) {
  const hasToc = headings.length >= 2;
  const parts = splitContent(contentHtml, contentInserts);
  const shareLabels = {
    heading: section === "news" ? dict.article.share.news : dict.article.share.post,
    shareOn: dict.article.share.shareOn,
    copyLink: dict.article.share.copyLink,
    copied: dict.article.share.copied,
    more: dict.article.share.more,
  };
  const shareBar = (placement: "top" | "bottom") => (
    <ShareBar url={pageUrl(locale, share.path)} title={share.title} labels={shareLabels} placement={placement} />
  );
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
        {/* data-pagefind-body marks what the search index reads (see
            scripts/build-search-index.mjs); pages without it, and the author
            card, comments and related items, stay out of search results. */}
        <header
          className="mb-10"
          data-pagefind-body
          data-pagefind-filter={`${SEARCH_SECTION_FILTER}:${section}`}
        >
          {header}
        </header>

        {/* Under the title and description: the pitch is fresh, and a reader
            who likes it can share before scrolling on. */}
        {shareBar("top")}

        {tldr?.length ? (
          <aside
            data-pagefind-body
            aria-labelledby="tldr-label"
            className="mb-10 rounded-2xl border border-accent/30 bg-accent/[0.05] px-5 py-4 sm:px-6 sm:py-5"
          >
            <p
              data-pagefind-ignore
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

        {parts.length > 1 ? (
          <div
            id="post-content"
            data-pagefind-body
            className="prose-post prose prose-lg prose-invert max-w-none"
          >
            {parts.map((part, index) =>
              "html" in part ? (
                <div key={index} dangerouslySetInnerHTML={{ __html: part.html }} />
              ) : (
                <Fragment key={index}>{part.insert}</Fragment>
              )
            )}
          </div>
        ) : (
          <div
            id="post-content"
            data-pagefind-body
            className="prose-post prose prose-lg prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}

        {/* Keyed so the effect re-runs on the new HTML after a language switch. */}
        <CodeBlocks
          key={`${locale}:${articleKey}`}
          copyLabel={dict.article.copyCode}
          copiedLabel={dict.article.codeCopied}
        />

        {/* The second share row: right after the last paragraph, the moment
            a reader has just finished and decides what to do next. */}
        {shareBar("bottom")}

        <AuthorCard locale={locale} dict={dict} />

        {isGiscusConfigured ? (
          <Comments
            term={articleKey}
            lang={localeConfig[locale].giscusLang}
            labels={dict.comments}
          />
        ) : null}

        <RelatedItems items={relatedItems} locale={locale} dict={dict} />
      </article>

      {hasToc ? (
        <aside className="hidden lg:block">
          <TableOfContents headings={headings} labels={tocLabels} />
        </aside>
      ) : null}
    </div>
  );
}
