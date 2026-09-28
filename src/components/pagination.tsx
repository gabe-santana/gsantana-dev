import Link from "next/link";
import { format, type Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pagination";

interface PaginationProps {
  locale: Locale;
  labels: Dictionary["pagination"];
  /** The list's own path, e.g. "/blog". */
  base: string;
  page: number;
  total: number;
}

const linkClass =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 font-mono text-xs transition-colors";

export function Pagination({ locale, labels, base, page, total }: PaginationProps) {
  if (total <= 1) return null;
  const href = (n: number) => localePath(locale, pagePath(base, n));
  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <nav aria-label={labels.label} className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          className={`${linkClass} justify-self-start border-border text-muted hover:border-accent/50 hover:text-foreground`}
        >
          <span aria-hidden="true">&larr;</span>
          <span className="ml-1.5 hidden sm:inline">{labels.previous}</span>
          <span className="sr-only sm:hidden">{labels.previous}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      <ol className="flex flex-wrap items-center justify-center gap-2">
        {pages.map((n) => (
          <li key={n}>
            <Link
              href={href(n)}
              aria-label={format(labels.page, { page: n })}
              aria-current={n === page ? "page" : undefined}
              className={`${linkClass} ${
                n === page
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-accent/50 hover:text-foreground"
              }`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>

      {page < total ? (
        <Link
          href={href(page + 1)}
          rel="next"
          className={`${linkClass} justify-self-end border-border text-muted hover:border-accent/50 hover:text-foreground`}
        >
          <span className="mr-1.5 hidden sm:inline">{labels.next}</span>
          <span className="sr-only sm:hidden">{labels.next}</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
