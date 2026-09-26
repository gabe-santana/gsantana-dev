// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { handleLogout } from "@/lib/user-server";

export const POST = (request: Request) => handleLogout(request);
