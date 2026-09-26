import { ParallaxLayer } from "@/components/parallax/parallax-layer";

/**
 * The faded grid + two parallax glows behind the landing hero. Place it as
 * the first child of a `relative overflow-x-clip` container: layers use
 * negative z-indexes to sit behind that container's content.
 */
export function GridBackdrop() {
  return (
    <>
      <ParallaxLayer speed={0.05} className="absolute inset-0 -z-30">
        <div className="bg-grid bg-grid-fade absolute inset-0" />
      </ParallaxLayer>

      <ParallaxLayer speed={0.18} className="absolute inset-0 -z-20">
        <div className="blob blob-accent -left-32 -top-24 h-[28rem] w-[28rem]" />
      </ParallaxLayer>

      <ParallaxLayer speed={0.32} className="absolute inset-0 -z-10">
        <div className="blob blob-violet -bottom-40 -right-24 h-[32rem] w-[32rem]" />
      </ParallaxLayer>
    </>
  );
}
