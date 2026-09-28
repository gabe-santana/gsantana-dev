// Builds the access insights dependencies from the Pages Functions env.
// Lives in lib/, not functions/, so it doesn't become a route.
import { isFlagOn, parseIpList } from "./access-insights";
import { d1AccessStore, type AccessDeps, type VisitorCf } from "./access-insights-server";
import { signedInLogin } from "./user-server";
import { userDeps, type UserEnv } from "./user-env";

export interface AccessEnv extends UserEnv {
  /** "true" turns the feature on; anything else, or nothing, leaves it off. */
  FLAG_TRACK_USER_ACCESS?: string;
  /** Comma-separated IPs whose visits are never stored. */
  TRACK_USER_ACCESS_BLACK_LIST?: string;
}

export interface AccessContext {
  request: Request & { cf?: VisitorCf };
  env: AccessEnv;
}

export function accessDeps({ request, env }: AccessContext): AccessDeps {
  return {
    enabled: isFlagOn(env.FLAG_TRACK_USER_ACCESS),
    blacklist: parseIpList(env.TRACK_USER_ACCESS_BLACK_LIST),
    store: d1AccessStore(env.DB),
    now: Date.now(),
    login: (req) => signedInLogin(req, userDeps(env)),
    cf: request.cf,
  };
}
