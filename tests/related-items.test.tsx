import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BlogPostPage from "@/app/[lang]/blog/[slug]/page";
import CertificationArticlePage from "@/app/[lang]/certifications/[slug]/page";
import NewsStoryPage from "@/app/[lang]/news/[slug]/page";
import PrinciplePage from "@/app/[lang]/principles/[category]/[slug]/page";
import { RelatedItems } from "@/components/related-items";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { getDictionary } from "@/lib/dictionaries";
import { locales } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { getRelatedItems } from "@/lib/related-items";

describe("related items", () => {
  it.each(locales)("finds distinct, published recommendations for every %s article type", (locale) => {
    const post = getAllPostSummaries(locale)[0];
    const principle = getAllPrinciples(locale)[0];
    const certification = getAllCertificationSummaries(locale)[0];
    const story = newsStories[0];
    const keys = [post.slug, principle.key, `certifications/${certification.slug}`, `news/${story.slug}`];
    const unfinished = new Set(getAllPrinciples(locale).filter((item) => item.isWip).map((item) => item.path));

    for (const key of keys) {
      const items = getRelatedItems(locale, key);
      expect(items, key).toHaveLength(3);
      expect(new Set(items.map((item) => item.path)).size, key).toBe(3);
      expect(items.some((item) => item.path === `/${key}` || item.path === `/blog/${key}`), key).toBe(false);
      expect(items.some((item) => unfinished.has(item.path)), key).toBe(false);
    }

    const wip = getAllPrinciples(locale).find((item) => item.isWip);
    expect(getRelatedItems(locale, wip!.key)).toHaveLength(3);
    expect(getRelatedItems(locale, "certifications/az-305-sql-server-cloud-migration").some((item) =>
      item.path === "/blog/strangler-fig-migration"
    )).toBe(true);
  });

  it.each(locales)("renders localized %s links and heading", (locale) => {
    const items = getRelatedItems(locale, `news/${newsStories[0].slug}`);
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      <RelatedItems items={items} locale={locale} dict={getDictionary(locale)} />
    );

    expect(root.querySelector("h2")?.textContent).toBe(getDictionary(locale).article.relatedItems);
    expect([...root.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(
      items.map((item) => `/${locale}${item.path}`)
    );
  });

  it("places related links at the end of posts, principles, CertLabs, and news", async () => {
    const locale = "en-us";
    const post = getAllPostSummaries(locale).find((item) => item.slug !== "agentic-mesh-architecture-rag-agents")!;
    const principle = getAllPrinciples(locale).find((item) => !item.isWip)!;
    const certification = getAllCertificationSummaries(locale)[0];
    const story = newsStories[0];
    const pages = [
      await BlogPostPage({ params: Promise.resolve({ lang: locale, slug: post.slug }) }),
      await PrinciplePage({ params: Promise.resolve({ lang: locale, category: principle.category, slug: principle.slug }) }),
      await CertificationArticlePage({ params: Promise.resolve({ lang: locale, slug: certification.slug }) }),
      await NewsStoryPage({ params: Promise.resolve({ lang: locale, slug: story.slug }) }),
    ];

    for (const page of pages) {
      const root = document.createElement("div");
      root.innerHTML = renderToStaticMarkup(page);
      const related = root.querySelector("#related-items-heading")?.parentElement;
      expect(related).not.toBeNull();
      expect(related?.querySelectorAll("a")).toHaveLength(3);
      expect(root.querySelector("article")?.lastElementChild).toBe(related);
    }
  });
});
