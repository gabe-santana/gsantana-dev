import { describe, expect, it, vi } from "vitest";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { locales } from "@/lib/i18n";
import { newsStories } from "@/lib/news";
import { getPostSlugs } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";
import { isValidArticleKey } from "@/lib/user";
import { memoryUserStore } from "@/lib/user-dev";
import {
  handleCallback,
  handleDeleteMe,
  handleGetProgress,
  handleLogin,
  handleMe,
  handlePostProgress,
  safeReturnTo,
  sanitizeProgress,
  signSession,
  verifySession,
  type UserDeps,
} from "@/lib/user-server";

const ORIGIN = "https://gsantana.dev";
const NOW = 1_800_000_000_000;

function deps(overrides: Partial<UserDeps> = {}): UserDeps & { store: ReturnType<typeof memoryUserStore> } {
  return {
    store: memoryUserStore(),
    sessionSecret: "test-secret",
    githubClientId: "client-id",
    githubClientSecret: "client-secret",
    now: NOW,
    chainGiscus: true,
    ...overrides,
  } as UserDeps & { store: ReturnType<typeof memoryUserStore> };
}

const setCookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) =>
  setCookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(";")[0]!
    .slice(name.length + 1);

function githubFetch(profile = { id: 42, login: "octo", name: "Octo Cat", avatar_url: "https://avatars.githubusercontent.com/u/42" }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://github.com/login/oauth/access_token")) return Response.json({ access_token: "gho_x" });
    if (url === "https://api.github.com/user") return Response.json(profile);
    return new Response("unexpected", { status: 500 });
  }) as unknown as typeof fetch;
}

/** Runs login + callback and returns the session cookie header to reuse. */
async function signIn(d: UserDeps) {
  const login = await handleLogin(new Request(`${ORIGIN}/api/auth/login?returnTo=/pt-br/blog/x/`), d);
  const [state] = decodeURIComponent(cookieValue(login, "gs_oauth")!).split("|");
  const callback = await handleCallback(
    new Request(`${ORIGIN}/api/auth/callback?code=abc&state=${state}`, {
      headers: { Cookie: `gs_oauth=${cookieValue(login, "gs_oauth")}` },
    }),
    { ...d, fetch: githubFetch() }
  );
  return { callback, cookie: `gs_session=${cookieValue(callback, "gs_session")}` };
}

const sameOrigin = (path: string, init: RequestInit & { cookie: string }) =>
  new Request(`${ORIGIN}${path}`, {
    ...init,
    headers: { Origin: ORIGIN, Cookie: init.cookie, "Content-Type": "application/json" },
  });

describe("session token", () => {
  it("round-trips and rejects tampering, the wrong key and expiry", async () => {
    const token = await signSession(7, NOW + 1000, "k");
    expect(await verifySession(token, "k", NOW)).toBe(7);
    expect(await verifySession(token, "other-key", NOW)).toBeNull();
    expect(await verifySession(token, "k", NOW + 2000)).toBeNull();
    const [payload, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ uid: 1, exp: NOW + 1000 })).replace(/=+$/, "");
    expect(await verifySession(`${forged}.${sig}`, "k", NOW)).toBeNull();
    expect(await verifySession(`${payload}.x${sig}`, "k", NOW)).toBeNull();
    expect(await verifySession(null, "k", NOW)).toBeNull();
  });
});

describe("login", () => {
  it("sends the reader to GitHub with no scopes and a state cookie", async () => {
    const res = await handleLogin(new Request(`${ORIGIN}/api/auth/login?returnTo=/pt-br/news/`), deps());
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`);
    expect(location.searchParams.has("scope")).toBe(false);
    const oauth = setCookies(res).find((c) => c.startsWith("gs_oauth="))!;
    expect(oauth).toMatch(/HttpOnly/);
    expect(decodeURIComponent(oauth)).toContain(`${location.searchParams.get("state")}|/pt-br/news/`);
  });

  it("only returns to local paths", () => {
    expect(safeReturnTo("/pt-br/blog/x/")).toBe("/pt-br/blog/x/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("answers 503 until GitHub is configured", async () => {
    const res = await handleLogin(new Request(`${ORIGIN}/api/auth/login`), deps({ githubClientId: undefined }));
    expect(res.status).toBe(503);
  });
});

describe("callback", () => {
  it("stores the profile, sets an HttpOnly session plus a script-readable hint, and chains giscus", async () => {
    const d = deps();
    const { callback } = await signIn(d);
    expect(callback.status).toBe(302);
    const next = new URL(callback.headers.get("Location")!);
    expect(next.origin + next.pathname).toBe("https://giscus.app/api/oauth/authorize");
    expect(next.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/pt-br/blog/x/?signin=1`);

    const session = setCookies(callback).find((c) => c.startsWith("gs_session="))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/Secure/);
    expect(session).toMatch(/SameSite=Lax/);
    const hint = setCookies(callback).find((c) => c.startsWith("gs_signed_in="))!;
    expect(hint).not.toMatch(/HttpOnly/);
    expect(await d.store.getUser(1)).toMatchObject({ githubId: 42, login: "octo", name: "Octo Cat" });
  });

  it("goes straight back to the page when giscus chaining is off", async () => {
    const { callback } = await signIn(deps({ chainGiscus: false }));
    expect(callback.headers.get("Location")).toBe(`${ORIGIN}/pt-br/blog/x/?signin=1`);
  });

  it("rejects a state that doesn't match the cookie (login CSRF)", async () => {
    const res = await handleCallback(
      new Request(`${ORIGIN}/api/auth/callback?code=abc&state=attacker`, { headers: { Cookie: "gs_oauth=real-state%7C%2F" } }),
      { ...deps(), fetch: githubFetch() }
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("Set-Cookie")).toBeTruthy();
  });

  it("returns to the page without a session when the reader cancels on GitHub", async () => {
    const res = await handleCallback(
      new Request(`${ORIGIN}/api/auth/callback?error=access_denied`, { headers: { Cookie: "gs_oauth=s%7C%2Fen-us%2F" } }),
      deps()
    );
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en-us/`);
    expect(cookieValue(res, "gs_session")).toBeUndefined();
  });

  it("updates, not duplicates, a returning reader", async () => {
    const d = deps();
    await signIn(d);
    await signIn(d);
    expect(await d.store.getUser(2)).toBeNull();
  });
});

describe("me", () => {
  it("returns the public profile for a valid session and null (clearing the hint) otherwise", async () => {
    const d = deps();
    const { cookie } = await signIn(d);
    const me = await handleMe(new Request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } }), d);
    expect(await me.json()).toEqual({
      user: { login: "octo", name: "Octo Cat", avatarUrl: "https://avatars.githubusercontent.com/u/42" },
    });
    expect(me.headers.get("Cache-Control")).toContain("no-store");

    const anon = await handleMe(new Request(`${ORIGIN}/api/me`), d);
    expect(await anon.json()).toEqual({ user: null });
    expect(setCookies(anon).some((c) => c.startsWith("gs_signed_in=;"))).toBe(true);
  });

  it("deletes the account and its progress", async () => {
    const d = deps();
    const { cookie } = await signIn(d);
    await handlePostProgress(sameOrigin("/api/progress", { method: "POST", cookie, body: JSON.stringify({ progress: { "my-post": 40 } }) }), d);
    const res = await handleDeleteMe(sameOrigin("/api/me", { method: "DELETE", cookie }), d);
    expect(res.status).toBe(200);
    expect(await d.store.getUser(1)).toBeNull();
    expect(d.store.progress.get(1)).toBeUndefined();
  });
});

describe("progress", () => {
  it("keeps the furthest point per article, across writes", async () => {
    const d = deps();
    const { cookie } = await signIn(d);
    const post = (progress: Record<string, number>) =>
      handlePostProgress(sameOrigin("/api/progress", { method: "POST", cookie, body: JSON.stringify({ progress }) }), d);

    expect((await post({ "my-post": 60, "news/story": 100 })).status).toBe(200);
    await post({ "my-post": 30, "principles/cloud/cost-optimization": 10 });
    const res = await handleGetProgress(new Request(`${ORIGIN}/api/progress`, { headers: { Cookie: cookie } }), d);
    expect(await res.json()).toEqual({
      progress: { "my-post": 60, "news/story": 100, "principles/cloud/cost-optimization": 10 },
    });
  });

  it("needs a session and a same-origin request", async () => {
    const d = deps();
    const { cookie } = await signIn(d);
    expect((await handleGetProgress(new Request(`${ORIGIN}/api/progress`), d)).status).toBe(401);
    const crossSite = new Request(`${ORIGIN}/api/progress`, {
      method: "POST",
      headers: { Origin: "https://evil.example", Cookie: cookie },
      body: JSON.stringify({ progress: { x: 1 } }),
    });
    expect((await handlePostProgress(crossSite, d)).status).toBe(403);
  });

  it("rejects malformed batches", () => {
    expect(sanitizeProgress({ "my-post": 50 })).toEqual({ "my-post": 50 });
    expect(sanitizeProgress({ "my-post": 150 })).toBeNull();
    expect(sanitizeProgress({ "my-post": 0 })).toBeNull();
    expect(sanitizeProgress({ "my-post": 12.5 })).toBeNull();
    expect(sanitizeProgress({ "../etc": 10 })).toBeNull();
    expect(sanitizeProgress([1, 2])).toBeNull();
    expect(sanitizeProgress(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`p${i}`, 1])))).toBeNull();
  });

  it("accepts every article key the site actually uses", () => {
    const keys = locales.flatMap((l) => [
      ...getPostSlugs(l),
      ...getAllPrinciples(l).map((p) => p.key),
      ...getAllCertificationSummaries(l).map((c) => `certifications/${c.slug}`),
      ...newsStories.map((s) => `news/${s.slug}`),
    ]);
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(isValidArticleKey(key), key).toBe(true);
  });
});
