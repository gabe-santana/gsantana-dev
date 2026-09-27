import type { Metadata } from "next";
import {
  defaultLocale,
  localeConfig,
  localePath,
  locales,
  type Locale,
} from "@/lib/i18n";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gsantana.dev";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

export function defaultOgImage(locale: Locale): string {
  return `/og/${locale}/default.svg`;
}

export function pageUrl(locale: Locale, path = "/"): string {
  return absoluteUrl(localePath(locale, path));
}

export function pageOgLocale(locale: Locale): string {
  return localeConfig[locale].tag.replace("-", "_");
}

export function socialImage(path: string, alt: string) {
  return {
    url: absoluteUrl(path),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt,
  };
}

export function pageSocialMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  imageAlt: string
) {
  const defaultImage = socialImage(defaultOgImage(locale), imageAlt);

  return {
    openGraph: {
      title,
      description,
      type: "website" as const,
      siteName: "gsantana.dev",
      locale: pageOgLocale(locale),
      url: pageUrl(locale, path),
      images: [defaultImage],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [defaultImage.url],
    },
  };
}

export function articleSocialMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  imagePath: string,
  imageAlt: string,
  fallbackAlt: string
) {
  const primaryImage = socialImage(imagePath, imageAlt);
  const fallbackImage = socialImage(defaultOgImage(locale), fallbackAlt);

  return {
    openGraph: {
      title,
      description,
      type: "article" as const,
      siteName: "gsantana.dev",
      locale: pageOgLocale(locale),
      url: pageUrl(locale, path),
      images: [primaryImage, fallbackImage],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [primaryImage.url, fallbackImage.url],
    },
  };
}

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

export function localeSocialAlt(locale: Locale): string {
  return locale === "pt-br"
    ? "Prévia social de gsantana.dev"
    : "gsantana.dev social preview";
}


