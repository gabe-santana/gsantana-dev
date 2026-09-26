"use client";

import { useEffect } from "react";
import { PROXY_PATHS } from "@/lib/clarity-proxy";

// Only the real site records: previews and `next dev` would fill the
// dashboard with test sessions.
const PRODUCTION_HOST = "gsantana.dev";

/**
 * Loads Microsoft Clarity through the first-party proxy (functions/r/*),
 * after the page is interactive. Skipped when the browser sends Global
 * Privacy Control, a legally recognized opt-out signal.
 */
export function SessionInsights() {
  useEffect(() => {
    if (window.location.hostname !== PRODUCTION_HOST) return;
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const w = window as Window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } };
    if (w.clarity) return;
    // Clarity's official queue stub: calls made before the script loads are replayed.
    const stub = ((...args: unknown[]) => {
      (stub.q = stub.q || []).push(args);
    }) as ((...args: unknown[]) => void) & { q?: unknown[] };
    w.clarity = stub;
    const script = document.createElement("script");
    script.async = true;
    script.src = PROXY_PATHS.tag;
    document.head.appendChild(script);
  }, []);

  return null;
}
