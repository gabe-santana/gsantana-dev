"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { linkClarity, PageView, sendInsights, touchSession, visitorId } from "@/lib/access-insights-client";

/**
 * Mounted once in the layout, after SessionInsights (so Clarity's queue stub
 * exists); renders nothing. Sends one beacon when a page view starts and
 * another whenever the page is hidden or left, carrying the visible time and
 * scroll depth so far. See lib/access-insights-server.ts.
 */
export function AccessInsights() {
  const pathname = usePathname();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    const visitor = visitorId();
    const session = touchSession();
    const firstLoad = previousUrl.current === null;
    const view = new PageView(
      { visitorId: visitor, sessionId: session.id },
      session.isNew,
      // After a client-side navigation document.referrer still names the
      // landing page's referrer, so the previous page takes its place.
      firstLoad ? document.referrer : previousUrl.current!,
      firstLoad
    );
    linkClarity({ visitorId: visitor, sessionId: session.id, viewId: view.id });
    sendInsights(view.payload());

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        view.measureScroll();
      });
    };
    // pagehide covers closing and navigating away; visibilitychange covers
    // switching tabs or apps on mobile, where pagehide may never fire.
    const onVisibility = () => {
      view.visibilityChanged();
      if (document.visibilityState === "hidden") sendInsights(view.payload());
    };
    const onPageHide = () => sendInsights(view.payload());

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      cancelAnimationFrame(frame);
      // A client-side navigation ends this view; the next effect starts the new one.
      sendInsights(view.payload());
      previousUrl.current = window.location.origin + view.url;
    };
  }, [pathname]);

  return null;
}
