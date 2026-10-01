import { getAllCertificationSummaries } from "@/lib/certifications";
import { getDictionary } from "@/lib/dictionaries";
import { localeConfig, localePath, type Locale } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { siteUrl } from "@/lib/seo";

export interface FeedItem {
  title: string;
  /** The page's canonical URL, with the trailing slash the static export serves. */
  link: string;
  /**
   * The same URL without the trailing slash, which is how the feed first
   * published its guids. Readers key items by guid, so changing it would
   * show every existing post to subscribers again.
   */
  guid: string;
  description: string;
  /** Principles carry no date: they go after the dated items, without a pubDate. */
  date?: string;
  categories: string[];
}

function item(locale: Locale, path: string, fields: Omit<FeedItem, "link" | "guid">): FeedItem {
  const url = `${siteUrl}${localePath(locale, path)}`;
  return { ...fields, link: `${url}/`, guid: url };
}

export function feedItems(locale: Locale): FeedItem[] {
  const dict = getDictionary(locale);
  const dated: FeedItem[] = [
    ...getAllPostSummaries(locale).map((post) =>
      item(locale, `/blog/${post.slug}`, {
        title: post.title,
        description: post.description,
        date: post.date,
        categories: [dict.nav.blog, ...post.tags],
      })
    ),
    ...newsStories.map((story) =>
      item(locale, `/news/${story.slug}`, {
        title: story.copy[locale].title,
        description: story.copy[locale].summary,
        date: story.date,
        categories: [dict.nav.news, dict.news.categories[story.category]],
      })
    ),
    ...getAllCertificationSummaries(locale).map((article) =>
      item(locale, `/certifications/${article.slug}`, {
        title: article.title,
        description: article.description,
        date: article.date,
        categories: [dict.nav.certifications, article.exam],
      })
    ),
  ];
  // Placeholder principles are built as pages but kept out, like the sitemap does.
  const undated = getAllPrinciples(locale)
    .filter((principle) => !principle.isWip)
    .map((principle) =>
      item(locale, principle.path, {
        title: principle.title,
        description: principle.short,
        categories: [dict.nav.principles, dict.principles.categories[principle.category]],
      })
    );
  // The sort is stable, so items from the same day keep the order above:
  // posts, then news in front-page order, then CertLabs.
  return [...dated.sort((a, b) => b.date!.localeCompare(a.date!)), ...undated];
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

export function renderFeed(locale: Locale): string {
  const dict = getDictionary(locale);
  const items = feedItems(locale);
  const newest = items.find((entry) => entry.date)?.date;

  const entries = items
    .map(
      (entry) => `
    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${entry.link}</link>
      <guid>${entry.guid}</guid>${entry.date ? `
      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>` : ""}
      <description>${escapeXml(entry.description)}</description>${entry.categories
        .map(
          (category) => `
      <category>${escapeXml(category)}</category>`
        )
        .join("")}
    </item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>gsantana.dev</title>
    <link>${siteUrl}${localePath(locale)}/</link>
    <atom:link href="${siteUrl}${localePath(locale, "/feed.xml")}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(dict.site.feedDescription)}</description>
    <language>${localeConfig[locale].tag.toLowerCase()}</language>${newest ? `
    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : ""}${entries}
  </channel>
</rss>`;
}
