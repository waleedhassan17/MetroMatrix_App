// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen serializers: the shared readers
// ═══════════════════════════════════════════════════════
// Base units, a counting (unit, dozens, the kitchen's own units), a cost
// card and lists of rows the app can't read dropped. Defensive like every
// serializer: a missing field is a sensible default, never a crash.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §2.

import type { Cost, Counting, IngredientCategory, TransferPayment } from '../../types/kitchen';
import type { FoodPaymentStatus, FoodTransferAccount } from '../../types/food';
import { BASE_UNITS, STANDARD_UNITS, type BaseUnit, type StandardUnit } from '../../utils/units';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';

export const INGREDIENT_CATEGORIES: readonly IngredientCategory[] = [
  'meat_poultry',
  'vegetables',
  'fruit',
  'dairy',
  'grains_flour',
  'spices',
  'oils_ghee',
  'bakery',
  'drinks',
  'packaging',
  'other',
];

export const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
export const list = <T>(raw: unknown, f: (x: unknown) => T | null): T[] => compact(arr(raw).map(f));

/** Whole base units, rupees (whole), counts: never negative unless the API says so (stock can be). */
export const whole = (v: unknown) => Math.round(num(v));
export const count = (v: unknown) => Math.max(0, Math.round(num(v)));
export const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
export const intOrNull = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
};
export const pct = (v: unknown) => Math.max(0, Math.min(100, Math.round(num(v))));

export const baseUnit = (v: unknown): BaseUnit => oneOf(v, BASE_UNITS, 'g');
export const standardUnit = (v: unknown, fallback: StandardUnit = 'kg'): StandardUnit => oneOf(v, STANDARD_UNITS, fallback);
export const category = (v: unknown): IngredientCategory => oneOf(v, INGREDIENT_CATEGORIES, 'other');

export const countingOf = (raw: Record<string, unknown>): Counting => ({
  baseUnit: baseUnit(raw.baseUnit),
  dozens: bool(raw.dozens),
  customUnits: list(raw.customUnits, u => (isObject(u) && str(u.name) && num(u.base) > 0 ? { name: str(u.name), base: Math.round(num(u.base)) } : null)),
});

export const costSerializer = (raw: unknown): Cost | null => {
  if (!isObject(raw)) return null;
  return {
    toMake: count(raw.toMake),
    sellPrice: count(raw.sellPrice),
    keep: whole(raw.keep),
    keepPct: Math.round(num(raw.keepPct)),
    foodCostPct: count(raw.foodCostPct),
    overTarget: bool(raw.overTarget),
  };
};

/** "YYYY-MM-DD", or null. */
export const dateOrNull = (v: unknown): string | null => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// ── Payments to the kitchen's own account (Bachat Box, tiffin periods, catering advances) ──
export const PAY_STATUSES: readonly FoodPaymentStatus[] = ['cod_pending', 'unpaid', 'awaiting_transfer', 'proof_submitted', 'paid', 'void', 'refund_due', 'refunded'];
const ACCOUNT_KINDS = ['raast', 'jazzcash', 'easypaisa', 'bank'] as const;

/** The Food order's own account words (types/food FoodTransferAccount). */
export const transferAccountSerializer = (raw: unknown): FoodTransferAccount | null =>
  isObject(raw) && str(raw.accountNumber)
    ? { kind: oneOf(raw.kind, ACCOUNT_KINDS, 'bank'), title: str(raw.accountTitle), number: str(raw.accountNumber), bankName: strOrNull(raw.bankName) }
    : null;

/** A payment block: how, where it stands, the accounts to pay into, the receipt. */
export const transferPaymentSerializer = <M extends string>(raw: unknown, methods: readonly M[], fallback: M): TransferPayment<M> => {
  const p = isObject(raw) ? raw : {};
  return {
    method: oneOf(p.method, methods, fallback),
    status: oneOf(p.status, PAY_STATUSES, 'unpaid'),
    payBy: strOrNull(p.payBy),
    accounts: Array.isArray(p.accounts) ? list(p.accounts, transferAccountSerializer) : null,
    reference: strOrNull(p.reference),
    proofUrl: strOrNull(p.proofUrl),
    rejectedReason: strOrNull(p.rejectedReason),
  };
};
