export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-muted">
      {tag}
    </span>
  );
}
