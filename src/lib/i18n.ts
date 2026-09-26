export const locales = ["en-us", "pt-br"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en-us";

/** Per-locale settings that aren't UI copy. */
export const localeConfig: Record<
  Locale,
  {
    /** BCP 47 tag for <html lang>, Intl formatting and hreflang. */
    tag: string;
    /** Short label for the language switcher. */
    short: string;
    /** Language name written in that language. */
    name: string;
    giscusLang: string;
  }
> = {
  "en-us": { tag: "en-US", short: "EN", name: "English", giscusLang: "en" },
  "pt-br": { tag: "pt-BR", short: "PT", name: "Português", giscusLang: "pt" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Prefixes a site path with the locale: ("pt-br", "/blog") -> "/pt-br/blog". */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swaps the locale segment of a pathname, keeping the rest of the path. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if (segments[1] && isLocale(segments[1])) {
    segments[1] = target;
    return segments.join("/");
  }
  return localePath(target, pathname);
}

// Remember an explicit language choice so "/" sends returning visitors
// straight to it. The cookie is read at the edge by functions/index.ts; the
// localStorage key by the fallback redirect script in app/(root)/page.tsx.
export const LOCALE_STORAGE_KEY = "gsantana:locale";
export const LOCALE_COOKIE = "gsantana_locale";
