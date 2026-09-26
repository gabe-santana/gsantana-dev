const STORAGE_KEY = "gsantana:reading-progress";

/** Fired on window after a local save; the sync layer (lib/progress-sync.ts) batches these for the server. */
export const PROGRESS_SAVED_EVENT = "gsantana:progress-saved";
/** Fired on window when progress changed from outside this page (merged from the server). */
export const PROGRESS_UPDATED_EVENT = "gsantana:progress-updated";

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
    return;
  }
  window.dispatchEvent(new CustomEvent(PROGRESS_SAVED_EVENT, { detail: { key: slug, percent: normalized } }));
}

export function getAllProgress(): ProgressMap {
  return readAll();
}

/**
 * Merges progress from another device, keeping the furthest point per
 * article. Doesn't fire PROGRESS_SAVED_EVENT: this data came from the server.
 */
export function mergeProgress(incoming: ProgressMap): boolean {
  let changed = false;
  try {
    const all = readAll();
    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value === "number" && value > (all[key] ?? 0)) {
        all[key] = value;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  if (changed) window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
  return changed;
}
