"use client";

import { useEffect, useRef } from "react";
import { useParallax } from "@/components/parallax/parallax-provider";

interface ParallaxLayerProps {
  children: React.ReactNode;
  /**
   * Movement relative to scroll. 0 = pinned, 1 = scrolls at page speed,
   * negative = moves opposite to scroll. Small values (0.1–0.4) read as
   * "background depth"; values above 1 overshoot for foreground emphasis.
   */
  speed?: number;
  className?: string;
}

export function ParallaxLayer({
  children,
  speed = 0.2,
  className,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const parallax = useParallax();

  useEffect(() => {
    if (!parallax) return;
    const node = ref.current;
    if (!node) return;

    return parallax.subscribe((scrollY) => {
      const offset = scrollY * speed;
      node.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
  }, [parallax, speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
