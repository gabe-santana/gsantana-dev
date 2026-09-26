/**
 * Resolves a post/site media reference to its final URL.
 * - Absolute URLs (http/https) pass through untouched.
 * - Root-relative paths ("/covers/foo.jpg") are prefixed with the media
 *   CDN when one is configured, and otherwise served from /public as-is.
 */
export function mediaUrl(src: string): string {
  if (/^https?:\/\//.test(src)) return src;

  const cdnBase = process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.replace(/\/$/, "");
  if (!cdnBase) return src;

  return `${cdnBase}${src.startsWith("/") ? src : `/${src}`}`;
}
