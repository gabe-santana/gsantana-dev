// Browser side of access insights: ids, the page view being measured, and the
// beacons. Whether anything is stored is the server's call (the flag lives in
// the Pages env), so this always sends.
import { INSIGHTS_API, SESSION_IDLE_MS, type InsightsPayload } from "./access-insights";

const VISITOR_KEY = "gsantana_visitor";
const SESSION_KEY = "gsantana_visit";

type ClarityFn = (...args: unknown[]) => void;

interface ClarityIds {
  userId?: string;
  sessionId?: string;
  pageNum?: number;
}

export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the ids just won't survive the page.
  }
}

export function visitorId(): string {
  const existing = storageGet(VISITOR_KEY);
  if (existing) return existing;
  const id = randomId();
  storageSet(VISITOR_KEY, id);
  return id;
}

/** The current visit, renewed after SESSION_IDLE_MS without a page view. */
export function touchSession(now = Date.now()): { id: string; isNew: boolean } {
  let session: { id: string; last: number } | null = null;
  try {
    session = JSON.parse(storageGet(SESSION_KEY) ?? "null");
  } catch {
    session = null;
  }
  const isNew = !session?.id || now - session.last > SESSION_IDLE_MS;
  const id = isNew ? randomId() : session!.id;
  storageSet(SESSION_KEY, JSON.stringify({ id, last: now }));
  return { id, isNew };
}

function cookieValue(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Clarity's ids from its first-party cookies: _clck is `userId|2|expiry|...`,
 * _clsk is `sessionId|timestamp|pageNum|...`. The metadata callback is the
 * primary source; the cookies cover the moments before it fires.
 */
export function clarityIdsFromCookies(): ClarityIds {
  const user = cookieValue("_clck")?.split(/[|^]/);
  const session = cookieValue("_clsk")?.split(/[|^]/);
  const pageNum = Number(session?.[2]);
  return {
    userId: user?.[0] || undefined,
    sessionId: session?.[0] || undefined,
    pageNum: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : undefined,
  };
}

let clarityIds: ClarityIds = {};

/**
 * Links both sides: our ids go into Clarity (a custom user id and tags you can
 * filter recordings by), and Clarity's ids come back into every beacon.
 */
export function linkClarity(ids: { visitorId: string; sessionId: string; viewId: string }): void {
  const clarity = (window as Window & { clarity?: ClarityFn }).clarity;
  if (!clarity) return;
  clarity("identify", ids.visitorId, ids.sessionId, ids.viewId);
  clarity("set", "gs_visitor", ids.visitorId);
  clarity("set", "gs_view", ids.viewId);
  clarity(
    "metadata",
    (meta: { userId?: string; sessionId?: string; pageNum?: number }) => {
      clarityIds = { userId: meta.userId, sessionId: meta.sessionId, pageNum: meta.pageNum };
    },
    false,
    true
  );
}

function currentClarityIds(): ClarityIds {
  const fromCookies = clarityIdsFromCookies();
  return {
    userId: clarityIds.userId ?? fromCookies.userId,
    sessionId: clarityIds.sessionId ?? fromCookies.sessionId,
    pageNum: clarityIds.pageNum ?? fromCookies.pageNum,
  };
}

function navigationTiming(): { ttfbMs?: number; loadMs?: number } {
  const [nav] = performance.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined ?? [];
  if (!nav) return {};
  return {
    ttfbMs: nav.responseStart > 0 ? Math.round(nav.responseStart) : undefined,
    loadMs: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : undefined,
  };
}

function deviceInfo(): Partial<InsightsPayload> {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };
  return {
    screenW: screen.width,
    screenH: screen.height,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    connection: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
    cpuCores: navigator.hardwareConcurrency,
    touch: navigator.maxTouchPoints > 0,
  };
}

/** One page view: counts visible time and the deepest scroll until it ends. */
export class PageView {
  readonly id = randomId();
  /** Fixed at the start: by the time a client-side navigation ends this view, location already shows the next page. */
  readonly url = window.location.pathname + window.location.search;
  private readonly startedAt = Date.now();
  private activeMs = 0;
  private visibleSince: number | null;
  private maxScrollPct = 0;

  constructor(
    private readonly ids: { visitorId: string; sessionId: string },
    private readonly landing: boolean,
    private readonly referrer: string,
    private readonly firstLoad: boolean
  ) {
    this.visibleSince = document.visibilityState === "visible" ? this.startedAt : null;
    this.measureScroll();
  }

  visibilityChanged(): void {
    const now = Date.now();
    if (document.visibilityState === "visible") {
      this.visibleSince ??= now;
    } else if (this.visibleSince !== null) {
      this.activeMs += now - this.visibleSince;
      this.visibleSince = null;
    }
  }

  measureScroll(): void {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable <= 0 ? 100 : ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
    this.maxScrollPct = Math.max(this.maxScrollPct, Math.min(100, Math.round(pct)));
  }

  payload(): InsightsPayload {
    const now = Date.now();
    const clarity = currentClarityIds();
    return {
      id: this.id,
      visitorId: this.ids.visitorId,
      sessionId: this.ids.sessionId,
      landing: this.landing,
      url: this.url,
      title: window.location.pathname + window.location.search === this.url ? document.title : undefined,
      locale: document.documentElement.lang,
      referrer: this.referrer || undefined,
      ...deviceInfo(),
      // Timing only describes a full page load, not a client-side navigation.
      ...(this.firstLoad ? navigationTiming() : {}),
      activeMs: this.activeMs + (this.visibleSince === null ? 0 : now - this.visibleSince),
      totalMs: now - this.startedAt,
      maxScrollPct: this.maxScrollPct,
      clarityUserId: clarity.userId,
      claritySessionId: clarity.sessionId,
      clarityPageNum: clarity.pageNum,
    };
  }
}

/**
 * sendBeacon survives the page unloading. text/plain keeps it a "simple"
 * request, which every browser sends without a preflight; the server parses
 * the JSON either way.
 */
export function sendInsights(payload: InsightsPayload): void {
  const body = JSON.stringify(payload);
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(INSIGHTS_API, new Blob([body], { type: "text/plain" }))) {
    return;
  }
  void fetch(INSIGHTS_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    credentials: "same-origin",
    body,
    keepalive: true,
  }).catch(() => undefined);
}
