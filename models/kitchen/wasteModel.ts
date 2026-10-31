// ═══════════════════════════════════════════════════════
// MetroMatrix — Waste: what went to waste, and what it cost
// ═══════════════════════════════════════════════════════
// A line is an ingredient (an amount in a unit the cook picks) or a cooked
// dish (whole servings: its recipe comes out of stock). One reason for the
// entry, as a cook logs it after the event. Mirrors the API's limits
// (docs/API_KITCHEN_ASSUMED.md §4.3).

import type { VoiceQtyLine, WasteLineInput, WasteReason, WasteSummary } from '../../types/kitchen';
import type { ValidationErrors } from '../authModel';
import { formatPKR } from '../../utils/money';
import type { CostedIngredient } from './costingModel';
import { lineCostLabel } from './costingModel';
import { defaultUnit, parseAmount, typedToBase, unitOfKey } from './stockModel';
import { WASTE_REASON_LABEL } from './kitchenStatusModel';

export const MAX_WASTE_LINES = 30;
export const MAX_WASTE_SERVINGS = 500;

export interface WasteDraftLine {
  key: string;
  kind: 'ingredient' | 'dish';
  /** The ingredient's or the dish's id. */
  id: string;
  name: string;
  amount: string;
  /** Ingredients: a unit key ("kg", "custom:crate"). Dishes: "serving". */
  unitKey: string;
}

let seq = 0;
export const newWasteKey = () => `waste-${Date.now().toString(36)}-${++seq}`;

export const ingredientLine = (i: Pick<CostedIngredient, 'id' | 'name' | 'baseUnit' | 'dozens'>): WasteDraftLine => ({
  key: newWasteKey(),
  kind: 'ingredient',
  id: i.id,
  name: i.name,
  amount: '',
  unitKey: defaultUnit(i),
});

export const dishLine = (d: { itemId: string; name: string }): WasteDraftLine => ({ key: newWasteKey(), kind: 'dish', id: d.itemId, name: d.name, amount: '1', unitKey: 'serving' });

/** Spoken waste → lines to check (only ingredients the kitchen stocks), in the unit it was said in. */
export const wasteDraftFromVoice = (lines: VoiceQtyLine[], stocked: Pick<CostedIngredient, 'id' | 'name'>[]): WasteDraftLine[] =>
  lines
    .map(l => ({ l, i: stocked.find(x => x.id === l.ingredientId) }))
    .filter((x): x is { l: VoiceQtyLine; i: Pick<CostedIngredient, 'id' | 'name'> } => !!x.i)
    .map(({ l, i }) => ({ key: newWasteKey(), kind: 'ingredient' as const, id: i.id, name: i.name, amount: String(l.qty), unitKey: l.unit }));

/** What a line is worth at what the kitchen paid ("Rs 180"); dishes are costed by the server. */
export const wasteLineCost = (l: WasteDraftLine, byId: Record<string, CostedIngredient>) => {
  if (l.kind !== 'ingredient' || !byId[l.id]) return '';
  const base = typedToBase(l.amount, unitOfKey(byId[l.id], l.unitKey).unit);
  return base ? lineCostLabel(base * byId[l.id].costPerBase) : '';
};

/** The lines → the API's (base units for ingredients, whole servings for dishes); bad lines by key. */
export const wasteInputOf = (lines: WasteDraftLine[], reason: WasteReason, byId: Record<string, CostedIngredient>): { input: WasteLineInput[]; errors: ValidationErrors; lineErrors: Record<string, string> } => {
  const errors: ValidationErrors = {};
  const lineErrors: Record<string, string> = {};
  if (!lines.length) errors.lines = 'Add what went to waste';
  if (lines.length > MAX_WASTE_LINES) errors.lines = `Up to ${MAX_WASTE_LINES} lines`;
  const input: WasteLineInput[] = [];
  for (const l of lines) {
    if (l.kind === 'dish') {
      const n = parseAmount(l.amount);
      if (n === null || !Number.isInteger(n) || n < 1 || n > MAX_WASTE_SERVINGS) lineErrors[l.key] = 'Whole servings';
      else input.push({ itemId: l.id, qty: n, reason });
      continue;
    }
    const i = byId[l.id];
    const base = i ? typedToBase(l.amount, unitOfKey(i, l.unitKey).unit) : null;
    if (!i || !base) lineErrors[l.key] = 'Enter how much';
    else input.push({ ingredientId: l.id, qty: base, unit: i.baseUnit, reason });
  }
  return { input, errors, lineErrors };
};

/** "Rs 1,350 wasted in the last 7 days, mostly left over". */
export const wasteSentence = (w: WasteSummary) => {
  if (!w.entries) return w.range === '7d' ? 'Nothing logged as waste this week.' : 'Nothing logged as waste this month.';
  const top = w.topReasons[0];
  return `${formatPKR(w.cost)} in the last ${w.range === '7d' ? '7' : '30'} days${top ? `, mostly ${WASTE_REASON_LABEL[top.reason].toLowerCase()}` : ''}.`;
};

/** The share line for rescued meals (Bachat Box pickups and donations). */
export const rescuedShareText = (kitchen: string, meals: number) =>
  `${kitchen} has rescued ${meals} ${meals === 1 ? 'meal' : 'meals'} from going to waste, through Bachat Box pickups and donations on Food Court.`;

/** A donation as typed: how many meals, and to whom (the API's limits). */
export const validateDonation = (f: { meals: string; to: string }): ValidationErrors => {
  const errors: ValidationErrors = {};
  const n = parseAmount(f.meals);
  if (n === null || !Number.isInteger(n) || n < 1 || n > 1000) errors.meals = 'How many meals: 1 to 1,000';
  const to = f.to.trim();
  if (to.length < 2 || to.length > 80) errors.to = 'Who it went to';
  return errors;
};
