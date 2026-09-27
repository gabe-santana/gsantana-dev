import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PostCardProgress } from "@/components/post-card-progress";
import { TagBadge } from "@/components/tag-badge";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { isLocale, localePath } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { alternatesFor, localeSocialAlt, pageSocialMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
    return {
    title: dict.blog.title,
    description: dict.blog.description,
    ...pageSocialMetadata(lang, "/blog", dict.blog.title, dict.blog.description, localeSocialAlt(lang)),
    alternates: alternatesFor(lang, "/blog"),
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const posts = getAllPostSummaries(lang);

  return (
    <Container className="pb-24 pt-12 sm:pt-16">
      <header className="border-b border-border pb-8">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{dict.blog.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{dict.blog.description}</p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-12 text-muted">{dict.blog.empty}</p>
      ) : (
        <div className="divide-y divide-border border-b border-border">
          {posts.map((post) => (
            <article key={post.slug} className="relative py-8 first:pt-9">
              <Link href={localePath(lang, `/blog/${post.slug}`)} className="group block sm:grid sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-10">
                <div>
                  <h2 className="max-w-3xl text-2xl font-semibold leading-tight text-foreground transition-colors group-hover:text-accent sm:text-3xl">
                    {post.title}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">{post.description}</p>
                  {post.tags?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                    </div>
                  ) : null}
                  <span className="mt-5 inline-block font-mono text-xs text-accent">
                    {dict.blog.readArticle} <span aria-hidden="true">&rarr;</span>
                  </span>
                </div>
                <p className="mt-4 flex gap-2 font-mono text-xs text-muted sm:mt-0 sm:flex-col sm:items-end sm:text-right">
                  <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
                  <span className="sm:hidden" aria-hidden="true">&middot;</span>
                  <span>{format(dict.article.readingTime, { minutes: post.readingMinutes })}</span>
                </p>
              </Link>
              <PostCardProgress
                slug={post.slug}
                labels={{ percentRead: dict.article.percentRead, read: dict.article.read }}
              />
            </article>
          ))}
        </div>
      )}
    </Container>
  );
}
