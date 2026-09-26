import Link from "next/link";
import { PostCardProgress } from "@/components/post-card-progress";
import type { CertificationSummary } from "@/lib/certifications";
import { format, type Dictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { localePath, type Locale } from "@/lib/i18n";

export function CertificationArticleCard({
  article,
  locale,
  dict,
}: {
  article: CertificationSummary;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <Link
      href={localePath(locale, `/certifications/${article.slug}`)}
      className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-surface/50 p-6 transition-colors hover:border-accent/50 hover:bg-surface"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] uppercase">
        <span className="text-accent">{article.exam}</span>
        <span aria-hidden className="text-muted">/</span>
        <span className="text-muted">{dict.certifications.kinds[article.kind]}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
        {article.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{article.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <time dateTime={article.date}>{formatDate(article.date, locale)}</time>
        <span aria-hidden>&middot;</span>
        <span>{format(dict.article.readingTime, { minutes: article.readingMinutes })}</span>
      </div>
      <PostCardProgress
        slug={`certifications/${article.slug}`}
        labels={{ percentRead: dict.article.percentRead, read: dict.article.read }}
      />
    </Link>
  );
}
