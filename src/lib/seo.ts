import type { Metadata } from "next";
import {
  defaultLocale,
  localeConfig,
  localePath,
  locales,
  type Locale,
} from "@/lib/i18n";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gsantana.dev";

/**
 * Canonical + hreflang links for a page that exists in every locale, so
 * search engines index both languages as translations of each other instead
 * of duplicates. `path` is locale-free, e.g. "/blog/my-post".
 */
export function alternatesFor(
  locale: Locale,
  path: string
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeConfig[l].tag] = localePath(l, path);
  languages["x-default"] = localePath(defaultLocale, path);

  return { canonical: localePath(locale, path), languages };
}
