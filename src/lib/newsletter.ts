// Newsletter pieces shared by the browser (form, confirm page) and the Pages
// Functions (functions/api/newsletter/*). No `@/` imports: the Functions
// bundler doesn't know the alias. Server-only logic is in newsletter-server.ts.

export const NEWSLETTER_API = {
  subscribe: "/api/newsletter/subscribe",
  verify: "/api/newsletter/verify",
} as const;

/** Where the verification email's link lands (followed by ?token=...). */
export const CONFIRM_PATH = "/newsletter/confirm/";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && EMAIL.test(email);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface SubscribeRequest {
  email: string;
  locale: string;
  /** Honeypot: hidden from people, filled in by naive bots. */
  website?: string;
}

export type SubscribeError = "invalid_email" | "rate_limited" | "send_failed" | "bad_request";

export interface SubscribeResponse {
  ok: boolean;
  error?: SubscribeError;
  /** The address was already confirmed: nothing was sent. */
  alreadySubscribed?: boolean;
}

export type VerifyStatus = "verified" | "already" | "invalid" | "expired";

export interface VerifyResponse {
  status: VerifyStatus;
}
