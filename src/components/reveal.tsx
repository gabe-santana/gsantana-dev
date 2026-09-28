"use client";

import { useEffect, useRef } from "react";

export type RevealFrom = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: React.ReactNode;
  /** Where the element comes from as it animates into place. */
  from?: RevealFrom;
  /** Stagger, in ms, so siblings arrive one after the other. */
  delay?: number;
  className?: string;
}

/**
 * Animates its content into place the first time it scrolls into view (the
 * styles are `[data-reveal]` in globals.css). Only content that starts below
 * the fold is hidden, and only once JS runs, so the first screen never
 * flickers and readers without JS see everything. One observer per element,
 * disconnected after it fires.
 */
export function Reveal({ children, from = "up", delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal-from={from}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
