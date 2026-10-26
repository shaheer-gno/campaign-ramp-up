export const LIST_PAGE_SIZE_DEFAULT = 50;
export const LIST_PAGE_SIZE_MAX = 100;
export const PREVIEW_PAGE_SIZE_DEFAULT = 100;
export const PREVIEW_PAGE_SIZE_MAX = 500;
export const APPLY_CAMPAIGN_BATCH = 50;
export const CHANGE_LOG_INSERT_CHUNK = 200;

export function normalizePage(page?: number): number {
  const n = Number(page ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function normalizePageSize(
  pageSize: number | undefined,
  fallback: number,
  max: number,
): number {
  const n = Number(pageSize ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number } {
  const total = items.length;
  const from = (page - 1) * pageSize;
  return {
    items: items.slice(from, from + pageSize),
    total,
    page,
    pageSize,
  };
}
