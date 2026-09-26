// GET /api/me (who's signed in) and DELETE /api/me (delete account and data). See lib/user-server.ts.
import { handleDeleteMe, handleMe } from "../../lib/user-server";
import { userDeps, type UserContext } from "../../lib/user-env";

export const onRequestGet = ({ request, env }: UserContext) => handleMe(request, userDeps(env));
export const onRequestDelete = ({ request, env }: UserContext) => handleDeleteMe(request, userDeps(env));
