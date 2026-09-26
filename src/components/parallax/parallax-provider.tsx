"use client";

import { createContext, useContext, useEffect, useRef } from "react";

type Listener = (scrollY: number) => void;

interface ParallaxContextValue {
  subscribe: (listener: Listener) => () => void;
}

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

/**
 * Single scroll listener + rAF loop shared by every ParallaxLayer on the
 * page. Layers mutate their own DOM node directly instead of going through
 * React state, so an arbitrary number of parallax layers costs one listener
 * and one rAF callback total, not one per layer.
 */
export function ParallaxProvider({ children }: { children: React.ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const ticking = useRef(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const notify = () => {
      const scrollY = window.scrollY;
      for (const listener of listeners.current) listener(scrollY);
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(notify);
    };

    notify();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const subscribe = (listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  };

  return (
    <ParallaxContext.Provider value={{ subscribe }}>
      {children}
    </ParallaxContext.Provider>
  );
}

export function useParallax() {
  return useContext(ParallaxContext);
}
