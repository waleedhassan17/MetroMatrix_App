// MetroMatrix — Kitchen serializers: waste, its summary, donations.
// docs/API_KITCHEN.md §6, §10. The API keeps one line per waste entry (an ingredient, or a
// dish in servings); meals rescued come from the donations' answer.

import type { Donation, Donations, WasteEntry, WasteReason, WasteSummary } from '../../models/kitchen';
import type { Paged } from '../../models/payments';
import type { BaseUnit } from '../../utils/units/units';
import { isObject, num, oneOf, str, strOrNull, bodiesOf, fromResponse } from '../serializerUtils';
import { paged } from '../shopping/common';
import { count, dateOrNull, list } from './kitchenCommon';

export const WASTE_REASONS: readonly WasteReason[] = ['expired', 'spoiled', 'overcooked', 'returned', 'leftover', 'other'];

/** A logged quantity in base units (a dish is in servings, with no base unit). */
const toBase = (qty: number, unit: string): { qty: number; baseUnit: BaseUnit | null } => {
  switch (unit) {
    case 'kg':
      return { qty: qty * 1000, baseUnit: 'g' };
    case 'l':
      return { qty: qty * 1000, baseUnit: 'ml' };
    case 'dozen':
      return { qty: qty * 12, baseUnit: 'pc' };
    case 'piece':
    case 'pc':
      return { qty, baseUnit: 'pc' };
    case 'g':
    case 'ml':
      return { qty, baseUnit: unit };
    default:
      return { qty, baseUnit: null };
  }
};

export const wasteSerializer = fromResponse((raw: unknown): WasteEntry | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const dish = raw.kind === 'dish' || !!str(raw.menuItemId);
  const q = dish ? { qty: num(raw.qty), baseUnit: null } : toBase(num(raw.qty), str(raw.unit));
  const cost = count(raw.cost);
  return {
    id: str(raw.id),
    at: str(raw.at),
    lines: [
      {
        ingredientId: strOrNull(raw.ingredientId),
        itemId: strOrNull(raw.menuItemId),
        name: str(raw.name),
        qty: Math.round(q.qty),
        baseUnit: q.baseUnit,
        cost,
        reason: oneOf(raw.reason, WASTE_REASONS, 'other'),
      },
    ],
    cost,
    note: strOrNull(raw.note),
  };
});

/** Several entries logged together (one per line), read as one: all their lines and their cost. */
export const wasteBatchSerializer = (raws: unknown[]): WasteEntry | null => {
  const entries = raws.map(x => wasteSerializer(x)).filter((x): x is WasteEntry => x !== null);
  return entries.length ? { ...entries[0], lines: entries.flatMap(e => e.lines), cost: entries.reduce((n, e) => n + e.cost, 0) } : null;
};

export const wastePageSerializer = fromResponse((raw: unknown): Paged<WasteEntry> => paged(raw, wasteSerializer));

/** GET /waste/summary, with the donations' meals rescued. */
export const wasteSummarySerializer = (parts: { summary: unknown; donations?: unknown }): WasteSummary | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.summary)) return null;
  const s = raw.summary;
  const d = isObject(raw.donations) ? raw.donations : {};
  const from = dateOrNull(s.from) ?? '';
  const inRange = list(d.items, x => (isObject(x) && (dateOrNull(x.at) ?? '') >= from ? count(x.meals) : null)).reduce((n, m) => n + m, 0);
  return {
    range: s.range === '30d' ? '30d' : '7d',
    from,
    to: dateOrNull(s.to) ?? '',
    cost: count(s.totalCost),
    entries: count(s.entries),
    topReasons: list(s.byReason, r => (isObject(r) ? { reason: oneOf(r.reason, WASTE_REASONS, 'other'), cost: count(r.cost) } : null)),
    topItems: list(s.top, i => (isObject(i) && str(i.name) ? { name: str(i.name), cost: count(i.cost) } : null)),
    mealsRescued: { total: count(d.mealsRescued), inRange },
  };
};

export const donationSerializer = fromResponse((raw: unknown): Donation | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), at: str(raw.at), meals: count(raw.meals), to: str(raw.organisation), note: strOrNull(raw.notes) } : null);

/** GET (and POST) /donations: meals rescued (collected boxes and donated meals) and the donations. */
export const donationsSerializer = fromResponse((raw: unknown): Donations | null => {
  if (!isObject(raw)) return null;
  const items = list(raw.items, donationSerializer);
  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    items,
    mealsRescued: { total: count(raw.mealsRescued), week: items.filter(i => Date.parse(i.at) >= weekAgo).reduce((n, i) => n + i.meals, 0) },
  };
});
