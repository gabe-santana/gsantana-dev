import type { Metadata } from "next";
import { Container } from "@/components/container";
import { Pagination } from "@/components/pagination";
import { PrincipleCard } from "@/components/principle-card";
import { SearchBox } from "@/components/search-box";
import { format, getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { PAGE_SIZE, pageCount, pageItems, pagePath } from "@/lib/pagination";
import { getAllPrinciples, PRINCIPLE_CATEGORIES } from "@/lib/principles";
import { alternatesFor, localeSocialAlt, pageSocialMetadata } from "@/lib/seo";

// Pages cut the list in category order, so each page shows the headings of
// the categories its principles belong to.
function orderedPrinciples(lang: Locale) {
  const principles = getAllPrinciples(lang);
  return PRINCIPLE_CATEGORIES.flatMap((category) => principles.filter((p) => p.category === category));
}

export function principlesTotal(lang: Locale): number {
  return orderedPrinciples(lang).length;
}

export function principlesMetadata(lang: Locale, page: number): Metadata {
  const dict = getDictionary(lang);
  const path = pagePath("/principles", page);
  const title =
    page > 1 ? format(dict.pagination.title, { title: dict.principles.eyebrow, page }) : dict.principles.eyebrow;
  return {
    title,
    description: dict.principles.metaDescription,
    ...pageSocialMetadata(lang, path, title, dict.principles.metaDescription, localeSocialAlt(lang)),
    alternates: alternatesFor(lang, path),
  };
}

export function PrinciplesIndex({ lang, page }: { lang: Locale; page: number }) {
  const dict = getDictionary(lang);
  const all = orderedPrinciples(lang);
  const shown = pageItems(all, page, PAGE_SIZE.principles);

  return (
    <Container className="py-24">
      <p className="font-mono text-sm text-accent">{dict.principles.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{dict.principles.title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{dict.principles.intro}</p>
      <SearchBox locale={lang} labels={dict.search} section="principles" className="mt-8 w-full max-w-3xl" />

      <div className="mt-16 space-y-16">
        {PRINCIPLE_CATEGORIES.map((category) => {
          const items = shown.filter((p) => p.category === category);
          if (items.length === 0) return null;
          const inCategory = all.filter((p) => p.category === category);
          const written = inCategory.filter((p) => !p.isWip).length;

          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border/60 pb-3">
                <h2 id={`cat-${category}`} className="text-xl font-semibold">
                  {dict.principles.categories[category]}
                </h2>
                <span className="font-mono text-xs text-muted">
                  {format(dict.principles.written, { written, total: inCategory.length })}
                </span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((principle) => (
                  <PrincipleCard
                    key={principle.key}
                    principle={principle}
                    locale={lang}
                    dict={dict}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Pagination
        locale={lang}
        labels={dict.pagination}
        base="/principles"
        page={page}
        total={pageCount(all.length, PAGE_SIZE.principles)}
      />
    </Container>
  );
}
