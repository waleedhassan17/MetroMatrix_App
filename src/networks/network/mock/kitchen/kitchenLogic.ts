// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy kitchen rules (stock, recipes, costs)
// ═══════════════════════════════════════════════════════
// Stock moves first-expiring first out; using more than was recorded runs
// an ingredient below zero (a deficit) instead of failing an order. A
// recipe's cost to make is its lines at what the kitchen paid; a dish sells
// out by itself when its recipe can't make one more serving. Money is whole
// rupees (rounded at the end), quantities whole base units.
// TODO(API_KITCHEN): the assumed rules of docs/API_KITCHEN_ASSUMED.md §3.

import type { MockDb } from '../mockDb';
import { FoodError, isoNow } from '../food/foodLogic';
import type { MockFoodOrder, MockFoodVendor, MockMenuItem } from '../food/foodTypes';
import { addDays, dateInZone, hourOfDay } from '../../../../utils/healthTime';
import { formatQty } from '../../../../utils/units';
import type {
  MockBatch,
  MockIngredient,
  MockKitchen,
  MockKitchenSettings,
  MockMovement,
  MockOrderKitchen,
  MockRecipe,
  MockRecipeLine,
} from './kitchenTypes';

export class KitchenError extends FoodError {}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** "Expiring" means within this many days (today, tomorrow, the day after). */
export const EXPIRING_DAYS = 2;
/** A ticket warns "Recipe stock low" under this many servings. */
export const LOW_SERVINGS = 3;
export const MAX_INGREDIENTS = 300;
export const DEFAULT_TARGET_FOOD_COST = 40;

export const k = (db: MockDb): MockKitchen => db.kitchen;

export const nextId = (db: MockDb, prefix: string) => {
  db.kitchen.seq += 1;
  return `${prefix}_${db.kitchen.seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
};

export { isoNow };

export const invalid = (field: string, message: string, extra: Record<string, unknown> = {}) =>
  new KitchenError(400, 'VALIDATION_FAILED', message, { fields: { [field]: [message] }, ...extra });

export const notFound = (what: string) => new KitchenError(404, 'NOT_FOUND', `${what} not found.`);

export const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── Time ──
export const vendorOf = (db: MockDb, businessId: string): MockFoodVendor => db.food.vendors.find(v => v.businessId === businessId)!;
export const todayOf = (v: Pick<MockFoodVendor, 'timezone'>, now: number) => dateInZone(isoNow(now), v.timezone);
export const localHour = (v: Pick<MockFoodVendor, 'timezone'>, now: number) => Math.floor(hourOfDay(isoNow(now), v.timezone));

// ── Settings ──
export const settingsOf = (db: MockDb, businessId: string): MockKitchenSettings => {
  let s = k(db).settings.find(x => x.businessId === businessId);
  if (!s) {
    s = { businessId, targetFoodCostPct: DEFAULT_TARGET_FOOD_COST, autoSellOut: true, packingPhoto: 'off' };
    k(db).settings.push(s);
  }
  return s;
};

// ── Stock ──
export const ingredientsOf = (db: MockDb, businessId: string) => k(db).ingredients.filter(i => i.businessId === businessId);

export const myIngredient = (db: MockDb, businessId: string, id: string): MockIngredient => {
  const i = k(db).ingredients.find(x => x.id === id && x.businessId === businessId);
  if (!i) throw notFound('Ingredient');
  return i;
};

const liveBatches = (db: MockDb, ingredientId: string) =>
  k(db)
    .batches.filter(b => b.ingredientId === ingredientId && b.qty > 0)
    // First expiring first out; batches that don't expire after, oldest first.
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') || a.receivedAt.localeCompare(b.receivedAt));

export const onHandOf = (db: MockDb, i: MockIngredient) => liveBatches(db, i.id).reduce((n, b) => n + b.qty, 0) - i.deficit;

/** What the kitchen paid last (rupees per base unit); 0 if it never bought it here. */
export const latestCostOf = (db: MockDb, i: MockIngredient) => {
  const all = k(db).batches.filter(b => b.ingredientId === i.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return all[0]?.costPerBase ?? 0;
};

/** The average cost of what is in stock (rupees per base unit); the latest price when it is all used. */
export const costOf = (db: MockDb, i: MockIngredient) => {
  const live = liveBatches(db, i.id);
  const qty = live.reduce((n, b) => n + b.qty, 0);
  return qty > 0 ? live.reduce((n, b) => n + b.qty * b.costPerBase, 0) / qty : latestCostOf(db, i);
};

export type StockState = 'ok' | 'low' | 'out' | 'negative';

export const stateOf = (db: MockDb, i: MockIngredient): StockState => {
  const on = onHandOf(db, i);
  if (on < 0) return 'negative';
  if (on === 0) return 'out';
  if (i.parLevel !== null && on < i.parLevel) return 'low';
  return 'ok';
};

/** The soonest-expiring stock within EXPIRING_DAYS: its date and how much. */
export const expiringOf = (db: MockDb, i: MockIngredient, today: string) => {
  const until = addDays(today, EXPIRING_DAYS);
  const soon = liveBatches(db, i.id).filter(b => b.expiresOn && b.expiresOn <= until);
  if (!soon.length) return null;
  const first = soon[0].expiresOn!;
  return { on: first, qty: soon.filter(b => b.expiresOn === first).reduce((n, b) => n + b.qty, 0) };
};

export const qtyText = (i: Pick<MockIngredient, 'baseUnit' | 'dozens'>, base: number) => formatQty(base, i.baseUnit, { dozens: i.dozens });

const movement = (db: MockDb, i: MockIngredient, kind: MockMovement['kind'], qty: number, now: number, extra: Partial<MockMovement> = {}) => {
  k(db).movements.push({
    id: nextId(db, 'mv'),
    businessId: i.businessId,
    ingredientId: i.id,
    kind,
    qty,
    at: isoNow(now),
    note: null,
    orderId: null,
    orderCode: null,
    purchaseId: null,
    ...extra,
  });
};

/** Stock comes in: it first covers anything used beyond the records, the rest is a new batch. */
export const addStock = (
  db: MockDb,
  i: MockIngredient,
  qty: number,
  costPerBase: number,
  now: number,
  opts: { expiresOn?: string | null; purchaseId?: string | null; kind?: MockMovement['kind']; note?: string | null } = {},
): MockBatch | null => {
  if (qty <= 0) return null;
  const covered = Math.min(i.deficit, qty);
  i.deficit -= covered;
  i.updatedAt = isoNow(now);
  movement(db, i, opts.kind ?? 'purchase', qty, now, { purchaseId: opts.purchaseId ?? null, note: opts.note ?? null });
  const batch: MockBatch = {
    id: nextId(db, 'bt'),
    businessId: i.businessId,
    ingredientId: i.id,
    qty: qty - covered,
    receivedQty: qty,
    costPerBase,
    receivedAt: isoNow(now),
    expiresOn: opts.expiresOn ?? null,
    purchaseId: opts.purchaseId ?? null,
  };
  k(db).batches.push(batch);
  return batch;
};

export interface Taken {
  ingredientId: string;
  batchId: string | null;
  qty: number;
  costPerBase: number;
}

/**
 * Stock goes out, first-expiring first. More than there is runs the
 * ingredient below zero (orders are never refused for the records' sake).
 */
export const takeStock = (db: MockDb, i: MockIngredient, qty: number, now: number, kind: MockMovement['kind'], extra: Partial<MockMovement> = {}): Taken[] => {
  if (qty <= 0) return [];
  const out: Taken[] = [];
  let left = qty;
  for (const b of liveBatches(db, i.id)) {
    if (left <= 0) break;
    const n = Math.min(b.qty, left);
    b.qty -= n;
    left -= n;
    out.push({ ingredientId: i.id, batchId: b.id, qty: n, costPerBase: b.costPerBase });
  }
  if (left > 0) {
    i.deficit += left;
    out.push({ ingredientId: i.id, batchId: null, qty: left, costPerBase: latestCostOf(db, i) });
  }
  i.updatedAt = isoNow(now);
  movement(db, i, kind, -qty, now, extra);
  return out;
};

/** Undo takeStock: back into the same batches (or off the deficit). */
export const giveBack = (db: MockDb, taken: Taken[], now: number, extra: Partial<MockMovement> = {}) => {
  const byIngredient = new Map<string, number>();
  for (const t of taken) {
    const i = k(db).ingredients.find(x => x.id === t.ingredientId);
    if (!i) continue;
    const b = t.batchId ? k(db).batches.find(x => x.id === t.batchId) : null;
    if (b) b.qty += t.qty;
    else i.deficit = Math.max(0, i.deficit - t.qty);
    byIngredient.set(i.id, (byIngredient.get(i.id) ?? 0) + t.qty);
  }
  for (const [id, qty] of byIngredient) {
    const i = k(db).ingredients.find(x => x.id === id)!;
    i.updatedAt = isoNow(now);
    movement(db, i, 'return', qty, now, extra);
  }
};

export const costOfTaken = (taken: Taken[]) => taken.reduce((n, t) => n + t.qty * t.costPerBase, 0);

// ── Recipes ──
export const itemsOf = (db: MockDb, businessId: string) => db.food.items.filter(i => i.businessId === businessId && i.isActive);

/** The recipe for a dish's size: that size's own, else the one every size shares. */
export const recipeFor = (db: MockDb, businessId: string, itemId: string, variantId: string | null): MockRecipe | null =>
  k(db).recipes.find(r => r.businessId === businessId && r.itemId === itemId && r.variantId === variantId) ??
  (variantId ? (k(db).recipes.find(r => r.businessId === businessId && r.itemId === itemId && r.variantId === null) ?? null) : null);

/** The size a dish is costed and counted by: its first (cheapest listed) size, or none. */
export const defaultVariantOf = (i: MockMenuItem) => [...i.variants].sort((a, b) => a.sort - b.sort)[0] ?? null;

export const sellPriceOf = (i: MockMenuItem, variantId: string | null) => i.variants.find(v => v.id === variantId)?.price ?? i.basePrice;

export interface ServingLine {
  ingredientId: string;
  qty: number;
  packaging: boolean;
}

/** One serving's ingredients (the batch ÷ its yield) and packaging, in base units (unrounded). */
export const perServing = (r: MockRecipe): ServingLine[] => [
  ...r.lines.map(l => ({ ingredientId: l.ingredientId, qty: l.qty / Math.max(1, r.yield), packaging: false })),
  ...r.packaging.map(l => ({ ingredientId: l.ingredientId, qty: l.qty, packaging: true })),
];

export interface Cost {
  toMake: number;
  sellPrice: number;
  keep: number;
  keepPct: number;
  foodCostPct: number;
  overTarget: boolean;
}

/** Cost to make one serving (whole rupees): lines at what the kitchen paid, plus packaging. */
export const toMakeOf = (db: MockDb, r: MockRecipe) =>
  perServing(r).reduce((n, l) => {
    const i = k(db).ingredients.find(x => x.id === l.ingredientId);
    return n + (i ? l.qty * costOf(db, i) : 0);
  }, 0);

export const costView = (toMake: number, sellPrice: number, target: number): Cost => {
  const make = Math.round(toMake);
  const keep = sellPrice - make;
  const foodCostPct = sellPrice > 0 ? Math.round((make / sellPrice) * 100) : 0;
  return {
    toMake: make,
    sellPrice,
    keep,
    keepPct: sellPrice > 0 ? Math.round((keep / sellPrice) * 100) : 0,
    foodCostPct,
    overTarget: foodCostPct > target,
  };
};

export const recipeCost = (db: MockDb, r: MockRecipe, item: MockMenuItem) =>
  costView(toMakeOf(db, r), sellPriceOf(item, r.variantId), settingsOf(db, r.businessId).targetFoodCostPct);

/** How many servings the stock can still make (ingredients only; packaging never sells a dish out). null: no recipe. */
export const servingsLeft = (db: MockDb, r: MockRecipe | null): number | null => {
  if (!r) return null;
  let min = Infinity;
  for (const l of perServing(r)) {
    if (l.packaging || l.qty <= 0) continue;
    const i = k(db).ingredients.find(x => x.id === l.ingredientId);
    if (!i) continue;
    min = Math.min(min, Math.floor(Math.max(0, onHandOf(db, i)) / l.qty));
  }
  return min === Infinity ? null : min;
};

/** The dish's servings left, counted on its default size's recipe. */
export const itemServingsLeft = (db: MockDb, i: MockMenuItem) => servingsLeft(db, recipeFor(db, i.businessId, i.id, defaultVariantOf(i)?.id ?? null));

/** Food's hook: a dish whose recipe can't make one more serving is out of stock (when the kitchen asked for that). */
export const itemBlocked = (db: MockDb, v: MockFoodVendor, i: MockMenuItem) => {
  if (!db.kitchen || !settingsOf(db, v.businessId).autoSellOut) return null;
  const left = itemServingsLeft(db, i);
  return left !== null && left < 1 ? 'ingredients' : null;
};

export type RecipeStatus = 'complete' | 'partial' | 'missing';

/** A dish has a complete card when every size has a recipe (or one shared by all). */
export const recipeStatusOf = (db: MockDb, i: MockMenuItem): RecipeStatus => {
  const sizes = i.variants.length ? i.variants.map(v => v.id) : [null];
  const have = sizes.filter(s => recipeFor(db, i.businessId, i.id, s)).length;
  return have === sizes.length ? 'complete' : have === 0 ? 'missing' : 'partial';
};

export const recipeLines = (db: MockDb, businessId: string, raw: unknown, field: string): MockRecipeLine[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw invalid(field, `${field} must be a list`);
  if (raw.length > 60) throw invalid(field, `${field} can have at most 60 lines`);
  const out: MockRecipeLine[] = [];
  raw.forEach((l, n) => {
    const ing = k(db).ingredients.find(x => x.id === String(l?.ingredientId) && x.businessId === businessId);
    if (!ing) throw invalid(`${field}.${n}.ingredientId`, 'Pick an ingredient from your stock.');
    if (!isNum(l.qty) || l.qty <= 0 || l.qty > 1_000_000) throw invalid(`${field}.${n}.qty`, 'qty must be a positive number of base units');
    const existing = out.find(x => x.ingredientId === ing.id);
    if (existing) existing.qty += l.qty;
    else out.push({ ingredientId: ing.id, qty: Math.round(l.qty * 100) / 100 });
  });
  return out;
};

// ── Orders ──
export const orderKitchenOf = (db: MockDb, orderId: string): MockOrderKitchen => {
  let row = k(db).orders.find(x => x.orderId === orderId);
  if (!row) {
    row = { orderId, deducted: [], packedPhotoUrl: null, packingCheck: null, origin: { kind: 'app', ref: null } };
    k(db).orders.push(row);
  }
  return row;
};

/** What an order uses: each line's recipe (its size) × quantity, plus its add-ons. */
export const orderNeeds = (db: MockDb, o: MockFoodOrder) => {
  const need = new Map<string, number>();
  const add = (id: string, qty: number) => need.set(id, (need.get(id) ?? 0) + qty);
  for (const line of o.items) {
    const r = recipeFor(db, o.businessId, line.itemId, line.variantId);
    if (!r) continue;
    for (const s of perServing(r)) add(s.ingredientId, s.qty * line.quantity);
    for (const opt of line.options) {
      const a = r.addOns.find(x => x.optionId === opt.id);
      for (const l of a?.lines ?? []) add(l.ingredientId, l.qty * line.quantity);
    }
  }
  return [...need].map(([ingredientId, qty]) => ({ ingredientId, qty: Math.round(qty) })).filter(x => x.qty > 0);
};

const deductOrder = (db: MockDb, o: MockFoodOrder, now: number) => {
  const row = orderKitchenOf(db, o.id);
  if (row.deducted.length) return;
  for (const n of orderNeeds(db, o)) {
    const i = k(db).ingredients.find(x => x.id === n.ingredientId);
    if (!i) continue;
    row.deducted.push(...takeStock(db, i, n.qty, now, 'usage', { orderId: o.id, orderCode: o.code, note: `Order ${o.code}` }));
  }
};

const ENDED_BAD: MockFoodOrder['status'][] = ['rejected', 'auto_rejected', 'cancelled'];
const COOKED: MockFoodOrder['status'][] = ['preparing', 'ready', 'on_the_way'];

/** Food's afterMove hook: stock out on accept; back on a cancel before cooking; a cooked cancel is waste. */
export const afterMove = (db: MockDb, o: MockFoodOrder, from: MockFoodOrder['status'], to: MockFoodOrder['status'], now: number) => {
  if (!db.kitchen) return;
  if (to === 'accepted') deductOrder(db, o, now);
  if (ENDED_BAD.includes(to)) {
    const row = k(db).orders.find(x => x.orderId === o.id);
    if (!row?.deducted.length) return;
    if (COOKED.includes(from)) {
      const cost = Math.round(costOfTaken(row.deducted));
      k(db).waste.push({
        id: nextId(db, 'ws'),
        businessId: o.businessId,
        at: isoNow(now),
        lines: o.items.map(l => ({ ingredientId: null, itemId: l.itemId, name: l.name, qty: l.quantity, baseUnit: null, cost: Math.round(cost / Math.max(1, o.items.length)), reason: 'other' as const })),
        cost,
        note: `Order ${o.code} cancelled after cooking`,
      });
    } else giveBack(db, row.deducted, now, { orderId: o.id, orderCode: o.code, note: `Order ${o.code} ${to === 'cancelled' ? 'cancelled' : 'declined'}` });
    row.deducted = [];
  }
  if (to === 'delivered' || to === 'picked_up') {
    const date = dateInZone(o.placedAt, vendorOf(db, o.businessId).timezone);
    for (const l of o.items) {
      const s = k(db).sales.find(x => x.businessId === o.businessId && x.itemId === l.itemId && x.date === date);
      if (s) s.qty += l.quantity;
      else k(db).sales.push({ businessId: o.businessId, itemId: l.itemId, date, qty: l.quantity });
    }
  }
};

/** Food's beforeMove hook: a kitchen that wants a packing photo can't mark an order ready without one. */
export const beforeMove = (db: MockDb, o: MockFoodOrder, to: MockFoodOrder['status']) => {
  if (!db.kitchen || to !== 'ready') return;
  if (settingsOf(db, o.businessId).packingPhoto !== 'required') return;
  if (!k(db).orders.find(x => x.orderId === o.id)?.packedPhotoUrl) {
    throw new KitchenError(422, 'PACKING_PHOTO_REQUIRED', 'Take a photo of the packed order before marking it ready.', { orderId: o.id });
  }
};

// ── Small helpers the routes share ──
export const sumBy = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);
