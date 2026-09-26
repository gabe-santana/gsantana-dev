import { describe, expect, it, vi } from "vitest";
import { onRequestPost as subscribeFn } from "../src/functions/api/newsletter/subscribe";
import { isValidEmail } from "@/lib/newsletter";
import { memorySubscriberStore } from "@/lib/newsletter-dev";
import {
  handleSubscribe,
  handleVerify,
  IP_HOURLY_LIMIT,
  RESEND_COOLDOWN_MS,
  sha256Hex,
  TOKEN_TTL_MS,
  verificationEmail,
  zeptoMailSender,
  type OutgoingEmail,
} from "@/lib/newsletter-server";

function setup(now = 1_800_000_000_000) {
  const store = memorySubscriberStore();
  const rows = store.rows;
  const sent: OutgoingEmail[] = [];
  const deps = {
    store,
    send: vi.fn(async (m: OutgoingEmail) => void sent.push(m)),
    now,
    siteOrigin: "https://gsantana.dev",
    ip: "203.0.113.7",
    ipSalt: "salt",
  };
  const tokenFrom = (m: OutgoingEmail) => m.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
  return { store, rows, sent, deps, tokenFrom };
}

describe("isValidEmail", () => {
  it("accepts plausible addresses and rejects obvious typos", () => {
    expect(isValidEmail("contact@gsantana.dev")).toBe(true);
    expect(isValidEmail("  someone@example.com.br ")).toBe(true);
    expect(isValidEmail("someone@example")).toBe(false);
    expect(isValidEmail("someone example.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@x.io`)).toBe(false);
  });
});

describe("subscribe", () => {
  it("stores a pending, lower-cased subscriber and emails a link to the confirm page in their language", async () => {
    const { rows, sent, deps, tokenFrom } = setup();
    const res = await handleSubscribe({ email: " Reader@Example.com ", locale: "pt-br" }, deps);

    expect(res).toEqual({ status: 200, body: { ok: true } });
    const row = rows.get("reader@example.com")!;
    expect(row.verified).toBe(false);
    expect(row.locale).toBe("pt-br");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("reader@example.com");
    expect(sent[0]!.subject).toMatch(/Confirme/);
    expect(sent[0]!.text).toContain("https://gsantana.dev/pt-br/newsletter/confirm/?token=");
    // Only the hash is stored, never the token itself.
    const token = tokenFrom(sent[0]!);
    expect(row.tokenHash).toBe(await sha256Hex(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.tokenExpiresAt).toBe(deps.now + TOKEN_TTL_MS);
  });

  it("rejects invalid addresses without touching the store", async () => {
    const { rows, deps } = setup();
    expect(await handleSubscribe({ email: "nope", locale: "en-us" }, deps)).toEqual({
      status: 400,
      body: { ok: false, error: "invalid_email" },
    });
    expect(rows.size).toBe(0);
  });

  it("answers bots that fill the honeypot like people, but does nothing", async () => {
    const { rows, deps } = setup();
    expect((await handleSubscribe({ email: "bot@example.com", locale: "en-us", website: "x" }, deps)).status).toBe(200);
    expect(rows.size).toBe(0);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("doesn't resend within the cooldown, and doesn't reveal that the address is known", async () => {
    const { sent, deps } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    const again = await handleSubscribe({ email: "a@example.com", locale: "en-us" }, { ...deps, now: deps.now + 60_000 });
    expect(again).toEqual({ status: 200, body: { ok: true } });
    expect(sent).toHaveLength(1);

    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, { ...deps, now: deps.now + RESEND_COOLDOWN_MS + 1 });
    expect(sent).toHaveLength(2);
  });

  it("tells a confirmed subscriber they're already in, without emailing them again", async () => {
    const { sent, deps, tokenFrom } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    await handleVerify(tokenFrom(sent[0]!), deps);
    const later = { ...deps, now: deps.now + RESEND_COOLDOWN_MS * 10 };
    expect(await handleSubscribe({ email: " A@Example.com ", locale: "en-us" }, later)).toEqual({
      status: 200,
      body: { ok: true, alreadySubscribed: true },
    });
    expect(sent).toHaveLength(1);
  });

  it("answers a pending (unconfirmed) address like a new one", async () => {
    const { deps } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    const again = await handleSubscribe({ email: "a@example.com", locale: "en-us" }, { ...deps, now: deps.now + 1000 });
    expect(again.body.alreadySubscribed).toBeUndefined();
  });

  it("limits how many different addresses one IP can sign up per hour", async () => {
    const { deps } = setup();
    for (let i = 0; i < IP_HOURLY_LIMIT; i++) {
      expect((await handleSubscribe({ email: `u${i}@example.com`, locale: "en-us" }, deps)).status).toBe(200);
    }
    expect(await handleSubscribe({ email: "one-more@example.com", locale: "en-us" }, deps)).toEqual({
      status: 429,
      body: { ok: false, error: "rate_limited" },
    });
    const otherIp = await handleSubscribe({ email: "other@example.com", locale: "en-us" }, { ...deps, ip: "198.51.100.1" });
    expect(otherIp.status).toBe(200);
  });

  it("reports a failed send and lets the visitor retry right away", async () => {
    const { rows, deps } = setup();
    const failing = { ...deps, send: vi.fn(async () => Promise.reject(new Error("smtp down"))) };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await handleSubscribe({ email: "a@example.com", locale: "en-us" }, failing)).toEqual({
      status: 502,
      body: { ok: false, error: "send_failed" },
    });
    expect(rows.get("a@example.com")!.lastSentAt).toBeNull();
    expect((await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps)).status).toBe(200);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("falls back to English for unknown locales", async () => {
    const { sent, deps } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "fr-fr" }, deps);
    expect(sent[0]!.text).toContain("/en-us/newsletter/confirm/");
  });
});

describe("verify", () => {
  it("verifies once, then reports it as already done", async () => {
    const { rows, sent, deps, tokenFrom } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    const token = tokenFrom(sent[0]!);
    expect(await handleVerify(token, deps)).toBe("verified");
    expect(rows.get("a@example.com")!.verified).toBe(true);
    expect(await handleVerify(token, deps)).toBe("already");
  });

  it("rejects expired, unknown and malformed tokens", async () => {
    const { sent, deps, tokenFrom } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    const token = tokenFrom(sent[0]!);
    expect(await handleVerify(token, { ...deps, now: deps.now + TOKEN_TTL_MS + 1 })).toBe("expired");
    expect(await handleVerify("A".repeat(43), deps)).toBe("invalid");
    expect(await handleVerify("short", deps)).toBe("invalid");
    expect(await handleVerify(undefined, deps)).toBe("invalid");
  });

  it("invalidates the previous link when a new one is sent", async () => {
    const { sent, deps, tokenFrom } = setup();
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, deps);
    await handleSubscribe({ email: "a@example.com", locale: "en-us" }, { ...deps, now: deps.now + RESEND_COOLDOWN_MS + 1 });
    expect(await handleVerify(tokenFrom(sent[0]!), deps)).toBe("invalid");
    expect(await handleVerify(tokenFrom(sent[1]!), deps)).toBe("verified");
  });
});

describe("verification email", () => {
  it("escapes the link in HTML and keeps a plain-text version", () => {
    const email = verificationEmail("en-us", "a@example.com", 'https://gsantana.dev/x?token=a"b');
    expect(email.html).not.toContain('token=a"b');
    expect(email.html).toContain("token=a&#34;b");
    expect(email.text).toContain('token=a"b');
  });
});

describe("ZeptoMail sender", () => {
  it("posts ZeptoMail's JSON shape with the token as a Zoho-enczapikey header", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 })) as unknown as typeof fetch;
    const send = zeptoMailSender(
      { token: "abc123", fromAddress: "newsletter@gsantana.dev", fromName: "Gabriel Santana" },
      fetchImpl
    );
    await send({ to: "a@example.com", subject: "S", html: "<p>H</p>", text: "T" });

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe("https://api.zeptomail.com/v1.1/email");
    expect(new Headers(init!.headers).get("Authorization")).toBe("Zoho-enczapikey abc123");
    expect(JSON.parse(String(init!.body))).toEqual({
      from: { address: "newsletter@gsantana.dev", name: "Gabriel Santana" },
      to: [{ email_address: { address: "a@example.com" } }],
      subject: "S",
      htmlbody: "<p>H</p>",
      textbody: "T",
    });
  });

  it("throws on an error response so the caller can report send_failed", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad token", { status: 401 })) as unknown as typeof fetch;
    const send = zeptoMailSender({ token: "Zoho-enczapikey x", fromAddress: "a@b.co", fromName: "n" }, fetchImpl);
    await expect(send({ to: "a@example.com", subject: "S", html: "", text: "" })).rejects.toThrow(/401/);
  });
});

describe("POST /api/newsletter/subscribe", () => {
  it("refuses cross-site requests", async () => {
    const request = new Request("https://gsantana.dev/api/newsletter/subscribe", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", locale: "en-us" }),
    });
    const res = await subscribeFn({ request, env: { DB: {} as never } });
    expect(res.status).toBe(403);
  });
});
