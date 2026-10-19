// ═══════════════════════════════════════════════════════
// MetroMatrix — Stock: amounts a cook types, ingredient forms, stock takes
// ═══════════════════════════════════════════════════════
// The cook types "2.5" and picks "kg"; the API takes 2500 (g). Every
// conversion goes through utils/units. Pure functions: the slices call them.

import type { Counting, Ingredient, IngredientCategory, IngredientInput } from '../../types/kitchen';
import type { ValidationErrors } from '../authModel';
import { UNITS, formatQty, toBase, unitsFor, type BaseUnit, type CustomUnit, type StandardUnit } from '../../utils/units';
import { addDays } from '../../utils/healthTime';

/** A unit the cook can pick for this ingredient: the standard ones of its kind and its own. */
export interface UnitChoice {
  key: string;
  label: string;
  unit: StandardUnit | CustomUnit;
}

export const unitChoices = (c: Pick<Counting, 'baseUnit' | 'customUnits' | 'dozens'>): UnitChoice[] => {
  const standard = unitsFor(c.baseUnit)
    .filter(u => u !== 'dozen' || c.dozens || c.baseUnit === 'pc')
    .map(u => ({ key: u, label: UNITS[u].many, unit: u as StandardUnit }));
  return [...standard, ...c.customUnits.map(u => ({ key: `custom:${u.name}`, label: u.name, unit: u }))];
};

/** The unit a cook most likely means for this ingredient (kilos, litres, dozens of eggs). */
export const defaultUnit = (c: Pick<Counting, 'baseUnit' | 'dozens'>): StandardUnit => (c.baseUnit === 'g' ? 'kg' : c.baseUnit === 'ml' ? 'l' : c.dozens ? 'dozen' : 'pc');

/** "2,5" or "2.5" or "2½" → 2.5; anything else → null. */
export const parseAmount = (raw: string): number | null => {
  const s = raw.trim().replace(',', '.').replace('½', '.5').replace('¼', '.25').replace('¾', '.75');
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** What the cook typed, in base units (null when it isn't a positive amount). */
export const typedToBase = (raw: string, unit: StandardUnit | CustomUnit): number | null => {
  const n = parseAmount(raw);
  return n !== null && n > 0 ? toBase(n, unit) : null;
};

export const qtyLabel = (c: Pick<Counting, 'baseUnit' | 'dozens'>, base: number) => formatQty(base, c.baseUnit, { dozens: c.dozens });

/** "7.5 kg of 10 kg": on hand against the restock level. */
export const parLabel = (i: Pick<Ingredient, 'baseUnit' | 'dozens' | 'onHand' | 'parLevel'>) =>
  i.parLevel === null ? qtyLabel(i, i.onHand) : `${qtyLabel(i, i.onHand)} of ${qtyLabel(i, i.parLevel)}`;

/** 0–1 for the stock bar: on hand against twice the par level (full at double). */
export const fillOf = (i: Pick<Ingredient, 'onHand' | 'parLevel'>) => {
  if (i.onHand <= 0) return 0;
  if (!i.parLevel) return 1;
  return Math.max(0, Math.min(1, i.onHand / (i.parLevel * 2)));
};

/** "Expires tomorrow", "Expires in 3 days", "Expired" from a local date. */
export const expiryLabel = (on: string, today: string): { label: string; tone: 'danger' | 'warning' | 'neutral' } => {
  if (on < today) return { label: 'Expired', tone: 'danger' };
  if (on === today) return { label: 'Expires today', tone: 'danger' };
  if (on === addDays(today, 1)) return { label: 'Expires tomorrow', tone: 'warning' };
  const days = Math.round((Date.parse(`${on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { label: `${days} days`, tone: days <= 3 ? 'warning' : 'neutral' };
};

export interface IngredientForm {
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
  dozens: boolean;
  /** The par level as typed, in `parUnit`. */
  par: string;
  parUnit: StandardUnit;
}

export const validateIngredient = (f: IngredientForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = f.name.trim();
  if (name.length < 2) errors.name = 'Name the ingredient';
  else if (name.length > 60) errors.name = 'Keep the name under 60 characters';
  if (f.par.trim() && (parseAmount(f.par) === null || UNITS[f.parUnit].base !== f.baseUnit)) errors.par = 'Enter the level you restock at, or leave it empty';
  return errors;
};

export const ingredientInput = (f: IngredientForm): IngredientInput => ({
  name: f.name.trim(),
  category: f.category,
  baseUnit: f.baseUnit,
  dozens: f.baseUnit === 'pc' ? f.dozens : false,
  parLevel: f.par.trim() ? toBase(parseAmount(f.par) ?? 0, f.parUnit) : null,
});

/** A stock-take row: what the cook counted, as typed. */
export interface CountRow {
  ingredientId: string;
  typed: string;
  unit: StandardUnit | CustomUnit;
}

/** Rows the cook filled in → the API's counts (base units); empty rows are left out. */
export const countsOf = (rows: CountRow[]): { lines: { ingredientId: string; counted: number }[]; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  const lines: { ingredientId: string; counted: number }[] = [];
  for (const r of rows) {
    if (!r.typed.trim()) continue;
    const n = parseAmount(r.typed);
    if (n === null) errors[r.ingredientId] = 'Enter a number';
    else lines.push({ ingredientId: r.ingredientId, counted: toBase(n, r.unit) });
  }
  return { lines, errors };
};
