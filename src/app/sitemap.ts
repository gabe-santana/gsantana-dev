import type { MetadataRoute } from "next";
import { localeConfig, localePath, locales, type Locale } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/** One entry per locale, each listing every translation as an alternate. */
function localized(
  path: string,
  lastModified?: string | Date,
  availableIn: readonly Locale[] = locales
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    availableIn.map((l) => [localeConfig[l].tag, `${siteUrl}${localePath(l, path)}`])
  );
  return availableIn.map((l) => ({
    url: `${siteUrl}${localePath(l, path)}`,
    lastModified,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["/", "/blog", "/principles", "/about"].flatMap((path) =>
    localized(path, now)
  );

  const postRoutes = new Map<string, { date: string; locales: Locale[] }>();
  for (const l of locales) {
    for (const post of getAllPostSummaries(l)) {
      const entry = postRoutes.get(post.slug) ?? { date: post.date, locales: [] };
      entry.locales.push(l);
      postRoutes.set(post.slug, entry);
    }
  }

  // Placeholder principles are built but kept out of the sitemap.
  const principlePaths = new Map<string, Locale[]>();
  for (const l of locales) {
    for (const principle of getAllPrinciples(l)) {
      if (principle.isWip) continue;
      principlePaths.set(principle.path, [...(principlePaths.get(principle.path) ?? []), l]);
    }
  }

  return [
    ...staticRoutes,
    ...[...postRoutes].flatMap(([slug, { date, locales: available }]) =>
      localized(`/blog/${slug}`, date, available)
    ),
    ...[...principlePaths].flatMap(([path, available]) =>
      localized(path, undefined, available)
    ),
  ];
}
