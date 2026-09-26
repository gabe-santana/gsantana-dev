// GET/POST /api/progress: synced reading progress. See lib/user-server.ts.
import { handleGetProgress, handlePostProgress } from "../../lib/user-server";
import { userDeps, type UserContext } from "../../lib/user-env";

export const onRequestGet = ({ request, env }: UserContext) => handleGetProgress(request, userDeps(env));
export const onRequestPost = ({ request, env }: UserContext) => handlePostProgress(request, userDeps(env));
