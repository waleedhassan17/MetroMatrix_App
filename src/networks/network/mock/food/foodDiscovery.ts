// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food discovery rules
// ═══════════════════════════════════════════════════════
// What a customer can order from where they are, as the API decides it:
// visible vendors (approved, live, pinned, not paused in lists) that deliver
// to the point (or, for pick-up, within 25 km), the quote (straight-line
// distance, the fee band, minimum order, ETA at 22 km/h plus prep and a
// 5-minute hand-over, shown as a 10-minute window), the open state, cards,
// the recommended ranking, the customer menu and the dish sheet.
// Ported from the API's discovery and menu-read services (docs/API_FOOD.md
// §2, §4.1).

import type { MockDb } from '../mockDb';
import { dateInZone, zoneOffsetMinutes } from '../../../../utils/healthTime';
import { isoNow, openState, overrideOf } from './foodLogic';
import type { MockFoodVendor, MockMenuItem } from './foodTypes';

export const PICKUP_REACH_KM = 25;
export const RIDE_KMH = 22;
export const HANDOFF_MINUTES = 5;
export const ETA_WINDOW_MINUTES = 10;
export const NEW_DAYS = 30;
export const LOW_PORTIONS = 10;

export interface Point {
  lat: number;
  lng: number;
}

/** Straight-line distance in km, to one decimal (no paid map APIs). */
export const distanceKm = (a: Point, b: Point): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
};

/** Approved business, live branch, pinned. */
export const isVisible = (db: MockDb, v: MockFoodVendor) =>
  v.status === 'active' && v.lat !== null && v.lng !== null && db.businesses.some(b => b.id === v.businessId && b.status === 'approved');

const busyExtra = (v: MockFoodVendor, now: number) => (v.busyUntil && Date.parse(v.busyUntil) > now ? v.busyExtraMinutes : 0);

/** The band containing the distance, else the last one; no bands = free, no minimum. */
const bandFor = (v: MockFoodVendor, km: number) => {
  const sorted = [...v.feeBands].sort((a, b) => a.fromKm - b.fromKm);
  return sorted.find(b => km >= b.fromKm && km < b.toKm) ?? sorted[sorted.length - 1] ?? null;
};

export interface Quote {
  serviceable: boolean;
  distanceKm: number | null;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryOver: number | null;
  eta: { min: number; max: number };
  etaLabel: string;
  open: ReturnType<typeof openState>;
}

export const quote = (v: MockFoodVendor, fulfilment: 'delivery' | 'pickup', at: Point | null, now: number, subtotal?: number): Quote => {
  const km = at && v.lat !== null && v.lng !== null ? distanceKm(at, { lat: v.lat, lng: v.lng }) : null;
  const serviceable = fulfilment === 'pickup' ? v.acceptsPickup : v.acceptsDelivery && km !== null && km <= v.maxRadiusKm;
  const band = fulfilment === 'delivery' ? bandFor(v, km ?? 0) : null;
  const free = fulfilment === 'delivery' && v.freeDeliveryOver !== null && subtotal !== undefined && subtotal >= v.freeDeliveryOver;
  const kitchen = v.prepMinutes + busyExtra(v, now);
  const base = fulfilment === 'pickup' ? kitchen : kitchen + Math.ceil(((km ?? 0) / RIDE_KMH) * 60) + HANDOFF_MINUTES;
  const eta = { min: base, max: base + ETA_WINDOW_MINUTES };
  return {
    serviceable,
    distanceKm: km,
    deliveryFee: fulfilment === 'delivery' && !free ? band?.fee ?? 0 : 0,
    minOrder: fulfilment === 'delivery' ? band?.minOrder ?? 0 : 0,
    freeDeliveryOver: fulfilment === 'delivery' ? v.freeDeliveryOver : null,
    eta,
    etaLabel: `${eta.min}–${eta.max} min`,
    open: openState(v, now),
  };
};

export interface Deal {
  id: string;
  title: string;
  label: string;
  freeDelivery: boolean;
}

/** Live automatic deals per vendor, best first (filled in by promotions). */
export type DealsFor = (db: MockDb, v: MockFoodVendor, now: number) => Deal[];

export const cardOf = (db: MockDb, v: MockFoodVendor, q: Quote, deal: Deal | null, now: number) => ({
  id: v.brandId,
  slug: v.slug,
  name: v.name,
  tagline: v.tagline,
  logoUrl: v.logoUrl,
  coverUrl: v.coverUrl,
  brandColor: v.brandColor,
  onBrandColor: v.onBrandColor,
  cuisines: v.cuisineIds
    .map(id => db.food.cuisines.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(c => ({ name: c.name, slug: c.slug })),
  priceLevel: v.priceLevel,
  ratingAvg: v.ratingAvg,
  ratingCount: v.ratingCount,
  isHomeKitchen: v.kind === 'home_kitchen',
  isFeatured: !!v.isFeatured,
  isNew: !!v.wentLiveAt && now - Date.parse(v.wentLiveAt) < NEW_DAYS * 86_400_000,
  distanceKm: q.distanceKm,
  etaRange: { min: q.eta.min, max: q.eta.max, label: q.etaLabel },
  deliveryFee: deal?.freeDelivery ? 0 : q.deliveryFee,
  minOrder: q.minOrder,
  freeDeliveryOver: q.freeDeliveryOver,
  dealLabel: deal?.label ?? null,
  fulfilment: { delivery: v.acceptsDelivery, pickup: v.acceptsPickup },
  preorderOnly: v.preorderOnly,
  openState: { open: q.open.open, paused: q.open.paused, label: q.open.label, opensAt: q.open.opensAt },
});

export type Card = ReturnType<typeof cardOf>;

export interface Candidate {
  v: MockFoodVendor;
  q: Quote;
  deal: Deal | null;
  card: Card;
}

export interface CandidateFilter {
  pickup?: boolean;
  q?: string;
  cuisine?: string;
  minRating?: number;
  homeKitchen?: boolean;
  priceLevel?: number;
  includePaused?: boolean;
}

/** Does a vendor (its name, tagline, cuisines or a dish) match the search words? */
export const matches = (db: MockDb, v: MockFoodVendor, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [v.name, v.tagline ?? '', ...v.cuisineIds.map(id => db.food.cuisines.find(c => c.id === id)?.name ?? '')].join(' ').toLowerCase();
  return hay.includes(needle) || db.food.items.some(i => i.businessId === v.businessId && i.isActive && i.name.toLowerCase().includes(needle));
};

/** Visible vendors near a point: deliverable to it, or (pick-up) within reach. */
export const candidates = (db: MockDb, at: Point, f: CandidateFilter, now: number, dealsFor: DealsFor): Candidate[] =>
  db.food.vendors
    .filter(v => isVisible(db, v) && (f.includePaused || !v.isPaused))
    .filter(v => {
      const km = distanceKm(at, { lat: v.lat!, lng: v.lng! });
      return f.pickup ? v.acceptsPickup && km <= PICKUP_REACH_KM : v.acceptsDelivery && km <= v.maxRadiusKm;
    })
    .filter(v => !f.cuisine || v.cuisineIds.some(id => id === f.cuisine || db.food.cuisines.find(c => c.id === id)?.slug === f.cuisine))
    .filter(v => !f.minRating || v.ratingAvg >= f.minRating)
    .filter(v => !f.homeKitchen || v.kind === 'home_kitchen')
    .filter(v => !f.priceLevel || v.priceLevel === f.priceLevel)
    .filter(v => !f.q || matches(db, v, f.q))
    .map(v => {
      const q = quote(v, f.pickup ? 'pickup' : 'delivery', at, now);
      const deal = dealsFor(db, v, now)[0] ?? null;
      return { v, q, deal, card: cardOf(db, v, q, deal, now) };
    });

export const recommendedScore = (c: Candidate) => {
  const rating = c.v.ratingAvg / 5;
  const reviews = Math.min(Math.log(1 + c.v.ratingCount) / Math.log(101), 1);
  const open = c.q.open.open ? 1 : 0;
  const near = 1 - Math.min((c.q.distanceKm ?? 10) / 10, 1);
  return rating * 0.3 + reviews * 0.15 + open * 0.3 + near * 0.15 + (c.deal ? 0.05 : 0);
};

export const SORTS: Record<string, (a: Candidate, b: Candidate) => number> = {
  recommended: (a, b) => recommendedScore(b) - recommendedScore(a),
  distance: (a, b) => (a.q.distanceKm ?? 0) - (b.q.distanceKm ?? 0),
  rating: (a, b) => b.card.ratingAvg - a.card.ratingAvg || b.card.ratingCount - a.card.ratingCount,
  delivery_time: (a, b) => a.q.eta.min - b.q.eta.min,
  delivery_fee: (a, b) => a.card.deliveryFee - b.card.deliveryFee,
};

// ─── The menu customers see ──────────────────────────
const localMinutes = (now: number, tz: string) => {
  const local = new Date(now + zoneOffsetMinutes(tz, now) * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Is a daily window open at local minute `m`? Windows may wrap midnight. */
export const inWindow = (from: string | null, to: string | null, m: number) => {
  if (!from || !to) return true;
  const a = minutesOf(from);
  const b = minutesOf(to) || 1440;
  return a < b ? m >= a && m < b : m >= a || m < b;
};

/** Can the dish be ordered for `at` (default now)? null when it can, else the reason. */
export const unavailableReason = (db: MockDb, v: MockFoodVendor, i: MockMenuItem, now: number, at: number = now): string | null => {
  const c = db.food.categories.find(x => x.id === i.categoryId);
  if (!i.isActive || !c?.isActive) return 'not_on_menu';
  const o = overrideOf(i, v, now);
  if (!o.isAvailable) return 'unavailable';
  if (o.unavailableUntil && Date.parse(o.unavailableUntil) > now) return 'unavailable';
  const weekday = new Date(`${dateInZone(isoNow(at), v.timezone)}T00:00:00Z`).getUTCDay();
  if (!i.days.includes(weekday)) return 'not_today';
  if (!inWindow(c.availableFrom, c.availableTo, localMinutes(at, v.timezone))) return 'outside_hours';
  if (o.remainingToday !== null && o.remainingToday <= 0) return 'sold_out';
  return null;
};

export const fromPrice = (i: Pick<MockMenuItem, 'basePrice' | 'variants'>) => (i.variants.length ? Math.min(...i.variants.map(v => v.price)) : i.basePrice);

const dishCard = (db: MockDb, v: MockFoodVendor, i: MockMenuItem, now: number) => {
  const reason = unavailableReason(db, v, i, now);
  if (reason === 'unavailable' || reason === 'not_today' || reason === 'not_on_menu') return null;
  const remaining = overrideOf(i, v, now).remainingToday;
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    photoUrl: i.photoUrl,
    fromPrice: fromPrice(i),
    hasVariants: i.variants.length > 0,
    hasOptions: i.links.length > 0,
    tags: [...i.tags],
    isDeal: i.isDeal,
    serves: i.serves,
    available: reason === null,
    unavailableReason: reason,
    soldOut: reason === 'sold_out',
    remainingToday: remaining,
    remainingLabel: remaining !== null && remaining > 0 && remaining <= LOW_PORTIONS ? `${remaining} left today` : null,
    sold30d: i.sold30d,
  };
};

/** Categories in order with the dishes that can show; off and not-today dishes are left out, sold-out ones stay. */
export const customerMenu = (db: MockDb, v: MockFoodVendor, now: number) => {
  const items = db.food.items.filter(i => i.businessId === v.businessId && i.isActive).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const cards = new Map(items.map(i => [i.id, dishCard(db, v, i, now)]));
  const minute = localMinutes(now, v.timezone);
  const categories = db.food.categories
    .filter(c => c.businessId === v.businessId && c.isActive)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map(c => ({
      id: c.id,
      name: c.name,
      availableFrom: c.availableFrom,
      availableTo: c.availableTo,
      availableNow: inWindow(c.availableFrom, c.availableTo, minute),
      items: items.filter(i => i.categoryId === c.id).map(i => cards.get(i.id)).filter((x): x is NonNullable<typeof x> => !!x),
    }))
    .filter(c => c.items.length);
  const popular = items
    .filter(i => cards.get(i.id)?.available && i.sold30d > 0)
    .sort((a, b) => b.sold30d - a.sold30d)
    .slice(0, 6)
    .map(i => cards.get(i.id)!);
  return { categories, popular };
};

/** The groups a size offers: the shared ones plus its own. */
export const groupsFor = (db: MockDb, i: MockMenuItem, variantId: string | null) =>
  [...i.links]
    .sort((a, b) => a.sort - b.sort)
    .filter(l => l.variantId === null || l.variantId === variantId)
    .map(l => ({ link: l, group: db.food.groups.find(g => g.id === l.groupId)! }))
    .filter(x => !!x.group);

export const itemSheet = (db: MockDb, v: MockFoodVendor, i: MockMenuItem, now: number) => {
  const reason = unavailableReason(db, v, i, now);
  const category = db.food.categories.find(c => c.id === i.categoryId)!;
  const variants = [...i.variants].sort((a, b) => a.sort - b.sort || a.price - b.price);
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    photoUrl: i.photoUrl,
    tags: [...i.tags],
    isDeal: i.isDeal,
    serves: i.serves,
    basePrice: i.basePrice,
    fromPrice: fromPrice(i),
    category: { id: category.id, name: category.name },
    available: reason === null,
    unavailableReason: reason,
    remainingToday: overrideOf(i, v, now).remainingToday,
    variants: variants.map(x => ({ id: x.id, name: x.name, price: x.price, groupIds: groupsFor(db, i, x.id).map(g => g.group.id) })),
    groups: [...i.links]
      .sort((a, b) => a.sort - b.sort)
      .map(l => ({ l, g: db.food.groups.find(x => x.id === l.groupId) }))
      .filter((x): x is { l: (typeof i.links)[number]; g: NonNullable<(typeof x)['g']> } => !!x.g)
      .map(({ l, g }) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        required: g.minSelect >= 1,
        variantId: l.variantId,
        options: [...g.options]
          .sort((a, b) => a.sort - b.sort)
          .filter(o => o.isActive)
          .map(o => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, available: o.available })),
      })),
  };
};
