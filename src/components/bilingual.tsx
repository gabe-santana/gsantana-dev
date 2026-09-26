import { getDictionary, type Dictionary } from "@/lib/dictionaries";
import { localeConfig, locales } from "@/lib/i18n";

/**
 * Renders a string in every locale; CSS in globals.css shows only the one
 * matching <html lang>. For the one page that can't know its locale at build
 * time: the shared static 404, served by Cloudflare for every missing URL.
 */
export function Bilingual({ pick }: { pick: (dict: Dictionary) => string }) {
  return (
    <>
      {locales.map((locale) => (
        <span key={locale} data-lang={locale} lang={localeConfig[locale].tag}>
          {pick(getDictionary(locale))}
        </span>
      ))}
    </>
  );
}
