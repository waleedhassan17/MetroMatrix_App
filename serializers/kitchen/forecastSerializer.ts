// MetroMatrix — Kitchen serializers: forecast, accuracy, prep sheet, shopping list.
// docs/API_KITCHEN.md §8. One day's forecast is GET /forecast?from=<day>&days=1, its
// certain demand (tiffin and catering) the prep sheet's `extra`.

import type { Forecast, ForecastAccuracy, ForecastItem, PrepSheet, ShoppingList } from '../../models/kitchen';
import { CATEGORY_LABEL } from '../../models/kitchen/kitchenStatusModel';
import { isObject, num, str, bodiesOf, fromResponse } from '../serializerUtils';
import { baseUnit, category, count, dateOrNull, intOrNull, list, whole } from './kitchenCommon';

type Row = Record<string, unknown>;

const itemOf = (raw: Row, extra: Map<string, number>): ForecastItem | null => {
  if (!str(raw.itemId) || !str(raw.id)) return null;
  const expected = Math.round(num(raw.expected));
  const adjusted = intOrNull(raw.adjusted);
  const fixed = extra.get(str(raw.itemId)) ?? 0;
  return {
    id: str(raw.id),
    itemId: str(raw.itemId),
    name: str(raw.name),
    photoUrl: null,
    expected,
    // The range always holds the expected value.
    low: Math.min(expected, Math.round(num(raw.low))),
    high: Math.max(expected, Math.round(num(raw.high))),
    learning: raw.method === 'learning',
    adjusted,
    fixed,
    planned: (adjusted ?? expected) + fixed,
  };
};

/** One day: GET /forecast (that day's rows) and, when read with it, the prep sheet's certain demand. */
export const forecastSerializer = (parts: { forecast: unknown; prep?: unknown }): Forecast | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.forecast) || !dateOrNull(raw.forecast.from)) return null;
  const date = dateOrNull(raw.forecast.from)!;
  const extra = new Map(
    list(isObject(raw.prep) ? raw.prep.dishes : [], d => (isObject(d) && str(d.itemId) ? ([str(d.itemId), count(d.extra)] as [string, number]) : null)),
  );
  const items = list(raw.forecast.items, r => (isObject(r) && (dateOrNull(r.date) ?? date) === date ? itemOf(r, extra) : null));
  return {
    date,
    learning: Boolean(raw.forecast.learning),
    basisDays: 0,
    dishes: items.reduce((n, i) => n + i.planned, 0),
    // The forecast is per dish; the API doesn't estimate orders.
    orders: { expected: 0, low: 0, high: 0 },
    items,
  };
};

/** The forecast's own accuracy: MAPE over the last 14 scored days, as "about N% right". */
export const accuracySerializer = fromResponse((raw: unknown): ForecastAccuracy | null => {
  if (!isObject(raw) || !isObject(raw.accuracy)) return null;
  const mape = raw.accuracy.mape14d === null || raw.accuracy.mape14d === undefined ? null : num(raw.accuracy.mape14d);
  const scored = list(raw.accuracy.recent, d => (isObject(d) && d.mape !== null ? d : null)).length;
  return {
    days: scored || 14,
    accuracyPct: mape === null ? null : Math.max(0, Math.min(100, Math.round(100 - mape))),
    learning: Boolean(raw.learning),
    note: '',
  };
});

const shareOf = (title: string, lines: string[]) => [title, ...lines.map(l => `• ${l}`)].join('\n');

export const prepSheetSerializer = fromResponse((raw: unknown): PrepSheet | null => {
  if (!isObject(raw) || !dateOrNull(raw.date)) return null;
  const dishes = list(raw.dishes, d => (isObject(d) && str(d.itemId) ? { itemId: str(d.itemId), name: str(d.name), servings: count(d.planned) } : null));
  const groups = list(raw.ingredients, g =>
    isObject(g)
      ? {
          key: category(g.category),
          title: CATEGORY_LABEL[category(g.category)],
          lines: list(g.lines, l => {
            if (!isObject(l) || !str(l.ingredientId)) return null;
            const unit = baseUnit(l.baseUnit);
            return { ingredientId: str(l.ingredientId), name: str(l.name), qty: count(l.need), baseUnit: unit, dozens: unit === 'pc', forItems: list(l.forItems, x => (str(x) ? str(x) : null)) };
          }),
        }
      : null,
  );
  return {
    date: dateOrNull(raw.date)!,
    dishes,
    groups,
    shareText: shareOf(`Prep for ${dateOrNull(raw.date)}`, dishes.map(d => `${d.servings} × ${d.name}`)),
  };
});

export const shoppingListSerializer = fromResponse((raw: unknown): ShoppingList | null => {
  if (!isObject(raw) || !dateOrNull(raw.date)) return null;
  return {
    date: dateOrNull(raw.date)!,
    lines: list(raw.lines, l => {
      if (!isObject(l) || !str(l.ingredientId)) return null;
      const unit = baseUnit(l.baseUnit);
      return { ingredientId: str(l.ingredientId), name: str(l.name), baseUnit: unit, dozens: unit === 'pc', need: count(l.need), onHand: whole(l.inStock), toBuy: count(l.toBuy), estCost: 0 };
    }),
    // The API doesn't price the list.
    estTotal: 0,
    shareText: str(raw.text),
  };
});
