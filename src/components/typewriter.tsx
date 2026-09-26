"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 60;
const TYPE_JITTER_MS = 60;
const DELETE_MS = 30;
const HOLD_MS = 2200;
const GAP_MS = 350;

/**
 * Types, holds, deletes and cycles through phrases. The first phrase is
 * server-rendered in full, so the static HTML, crawlers and no-JS readers
 * get a complete sentence, and there's no empty flash before hydration.
 */
export function Typewriter({ phrases }: { phrases: readonly string[] }) {
  const [text, setText] = useState(phrases[0] ?? "");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (phrases.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let index = 0;
    let current = phrases[0]!;
    let timer: ReturnType<typeof setTimeout>;

    const erase = () => {
      setIsTyping(true);
      if (current.length === 0) {
        index = (index + 1) % phrases.length;
        timer = setTimeout(type, GAP_MS);
        return;
      }
      current = current.slice(0, -1);
      setText(current);
      timer = setTimeout(erase, DELETE_MS);
    };

    const type = () => {
      const target = phrases[index]!;
      if (current === target) {
        setIsTyping(false);
        timer = setTimeout(erase, HOLD_MS);
        return;
      }
      current = target.slice(0, current.length + 1);
      setText(current);
      timer = setTimeout(type, TYPE_MS + Math.random() * TYPE_JITTER_MS);
    };

    timer = setTimeout(erase, HOLD_MS);
    return () => clearTimeout(timer);
  }, [phrases]);

  return (
    // Every phrase is stacked invisibly in the same grid cell, so the cell is
    // always as big as the widest/tallest phrase and the layout never shifts
    // while text is typed or deleted — even when a phrase wraps on mobile.
    <span className="grid">
      {phrases.map((phrase) => (
        <span
          key={phrase}
          aria-hidden
          className="invisible col-start-1 row-start-1"
        >
          {phrase}
          <span className="typewriter-caret" />
        </span>
      ))}
      <span aria-hidden className="col-start-1 row-start-1 text-accent">
        {text}
        <span className={`typewriter-caret ${isTyping ? "" : "is-idle"}`} />
      </span>
      <span className="sr-only">{phrases[0]}</span>
    </span>
  );
}
