// Cloudflare Pages Function: POST /api/newsletter/verify {token}. Called by
// the confirm page (/<locale>/newsletter/confirm/?token=...) rather than
// linked directly from the email: mail scanners open links to check them,
// and a GET that verifies would let a scanner confirm addresses on its own.
import { d1SubscriberStore, handleVerify } from "../../../lib/newsletter-server";
import { isSameOrigin, json, type NewsletterEnv } from "./subscribe";

interface Context {
  request: Request;
  env: NewsletterEnv;
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!isSameOrigin(request)) return json({ status: "invalid" }, 403);
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown }).token;
  } catch {
    return json({ status: "invalid" }, 400);
  }
  const status = await handleVerify(token, { store: d1SubscriberStore(env.DB), now: Date.now() });
  return json({ status });
}
