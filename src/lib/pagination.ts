/** How many items each paginated list shows per page. */
export const PAGE_SIZE = {
  blog: 10,
  news: 8,
  certifications: 10,
  principles: 12,
} as const;

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageItems<T>(items: readonly T[], page: number, size: number): T[] {
  return items.slice((page - 1) * size, page * size);
}

/** Page 1 lives at the list's own URL, so links to it never change. */
export function pagePath(base: string, page: number): string {
  return page <= 1 ? base : `${base}/page/${page}`;
}

/** Params for the /page/[page] route: every page after the first. */
export function laterPageParams(total: number, size: number): { page: string }[] {
  return Array.from({ length: pageCount(total, size) - 1 }, (_, i) => ({ page: String(i + 2) }));
}

/** The page number from a /page/[page] URL, or null when it isn't one of the later pages. */
export function parsePage(value: string, total: number, size: number): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return page >= 2 && page <= pageCount(total, size) ? page : null;
}
