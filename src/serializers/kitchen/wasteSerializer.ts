// MetroMatrix — Kitchen serializers: waste, its summary, donations.
// docs/API_KITCHEN_ASSUMED.md §2.6, §4.3.

import type { Donation, Donations, WasteEntry, WasteReason, WasteSummary } from '../../types/kitchen';
import type { Paged } from '../../types/payments';
import { isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { paged } from '../shopping/common';
import { BASE_UNITS } from '../../utils/units';
import { count, dateOrNull, list } from './kitchenCommon';

export const WASTE_REASONS: readonly WasteReason[] = ['expired', 'spoiled', 'burnt', 'dropped', 'leftover', 'other'];

export const wasteSerializer = fromResponse((raw: unknown): WasteEntry | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    at: str(raw.at),
    lines: list(raw.lines, l =>
      isObject(l)
        ? {
            ingredientId: strOrNull(l.ingredientId),
            itemId: strOrNull(l.itemId),
            name: str(l.name),
            qty: count(l.qty),
            baseUnit: oneOf(l.baseUnit, BASE_UNITS, null),
            cost: count(l.cost),
            reason: oneOf(l.reason, WASTE_REASONS, 'other'),
          }
        : null,
    ),
    cost: count(raw.cost),
    note: strOrNull(raw.note),
  };
});

export const wastePageSerializer = fromResponse((raw: unknown): Paged<WasteEntry> => paged(raw, wasteSerializer));

export const wasteSummarySerializer = fromResponse((raw: unknown): WasteSummary | null => {
  if (!isObject(raw)) return null;
  const m = isObject(raw.mealsRescued) ? raw.mealsRescued : {};
  return {
    range: raw.range === '30d' ? '30d' : '7d',
    from: dateOrNull(raw.from) ?? '',
    to: dateOrNull(raw.to) ?? '',
    cost: count(raw.cost),
    entries: count(raw.entries),
    topReasons: list(raw.topReasons, r => (isObject(r) ? { reason: oneOf(r.reason, WASTE_REASONS, 'other'), cost: count(r.cost) } : null)),
    topItems: list(raw.topItems, i => (isObject(i) && str(i.name) ? { name: str(i.name), cost: count(i.cost) } : null)),
    mealsRescued: { total: count(m.total), inRange: count(m.inRange) },
  };
});

export const donationSerializer = fromResponse((raw: unknown): Donation | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), at: str(raw.at), meals: count(raw.meals), to: str(raw.to), note: strOrNull(raw.note) } : null);

export const donationsSerializer = fromResponse((raw: unknown): Donations | null => {
  if (!isObject(raw)) return null;
  const m = isObject(raw.mealsRescued) ? raw.mealsRescued : {};
  return { items: list(raw.items, donationSerializer), mealsRescued: { total: count(m.total), week: count(m.week) } };
});
