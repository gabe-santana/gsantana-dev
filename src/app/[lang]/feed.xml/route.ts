import { getDictionary } from "@/lib/dictionaries";
import { isLocale, localeConfig, localePath, locales } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { siteUrl } from "@/lib/seo";

// Static export builds one feed per locale at build time — there is no
// server to regenerate it per-request.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  const dict = getDictionary(lang);

  const items = getAllPostSummaries(lang)
    .map((post) => {
      const url = `${siteUrl}${localePath(lang, `/blog/${post.slug}`)}`;
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>gsantana.dev</title>
    <link>${siteUrl}${localePath(lang)}</link>
    <description>${escapeXml(dict.site.feedDescription)}</description>
    <language>${localeConfig[lang].tag.toLowerCase()}</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
