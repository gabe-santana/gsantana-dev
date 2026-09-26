import Link from "next/link";
import type { PostSummary } from "@/lib/posts";
import { PostCardProgress } from "@/components/post-card-progress";
import { TagBadge } from "@/components/tag-badge";
import { formatDate } from "@/lib/format-date";

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-surface/50 p-6 transition-colors hover:border-accent/50 hover:bg-surface"
    >
      <div className="mb-3 flex items-center gap-3 text-xs text-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span aria-hidden>&middot;</span>
        <span>{post.readingTime}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
        {post.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {post.description}
      </p>
      {post.tags?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      ) : null}
      <PostCardProgress slug={post.slug} />
    </Link>
  );
}
