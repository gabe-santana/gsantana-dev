"use client";

import { useEffect, useRef } from "react";
import { saveProgress } from "@/lib/reading-progress";

/**
 * Fixed bar at the very top of the viewport that tracks how far through the
 * post body the reader currently is (it goes back down when they scroll up).
 * The furthest point reached is persisted for the post cards.
 */
export function ReadingProgressBar({
  slug,
  targetId,
  label,
}: {
  slug: string;
  targetId: string;
  label: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    const bar = barRef.current;
    if (!target || !bar) return;

    let frame = 0;
    let lastSaved = 0;

    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const ratio =
        scrollable <= 0
          ? rect.bottom <= window.innerHeight
            ? 1
            : 0
          : Math.min(1, Math.max(0, -rect.top / scrollable));

      // Written straight to the DOM: no React re-render per scroll frame.
      bar.style.transform = `scaleX(${ratio})`;
      const percent = Math.round(ratio * 100);
      bar.setAttribute("aria-valuenow", String(percent));

      if (percent > lastSaved) {
        lastSaved = percent;
        saveProgress(slug, percent);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Images and fonts loading change the post's height after first paint.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(target);

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [slug, targetId]);

  return (
    <div
      ref={barRef}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      style={{ transform: "scaleX(0)" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-accent to-[#a78bfa] shadow-[0_0_10px_rgb(94_234_212/0.5)] will-change-transform"
    />
  );
}
