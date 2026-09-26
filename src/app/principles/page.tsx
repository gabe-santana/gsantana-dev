import type { Metadata } from "next";
import { Container } from "@/components/container";
import { PrincipleCard } from "@/components/principle-card";
import { getAllPrinciples, PRINCIPLE_CATEGORIES } from "@/lib/principles";

export const metadata: Metadata = {
  title: "Principles",
  description: "The architecture principles that guide how I design systems.",
};

export default function PrinciplesPage() {
  const principles = getAllPrinciples();

  return (
    <Container className="py-24">
      <p className="font-mono text-sm text-accent">Principles</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">
        How I design systems
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        The architecture principles behind my decisions, from the cloud
        workload up to the enterprise.
      </p>

      <div className="mt-16 space-y-16">
        {PRINCIPLE_CATEGORIES.map((category) => {
          const items = principles.filter((p) => p.category === category.id);
          if (items.length === 0) return null;
          const written = items.filter((p) => !p.isWip).length;

          return (
            <section key={category.id} aria-labelledby={`cat-${category.id}`}>
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border/60 pb-3">
                <h2
                  id={`cat-${category.id}`}
                  className="text-xl font-semibold"
                >
                  {category.label}
                </h2>
                <span className="font-mono text-xs text-muted">
                  {written}/{items.length} written
                </span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((principle) => (
                  <PrincipleCard key={principle.href} principle={principle} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Container>
  );
}
