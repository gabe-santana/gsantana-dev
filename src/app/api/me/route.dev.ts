// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { devUserDeps } from "@/lib/user-dev";
import { handleDeleteMe, handleMe } from "@/lib/user-server";

export const GET = (request: Request) => handleMe(request, devUserDeps());
export const DELETE = (request: Request) => handleDeleteMe(request, devUserDeps());
