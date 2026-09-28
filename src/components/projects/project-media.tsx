import Image from "next/image";
import { CanvasDiagram } from "@/components/canvas-diagram";
import { IsometricArt } from "@/components/projects/isometric-art";
import { getDiagram } from "@/lib/diagrams";
import type { Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { localized, type ProjectMedia } from "@/lib/projects";

interface ProjectMediaViewProps {
  media: ProjectMedia;
  locale: Locale;
  /** The address shown in a browser frame's bar. */
  address?: string;
  /** Pre-rendered code window HTML for code media (renderMarkdown runs in the page). */
  codeHtml?: string;
  sizes?: string;
}

export function ProjectMediaView({ media, locale, address, codeHtml, sizes = "(min-width: 1024px) 640px, 100vw" }: ProjectMediaViewProps) {
  if (media.kind === "diagram") {
    const diagram = getDiagram(media.id, locale);
    if (!diagram) throw new Error(`Unknown project diagram "${media.id}"`);
    return (
      <div className="prose-post project-diagram rounded-lg shadow-2xl shadow-black/40">
        <CanvasDiagram diagram={diagram} />
      </div>
    );
  }

  if (media.kind === "art") return <IsometricArt />;

  if (media.kind === "code") {
    return (
      <div
        className="prose-post project-code text-left"
        dangerouslySetInnerHTML={{ __html: codeHtml ?? "" }}
      />
    );
  }

  const image = (
    <Image
      src={mediaUrl(media.src)}
      alt={localized(media.alt, locale)}
      width={media.width}
      height={media.height}
      sizes={sizes}
      loading="lazy"
      className="block h-auto w-full"
    />
  );

  switch (media.frame) {
    case "browser":
      return (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-surface shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-3 py-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            {address ? (
              <span className="ml-2 truncate rounded-md bg-surface px-2.5 py-0.5 font-mono text-[0.7rem] text-muted">
                {address}
              </span>
            ) : null}
          </div>
          {image}
        </div>
      );
    case "phone":
      return (
        <div className="overflow-hidden rounded-[1.6rem] border-[5px] border-[#1d2230] bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10">
          {image}
        </div>
      );
    case "paper":
      return (
        <div className="overflow-hidden rounded-xl bg-white p-2 shadow-2xl shadow-black/50 ring-1 ring-black/5 sm:p-3">
          {image}
        </div>
      );
    case "plain":
      return <div className="overflow-hidden rounded-xl shadow-2xl shadow-black/50">{image}</div>;
  }
}
