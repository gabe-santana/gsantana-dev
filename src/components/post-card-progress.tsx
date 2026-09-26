"use client";

import { useEffect, useState } from "react";
import { format } from "@/lib/dictionaries";
import { getProgress } from "@/lib/reading-progress";

export function PostCardProgress({
  slug,
  labels,
}: {
  slug: string;
  labels: { percentRead: string; read: string };
}) {
  // Starts at 0 on the server and first client render (storage isn't
  // readable during SSR), then fills in after mount — no hydration mismatch.
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const sync = () => setPercent(getProgress(slug));
    sync();
    // Keeps cards in sync when the post is read in another tab.
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [slug]);

  if (percent <= 0) return null;

  const isComplete = percent >= 100;
  const label = isComplete ? labels.read : format(labels.percentRead, { percent });

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      title={label}
      className="absolute inset-x-0 bottom-0 h-[3px] bg-border/70"
    >
      <div
        className={`h-full ${
          isComplete ? "bg-accent" : "bg-gradient-to-r from-accent to-[#a78bfa]"
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
