// ═══════════════════════════════════════════════════════
// MetroMatrix — Food discovery serializers (what customers browse)
// ═══════════════════════════════════════════════════════
// The home, vendor lists, a vendor's page with its menu, the dish sheet and
// search → the app's shapes (types/food.ts). Defensive: a missing field is a
// sensible default, never a crash.
// docs/API_FOOD.md §2 (VendorCard, VendorPage, ItemSheet) and §4.1.

import type {
  DishCard,
  DishHit,
  EtaRange,
  FoodDeal,
  FoodHome,
  FoodSearchResult,
  ItemSheet,
  ItemTag,
  MenuSection,
  SheetGroup,
  VendorCard,
  VendorPage,
} from '../../types/food';
import type { Paged } from '../../types/payments';
import type { HygieneStatus, VendorBadge } from '../../types/kitchen';
import { arr, bool, isObject, num, str, strOrNull } from '../serializerUtils';
import { foodCuisinesSerializer } from './vendorSerializer';
import { ITEM_TAGS } from './menuSerializer';
import { foodHomeBannersSerializer, ratingSummarySerializer } from './reviewSerializer';
import { tiffinPlanCardSerializer } from '../kitchen/growthSerializer';

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const intOrNull = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
};
const hhmm = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
};
const tags = (v: unknown): ItemTag[] => arr(v).filter((t): t is ItemTag => ITEM_TAGS.includes(t as ItemTag));

const etaSerializer = (raw: unknown): EtaRange => {
  const r = isObject(raw) ? raw : {};
  const min = Math.max(0, Math.round(num(r.min)));
  const max = Math.max(min, Math.round(num(r.max, min)));
  return { min, max, label: str(r.label, `${min}–${max} min`) };
};

const VENDOR_BADGES: readonly VendorBadge[] = ['signature', 'hygiene_verified', 'hygiene_self_declared', 'home_kitchen', 'bachat_today', 'under_600', 'high_protein'];
const HYGIENE: readonly HygieneStatus[] = ['none', 'self_declared', 'pending', 'verified', 'rejected'];
const hhmmPair = (v: unknown) => (isObject(v) && str(v.from) && str(v.to) ? { from: str(v.from), to: str(v.to) } : null);

export const vendorCardSerializer = (raw: unknown): VendorCard | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.slug)) return null;
  const f = isObject(raw.fulfilment) ? raw.fulfilment : {};
  const o = isObject(raw.openState) ? raw.openState : {};
  return {
    id: str(raw.id),
    slug: str(raw.slug),
    name: str(raw.name),
    tagline: strOrNull(raw.tagline),
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    brandColor: str(raw.brandColor, '#B4532A'),
    onBrandColor: str(raw.onBrandColor, '#FFFFFF'),
    cuisines: compact(arr(raw.cuisines).map(c => (isObject(c) && str(c.name) ? { name: str(c.name), slug: str(c.slug) } : null))),
    priceLevel: Math.max(1, Math.min(3, Math.round(num(raw.priceLevel, 2)))),
    ratingAvg: Math.max(0, Math.min(5, num(raw.ratingAvg))),
    ratingCount: Math.max(0, Math.round(num(raw.ratingCount))),
    isHomeKitchen: bool(raw.isHomeKitchen),
    isFeatured: bool(raw.isFeatured),
    isNew: bool(raw.isNew),
    distanceKm: numOrNull(raw.distanceKm),
    eta: etaSerializer(raw.etaRange),
    deliveryFee: Math.max(0, Math.round(num(raw.deliveryFee))),
    minOrder: Math.max(0, Math.round(num(raw.minOrder))),
    freeDeliveryOver: intOrNull(raw.freeDeliveryOver),
    dealLabel: strOrNull(raw.dealLabel),
    fulfilment: { delivery: f.delivery !== false, pickup: bool(f.pickup) },
    preorderOnly: bool(raw.preorderOnly),
    openState: { open: bool(o.open), paused: bool(o.paused), label: str(o.label, bool(o.open) ? 'Open' : 'Closed'), opensAt: isoOrNull(o.opensAt) },
    // Kitchen Intelligence's addition (TODO(API_KITCHEN)).
    badges: arr(raw.badges).filter((b): b is VendorBadge => VENDOR_BADGES.includes(b as VendorBadge)),
  };
};

const cards = (raw: unknown): VendorCard[] => compact(arr(raw).map(vendorCardSerializer));

export const foodHomeSerializer = (raw: unknown): FoodHome | null => {
  if (!isObject(raw)) return null;
  const c = isObject(raw.coverage) ? raw.coverage : {};
  return {
    coverage: { delivering: bool(c.delivering), message: strOrNull(c.message), pickupNearby: Math.max(0, Math.round(num(c.pickupNearby))) },
    cuisines: foodCuisinesSerializer(raw.cuisines),
    banners: foodHomeBannersSerializer(raw.banners),
    orderAgain: cards(raw.orderAgain),
    offers: cards(raw.offers),
    homeKitchens: cards(raw.homeKitchens),
    topRated: cards(raw.topRated),
    fastest: cards(raw.fastest),
    newOnFoodCourt: cards(raw.newOnFoodCourt),
    freeDelivery: cards(raw.freeDelivery),
  };
};

export const vendorCardsPageSerializer = (raw: unknown): Paged<VendorCard> => {
  const r = isObject(raw) ? raw : {};
  const page = Math.max(1, Math.round(num(r.page, 1)));
  const pageSize = Math.max(1, Math.round(num(r.pageSize, 20)));
  const total = Math.max(0, Math.round(num(r.total)));
  return { items: cards(r.items), page, pageSize, total };
};

export const dishCardSerializer = (raw: unknown): DishCard | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    name: str(raw.name),
    description: strOrNull(raw.description),
    photoUrl: strOrNull(raw.photoUrl),
    fromPrice: Math.max(0, Math.round(num(raw.fromPrice))),
    hasVariants: bool(raw.hasVariants),
    hasOptions: bool(raw.hasOptions),
    tags: tags(raw.tags),
    isDeal: bool(raw.isDeal),
    serves: intOrNull(raw.serves),
    available: raw.available !== false,
    unavailableReason: strOrNull(raw.unavailableReason),
    soldOut: bool(raw.soldOut),
    remainingToday: intOrNull(raw.remainingToday),
    remainingLabel: strOrNull(raw.remainingLabel),
    sold30d: Math.max(0, Math.round(num(raw.sold30d))),
  };
};

const sectionSerializer = (raw: unknown): MenuSection | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const items = compact(arr(raw.items).map(dishCardSerializer));
  if (!items.length) return null;
  return {
    id: str(raw.id),
    name: str(raw.name),
    availableFrom: hhmm(raw.availableFrom),
    availableTo: hhmm(raw.availableTo),
    availableNow: raw.availableNow !== false,
    items,
  };
};

const dealSerializer = (raw: unknown): FoodDeal | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), title: str(raw.title), label: str(raw.label, str(raw.title)), freeDelivery: bool(raw.freeDelivery) } : null;

export const vendorPageSerializer = (raw: unknown): VendorPage | null => {
  const card = vendorCardSerializer(raw);
  if (!card || !isObject(raw)) return null;
  const loc = isObject(raw.location) ? raw.location : {};
  const d = isObject(raw.delivery) ? raw.delivery : null;
  const p = isObject(raw.pickup) ? raw.pickup : null;
  return {
    ...card,
    paused: bool(raw.paused),
    pauseMessage: strOrNull(raw.pauseMessage),
    location: {
      addressLine: strOrNull(loc.addressLine),
      area: strOrNull(loc.area),
      city: strOrNull(loc.city),
      lat: numOrNull(loc.lat),
      lng: numOrNull(loc.lng),
      phone: strOrNull(loc.phone),
    },
    delivery: d
      ? { available: bool(d.available), outOfZone: bool(d.outOfZone), fee: Math.max(0, Math.round(num(d.fee))), minOrder: Math.max(0, Math.round(num(d.minOrder))), eta: etaSerializer(d.etaRange) }
      : null,
    pickup: p ? { readyIn: etaSerializer(p.readyIn) } : null,
    acceptsCod: raw.acceptsCod !== false,
    deals: compact(arr(raw.deals).map(dealSerializer)),
    ratingSummary: ratingSummarySerializer(raw.ratingSummary),
    menu: compact(arr(raw.menu).map(sectionSerializer)),
    popular: compact(arr(raw.popular).map(dishCardSerializer)),
    // Kitchen Intelligence's additions (TODO(API_KITCHEN)).
    tiffinPlans: compact(arr(raw.tiffinPlans).map(tiffinPlanCardSerializer)),
    catering: isObject(raw.catering)
      ? { open: bool(raw.catering.open), minGuests: Math.max(0, Math.round(num(raw.catering.minGuests))), leadDays: Math.max(0, Math.round(num(raw.catering.leadDays))) }
      : null,
    story:
      isObject(raw.story) && str(raw.story.text)
        ? { text: str(raw.story.text), cookName: str(raw.story.cookName), photoUrls: arr(raw.story.photoUrls).map(u => str(u)).filter(Boolean), videoUrl: strOrNull(raw.story.videoUrl) }
        : null,
    hygiene: {
      status: isObject(raw.hygiene) && HYGIENE.includes(raw.hygiene.status as HygieneStatus) ? (raw.hygiene.status as HygieneStatus) : 'none',
      checkedAt: isObject(raw.hygiene) ? isoOrNull(raw.hygiene.checkedAt) : null,
    },
    signatureItemIds: arr(raw.signatureItemIds).map(x => str(x)).filter(Boolean),
    ramadan: (() => {
      const r = isObject(raw.ramadan) ? raw.ramadan : null;
      const sehri = r ? hhmmPair(r.sehri) : null;
      const iftar = r ? hhmmPair(r.iftar) : null;
      return r && sehri && iftar ? { sehri, iftar, iftarPreorderOnly: bool(r.iftarPreorderOnly) } : null;
    })(),
  };
};

const groupSerializer = (raw: unknown): SheetGroup | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const minSelect = Math.max(0, Math.round(num(raw.minSelect)));
  return {
    id: str(raw.id),
    name: str(raw.name),
    minSelect,
    maxSelect: Math.max(1, Math.round(num(raw.maxSelect, 1))),
    required: raw.required !== undefined ? bool(raw.required) : minSelect >= 1,
    variantId: strOrNull(raw.variantId),
    options: compact(
      arr(raw.options).map(o =>
        isObject(o) && str(o.id)
          ? { id: str(o.id), name: str(o.name), priceDelta: Math.max(0, Math.round(num(o.priceDelta))), isDefault: bool(o.isDefault), available: o.available !== false }
          : null,
      ),
    ),
  };
};

export const itemSheetSerializer = (raw: unknown): ItemSheet | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const cat = isObject(raw.category) ? raw.category : {};
  return {
    id: str(raw.id),
    name: str(raw.name),
    description: strOrNull(raw.description),
    photoUrl: strOrNull(raw.photoUrl),
    tags: tags(raw.tags),
    isDeal: bool(raw.isDeal),
    serves: intOrNull(raw.serves),
    basePrice: Math.max(0, Math.round(num(raw.basePrice))),
    fromPrice: Math.max(0, Math.round(num(raw.fromPrice, num(raw.basePrice)))),
    category: { id: str(cat.id), name: str(cat.name) },
    available: raw.available !== false,
    unavailableReason: strOrNull(raw.unavailableReason),
    remainingToday: intOrNull(raw.remainingToday),
    variants: compact(
      arr(raw.variants).map(v =>
        isObject(v) && str(v.id)
          ? { id: str(v.id), name: str(v.name), price: Math.max(0, Math.round(num(v.price))), groupIds: arr(v.groupIds).map(g => str(g)).filter(Boolean) }
          : null,
      ),
    ),
    groups: compact(arr(raw.groups).map(groupSerializer)),
  };
};

const dishHitSerializer = (raw: unknown): DishHit | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), name: str(raw.name), photoUrl: strOrNull(raw.photoUrl), fromPrice: Math.max(0, Math.round(num(raw.fromPrice))), tags: tags(raw.tags) }
    : null;

export const foodSearchSerializer = (raw: unknown): FoodSearchResult => {
  const r = isObject(raw) ? raw : {};
  return {
    vendors: cards(r.vendors),
    dishes: compact(
      arr(r.dishes).map(g => {
        if (!isObject(g)) return null;
        const vendor = vendorCardSerializer(g.vendor);
        const items = compact(arr(g.items).map(dishHitSerializer));
        return vendor && items.length ? { vendor, items } : null;
      }),
    ),
  };
};
