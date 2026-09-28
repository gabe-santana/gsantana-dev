// Server side of access insights (POST /api/insights). The handler takes a
// standard Request, so it runs as a Pages Function (D1) and as the `next dev`
// stand-in (in memory). Relative imports only (Pages Functions bundler).
import type { D1Like } from "./d1";
import {
  classifyReferrer,
  MAX_INSIGHTS_BODY_BYTES,
  parseUserAgent,
  type InsightsPayload,
} from "./access-insights";
import { isSameOrigin } from "./user-server";

/** The request.cf fields Cloudflare fills in from the visitor's IP. */
export interface VisitorCf {
  country?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  continent?: string;
  asn?: number;
  asOrganization?: string;
  colo?: string;
  httpProtocol?: string;
  tlsVersion?: string;
}

export type PageViewRow = Record<(typeof PAGE_VIEW_COLUMNS)[number], string | number | null>;

export interface AccessStore {
  /** Inserts the view, or updates the metrics of one already sent by the same visitor. */
  upsertPageView(row: PageViewRow): Promise<void>;
}

export interface AccessDeps {
  /** FLAG_TRACK_USER_ACCESS is exactly "true". */
  enabled: boolean;
  /** TRACK_USER_ACCESS_BLACK_LIST, parsed. */
  blacklist: Set<string>;
  store: AccessStore;
  now: number;
  /** GitHub login of the signed-in reader, if any. */
  login(request: Request): Promise<string | null>;
  cf?: VisitorCf;
}

export const PAGE_VIEW_COLUMNS = [
  "id",
  "visitor_id",
  "session_id",
  "is_landing",
  "created_at",
  "updated_at",
  "ip",
  "country",
  "region",
  "region_code",
  "city",
  "postal_code",
  "latitude",
  "longitude",
  "cf_timezone",
  "continent",
  "asn",
  "as_organization",
  "colo",
  "http_protocol",
  "tls_version",
  "user_agent",
  "browser",
  "browser_version",
  "os",
  "device_type",
  "accept_language",
  "host",
  "path",
  "query",
  "page_title",
  "page_locale",
  "referrer",
  "source",
  "referrer_source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "click_id",
  "screen_w",
  "screen_h",
  "viewport_w",
  "viewport_h",
  "pixel_ratio",
  "color_scheme",
  "browser_language",
  "browser_timezone",
  "connection",
  "device_memory",
  "cpu_cores",
  "touch",
  "ttfb_ms",
  "load_ms",
  "active_ms",
  "total_ms",
  "max_scroll_pct",
  "clarity_user_id",
  "clarity_session_id",
  "clarity_page_num",
  "github_login",
] as const;

// Columns a later beacon for the same view may change. Metrics only grow, an
// id once known is never erased by a beacon without it, and the title takes
// the latest value (after a client-side navigation the first beacon can still
// see the previous page's title).
const GROWING = ["active_ms", "total_ms", "max_scroll_pct"] as const;
const LATEST = ["page_title"] as const;
const KEEP_FIRST_KNOWN = [
  "ttfb_ms",
  "load_ms",
  "clarity_user_id",
  "clarity_session_id",
  "clarity_page_num",
  "github_login",
] as const;

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function int(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function real(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function coordinate(value: string | undefined): number | null {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Validates the beacon; null when it isn't one of ours. */
export function sanitizeInsights(input: unknown): InsightsPayload | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const ids = [p.id, p.visitorId, p.sessionId];
  if (!ids.every((id) => typeof id === "string" && ID_PATTERN.test(id))) return null;
  const url = text(p.url, 2048);
  if (!url || !url.startsWith("/")) return null;
  return {
    id: p.id as string,
    visitorId: p.visitorId as string,
    sessionId: p.sessionId as string,
    landing: p.landing === true,
    url,
    title: text(p.title, 300) ?? undefined,
    locale: text(p.locale, 16) ?? undefined,
    referrer: text(p.referrer, 2048) ?? undefined,
    screenW: int(p.screenW, 0, 20000) ?? undefined,
    screenH: int(p.screenH, 0, 20000) ?? undefined,
    viewportW: int(p.viewportW, 0, 20000) ?? undefined,
    viewportH: int(p.viewportH, 0, 20000) ?? undefined,
    pixelRatio: real(p.pixelRatio, 0, 16) ?? undefined,
    colorScheme: text(p.colorScheme, 8) ?? undefined,
    language: text(p.language, 64) ?? undefined,
    timezone: text(p.timezone, 64) ?? undefined,
    connection: text(p.connection, 16) ?? undefined,
    deviceMemory: real(p.deviceMemory, 0, 1024) ?? undefined,
    cpuCores: int(p.cpuCores, 0, 1024) ?? undefined,
    touch: typeof p.touch === "boolean" ? p.touch : undefined,
    ttfbMs: int(p.ttfbMs, 0, 10 * 60 * 1000) ?? undefined,
    loadMs: int(p.loadMs, 0, 10 * 60 * 1000) ?? undefined,
    activeMs: int(p.activeMs, 0, DAY_MS) ?? undefined,
    totalMs: int(p.totalMs, 0, DAY_MS) ?? undefined,
    maxScrollPct: int(p.maxScrollPct, 0, 100) ?? undefined,
    clarityUserId: text(p.clarityUserId, 64) ?? undefined,
    claritySessionId: text(p.claritySessionId, 64) ?? undefined,
    clarityPageNum: int(p.clarityPageNum, 0, 1_000_000) ?? undefined,
  };
}

export function buildPageViewRow(
  payload: InsightsPayload,
  request: Request,
  { ip, cf, login, now }: { ip: string | null; cf?: VisitorCf; login: string | null; now: number }
): PageViewRow {
  const siteHost = new URL(request.url).hostname;
  const page = new URL(payload.url, request.url);
  const param = (name: string) => text(page.searchParams.get(name), 200);
  const ua = request.headers.get("User-Agent");
  const agent = parseUserAgent(ua);
  const referrerSource = classifyReferrer(payload.referrer, siteHost);
  const utmSource = param("utm_source");
  return {
    id: payload.id,
    visitor_id: payload.visitorId,
    session_id: payload.sessionId,
    is_landing: payload.landing ? 1 : 0,
    created_at: now,
    updated_at: now,
    ip,
    country: cf?.country ?? null,
    region: cf?.region ?? null,
    region_code: cf?.regionCode ?? null,
    city: cf?.city ?? null,
    postal_code: cf?.postalCode ?? null,
    latitude: coordinate(cf?.latitude),
    longitude: coordinate(cf?.longitude),
    cf_timezone: cf?.timezone ?? null,
    continent: cf?.continent ?? null,
    asn: cf?.asn ?? null,
    as_organization: cf?.asOrganization ?? null,
    colo: cf?.colo ?? null,
    http_protocol: cf?.httpProtocol ?? null,
    tls_version: cf?.tlsVersion ?? null,
    user_agent: text(ua, 512),
    browser: agent.browser,
    browser_version: agent.browserVersion,
    os: agent.os,
    device_type: agent.deviceType,
    accept_language: text(request.headers.get("Accept-Language"), 200),
    host: siteHost,
    path: page.pathname,
    query: page.search ? page.search.slice(1) : null,
    page_title: payload.title ?? null,
    page_locale: payload.locale ?? null,
    referrer: payload.referrer ?? null,
    // A tagged link says more than the referrer, which apps often strip.
    source: (utmSource ?? param("ref"))?.toLowerCase() ?? referrerSource,
    referrer_source: referrerSource,
    utm_source: utmSource,
    utm_medium: param("utm_medium"),
    utm_campaign: param("utm_campaign"),
    utm_term: param("utm_term"),
    utm_content: param("utm_content"),
    click_id: param("gclid") ?? param("fbclid") ?? param("li_fat_id") ?? param("msclkid"),
    screen_w: payload.screenW ?? null,
    screen_h: payload.screenH ?? null,
    viewport_w: payload.viewportW ?? null,
    viewport_h: payload.viewportH ?? null,
    pixel_ratio: payload.pixelRatio ?? null,
    color_scheme: payload.colorScheme ?? null,
    browser_language: payload.language ?? null,
    browser_timezone: payload.timezone ?? null,
    connection: payload.connection ?? null,
    device_memory: payload.deviceMemory ?? null,
    cpu_cores: payload.cpuCores ?? null,
    touch: payload.touch === undefined ? null : payload.touch ? 1 : 0,
    ttfb_ms: payload.ttfbMs ?? null,
    load_ms: payload.loadMs ?? null,
    active_ms: payload.activeMs ?? 0,
    total_ms: payload.totalMs ?? 0,
    max_scroll_pct: payload.maxScrollPct ?? 0,
    clarity_user_id: payload.clarityUserId ?? null,
    clarity_session_id: payload.claritySessionId ?? null,
    clarity_page_num: payload.clarityPageNum ?? null,
    github_login: login,
  };
}

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** POST /api/insights: one beacon per page view start, and more as the reader leaves or hides it. */
export async function handleInsights(request: Request, deps: AccessDeps): Promise<Response> {
  // Off means off: nothing is read, nothing is stored.
  if (!deps.enabled) return noContent();
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const ip = request.headers.get("CF-Connecting-IP")?.trim().toLowerCase() ?? null;
  if (ip && deps.blacklist.has(ip)) return noContent();

  const body = await request.text();
  if (body.length > MAX_INSIGHTS_BODY_BYTES) return new Response(null, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const payload = sanitizeInsights(parsed);
  if (!payload) return new Response(null, { status: 400 });

  const login = await deps.login(request).catch(() => null);
  await deps.store.upsertPageView(buildPageViewRow(payload, request, { ip, cf: deps.cf, login, now: deps.now }));
  return noContent();
}

export function d1AccessStore(db: D1Like): AccessStore {
  const columns = PAGE_VIEW_COLUMNS.join(", ");
  const placeholders = PAGE_VIEW_COLUMNS.map(() => "?").join(", ");
  const updates = [
    "updated_at = excluded.updated_at",
    ...GROWING.map((c) => `${c} = MAX(COALESCE(${c}, 0), COALESCE(excluded.${c}, 0))`),
    ...LATEST.map((c) => `${c} = COALESCE(excluded.${c}, ${c})`),
    ...KEEP_FIRST_KNOWN.map((c) => `${c} = COALESCE(${c}, excluded.${c})`),
  ].join(", ");
  // The WHERE keeps anyone who learns a view id from rewriting another visitor's row.
  const sql =
    `INSERT INTO page_views (${columns}) VALUES (${placeholders}) ` +
    `ON CONFLICT (id) DO UPDATE SET ${updates} WHERE page_views.visitor_id = excluded.visitor_id`;
  return {
    async upsertPageView(row) {
      await db
        .prepare(sql)
        .bind(...PAGE_VIEW_COLUMNS.map((c) => row[c]))
        .run();
    },
  };
}

/** Same contract as d1AccessStore, kept in memory (`next dev` and tests). */
export function memoryAccessStore(): AccessStore & { rows: Map<string, PageViewRow> } {
  const rows = new Map<string, PageViewRow>();
  return {
    rows,
    async upsertPageView(row) {
      const existing = rows.get(row.id as string);
      if (!existing) {
        rows.set(row.id as string, { ...row });
        return;
      }
      if (existing.visitor_id !== row.visitor_id) return;
      existing.updated_at = row.updated_at;
      for (const c of GROWING) existing[c] = Math.max(Number(existing[c] ?? 0), Number(row[c] ?? 0));
      for (const c of LATEST) existing[c] = row[c] ?? existing[c];
      for (const c of KEEP_FIRST_KNOWN) existing[c] ??= row[c];
    },
  };
}
