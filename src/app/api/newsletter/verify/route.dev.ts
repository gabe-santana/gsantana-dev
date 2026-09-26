// Dev-only stand-in for functions/api/newsletter/verify.ts (see next.config.mjs).
import { devSubscriberStore } from "@/lib/newsletter-dev";
import { handleVerify } from "@/lib/newsletter-server";

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return Response.json({ status: "invalid" }, { status: 403 });
  }
  const input = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const status = await handleVerify(input?.token, { store: devSubscriberStore(), now: Date.now() });
  return Response.json({ status });
}
