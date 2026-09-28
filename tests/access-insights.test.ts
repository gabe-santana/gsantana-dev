import { describe, expect, it, vi } from "vitest";
import { classifyReferrer, isFlagOn, parseIpList, parseUserAgent } from "@/lib/access-insights";
import {
  handleInsights,
  memoryAccessStore,
  sanitizeInsights,
  type AccessDeps,
} from "@/lib/access-insights-server";

const ORIGIN = "https://gsantana.dev";
const NOW = 1_800_000_000_000;
const VIEW = {
  id: "0b8f2c1e-4d5a-4c3b-9e2f-1a2b3c4d5e6f",
  visitorId: "visitor-0001",
  sessionId: "session-0001",
  landing: true,
  url: "/pt-br/blog/laya-email-security-screener/?utm_source=LinkedIn&utm_medium=social",
  title: "laya-classifier",
  referrer: "android-app://com.linkedin.android/",
  activeMs: 1200,
  totalMs: 1500,
  maxScrollPct: 20,
};
const LINKEDIN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1";

function deps(overrides: Partial<AccessDeps> = {}): AccessDeps & { store: ReturnType<typeof memoryAccessStore> } {
  return {
    enabled: true,
    blacklist: new Set(),
    store: memoryAccessStore(),
    now: NOW,
    login: async () => null,
    cf: { country: "BR", city: "São Paulo", region: "São Paulo", latitude: "-23.5", longitude: "-46.6", asn: 28573, asOrganization: "Claro" },
    ...overrides,
  } as AccessDeps & { store: ReturnType<typeof memoryAccessStore> };
}

function beacon(body: unknown, { ip = "203.0.113.7", origin = ORIGIN, ua = LINKEDIN_UA } = {}): Request {
  return new Request(`${ORIGIN}/api/insights`, {
    method: "POST",
    headers: { Origin: origin, "CF-Connecting-IP": ip, "User-Agent": ua, "Content-Type": "text/plain" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("feature flag and blacklist", () => {
  it("is on only for the value true", () => {
    expect(isFlagOn("true")).toBe(true);
    expect(isFlagOn(" TRUE ")).toBe(true);
    for (const value of [undefined, null, "", "false", "1", "yes"]) expect(isFlagOn(value)).toBe(false);
  });

  it("parses a comma-separated IP list", () => {
    expect([...parseIpList(" 203.0.113.7,, 2804:ABCD::1 ,")]).toEqual(["203.0.113.7", "2804:abcd::1"]);
    expect(parseIpList(undefined).size).toBe(0);
  });

  it("stores nothing, and reads nothing, when the flag is off", async () => {
    const d = deps({ enabled: false });
    const request = beacon(VIEW);
    const res = await handleInsights(request, d);
    expect(res.status).toBe(204);
    expect(d.store.rows.size).toBe(0);
    expect(request.bodyUsed).toBe(false);
  });

  it("drops visits from blacklisted IPs", async () => {
    const d = deps({ blacklist: parseIpList("198.51.100.1, 2804:abcd::1") });
    expect((await handleInsights(beacon(VIEW, { ip: "2804:ABCD::1" }), d)).status).toBe(204);
    expect(d.store.rows.size).toBe(0);
    await handleInsights(beacon(VIEW, { ip: "198.51.100.2" }), d);
    expect(d.store.rows.size).toBe(1);
  });
});

describe("handleInsights", () => {
  it("stores the page view with location, source, device and the signed-in login", async () => {
    const d = deps({ login: async () => "octocat" });
    expect((await handleInsights(beacon(VIEW), d)).status).toBe(204);
    const row = d.store.rows.get(VIEW.id)!;
    expect(row).toMatchObject({
      ip: "203.0.113.7",
      country: "BR",
      city: "São Paulo",
      latitude: -23.5,
      as_organization: "Claro",
      path: "/pt-br/blog/laya-email-security-screener/",
      query: "utm_source=LinkedIn&utm_medium=social",
      source: "linkedin",
      referrer_source: "linkedin",
      utm_medium: "social",
      browser: "LinkedIn app",
      os: "iOS",
      device_type: "mobile",
      is_landing: 1,
      github_login: "octocat",
      created_at: NOW,
    });
  });

  it("merges later beacons: metrics only grow, Clarity ids fill in, the title takes the latest", async () => {
    const d = deps();
    await handleInsights(beacon({ ...VIEW, activeMs: 5000, maxScrollPct: 60 }), d);
    await handleInsights(
      beacon({ ...VIEW, activeMs: 3000, maxScrollPct: 80, title: "Final title", clarityUserId: "1abc2de", claritySessionId: "xyz", clarityPageNum: 2 }),
      deps({ store: d.store, now: NOW + 9000 })
    );
    expect(d.store.rows.get(VIEW.id)).toMatchObject({
      active_ms: 5000,
      max_scroll_pct: 80,
      page_title: "Final title",
      clarity_user_id: "1abc2de",
      clarity_page_num: 2,
      created_at: NOW,
      updated_at: NOW + 9000,
    });
  });

  it("never lets another visitor rewrite a view", async () => {
    const d = deps();
    await handleInsights(beacon(VIEW), d);
    await handleInsights(beacon({ ...VIEW, visitorId: "attacker-01", activeMs: 999999 }), d);
    expect(d.store.rows.get(VIEW.id)?.active_ms).toBe(1200);
  });

  it("rejects cross-origin, malformed and oversized beacons", async () => {
    const d = deps();
    expect((await handleInsights(beacon(VIEW, { origin: "https://evil.example" }), d)).status).toBe(403);
    expect((await handleInsights(beacon("{nope"), d)).status).toBe(400);
    expect((await handleInsights(beacon({ ...VIEW, id: "x" }), d)).status).toBe(400);
    expect((await handleInsights(beacon({ ...VIEW, url: "https://evil.example/" }), d)).status).toBe(400);
    expect((await handleInsights(beacon({ ...VIEW, title: "a".repeat(9000) }), d)).status).toBe(413);
    expect(d.store.rows.size).toBe(0);
  });

  it("still stores the view when the login lookup fails", async () => {
    const d = deps({ login: vi.fn().mockRejectedValue(new Error("D1 down")) });
    await handleInsights(beacon(VIEW), d);
    expect(d.store.rows.get(VIEW.id)?.github_login).toBeNull();
  });
});

describe("sanitizeInsights", () => {
  it("clamps numbers and trims strings", () => {
    const clean = sanitizeInsights({ ...VIEW, maxScrollPct: 250, activeMs: -5, title: "  hi  ", screenW: "wide" });
    expect(clean).toMatchObject({ maxScrollPct: 100, activeMs: 0, title: "hi" });
    expect(clean?.screenW).toBeUndefined();
  });
});

describe("classifyReferrer", () => {
  it.each([
    [undefined, "direct"],
    ["", "direct"],
    ["https://gsantana.dev/en-us/blog/", "internal"],
    ["https://www.linkedin.com/", "linkedin"],
    ["https://lnkd.in/abc", "linkedin"],
    ["android-app://com.linkedin.android/", "linkedin"],
    ["https://www.google.com.br/", "google"],
    ["https://gemini.google.com/", "gemini"],
    ["https://www.bing.com/", "bing"],
    ["https://chatgpt.com/", "chatgpt"],
    ["https://github.com/gabe-santana", "github"],
    ["https://t.co/xyz", "x"],
    ["https://news.ycombinator.com/item?id=1", "hackernews"],
    ["https://blog.example.org/post", "blog.example.org"],
    ["not a url", "unknown"],
  ])("%s -> %s", (referrer, source) => {
    expect(classifyReferrer(referrer, "gsantana.dev")).toBe(source);
  });
});

describe("parseUserAgent", () => {
  it.each([
    [LINKEDIN_UA, "LinkedIn app", "iOS", "mobile"],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge",
      "Windows",
      "desktop",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Chrome",
      "Android",
      "mobile",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "Safari",
      "macOS",
      "desktop",
    ],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "other", "other", "bot"],
  ])("%s", (ua, browser, os, deviceType) => {
    expect(parseUserAgent(ua)).toMatchObject({ browser, os, deviceType });
  });
});
