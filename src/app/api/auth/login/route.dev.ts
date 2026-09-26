// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { devLogin } from "@/lib/user-dev";

export const GET = (request: Request) => devLogin(request);
