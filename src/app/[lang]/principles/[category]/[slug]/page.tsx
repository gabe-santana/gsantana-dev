import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { format, getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath, locales } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { findPrinciple, getAllPrinciples, getPrinciple } from "@/lib/principles";
import { getRelatedItems } from "@/lib/related-items";
import {
  alternatesFor,
  articleSocialMetadata,
  localeSocialAlt,
} from "@/lib/seo";

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
  const cover = `/principles/${category}/${slug}/cover.webp`;

  const title = `${summary.title} · ${dict.principles.eyebrow}`;
  const social = articleSocialMetadata(
    lang,
    summary.path,
    title,
    summary.short,
    mediaUrl(cover),
    summary.title,
    localeSocialAlt(lang)
  );

  return {
    title,
    description: summary.short,
    alternates: alternatesFor(lang, summary.path),
    openGraph: { ...social.openGraph, authors: ["Gabriel Santana"] },
    twitter: social.twitter,
  };
}

export default async function PrinciplePage({ params }: PageProps) {
  const { lang, category, slug } = await params;
  if (!isLocale(lang)) notFound();
  const summary = findPrinciple(lang, category, slug);
  if (!summary) notFound();

  const dict = getDictionary(lang);
  const principle = await getPrinciple(lang, summary);
  const cover = `/principles/${category}/${slug}/cover.webp`;

  return (
    <ArticleLayout
      section="principles"
      locale={lang}
      dict={dict}
      articleKey={principle.key}
      relatedItems={getRelatedItems(lang, principle.key)}
      tldr={principle.tldr}
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
            <p data-pagefind-ignore className="mt-4 text-sm text-muted">
              {format(dict.article.readingTime, { minutes: principle.readingMinutes })}
            </p>
          )}
        </>
      }
      lead={
        <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-2xl border border-border/60">
          <Image
            src={mediaUrl(cover)}
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
