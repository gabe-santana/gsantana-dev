"use client";

import { useId, useState } from "react";
import { MailIcon } from "@/components/icons";
import type { Dictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { isValidEmail, NEWSLETTER_API, type SubscribeResponse } from "@/lib/newsletter";
// The Zoho Campaigns version of this form is kept, commented out, in lib/newsletter-zoho.ts.

type Status = "idle" | "sending" | "done" | "already" | "invalid" | "rateLimited" | "error";

export function NewsletterForm({ labels, locale }: { labels: Dictionary["newsletter"]; locale: Locale }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputId = useId();
  const messageId = useId();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setStatus("invalid");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch(NEWSLETTER_API.subscribe, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, website }),
      });
      const reply = (await res.json().catch(() => ({ ok: false }))) as SubscribeResponse;
      if (reply.error === "invalid_email") return setStatus("invalid");
      if (reply.error === "rate_limited") return setStatus("rateLimited");
      if (!res.ok || !reply.ok) throw new Error(`subscribe failed (HTTP ${res.status}): ${reply.error ?? "no error code"}`);
      setStatus(reply.alreadySubscribed ? "already" : "done");
      setEmail("");
    } catch (error) {
      console.error("[newsletter]", error);
      setStatus("error");
    }
  }

  const message =
    status === "done"
      ? labels.success
      : status === "already"
        ? labels.alreadyText
        : status === "invalid"
        ? labels.invalid
        : status === "rateLimited"
          ? labels.rateLimited
          : status === "error"
            ? labels.error
            : null;

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="relative mt-8 overflow-hidden border border-border bg-surface/60"
    >
      <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative grid gap-5 px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center md:gap-10">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase text-accent">
            <MailIcon className="h-3.5 w-3.5" />
            {labels.eyebrow}
          </p>
          <h2 id={`${inputId}-title`} className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            {labels.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{labels.description}</p>
        </div>

        {status === "done" || status === "already" ? (
          <div
            role="status"
            className="border border-accent/40 bg-accent/[0.06] px-4 py-4 text-sm leading-relaxed text-foreground"
          >
            <span className="mb-1 block font-mono text-[11px] uppercase text-accent">
              {status === "already" ? labels.alreadyTitle : labels.successTitle}
            </span>
            {message}
            {status === "already" ? (
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-3 block font-mono text-[11px] text-accent underline-offset-4 hover:underline"
              >
                {labels.tryAnother}
              </button>
            ) : null}
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {/* Honeypot: invisible and unfocusable for people, tempting for form-filling bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <label htmlFor={inputId} className="sr-only">
              {labels.emailLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={inputId}
                type="email"
                name="CONTACT_EMAIL"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status !== "idle" && status !== "sending") setStatus("idle");
                }}
                placeholder={labels.placeholder}
                aria-invalid={status === "invalid"}
                aria-describedby={message ? messageId : undefined}
                className="h-12 w-full min-w-0 border sm:flex-1 border-border bg-background px-4 text-foreground placeholder:text-muted transition-colors focus:border-accent/70 focus:outline-none aria-[invalid=true]:border-red-400/70"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-12 shrink-0 bg-accent px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {status === "sending" ? labels.sending : labels.submit}
              </button>
            </div>
            <p
              id={messageId}
              role={message ? "alert" : undefined}
              className={`mt-2 min-h-[1.25rem] font-mono text-[11px] ${
                message ? "text-red-300" : "text-muted"
              }`}
            >
              {message ?? labels.privacy}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
