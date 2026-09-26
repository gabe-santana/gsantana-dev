import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { TagBadge } from "@/components/tag-badge";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, locales, type Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { getAllPostSummaries, getPostBySlug, getPostSlugs } from "@/lib/posts";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => getPostSlugs(lang).map((slug) => ({ lang, slug })));
}

function isPublished(lang: Locale, slug: string): boolean {
  return getAllPostSummaries(lang).some((post) => post.slug === slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isPublished(lang, slug)) return {};

  const post = await getPostBySlug(lang, slug);
  return {
    title: post.title,
    description: post.description,
    alternates: alternatesFor(lang, `/blog/${slug}`),
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      images: post.cover ? [mediaUrl(post.cover)] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isPublished(lang, slug)) notFound();

  const dict = getDictionary(lang);
  const post = await getPostBySlug(lang, slug);

  return (
    <ArticleLayout
      locale={lang}
      dict={dict}
      articleKey={post.slug}
      headings={post.headings}
      contentHtml={post.contentHtml}
      header={
        <>
          <div className="mb-4 flex items-center gap-3 text-sm text-muted">
            <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
            <span aria-hidden>&middot;</span>
            <span>{format(dict.article.readingTime, { minutes: post.readingMinutes })}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{post.title}</h1>
          <p className="mt-4 text-lg text-muted">{post.description}</p>
          {post.tags?.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          ) : null}
        </>
      }
      lead={
        post.cover ? (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-2xl border border-border/60">
            <Image
              src={mediaUrl(post.cover)}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
              priority
            />
          </div>
        ) : null
      }
    />
  );
}
