// Server side of the newsletter: double opt-in with our own D1 table and a
// verification email sent through Zoho ZeptoMail. Used by
// functions/api/newsletter/*. Relative imports only (Functions bundler).
import type { D1Like } from "./d1";
import { isLocale, type Locale } from "./i18n";
import {
  CONFIRM_PATH,
  isValidEmail,
  normalizeEmail,
  type SubscribeRequest,
  type SubscribeResponse,
  type VerifyStatus,
} from "./newsletter";

export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
/** A second sign-up for the same pending address within this window sends nothing. */
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
/** Distinct addresses one IP may sign up per hour: stops using the form to mail-bomb strangers. */
export const IP_HOURLY_LIMIT = 5;

export interface Subscriber {
  email: string;
  locale: Locale;
  verified: boolean;
  tokenHash: string | null;
  tokenExpiresAt: number | null;
  lastSentAt: number | null;
}

export interface SubscriberStore {
  find(email: string): Promise<Subscriber | null>;
  findByTokenHash(tokenHash: string): Promise<Subscriber | null>;
  /** Insert, or refresh the token of an unverified row. Never touches verified rows. */
  savePending(row: { email: string; locale: Locale; tokenHash: string; tokenExpiresAt: number; now: number; ipHash: string }): Promise<void>;
  clearLastSent(email: string): Promise<void>;
  countRecentByIp(ipHash: string, since: number): Promise<number>;
  markVerified(email: string, now: number): Promise<void>;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmail = (message: OutgoingEmail) => Promise<void>;

// --- tokens -----------------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 256 random bits. Only its SHA-256 is stored, so a leaked table can't confirm anyone. */
export function generateToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

// --- handlers ---------------------------------------------------------------

export interface SubscribeDeps {
  store: SubscriberStore;
  send: SendEmail;
  now: number;
  /** Origin the confirmation link points at (the request's own origin). */
  siteOrigin: string;
  ip: string;
  /** Mixed into the IP hash so raw IPs are never stored. */
  ipSalt: string;
}

export async function handleSubscribe(
  input: Partial<SubscribeRequest>,
  deps: SubscribeDeps
): Promise<{ status: number; body: SubscribeResponse }> {
  // Bots get the same answer as people, so the honeypot doesn't teach them anything.
  if (input.website) return { status: 200, body: { ok: true } };
  if (typeof input.email !== "string" || !isValidEmail(input.email)) {
    return { status: 400, body: { ok: false, error: "invalid_email" } };
  }
  const email = normalizeEmail(input.email);
  const locale: Locale = typeof input.locale === "string" && isLocale(input.locale) ? input.locale : "en-us";
  const { store, now } = deps;

  const ipHash = await sha256Hex(`${deps.ipSalt}:${deps.ip}`);
  if ((await store.countRecentByIp(ipHash, now - 60 * 60 * 1000)) >= IP_HOURLY_LIMIT) {
    return { status: 429, body: { ok: false, error: "rate_limited" } };
  }

  // A confirmed address gets no email, just a note that it's already in.
  // This does reveal that the address subscribes (the owner's choice: a
  // personal newsletter, where a friendly answer beats hiding membership).
  // Pending addresses still get the same answer as new ones.
  const existing = await store.find(email);
  if (existing?.verified) return { status: 200, body: { ok: true, alreadySubscribed: true } };
  if (existing?.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return { status: 200, body: { ok: true } };
  }

  const token = generateToken();
  await store.savePending({
    email,
    locale,
    tokenHash: await sha256Hex(token),
    tokenExpiresAt: now + TOKEN_TTL_MS,
    now,
    ipHash,
  });

  const link = `${deps.siteOrigin}/${locale}${CONFIRM_PATH}?token=${token}`;
  try {
    await deps.send(verificationEmail(locale, email, link));
  } catch (error) {
    console.error("[newsletter] sending the verification email failed", error);
    await store.clearLastSent(email);
    return { status: 502, body: { ok: false, error: "send_failed" } };
  }
  return { status: 200, body: { ok: true } };
}

export async function handleVerify(
  token: unknown,
  deps: { store: SubscriberStore; now: number }
): Promise<VerifyStatus> {
  if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) return "invalid";
  const row = await deps.store.findByTokenHash(await sha256Hex(token));
  if (!row) return "invalid";
  if (row.verified) return "already";
  if (!row.tokenExpiresAt || row.tokenExpiresAt < deps.now) return "expired";
  await deps.store.markVerified(row.email, deps.now);
  return "verified";
}

// --- D1 ---------------------------------------------------------------------

export type { D1Like };

interface SubscriberRow {
  email: string;
  locale: string;
  verified: number;
  token_hash: string | null;
  token_expires_at: number | null;
  last_sent_at: number | null;
}

const COLUMNS = "email, locale, verified, token_hash, token_expires_at, last_sent_at";

function toSubscriber(row: SubscriberRow | null): Subscriber | null {
  if (!row) return null;
  return {
    email: row.email,
    locale: isLocale(row.locale) ? row.locale : "en-us",
    verified: row.verified === 1,
    tokenHash: row.token_hash,
    tokenExpiresAt: row.token_expires_at,
    lastSentAt: row.last_sent_at,
  };
}

export function d1SubscriberStore(db: D1Like): SubscriberStore {
  return {
    async find(email) {
      return toSubscriber(
        await db.prepare(`SELECT ${COLUMNS} FROM subscribers WHERE email = ?1`).bind(email).first<SubscriberRow>()
      );
    },
    async findByTokenHash(tokenHash) {
      return toSubscriber(
        await db.prepare(`SELECT ${COLUMNS} FROM subscribers WHERE token_hash = ?1`).bind(tokenHash).first<SubscriberRow>()
      );
    },
    async savePending({ email, locale, tokenHash, tokenExpiresAt, now, ipHash }) {
      await db
        .prepare(
          `INSERT INTO subscribers (email, locale, verified, token_hash, token_expires_at, created_at, last_sent_at, ip_hash)
           VALUES (?1, ?2, 0, ?3, ?4, ?5, ?5, ?6)
           ON CONFLICT(email) DO UPDATE SET
             locale = excluded.locale,
             token_hash = excluded.token_hash,
             token_expires_at = excluded.token_expires_at,
             last_sent_at = excluded.last_sent_at,
             ip_hash = excluded.ip_hash
           WHERE subscribers.verified = 0`
        )
        .bind(email, locale, tokenHash, tokenExpiresAt, now, ipHash)
        .run();
    },
    async clearLastSent(email) {
      await db.prepare("UPDATE subscribers SET last_sent_at = NULL WHERE email = ?1").bind(email).run();
    },
    async countRecentByIp(ipHash, since) {
      const row = await db
        .prepare("SELECT COUNT(*) AS n FROM subscribers WHERE ip_hash = ?1 AND last_sent_at > ?2")
        .bind(ipHash, since)
        .first<{ n: number }>();
      return row?.n ?? 0;
    },
    async markVerified(email, now) {
      await db
        .prepare("UPDATE subscribers SET verified = 1, verified_at = ?2 WHERE email = ?1")
        .bind(email, now)
        .run();
    },
  };
}

// --- email ------------------------------------------------------------------

const EMAIL_COPY: Record<Locale, { subject: string; heading: string; body: string; button: string; ignore: string; fallback: string }> = {
  "en-us": {
    subject: "Confirm your subscription to gsantana.dev",
    heading: "One click and you're in",
    body: "Thanks for subscribing to the gsantana.dev briefing: AI, software engineering and cloud architecture. Confirm this is your address to start receiving it.",
    button: "Confirm my subscription",
    ignore: "Didn't sign up? Ignore this email and nothing will happen. The link expires in 48 hours.",
    fallback: "If the button doesn't work, open this link:",
  },
  "pt-br": {
    subject: "Confirme sua inscrição no gsantana.dev",
    heading: "Falta só um clique",
    body: "Obrigado por se inscrever no panorama do gsantana.dev: IA, engenharia de software e arquitetura cloud. Confirme que este é o seu e-mail para começar a receber.",
    button: "Confirmar inscrição",
    ignore: "Não se inscreveu? Ignore este e-mail e nada vai acontecer. O link expira em 48 horas.",
    fallback: "Se o botão não funcionar, abra este link:",
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function verificationEmail(locale: Locale, to: string, link: string): OutgoingEmail {
  const copy = EMAIL_COPY[locale];
  const href = escapeHtml(link);
  // Table layout and inline styles: the only reliable way across email clients.
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:0;background:#05070d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:40px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1119;border:1px solid #1e2433;">
<tr><td style="padding:32px 32px 8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;font-weight:700;color:#f3f5f8;">gsantana<span style="color:#5eead4;">.dev</span></td></tr>
<tr><td style="padding:16px 32px 0;font-size:24px;font-weight:700;line-height:1.3;color:#f3f5f8;">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#8b93a7;">${escapeHtml(copy.body)}</td></tr>
<tr><td style="padding:28px 32px;"><a href="${href}" style="display:inline-block;background:#5eead4;color:#05070d;font-size:15px;font-weight:700;text-decoration:none;padding:14px 26px;">${escapeHtml(copy.button)}</a></td></tr>
<tr><td style="padding:0 32px 8px;font-size:12px;line-height:1.6;color:#8b93a7;">${escapeHtml(copy.fallback)}<br><a href="${href}" style="color:#5eead4;word-break:break-all;">${href}</a></td></tr>
<tr><td style="padding:16px 32px 32px;font-size:12px;line-height:1.6;color:#8b93a7;border-top:1px solid #1e2433;">${escapeHtml(copy.ignore)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${copy.heading}\n\n${copy.body}\n\n${copy.button}: ${link}\n\n${copy.ignore}`;
  return { to, subject: copy.subject, html, text };
}

export interface ZeptoMailConfig {
  /** Send Mail token from ZeptoMail (with or without the "Zoho-enczapikey " prefix). */
  token: string;
  fromAddress: string;
  fromName: string;
  /** Regional endpoint; US by default (api.zeptomail.eu, .in, .com.au... for other data centers). */
  apiUrl?: string;
}

export function zeptoMailSender(config: ZeptoMailConfig, fetchImpl: typeof fetch = fetch): SendEmail {
  const authorization = config.token.startsWith("Zoho-enczapikey")
    ? config.token
    : `Zoho-enczapikey ${config.token}`;
  return async (message) => {
    const res = await fetchImpl(config.apiUrl ?? "https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({
        from: { address: config.fromAddress, name: config.fromName },
        to: [{ email_address: { address: message.to } }],
        subject: message.subject,
        htmlbody: message.html,
        textbody: message.text,
      }),
    });
    if (!res.ok) throw new Error(`ZeptoMail HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };
}
