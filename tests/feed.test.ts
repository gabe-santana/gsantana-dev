import { describe, expect, it } from "vitest";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { feedItems, renderFeed } from "@/lib/feed";
import { localePath, locales } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { siteUrl } from "@/lib/seo";

describe("RSS feed", () => {
  it.each(locales)("lists every post, news story, CertLabs article and published principle in %s", (locale) => {
    const expected = [
      ...getAllPostSummaries(locale).map((post) => `/blog/${post.slug}`),
      ...newsStories.map((story) => `/news/${story.slug}`),
      ...getAllCertificationSummaries(locale).map((article) => `/certifications/${article.slug}`),
      ...getAllPrinciples(locale)
        .filter((principle) => !principle.isWip)
        .map((principle) => principle.path),
    ].map((path) => `${siteUrl}${localePath(locale, path)}/`);

    expect(feedItems(locale).map((entry) => entry.link).sort()).toEqual(expected.sort());
  });

  it.each(locales)("keeps every guid as the link without its trailing slash in %s", (locale) => {
    for (const entry of feedItems(locale)) expect(entry.guid).toBe(entry.link.slice(0, -1));
  });

  it.each(locales)("puts dated items newest first and the undated principles last in %s", (locale) => {
    const items = feedItems(locale);
    const firstUndated = items.findIndex((entry) => !entry.date);
    const dated = firstUndated === -1 ? items : items.slice(0, firstUndated);
    expect(items.slice(dated.length).every((entry) => !entry.date)).toBe(true);

    const dates = dated.map((entry) => entry.date!);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it.each(locales)("renders well-formed RSS with a self link in %s", (locale) => {
    const doc = new DOMParser().parseFromString(renderFeed(locale), "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagName("item")).toHaveLength(feedItems(locale).length);

    const self = doc.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "link")[0];
    expect(self?.getAttribute("href")).toBe(`${siteUrl}${localePath(locale, "/feed.xml")}`);
  });
});
