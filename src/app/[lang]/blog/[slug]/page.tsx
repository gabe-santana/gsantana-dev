import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArticleLayout, type ContentInsert } from "@/components/article-layout";
import { AgenticMeshDiagram } from "@/components/agentic-mesh-diagram";
import { SightlineDiagram } from "@/components/sightline-diagram";
import { TagBadge } from "@/components/tag-badge";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, locales, type Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { getAllPostSummaries, getPostBySlug, getPostSlugs } from "@/lib/posts";
import { getRelatedItems } from "@/lib/related-items";
import { SIGHTLINE_DIAGRAMS, sightlineDiagramMarker } from "@/lib/sightline-diagrams";
import {
  alternatesFor,
  articleSocialMetadata,
  localeSocialAlt,
} from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => getPostSlugs(lang).map((slug) => ({ lang, slug })));
}

/** Canvas diagrams that replace `<div id="...-slot"></div>` markers in a post's markdown. */
function diagramInserts(lang: Locale, slug: string): ContentInsert[] {
  if (slug === "agentic-mesh-architecture-rag-agents") {
    return [{ marker: '<div id="agentic-mesh-canvas-slot"></div>', content: <AgenticMeshDiagram locale={lang} /> }];
  }
  if (slug === "sightline-video-compliance-intelligence") {
    return SIGHTLINE_DIAGRAMS.map((kind) => ({
      marker: sightlineDiagramMarker(kind),
      content: <SightlineDiagram locale={lang} kind={kind} />,
    }));
  }
  return [];
}

function isPublished(lang: Locale, slug: string): boolean {
  return getAllPostSummaries(lang).some((post) => post.slug === slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isPublished(lang, slug)) return {};

  const post = await getPostBySlug(lang, slug);
  const cover = post.cover ?? `/posts/${slug}/cover.webp`;

  const social = articleSocialMetadata(
    lang,
    `/blog/${slug}`,
    post.title,
    post.description,
    mediaUrl(cover),
    post.title,
    localeSocialAlt(lang)
  );

  return {
    title: post.title,
    description: post.description,
    alternates: alternatesFor(lang, `/blog/${slug}`),
    openGraph: {
      ...social.openGraph,
      publishedTime: post.date,
      authors: ["Gabriel Santana"],
      tags: post.tags,
    },
    twitter: social.twitter,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isPublished(lang, slug)) notFound();

  const dict = getDictionary(lang);
  const post = await getPostBySlug(lang, slug);
  const cover = post.cover ?? `/posts/${slug}/cover.webp`;
  const inserts = diagramInserts(lang, slug);
  for (const { marker } of inserts) {
    if (!post.contentHtml.includes(marker)) {
      throw new Error(`Diagram marker ${marker} missing from the rendered ${slug} article`);
    }
  }

  return (
    <ArticleLayout
      locale={lang}
      dict={dict}
      articleKey={post.slug}
      relatedItems={getRelatedItems(lang, post.slug)}
      tldr={post.tldr}
      headings={post.headings}
      contentHtml={post.contentHtml}
      contentInserts={inserts}
      header={
        <>
          <div data-pagefind-ignore className="mb-4 flex items-center gap-3 text-sm text-muted">
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
