// Cloudflare Pages Function: POST /api/newsletter/subscribe {email, locale}.
// Stores a pending subscriber in D1 and emails a confirmation link (double
// opt-in). The rules live in lib/newsletter-server.ts; this file only wires
// the request, the D1 binding and the mailer.
import {
  d1SubscriberStore,
  handleSubscribe,
  zeptoMailSender,
  type D1Like,
  type SendEmail,
} from "../../../lib/newsletter-server";
import type { SubscribeRequest } from "../../../lib/newsletter";

export interface NewsletterEnv {
  DB: D1Like;
  /** ZeptoMail Send Mail token (secret). */
  ZEPTOMAIL_TOKEN?: string;
  /** Verified sender in ZeptoMail, e.g. newsletter@gsantana.dev. */
  NEWSLETTER_FROM?: string;
  NEWSLETTER_FROM_NAME?: string;
  ZEPTOMAIL_API_URL?: string;
  /** "log" prints the confirmation link instead of emailing it. Only for local `wrangler pages dev`. */
  NEWSLETTER_MAILER?: string;
}

interface Context {
  request: Request;
  env: NewsletterEnv;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Only the site's own pages may call the API; browsers always send Origin on POST. */
export function isSameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

function mailer(env: NewsletterEnv): SendEmail {
  if (env.NEWSLETTER_MAILER === "log") {
    return async (message) => console.log(`[newsletter] would email ${message.to}:\n${message.text}`);
  }
  if (!env.ZEPTOMAIL_TOKEN || !env.NEWSLETTER_FROM) {
    return async () => {
      throw new Error("ZEPTOMAIL_TOKEN or NEWSLETTER_FROM is not configured");
    };
  }
  return zeptoMailSender({
    token: env.ZEPTOMAIL_TOKEN,
    fromAddress: env.NEWSLETTER_FROM,
    fromName: env.NEWSLETTER_FROM_NAME ?? "Gabriel Santana",
    apiUrl: env.ZEPTOMAIL_API_URL,
  });
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, error: "bad_request" }, 403);
  let input: Partial<SubscribeRequest>;
  try {
    input = (await request.json()) as Partial<SubscribeRequest>;
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  const { status, body } = await handleSubscribe(input, {
    store: d1SubscriberStore(env.DB),
    send: mailer(env),
    now: Date.now(),
    siteOrigin: new URL(request.url).origin,
    ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
    ipSalt: env.ZEPTOMAIL_TOKEN ?? "gsantana.dev",
  });
  return json(body, status);
}
