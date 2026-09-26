import Link from "next/link";
import { Container } from "@/components/container";
import { GridBackdrop } from "@/components/grid-backdrop";
import { Typewriter } from "@/components/typewriter";

const HEADLINE_PHRASES = [
  "AI and software",
  "LLMs in production",
  "agents that ship",
  "systems that scale",
  "the modern web",
] as const;

export function Hero() {
  return (
    // overflow-x-clip (not overflow-hidden): stops the off-screen glows from
    // causing horizontal scroll, but lets them spill softly into the next
    // section instead of being cut off in a hard line at the hero's bottom.
    <section className="relative flex min-h-[92vh] items-center overflow-x-clip">
      <GridBackdrop />

      <Container className="relative">
        <p className="mb-4 font-mono text-sm text-accent">
          AI &middot; Software Engineering &middot; Technology
        </p>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Building at the edge of
          <Typewriter phrases={HEADLINE_PHRASES} />
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          I&apos;m Gabriel Santana. I write about applied AI, systems
          engineering, and the tools shaping how we build software &mdash;
          notes from the field, not just theory.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/blog"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-105"
          >
            Read the blog
          </Link>
          <Link
            href="/about"
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/60"
          >
            About me
          </Link>
        </div>
      </Container>
    </section>
  );
}
