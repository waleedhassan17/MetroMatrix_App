// ═══════════════════════════════════════════════════════
// MetroMatrix — Food discovery wording and presets
// ═══════════════════════════════════════════════════════
// The home's rails and what "See all" opens, the list's sorts and filters,
// and how a vendor card says its time, fee, distance and state. Money only
// through formatPKR; no commission is ever implied (the fee is the vendor's).

import type { Address, FoodPoint, VendorCard, VendorListQuery, VendorSort } from '../../types';
import { formatPKR } from '../../utils/money';

export type FoodRail = 'orderAgain' | 'offers' | 'topRated' | 'fastest' | 'homeKitchens' | 'newOnFoodCourt' | 'freeDelivery';

/** The home's rails, in order; `list` is what "See all" opens (none: no matching filter). */
export const RAILS: { key: FoodRail; title: string; subtitle?: string; list?: Partial<VendorListQuery> }[] = [
  { key: 'orderAgain', title: 'Order again' },
  { key: 'offers', title: 'Deals near you', list: { offers: true } },
  { key: 'topRated', title: 'Top rated', subtitle: 'Loved by people nearby', list: { sort: 'rating', minRating: 4 } },
  { key: 'fastest', title: 'Fastest to you', list: { sort: 'delivery_time', openNow: true } },
  { key: 'homeKitchens', title: 'Home kitchens', subtitle: 'Cooked fresh by your neighbours', list: { homeKitchen: true } },
  { key: 'freeDelivery', title: 'Free delivery', list: { freeDelivery: true } },
  { key: 'newOnFoodCourt', title: 'New on Food Court' },
];

export const railList = (key: FoodRail) => RAILS.find(r => r.key === key)?.list ?? {};
export const railTitle = (key: FoodRail) => RAILS.find(r => r.key === key)?.title ?? 'Restaurants';

export const SORTS: { key: VendorSort; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'distance', label: 'Nearest' },
  { key: 'rating', label: 'Top rated' },
  { key: 'delivery_time', label: 'Fastest' },
  { key: 'delivery_fee', label: 'Lowest fee' },
];

export type VendorFilter = 'openNow' | 'freeDelivery' | 'offers' | 'rating4' | 'homeKitchen' | 'pickup';

export const FILTERS: { key: VendorFilter; label: string }[] = [
  { key: 'openNow', label: 'Open now' },
  { key: 'freeDelivery', label: 'Free delivery' },
  { key: 'offers', label: 'Deals' },
  { key: 'rating4', label: '4+ rating' },
  { key: 'homeKitchen', label: 'Home kitchens' },
  { key: 'pickup', label: 'Pick-up' },
];

/** The list query for a point, a sort and the chosen filters. */
export const listQuery = (point: Pick<FoodPoint, 'lat' | 'lng'>, base: Partial<VendorListQuery>, sort: VendorSort, filters: VendorFilter[]): VendorListQuery => ({
  ...base,
  lat: point.lat,
  lng: point.lng,
  sort,
  ...(filters.includes('openNow') ? { openNow: true } : null),
  ...(filters.includes('freeDelivery') ? { freeDelivery: true } : null),
  ...(filters.includes('offers') ? { offers: true } : null),
  ...(filters.includes('rating4') ? { minRating: 4 } : null),
  ...(filters.includes('homeKitchen') ? { homeKitchen: true } : null),
  ...(filters.includes('pickup') ? { pickup: true } : null),
});

/** The filters a "See all" preset starts with (so its chips show ticked). */
export const filtersOf = (q: Partial<VendorListQuery>): VendorFilter[] =>
  [
    q.openNow ? 'openNow' : null,
    q.freeDelivery ? 'freeDelivery' : null,
    q.offers ? 'offers' : null,
    q.minRating && q.minRating >= 4 ? 'rating4' : null,
    q.homeKitchen ? 'homeKitchen' : null,
    q.pickup ? 'pickup' : null,
  ].filter((x): x is VendorFilter => !!x);

// ─── Cards ────────────────────────────────────────────
/** "Rs", "Rs Rs", "Rs Rs Rs". */
export const priceLevelLabel = (n: number) => Array.from({ length: Math.max(1, Math.min(3, n)) }, () => 'Rs').join(' ');

/** "4.6 (312)", or "New" before the first ratings. */
export const ratingLabel = (c: Pick<VendorCard, 'ratingAvg' | 'ratingCount'>) => (c.ratingCount ? `${c.ratingAvg.toFixed(1)} (${c.ratingCount})` : 'New');

/** "Free delivery" or "Rs 99 delivery". The fee goes to the vendor; Food Court adds nothing. */
export const feeLabel = (c: Pick<VendorCard, 'deliveryFee'>) => (c.deliveryFee === 0 ? 'Free delivery' : `${formatPKR(c.deliveryFee)} delivery`);

export const distanceLabel = (km: number | null) => (km === null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** "27–37 min · Rs 99 delivery · 0.7 km" — or the pick-up time when collecting. */
export const cardLine = (c: VendorCard, pickup = false) =>
  [pickup ? `Ready in ${c.eta.label}` : c.eta.label, pickup ? 'Pick-up' : feeLabel(c), distanceLabel(c.distanceKm)].filter(Boolean).join(' · ');

/** "Pakistani · Biryani · Rs Rs". */
export const cuisineLine = (c: Pick<VendorCard, 'cuisines' | 'priceLevel'>) => [...c.cuisines.map(x => x.name), priceLevelLabel(c.priceLevel)].join(' · ');

/** What a closed or paused card says over its photo, or null when open. */
export const closedLabel = (c: Pick<VendorCard, 'openState'>) => (c.openState.open ? null : c.openState.label);

// ─── Where to deliver ─────────────────────────────────
export const ADDRESS_LABEL: Record<Address['label'], string> = { home: 'Home', work: 'Work', other: 'Other' };

/** A saved address as a delivery point (only addresses with a map pin can be). */
export const pointOfAddress = (a: Address): FoodPoint | null =>
  a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng, label: `${ADDRESS_LABEL[a.label]} · ${a.area}`, addressId: a.id } : null;
