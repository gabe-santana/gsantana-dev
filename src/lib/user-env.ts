// Builds the user service's dependencies from the Pages Functions env.
// Lives in lib/, not functions/, so it doesn't become a route.
import type { D1Like } from "./d1";
import { d1UserStore, type UserDeps } from "./user-server";

export interface UserEnv {
  DB: D1Like;
  /** HMAC key for session cookies (secret). */
  SESSION_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  /** GitHub OAuth App client secret (secret). */
  GITHUB_CLIENT_SECRET?: string;
}

export interface UserContext {
  request: Request;
  env: UserEnv;
}

export function userDeps(env: UserEnv): UserDeps {
  return {
    store: d1UserStore(env.DB),
    sessionSecret: env.SESSION_SECRET,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    now: Date.now(),
    chainGiscus: true,
  };
}
