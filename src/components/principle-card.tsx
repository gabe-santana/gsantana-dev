import Link from "next/link";
import { PostCardProgress } from "@/components/post-card-progress";
import type { PrincipleSummary } from "@/lib/principles";

export function PrincipleCard({
  principle,
  showCategory = false,
}: {
  principle: PrincipleSummary;
  showCategory?: boolean;
}) {
  if (principle.isWip) {
    return (
      <div
        aria-disabled
        className="flex h-full flex-col rounded-2xl border border-dashed border-border/80 p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          {showCategory ? (
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted/70">
              {principle.categoryLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            Coming soon
          </span>
        </div>
        <h3 className="text-lg font-semibold text-foreground/50">
          {principle.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted/70">
          {principle.short}
        </p>
      </div>
    );
  }

  return (
    // 1px gradient "border": the padded wrapper shows through around the
    // inner panel. Brightens on hover.
    <Link
      href={principle.href}
      className="group block h-full rounded-2xl bg-gradient-to-br from-accent/45 via-border to-[#a78bfa]/45 p-px transition-shadow duration-300 hover:from-accent hover:to-[#a78bfa] hover:shadow-[0_0_30px_-8px_rgb(94_234_212/0.35)]"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1rem-1px)] bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wider">
          <span className="text-accent">Principle</span>
          {showCategory ? (
            <>
              <span aria-hidden className="text-muted">
                /
              </span>
              <span className="text-muted">{principle.categoryLabel}</span>
            </>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
          {principle.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
          {principle.short}
        </p>
        <p className="mt-4 text-xs text-muted">{principle.readingTime}</p>
        <PostCardProgress slug={principle.progressKey} />
      </div>
    </Link>
  );
}
