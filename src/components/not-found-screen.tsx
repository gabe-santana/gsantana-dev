import Link from "next/link";
import { Bilingual } from "@/components/bilingual";
import { DungeonGame } from "@/components/dungeon-game";
import { getDictionary } from "@/lib/dictionaries";
import { localeConfig, localePath, locales } from "@/lib/i18n";

// Shared by app/global-not-found.tsx (the static 404.html Cloudflare serves
// for every missing URL) and app/[lang]/not-found.tsx. Copy is rendered in
// every language and <Bilingual>'s CSS shows the one matching <html lang>.
export function NotFoundScreen() {
  const chestMessageCount = getDictionary("en-us").notFound.game.chests.length;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-16 text-center">
      <p
        aria-hidden
        className="bg-gradient-to-r from-accent to-[#a78bfa] bg-clip-text font-mono text-7xl font-bold tracking-tight text-transparent sm:text-8xl"
      >
        404
      </p>
      <p className="mt-4 font-mono text-sm text-accent">
        <Bilingual pick={(d) => d.notFound.eyebrow} />
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        <Bilingual pick={(d) => d.notFound.title} />
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted">
        <Bilingual pick={(d) => d.notFound.description} />
      </p>

      <div className="mt-10 w-full">
        <DungeonGame chestMessageCount={chestMessageCount} />
      </div>

      {locales.map((locale) => (
        <Link
          key={locale}
          href={localePath(locale)}
          data-lang={locale}
          lang={localeConfig[locale].tag}
          className="mt-10 text-accent hover:underline"
        >
          {getDictionary(locale).notFound.backHome}
        </Link>
      ))}
    </section>
  );
}
