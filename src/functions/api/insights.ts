// POST /api/insights: page view insights, when FLAG_TRACK_USER_ACCESS is "true". See lib/access-insights-server.ts.
import { handleInsights } from "../../lib/access-insights-server";
import { accessDeps, type AccessContext } from "../../lib/access-env";

export const onRequest = (context: AccessContext) => handleInsights(context.request, accessDeps(context));
