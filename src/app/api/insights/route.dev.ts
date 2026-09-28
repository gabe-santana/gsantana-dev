// Dev-only stand-in for the Pages Function of the same path (see next.config.mjs).
import { devAccessDeps } from "@/lib/access-dev";
import { handleInsights } from "@/lib/access-insights-server";

export const POST = (request: Request) => handleInsights(request, devAccessDeps());
