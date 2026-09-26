import { AuthorCard } from "@/components/author-card";
import { Comments } from "@/components/comments";
import { isGiscusConfigured } from "@/lib/giscus";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import {
  MobileTableOfContents,
  TableOfContents,
} from "@/components/table-of-contents";
import type { TocHeading } from "@/lib/rehype-extract-headings";

interface ArticleLayoutProps {
  header: React.ReactNode;
  /** Rendered between the header and the body, e.g. a cover image. */
  lead?: React.ReactNode;
  contentHtml: string;
  headings: TocHeading[];
  /** localStorage key the reading progress is saved under. */
  progressKey: string;
}

export function ArticleLayout({
  header,
  lead,
  contentHtml,
  headings,
  progressKey,
}: ArticleLayoutProps) {
  const hasToc = headings.length >= 2;

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
            <MobileTableOfContents headings={headings} />
          </div>
        ) : null}

        {lead}

        <ReadingProgressBar slug={progressKey} targetId="post-content" />

        <div
          id="post-content"
          className="prose-post prose prose-lg prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        <AuthorCard />

        {isGiscusConfigured ? <Comments term={progressKey} /> : null}
      </article>

      {hasToc ? (
        <aside className="hidden lg:block">
          <TableOfContents headings={headings} />
        </aside>
      ) : null}
    </div>
  );
}
