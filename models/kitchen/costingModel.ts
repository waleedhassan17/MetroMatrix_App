// ═══════════════════════════════════════════════════════
// MetroMatrix — Cost to make, live while a recipe card is edited
// ═══════════════════════════════════════════════════════
// The server's rule (docs/API_KITCHEN_ASSUMED.md §3.3), mirrored so the
// editor answers as the cook types: ingredients ÷ the servings they make,
// plus packaging per serving, at what the kitchen paid. Whole rupees for
// the card; the saved recipe's cost (the server's) replaces this one.

import type { Cost, RecipeInput } from '../kitchen';
import { typedToBase, unitOfKey } from './stockModel';
import type { ValidationErrors } from '../authModel';
import { formatPKR } from '../../utils/money/money';

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

/** A recipe line as the editor holds it: what was typed, in which unit. */
export interface DraftLine {
  key: string;
  ingredientId: string;
  amount: string;
  unitKey: string;
}

export interface RecipeDraft {
  yield: string;
  lines: DraftLine[];
  packaging: DraftLine[];
  /** optionId → its lines (per serving). */
  addOns: Record<string, DraftLine[]>;
  signatureOn: boolean;
  creatorName: string;
}

/** An ingredient as the editor needs it: how it is counted and what it costs. */
export interface CostedIngredient {
  id: string;
  name: string;
  baseUnit: 'g' | 'ml' | 'pc';
  dozens: boolean;
  customUnits: { name: string; base: number }[];
  costPerBase: number;
}

/** A draft line in base units (null while its amount isn't a number). */
export const baseOfLine = (l: DraftLine, byId: Record<string, CostedIngredient>): number | null => {
  const i = byId[l.ingredientId];
  if (!i) return null;
  return typedToBase(l.amount, unitOfKey(i, l.unitKey).unit);
};

const costLines = (lines: DraftLine[], byId: Record<string, CostedIngredient>): CostLine[] =>
  lines.map(l => ({ ingredientId: l.ingredientId, qty: baseOfLine(l, byId) ?? 0, costPerBase: byId[l.ingredientId]?.costPerBase ?? 0 }));

/** The card's live cost while editing. */
export const draftCost = (d: RecipeDraft, byId: Record<string, CostedIngredient>, sellPrice: number, targetPct: number) => {
  const servings = Math.max(1, Math.round(Number(d.yield) || 1));
  return costCard(toMake(costLines(d.lines, byId), costLines(d.packaging, byId), servings), sellPrice, targetPct);
};

/** One line's cost per serving, worded ("Rs 93", "under Rs 1"). */
export const draftLineCost = (l: DraftLine, byId: Record<string, CostedIngredient>, servings: number) =>
  lineCostLabel(lineCost({ ingredientId: l.ingredientId, qty: baseOfLine(l, byId) ?? 0, costPerBase: byId[l.ingredientId]?.costPerBase ?? 0 }, servings));

/** The draft → the API's body (base units). Lines with no amount are reported by key. */
export const recipeInputOf = (d: RecipeDraft, byId: Record<string, CostedIngredient>): { input: RecipeInput; lineErrors: Record<string, string> } => {
  const lineErrors: Record<string, string> = {};
  const toLines = (xs: DraftLine[]) =>
    xs.map(l => {
      const qty = baseOfLine(l, byId);
      if (!qty || qty <= 0) lineErrors[l.key] = 'Enter how much';
      return { ingredientId: l.ingredientId, qty: qty ?? 0 };
    });
  const input: RecipeInput = {
    yield: Math.round(Number(d.yield) || 0),
    lines: toLines(d.lines),
    packaging: toLines(d.packaging),
    addOns: Object.entries(d.addOns)
      .filter(([, lines]) => lines.length)
      .map(([optionId, lines]) => ({ optionId, lines: toLines(lines) })),
    signature: { on: d.signatureOn, creatorName: d.signatureOn ? d.creatorName.trim() : null },
  };
  return { input, lineErrors };
};
