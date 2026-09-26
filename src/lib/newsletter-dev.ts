// Newsletter stand-ins for `next dev` (app/api/newsletter/*/route.dev.ts)
// and the tests: the real API runs as Cloudflare Pages Functions with D1,
// neither of which exists in the Next dev server.
import type { Subscriber, SendEmail, SubscriberStore } from "./newsletter-server";
import { zeptoMailSender } from "./newsletter-server";

/** Same contract as d1SubscriberStore, kept in memory. */
export function memorySubscriberStore(): SubscriberStore & { rows: Map<string, Subscriber & { ipHash: string }> } {
  const rows = new Map<string, Subscriber & { ipHash: string }>();
  return {
    rows,
    async find(email) {
      return rows.get(email) ?? null;
    },
    async findByTokenHash(hash) {
      return [...rows.values()].find((r) => r.tokenHash === hash) ?? null;
    },
    async savePending({ email, locale, tokenHash, tokenExpiresAt, now, ipHash }) {
      if (rows.get(email)?.verified) return;
      rows.set(email, { email, locale, verified: false, tokenHash, tokenExpiresAt, lastSentAt: now, ipHash });
    },
    async clearLastSent(email) {
      const row = rows.get(email);
      if (row) row.lastSentAt = null;
    },
    async countRecentByIp(ipHash, since) {
      return [...rows.values()].filter((r) => r.ipHash === ipHash && (r.lastSentAt ?? 0) > since).length;
    },
    async markVerified(email) {
      const row = rows.get(email);
      if (row) row.verified = true;
    },
  };
}

// One store per dev server process, surviving hot reloads of the route modules.
const globalDev = globalThis as { __newsletterDevStore?: ReturnType<typeof memorySubscriberStore> };
export function devSubscriberStore() {
  globalDev.__newsletterDevStore ??= memorySubscriberStore();
  return globalDev.__newsletterDevStore;
}

/**
 * Real ZeptoMail when src/.env.local has ZEPTOMAIL_TOKEN and NEWSLETTER_FROM
 * (links then point at localhost), otherwise the link is printed in the
 * `npm run dev` terminal.
 */
export function devMailer(): SendEmail {
  const { ZEPTOMAIL_TOKEN, NEWSLETTER_FROM } = process.env;
  if (ZEPTOMAIL_TOKEN && NEWSLETTER_FROM) {
    return zeptoMailSender({ token: ZEPTOMAIL_TOKEN, fromAddress: NEWSLETTER_FROM, fromName: "Gabriel Santana" });
  }
  return async (message) => console.log(`\n[newsletter:dev] confirmation for ${message.to}:\n${message.text}\n`);
}
