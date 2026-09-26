import Link from "next/link";
import { Hero } from "@/components/hero";
import { Container } from "@/components/container";
import { PostCard } from "@/components/post-card";
import { PrincipleCard } from "@/components/principle-card";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

export default function HomePage() {
  const posts = getAllPostSummaries().slice(0, 3);
  const allPrinciples = getAllPrinciples();
  const principles = allPrinciples.filter((p) => !p.isWip).slice(0, 3);

  return (
    <>
      <Hero />

      {principles.length > 0 && (
        <Container className="pt-24">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Principles</h2>
              <p className="mt-1 text-sm text-muted">
                The architecture principles behind my decisions.
              </p>
            </div>
            <Link
              href="/principles"
              className="shrink-0 text-sm text-accent hover:underline"
            >
              All {allPrinciples.length} &rarr;
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle) => (
              <PrincipleCard
                key={principle.href}
                principle={principle}
                showCategory
              />
            ))}
          </div>
        </Container>
      )}

      {posts.length > 0 && (
        <Container className="py-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Latest posts</h2>
            <Link
              href="/blog"
              className="text-sm text-accent hover:underline"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </Container>
      )}
    </>
  );
}
