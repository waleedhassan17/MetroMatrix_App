// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy forecasts, prep sheets and shopping lists
// ═══════════════════════════════════════════════════════
// Expected dishes for a day from the same weekday in the last eight weeks
// (recent weeks count more), with a range from how much those weeks varied.
// Under 14 days of history the kitchen is still "learning": a wide range
// around the plain average. Accuracy is 100 − the weighted mean absolute
// percentage error over the last 7 days, each day forecast from the days
// before it. The prep sheet is the planned servings × the recipes; the
// shopping list is what the prep needs beyond what is on hand.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §3.5.

import type { MockDb } from '../mockDb';
import type { MockMenuItem } from '../food/foodTypes';
import { addDays } from '../../../../utils/healthTime';
import { formatQty } from '../../../../utils/units';
import { formatDayShort } from '../../../../utils/healthTime';
import type { MockIngredient, MockIngredientCategory } from './kitchenTypes';
import { defaultVariantOf, itemsOf, k, latestCostOf, onHandOf, perServing, recipeFor, todayOf, vendorOf } from './kitchenLogic';

export const LEARNING_DAYS = 14;
const WEEKS = 8;
const DECAY = 0.85;
/** Dishes per order, to turn dishes into orders. */
export const DISHES_PER_ORDER = 1.5;

export const CATEGORY_TITLE: Record<MockIngredientCategory, string> = {
  meat_poultry: 'Meat and poultry',
  vegetables: 'Vegetables',
  fruit: 'Fruit',
  dairy: 'Dairy and eggs',
  grains_flour: 'Rice, flour and daal',
  spices: 'Spices',
  oils_ghee: 'Oil and ghee',
  bakery: 'Bread and buns',
  drinks: 'Drinks',
  packaging: 'Packaging',
  other: 'Other',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_TITLE) as MockIngredientCategory[];

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** One kitchen's sales, indexed once per request: item → date → qty, and the days it sold anything. */
export interface SalesIndex {
  byItem: Map<string, Map<string, number>>;
  days: string[];
}

export const salesIndex = (db: MockDb, businessId: string): SalesIndex => {
  const byItem = new Map<string, Map<string, number>>();
  const days = new Set<string>();
  for (const s of db.kitchen.sales) {
    if (s.businessId !== businessId) continue;
    days.add(s.date);
    const m = byItem.get(s.itemId) ?? new Map<string, number>();
    m.set(s.date, (m.get(s.date) ?? 0) + s.qty);
    byItem.set(s.itemId, m);
  }
  return { byItem, days: [...days].sort() };
};

/** Distinct days the kitchen sold anything before `date`. */
export const historyDays = (ix: SalesIndex, before: string) => {
  let n = 0;
  for (const d of ix.days) if (d < before) n++;
  return n;
};

export interface ItemForecast {
  expected: number;
  low: number;
  high: number;
  learning: boolean;
}

/** One dish on one day, from the days before `asOf` (exclusive). null: not cooked that day. */
export const forecastItem = (ix: SalesIndex, i: MockMenuItem, date: string, asOf: string): ItemForecast | null => {
  if (!i.days.includes(weekdayOf(date))) return null;
  const sales = ix.byItem.get(i.id) ?? new Map<string, number>();
  const learning = historyDays(ix, asOf) < LEARNING_DAYS;
  if (learning) {
    const vals = [...sales].filter(([d]) => d < asOf).map(([, q]) => q);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { expected: Math.round(mean), low: Math.max(0, Math.floor(mean * 0.5)), high: Math.ceil(mean * 1.5) + 1, learning: true };
  }
  const first = [...sales.keys()].sort()[0];
  const vals: number[] = [];
  for (let w = 1; w <= WEEKS * 2 && vals.length < WEEKS; w++) {
    const d = addDays(date, -7 * w);
    if (d >= asOf) continue;
    if (!first || d < first) break;
    // A day it was cooked but nobody ordered it counts as zero.
    vals.push(sales.get(d) ?? 0);
  }
  if (!vals.length) return { expected: 0, low: 0, high: 1, learning: false };
  let wsum = 0;
  let total = 0;
  vals.forEach((v, n) => {
    const w = DECAY ** n;
    wsum += w;
    total += v * w;
  });
  const mean = total / wsum;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
  const spread = Math.max(1, 1.28 * sd);
  const expected = Math.round(mean);
  return { expected, low: Math.max(0, Math.min(expected, Math.floor(mean - spread))), high: Math.max(expected, Math.ceil(mean + spread)), learning: false };
};

/** The dishes the kitchen forecasts: active ones it has sold, or that have a recipe. */
export const forecastItems = (db: MockDb, businessId: string, ix: SalesIndex) =>
  itemsOf(db, businessId).filter(i => i.sold30d > 0 || ix.byItem.has(i.id) || recipeFor(db, businessId, i.id, defaultVariantOf(i)?.id ?? null));

export const adjustedOf = (db: MockDb, businessId: string, date: string, itemId: string) =>
  db.kitchen.adjustments.find(a => a.businessId === businessId && a.date === date && a.itemId === itemId)?.adjusted ?? null;

/** Fixed demand a tiffin plan or a catering event puts on a day (filled in by 5B; zero until then). */
export type FixedDemand = (db: MockDb, businessId: string, date: string, itemId: string) => { tiffin: number; catering: number };
let fixedDemand: FixedDemand = () => ({ tiffin: 0, catering: 0 });
export const setFixedDemand = (f: FixedDemand) => {
  fixedDemand = f;
};

export const forecastDay = (db: MockDb, businessId: string, date: string, now: number) => {
  const v = vendorOf(db, businessId);
  const today = todayOf(v, now);
  const ix = salesIndex(db, businessId);
  const rows = forecastItems(db, businessId, ix)
    .map(i => {
      const f = forecastItem(ix, i, date, today);
      if (!f) return null;
      const fixed = fixedDemand(db, businessId, date, i.id);
      return { item: i, f, adjusted: adjustedOf(db, businessId, date, i.id), fixed };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const planned = (r: (typeof rows)[number]) => (r.adjusted ?? r.f.expected) + r.fixed.tiffin + r.fixed.catering;
  const dishes = rows.reduce((n, r) => n + planned(r), 0);
  const basisDays = historyDays(ix, today);
  return {
    date,
    learning: basisDays < LEARNING_DAYS,
    basisDays,
    rows,
    planned,
    totals: {
      dishes,
      orders: { expected: Math.round(dishes / DISHES_PER_ORDER), low: Math.round(rows.reduce((n, r) => n + r.f.low, 0) / DISHES_PER_ORDER), high: Math.round(rows.reduce((n, r) => n + r.f.high, 0) / DISHES_PER_ORDER) },
    },
  };
};

/** 100 − weighted MAPE over the last `days` days (null while learning or with nothing sold). */
export const accuracy = (db: MockDb, businessId: string, now: number, days = 7) => {
  const v = vendorOf(db, businessId);
  const today = todayOf(v, now);
  const ix = salesIndex(db, businessId);
  if (historyDays(ix, today) < LEARNING_DAYS + days) return null;
  let err = 0;
  let actual = 0;
  const items = forecastItems(db, businessId, ix);
  for (let back = 1; back <= days; back++) {
    const d = addDays(today, -back);
    for (const i of items) {
      const f = forecastItem(ix, i, d, d);
      if (!f) continue;
      const a = ix.byItem.get(i.id)?.get(d) ?? 0;
      err += Math.abs(a - f.expected);
      actual += a;
    }
  }
  if (actual === 0) return null;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - err / actual))));
};

interface NeedLine {
  ingredient: MockIngredient;
  qty: number;
  forItems: string[];
}

/** Every ingredient the day's planned servings use. */
export const needsFor = (db: MockDb, businessId: string, date: string, now: number) => {
  const day = forecastDay(db, businessId, date, now);
  const needs = new Map<string, NeedLine>();
  const dishes: { itemId: string; name: string; servings: number }[] = [];
  for (const r of day.rows) {
    const servings = day.planned(r);
    if (servings <= 0) continue;
    dishes.push({ itemId: r.item.id, name: r.item.name, servings });
    const recipe = recipeFor(db, businessId, r.item.id, defaultVariantOf(r.item)?.id ?? null);
    if (!recipe) continue;
    for (const l of perServing(recipe)) {
      const ing = db.kitchen.ingredients.find(x => x.id === l.ingredientId);
      if (!ing) continue;
      const n = needs.get(ing.id) ?? { ingredient: ing, qty: 0, forItems: [] };
      n.qty += l.qty * servings;
      if (!n.forItems.includes(r.item.name)) n.forItems.push(r.item.name);
      needs.set(ing.id, n);
    }
  }
  return { day, dishes, needs: [...needs.values()].map(n => ({ ...n, qty: Math.ceil(n.qty) })) };
};

const qty = (i: MockIngredient, base: number) => formatQty(base, i.baseUnit, { dozens: i.dozens });

export const prepSheet = (db: MockDb, businessId: string, date: string, now: number) => {
  const v = vendorOf(db, businessId);
  const { dishes, needs } = needsFor(db, businessId, date, now);
  const groups = CATEGORY_ORDER.map(cat => ({
    key: cat,
    title: CATEGORY_TITLE[cat],
    lines: needs
      .filter(n => n.ingredient.category === cat)
      .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name))
      .map(n => ({ ingredientId: n.ingredient.id, name: n.ingredient.name, qty: n.qty, baseUnit: n.ingredient.baseUnit, dozens: n.ingredient.dozens, label: qty(n.ingredient, n.qty), forItems: n.forItems })),
  })).filter(g => g.lines.length);
  const shareText = [
    `Prep for ${formatDayShort(date)} · ${v.name}`,
    dishes.length ? `Dishes: ${dishes.map(d => `${d.name} ${d.servings}`).join(', ')}` : 'No dishes planned.',
    ...groups.flatMap(g => ['', g.title, ...g.lines.map(l => `- ${l.name}: ${l.label}`)]),
  ].join('\n');
  return { date, dishes, groups, shareText };
};

export const shoppingList = (db: MockDb, businessId: string, date: string, now: number) => {
  const v = vendorOf(db, businessId);
  const { needs } = needsFor(db, businessId, date, now);
  const lines = needs
    .map(n => {
      const on = onHandOf(db, n.ingredient);
      const toBuy = Math.max(0, n.qty - Math.max(0, on));
      return {
        ingredientId: n.ingredient.id,
        name: n.ingredient.name,
        baseUnit: n.ingredient.baseUnit,
        dozens: n.ingredient.dozens,
        need: n.qty,
        onHand: on,
        toBuy,
        label: qty(n.ingredient, toBuy),
        estCost: Math.round(toBuy * latestCostOf(db, n.ingredient)),
      };
    })
    .filter(l => l.toBuy > 0)
    .sort((a, b) => b.estCost - a.estCost);
  const estTotal = lines.reduce((s, l) => s + l.estCost, 0);
  const shareText = [`To buy for ${formatDayShort(date)} · ${v.name}`, ...(lines.length ? lines.map(l => `- ${l.name}: ${l.label}`) : ['Nothing: the stock covers it.'])].join('\n');
  return { date, lines, estTotal, shareText };
};
