import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEARCH_BUNDLE_URL, searchResultKind } from "@/lib/search";

describe("search index routing", () => {
  it("keeps index files away from the locale-redirect Pages Function", () => {
    // Each query fetches several index files; routed through the function,
    // every one would count as a paid invocation and add latency.
    const routes = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../src/public/_routes.json"), "utf8")
    ) as { exclude: string[] };
    const folder = SEARCH_BUNDLE_URL.split("/")[1];
    expect(routes.exclude).toContain(`/${folder}/*`);
  });
});

describe("searchResultKind", () => {
  it("reads the section from a localized URL", () => {
    expect(searchResultKind("/en-us/blog/securing-mcp-servers/")).toBe("blog");
    expect(searchResultKind("/pt-br/news/some-story/")).toBe("news");
    expect(searchResultKind("/en-us/principles/cloud/cost-optimization/")).toBe("principles");
    expect(searchResultKind("/pt-br/certifications/az-305/")).toBe("certifications");
  });

  it("ignores query strings and fragments", () => {
    expect(searchResultKind("/en-us/blog/x/#hands-on-implementation")).toBe("blog");
    expect(searchResultKind("/en-us/blog/x/?q=1")).toBe("blog");
  });

  it("returns null for pages outside the indexed sections", () => {
    expect(searchResultKind("/en-us/about/")).toBeNull();
    expect(searchResultKind("/en-us/")).toBeNull();
    expect(searchResultKind("/")).toBeNull();
  });
});
