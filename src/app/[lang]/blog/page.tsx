import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PostCard } from "@/components/post-card";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { alternatesFor } from "@/lib/seo";

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
    alternates: alternatesFor(lang, "/blog"),
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const posts = getAllPostSummaries(lang);

  return (
    <Container className="py-24">
      <h1 className="text-4xl font-bold tracking-tight">{dict.blog.title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{dict.blog.description}</p>

      {posts.length === 0 ? (
        <p className="mt-16 text-muted">{dict.blog.empty}</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} locale={lang} dict={dict} />
          ))}
        </div>
      )}
    </Container>
  );
}
