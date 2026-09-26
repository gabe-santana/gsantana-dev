// Relative import on purpose: this module is also bundled into the Cloudflare
// Pages Function (functions/index.ts), whose bundler doesn't know the "@/" alias.
import { defaultLocale, isLocale, type Locale } from "./i18n";

// ISO 3166-1 alpha-2 codes of countries/territories where Portuguese is an
// official language.
export const PORTUGUESE_SPEAKING_COUNTRIES = new Set([
  "BR", // Brazil
  "PT", // Portugal
  "AO", // Angola
  "MZ", // Mozambique
  "CV", // Cape Verde
  "GW", // Guinea-Bissau
  "ST", // São Tomé and Príncipe
  "TL", // Timor-Leste
  "MO", // Macau
  "GQ", // Equatorial Guinea
]);

export interface LocaleSignals {
  /** Value of the language cookie set by the language switcher. */
  cookie?: string | null;
  /** Visitor country from Cloudflare (request.cf.country). */
  country?: string | null;
  /** Raw Accept-Language header. */
  acceptLanguage?: string | null;
}

/** Locales in the visitor's Accept-Language order (by q-value), deduplicated. */
export function localesFromAcceptLanguage(header: string): Locale[] {
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag, q: q ? Number(q.trim().slice(2)) || 0 : 1, index };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  const result: Locale[] = [];
  for (const { tag } of ranked) {
    const locale: Locale | null = tag.startsWith("pt")
      ? "pt-br"
      : tag.startsWith("en")
        ? "en-us"
        : null;
    if (locale && !result.includes(locale)) result.push(locale);
  }
  return result;
}

/**
 * Picks the language for a visitor landing on "/":
 * 1. the language they explicitly chose with the switcher (cookie),
 * 2. their country: Portuguese-speaking countries get pt-br, others en-us,
 * 3. if the country is unknown (Tor, some VPNs), their browser language,
 * 4. the default locale.
 */
export function detectLocale({ cookie, country, acceptLanguage }: LocaleSignals): Locale {
  if (cookie && isLocale(cookie)) return cookie;

  // Cloudflare uses "XX" for unknown and "T1" for Tor exit nodes.
  const code = country?.toUpperCase();
  if (code && code !== "XX" && code !== "T1") {
    return PORTUGUESE_SPEAKING_COUNTRIES.has(code) ? "pt-br" : "en-us";
  }

  return localesFromAcceptLanguage(acceptLanguage ?? "")[0] ?? defaultLocale;
}
