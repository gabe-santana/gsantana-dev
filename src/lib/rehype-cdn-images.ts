import { visit } from "unist-util-visit";
import type { Root } from "hast";

/**
 * Rewrites root-relative <img src="/..."> in rendered post HTML to point
 * at the media CDN. This covers raw HTML <img> tags typed directly into
 * post markdown, which — unlike JSX cover images — never pass through the
 * mediaUrl() helper. Absolute URLs are left untouched; with no CDN
 * configured, this is a no-op and images keep resolving to /public as-is.
 */
export function rehypeCdnImages() {
  const cdnBase = process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.replace(/\/$/, "");

  return (tree: Root) => {
    if (!cdnBase) return;

    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;

      const src = node.properties.src;
      if (typeof src !== "string" || /^https?:\/\//.test(src)) return;

      node.properties.src = `${cdnBase}${src.startsWith("/") ? src : `/${src}`}`;
    });
  };
}
