// Dev-only stand-in for functions/api/newsletter/subscribe.ts (see
// next.config.mjs: *.dev.ts routes exist only in `next dev`). Same rules,
// in-memory storage instead of D1.
import { devMailer, devSubscriberStore } from "@/lib/newsletter-dev";
import { handleSubscribe } from "@/lib/newsletter-server";

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return Response.json({ ok: false, error: "bad_request" }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  if (!input) return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  const { status, body } = await handleSubscribe(input, {
    store: devSubscriberStore(),
    send: devMailer(),
    now: Date.now(),
    siteOrigin: new URL(request.url).origin,
    ip: "127.0.0.1",
    ipSalt: "dev",
  });
  return Response.json(body, { status });
}
