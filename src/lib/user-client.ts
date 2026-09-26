// Browser side of the user service: who's signed in, and reading progress
// sync. localStorage stays the source the UI reads from (instant, offline);
// the server is consulted rarely:
// - the profile is cached for USER_CACHE_MS;
// - progress is pulled from D1 only when the last pull is older than
//   PULL_EVERY_MS, or right after signing in (a new browser);
// - local saves are batched and sent once, when the page is hidden or closed.
// Visitors who never signed in never call the API (the gs_signed_in cookie).
import { getAllProgress, mergeProgress } from "@/lib/reading-progress";
import {
  AUTH_API,
  GISCUS_SIGNIN_MARKER,
  SIGNED_IN_COOKIE,
  USER_API,
  type ProgressMap,
  type PublicUser,
} from "@/lib/user";

export const USER_CACHE_MS = 12 * 60 * 60 * 1000;
export const PULL_EVERY_MS = 24 * 60 * 60 * 1000;

const USER_KEY = "gsantana:user";
const SYNC_KEY = "gsantana:progress-sync";
/** Where giscus keeps its own session (see its client: GISCUS_SESSION_KEY). */
const GISCUS_SESSION_KEY = "giscus-session";

interface SyncState {
  lastPull: number;
  dirty: ProgressMap;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: sync just happens less efficiently.
  }
}

function removeKeys(...keys: string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Nothing to clean.
  }
}

export function hasSessionHint(): boolean {
  return document.cookie.split(";").some((c) => c.trim() === `${SIGNED_IN_COOKIE}=1`);
}

// --- profile ----------------------------------------------------------------

export async function loadUser({ refresh = false } = {}): Promise<PublicUser | null> {
  if (!hasSessionHint()) {
    removeKeys(USER_KEY);
    return null;
  }
  const cached = readJson<{ user: PublicUser; at: number } | null>(USER_KEY, null);
  if (!refresh && cached && Date.now() - cached.at < USER_CACHE_MS) return cached.user;
  try {
    const res = await fetch(USER_API.me, { credentials: "same-origin" });
    const { user } = (await res.json()) as { user: PublicUser | null };
    if (user) writeJson(USER_KEY, { user, at: Date.now() });
    else removeKeys(USER_KEY);
    return user;
  } catch {
    // Offline: trust the cache rather than looking signed out.
    return cached?.user ?? null;
  }
}

export function signInHref(): string {
  const here = `${window.location.pathname}${window.location.search}`;
  return `${AUTH_API.login}?returnTo=${encodeURIComponent(here)}`;
}

async function endSession(request: Promise<Response>): Promise<void> {
  await flushProgress({ beacon: false });
  await request.catch(() => undefined);
  // Signing out of the site signs out of the comments too, matching the one-click sign-in.
  removeKeys(USER_KEY, SYNC_KEY, GISCUS_SESSION_KEY);
  window.location.reload();
}

export function signOut(): Promise<void> {
  return endSession(fetch(AUTH_API.logout, { method: "POST", credentials: "same-origin" }));
}

export function deleteAccount(): Promise<void> {
  return endSession(fetch(USER_API.me, { method: "DELETE", credentials: "same-origin" }));
}

/**
 * Called once per page load. After a sign-in started on the site, the URL
 * carries our marker and giscus's `giscus` session param: store the session
 * where giscus looks for it (so the comments are signed in even on pages
 * without a comments box), tidy the URL, and report a fresh sign-in.
 */
export function consumeSignInReturn(): boolean {
  const url = new URL(window.location.href);
  const fresh = url.searchParams.has(GISCUS_SIGNIN_MARKER);
  const giscusSession = url.searchParams.get("giscus");
  if (giscusSession) writeJson(GISCUS_SESSION_KEY, giscusSession);
  if (!fresh && !giscusSession) return false;
  url.searchParams.delete(GISCUS_SIGNIN_MARKER);
  url.searchParams.delete("giscus");
  window.history.replaceState(window.history.state, "", url.toString());
  return fresh;
}

// --- progress ---------------------------------------------------------------

function syncState(): SyncState {
  return readJson<SyncState>(SYNC_KEY, { lastPull: 0, dirty: {} });
}

export function recordProgressForSync(key: string, percent: number): void {
  if (!hasSessionHint()) return;
  const state = syncState();
  if ((state.dirty[key] ?? 0) >= percent) return;
  state.dirty[key] = percent;
  writeJson(SYNC_KEY, state);
}

/**
 * Sends the batched saves. On page hide it uses sendBeacon, which the
 * browser delivers even while the page unloads.
 */
export async function flushProgress({ beacon }: { beacon: boolean }): Promise<void> {
  if (!hasSessionHint()) return;
  const state = syncState();
  if (!Object.keys(state.dirty).length) return;
  const body = JSON.stringify({ progress: state.dirty });
  let sent = false;
  if (beacon && typeof navigator.sendBeacon === "function") {
    sent = navigator.sendBeacon(USER_API.progress, new Blob([body], { type: "application/json" }));
  } else {
    try {
      const res = await fetch(USER_API.progress, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body,
        keepalive: true,
      });
      sent = res.ok;
    } catch {
      sent = false;
    }
  }
  if (sent) writeJson(SYNC_KEY, { ...syncState(), dirty: {} });
}

/** Pulls progress from D1 when the local copy is stale (or force after signing in), merging both ways. */
export async function pullProgress({ force = false } = {}): Promise<void> {
  if (!hasSessionHint()) return;
  const state = syncState();
  if (!force && Date.now() - state.lastPull < PULL_EVERY_MS) return;
  let server: ProgressMap;
  try {
    const res = await fetch(USER_API.progress, { credentials: "same-origin" });
    if (!res.ok) return;
    server = ((await res.json()) as { progress: ProgressMap }).progress ?? {};
  } catch {
    return;
  }
  mergeProgress(server);
  // Whatever this browser knows better than the server goes up in the next flush.
  for (const [key, percent] of Object.entries(getAllProgress())) {
    if (percent > (server[key] ?? 0)) recordProgressForSync(key, percent);
  }
  writeJson(SYNC_KEY, { ...syncState(), lastPull: Date.now() });
  await flushProgress({ beacon: false });
}
