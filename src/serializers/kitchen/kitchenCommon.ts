// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen serializers: the shared readers
// ═══════════════════════════════════════════════════════
// Base units, a counting (unit, dozens, the kitchen's own units), a cost
// card and lists of rows the app can't read dropped. Defensive like every
// serializer: a missing field is a sensible default, never a crash.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §2.

import type { Cost, Counting, IngredientCategory } from '../../types/kitchen';
import { BASE_UNITS, STANDARD_UNITS, type BaseUnit, type StandardUnit } from '../../utils/units';
import { arr, bool, isObject, num, oneOf, str } from '../serializerUtils';

export const INGREDIENT_CATEGORIES: readonly IngredientCategory[] = [
  'meat_poultry',
  'vegetables',
  'fruit',
  'dairy',
  'grains_flour',
  'spices',
  'oils_ghee',
  'bakery',
  'drinks',
  'packaging',
  'other',
];

export const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
export const list = <T>(raw: unknown, f: (x: unknown) => T | null): T[] => compact(arr(raw).map(f));

/** Whole base units, rupees (whole), counts: never negative unless the API says so (stock can be). */
export const whole = (v: unknown) => Math.round(num(v));
export const count = (v: unknown) => Math.max(0, Math.round(num(v)));
export const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
export const intOrNull = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
};
export const pct = (v: unknown) => Math.max(0, Math.min(100, Math.round(num(v))));

export const baseUnit = (v: unknown): BaseUnit => oneOf(v, BASE_UNITS, 'g');
export const standardUnit = (v: unknown, fallback: StandardUnit = 'kg'): StandardUnit => oneOf(v, STANDARD_UNITS, fallback);
export const category = (v: unknown): IngredientCategory => oneOf(v, INGREDIENT_CATEGORIES, 'other');

export const countingOf = (raw: Record<string, unknown>): Counting => ({
  baseUnit: baseUnit(raw.baseUnit),
  dozens: bool(raw.dozens),
  customUnits: list(raw.customUnits, u => (isObject(u) && str(u.name) && num(u.base) > 0 ? { name: str(u.name), base: Math.round(num(u.base)) } : null)),
});

export const costSerializer = (raw: unknown): Cost | null => {
  if (!isObject(raw)) return null;
  return {
    toMake: count(raw.toMake),
    sellPrice: count(raw.sellPrice),
    keep: whole(raw.keep),
    keepPct: Math.round(num(raw.keepPct)),
    foodCostPct: count(raw.foodCostPct),
    overTarget: bool(raw.overTarget),
  };
};

/** "YYYY-MM-DD", or null. */
export const dateOrNull = (v: unknown): string | null => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
