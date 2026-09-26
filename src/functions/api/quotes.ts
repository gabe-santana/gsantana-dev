// Cloudflare Pages Function: GET /api/quotes, the news page's stock ticker.
// Fetches from Finnhub server-side so the API key (secret FINNHUB_API_KEY in
// the Pages project) never reaches the browser, and caches the result at the
// edge: however many visitors arrive, Finnhub sees one refresh per
// FRESH_SECONDS per data center (16 calls, under the free plan's 60/min).
import { fetchFinnhubQuotes, type QuotesPayload } from "../../lib/quotes";

const FRESH_SECONDS = 300;
// Kept much longer than FRESH_SECONDS so a Finnhub outage serves the last
// good quotes instead of an empty ticker.
const STALE_SECONDS = 60 * 60 * 24;
const CACHE_KEY = "https://gsantana.dev/__cache/api-quotes-v1";

interface QuotesContext {
  env: { FINNHUB_API_KEY?: string };
  waitUntil: (promise: Promise<unknown>) => void;
}

function json(payload: QuotesPayload, maxAge: number): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

export async function onRequestGet({ env, waitUntil }: QuotesContext): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(CACHE_KEY);
  const cachedPayload = cached ? ((await cached.json()) as QuotesPayload) : null;
  const age = cachedPayload ? (Date.now() - cachedPayload.updatedAt) / 1000 : Infinity;

  if (cachedPayload && age < FRESH_SECONDS) {
    return json(cachedPayload, Math.max(30, Math.round(FRESH_SECONDS - age)));
  }

  try {
    if (!env.FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY is not set");
    const payload = await fetchFinnhubQuotes(env.FINNHUB_API_KEY);
    const stored = json(payload, STALE_SECONDS);
    waitUntil(cache.put(CACHE_KEY, stored));
    return json(payload, FRESH_SECONDS);
  } catch {
    if (cachedPayload) return json(cachedPayload, 60);
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
