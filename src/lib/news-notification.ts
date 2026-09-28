/**
 * The "newest story" toast remembers, per browser, the last story the reader
 * dismissed (or opened). It shows again only when a newer story takes the top
 * spot, so the stored value is a slug, not a flag.
 */
export const NEWS_SEEN_KEY = "gsantana_news_seen";

/** How long a page stays open before the toast slides in. */
export const NEWS_NOTIFICATION_DELAY_MS = 6000;

export function readSeenStory(): string | null {
  try {
    return window.localStorage.getItem(NEWS_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markStorySeen(slug: string): void {
  try {
    window.localStorage.setItem(NEWS_SEEN_KEY, slug);
  } catch {
    // Storage blocked (private mode, disabled site data): the toast just returns next visit.
  }
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function isStoryPage(pathname: string, storyHref: string): boolean {
  return trimSlash(pathname) === trimSlash(storyHref);
}

export function shouldShowStory(slug: string, seen: string | null, pathname: string, storyHref: string): boolean {
  return seen !== slug && !isStoryPage(pathname, storyHref);
}
