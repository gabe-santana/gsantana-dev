import Link from "next/link";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";
import type { RelatedItem } from "@/lib/related-items";

export function RelatedItems({
  items,
  locale,
  dict,
}: {
  items: RelatedItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (items.length === 0) return null;

  const labels = {
    blog: dict.nav.blog,
    principles: dict.principles.badge,
    certifications: dict.nav.certifications,
    news: dict.nav.news,
  };

  return (
    <section aria-labelledby="related-items-heading" className="mt-16 border-t border-border pt-8">
      <h2 id="related-items-heading" className="text-xl font-semibold text-foreground">
        {dict.article.relatedItems}
      </h2>
      <ul className="mt-4 divide-y divide-border border-b border-border">
        {items.map((item) => (
          <li key={item.path}>
            <Link href={localePath(locale, item.path)} className="group flex items-start justify-between gap-4 py-5">
              <span className="min-w-0">
                <span className="font-mono text-xs uppercase text-accent">{labels[item.kind]}</span>
                <span className="mt-1 block font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{item.description}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-accent">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
