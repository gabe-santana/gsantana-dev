"use client";

import { useEffect, useRef } from "react";
import { drawDiagram } from "@/lib/diagrams/render";
import type { Diagram } from "@/lib/diagrams/types";

const MOBILE_BELOW = 560;

export function CanvasDiagram({ diagram }: { diagram: Diagram }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const font = getComputedStyle(canvas).fontFamily;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let active = true;
    let frame = 0;
    let lastPaint = 0;

    const paint = (time: number) => {
      const width = canvas.getBoundingClientRect().width;
      if (width === 0) return;
      const layout = width < MOBILE_BELOW ? diagram.mobile : diagram.desktop;
      // Only the aspect ratio is set, so resizing never feeds back into the
      // width the ResizeObserver is watching.
      const ratio = `${layout.width} / ${layout.height}`;
      if (canvas.style.aspectRatio !== ratio) canvas.style.aspectRatio = ratio;
      const scale = width / layout.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(layout.height * scale * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      drawDiagram(ctx, diagram, layout, motion.matches ? null : time, font);
    };

    const tick = (time: number) => {
      if (time - lastPaint >= 33) {
        paint(time);
        lastPaint = time;
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      paint(performance.now());
      if (visible && !motion.matches) frame = requestAnimationFrame(tick);
    };

    const resize = new ResizeObserver(sync);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    intersection.observe(canvas);
    motion.addEventListener("change", sync);
    document.fonts.ready.then(sync);
    sync();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", sync);
    };
  }, [diagram]);

  return (
    <figure className="canvas-diagram" data-pagefind-ignore>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={diagram.accessible}
        style={{ aspectRatio: `${diagram.desktop.width} / ${diagram.desktop.height}` }}
      >
        {diagram.accessible}
      </canvas>
    </figure>
  );
}
