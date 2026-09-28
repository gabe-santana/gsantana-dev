// Server side of "Sign in with GitHub" and synced reading progress. Every
// handler takes a standard Request and returns a Response, so the same code
// runs as Cloudflare Pages Functions (functions/api/*, D1) and as the
// `next dev` stand-ins (app/api/**/route.dev.ts, in memory).
// Relative imports only (Pages Functions bundler).
import type { D1Like } from "./d1";
import {
  AUTH_API,
  GISCUS_SIGNIN_MARKER,
  SIGNED_IN_COOKIE,
  isValidArticleKey,
  MAX_PROGRESS_ENTRIES,
  type ProgressMap,
  type PublicUser,
} from "./user";

const SESSION_COOKIE = "gs_session";
const OAUTH_COOKIE = "gs_oauth";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;
const OAUTH_MAX_AGE_S = 60 * 10;

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export interface UserRecord extends PublicUser {
  id: number;
  githubId: number;
}

export interface UserStore {
  upsertGithubUser(profile: GitHubProfile, now: number): Promise<UserRecord>;
  getUser(id: number): Promise<UserRecord | null>;
  deleteUser(id: number): Promise<void>;
  getProgress(userId: number): Promise<ProgressMap>;
  /** Keeps the furthest point per article: a lower percent never overwrites a higher one. */
  mergeProgress(userId: number, progress: ProgressMap, now: number): Promise<void>;
}

export interface UserDeps {
  store: UserStore;
  /** HMAC key for the session cookie (secret SESSION_SECRET). */
  sessionSecret: string;
  githubClientId?: string;
  githubClientSecret?: string;
  now: number;
  fetch?: typeof fetch;
  /**
   * After our sign-in, pass through giscus's own GitHub sign-in so comments
   * don't ask again. giscus sessions are minted by giscus.app, so the site
   * can't create one; chaining the redirect is the one-click equivalent.
   */
  chainGiscus?: boolean;
}

// --- cookies ----------------------------------------------------------------

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number, { httpOnly = true, path = "/" } = {}): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    "Secure",
    httpOnly ? "HttpOnly" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function sessionCookies(token: string): string[] {
  return [
    cookie(SESSION_COOKIE, token, SESSION_MAX_AGE_S),
    // Readable by scripts, holds nothing secret: lets pages skip calling the
    // API at all for visitors who never signed in.
    cookie(SIGNED_IN_COOKIE, "1", SESSION_MAX_AGE_S, { httpOnly: false }),
  ];
}

function clearedSessionCookies(): string[] {
  return [cookie(SESSION_COOKIE, "", 0), cookie(SIGNED_IN_COOKIE, "", 0, { httpOnly: false })];
}

// --- session token ----------------------------------------------------------

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** `<base64url payload>.<base64url HMAC>`: tamper-proof, and needs no session table. */
export async function signSession(userId: number, expiresAt: number, secret: string): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify({ uid: userId, exp: expiresAt })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | null, secret: string, now: number): Promise<number | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload)
    );
    if (!valid) return null;
    const { uid, exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { uid: unknown; exp: unknown };
    return typeof uid === "number" && typeof exp === "number" && exp > now ? uid : null;
  } catch {
    return null;
  }
}

async function currentUser(request: Request, deps: UserDeps): Promise<UserRecord | null> {
  const userId = await verifySession(readCookie(request, SESSION_COOKIE), deps.sessionSecret, deps.now);
  return userId === null ? null : deps.store.getUser(userId);
}

/** GitHub login of the signed-in reader, or null (no session, or an invalid one). */
export async function signedInLogin(request: Request, deps: UserDeps): Promise<string | null> {
  return (await currentUser(request, deps))?.login ?? null;
}

// --- helpers ----------------------------------------------------------------

function json(body: unknown, status = 200, setCookies: string[] = []): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

/** Only the site's own pages may change state; browsers send Origin on POST/DELETE (and on sendBeacon). */
export function isSameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

/** Local paths only, so the login can't be turned into an open redirect. */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

function publicUser(user: UserRecord): PublicUser {
  return { login: user.login, name: user.name, avatarUrl: user.avatarUrl };
}

// --- handlers ---------------------------------------------------------------

/** GET /api/auth/login?returnTo=/pt-br/blog/x/ -> GitHub's consent screen. */
export async function handleLogin(request: Request, deps: UserDeps): Promise<Response> {
  if (!deps.githubClientId) return new Response("GitHub sign-in is not configured.", { status: 503 });
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", deps.githubClientId);
  authorize.searchParams.set("redirect_uri", `${url.origin}${AUTH_API.callback}`);
  authorize.searchParams.set("state", state);
  // No `scope`: the token can only read the public profile (login, name, avatar).
  return redirect(authorize.toString(), [
    cookie(OAUTH_COOKIE, `${state}|${returnTo}`, OAUTH_MAX_AGE_S, { path: "/api/auth" }),
  ]);
}

/** GET /api/auth/callback?code&state -> session cookie, then back to the page (through giscus). */
export async function handleCallback(request: Request, deps: UserDeps): Promise<Response> {
  const url = new URL(request.url);
  const [expectedState, storedReturnTo] = (readCookie(request, OAUTH_COOKIE) ?? "").split("|");
  const returnTo = safeReturnTo(storedReturnTo ?? null);
  const clearOauth = cookie(OAUTH_COOKIE, "", 0, { path: "/api/auth" });

  // The reader cancelled on GitHub: just go back.
  if (url.searchParams.get("error")) return redirect(`${url.origin}${returnTo}`, [clearOauth]);

  const code = url.searchParams.get("code");
  if (!code || !expectedState || url.searchParams.get("state") !== expectedState) {
    return new Response("Sign-in expired or was tampered with. Please try again.", { status: 400, headers: { "Set-Cookie": clearOauth } });
  }
  if (!deps.githubClientId || !deps.githubClientSecret) {
    return new Response("GitHub sign-in is not configured.", { status: 503 });
  }

  const doFetch = deps.fetch ?? fetch;
  const tokenRes = await doFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: deps.githubClientId,
      client_secret: deps.githubClientSecret,
      code,
      redirect_uri: `${url.origin}${AUTH_API.callback}`,
    }),
  });
  const { access_token: accessToken } = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!accessToken) return new Response("GitHub didn't accept the sign-in. Please try again.", { status: 502 });

  // GitHub's API rejects requests without a User-Agent.
  const profileRes = await doFetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "gsantana.dev" },
  });
  if (!profileRes.ok) return new Response("Couldn't read your GitHub profile. Please try again.", { status: 502 });
  const profile = (await profileRes.json()) as GitHubProfile;
  // The GitHub token is used once, here, and never stored.

  const user = await deps.store.upsertGithubUser(profile, deps.now);
  return signedInRedirect(url.origin, returnTo, user, deps, [clearOauth]);
}

/** Issues the session and sends the reader back, through giscus's sign-in when chainGiscus is on. */
export async function signedInRedirect(
  origin: string,
  returnTo: string,
  user: UserRecord,
  deps: UserDeps,
  extraCookies: string[] = []
): Promise<Response> {
  const token = await signSession(user.id, deps.now + SESSION_MAX_AGE_S * 1000, deps.sessionSecret);
  const back = `${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}${GISCUS_SIGNIN_MARKER}=1`;
  const next = deps.chainGiscus
    ? `https://giscus.app/api/oauth/authorize?redirect_uri=${encodeURIComponent(back)}`
    : back;
  return redirect(next, [...sessionCookies(token), ...extraCookies]);
}

/** POST /api/auth/logout */
export async function handleLogout(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false }, 403);
  return json({ ok: true }, 200, clearedSessionCookies());
}

/** GET /api/me -> { user } (null when signed out; clears a stale hint cookie). */
export async function handleMe(request: Request, deps: UserDeps): Promise<Response> {
  const user = await currentUser(request, deps);
  if (!user) return json({ user: null }, 200, clearedSessionCookies());
  return json({ user: publicUser(user) });
}

/** DELETE /api/me -> removes the account and its reading progress (LGPD: the reader's right to deletion). */
export async function handleDeleteMe(request: Request, deps: UserDeps): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false }, 403);
  const user = await currentUser(request, deps);
  if (user) await deps.store.deleteUser(user.id);
  return json({ ok: true }, 200, clearedSessionCookies());
}

/** GET /api/progress -> { progress } */
export async function handleGetProgress(request: Request, deps: UserDeps): Promise<Response> {
  const user = await currentUser(request, deps);
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ progress: await deps.store.getProgress(user.id) });
}

export function sanitizeProgress(input: unknown): ProgressMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_PROGRESS_ENTRIES) return null;
  const clean: ProgressMap = {};
  for (const [key, value] of entries) {
    if (!isValidArticleKey(key) || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
      return null;
    }
    clean[key] = value;
  }
  return clean;
}

/** POST /api/progress { progress: { key: percent } } (also what navigator.sendBeacon sends). */
export async function handlePostProgress(request: Request, deps: UserDeps): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false }, 403);
  const user = await currentUser(request, deps);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as { progress?: unknown } | null;
  const progress = sanitizeProgress(body?.progress);
  if (!progress) return json({ error: "bad_request" }, 400);
  if (Object.keys(progress).length) await deps.store.mergeProgress(user.id, progress, deps.now);
  return json({ ok: true });
}

// --- D1 store ---------------------------------------------------------------

interface UserRow {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

function toUser(row: UserRow | null): UserRecord | null {
  return row
    ? { id: row.id, githubId: row.github_id, login: row.login, name: row.name, avatarUrl: row.avatar_url }
    : null;
}

export function d1UserStore(db: D1Like): UserStore {
  return {
    async upsertGithubUser(profile, now) {
      const row = await db
        .prepare(
          `INSERT INTO users (github_id, login, name, avatar_url, created_at, last_login_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?5)
           ON CONFLICT(github_id) DO UPDATE SET
             login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url,
             last_login_at = excluded.last_login_at
           RETURNING id, github_id, login, name, avatar_url`
        )
        .bind(profile.id, profile.login, profile.name, profile.avatar_url, now)
        .first<UserRow>();
      return toUser(row)!;
    },
    async getUser(id) {
      return toUser(
        await db.prepare("SELECT id, github_id, login, name, avatar_url FROM users WHERE id = ?1").bind(id).first<UserRow>()
      );
    },
    async deleteUser(id) {
      await db.batch([
        db.prepare("DELETE FROM reading_progress WHERE user_id = ?1").bind(id),
        db.prepare("DELETE FROM users WHERE id = ?1").bind(id),
      ]);
    },
    async getProgress(userId) {
      const { results } = await db
        .prepare("SELECT article_key, percent FROM reading_progress WHERE user_id = ?1")
        .bind(userId)
        .all<{ article_key: string; percent: number }>();
      return Object.fromEntries(results.map((r) => [r.article_key, r.percent]));
    },
    async mergeProgress(userId, progress, now) {
      // One round trip for the whole batch; the WHERE keeps the maximum.
      await db.batch(
        Object.entries(progress).map(([key, percent]) =>
          db
            .prepare(
              `INSERT INTO reading_progress (user_id, article_key, percent, updated_at) VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(user_id, article_key) DO UPDATE SET percent = excluded.percent, updated_at = excluded.updated_at
               WHERE excluded.percent > reading_progress.percent`
            )
            .bind(userId, key, percent, now)
        )
      );
    },
  };
}
