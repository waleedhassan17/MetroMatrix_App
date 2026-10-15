// ═══════════════════════════════════════════════════════
// MetroMatrix — Food serializer (backend → app shapes)
// ═══════════════════════════════════════════════════════
// Defensive: a missing field degrades to a sensible default, and a record
// with no id or name is dropped rather than rendered half-empty.

import type { Cuisine, FoodHome, FoodPromo, Kitchen, KitchenKind } from '../types/food';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from './serializerUtils';

export const KITCHEN_KINDS: readonly KitchenKind[] = ['restaurant', 'home_kitchen', 'cloud_kitchen'];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const cuisineSerializer = (raw: unknown): Cuisine | null => {
  if (!isObject(raw)) return null;
  const slug = str(raw.slug ?? raw.id);
  const name = str(raw.name);
  return slug && name ? { slug, name } : null;
};

export const kitchenSerializer = (raw: unknown): Kitchen | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id ?? raw._id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const etaMin = Math.max(0, num(raw.etaMin, 30));
  return {
    id,
    name,
    kind: oneOf(raw.kind ?? raw.subType, KITCHEN_KINDS, 'restaurant'),
    cuisines: arr(raw.cuisines).map(c => str(c)).filter(Boolean),
    area: str(raw.area),
    rating: clamp(num(raw.rating), 0, 5),
    ratingCount: Math.max(0, Math.round(num(raw.ratingCount))),
    etaMin,
    etaMax: Math.max(etaMin, num(raw.etaMax, etaMin + 10)),
    deliveryFee: Math.max(0, num(raw.deliveryFee)),
    minOrder: Math.max(0, num(raw.minOrder)),
    priceLevel: clamp(Math.round(num(raw.priceLevel, 1)), 1, 3),
    distanceKm: Math.max(0, num(raw.distanceKm)),
    deal: strOrNull(raw.deal),
    isNew: bool(raw.isNew),
    imageUrl: strOrNull(raw.imageUrl),
  };
};

const promoSerializer = (raw: unknown): FoodPromo | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  return id && title ? { id, title, subtitle: str(raw.subtitle), code: strOrNull(raw.code) } : null;
};

const compact = <T>(items: (T | null)[]): T[] => items.filter((x): x is T => x !== null);

export const foodHomeSerializer = (raw: unknown): FoodHome => {
  const r = isObject(raw) ? raw : {};
  return {
    area: str(r.area),
    promos: compact(arr(r.promos).map(promoSerializer)),
    cuisines: compact(arr(r.cuisines).map(cuisineSerializer)),
    kitchens: compact(arr(r.kitchens).map(kitchenSerializer)),
  };
};
