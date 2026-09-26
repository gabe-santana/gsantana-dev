export function TagBadge({ tag }: { tag: string }) {
  return (
    // Adjacent badges have no text between them, so the search index would
    // glue them into one word ("AI AgentsTool Calling").
    <span data-pagefind-ignore className="rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-muted">
      {tag}
    </span>
  );
}
