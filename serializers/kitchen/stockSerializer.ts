// MetroMatrix — Kitchen serializers: stock, ingredients, purchases, suppliers, price watch.
// docs/API_KITCHEN.md §1–5. Quantities are base units; the API's `piece` is the app's `pc`.

import type {
  Ingredient,
  IngredientDetail,
  MovementKind,
  PriceWatch,
  Purchase,
  PurchaseSource,
  StockList,
  StockState,
  StockTakeResult,
  Supplier,
} from '../../models/kitchen';
import type { Paged } from '../../models/payments';
import type { BaseUnit } from '../../utils/units/units';
import { isObject, num, str, strOrNull, bodiesOf, fromResponse } from '../serializerUtils';
import { paged } from '../shopping/common';
import { baseUnit, category, count, countingOf, dateOrNull, list, numOrNull, whole } from './kitchenCommon';

/** The ledger's reasons in the app's words. */
const MOVEMENT: Record<string, MovementKind> = {
  purchase: 'purchase',
  order: 'usage',
  order_cancel: 'return',
  waste: 'waste',
  count_adjust: 'count',
  manual: 'count',
};

const SOURCE: Record<string, PurchaseSource> = { manual: 'manual', voice: 'voice', receipt_scan: 'receipt' };

/** How many base units one of a reference unit is (the price watch compares per kg, litre, dozen …). */
const PER_UNIT: Record<string, number> = { kg: 1000, g: 1, l: 1000, litre: 1000, ml: 1, dozen: 12, piece: 1, each: 1, '250 grams': 250 };

const stateOf = (raw: Record<string, unknown>, onHand: number): StockState =>
  raw.negative || onHand < 0 ? 'negative' : onHand <= 0 ? 'out' : raw.belowPar ? 'low' : 'ok';

export const ingredientSerializer = (raw: unknown): Ingredient | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const onHand = whole(raw.onHand);
  const on = dateOrNull(raw.expiringOn);
  return {
    id: str(raw.id),
    name: str(raw.name, 'Ingredient'),
    nameUr: strOrNull(raw.nameUr),
    category: category(raw.category),
    ...countingOf(raw),
    onHand,
    parLevel: numOrNull(raw.parLevel) === null ? null : count(raw.parLevel),
    state: stateOf(raw, onHand),
    costPerBase: Math.max(0, num(raw.avgCost)),
    latestCostPerBase: Math.max(0, num(raw.lastCost)),
    expiring: on && count(raw.expiringSoon) > 0 ? { on, qty: count(raw.expiringSoon) } : null,
    priceRefKey: strOrNull(raw.referenceItemId),
    nutritionFoodId: null,
    updatedAt: str(raw.updatedAt),
  };
};

/** The ingredient, its batches and its ledger, read together (GET /ingredients/:id, /stock/:id/batches, /stock/:id/movements). */
export const ingredientDetailSerializer = (parts: { ingredient: unknown; batches?: unknown; movements?: unknown }): IngredientDetail | null => {
  const raw = bodiesOf(parts);
  const i = ingredientSerializer(raw.ingredient);
  if (!i || !isObject(raw.ingredient)) return null;
  const ledger = isObject(raw.movements) ? raw.movements.items : [];
  return {
    ...i,
    batches: list(raw.batches, b =>
      isObject(b) && str(b.id)
        ? {
            id: str(b.id),
            qty: count(b.qtyRemaining),
            receivedQty: count(b.qtyReceived),
            costPerBase: Math.max(0, num(b.unitCost)),
            receivedAt: str(b.receivedAt),
            expiresOn: dateOrNull(b.expiresOn),
            purchaseId: null,
            supplierName: null,
          }
        : null,
    ),
    movements: list(ledger, m =>
      isObject(m) && str(m.id)
        ? {
            id: str(m.id),
            kind: MOVEMENT[str(m.reason)] ?? 'count',
            qty: whole(m.delta),
            at: str(m.at),
            note: strOrNull(m.note),
            orderCode: strOrNull(m.orderCode),
            purchaseId: m.refType === 'purchase' ? strOrNull(m.refId) : null,
          }
        : null,
    ),
    usedIn: list(raw.ingredient.usedIn, u =>
      isObject(u) && str(u.itemId)
        ? {
            itemId: str(u.itemId),
            variantId: strOrNull(u.variantId),
            name: [str(u.name), strOrNull(u.variantName)].filter(Boolean).join(' · '),
            qtyPerServing: Math.max(0, num(u.qtyPerServing)),
          }
        : null,
    ),
  };
};

/** GET /stock: rows, and the summary's counts for the segments. */
export const stockListSerializer = fromResponse((raw: unknown): StockList | null => {
  if (!isObject(raw)) return null;
  const s = isObject(raw.summary) ? raw.summary : {};
  return {
    items: list(raw.items, ingredientSerializer),
    counts: { all: count(s.ingredients), low: count(s.belowPar), expiring: count(s.expiringIn3Days), negative: count(s.negative) },
  };
});

/** POST /stock/count; the counted lines' units come from what was sent. */
export const stockTakeSerializer = fromResponse((raw: unknown, sent: { ingredientId: string; baseUnit: BaseUnit }[] = []): StockTakeResult | null => {
  if (!isObject(raw) || !str(raw.countId)) return null;
  const lines = list(raw.adjusted, l => {
    if (!isObject(l) || !str(l.ingredientId)) return null;
    const unit = sent.find(x => x.ingredientId === l.ingredientId)?.baseUnit ?? 'g';
    return { ingredientId: str(l.ingredientId), name: str(l.name), baseUnit: unit, dozens: unit === 'pc', customUnits: [], before: whole(l.before), counted: count(l.counted), change: whole(l.delta) };
  });
  return { id: str(raw.countId), at: new Date().toISOString(), adjusted: lines.filter(l => l.change !== 0).length, lines };
});

export const supplierSerializer = fromResponse((raw: unknown): Supplier | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), name: str(raw.name), phone: strOrNull(raw.phone), note: strOrNull(raw.notes), spent30d: count(raw.spent30d), lastPurchaseOn: dateOrNull(raw.lastPurchaseAt) }
    : null);

export const suppliersSerializer = fromResponse((raw: unknown): Supplier[] => list(raw, supplierSerializer));

const purchaseLine = (l: unknown): Purchase['lines'][number] | null => {
  if (!isObject(l) || !str(l.ingredientId)) return null;
  const d = isObject(l.display) ? l.display : {};
  const unit = baseUnit(d.unit === 'kg' ? 'g' : d.unit === 'l' ? 'ml' : d.unit === 'dozen' ? 'piece' : d.unit);
  return {
    id: str(l.id),
    ingredientId: str(l.ingredientId),
    name: str(l.name),
    baseUnit: unit,
    dozens: unit === 'pc',
    qty: count(l.qtyBase),
    total: count(l.totalPrice),
    costPerBase: Math.max(0, num(l.unitCost)),
    expiresOn: dateOrNull(l.expiresOn),
  };
};

/** A purchase (GET /purchases/:id) or a list row (its supplier a name, its lines a count and a few names). */
export const purchaseSerializer = fromResponse((raw: unknown): Purchase | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const detailed = Array.isArray(raw.lines);
  const supplier = isObject(raw.supplier) && str(raw.supplier.id) ? { id: str(raw.supplier.id), name: str(raw.supplier.name) } : str(raw.supplier) ? { id: '', name: str(raw.supplier) } : null;
  const lines = detailed
    ? list(raw.lines, purchaseLine)
    : list(raw.lineNames, n => (str(n) ? { id: '', ingredientId: '', name: str(n), baseUnit: 'g' as BaseUnit, dozens: false, qty: 0, total: 0, costPerBase: 0, expiresOn: null } : null));
  return {
    id: str(raw.id),
    date: dateOrNull(raw.purchasedAt) ?? '',
    supplier,
    source: SOURCE[str(raw.source)] ?? 'manual',
    receiptUrl: strOrNull(raw.receiptDownload) ?? strOrNull(raw.receiptUrl),
    total: count(raw.total),
    note: strOrNull(raw.note),
    lines,
    lineCount: detailed ? lines.length : count(raw.lines),
    createdAt: str(raw.purchasedAt),
  };
});

export interface PurchasesPage extends Paged<Purchase> {
  weekTotal: number;
  weekCount: number;
}

export const purchasesPageSerializer = fromResponse((raw: unknown): PurchasesPage => ({
  ...paged(raw, purchaseSerializer),
  weekTotal: isObject(raw) ? count(raw.weekTotal) : 0,
  weekCount: isObject(raw) ? count(raw.weekCount) : 0,
}));

/** Prices per base unit, from the reference unit's (Rs 180 a kg is Rs 0.18 a gram). */
export const priceWatchSerializer = fromResponse((raw: unknown): PriceWatch | null => {
  if (!isObject(raw)) return null;
  const items = list(raw.items, i => {
    if (!isObject(i) || !str(i.ingredientId)) return null;
    const ref = isObject(i.reference) ? i.reference : {};
    const per = PER_UNIT[str(ref.unit).toLowerCase()] ?? 1;
    const unit = baseUnit(per === 12 || str(ref.unit) === 'piece' ? 'piece' : /l|ml|litre/.test(str(ref.unit)) ? 'ml' : 'g');
    const yours = numOrNull(i.yourPrice);
    const city = numOrNull(i.referencePrice);
    return {
      ingredientId: str(i.ingredientId),
      name: str(i.name),
      baseUnit: unit,
      yourCostPerBase: yours === null ? 0 : yours / per,
      cityCostPerBase: city === null ? 0 : city / per,
      diffPct: Math.round(num(i.pctAbove)),
      trend: list(i.history, t => (isObject(t) && dateOrNull(t.weekEnding) ? { week: dateOrNull(t.weekEnding)!, costPerBase: Math.max(0, num(t.price)) / per } : null)),
    };
  });
  const weeks = list(raw.items, i => (isObject(i) ? dateOrNull(i.weekEnding) : null)).sort();
  return { city: str(raw.city), week: weeks[weeks.length - 1] ?? null, items };
});

/** Purchases' header: this week's spend (from the list) and the price watch, read together. */
export const purchasesOverviewSerializer = (parts: { first: unknown; watch: unknown }) => {
  const raw = bodiesOf(parts);
  const watch = priceWatchSerializer(raw.watch);
  return watch ? { weekTotal: purchasesPageSerializer(raw.first).weekTotal, watch } : null;
};
