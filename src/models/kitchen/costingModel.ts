// ═══════════════════════════════════════════════════════
// MetroMatrix — Cost to make, live while a recipe card is edited
// ═══════════════════════════════════════════════════════
// The server's rule (docs/API_KITCHEN_ASSUMED.md §3.3), mirrored so the
// editor answers as the cook types: ingredients ÷ the servings they make,
// plus packaging per serving, at what the kitchen paid. Whole rupees for
// the card; the saved recipe's cost (the server's) replaces this one.

import type { Cost, RecipeInput } from '../../types/kitchen';
import type { ValidationErrors } from '../authModel';
import { formatPKR } from '../../utils/money';

/** A line as the editor holds it: base units and the ingredient's cost per base unit. */
export interface CostLine {
  ingredientId: string;
  qty: number;
  costPerBase: number;
}

export const MAX_YIELD = 500;
export const MAX_RECIPE_LINES = 60;

/** One line's cost per serving (rupees, unrounded). */
export const lineCost = (l: CostLine, servings: number) => (l.qty / Math.max(1, servings)) * l.costPerBase;

export const toMake = (lines: CostLine[], packaging: CostLine[], servings: number) =>
  lines.reduce((n, l) => n + lineCost(l, servings), 0) + packaging.reduce((n, l) => n + l.qty * l.costPerBase, 0);

/** The card's numbers: what it costs, what it sells for, what the kitchen keeps. */
export const costCard = (make: number, sellPrice: number, targetPct: number): Cost => {
  const m = Math.round(make);
  const keep = sellPrice - m;
  const foodCostPct = sellPrice > 0 ? Math.round((m / sellPrice) * 100) : 0;
  return { toMake: m, sellPrice, keep, keepPct: sellPrice > 0 ? Math.round((keep / sellPrice) * 100) : 0, foodCostPct, overTarget: foodCostPct > targetPct };
};

/** "Cost to make Rs 312 · You sell Rs 650 · You keep Rs 338 (52%)". */
export const costSentence = (c: Cost) => `Cost to make ${formatPKR(c.toMake)} · You sell ${formatPKR(c.sellPrice)} · You keep ${formatPKR(c.keep)} (${c.keepPct}%)`;

/** A small line cost, honest about paisa: "Rs 24", "under Rs 1". */
export const lineCostLabel = (rupees: number) => (rupees > 0 && rupees < 0.5 ? 'under Rs 1' : formatPKR(rupees));

/** How a food cost sits against the target, in words. */
export const foodCostLabel = (c: Pick<Cost, 'foodCostPct' | 'overTarget'>, targetPct: number) =>
  c.overTarget ? `Food cost ${c.foodCostPct}%, over your ${targetPct}% target` : `Food cost ${c.foodCostPct}%`;

export const validateRecipe = (r: RecipeInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!Number.isInteger(r.yield) || r.yield < 1 || r.yield > MAX_YIELD) errors.yield = `Servings it makes: 1 to ${MAX_YIELD}`;
  if (!r.lines.length) errors.lines = 'Add at least one ingredient';
  if (r.lines.length + r.packaging.length > MAX_RECIPE_LINES) errors.lines = `Up to ${MAX_RECIPE_LINES} lines`;
  if ([...r.lines, ...r.packaging].some(l => !(l.qty > 0))) errors.lines = 'Give every line an amount';
  if (new Set(r.lines.map(l => l.ingredientId)).size !== r.lines.length) errors.lines = 'Each ingredient once';
  if (r.signature.on && (r.signature.creatorName ?? '').trim().length < 2) errors.creatorName = 'Say who created this recipe';
  return errors;
};

export const TARGET_RANGE = { min: 10, max: 80 } as const;

export const validateTarget = (pct: number): ValidationErrors =>
  Number.isInteger(pct) && pct >= TARGET_RANGE.min && pct <= TARGET_RANGE.max ? {} : { targetFoodCostPct: `Pick ${TARGET_RANGE.min}% to ${TARGET_RANGE.max}%` };
