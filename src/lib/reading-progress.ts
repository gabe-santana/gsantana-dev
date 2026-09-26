const STORAGE_KEY = "gsantana:reading-progress";

// Past this, the reader has effectively finished; the last lines of a post
// often can't reach the exact end of the measured range.
const COMPLETE_AT = 98;

type ProgressMap = Record<string, number>;

// localStorage can be missing or throw (private mode, blocked storage), so
// every access degrades to "no progress" instead of breaking the page.
function readAll(): ProgressMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

/** Furthest point reached in a post, as a whole percentage (0–100). */
export function getProgress(slug: string): number {
  const value = readAll()[slug];
  return typeof value === "number" ? value : 0;
}

/** Records progress, keeping only the furthest point ever reached. */
export function saveProgress(slug: string, percent: number): void {
  const normalized = percent >= COMPLETE_AT ? 100 : Math.round(percent);
  try {
    const all = readAll();
    if ((all[slug] ?? 0) >= normalized) return;
    all[slug] = normalized;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: progress just isn't remembered.
  }
}
