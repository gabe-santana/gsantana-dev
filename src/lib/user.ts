// Shared by the browser and the user service (lib/user-server.ts). No `@/`
// imports: the Pages Functions bundler doesn't know the alias.

export const AUTH_API = {
  login: "/api/auth/login",
  callback: "/api/auth/callback",
  logout: "/api/auth/logout",
} as const;

export const USER_API = {
  me: "/api/me",
  progress: "/api/progress",
} as const;

/** Non-secret, script-readable cookie that only says "a session exists". */
export const SIGNED_IN_COOKIE = "gs_signed_in";

/**
 * Added to the return URL of a sign-in started from the site, so the page
 * can tell it apart from one started in the comments box (which scrolls
 * back to the comments).
 */
export const GISCUS_SIGNIN_MARKER = "signin";

export const MAX_PROGRESS_ENTRIES = 500;

export type ProgressMap = Record<string, number>;

export interface PublicUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Article keys as ArticleLayout uses them: "my-post", "news/x", "principles/cloud/y". */
export function isValidArticleKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*){0,3}$/.test(key) && key.length <= 200;
}
