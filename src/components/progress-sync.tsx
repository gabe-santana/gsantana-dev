"use client";

import { useEffect } from "react";
import { PROGRESS_SAVED_EVENT } from "@/lib/reading-progress";
import {
  consumeSignInReturn,
  flushProgress,
  pullProgress,
  recordProgressForSync,
} from "@/lib/user-client";

/** Mounted once in the layout; renders nothing. See lib/user-client.ts for the sync policy. */
export function ProgressSync() {
  useEffect(() => {
    const freshSignIn = consumeSignInReturn();
    void pullProgress({ force: freshSignIn });

    const onSaved = (event: Event) => {
      const { key, percent } = (event as CustomEvent<{ key: string; percent: number }>).detail;
      recordProgressForSync(key, percent);
    };
    // pagehide covers closing and navigating away; visibilitychange covers
    // switching tabs or apps on mobile, where pagehide may never fire.
    const flush = () => void flushProgress({ beacon: true });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener(PROGRESS_SAVED_EVENT, onSaved);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(PROGRESS_SAVED_EVENT, onSaved);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
