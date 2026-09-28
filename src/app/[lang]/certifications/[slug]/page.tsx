import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { getAllCertificationSummaries, getCertificationBySlug, getCertificationSlugs } from "@/lib/certifications";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, localePath, locales } from "@/lib/i18n";
import { getRelatedItems } from "@/lib/related-items";
import {
  alternatesFor,
  articleSocialMetadata,
  defaultOgImage,
  localeSocialAlt,
} from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => getCertificationSlugs(lang).map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !getAllCertificationSummaries(lang).some((article) => article.slug === slug)) return {};
  const article = await getCertificationBySlug(lang, slug);
  const social = articleSocialMetadata(
    lang,
    `/certifications/${slug}`,
    article.title,
    article.description,
    defaultOgImage(lang),
    article.title,
    localeSocialAlt(lang)
  );

  return {
    title: article.title,
    description: article.description,
    alternates: alternatesFor(lang, `/certifications/${slug}`),
    openGraph: { ...social.openGraph, publishedTime: article.date, authors: ["Gabriel Santana"] },
    twitter: social.twitter,
  };
}

export default async function CertificationArticlePage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !getAllCertificationSummaries(lang).some((article) => article.slug === slug)) notFound();
  const article = await getCertificationBySlug(lang, slug);
  const dict = getDictionary(lang);

  return (
    <ArticleLayout
      section="certifications"
      locale={lang}
      dict={dict}
      articleKey={`certifications/${slug}`}
      relatedItems={getRelatedItems(lang, `certifications/${slug}`)}
      headings={article.headings}
      contentHtml={article.contentHtml}
      header={
        <>
          <nav aria-label={dict.certifications.breadcrumb} className="mb-6 font-mono text-xs uppercase">
            <Link href={localePath(lang, "/certifications")} className="text-accent hover:underline">
              {dict.certifications.title}
            </Link>
            <span aria-hidden="true" className="mx-2 text-muted">/</span>
            <span className="text-muted">{article.exam}</span>
          </nav>
          <p data-pagefind-ignore className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="text-accent">{dict.certifications.kinds[article.kind]}</span>
            <span aria-hidden="true">&middot;</span>
            <time dateTime={article.date}>{formatDate(article.date, lang)}</time>
            <span aria-hidden="true">&middot;</span>
            <span>{format(dict.article.readingTime, { minutes: article.readingMinutes })}</span>
          </p>
          <h1 className="mt-4 break-words text-4xl font-bold leading-tight tracking-tight">{article.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{article.description}</p>
        </>
      }
      lead={article.videoEmbed ? (
        <figure className="mb-10">
          {article.sourceUrl ? (
            <figcaption className="mb-3 text-center font-mono text-xs text-muted">
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/50 underline-offset-4 hover:decoration-accent">
                {dict.certifications.openVideo}
              </a>
            </figcaption>
          ) : null}
          <div className="mx-auto aspect-[504/399] w-full max-w-[504px] overflow-hidden border border-border bg-surface">
            <iframe
              src={article.videoEmbed}
              title={article.title}
              className="h-full w-full"
              allow="fullscreen; picture-in-picture"
              loading="eager"
            />
          </div>
        </figure>
      ) : null}
    />
  );
}
