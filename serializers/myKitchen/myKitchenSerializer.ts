// MetroMatrix — My Kitchen and the customer's nutrition: wire → app.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN): an assumed contract).

import type {
  BodyMetrics,
  DishFacts,
  GroceryOption,
  GroceryOrder,
  HealthyPick,
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
} from '../../types/myKitchen';
import { arr, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list, numOrNull } from '../kitchen/kitchenCommon';
import { BASE_UNITS } from '../../utils/units';

const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);
const STATES: readonly PantryState[] = ['fresh', 'use_soon', 'expired'];
const GOALS: readonly NutritionGoal[] = ['eat_better', 'maintain', 'lose', 'gain'];
const base = (v: unknown) => oneOf(v, BASE_UNITS, 'g');

export const pantryItemSerializer = fromResponse((raw: unknown): PantryItem | null =>
  isObject(raw) && str(raw.id)
    ? {
        id: str(raw.id),
        name: str(raw.name),
        key: strOrNull(raw.key),
        qty: Math.max(0, num(raw.qty)),
        unit: base(raw.unit),
        expiresOn: dateOrNull(raw.expiresOn),
        state: oneOf(raw.state, STATES, 'fresh'),
        source: oneOf(raw.source, ['manual', 'voice', 'shopping'] as const, 'manual'),
        addedAt: str(raw.addedAt),
      }
    : null);

export const pantryListSerializer = fromResponse((raw: unknown): PantryList => {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.counts) ? r.counts : {};
  return { counts: { all: count(c.all), use_soon: count(c.use_soon), expired: count(c.expired) }, items: list(r.items, pantryItemSerializer) };
});

export const pantryItemsSerializer = fromResponse((raw: unknown): PantryItem[] => list(isObject(raw) ? raw.items : raw, pantryItemSerializer));

export const pantryStatsSerializer = fromResponse((raw: unknown): PantryStats => {
  const r = isObject(raw) ? raw : {};
  return { month: str(r.month), used: count(r.used), savedFromWaste: count(r.savedFromWaste), wasted: count(r.wasted), inKitchen: count(r.inKitchen) };
});

export const pantryRemindersSerializer = fromResponse((raw: unknown): PantryReminders => {
  const r = isObject(raw) ? raw : {};
  return { enabled: bool(r.enabled, true), time: str(r.time, '09:00'), daysBefore: Math.min(3, count(r.daysBefore)) };
});

const netOf = (raw: unknown) => {
  const n = isObject(raw) ? raw : {};
  return { qty: Math.max(0, num(n.qty)), unit: base(n.unit) };
};

export const groceryOrdersSerializer = fromResponse((raw: unknown): GroceryOrder[] =>
  list(isObject(raw) ? raw.items : raw, o =>
    isObject(o) && str(o.orderId)
      ? {
          orderId: str(o.orderId),
          code: str(o.code),
          storeName: str(o.storeName),
          placedAt: str(o.placedAt),
          status: str(o.status),
          lines: list(o.lines, l => (isObject(l) && str(l.lineId) ? { lineId: str(l.lineId), name: str(l.name), quantity: Math.max(1, count(l.quantity)), netQuantity: netOf(l.netQuantity), alreadyAdded: bool(l.alreadyAdded) } : null)),
        }
      : null,
  ));

const macrosOf = (raw: unknown): Macros | null =>
  isObject(raw) && numOrNull(raw.kcal) !== null ? { kcal: count(raw.kcal), protein: count(raw.protein), carbs: count(raw.carbs), fat: count(raw.fat) } : null;

export const dishFactsSerializer = (raw: unknown): DishFacts | null => {
  const m = macrosOf(raw);
  return m && isObject(raw) ? { ...m, method: raw.method === 'ai_estimate' ? 'ai_estimate' : 'recipe', serves: Math.max(1, count(raw.serves)) } : null;
};

const ideaSerializer = (raw: unknown): RecipeIdea | null =>
  isObject(raw) && str(raw.id)
    ? {
        id: str(raw.id),
        title: str(raw.title),
        searchTerm: str(raw.searchTerm, str(raw.title)),
        minutes: count(raw.minutes),
        servings: Math.max(1, count(raw.servings)),
        have: strings(raw.have),
        missing: strings(raw.missing),
        usesExpiring: strings(raw.usesExpiring),
        nutrition: macrosOf(raw.nutrition),
      }
    : null;

export const recipeIdeasSerializer = fromResponse((raw: unknown): RecipeIdea[] => list(isObject(raw) ? raw.items : raw, ideaSerializer));

export const homeRecipeSerializer = fromResponse((raw: unknown): HomeRecipe | null =>
  isObject(raw) && str(raw.id)
    ? {
        id: str(raw.id),
        title: str(raw.title),
        searchTerm: str(raw.searchTerm, str(raw.title)),
        language: raw.language === 'ur' ? 'ur' : 'en',
        minutes: count(raw.minutes),
        servings: Math.max(1, count(raw.servings)),
        ingredients: list(raw.ingredients, i =>
          isObject(i) && str(i.key) ? { key: str(i.key), name: str(i.name), qty: Math.max(0, num(i.qty)), unit: base(i.unit), have: bool(i.have), usesExpiring: bool(i.usesExpiring) } : null,
        ),
        steps: strings(raw.steps),
        nutrition: macrosOf(raw.nutrition),
      }
    : null);

const optionSerializer = (raw: unknown): GroceryOption | null => {
  if (!isObject(raw) || !str(raw.productId)) return null;
  const s = isObject(raw.store) ? raw.store : {};
  const ppu = isObject(raw.pricePerUnit) ? raw.pricePerUnit : {};
  return {
    productId: str(raw.productId),
    variantId: strOrNull(raw.variantId),
    name: str(raw.name),
    store: { id: str(s.id), name: str(s.name) },
    price: count(raw.price),
    netQuantity: netOf(raw.netQuantity),
    pricePerUnit: { amount: count(ppu.amount), per: oneOf(ppu.per, ['kg', 'litre', 'piece'] as const, 'kg') },
    packsNeeded: Math.max(1, count(raw.packsNeeded)),
    inStock: raw.inStock !== false,
  };
};

export const missingItemsSerializer = fromResponse((raw: unknown): MissingItem[] =>
  list(isObject(raw) ? raw.items : raw, m =>
    isObject(m) && str(m.key) ? { key: str(m.key), name: str(m.name), need: netOf(m.need), options: list(m.options, optionSerializer) } : null,
  ));

const metricsOf = (raw: unknown): BodyMetrics | null =>
  isObject(raw) && numOrNull(raw.age) !== null
    ? {
        sex: raw.sex === 'male' ? 'male' : 'female',
        age: count(raw.age),
        heightCm: count(raw.heightCm),
        weightKg: Math.max(0, num(raw.weightKg)),
        activity: oneOf(raw.activity, ['low', 'moderate', 'high'] as const, 'moderate'),
      }
    : null;

export const nutritionSettingsSerializer = fromResponse((raw: unknown): NutritionSettings => {
  const r = isObject(raw) ? raw : {};
  const enabled = bool(r.enabled);
  return {
    enabled,
    showCalories: enabled && bool(r.showCalories),
    goal: oneOf(r.goal, GOALS, 'eat_better'),
    metrics: metricsOf(r.metrics),
    manualTargetKcal: numOrNull(r.manualTargetKcal),
    targetKcal: enabled ? numOrNull(r.targetKcal) : null,
    updatedAt: strOrNull(r.updatedAt),
  };
});

export const nutritionSummarySerializer = fromResponse((raw: unknown): NutritionSummary | null => {
  if (!isObject(raw)) return null;
  const avg = macrosOf(raw.averageOnOrderDays) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    from: dateOrNull(raw.from) ?? '',
    to: dateOrNull(raw.to) ?? '',
    days: list(raw.days, d => (isObject(d) && dateOrNull(d.date) ? { date: dateOrNull(d.date)!, kcal: count(d.kcal), protein: count(d.protein), carbs: count(d.carbs), fat: count(d.fat), orders: count(d.orders) } : null)),
    averageOnOrderDays: avg,
    topDishes: list(raw.topDishes, t => (isObject(t) && str(t.name) ? { name: str(t.name), count: count(t.count) } : null)),
    uncounted: count(raw.uncounted),
    targetKcal: numOrNull(raw.targetKcal),
  };
});

export const healthyPicksSerializer = fromResponse((raw: unknown): HealthyPick[] =>
  list(isObject(raw) ? raw.items : raw, p => {
    if (!isObject(p) || !str(p.itemId)) return null;
    const v = isObject(p.vendor) ? p.vendor : {};
    return {
      itemId: str(p.itemId),
      name: str(p.name),
      photoUrl: strOrNull(p.photoUrl),
      price: count(p.price),
      kcal: count(p.kcal),
      protein: count(p.protein),
      serves: Math.max(1, count(p.serves)),
      tags: strings(p.tags).filter((t): t is 'under_600' | 'high_protein' => t === 'under_600' || t === 'high_protein'),
      vendor: { id: str(v.id), slug: str(v.slug), name: str(v.name) },
    };
  }));

/** PUT /my-kitchen/nutrition/settings answers `{ settings }`. */
export const nutritionSettingsResponseSerializer = fromResponse(raw => nutritionSettingsSerializer((raw as { settings?: unknown })?.settings));

/** A pantry item removed: whether it was wasted. */
export const pantryRemovedSerializer = fromResponse(raw =>
  isObject(raw) ? { removed: bool(raw.removed), wasted: bool(raw.wasted) } : null,
);

/** A pantry item used up: whether it was saved from waste. */
export const pantryUsedUpSerializer = fromResponse(raw =>
  isObject(raw) ? { usedUp: bool(raw.usedUp), savedFromWaste: bool(raw.savedFromWaste) } : null,
);
