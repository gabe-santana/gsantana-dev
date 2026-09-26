// GET /api/auth/login?returnTo=... : starts "Sign in with GitHub". See lib/user-server.ts.
import { handleLogin } from "../../../lib/user-server";
import { userDeps, type UserContext } from "../../../lib/user-env";

export const onRequestGet = ({ request, env }: UserContext) => handleLogin(request, userDeps(env));
