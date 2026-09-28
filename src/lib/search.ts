import { isLocale } from "@/lib/i18n";

/** Written next to the exported pages by scripts/build-search-index.mjs. */
export const SEARCH_BUNDLE_URL = "/pagefind/pagefind.js";

export const SEARCH_RESULT_KINDS = ["blog", "news", "principles", "certifications"] as const;
export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];

/**
 * Articles carry their section as a Pagefind filter under this name
 * (ArticleLayout in production, build-dev-search-index.mjs in dev), so a
 * section page can search only its own articles.
 */
export const SEARCH_SECTION_FILTER = "section";

/** The section an indexed page belongs to, read from its URL: /en-us/blog/x/ -> "blog". */
export function searchResultKind(url: string): SearchResultKind | null {
  const [first, second] = url.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const section = first && isLocale(first) ? second : first;
  return (SEARCH_RESULT_KINDS as readonly string[]).includes(section ?? "")
    ? (section as SearchResultKind)
    : null;
}

/** The subset of Pagefind's browser API the search dialog uses. */
export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

export interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

export interface PagefindApi {
  options: (options: { baseUrl?: string; excerptLength?: number }) => Promise<void>;
  init: () => Promise<void>;
  preload: (term: string) => Promise<void>;
  debouncedSearch: (
    term: string,
    options?: { filters?: Record<string, string> },
    debounceMs?: number
  ) => Promise<{ results: PagefindResult[] } | null>;
}
