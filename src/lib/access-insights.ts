// Access insights: one row per page view in D1 (table page_views), written by
// POST /api/insights (functions/api/insights.ts). Shared by the browser beacon
// and the server. Relative imports only (Pages Functions bundler).

export const INSIGHTS_API = "/api/insights";

/** Beacons larger than this are rejected unread. */
export const MAX_INSIGHTS_BODY_BYTES = 8 * 1024;

/** A visit (session) ends after this long without a page view. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** What the browser sends. Every field is untrusted and re-validated on the server. */
export interface InsightsPayload {
  id: string;
  visitorId: string;
  sessionId: string;
  landing: boolean;
  /** Path and query of the page, e.g. /pt-br/blog/x/?utm_source=linkedin */
  url: string;
  title?: string;
  locale?: string;
  referrer?: string;
  screenW?: number;
  screenH?: number;
  viewportW?: number;
  viewportH?: number;
  pixelRatio?: number;
  colorScheme?: string;
  language?: string;
  timezone?: string;
  connection?: string;
  deviceMemory?: number;
  cpuCores?: number;
  touch?: boolean;
  ttfbMs?: number;
  loadMs?: number;
  /** Time the page was visible, in ms. */
  activeMs?: number;
  /** Time since the page view started, visible or not, in ms. */
  totalMs?: number;
  maxScrollPct?: number;
  clarityUserId?: string;
  claritySessionId?: string;
  clarityPageNum?: number;
}

/** Only the exact (case-insensitive) value "true" turns the feature on. */
export function isFlagOn(value: string | undefined | null): boolean {
  return value?.trim().toLowerCase() === "true";
}

/** "1.2.3.4, 2804:abcd::1" -> Set of exact addresses. */
export function parseIpList(value: string | undefined | null): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((ip) => ip.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Checked in order: the first rule whose host matches names the source.
const SOURCE_RULES: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$|^com\.linkedin\.android$/, "linkedin"],
  [/^gemini\.google\.com$/, "gemini"],
  [/^mail\.google\.com$|^com\.google\.android\.gm$/, "gmail"],
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/^copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\.[a-z.]+$/, "yahoo"],
  [/(^|\.)yandex\.[a-z.]+$/, "yandex"],
  [/(^|\.)baidu\.com$/, "baidu"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/^search\.brave\.com$/, "brave"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/^chatgpt\.com$|^chat\.openai\.com$/, "chatgpt"],
  [/^claude\.ai$/, "claude"],
  [/(^|\.)github\.com$/, "github"],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "x"],
  [/(^|\.)facebook\.com$|^fb\.me$|^com\.facebook\.katana$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/^news\.ycombinator\.com$/, "hackernews"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/^wa\.me$|(^|\.)whatsapp\.com$|^com\.whatsapp$/, "whatsapp"],
  [/^t\.me$|(^|\.)telegram\.org$|^org\.telegram\.messenger$/, "telegram"],
  [/^outlook\.(live|office|office365)\.com$/, "outlook"],
  [/^dev\.to$/, "devto"],
  [/(^|\.)medium\.com$/, "medium"],
];

/**
 * Names where a visit came from: "direct" without a referrer, "internal" for
 * the site itself, a known source ("linkedin", "google"...), else the host.
 * Android apps send `android-app://<package>/` as the referrer.
 */
export function classifyReferrer(referrer: string | undefined | null, siteHost: string): string {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  if (!host) return "direct";
  if (host === siteHost.toLowerCase()) return "internal";
  const bare = host.replace(/^www\./, "");
  for (const [pattern, source] of SOURCE_RULES) if (pattern.test(bare)) return source;
  return bare;
}

export interface UserAgentInfo {
  browser: string;
  browserVersion: string | null;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot";
}

// In-app browsers come first: the LinkedIn app's UA also says Safari/Chrome.
const BROWSER_RULES: [RegExp, string][] = [
  [/LinkedInApp(?:\/([\d.]+))?/, "LinkedIn app"],
  [/(?:FBAN|FBAV)\/([\d.]+)/, "Facebook app"],
  [/Instagram ([\d.]+)/, "Instagram app"],
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge"],
  [/OPR\/([\d.]+)/, "Opera"],
  [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
  [/(?:Firefox|FxiOS)\/([\d.]+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome"],
  [/Version\/([\d.]+).*Safari\//, "Safari"],
];

const OS_RULES: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(ua: string | null | undefined): UserAgentInfo {
  const value = ua ?? "";
  let browser = "other";
  let browserVersion: string | null = null;
  for (const [pattern, name] of BROWSER_RULES) {
    const match = pattern.exec(value);
    if (match) {
      browser = name;
      browserVersion = match[1]?.split(".")[0] ?? null;
      break;
    }
  }
  const os = OS_RULES.find(([pattern]) => pattern.test(value))?.[1] ?? "other";
  const deviceType = /bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(value)
    ? "bot"
    : /iPad|Tablet/.test(value) || (/Android/.test(value) && !/Mobile/.test(value))
      ? "tablet"
      : /Mobi|iPhone|iPod|Android/.test(value)
        ? "mobile"
        : "desktop";
  return { browser, browserVersion, os, deviceType };
}
