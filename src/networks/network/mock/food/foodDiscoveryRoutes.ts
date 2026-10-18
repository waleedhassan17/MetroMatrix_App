// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food discovery routes (signed in or not)
// ═══════════════════════════════════════════════════════
// GET /food/home, /food/vendors, /food/vendors/:slug, /food/items/:id and
// /food/search, as the API answers them (foodDiscovery holds the rules).
// TODO(API_FOOD): mirrors the API's committed discovery routes.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { FoodError, invalid } from './foodLogic';
import {
  SORTS,
  candidates,
  cardOf,
  customerMenu,
  isVisible,
  itemSheet,
  quote,
  type Candidate,
  type DealsFor,
  type Point,
} from './foodDiscovery';
import type { MockFoodVendor } from './foodTypes';

const bool = (v: unknown) => v === 'true' || v === true;

/** `?lat&lng`, required: 400 VALIDATION_FAILED naming both, as the API does. */
const pointOf = (q: Record<string, any>, required = true): Point | null => {
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const okLat = q.lat !== undefined && q.lat !== '' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const okLng = q.lng !== undefined && q.lng !== '' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (okLat && okLng) return { lat, lng };
  if (!required && q.lat === undefined && q.lng === undefined) return null;
  const fields: Record<string, string[]> = {};
  if (!okLat) fields.lat = ['lat must be a latitude string or number'];
  if (!okLng) fields.lng = ['lng must be a longitude string or number'];
  throw new FoodError(400, 'VALIDATION_FAILED', Object.values(fields)[0][0], { fields });
};

export interface DiscoveryHooks {
  dealsFor: DealsFor;
  /** Vendors this customer ordered from, most recent first (brand ids). */
  orderAgain: (db: MockDb, user: MockUser) => string[];
  /** The live banners for the city (or everywhere). */
  banners: (db: MockDb, city: string | null, now: number) => unknown[];
  /** The vendor page's rating block. */
  ratingSummary: (db: MockDb, v: MockFoodVendor) => unknown;
}

export function registerDiscoveryRoutes(route: ShopKit['route'], optionalUser: ShopKit['optionalUser'], hooks: DiscoveryHooks) {
  const visibleBySlug = (ctx: ShopCtx, slug: string): MockFoodVendor => {
    const v = ctx.db.food.vendors.find(x => (x.slug === slug || x.brandId === slug) && isVisible(ctx.db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    return v;
  };

  route('GET', '/food/home', ctx => {
    const at = pointOf(ctx.query)!;
    const user = optionalUser(ctx);
    const list = candidates(ctx.db, at, {}, ctx.now, hooks.dealsFor);
    const pickupNearby = candidates(ctx.db, at, { pickup: true }, ctx.now, hooks.dealsFor).length;
    const open = list.filter(c => c.q.open.open);
    const top = (xs: Candidate[], n = 10) => xs.slice(0, n).map(c => c.card);
    const again = user?.role === 'customer' ? hooks.orderAgain(ctx.db, user) : [];
    return {
      coverage: { delivering: list.length > 0, message: list.length ? null : 'Not delivering here yet', pickupNearby },
      cuisines: ctx.db.food.cuisines
        .filter(c => c.isActive)
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
        .map(c => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon })),
      banners: hooks.banners(ctx.db, list[0]?.v.city ?? null, ctx.now),
      orderAgain: again
        .map(id => list.find(c => c.card.id === id)?.card)
        .filter(Boolean)
        .slice(0, 10),
      offers: top(open.filter(c => c.deal)),
      homeKitchens: top(list.filter(c => c.v.kind === 'home_kitchen')),
      topRated: top([...open].filter(c => c.card.ratingCount > 0).sort((a, b) => b.card.ratingAvg - a.card.ratingAvg)),
      fastest: top([...open].sort((a, b) => a.q.eta.min - b.q.eta.min)),
      newOnFoodCourt: top(list.filter(c => c.card.isNew)),
      freeDelivery: top(open.filter(c => c.card.deliveryFee === 0)),
    };
  });

  route('GET', '/food/vendors', ctx => {
    const q = ctx.query;
    const at = pointOf(q)!;
    const sort = String(q.sort ?? 'recommended');
    if (!SORTS[sort]) throw invalid('sort', `sort must be one of the following values: ${Object.keys(SORTS).join(', ')}`);
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20));
    let list = candidates(
      ctx.db,
      at,
      {
        pickup: bool(q.pickup),
        q: q.q ? String(q.q) : undefined,
        cuisine: q.cuisine ? String(q.cuisine) : undefined,
        minRating: q.minRating ? Number(q.minRating) : undefined,
        homeKitchen: bool(q.homeKitchen),
        priceLevel: q.priceLevel ? Number(q.priceLevel) : undefined,
      },
      ctx.now,
      hooks.dealsFor,
    );
    if (bool(q.openNow)) list = list.filter(c => c.q.open.open);
    if (bool(q.offers)) list = list.filter(c => c.deal);
    if (bool(q.freeDelivery)) list = list.filter(c => c.card.deliveryFee === 0);
    // Open vendors first for every sort; then the sort; then id for stable pages.
    list.sort((a, b) => Number(b.q.open.open) - Number(a.q.open.open) || SORTS[sort](a, b) || a.card.id.localeCompare(b.card.id));
    const start = (page - 1) * pageSize;
    return { items: list.slice(start, start + pageSize).map(c => c.card), total: list.length, page, pageSize };
  });

  route('GET', '/food/vendors/:slug', ctx => {
    const v = visibleBySlug(ctx, decodeURIComponent(ctx.params[0]));
    const at = pointOf(ctx.query, false);
    const deals = hooks.dealsFor(ctx.db, v, ctx.now);
    const q = quote(v, 'delivery', at, ctx.now);
    const card = cardOf(ctx.db, v, q, deals[0] ?? null, ctx.now);
    const pickup = quote(v, 'pickup', at, ctx.now);
    const menu = customerMenu(ctx.db, v, ctx.now);
    return {
      ...card,
      paused: v.isPaused,
      pauseMessage: v.isPaused ? v.pauseMessage || 'Not taking orders right now' : null,
      location: { addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng, phone: v.phone },
      delivery: at
        ? { available: v.acceptsDelivery && q.serviceable, outOfZone: v.acceptsDelivery && !q.serviceable, fee: card.deliveryFee, minOrder: q.minOrder, etaRange: card.etaRange }
        : null,
      pickup: v.acceptsPickup ? { readyIn: { min: pickup.eta.min, max: pickup.eta.max, label: pickup.etaLabel } } : null,
      acceptsCod: v.acceptsCod,
      deals,
      ratingSummary: hooks.ratingSummary(ctx.db, v),
      menu: menu.categories,
      popular: menu.popular,
    };
  });

  route('GET', '/food/items/:id', ctx => {
    const i = ctx.db.food.items.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.isActive);
    const v = i ? ctx.db.food.vendors.find(x => x.businessId === i.businessId && isVisible(ctx.db, x)) : undefined;
    if (!i || !v) throw new FoodError(404, 'NOT_FOUND', 'Dish not found.');
    return itemSheet(ctx.db, v, i, ctx.now);
  });

  route('GET', '/food/search', ctx => {
    const text = String(ctx.query.q ?? '').trim();
    if (!text) throw invalid('q', 'q should not be empty');
    const at = pointOf(ctx.query)!;
    const list = candidates(ctx.db, at, { q: text }, ctx.now, hooks.dealsFor);
    if (!list.length) return { vendors: [], dishes: [] };
    const needle = text.toLowerCase();
    const ordered = [...list].sort((a, b) => Number(b.q.open.open) - Number(a.q.open.open) || (a.q.distanceKm ?? 0) - (b.q.distanceKm ?? 0));
    const dishesOf = (c: Candidate) =>
      ctx.db.food.items
        .filter(i => i.businessId === c.v.businessId && i.isActive && i.name.toLowerCase().includes(needle))
        .filter(i => ctx.db.food.categories.some(cat => cat.id === i.categoryId && cat.isActive))
        .sort((a, b) => b.sold30d - a.sold30d || a.name.localeCompare(b.name));
    return {
      vendors: ordered.filter(c => !dishesOf(c).length || c.card.name.toLowerCase().includes(needle)).map(c => c.card),
      dishes: ordered
        .filter(c => dishesOf(c).length)
        .map(c => ({
          vendor: c.card,
          items: dishesOf(c)
            .slice(0, 5)
            .map(i => ({ id: i.id, name: i.name, photoUrl: i.photoUrl, fromPrice: i.variants.length ? Math.min(...i.variants.map(x => x.price)) : i.basePrice, tags: [...i.tags] })),
        })),
    };
  });
}
