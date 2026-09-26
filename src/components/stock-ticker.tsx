"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/lib/dictionaries";
import { DEV_QUOTES_URL, QUOTES_URL, type Quote, type QuotesPayload } from "@/lib/quotes";

const REFRESH_MS = 5 * 60 * 1000;
const url = process.env.NODE_ENV === "development" ? DEV_QUOTES_URL : QUOTES_URL;

function QuoteItem({ quote, numbers, percent }: { quote: Quote; numbers: Intl.NumberFormat; percent: Intl.NumberFormat }) {
  const up = quote.change >= 0;
  return (
    <span className="flex shrink-0 items-baseline gap-2 font-mono text-xs">
      <span className="font-semibold text-foreground">{quote.symbol}</span>
      <span className="text-muted">{numbers.format(quote.price)}</span>
      <span className={up ? "text-emerald-400" : "text-red-400"}>
        <span aria-hidden>{up ? "▲" : "▼"}</span> {percent.format(quote.changePercent / 100)}
      </span>
    </span>
  );
}

export function StockTicker({ labels, localeTag }: { labels: Dictionary["ticker"]; localeTag: string }) {
  const [data, setData] = useState<QuotesPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as QuotesPayload;
        if (!cancelled && payload.quotes?.length) setData(payload);
      } catch {
        // A failed refresh keeps the quotes already on screen.
        if (!cancelled) setFailed(true);
      }
    }
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // No data at all (dev without a key, Finnhub down with nothing cached):
  // hide the strip instead of showing an empty bar.
  if (failed && !data) return null;

  const numbers = new Intl.NumberFormat(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(localeTag, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });
  return (
    <section aria-label={labels.label} className="relative mt-4 border border-border bg-surface/60">
      <div className="flex h-9 items-stretch">
        <p className="z-10 flex shrink-0 items-center gap-2 border-r border-border bg-background/80 px-4 font-mono text-[11px] uppercase text-accent">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
          {labels.badge}
        </p>

        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)] motion-reduce:overflow-x-auto">
          {data ? (
            <div className="flex h-full w-max items-center motion-safe:animate-ticker motion-safe:hover:[animation-play-state:paused]">
              {/* Two copies so the -50% loop is seamless; the second is decorative. */}
              {[0, 1].map((copy) => (
                <ul
                  key={copy}
                  aria-hidden={copy === 1 || undefined}
                  className="flex shrink-0 items-center gap-8 pr-8"
                >
                  {data.quotes.map((quote) => (
                    <li key={quote.symbol}>
                      <QuoteItem quote={quote} numbers={numbers} percent={percent} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          ) : (
            <div aria-hidden className="flex h-full items-center gap-8 px-4">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="h-2.5 w-28 shrink-0 animate-pulse rounded-sm bg-border/60" />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
