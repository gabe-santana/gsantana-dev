import { describe, expect, it } from "vitest";
import { format, getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath, locales, switchLocalePath } from "@/lib/i18n";
import { getPostSlugs } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

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

  it("has every principle in every locale", () => {
    const [base, ...others] = locales.map((l) =>
      getAllPrinciples(l)
        .map((p) => p.key)
        .sort()
    );
    for (const other of others) expect(other).toEqual(base);
  });
});
