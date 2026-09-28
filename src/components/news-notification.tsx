"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isStoryPage,
  markStorySeen,
  NEWS_NOTIFICATION_DELAY_MS,
  NEWS_SEEN_KEY,
  readSeenStory,
  shouldShowStory,
} from "@/lib/news-notification";

interface NewsNotificationProps {
  story: { slug: string; href: string; title: string; image: string };
  labels: { eyebrow: string; read: string; close: string };
}

/**
 * A toast in the bottom-left corner announcing the newest news story, after
 * the reader has spent a few seconds on the page. Dismissing it (or opening
 * the story) stores the story's slug, so it stays away until a newer story is
 * published. Storage is read again right before showing and followed across
 * tabs, so a dismissal anywhere hides it everywhere.
 */
export function NewsNotification({ story, labels }: NewsNotificationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (isStoryPage(pathname, story.href)) {
      markStorySeen(story.slug);
      setShown(false);
      setOpen(false);
      return;
    }
    if (!shouldShowStory(story.slug, readSeenStory(), pathname, story.href)) return;
    const timer = window.setTimeout(() => {
      if (shouldShowStory(story.slug, readSeenStory(), window.location.pathname, story.href)) setOpen(true);
    }, NEWS_NOTIFICATION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, story.slug, story.href]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === NEWS_SEEN_KEY && event.newValue === story.slug) setOpen(false);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [story.slug]);

  // Mount first, then flip the class on the next frame, so the entry transition runs.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function dismiss() {
    markStorySeen(story.slug);
    setShown(false);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <aside
      role="status"
      aria-label={labels.eyebrow}
      className={`fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-surface/95 p-3 shadow-[0_18px_48px_-12px_rgb(0_0_0/0.8)] backdrop-blur transition duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div className="flex gap-3">
        <Link
          href={story.href}
          onClick={() => markStorySeen(story.slug)}
          className="group flex min-w-0 flex-1 gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a small thumbnail already sized by the CDN */}
          <img
            src={story.image}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] shrink-0 rounded-xl border border-border/60 object-cover"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              {labels.eyebrow}
            </span>
            <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">
              {story.title}
            </span>
            <span className="mt-1 inline-block font-mono text-[11px] text-accent">
              {labels.read} <span aria-hidden="true">&rarr;</span>
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.close}
          title={labels.close}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
