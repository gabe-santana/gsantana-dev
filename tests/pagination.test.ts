import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { locales } from "@/lib/i18n";
import { laterPageParams, PAGE_SIZE, pageCount, pageItems, pagePath, parsePage } from "@/lib/pagination";

describe("pagination", () => {
  it("keeps page 1 at the list's own URL", () => {
    expect(pagePath("/blog", 1)).toBe("/blog");
    expect(pagePath("/blog", 2)).toBe("/blog/page/2");
  });

  it("counts at least one page, even for an empty list", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
  });

  it("slices the items of a page", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(pageItems(items, 1, 10)).toEqual(items.slice(0, 10));
    expect(pageItems(items, 3, 10)).toEqual([20, 21, 22, 23, 24]);
  });

  it("generates a route for every page after the first", () => {
    expect(laterPageParams(25, 10)).toEqual([{ page: "2" }, { page: "3" }]);
    expect(laterPageParams(5, 10)).toEqual([]);
  });

  it("accepts only the later pages that exist", () => {
    expect(parsePage("2", 25, 10)).toBe(2);
    expect(parsePage("3", 25, 10)).toBe(3);
    for (const value of ["1", "4", "0", "02", "2.5", "abc", ""]) {
      expect(parsePage(value, 25, 10)).toBeNull();
    }
  });
});

describe("CertLabs pagination", () => {
  // A static export refuses a dynamic route with no pages to generate, so
  // certifications/page/[page] only exists once CertLabs needs a second page.
  it("has a page route whenever CertLabs needs more than one page", () => {
    const route = path.resolve(__dirname, "../src/app/[lang]/certifications/page/[page]/page.tsx");
    const needsRoute = locales.some(
      (locale) => pageCount(getAllCertificationSummaries(locale).length, PAGE_SIZE.certifications) > 1
    );
    expect(
      fs.existsSync(route),
      "CertLabs outgrew one page: add certifications/page/[page]/page.tsx (copy blog/page/[page])"
    ).toBe(needsRoute);
  });
});
