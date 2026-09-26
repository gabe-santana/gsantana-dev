import type { Metadata } from "next";
import { Container } from "@/components/container";
import { PostCard } from "@/components/post-card";
import { getAllPostSummaries } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on applied AI, software engineering, and technology.",
};

export default function BlogIndexPage() {
  const posts = getAllPostSummaries();

  return (
    <Container className="py-24">
      <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Notes on applied AI, software engineering, and technology.
      </p>

      {posts.length === 0 ? (
        <p className="mt-16 text-muted">No posts yet. Check back soon.</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </Container>
  );
}
