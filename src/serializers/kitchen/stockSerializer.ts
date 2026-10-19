// MetroMatrix — Kitchen serializers: stock, ingredients, purchases, suppliers, price watch.
// docs/API_KITCHEN_ASSUMED.md §2.1–2.3, §4.1.

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
} from '../../types/kitchen';
import type { Paged } from '../../types/payments';
import { bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { paged } from '../shopping/common';
import { baseUnit, category, count, countingOf, dateOrNull, list, numOrNull, whole } from './kitchenCommon';

const STATES: readonly StockState[] = ['ok', 'low', 'out', 'negative'];
const MOVEMENTS: readonly MovementKind[] = ['purchase', 'usage', 'waste', 'count', 'return'];
const SOURCES: readonly PurchaseSource[] = ['manual', 'receipt', 'voice'];

export const ingredientSerializer = (raw: unknown): Ingredient | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const exp = isObject(raw.expiring) && dateOrNull(raw.expiring.on) ? { on: dateOrNull(raw.expiring.on)!, qty: count(raw.expiring.qty) } : null;
  return {
    id: str(raw.id),
    name: str(raw.name, 'Ingredient'),
    category: category(raw.category),
    ...countingOf(raw),
    onHand: whole(raw.onHand),
    parLevel: numOrNull(raw.parLevel) === null ? null : count(raw.parLevel),
    state: oneOf(raw.state, STATES, 'ok'),
    costPerBase: Math.max(0, num(raw.costPerBase)),
    latestCostPerBase: Math.max(0, num(raw.latestCostPerBase)),
    expiring: exp,
    priceRefKey: strOrNull(raw.priceRefKey),
    nutritionFoodId: strOrNull(raw.nutritionFoodId),
    updatedAt: str(raw.updatedAt),
  };
};

export const ingredientDetailSerializer = (raw: unknown): IngredientDetail | null => {
  const i = ingredientSerializer(raw);
  if (!i || !isObject(raw)) return null;
  return {
    ...i,
    batches: list(raw.batches, b =>
      isObject(b) && str(b.id)
        ? {
            id: str(b.id),
            qty: count(b.qty),
            receivedQty: count(b.receivedQty),
            costPerBase: Math.max(0, num(b.costPerBase)),
            receivedAt: str(b.receivedAt),
            expiresOn: dateOrNull(b.expiresOn),
            purchaseId: strOrNull(b.purchaseId),
            supplierName: strOrNull(b.supplierName),
          }
        : null,
    ),
    movements: list(raw.movements, m =>
      isObject(m) && str(m.id)
        ? { id: str(m.id), kind: oneOf(m.kind, MOVEMENTS, 'usage'), qty: whole(m.qty), at: str(m.at), note: strOrNull(m.note), orderCode: strOrNull(m.orderCode), purchaseId: strOrNull(m.purchaseId) }
        : null,
    ),
    usedIn: list(raw.usedIn, u =>
      isObject(u) && str(u.itemId) ? { itemId: str(u.itemId), variantId: strOrNull(u.variantId), name: str(u.name), qtyPerServing: Math.max(0, num(u.qtyPerServing)) } : null,
    ),
  };
};

export const stockListSerializer = (raw: unknown): StockList | null => {
  if (!isObject(raw)) return null;
  const c = isObject(raw.counts) ? raw.counts : {};
  return {
    items: list(raw.items, ingredientSerializer),
    counts: { all: count(c.all), low: count(c.low), expiring: count(c.expiring), negative: count(c.negative) },
  };
};

export const stockTakeSerializer = (raw: unknown): StockTakeResult | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    at: str(raw.at),
    adjusted: count(raw.adjusted),
    lines: list(raw.lines, l =>
      isObject(l) && str(l.ingredientId)
        ? { ingredientId: str(l.ingredientId), name: str(l.name), ...countingOf(l), before: whole(l.before), counted: count(l.counted), change: whole(l.change) }
        : null,
    ),
  };
};

export const supplierSerializer = (raw: unknown): Supplier | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), name: str(raw.name), phone: strOrNull(raw.phone), note: strOrNull(raw.note), purchaseCount: count(raw.purchaseCount), lastPurchaseOn: dateOrNull(raw.lastPurchaseOn) }
    : null;

export const suppliersSerializer = (raw: unknown): Supplier[] => list(raw, supplierSerializer);

export const purchaseSerializer = (raw: unknown): Purchase | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    date: dateOrNull(raw.date) ?? '',
    supplier: isObject(raw.supplier) && str(raw.supplier.id) ? { id: str(raw.supplier.id), name: str(raw.supplier.name) } : null,
    source: oneOf(raw.source, SOURCES, 'manual'),
    receiptUrl: strOrNull(raw.receiptUrl),
    total: count(raw.total),
    lines: list(raw.lines, l =>
      isObject(l) && str(l.ingredientId)
        ? {
            id: str(l.id),
            ingredientId: str(l.ingredientId),
            name: str(l.name),
            baseUnit: baseUnit(l.baseUnit),
            dozens: bool(l.dozens),
            qty: count(l.qty),
            total: count(l.total),
            costPerBase: Math.max(0, num(l.costPerBase)),
            expiresOn: dateOrNull(l.expiresOn),
          }
        : null,
    ),
    createdAt: str(raw.createdAt),
  };
};

export interface PurchasesPage extends Paged<Purchase> {
  weekTotal: number;
}

export const purchasesPageSerializer = (raw: unknown): PurchasesPage => ({
  ...paged(raw, purchaseSerializer),
  weekTotal: isObject(raw) ? count(raw.weekTotal) : 0,
});

export const priceWatchSerializer = (raw: unknown): PriceWatch | null => {
  if (!isObject(raw)) return null;
  return {
    city: str(raw.city),
    week: dateOrNull(raw.week),
    items: list(raw.items, i =>
      isObject(i) && str(i.ingredientId)
        ? {
            ingredientId: str(i.ingredientId),
            name: str(i.name),
            baseUnit: baseUnit(i.baseUnit),
            yourCostPerBase: Math.max(0, num(i.yourCostPerBase)),
            cityCostPerBase: Math.max(0, num(i.cityCostPerBase)),
            diffPct: Math.round(num(i.diffPct)),
            trend: list(i.trend, t => (isObject(t) && dateOrNull(t.week) ? { week: dateOrNull(t.week)!, costPerBase: Math.max(0, num(t.costPerBase)) } : null)),
          }
        : null,
    ),
  };
};
