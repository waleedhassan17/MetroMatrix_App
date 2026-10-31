// MetroMatrix — Kitchen serializers: forecast, accuracy, prep sheet, shopping list.
// docs/API_KITCHEN_ASSUMED.md §2.5, §4.3.

import type { Forecast, ForecastAccuracy, ForecastItem, PrepSheet, ShoppingList } from '../../models/kitchen';
import { bool, isObject, str, strOrNull, fromResponse } from '../serializerUtils';
import { baseUnit, category, count, dateOrNull, intOrNull, list, whole } from './kitchenCommon';

export const forecastItemSerializer = fromResponse((raw: unknown): ForecastItem | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const expected = count(raw.expected);
  const fixed = isObject(raw.fixed) ? raw.fixed : {};
  return {
    itemId: str(raw.itemId),
    name: str(raw.name),
    photoUrl: strOrNull(raw.photoUrl),
    expected,
    // The range always holds the expected value.
    low: Math.min(expected, count(raw.low)),
    high: Math.max(expected, count(raw.high)),
    learning: bool(raw.learning),
    adjusted: intOrNull(raw.adjusted),
    fixed: { tiffin: count(fixed.tiffin), catering: count(fixed.catering) },
    planned: count(raw.planned),
  };
});

export const forecastSerializer = fromResponse((raw: unknown): Forecast | null => {
  if (!isObject(raw) || !dateOrNull(raw.date)) return null;
  const o = isObject(raw.orders) ? raw.orders : {};
  return {
    date: dateOrNull(raw.date)!,
    learning: bool(raw.learning),
    basisDays: count(raw.basisDays),
    dishes: count(raw.dishes),
    orders: { expected: count(o.expected), low: count(o.low), high: count(o.high) },
    items: list(raw.items, forecastItemSerializer),
  };
});

export const accuracySerializer = fromResponse((raw: unknown): ForecastAccuracy | null =>
  isObject(raw) ? { days: count(raw.days) || 7, accuracyPct: intOrNull(raw.accuracyPct), learning: bool(raw.learning), note: str(raw.note) } : null);

export const prepSheetSerializer = fromResponse((raw: unknown): PrepSheet | null => {
  if (!isObject(raw) || !dateOrNull(raw.date)) return null;
  return {
    date: dateOrNull(raw.date)!,
    dishes: list(raw.dishes, d => (isObject(d) && str(d.itemId) ? { itemId: str(d.itemId), name: str(d.name), servings: count(d.servings) } : null)),
    groups: list(raw.groups, g =>
      isObject(g)
        ? {
            key: category(g.key),
            title: str(g.title),
            lines: list(g.lines, l =>
              isObject(l) && str(l.ingredientId)
                ? { ingredientId: str(l.ingredientId), name: str(l.name), qty: count(l.qty), baseUnit: baseUnit(l.baseUnit), dozens: bool(l.dozens), forItems: list(l.forItems, x => strOrNull(x)) }
                : null,
            ),
          }
        : null,
    ),
    shareText: str(raw.shareText),
  };
});

export const shoppingListSerializer = fromResponse((raw: unknown): ShoppingList | null => {
  if (!isObject(raw) || !dateOrNull(raw.date)) return null;
  return {
    date: dateOrNull(raw.date)!,
    lines: list(raw.lines, l =>
      isObject(l) && str(l.ingredientId)
        ? { ingredientId: str(l.ingredientId), name: str(l.name), baseUnit: baseUnit(l.baseUnit), dozens: bool(l.dozens), need: count(l.need), onHand: whole(l.onHand), toBuy: count(l.toBuy), estCost: count(l.estCost) }
        : null,
    ),
    estTotal: count(raw.estTotal),
    shareText: str(raw.shareText),
  };
});
