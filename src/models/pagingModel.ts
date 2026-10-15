// ═══════════════════════════════════════════════════════
// MetroMatrix — Paging rules (pure; used by usePagedList)
// ═══════════════════════════════════════════════════════

import type { Paged } from '../types/shopping';

/** Rows a list asks for per page unless it says otherwise. */
export const LIST_PAGE_SIZE = 20;

/** The backend's ceiling for `pageSize`. */
export const MAX_PAGE_SIZE = 100;

/** Append a page, dropping rows already shown (a row can shift pages while scrolling). */
export const appendUnique = <T>(
  rows: T[],
  next: T[],
  keyOf: (row: T) => string | undefined = row => (row as { id?: string }).id,
): T[] => {
  const seen = new Set(rows.map(keyOf).filter(Boolean));
  return [
    ...rows,
    ...next.filter(r => {
      const k = keyOf(r);
      return !k || !seen.has(k);
    }),
  ];
};

/** Is there a page after `page`? */
export const hasMorePages = (p: Pick<Paged<unknown>, 'page' | 'pageSize' | 'total'>): boolean =>
  p.pageSize > 0 && p.page * p.pageSize < p.total;
