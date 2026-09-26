"use client";

import { useEffect, useRef, useState } from "react";
import type { TocHeading } from "@/lib/rehype-extract-headings";

// A heading becomes "active" once its top passes this line — just below the
// sticky nav (h-16) plus some breathing room. Matches the heading
// scroll-margin-top in globals.css so a clicked heading lands as active.
const ACTIVE_LINE_PX = 120;
const CLICK_LOCK_MS = 900;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToHeading(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  history.replaceState(null, "", `#${id}`);
}

function useActiveHeading(headings: TocHeading[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const lockedUntil = useRef(0);

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      if (Date.now() < lockedUntil.current) return;

      const { scrollY, innerHeight } = window;
      const atBottom =
        innerHeight + scrollY >= document.documentElement.scrollHeight - 4;

      // Short final sections can never reach the active line, so the end of
      // the page always highlights the last heading.
      if (atBottom) {
        setActiveId(elements[elements.length - 1]!.id);
        return;
      }

      let current: string | null = null;
      for (const el of elements) {
        if (el.getBoundingClientRect().top > ACTIVE_LINE_PX) break;
        current = el.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  const activate = (id: string) => {
    lockedUntil.current = Date.now() + CLICK_LOCK_MS;
    setActiveId(id);
  };

  return { activeId, activate };
}

function TocLinks({
  headings,
  activeId,
  onNavigate,
}: {
  headings: TocHeading[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}) {
  return (
    <ul className="border-l border-border text-sm">
      {headings.map((heading) => {
        const isActive = heading.id === activeId;
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              data-toc-id={heading.id}
              aria-current={isActive ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(heading.id);
              }}
              className={`-ml-px block border-l-2 py-1.5 leading-snug transition-colors duration-200 ${
                heading.depth === 3 ? "pl-7 text-[0.8125rem]" : "pl-4"
              } ${
                isActive
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:border-muted hover:text-foreground"
              }`}
            >
              {heading.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export interface TocLabels {
  onThisPage: string;
  backToTop: string;
}

export function TableOfContents({
  headings,
  labels,
}: {
  headings: TocHeading[];
  labels: TocLabels;
}) {
  const { activeId, activate } = useActiveHeading(headings);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Long TOCs scroll inside the sidebar; keep the active entry in view
  // without touching the page scroll (which scrollIntoView could do).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeId) return;
    const link = scroller.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(activeId)}"]`
    );
    if (!link) return;

    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top < scroller.scrollTop + 48) {
      scroller.scrollTop = top - 48;
    } else if (bottom > scroller.scrollTop + scroller.clientHeight - 48) {
      scroller.scrollTop = bottom - scroller.clientHeight + 48;
    }
  }, [activeId]);

  return (
    <nav aria-label={labels.onThisPage} className="sticky top-24">
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">
        {labels.onThisPage}
      </p>
      <div
        ref={scrollerRef}
        className="toc-scroller relative max-h-[calc(100vh-12rem)] overflow-y-auto overscroll-contain pr-2"
      >
        <TocLinks
          headings={headings}
          activeId={activeId}
          onNavigate={(id) => {
            activate(id);
            scrollToHeading(id);
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
          history.replaceState(null, "", window.location.pathname);
        }}
        className="mt-6 text-xs text-muted transition-colors hover:text-accent"
      >
        {labels.backToTop}
      </button>
    </nav>
  );
}

export function MobileTableOfContents({
  headings,
  labels,
}: {
  headings: TocHeading[];
  labels: TocLabels;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details
      ref={detailsRef}
      className="group mb-10 rounded-xl border border-border/60 bg-surface/50"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {labels.onThisPage}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-border/60 px-4 py-3">
        <TocLinks
          headings={headings}
          activeId={null}
          onNavigate={(id) => {
            if (detailsRef.current) detailsRef.current.open = false;
            scrollToHeading(id);
          }}
        />
      </div>
    </details>
  );
}
