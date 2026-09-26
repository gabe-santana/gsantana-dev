import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article-layout";
import { TagBadge } from "@/components/tag-badge";
import { formatDate } from "@/lib/format-date";
import { mediaUrl } from "@/lib/media";
import { getAllPostSummaries, getPostBySlug, getPostSlugs } from "@/lib/posts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const isPublished = getAllPostSummaries().some((post) => post.slug === slug);
  if (!isPublished) return {};

  const post = await getPostBySlug(slug);
  return {
    title: post.title,
    description: post.description,
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
  const { slug } = await params;
  const isPublished = getAllPostSummaries().some((post) => post.slug === slug);
  if (!isPublished) notFound();

  const post = await getPostBySlug(slug);

  return (
    <ArticleLayout
      progressKey={post.slug}
      headings={post.headings}
      contentHtml={post.contentHtml}
      header={
        <>
          <div className="mb-4 flex items-center gap-3 text-sm text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>&middot;</span>
            <span>{post.readingTime}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            {post.title}
          </h1>
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
