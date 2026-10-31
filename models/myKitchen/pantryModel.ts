// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen: the pantry in plain words, and its form
// ═══════════════════════════════════════════════════════
// "2 kg · Use by Thu 22 Oct", the segments, expiry choices people pick
// without a calendar, the month's "7 things saved from waste", and grocery
// prices per kilo, litre or piece.

import type { GroceryOption, PantryItem, PantryLineInput, PantrySegment, PantryState, PantryStats } from '../../types/myKitchen';
import type { ValidationErrors } from '../authModel';
import { addDays, formatDayShort } from '../../utils/healthTime';
import { formatPKR } from '../../utils/money';
import { formatQty, unitsFor, type BaseUnit, type StandardUnit } from '../../utils/units';
import type { KitchenTone } from '../kitchen/kitchenStatusModel';

export const PANTRY_SEGMENTS: { key: PantrySegment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'use_soon', label: 'Use soon' },
  { key: 'expired', label: 'Expired' },
];

export const PANTRY_STATE: Record<PantryState, { label: string; tone: KitchenTone }> = {
  fresh: { label: 'Fresh', tone: 'success' },
  use_soon: { label: 'Use soon', tone: 'warning' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** "2 kg" (dozens for eggs). */
export const pantryQty = (p: Pick<PantryItem, 'qty' | 'unit' | 'key'>) => formatQty(p.qty, p.unit, { dozens: p.key === 'egg' });

export const expiryLine = (p: Pick<PantryItem, 'expiresOn' | 'state'>) =>
  !p.expiresOn ? 'No use-by date' : p.state === 'expired' ? `Expired ${formatDayShort(p.expiresOn)}` : `Use by ${formatDayShort(p.expiresOn)}`;

/** Expiry without a calendar: days from today, or none. */
export const EXPIRY_CHOICES: { days: number | null; label: string }[] = [
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In a week' },
  { days: 30, label: 'In a month' },
  { days: null, label: 'No date' },
];

export interface PantryForm {
  name: string;
  qty: string;
  unit: StandardUnit;
  expiresIn: number | null;
}

export const emptyPantryForm = (): PantryForm => ({ name: '', qty: '', unit: 'kg', expiresIn: 7 });

export const PANTRY_UNITS: StandardUnit[] = ['kg', 'g', 'pao', 'l', 'ml', 'pc', 'dozen'];

export const validatePantryForm = (f: PantryForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (f.name.trim().length < 2) errors.name = 'What is it?';
  const q = Number(f.qty);
  if (!(q > 0) || q > 10000) errors.qty = 'How much?';
  return errors;
};

export const pantryLineOf = (f: PantryForm, today: string): PantryLineInput => ({
  name: f.name.trim(),
  qty: Number(f.qty),
  unit: f.unit,
  expiresOn: f.expiresIn === null ? null : addDays(today, f.expiresIn),
});

/** The units that fit a thing already in the pantry (to use some of it). */
export const unitsOfItem = (unit: BaseUnit): StandardUnit[] => unitsFor(unit);

/** "7 things saved from waste this month" (nothing to say before the first). */
export const statsLine = (s: Pick<PantryStats, 'savedFromWaste' | 'used'>) =>
  s.savedFromWaste
    ? `${s.savedFromWaste} ${s.savedFromWaste === 1 ? 'thing' : 'things'} saved from waste this month`
    : s.used
      ? `${s.used} ${s.used === 1 ? 'thing' : 'things'} used up this month`
      : 'Use what expires first, and it counts here.';

/** "Rs 160 · 1 kg · Rs 160 / kg". */
export const optionLine = (o: Pick<GroceryOption, 'price' | 'netQuantity' | 'pricePerUnit'>) =>
  `${formatPKR(o.price)} · ${formatQty(o.netQuantity.qty, o.netQuantity.unit, { dozens: o.netQuantity.unit === 'pc' && o.netQuantity.qty === 12 })} · ${formatPKR(o.pricePerUnit.amount)} / ${o.pricePerUnit.per}`;

export const RECIPE_TIMES: { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'Any time' },
  { minutes: 20, label: 'Under 20 min' },
  { minutes: 45, label: 'Under 45 min' },
];

export const SERVINGS = [2, 4, 6];
