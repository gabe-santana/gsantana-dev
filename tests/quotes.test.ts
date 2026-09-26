import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../src/functions/api/quotes";
import { fetchFinnhubQuotes, parseFinnhubQuote, TICKER_SYMBOLS } from "@/lib/quotes";

describe("parseFinnhubQuote", () => {
  it("maps Finnhub's short keys", () => {
    expect(parseFinnhubQuote("NVDA", { c: 225.07, d: 0.49, dp: 0.2182 })).toEqual({
      symbol: "NVDA",
      price: 225.07,
      change: 0.49,
      changePercent: 0.2182,
    });
  });

  it("drops unknown symbols, which Finnhub returns as zeros and nulls", () => {
    expect(parseFinnhubQuote("NOPE", { c: 0, d: null, dp: null })).toBeNull();
  });
});

function fakeFetch(handler: (symbol: string) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get("X-Finnhub-Token")).toBe("secret");
    return handler(new URL(String(input)).searchParams.get("symbol")!);
  }) as unknown as typeof fetch;
}

const okQuote = () => Response.json({ c: 100, d: 1, dp: 1 });

describe("fetchFinnhubQuotes", () => {
  it("asks for every symbol, sending the key as a header, not in the URL", async () => {
    const fetchImpl = fakeFetch(okQuote);
    const payload = await fetchFinnhubQuotes("secret", fetchImpl);
    expect(payload.quotes.map((q) => q.symbol)).toEqual([...TICKER_SYMBOLS]);
    for (const [url] of vi.mocked(fetchImpl).mock.calls) expect(String(url)).not.toContain("secret");
  });

  it("keeps the symbols that worked when some fail", async () => {
    const payload = await fetchFinnhubQuotes(
      "secret",
      fakeFetch((symbol) => (symbol === "AAPL" ? new Response(null, { status: 429 }) : okQuote()))
    );
    expect(payload.quotes).toHaveLength(TICKER_SYMBOLS.length - 1);
    expect(payload.quotes.some((q) => q.symbol === "AAPL")).toBe(false);
  });

  it("fails when nothing came back, so the caller can serve its cache", async () => {
    await expect(
      fetchFinnhubQuotes("secret", fakeFetch(() => new Response(null, { status: 500 })))
    ).rejects.toThrow();
  });
});

describe("GET /api/quotes", () => {
  const store = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const context = () => ({
    env: { FINNHUB_API_KEY: "secret" },
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
  });
  const settle = () => Promise.all(pending.splice(0));

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("caches", {
      default: {
        match: async (key: string) => store.get(key)?.clone(),
        put: async (key: string, res: Response) => void store.set(key, res.clone()),
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches once, then serves the edge cache while it's fresh", async () => {
    const upstream = vi.fn(okQuote);
    vi.stubGlobal("fetch", fakeFetch(upstream));

    const first = await onRequestGet(context());
    await settle();
    const second = await onRequestGet(context());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(TICKER_SYMBOLS.length);
    expect(second.headers.get("Cache-Control")).toMatch(/max-age=\d+/);
  });

  it("serves the last good quotes when Finnhub is down after the cache expires", async () => {
    vi.stubGlobal("fetch", fakeFetch(okQuote));
    await onRequestGet(context());
    await settle();

    vi.useFakeTimers({ now: Date.now() + 10 * 60 * 1000 });
    vi.stubGlobal("fetch", fakeFetch(() => new Response(null, { status: 500 })));
    const res = await onRequestGet(context());

    expect(res.status).toBe(200);
    expect((await res.json()).quotes).toHaveLength(TICKER_SYMBOLS.length);
  });

  it("answers 503 with nothing cached and no key", async () => {
    const res = await onRequestGet({ env: {}, waitUntil: () => undefined });
    expect(res.status).toBe(503);
  });
});
