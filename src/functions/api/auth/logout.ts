// POST /api/auth/logout. See lib/user-server.ts.
import { handleLogout } from "../../../lib/user-server";
import type { UserContext } from "../../../lib/user-env";

export const onRequestPost = ({ request }: UserContext) => handleLogout(request);
