"use client";

import { useEffect, useRef, useState } from "react";

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
 * styles are `[data-reveal]` in globals.css). It starts hidden in the server
 * HTML, so an element already on screen when the page loads animates in
 * instead of flickering; the `[lang]` layout's noscript style shows
 * everything when JS never runs. One observer per element, disconnected
 * after it fires.
 */
export function Reveal({ children, from = "up", delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={shown ? "shown" : "hidden"}
      data-reveal-from={from}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
