// ═══════════════════════════════════════════════════════
// MetroMatrix — The dish sheet's rules (the API's priceChoice, mirrored)
// ═══════════════════════════════════════════════════════
// Which add-on groups a size offers, what starts ticked, whether a choice
// can be added (the first unmet group, named as the API names it), and the
// live price. The server checks it all again; this is instant feedback.

import type { ItemSheet, SheetGroup } from '../../types/food';

export interface Selection {
  variantId: string | null;
  /** Chosen option ids, by group id. */
  options: Record<string, string[]>;
  quantity: number;
  note: string;
}

export const MAX_QUANTITY = 50;
export const MAX_NOTE = 140;

/** The groups that apply to a size: the shared ones plus that size's own. */
export const groupsFor = (sheet: Pick<ItemSheet, 'groups'>, variantId: string | null): SheetGroup[] =>
  sheet.groups.filter(g => g.variantId === null || g.variantId === variantId);

/** A fresh selection: the cheapest size, and each group's in-stock defaults (up to its most). */
export const initialSelection = (sheet: ItemSheet): Selection => {
  const variantId = sheet.variants.length ? [...sheet.variants].sort((a, b) => a.price - b.price)[0].id : null;
  return { variantId, options: defaultsFor(sheet, variantId), quantity: 1, note: '' };
};

const defaultsFor = (sheet: ItemSheet, variantId: string | null): Record<string, string[]> =>
  Object.fromEntries(
    groupsFor(sheet, variantId).map(g => [
      g.id,
      g.options
        .filter(o => o.isDefault && o.available)
        .slice(0, g.maxSelect)
        .map(o => o.id),
    ]),
  );

/** Changing size keeps choices in groups the new size still offers. */
export const chooseVariant = (sheet: ItemSheet, s: Selection, variantId: string): Selection => {
  const defaults = defaultsFor(sheet, variantId);
  const options = Object.fromEntries(Object.entries(defaults).map(([gid, d]) => [gid, s.options[gid] ?? d]));
  return { ...s, variantId, options };
};

/**
 * Tick or untick a choice. A pick-one group swaps; a group at its most
 * refuses another until one is unticked.
 */
export const toggleOption = (sheet: ItemSheet, s: Selection, groupId: string, optionId: string): Selection => {
  const g = sheet.groups.find(x => x.id === groupId);
  const o = g?.options.find(x => x.id === optionId);
  if (!g || !o || !o.available) return s;
  const now = s.options[groupId] ?? [];
  let next: string[];
  // A required one-of-a-kind choice is a radio: tapping the chosen one keeps it.
  if (now.includes(optionId) && g.maxSelect === 1 && g.minSelect >= 1) return s;
  if (now.includes(optionId)) next = now.filter(id => id !== optionId);
  else if (g.maxSelect === 1) next = [optionId];
  else if (now.length >= g.maxSelect) return s;
  else next = [...now, optionId];
  return { ...s, options: { ...s.options, [groupId]: next } };
};

/** What the line costs: (the size's price or the base price + the choices) × quantity. */
export const unitPrice = (sheet: ItemSheet, s: Selection): number => {
  const variant = sheet.variants.find(v => v.id === s.variantId);
  const base = variant ? variant.price : sheet.basePrice;
  const extras = groupsFor(sheet, s.variantId).reduce(
    (sum, g) => sum + (s.options[g.id] ?? []).reduce((t, id) => t + (g.options.find(o => o.id === id)?.priceDelta ?? 0), 0),
    0,
  );
  return base + extras;
};

export const linePrice = (sheet: ItemSheet, s: Selection): number => unitPrice(sheet, s) * s.quantity;

export interface SelectionProblem {
  groupId: string | null;
  message: string;
}

/** The first thing stopping the line being added, worded as the API words it; null when it can go in. */
export const firstProblem = (sheet: ItemSheet, s: Selection): SelectionProblem | null => {
  if (sheet.variants.length && !sheet.variants.some(v => v.id === s.variantId)) {
    return { groupId: null, message: `Choose a size for ${sheet.name}.` };
  }
  for (const g of groupsFor(sheet, s.variantId)) {
    const n = (s.options[g.id] ?? []).filter(id => g.options.some(o => o.id === id && o.available)).length;
    if (n < g.minSelect) {
      return {
        groupId: g.id,
        message: g.minSelect === 1 ? `Choose ${g.name.toLowerCase()} for ${sheet.name}.` : `Choose at least ${g.minSelect} in “${g.name}” for ${sheet.name}.`,
      };
    }
    if (n > g.maxSelect) return { groupId: g.id, message: `Choose at most ${g.maxSelect} in “${g.name}” for ${sheet.name}.` };
  }
  if (s.quantity < 1 || s.quantity > MAX_QUANTITY) return { groupId: null, message: `Choose 1 to ${MAX_QUANTITY}.` };
  if (sheet.remainingToday !== null && s.quantity > sheet.remainingToday) {
    return { groupId: null, message: sheet.remainingToday === 0 ? 'Sold out for today.' : `Only ${sheet.remainingToday} left today.` };
  }
  return null;
};

/** The ids the API takes for a line: every chosen option in the groups this size offers. */
export const chosenOptionIds = (sheet: ItemSheet, s: Selection): string[] => groupsFor(sheet, s.variantId).flatMap(g => s.options[g.id] ?? []);

/** "Required · pick 1", "Optional · up to 2" for a group header. */
export const groupHint = (g: Pick<SheetGroup, 'minSelect' | 'maxSelect'>): string => {
  if (g.minSelect >= 1) return g.minSelect === g.maxSelect ? `Required · pick ${g.minSelect}` : `Required · pick ${g.minSelect} to ${g.maxSelect}`;
  return g.maxSelect === 1 ? 'Optional · pick 1' : `Optional · up to ${g.maxSelect}`;
};

/** Why a dish can't be ordered now, for its row or sheet. */
export const unavailableLabel = (reason: string | null, from?: string | null): string | null => {
  switch (reason) {
    case null:
      return null;
    case 'sold_out':
      return 'Sold out today';
    case 'outside_hours':
      return from ? `Served from ${time12(from)}` : 'Not served right now';
    case 'not_today':
      return 'Not on today’s menu';
    default:
      return 'Not available right now';
  }
};

const time12 = (hhmm: string) => {
  const h = Number(hhmm.slice(0, 2));
  return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
