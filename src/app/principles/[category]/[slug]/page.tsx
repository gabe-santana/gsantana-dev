import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { findPrinciple, getAllPrinciples, getPrinciple } from "@/lib/principles";

interface PageProps {
  params: Promise<{ category: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllPrinciples().map(({ category, slug }) => ({ category, slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const summary = findPrinciple(category, slug);
  if (!summary) return {};

  return {
    title: `${summary.title} · Principles`,
    description: summary.short,
    openGraph: {
      title: summary.title,
      description: summary.short,
      type: "article",
    },
  };
}

export default async function PrinciplePage({ params }: PageProps) {
  const { category, slug } = await params;
  const summary = findPrinciple(category, slug);
  if (!summary) notFound();

  const principle = await getPrinciple(summary);

  return (
    <ArticleLayout
      progressKey={principle.progressKey}
      headings={principle.headings}
      contentHtml={principle.contentHtml}
      header={
        <>
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <Link href="/principles" className="text-accent hover:underline">
              Principles
            </Link>
            <span aria-hidden className="text-muted">
              /
            </span>
            <span className="text-muted">{principle.categoryLabel}</span>
          </nav>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            {principle.title}
          </h1>
          <p className="mt-4 text-lg text-muted">{principle.short}</p>
          {principle.isWip ? null : (
            <p className="mt-4 text-sm text-muted">{principle.readingTime}</p>
          )}
        </>
      }
    />
  );
}
