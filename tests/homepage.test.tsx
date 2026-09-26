import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/[lang]/page";
import { Nav } from "@/components/nav";
import { getDictionary } from "@/lib/dictionaries";
import { locales } from "@/lib/i18n";

describe("homepage content", () => {
  it.each(locales)("uses CertLabs as the %s section name", (locale) => {
    const dict = getDictionary(locale);
    expect(dict.nav.certifications).toBe("CertLabs");
    expect(dict.home.certificationsTitle).toBe("CertLabs");
    expect(dict.certifications.title).toBe("CertLabs");
    expect(dict.about.certificationsTitle).toBe("CertLabs");
  });

  it.each(locales)("links %s readers to news and certification articles", async (locale) => {
    const dict = getDictionary(locale);
    const page = await HomePage({ params: Promise.resolve({ lang: locale }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    expect([...root.querySelectorAll("h2")].some((heading) =>
      heading.textContent === dict.home.certificationsTitle
    )).toBe(true);
    expect(root.querySelector(`a[href^="/${locale}/certifications/az-305-sql-server-cloud-migration"]`)).not.toBeNull();
    expect(root.querySelector(`a[href^="/${locale}/news"]`)?.textContent).toBe(dict.hero.readNews);
  });

  it.each(locales)("shows the News indicator in the %s menu", (locale) => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(createElement(Nav, {
      locale,
      dict: getDictionary(locale),
      switcherPath: "/",
    }));

    const news = root.querySelector(`nav a[href^="/${locale}/news"]`);
    expect(root.querySelector("nav a")?.getAttribute("href")).toBe(`/${locale}/news`);
    expect(news?.textContent).toBe(getDictionary(locale).nav.news);
    expect(news?.className).toContain("gap-2");
    expect(news?.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(`nav a[href="/${locale}/"]`)).toBeNull();
    expect(root.querySelector(`nav a[href="/${locale}/certifications"]`)?.textContent).toBe("CertLabs");
  });
});
