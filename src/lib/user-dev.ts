// User service stand-ins for `next dev` (app/api/**/route.dev.ts) and the
// tests: the real service runs as Cloudflare Pages Functions with D1.
import type { ProgressMap } from "./user";
import {
  handleLogin,
  safeReturnTo,
  signedInRedirect,
  type GitHubProfile,
  type UserDeps,
  type UserRecord,
  type UserStore,
} from "./user-server";

/** Same contract as d1UserStore, kept in memory. */
export function memoryUserStore(): UserStore & { progress: Map<number, ProgressMap> } {
  const users = new Map<number, UserRecord>();
  const progress = new Map<number, ProgressMap>();
  let nextId = 1;
  return {
    progress,
    async upsertGithubUser(profile: GitHubProfile) {
      const existing = [...users.values()].find((u) => u.githubId === profile.id);
      const user: UserRecord = {
        id: existing?.id ?? nextId++,
        githubId: profile.id,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
      };
      users.set(user.id, user);
      return user;
    },
    async getUser(id) {
      return users.get(id) ?? null;
    },
    async deleteUser(id) {
      users.delete(id);
      progress.delete(id);
    },
    async getProgress(userId) {
      return { ...(progress.get(userId) ?? {}) };
    },
    async mergeProgress(userId, entries) {
      const current = progress.get(userId) ?? {};
      for (const [key, percent] of Object.entries(entries)) {
        if (percent > (current[key] ?? 0)) current[key] = percent;
      }
      progress.set(userId, current);
    },
  };
}

// One store per dev server process, surviving hot reloads of the route modules.
const globalDev = globalThis as { __userDevStore?: ReturnType<typeof memoryUserStore> };

export function devUserDeps(): UserDeps {
  globalDev.__userDevStore ??= memoryUserStore();
  return {
    store: globalDev.__userDevStore,
    sessionSecret: "dev-only-session-secret",
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    now: Date.now(),
    chainGiscus: Boolean(process.env.GITHUB_CLIENT_ID),
  };
}

/**
 * Without a dev GitHub OAuth App in src/.env.local, "Sign in" logs in a fake
 * reader straight away, so the UI and progress sync can be worked on offline.
 */
export async function devLogin(request: Request): Promise<Response> {
  const deps = devUserDeps();
  if (deps.githubClientId) return handleLogin(request, deps);
  const url = new URL(request.url);
  const user = await deps.store.upsertGithubUser(
    { id: 1, login: "dev-reader", name: "Dev Reader", avatar_url: null },
    deps.now
  );
  return signedInRedirect(url.origin, safeReturnTo(url.searchParams.get("returnTo")), user, deps);
}
