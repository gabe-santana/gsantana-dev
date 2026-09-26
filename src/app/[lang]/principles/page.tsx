import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PrincipleCard } from "@/components/principle-card";
import { format, getDictionary } from "@/lib/dictionaries";
import { isLocale } from "@/lib/i18n";
import { getAllPrinciples, PRINCIPLE_CATEGORIES } from "@/lib/principles";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.principles.eyebrow,
    description: dict.principles.metaDescription,
    alternates: alternatesFor(lang, "/principles"),
  };
}

export default async function PrinciplesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const principles = getAllPrinciples(lang);

  return (
    <Container className="py-24">
      <p className="font-mono text-sm text-accent">{dict.principles.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{dict.principles.title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{dict.principles.intro}</p>

      <div className="mt-16 space-y-16">
        {PRINCIPLE_CATEGORIES.map((category) => {
          const items = principles.filter((p) => p.category === category);
          if (items.length === 0) return null;
          const written = items.filter((p) => !p.isWip).length;

          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border/60 pb-3">
                <h2 id={`cat-${category}`} className="text-xl font-semibold">
                  {dict.principles.categories[category]}
                </h2>
                <span className="font-mono text-xs text-muted">
                  {format(dict.principles.written, { written, total: items.length })}
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
    </Container>
  );
}
