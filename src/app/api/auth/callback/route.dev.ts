// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { devUserDeps } from "@/lib/user-dev";
import { handleCallback } from "@/lib/user-server";

export const GET = (request: Request) => handleCallback(request, devUserDeps());
