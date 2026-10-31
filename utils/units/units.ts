// ═══════════════════════════════════════════════════════
// MetroMatrix — Quantities and units (the kitchen's one formatter)
// ═══════════════════════════════════════════════════════
// The API counts stock in base units — grams, millilitres, pieces — and
// this module is the only place that turns them into words a cook reads:
// "7.5 kg", "750 g", "2 dozen", "1.5 L". Never a big number of grams.
// The dummy API counts with this same module, so the two can't drift.
// TODO(API_KITCHEN): mirror of the API's units.ts (docs/API_KITCHEN_ASSUMED.md §1.2).
//
// Like money.ts: no Intl (Hermes builds differ), grouping by hand.

import { formatPKR } from '../money/money';

export type BaseUnit = 'g' | 'ml' | 'pc';
export type StandardUnit = 'g' | 'kg' | 'pao' | 'ml' | 'l' | 'pc' | 'dozen';

/** A kitchen's own unit for one ingredient: "crate" = 30 pieces, "bori" = 40 kg (in base units). */
export interface CustomUnit {
  name: string;
  base: number;
}

export const BASE_UNITS: readonly BaseUnit[] = ['g', 'ml', 'pc'];
export const STANDARD_UNITS: readonly StandardUnit[] = ['g', 'kg', 'pao', 'ml', 'l', 'pc', 'dozen'];

export const UNITS: Record<StandardUnit, { base: BaseUnit; factor: number; one: string; many: string }> = {
  g: { base: 'g', factor: 1, one: 'g', many: 'g' },
  kg: { base: 'g', factor: 1000, one: 'kg', many: 'kg' },
  // A pao is a quarter kilo, as every Pakistani sabzi stall weighs.
  pao: { base: 'g', factor: 250, one: 'pao', many: 'pao' },
  ml: { base: 'ml', factor: 1, one: 'ml', many: 'ml' },
  l: { base: 'ml', factor: 1000, one: 'L', many: 'L' },
  pc: { base: 'pc', factor: 1, one: 'piece', many: 'pieces' },
  dozen: { base: 'pc', factor: 12, one: 'dozen', many: 'dozen' },
};

/** The units a picker offers for an ingredient counted in `base`. */
export const unitsFor = (base: BaseUnit): StandardUnit[] => STANDARD_UNITS.filter(u => UNITS[u].base === base);

/**
 * Words people say or type for a unit, in English, Roman Urdu and Urdu
 * script, lower-cased. The voice stand-in and the forms both read them.
 */
export const UNIT_ALIASES: Record<string, StandardUnit> = {
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  gramme: 'g',
  'گرام': 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  'کلو': 'kg',
  'کلوگرام': 'kg',
  pao: 'pao',
  paao: 'pao',
  pau: 'pao',
  'پاؤ': 'pao',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  l: 'l',
  ltr: 'l',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  'لیٹر': 'l',
  pc: 'pc',
  pcs: 'pc',
  piece: 'pc',
  pieces: 'pc',
  adad: 'pc',
  'عدد': 'pc',
  dozen: 'dozen',
  darjan: 'dozen',
  darjen: 'dozen',
  'درجن': 'dozen',
};

export const parseUnit = (word: string): StandardUnit | null => UNIT_ALIASES[word.trim().toLowerCase()] ?? null;

const isCustom = (u: StandardUnit | CustomUnit): u is CustomUnit => typeof u === 'object';

/** 2.5 kg → 2500 (g). Rounded to a whole base unit: the API stores integers. */
export const toBase = (qty: number, unit: StandardUnit | CustomUnit): number => {
  const factor = isCustom(unit) ? unit.base : UNITS[unit].factor;
  return Math.round(qty * factor);
};

export const fromBase = (base: number, unit: StandardUnit | CustomUnit): number => base / (isCustom(unit) ? unit.base : UNITS[unit].factor);

/** 7.5, 12, 0.25 — at most two decimals, trailing zeros dropped, grouped thousands. */
export const formatNumber = (n: number, decimals = 2): string => {
  const safe = Number.isFinite(n) ? n : 0;
  const raw = Math.abs(safe).toFixed(decimals);
  const fixed = raw.includes('.') ? raw.replace(/\.?0+$/, '') : raw;
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = safe < 0 && fixed !== '0' ? '−' : '';
  return `${sign}${grouped}${frac ? `.${frac}` : ''}`;
};

export interface FormatQtyOptions {
  /** Pieces in dozens when they divide evenly (eggs). */
  dozens?: boolean;
  /** The kitchen's own unit, used when the amount is a whole number of it. */
  custom?: CustomUnit | null;
}

/**
 * Base units → what a cook reads: 7500 g → "7.5 kg", 750 g → "750 g",
 * 24 pc (dozens) → "2 dozen", 1500 ml → "1.5 L", 1 pc → "1 piece".
 */
export const formatQty = (base: number, unit: BaseUnit, opts: FormatQtyOptions = {}): string => {
  const abs = Math.abs(base);
  if (opts.custom && opts.custom.base > 0 && abs >= opts.custom.base && abs % opts.custom.base === 0) {
    return `${formatNumber(base / opts.custom.base)} ${opts.custom.name}`;
  }
  if (unit === 'g') return abs >= 1000 ? `${formatNumber(base / 1000)} kg` : `${formatNumber(base, 0)} g`;
  if (unit === 'ml') return abs >= 1000 ? `${formatNumber(base / 1000)} L` : `${formatNumber(base, 0)} ml`;
  if (opts.dozens && abs >= 12 && abs % 12 === 0) return `${formatNumber(base / 12)} dozen`;
  const n = formatNumber(base);
  return `${n} ${abs === 1 ? 'piece' : 'pieces'}`;
};

/** A quantity in the unit it was entered in: 2.5 + kg → "2.5 kg", 3 + dozen → "3 dozen". */
export const formatIn = (qty: number, unit: StandardUnit | CustomUnit): string => {
  if (isCustom(unit)) return `${formatNumber(qty)} ${unit.name}`;
  const u = UNITS[unit];
  return `${formatNumber(qty)} ${Math.abs(qty) === 1 ? u.one : u.many}`;
};

/** The unit a price is quoted per: a kilo, a litre, a piece. */
export const PRICE_PER: Record<BaseUnit, { factor: number; label: string }> = {
  g: { factor: 1000, label: 'kg' },
  ml: { factor: 1000, label: 'litre' },
  pc: { factor: 1, label: 'piece' },
};

/** Rupees per base unit → "Rs 320 / kg" (whole rupees, through formatPKR). */
export const formatUnitPrice = (perBase: number, unit: BaseUnit): string =>
  `${formatPKR(perBase * PRICE_PER[unit].factor)} / ${PRICE_PER[unit].label}`;

/** A pack's price per kilo, litre or piece: Rs 450 for 2 kg → 225 (rupees per kg). */
export const pricePerUnit = (price: number, packBase: number, unit: BaseUnit): number =>
  packBase > 0 ? (price / packBase) * PRICE_PER[unit].factor : 0;
