import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PostCardProgress } from "@/components/post-card-progress";
import { TagBadge } from "@/components/tag-badge";
import { format, getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format-date";
import { localePath, type Locale } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { PAGE_SIZE, pageCount, pageItems, pagePath } from "@/lib/pagination";
import { alternatesFor, localeSocialAlt, pageSocialMetadata } from "@/lib/seo";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";

export function blogTotal(lang: Locale): number {
  return getAllPostSummaries(lang).length;
}

export function blogMetadata(lang: Locale, page: number): Metadata {
  const dict = getDictionary(lang);
  const path = pagePath("/blog", page);
  const title = page > 1 ? format(dict.pagination.title, { title: dict.blog.title, page }) : dict.blog.title;
  return {
    title,
    description: dict.blog.description,
    ...pageSocialMetadata(lang, path, title, dict.blog.description, localeSocialAlt(lang)),
    alternates: alternatesFor(lang, path),
  };
}

export function BlogIndex({ lang, page }: { lang: Locale; page: number }) {
  const dict = getDictionary(lang);
  const all = getAllPostSummaries(lang);
  const posts = pageItems(all, page, PAGE_SIZE.blog);

  return (
    <Container className="pb-24 pt-12 sm:pt-16">
      <header className="border-b border-border pb-8">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{dict.blog.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{dict.blog.description}</p>
        <SearchBox locale={lang} labels={dict.search} section="blog" className="mt-8 w-full max-w-3xl" />
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

      <Pagination
        locale={lang}
        labels={dict.pagination}
        base="/blog"
        page={page}
        total={pageCount(all.length, PAGE_SIZE.blog)}
      />
    </Container>
  );
}
