// Stock ticker data for the news page. Shared by the Pages Function
// (functions/api/quotes.ts), the dev snapshot script and the ticker UI, so
// it must stay free of `@/` imports: the Functions bundler doesn't know the
// alias.

/** Large-cap technology companies, in display order. */
export const TICKER_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO",
  "TSM", "ORCL", "AMD", "NFLX", "CRM", "ADBE", "IBM", "INTC",
] as const;

/** Served by functions/api/quotes.ts in production. */
export const QUOTES_URL = "/api/quotes";
/** Written to public/ by scripts/build-dev-quotes.mjs for `next dev`, which runs no Functions. */
export const DEV_QUOTES_URL = "/dev-quotes.json";

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface QuotesPayload {
  /** Epoch milliseconds when the quotes were fetched. */
  updatedAt: number;
  quotes: Quote[];
}

interface FinnhubQuote {
  c?: number;
  d?: number | null;
  dp?: number | null;
}

/** Finnhub answers unknown symbols with zeros and nulls instead of an error. */
export function parseFinnhubQuote(symbol: string, raw: FinnhubQuote): Quote | null {
  if (!raw.c || raw.d == null || raw.dp == null) return null;
  return { symbol, price: raw.c, change: raw.d, changePercent: raw.dp };
}

export async function fetchFinnhubQuotes(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<QuotesPayload> {
  const quotes = await Promise.all(
    TICKER_SYMBOLS.map(async (symbol) => {
      try {
        const res = await fetchImpl(`https://finnhub.io/api/v1/quote?symbol=${symbol}`, {
          headers: { "X-Finnhub-Token": token },
        });
        return res.ok ? parseFinnhubQuote(symbol, (await res.json()) as FinnhubQuote) : null;
      } catch {
        return null;
      }
    })
  );
  const valid = quotes.filter((q): q is Quote => q !== null);
  if (!valid.length) throw new Error("finnhub: no quotes returned");
  return { updatedAt: Date.now(), quotes: valid };
}
