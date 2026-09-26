// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { devUserDeps } from "@/lib/user-dev";
import { handleGetProgress, handlePostProgress } from "@/lib/user-server";

export const GET = (request: Request) => handleGetProgress(request, devUserDeps());
export const POST = (request: Request) => handlePostProgress(request, devUserDeps());
