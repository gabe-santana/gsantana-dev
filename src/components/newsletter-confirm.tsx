"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailIcon } from "@/components/icons";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";
import { NEWSLETTER_API, type VerifyResponse, type VerifyStatus } from "@/lib/newsletter";

type State = "loading" | VerifyStatus | "error";

export function NewsletterConfirm({ labels, locale }: { labels: Dictionary["newsletter"]["confirm"]; locale: Locale }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    // Read from the URL here, not via useSearchParams: the page is statically
    // exported, and the token only exists in the visitor's link.
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(NEWSLETTER_API.verify, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const reply = (await res.json()) as VerifyResponse;
        setState(reply.status ?? "error");
        // Drop the token from the address bar so it isn't shared or bookmarked.
        window.history.replaceState(null, "", window.location.pathname);
      } catch (error) {
        console.error("[newsletter] verify failed", error);
        setState("error");
      }
    })();
  }, []);

  const copy = {
    loading: { title: labels.loadingTitle, text: "" },
    verified: { title: labels.verifiedTitle, text: labels.verifiedText },
    already: { title: labels.alreadyTitle, text: labels.alreadyText },
    invalid: { title: labels.invalidTitle, text: labels.invalidText },
    expired: { title: labels.expiredTitle, text: labels.expiredText },
    error: { title: labels.errorTitle, text: labels.errorText },
  }[state];
  const welcome = state === "verified" || state === "already";
  const retry = state === "invalid" || state === "expired";

  return (
    <div aria-live="polite" className="max-w-2xl">
      <p className="flex items-center gap-2 font-mono text-sm text-accent">
        <MailIcon className="h-4 w-4" />
        {labels.eyebrow}
      </p>
      <h1
        className={`mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl ${
          state === "loading" ? "animate-pulse text-muted" : "text-foreground"
        }`}
      >
        {welcome ? (
          <>
            {copy.title.replace(/!$/, "")}
            <span className="text-accent">!</span>
          </>
        ) : (
          copy.title
        )}
      </h1>
      {copy.text ? <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{copy.text}</p> : null}

      {state !== "loading" ? (
        <div className="mt-10 flex flex-wrap gap-4">
          {retry ? (
            <Link
              href={localePath(locale, "/news")}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-105"
            >
              {labels.subscribeAgain}
            </Link>
          ) : (
            <Link
              href={localePath(locale, "/blog")}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-105"
            >
              {labels.readBlog}
            </Link>
          )}
          <Link
            href={localePath(locale, "/news")}
            className="rounded-full border border-accent/50 px-6 py-3 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10"
          >
            {labels.goNews}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
