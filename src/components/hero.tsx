import Link from "next/link";
import { Container } from "@/components/container";
import { GridBackdrop } from "@/components/grid-backdrop";
import { Typewriter } from "@/components/typewriter";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    // overflow-x-clip (not overflow-hidden): stops the off-screen glows from
    // causing horizontal scroll, but lets them spill softly into the next
    // section instead of being cut off in a hard line at the hero's bottom.
    <section className="relative flex min-h-[92vh] items-center overflow-x-clip">
      <GridBackdrop />

      <Container className="relative">
        <p className="mb-4 font-mono text-sm text-accent">{dict.hero.eyebrow}</p>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          {dict.hero.headline}
          {/* Remount per locale: a language switch must restart the cycle
              with the new phrases instead of deleting the old-language one. */}
          <Typewriter key={locale} phrases={dict.hero.phrases} />
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          {dict.hero.intro}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={localePath(locale, "/blog")}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-105"
          >
            {dict.hero.readBlog}
          </Link>
          <Link
            href={localePath(locale, "/news")}
            className="rounded-full border border-accent/50 px-6 py-3 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10"
          >
            {dict.hero.readNews}
          </Link>
          <Link
            href={localePath(locale, "/about")}
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/60"
          >
            {dict.hero.aboutMe}
          </Link>
        </div>
      </Container>
    </section>
  );
}
