import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BlogIndexPage from "@/app/[lang]/blog/page";
import CertificationsPage from "@/app/[lang]/certifications/page";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { getDictionary } from "@/lib/dictionaries";
import { locales } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";

vi.mock("@/components/post-card-progress", () => ({
  PostCardProgress: ({ slug }: { slug: string }) =>
    createElement("span", { "data-progress-key": slug }),
}));

describe("article indexes", () => {
  it.each(locales)("renders %s blog posts as a list with reading progress", async (locale) => {
    const page = await BlogIndexPage({ params: Promise.resolve({ lang: locale }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    const rows = root.querySelectorAll("article");
    const posts = getAllPostSummaries(locale);
    expect(rows).toHaveLength(posts.length);
    expect(rows[0].parentElement?.className).toContain("divide-y");
    expect(rows[0].querySelector("h2")?.textContent).toBe(posts[0].title);
    expect(rows[0].querySelector("a")?.getAttribute("href")).toContain(`/blog/${posts[0].slug}`);
    expect(rows[0].querySelector("[data-progress-key]")?.getAttribute("data-progress-key")).toBe(posts[0].slug);
    expect(rows[0].textContent).toContain(getDictionary(locale).blog.readArticle);
  });

  it.each(locales)("renders %s CertLabs articles as a list with reading progress", async (locale) => {
    const page = await CertificationsPage({ params: Promise.resolve({ lang: locale }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    const rows = root.querySelectorAll("article");
    const articles = getAllCertificationSummaries(locale);
    expect(rows).toHaveLength(articles.length);
    expect(rows[0].parentElement?.className).toContain("divide-y");
    expect(rows[0].querySelector("a")?.getAttribute("href")).toContain(`/certifications/${articles[0].slug}`);
    expect(rows[0].querySelector("[data-progress-key]")?.getAttribute("data-progress-key")).toBe(`certifications/${articles[0].slug}`);
  });
});
