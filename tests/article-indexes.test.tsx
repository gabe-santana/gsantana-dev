import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BlogIndexPage from "@/app/[lang]/blog/page";
import BlogPage, { generateStaticParams as blogPageParams } from "@/app/[lang]/blog/page/[page]/page";
import CertificationsPage from "@/app/[lang]/certifications/page";
import NewsPage from "@/app/[lang]/news/page";
import NewsLaterPage, { generateStaticParams as newsPageParams } from "@/app/[lang]/news/page/[page]/page";
import PrinciplesPage from "@/app/[lang]/principles/page";
import PrinciplesLaterPage, {
  generateStaticParams as principlesPageParams,
} from "@/app/[lang]/principles/page/[page]/page";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { getDictionary } from "@/lib/dictionaries";
import { locales, type Locale } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { newsStories } from "@/lib/news";
import { PAGE_SIZE } from "@/lib/pagination";
import { getAllPrinciples } from "@/lib/principles";

vi.mock("@/components/post-card-progress", () => ({
  PostCardProgress: ({ slug }: { slug: string }) =>
    createElement("span", { "data-progress-key": slug }),
}));

function render(node: React.ReactNode): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(node);
  return root;
}

function links(root: HTMLElement, selector: string): string[] {
  return Array.from(root.querySelectorAll(selector), (link) => link.getAttribute("href") ?? "");
}

type LaterPage = (props: { params: Promise<{ lang: string; page: string }> }) => Promise<React.ReactNode>;

async function laterPages(page: LaterPage, params: { lang: string; page: string }[], locale: Locale) {
  const pages = params.filter((p) => p.lang === locale);
  return Promise.all(pages.map(async (p) => render(await page({ params: Promise.resolve(p) }))));
}

describe("article indexes", () => {
  it.each(locales)("features the Gemini 4 Argon story, then the DevDay story, in %s news without duplicating stories", async (locale) => {
    const page = await NewsPage({ params: Promise.resolve({ lang: locale }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    const first = links(root, "article a");
    expect(first[0]).toBe(`/${locale}/news/mistral-large-4`);
    expect(first[1]).toBe(`/${locale}/news/google-gemini-4-argon`);

    const rest = (await laterPages(NewsLaterPage, newsPageParams(), locale)).flatMap((r) => links(r, "article a"));
    const all = [...first, ...rest];
    expect(all).toHaveLength(newsStories.length);
    expect(new Set(all).size).toBe(newsStories.length);
  });

  it.each(locales)("keeps the %s news front page on page 1 only", async (locale) => {
    const [second] = await laterPages(NewsLaterPage, newsPageParams(), locale);
    expect(second).toBeDefined();
    expect(second!.querySelector("#news-lead")).toBeNull();
    expect(second!.querySelectorAll("article").length).toBeLessThanOrEqual(PAGE_SIZE.news);
  });

  it.each(locales)("splits %s blog posts across pages with no post left out", async (locale) => {
    const first = render(await BlogIndexPage({ params: Promise.resolve({ lang: locale }) }));
    const pages = [first, ...(await laterPages(BlogPage, blogPageParams(), locale))];
    const posts = getAllPostSummaries(locale);
    for (const page of pages) expect(page.querySelectorAll("article").length).toBeLessThanOrEqual(PAGE_SIZE.blog);
    expect(pages.flatMap((page) => links(page, "article > a"))).toEqual(
      posts.map((post) => `/${locale}/blog/${post.slug}`)
    );
    expect(first.querySelector('nav a[aria-current="page"]')?.textContent).toBe(pages.length > 1 ? "1" : undefined);
  });

  it.each(locales)("splits %s principles across pages with no principle left out", async (locale) => {
    const first = render(await PrinciplesPage({ params: Promise.resolve({ lang: locale }) }));
    const pages = [first, ...(await laterPages(PrinciplesLaterPage, principlesPageParams(), locale))];
    const count = pages.reduce((sum, page) => sum + page.querySelectorAll("section .grid > *").length, 0);
    expect(count).toBe(getAllPrinciples(locale).length);
  });

  it.each(locales)("renders %s blog posts as a list with reading progress", async (locale) => {
    const page = await BlogIndexPage({ params: Promise.resolve({ lang: locale }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    const rows = root.querySelectorAll("article");
    const posts = getAllPostSummaries(locale);
    expect(rows).toHaveLength(Math.min(posts.length, PAGE_SIZE.blog));
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
