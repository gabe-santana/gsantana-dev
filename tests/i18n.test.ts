import { describe, expect, it } from "vitest";
import { format, getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath, locales, switchLocalePath } from "@/lib/i18n";
import { getAllPostSummaries, getPostSlugs } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { newsStories } from "@/lib/news";
import { getAllCertificationSummaries, getCertificationSlugs } from "@/lib/certifications";

describe("locale paths", () => {
  it("prefixes paths with the locale", () => {
    expect(localePath("pt-br")).toBe("/pt-br");
    expect(localePath("en-us", "/blog/x")).toBe("/en-us/blog/x");
    expect(localePath("en-us", "blog")).toBe("/en-us/blog");
  });

  it("swaps only the locale segment, keeping the rest of the path", () => {
    expect(switchLocalePath("/en-us/blog/my-post/", "pt-br")).toBe("/pt-br/blog/my-post/");
    expect(switchLocalePath("/pt-br", "en-us")).toBe("/en-us");
    expect(switchLocalePath("/about", "pt-br")).toBe("/pt-br/about");
  });

  it("recognizes only supported locales", () => {
    expect(isLocale("pt-br")).toBe(true);
    expect(isLocale("fr-fr")).toBe(false);
  });
});

describe("dictionaries", () => {
  // The Dictionary type already guarantees identical keys at compile time;
  // this catches what types can't: blank strings and mismatched lists.
  function leaves(value: unknown, path = ""): [string, unknown][] {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
    }
    return [[path, value]];
  }

  it.each(locales)("%s has no empty strings", (locale) => {
    for (const [path, value] of leaves(getDictionary(locale))) {
      if (Array.isArray(value)) expect(value.length, path).toBeGreaterThan(0);
      else expect(String(value).trim(), path).not.toBe("");
    }
  });

  it("uses the same placeholders in every locale", () => {
    const placeholders = (s: unknown) => (String(s).match(/\{\w+\}/g) ?? []).sort();
    const [base, ...others] = locales.map((l) => new Map(leaves(getDictionary(l))));
    for (const other of others) {
      for (const [path, value] of base!) {
        expect(placeholders(other.get(path)), path).toEqual(placeholders(value));
      }
    }
  });

  it("has the same number of 404 chest messages in every locale", () => {
    // The game picks one index and shows that line in every language.
    const counts = locales.map((l) => getDictionary(l).notFound.game.chests.length);
    expect(new Set(counts).size).toBe(1);
  });

  it("fills placeholders", () => {
    expect(format("{minutes} min read", { minutes: 5 })).toBe("5 min read");
    expect(format("{unknown} stays", {})).toBe("{unknown} stays");
  });
});

describe("content parity", () => {
  // The language switcher keeps the slug, so every article must exist in
  // every locale or switching would land on a 404.
  it("has every post in every locale", () => {
    const [base, ...others] = locales.map((l) => getPostSlugs(l).sort());
    for (const other of others) expect(other).toEqual(base);
  });

  it("localizes post, principle, and certification titles without changing their keys", () => {
    const titles = (locale: (typeof locales)[number]) =>
      new Map([
        ...getAllPostSummaries(locale).map((post) => [post.slug, post.title] as const),
        ...getAllPrinciples(locale).map((principle) => [principle.key, principle.title] as const),
        ...getAllCertificationSummaries(locale).map((article) => [`certifications/${article.slug}`, article.title] as const),
      ]);
    const english = titles("en-us");
    const portuguese = titles("pt-br");

    expect([...portuguese.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [key, title] of portuguese) {
      expect(title.trim(), key).not.toBe("");
      expect(title, key).not.toBe(english.get(key));
    }
  });

  it("has the same number of TL;DR takeaways for a post in every locale", () => {
    const counts = (l: (typeof locales)[number]) =>
      Object.fromEntries(getAllPostSummaries(l).map((p) => [p.slug, p.tldr?.length ?? 0]));
    const [base, ...others] = locales.map(counts);
    for (const other of others) expect(other).toEqual(base);
  });

  it("has every principle in every locale", () => {
    const [base, ...others] = locales.map((l) =>
      getAllPrinciples(l)
        .map((p) => p.key)
        .sort()
    );
    for (const other of others) expect(other).toEqual(base);
  });

  it("has every certification article in every locale with the same media", () => {
    const [base, ...others] = locales.map((l) => getCertificationSlugs(l).sort());
    expect(base.length).toBeGreaterThan(0);
    for (const other of others) expect(other).toEqual(base);

    for (const slug of base) {
      const versions = locales.map((l) => getAllCertificationSummaries(l).find((article) => article.slug === slug)!);
      expect(versions[0].videoEmbed).toBe(versions[1].videoEmbed);
      expect(versions[0].sourceUrl).toBe(versions[1].sourceUrl);
      expect(versions[0].exam).toBe(versions[1].exam);
      expect(versions[0].kind).toBe(versions[1].kind);
    }
  });

  it("has English and Portuguese versions of every news story", () => {
    expect(newsStories.length).toBeGreaterThanOrEqual(10);
    expect(new Set(newsStories.map((story) => story.slug)).size).toBe(newsStories.length);
    for (const story of newsStories) {
      for (const locale of locales) {
        const copy = story.copy[locale];
        expect(copy.title.trim(), `${story.slug}/${locale} title`).not.toBe("");
        expect(copy.summary.trim(), `${story.slug}/${locale} summary`).not.toBe("");
        expect(copy.body.length, `${story.slug}/${locale} body`).toBeGreaterThan(0);
        expect(copy.analysis.trim(), `${story.slug}/${locale} analysis`).not.toBe("");
        for (const paragraph of copy.body) {
          expect(paragraph.trim(), `${story.slug}/${locale} paragraph`).not.toBe("");
        }
      }
      expect(story.copy["pt-br"].title, story.slug).not.toBe(story.copy["en-us"].title);
      expect(story.sources.length, `${story.slug} supporting sources`).toBeGreaterThanOrEqual(2);
    }
  });
});
