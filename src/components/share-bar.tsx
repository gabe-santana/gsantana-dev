"use client";

import { useEffect, useId, useState } from "react";
import {
  BlueskyIcon,
  CheckIcon,
  FacebookIcon,
  LinkedInIcon,
  LinkIcon,
  MailIcon,
  RedditIcon,
  ShareIcon,
  TelegramIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/icons";
import {
  COPY_SOURCE,
  NATIVE_SOURCE,
  NETWORK_NAMES,
  SHARE_NETWORKS,
  shareHref,
  taggedUrl,
  type ShareNetwork,
} from "@/lib/share";

const ICONS: Record<ShareNetwork, React.ComponentType<{ className?: string }>> = {
  linkedin: LinkedInIcon,
  whatsapp: WhatsAppIcon,
  x: XIcon,
  bluesky: BlueskyIcon,
  reddit: RedditIcon,
  telegram: TelegramIcon,
  facebook: FacebookIcon,
  email: MailIcon,
};

const COPIED_MS = 2000;

// The top strip stays one row on phones: the networks most shared to here,
// plus copy and the device share sheet, which reaches every other app.
const PHONE_TOP_NETWORKS = new Set<ShareNetwork>(["linkedin", "whatsapp", "x"]);

export interface ShareBarLabels {
  heading: string;
  /** "Share on {network}" */
  shareOn: string;
  copyLink: string;
  copied: string;
  more: string;
}

function trackShare(target: string) {
  (window as Window & { clarity?: (...args: unknown[]) => void }).clarity?.("event", `share_${target}`);
}

/**
 * Article share row, in two placements: "top" is a compact strip right under
 * the title and description, "bottom" the full row after the last paragraph.
 * The network links are plain anchors, so they work without JS; copy and the
 * device share sheet need it and only appear once mounted.
 */
export function ShareBar({
  url,
  title,
  labels,
  placement,
}: {
  url: string;
  title: string;
  labels: ShareBarLabels;
  placement: "top" | "bottom";
}) {
  const headingId = useId();
  const compact = placement === "top";
  const [mounted, setMounted] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(taggedUrl(url, COPY_SOURCE));
      setCopied(true);
      trackShare(COPY_SOURCE);
    } catch {
      // Clipboard blocked (permissions, insecure context): nothing to undo.
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url: taggedUrl(url, NATIVE_SOURCE) });
      trackShare(NATIVE_SOURCE);
    } catch {
      // The reader closed the share sheet.
    }
  };

  const size = compact ? "h-9" : "h-10";
  const iconOnly = compact ? "w-9" : "w-10";
  const button =
    `inline-flex ${size} items-center justify-center rounded-full border border-border/60 bg-surface/50 text-muted transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

  return (
    <section
      aria-labelledby={headingId}
      data-pagefind-ignore
      className={compact ? "mb-10 flex flex-wrap items-center gap-x-4 gap-y-3" : "mt-14"}
    >
      {compact ? (
        <p id={headingId} className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          {labels.heading}
        </p>
      ) : (
        <h2 id={headingId} className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
          {labels.heading}
        </h2>
      )}
      <ul className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-4 gap-2.5"}`}>
        {SHARE_NETWORKS.map((network) => {
          const Icon = ICONS[network];
          const label = labels.shareOn.replace("{network}", NETWORK_NAMES[network]);
          return (
            <li key={network} className={compact && !PHONE_TOP_NETWORKS.has(network) ? "max-sm:hidden" : undefined}>
              <a
                href={shareHref(network, url, title)}
                target={network === "email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                onClick={() => trackShare(network)}
                className={`${button} ${iconOnly}`}
              >
                <Icon className="h-4 w-4" />
              </a>
            </li>
          );
        })}
        {mounted ? (
          <li>
            <button
              type="button"
              onClick={copy}
              aria-label={compact ? (copied ? labels.copied : labels.copyLink) : undefined}
              title={compact ? labels.copyLink : undefined}
              className={`${button} ${compact ? iconOnly : "gap-2 px-4 text-sm"}`}
            >
              {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <LinkIcon className="h-4 w-4" />}
              {compact ? null : <span aria-live="polite">{copied ? labels.copied : labels.copyLink}</span>}
            </button>
          </li>
        ) : null}
        {canNativeShare ? (
          <li>
            <button
              type="button"
              onClick={nativeShare}
              aria-label={compact ? labels.more : undefined}
              title={compact ? labels.more : undefined}
              className={`${button} ${compact ? iconOnly : "gap-2 px-4 text-sm"}`}
            >
              <ShareIcon className="h-4 w-4" />
              {compact ? null : <span>{labels.more}</span>}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
