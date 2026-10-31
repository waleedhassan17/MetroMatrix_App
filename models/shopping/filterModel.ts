// ═══════════════════════════════════════════════════════
// MetroMatrix — Product list filters (ported from the FYP's filter model)
// ═══════════════════════════════════════════════════════
// The FYP kept ONE global filter state and wiped it on leaving the list. Here
// filters are kept per context (a store, a category, a search), keyed by
// filterContextKey, so coming back to "Kurtas" shows the filters you left.

import type { ProductQuery, ProductSort } from '../../types/shopping';
import type { ValidationErrors } from '../authModel';

export interface ProductFilters {
  sort: ProductSort;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  inStock: boolean;
  onSale: boolean;
  categoryId: string | null;
}

export const DEFAULT_FILTERS: ProductFilters = {
  sort: 'relevance',
  minPrice: null,
  maxPrice: null,
  minRating: null,
  inStock: false,
  onSale: false,
  categoryId: null,
};

export const SORT_OPTIONS: { key: ProductSort; label: string }[] = [
  { key: 'relevance', label: 'Recommended' },
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'rating', label: 'Top rated' },
  { key: 'trending', label: 'Trending' },
];

export const sortLabel = (sort: ProductSort) => SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Recommended';

/** "Under Rs X" presets (the FYP's). */
export const PRICE_PRESETS = [1500, 2500, 3500, 5000, 10000];
export const RATING_PRESETS = [4, 3];

/** The badge on "Filter (n)": everything but the sort. */
export const activeFilterCount = (f: ProductFilters, opts: { ignoreCategory?: boolean } = {}): number =>
  [
    f.minPrice !== null || f.maxPrice !== null,
    f.minRating !== null,
    f.inStock,
    f.onSale,
    !opts.ignoreCategory && f.categoryId !== null,
  ].filter(Boolean).length;

export const validatePriceRange = (min: number | null, max: number | null): ValidationErrors =>
  min !== null && max !== null && min > max ? { price: 'The minimum is above the maximum' } : {};

/** The request for a page: the screen's context, then the person's filters. */
export const toProductQuery = (context: ProductQuery, f: ProductFilters): ProductQuery => ({
  ...context,
  categoryId: f.categoryId ?? context.categoryId,
  sort: f.sort,
  minPrice: f.minPrice,
  maxPrice: f.maxPrice,
  minRating: f.minRating,
  inStock: f.inStock || undefined,
  onSale: f.onSale || undefined,
});

/** Stable key for a list context, e.g. "store:abc|q:kurta". */
export const filterContextKey = (context: ProductQuery): string =>
  (['storeId', 'categoryId', 'collectionId', 'q'] as const)
    .filter(k => context[k])
    .map(k => `${k}:${String(context[k]).toLowerCase()}`)
    .join('|') || 'all';
