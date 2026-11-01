// MetroMatrix — My Kitchen and the customer's nutrition: wire → app.
// docs/API_KITCHEN.md §33–35. Pantry amounts arrive in kitchen units and are kept in base
// units; recipe suggestions carry no amounts; a profile that doesn't exist is nutrition off.

import type {
  Activity,
  BodyMetrics,
  DishFacts,
  GroceryOption,
  GroceryOrder,
  HomeRecipe,
  Macros,
  MissingItem,
  NutritionGoal,
  NutritionSettings,
  NutritionSummary,
  PantryItem,
  PantryList,
  PantryReminders,
  PantryState,
  PantryStats,
  RecipeIdea,
} from '../../models/myKitchen';
import { arr, bool, bodiesOf, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list, numOrNull } from '../kitchen/kitchenCommon';
import type { BaseUnit } from '../../utils/units/units';

const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);
const GOALS: readonly NutritionGoal[] = ['maintain', 'lose', 'gain'];
const ACTIVITIES: readonly Activity[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

/** The pantry's units (g, kg, ml, l, piece, dozen, pack) in base units; a pack counts as one piece. */
const toBase = (qty: number, unit: string): { qty: number; unit: BaseUnit } => {
  switch (unit) {
    case 'kg':
      return { qty: qty * 1000, unit: 'g' };
    case 'l':
      return { qty: qty * 1000, unit: 'ml' };
    case 'dozen':
      return { qty: qty * 12, unit: 'pc' };
    case 'g':
    case 'ml':
      return { qty, unit };
    default:
      return { qty, unit: 'pc' };
  }
};

const stateOf = (raw: Record<string, unknown>): PantryState =>
  raw.status === 'expired' || (numOrNull(raw.daysLeft) ?? 0) < 0 ? 'expired' : bool(raw.expiring) ? 'use_soon' : 'fresh';

export const pantryItemSerializer = fromResponse((raw: unknown): PantryItem | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const q = toBase(Math.max(0, num(raw.qty)), str(raw.unit));
  return {
    id: str(raw.id),
    name: str(raw.name),
    key: strOrNull(raw.canonical),
    qty: q.qty,
    unit: q.unit,
    expiresOn: dateOrNull(raw.expiresOn),
    state: stateOf(raw),
    source: oneOf(raw.source, ['manual', 'voice', 'shopping'] as const, 'manual'),
    addedAt: str(raw.createdAt),
  };
});

const itemsOf = (raw: unknown) => list(isObject(raw) ? raw.items : raw, pantryItemSerializer);
const totalOf = (raw: unknown) => (isObject(raw) && raw.total !== undefined ? count(raw.total) : itemsOf(raw).length);

/** The segment's items, counted against what is in the pantry, what expires soon and what has expired. */
export const pantryListSerializer = (parts: { items: unknown; active: unknown; expiring: unknown; expired: unknown }): PantryList => {
  const raw = bodiesOf(parts);
  return { counts: { all: totalOf(raw.active), use_soon: itemsOf(raw.expiring).length, expired: totalOf(raw.expired) }, items: itemsOf(raw.items) };
};

/** What was just added: one item, or `{ items }` from a batch or from orders. */
export const pantryItemsSerializer = fromResponse((raw: unknown): PantryItem[] => {
  const one = isObject(raw) && str(raw.id) ? pantryItemSerializer(raw) : null;
  return one ? [one] : itemsOf(raw);
});

/** GET /stats (the last 30 days) and how much is in the pantry now. */
export const pantryStatsSerializer = (parts: { stats: unknown; active: unknown }): PantryStats | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.stats)) return null;
  return { used: count(raw.stats.used), savedFromWaste: 0, wasted: count(raw.stats.expired) + count(raw.stats.discarded), inKitchen: totalOf(raw.active) };
};

/** Reminders: on the hour ("09:00"), some days before (0: only on the day). */
export const pantryRemindersSerializer = fromResponse((raw: unknown): PantryReminders => {
  const r = isObject(raw) ? raw : {};
  return { enabled: bool(r.enabled, true), time: str(r.time, '09:00').slice(0, 5), daysBefore: Math.min(3, count(r.daysBefore)) };
});

/** Delivered grocery lines not yet in the pantry, grouped by their Shopping order. */
export const groceryOrdersSerializer = fromResponse((raw: unknown): GroceryOrder[] => {
  const lines = list(isObject(raw) ? raw.items : raw, l => (isObject(l) && str(l.storeOrderItemId) ? l : null));
  const orders = new Map<string, GroceryOrder>();
  for (const l of lines) {
    const id = str(l.storeOrderId);
    const o = orders.get(id) ?? { orderId: id, code: str(l.orderCode), storeName: '', placedAt: '', status: 'delivered', lines: [] };
    o.lines.push({ lineId: str(l.storeOrderItemId), name: str(l.name), quantity: 1, netQuantity: toBase(Math.max(0, num(l.qty)), str(l.unit)), alreadyAdded: false, suggestedExpiresOn: dateOrNull(l.suggestedExpiresOn) });
    orders.set(id, o);
  }
  return [...orders.values()];
});

const macrosOf = (raw: unknown): Macros | null =>
  isObject(raw) && numOrNull(raw.kcal) !== null ? { kcal: count(raw.kcal), protein: count(raw.proteinG ?? raw.protein), carbs: count(raw.carbsG ?? raw.carbs), fat: count(raw.fatG ?? raw.fat) } : null;

/** A dish's estimated numbers, a serving: the item sheet's `{ perServing, method }`, or the vendor page's `nutritionByItem` entry `{ kcal, proteinG, method }`. */
export const dishFactsSerializer = (raw: unknown): DishFacts | null => {
  if (!isObject(raw)) return null;
  const m = macrosOf(isObject(raw.perServing) ? raw.perServing : raw);
  return m ? { ...m, method: raw.method === 'recipe' ? 'recipe' : 'ai_estimate', serves: 1 } : null;
};

type Row = Record<string, unknown>;
const recipesOf = (raw: unknown): Row[] => list(isObject(raw) ? raw.recipes : raw, r => (isObject(r) && str(r.key) && str(r.title) ? r : null));

const ideaOf = (r: Row): RecipeIdea => {
  const uses = list(r.uses, u => (isObject(u) && str(u.name) ? u : null));
  return {
    id: str(r.key),
    title: str(r.title),
    titleUr: strOrNull(r.titleUr),
    why: strOrNull(r.why),
    searchTerm: str(r.title),
    minutes: count(r.minutes),
    servings: Math.max(1, count(r.servings)),
    have: uses.map(u => str(u.name)),
    missing: strings(r.missing),
    usesExpiring: uses.filter(u => bool(u.expiring)).map(u => str(u.name)),
    nutrition: null,
  };
};

/** POST /recipes/suggest: what to cook, the dishes using what expires first leading; within the time asked for. */
export const recipeIdeasSerializer = fromResponse((raw: unknown, maxMinutes: number | null = null): RecipeIdea[] =>
  recipesOf(raw)
    .map(ideaOf)
    .filter(r => !maxMinutes || !r.minutes || r.minutes <= maxMinutes));

/** One suggested recipe (from the same answer): its pantry items, what's missing, the steps. */
export const homeRecipeSerializer = fromResponse((raw: unknown, id: string): HomeRecipe | null => {
  const r = recipesOf(raw).find(x => x.key === id);
  if (!r) return null;
  const uses = list(r.uses, u => (isObject(u) && str(u.name) ? u : null));
  return {
    id: str(r.key),
    title: str(r.title),
    titleUr: strOrNull(r.titleUr),
    searchTerm: str(r.title),
    // The steps are written in English.
    language: 'en',
    minutes: count(r.minutes),
    servings: Math.max(1, count(r.servings)),
    ingredients: [
      ...uses.map(u => ({ key: str(u.pantryItemId) || str(u.name), name: str(u.name), qty: null, unit: 'g' as BaseUnit, have: true, usesExpiring: bool(u.expiring) })),
      ...strings(r.missing).map(name => ({ key: `missing:${name}`, name, qty: null, unit: 'g' as BaseUnit, have: false, usesExpiring: false })),
    ],
    steps: strings(r.steps),
    nutrition: null,
  };
});

const PER: Record<string, GroceryOption['pricePerUnit']['per']> = { kg: 'kg', l: 'litre', piece: 'piece' };

const optionSerializer = (raw: unknown): GroceryOption | null => {
  if (!isObject(raw) || !str(raw.productId)) return null;
  const s = isObject(raw.store) ? raw.store : {};
  const pack = isObject(raw.pack) ? raw.pack : null;
  const per = isObject(raw.pricePer) ? raw.pricePer : null;
  const days = isObject(s.dispatchDays) ? s.dispatchDays : null;
  return {
    productId: str(raw.productId),
    variantId: strOrNull(raw.variantId),
    name: [str(raw.name), str(raw.variant)].filter(Boolean).join(' · '),
    store: { id: str(s.id), name: str(s.name), deliversToYou: bool(s.deliversToYou, true), dispatchDays: days ? { min: count(days.min), max: count(days.max) } : null },
    price: count(raw.price),
    netQuantity: pack ? toBase(Math.max(0, num(pack.qty)), str(pack.unit)) : { qty: 1, unit: 'pc' },
    pricePerUnit: per ? { amount: count(per.price), per: PER[str(per.per)] ?? 'kg' } : { amount: count(raw.price), per: 'piece' },
    packsNeeded: 1,
    inStock: true,
  };
};

/** POST /missing-to-bag: grocery products per missing item, cheapest per kg, litre or piece first. */
export const missingItemsSerializer = fromResponse((raw: unknown): MissingItem[] =>
  list(isObject(raw) ? raw.items : raw, m =>
    isObject(m) && str(m.name) ? { key: str(m.canonical) || str(m.name), name: str(m.name), need: null, options: list(m.options, optionSerializer) } : null,
  ));

const metricsOf = (raw: Row): BodyMetrics | null =>
  numOrNull(raw.age) !== null && numOrNull(raw.heightCm) !== null && numOrNull(raw.weightKg) !== null
    ? { sex: raw.sex === 'male' ? 'male' : 'female', age: count(raw.age), heightCm: count(raw.heightCm), weightKg: Math.max(0, num(raw.weightKg)), activity: oneOf(raw.activity, ACTIVITIES, 'moderate') }
    : null;

/**
 * The nutrition profile: none (404, or deleted) is nutrition off. Maintaining with no target is
 * "eat better"; a target is the person's own (manual) or worked out from their details.
 */
export const nutritionSettingsSerializer = fromResponse((raw: unknown): NutritionSettings => {
  if (!isObject(raw) || !str(raw.goal)) return { enabled: false, showCalories: false, goal: 'eat_better', metrics: null, manualTargetKcal: null, targetKcal: null, updatedAt: null };
  const target = numOrNull(raw.targetKcal);
  const goal = oneOf(raw.goal, GOALS, 'maintain');
  return {
    enabled: true,
    showCalories: bool(raw.showCalories, true),
    goal: goal === 'maintain' && target === null ? 'eat_better' : goal,
    metrics: metricsOf(raw),
    manualTargetKcal: raw.targetMethod === 'manual' ? target : null,
    targetKcal: target,
    updatedAt: strOrNull(raw.updatedAt),
  };
});

/** The estimated week or month from food ordered on MetroMatrix only. */
export const nutritionSummarySerializer = fromResponse((raw: unknown): NutritionSummary | null => {
  if (!isObject(raw)) return null;
  const days = list(raw.days, d =>
    isObject(d) && dateOrNull(d.date) ? { date: dateOrNull(d.date)!, kcal: count(d.kcal), protein: count(d.proteinG), carbs: count(d.carbsG), fat: count(d.fatG), orders: count(d.items), counted: count(d.itemsWithNutrition) } : null,
  );
  const ordered = days.filter(d => d.orders > 0);
  const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => (ordered.length ? Math.round(ordered.reduce((n, d) => n + d[k], 0) / ordered.length) : 0);
  return {
    from: days[0]?.date ?? '',
    to: days[days.length - 1]?.date ?? '',
    days: days.map(({ counted: _counted, ...d }) => d),
    averageOnOrderDays: { kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') },
    topDishes: [],
    uncounted: days.reduce((n, d) => n + Math.max(0, d.orders - d.counted), 0),
    targetKcal: numOrNull(raw.targetKcal),
  };
});

/** A pantry item used up: saved from waste when it was in its last days. */
export const pantryUsedUpSerializer = fromResponse(raw =>
  isObject(raw) ? { usedUp: raw.status === 'used', savedFromWaste: (numOrNull(raw.daysLeft) ?? 99) <= 3 } : null,
);

/** A pantry item thrown away (or deleted). */
export const pantryRemovedSerializer = fromResponse(raw => (isObject(raw) ? { removed: true, wasted: raw.status === 'discarded' } : null));
