import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PostCardProgress } from "@/components/post-card-progress";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, localePath } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.certifications.title,
    description: dict.certifications.metaDescription,
    alternates: alternatesFor(lang, "/certifications"),
  };
}

export default async function CertificationsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const articles = getAllCertificationSummaries(lang);

  return (
    <Container className="pb-24 pt-12 sm:pt-16">
      <header className="border-b border-border pb-8">
        <p className="font-mono text-xs uppercase text-accent">{dict.certifications.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">{dict.certifications.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{dict.certifications.description}</p>
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
    </Container>
  );
}
