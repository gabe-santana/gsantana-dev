import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { format, getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath, locales } from "@/lib/i18n";
import { findPrinciple, getAllPrinciples, getPrinciple } from "@/lib/principles";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string; category: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    getAllPrinciples(lang).map(({ category, slug }) => ({ lang, category, slug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, category, slug } = await params;
  if (!isLocale(lang)) return {};
  const summary = findPrinciple(lang, category, slug);
  if (!summary) return {};
  const dict = getDictionary(lang);

  return {
    title: `${summary.title} · ${dict.principles.eyebrow}`,
    description: summary.short,
    alternates: alternatesFor(lang, summary.path),
    openGraph: { title: summary.title, description: summary.short, type: "article" },
  };
}

export default async function PrinciplePage({ params }: PageProps) {
  const { lang, category, slug } = await params;
  if (!isLocale(lang)) notFound();
  const summary = findPrinciple(lang, category, slug);
  if (!summary) notFound();

  const dict = getDictionary(lang);
  const principle = await getPrinciple(lang, summary);

  return (
    <ArticleLayout
      locale={lang}
      dict={dict}
      articleKey={principle.key}
      headings={principle.headings}
      contentHtml={principle.contentHtml}
      header={
        <>
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <Link
              href={localePath(lang, "/principles")}
              className="text-accent hover:underline"
            >
              {dict.principles.eyebrow}
            </Link>
            <span aria-hidden className="text-muted">
              /
            </span>
            <span className="text-muted">
              {dict.principles.categories[principle.category]}
            </span>
          </nav>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            {principle.title}
          </h1>
          <p className="mt-4 text-lg text-muted">{principle.short}</p>
          {principle.isWip ? null : (
            <p className="mt-4 text-sm text-muted">
              {format(dict.article.readingTime, { minutes: principle.readingMinutes })}
            </p>
          )}
        </>
      }
    />
  );
}
