// GET /api/auth/callback : GitHub sends the reader back here. See lib/user-server.ts.
import { handleCallback } from "../../../lib/user-server";
import { userDeps, type UserContext } from "../../../lib/user-env";

export const onRequestGet = ({ request, env }: UserContext) => handleCallback(request, userDeps(env));
