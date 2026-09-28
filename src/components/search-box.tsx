"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { format } from "@/lib/dictionaries";
import type { Dictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import {
  SEARCH_BUNDLE_URL,
  searchResultKind,
  type PagefindApi,
  type SearchResultKind,
  type PagefindResult,
  type PagefindResultData,
  SEARCH_SECTION_FILTER,
} from "@/lib/search";

const PAGE_SIZE = 8;

// Pagefind picks its per-language index from <html lang> when it
// initializes, and the language switcher changes that attribute without a
// reload, so the instance is keyed by locale and rebuilt when it changes.
let pagefindInstance: { locale: Locale; api: Promise<PagefindApi> } | null = null;

function loadPagefind(locale: Locale): Promise<PagefindApi> {
  if (pagefindInstance?.locale === locale) return pagefindInstance.api;
  const previous = pagefindInstance;
  const api = (async () => {
    const mod = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ SEARCH_BUNDLE_URL
    )) as PagefindApi & { destroy?: () => Promise<void> };
    if (previous) await mod.destroy?.();
    await mod.options({ excerptLength: 24 });
    await mod.init();
    return mod;
  })();
  pagefindInstance = { locale, api };
  api.catch(() => {
    if (pagefindInstance?.api === api) pagefindInstance = null;
  });
  return api;
}

type Status = "idle" | "loading" | "done" | "error";

interface SearchBoxProps {
  locale: Locale;
  labels: Dictionary["search"];
  /** Limits results to one section (its list page); the landing page searches everything. */
  section?: SearchResultKind;
  className?: string;
}

export function SearchBox({ locale, labels, section, className = "mx-auto w-full max-w-3xl" }: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchId = useRef(0);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [items, setItems] = useState<PagefindResultData[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      const combo = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
      if (combo || (event.key === "/" && !typing)) {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    const id = ++searchId.current;
    if (!term) {
      setStatus("idle");
      setResults([]);
      setItems([]);
      return;
    }
    setStatus("loading");
    (async () => {
      try {
        const pagefind = await loadPagefind(locale);
        const filters = section ? { filters: { [SEARCH_SECTION_FILTER]: section } } : {};
        const search = await pagefind.debouncedSearch(term, filters, 200);
        // null means a newer keystroke superseded this search.
        if (!search || id !== searchId.current) return;
        const first = await Promise.all(search.results.slice(0, PAGE_SIZE).map((r) => r.data()));
        if (id !== searchId.current) return;
        setResults(search.results);
        setItems(first);
        setActive(-1);
        setStatus("done");
      } catch {
        if (id === searchId.current) setStatus("error");
      }
    })();
  }, [query, locale, section]);

  async function loadMore() {
    const id = searchId.current;
    const next = await Promise.all(
      results.slice(items.length, items.length + PAGE_SIZE).map((r) => r.data())
    );
    if (id === searchId.current) setItems((current) => [...current, ...next]);
  }

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    // In a search field Chrome spends Escape clearing the text; do the same
    // for our state so the results go away too.
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      return;
    }
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      listRef.current
        ?.querySelector<HTMLAnchorElement>(`[data-index="${Math.max(active, 0)}"] a`)
        ?.click();
    }
  }

  const count =
    results.length === 1 ? labels.resultOne : format(labels.resultMany, { count: results.length });
  const showList = items.length > 0 && status !== "error" && status !== "idle";

  return (
    <div role="search" className={className}>
      <label
        className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/80 px-5 shadow-[0_0_0_1px_transparent] backdrop-blur transition-colors focus-within:border-accent/60 focus-within:shadow-[0_0_24px_-6px_var(--color-accent)]"
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-muted transition-colors group-focus-within:text-accent" />
        <span className="sr-only">{labels.label}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKey}
          onFocus={() => loadPagefind(locale).catch(() => undefined)}
          placeholder={section ? labels.sections[section] : labels.placeholder}
          aria-controls={listId}
          aria-activedescendant={active >= 0 && items.length ? `${listId}-${active}` : undefined}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className="h-14 w-full bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none sm:h-16 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden
          className="hidden shrink-0 rounded border border-border/70 px-1.5 font-mono text-xs leading-5 text-muted sm:inline"
        >
          /
        </kbd>
      </label>

      <div aria-live="polite">
        {status === "loading" && !items.length ? (
          <p className="px-5 py-6 text-sm text-muted">{labels.loading}</p>
        ) : null}
        {status === "error" ? <p className="px-5 py-6 text-sm text-muted">{labels.unavailable}</p> : null}
        {status === "done" && !results.length ? (
          <p className="px-5 py-6 text-sm text-muted">
            {format(labels.noResults, { query: query.trim() })}
          </p>
        ) : null}
        {showList ? (
          <p className="px-5 pb-1 pt-5 font-mono text-[0.7rem] uppercase tracking-wider text-muted">{count}</p>
        ) : null}
      </div>

      {showList ? (
        <>
          <ul ref={listRef} id={listId} role="listbox" className="divide-y divide-border/50">
            {items.map((item, index) => {
              // A section page's results are all one kind, so the label would only repeat.
              const kind = section ? null : searchResultKind(item.url);
              return (
                <li
                  key={item.url}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                >
                  <Link
                    href={item.url}
                    onMouseMove={() => setActive(index)}
                    className={`block rounded-xl px-5 py-4 transition-colors ${
                      index === active ? "bg-accent/10" : ""
                    }`}
                  >
                    {kind ? (
                      <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-accent">
                        {labels.types[kind]}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block font-semibold leading-snug text-foreground">
                      {item.meta.title ?? item.url}
                    </span>
                    <span
                      className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-accent"
                      // Pagefind escapes page text and only adds <mark> around matches.
                      dangerouslySetInnerHTML={{ __html: item.excerpt }}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          {items.length < results.length ? (
            <button
              type="button"
              onClick={loadMore}
              className="mt-3 w-full rounded-xl border border-border/70 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {labels.loadMore}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
