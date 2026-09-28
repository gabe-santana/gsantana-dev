import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Pagination } from "@/components/pagination";
import { PostCardProgress } from "@/components/post-card-progress";
import { SearchBox } from "@/components/search-box";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { localePath, type Locale } from "@/lib/i18n";
import { PAGE_SIZE, pageCount, pageItems, pagePath } from "@/lib/pagination";
import { alternatesFor, localeSocialAlt, pageSocialMetadata } from "@/lib/seo";

export function certificationsMetadata(lang: Locale, page: number): Metadata {
  const dict = getDictionary(lang);
  const path = pagePath("/certifications", page);
  const title =
    page > 1 ? format(dict.pagination.title, { title: dict.certifications.title, page }) : dict.certifications.title;
  return {
    title,
    description: dict.certifications.metaDescription,
    ...pageSocialMetadata(lang, path, title, dict.certifications.metaDescription, localeSocialAlt(lang)),
    alternates: alternatesFor(lang, path),
  };
}

export function CertificationsIndex({ lang, page }: { lang: Locale; page: number }) {
  const dict = getDictionary(lang);
  const all = getAllCertificationSummaries(lang);
  const articles = pageItems(all, page, PAGE_SIZE.certifications);

  return (
    <Container className="pb-24 pt-12 sm:pt-16">
      <header className="border-b border-border pb-8">
        <p className="font-mono text-xs uppercase text-accent">{dict.certifications.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">{dict.certifications.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{dict.certifications.description}</p>
        <SearchBox
          locale={lang}
          labels={dict.search}
          section="certifications"
          className="mt-8 w-full max-w-3xl"
        />
      </header>

      <div className="divide-y divide-border border-b border-border">
        {articles.map((article) => (
          <article key={article.slug} className="relative py-8 first:pt-9">
            <Link href={localePath(lang, `/certifications/${article.slug}`)} className="group block sm:grid sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-10">
              <div>
                <p className="font-mono text-xs uppercase text-accent">
                  {article.exam} <span className="mx-2 text-muted">/</span> {dict.certifications.kinds[article.kind]}
                </p>
                <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-foreground transition-colors group-hover:text-accent sm:text-3xl">
                  {article.title}
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted">{article.description}</p>
                <span className="mt-5 inline-block font-mono text-xs text-accent">
                  {dict.certifications.readArticle} <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
              <p className="mt-4 flex gap-2 font-mono text-xs text-muted sm:mt-0 sm:flex-col sm:items-end sm:text-right">
                <time dateTime={article.date}>{formatDate(article.date, lang)}</time>
                <span className="sm:hidden" aria-hidden="true">&middot;</span>
                <span>{format(dict.article.readingTime, { minutes: article.readingMinutes })}</span>
              </p>
            </Link>
            <PostCardProgress
              slug={`certifications/${article.slug}`}
              labels={{ percentRead: dict.article.percentRead, read: dict.article.read }}
            />
          </article>
        ))}
      </div>

      <Pagination
        locale={lang}
        labels={dict.pagination}
        base="/certifications"
        page={page}
        total={pageCount(all.length, PAGE_SIZE.certifications)}
      />
    </Container>
  );
}
