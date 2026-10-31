// ═══════════════════════════════════════════════════════
// MetroMatrix — The assistant (5C) in plain words, and what confirming sends
// ═══════════════════════════════════════════════════════
// A draft becomes real only through the ordinary routes: a description is
// the dish edit, a special a hidden new dish plus its recipe card, a combo
// a deal on the menu at the bundle price. Nutrition is said with how it was
// worked out and how sure it is; review weeks read "12–18 Oct".

import type { ComboIdea, Cost, DishNutrition, NutritionMethod, PhotoTipKind, PhotoVerdict, RecipeInput, SpecialIdea } from '../kitchen';
import type { MenuItemInput } from '../food';
import type { ValidationErrors } from '../authModel';
import { formatPKR, parseRupees } from '../../utils/money/money';
import { addDays } from '../../utils/health-time/healthTime';
import { EVERY_DAY } from '../food/menuModel';
import { costCard } from './costingModel';
import type { KitchenTone } from './kitchenStatusModel';

// ── Descriptions ──
export const MAX_DESCRIPTION_DISHES = 10;
/** The Food API's limit on a dish's description, and the same for the Urdu one. */
export const DESCRIPTION_MAX = 1000;

export const validateDescription = (d: { en: string; ur: string }): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (d.en.trim().length > DESCRIPTION_MAX) errors.en = `Up to ${DESCRIPTION_MAX} characters`;
  if (d.ur.trim().length > DESCRIPTION_MAX) errors.ur = `Up to ${DESCRIPTION_MAX} characters`;
  if (!d.en.trim() && !d.ur.trim()) errors.en = 'Write it in English, Urdu or both';
  return errors;
};

export const descriptionInput = (d: { en: string; ur: string }) => ({ description: d.en.trim() || null, descriptionUr: d.ur.trim() || null });

// ── Specials and combos: prices and what is kept ──
export const validateDraftPrice = (raw: string): string | null => {
  const p = parseRupees(raw);
  if (p === null || p < 10) return 'A price in rupees';
  if (p > 500000) return 'That price is too high';
  return null;
};

/** The cost card again at the price the cook typed. */
export const repriced = (cost: Pick<Cost, 'toMake'>, raw: string, targetPct: number) => {
  const p = parseRupees(raw);
  return p === null ? null : costCard(cost.toMake, p, targetPct);
};

export const specialItemInput = (s: Pick<SpecialIdea, 'title' | 'description'>, categoryId: string, price: number): MenuItemInput => ({
  categoryId,
  name: s.title.slice(0, 120),
  description: s.description || null,
  photoUrl: null,
  basePrice: price,
  tags: [],
  isDeal: false,
  serves: 1,
  days: EVERY_DAY,
  // A draft dish: hidden until the cook turns it on in the menu.
  isActive: false,
});

export const specialRecipe = (s: Pick<SpecialIdea, 'lines'>): RecipeInput => ({
  yield: 1,
  lines: s.lines.map(l => ({ ingredientId: l.ingredientId, qty: Math.round(l.qty) })),
  addOns: [],
  packaging: [],
  signature: { on: false, creatorName: null },
});

export const comboTitle = (c: Pick<ComboIdea, 'names'>) => c.names.join(' + ').slice(0, 120);

export const comboItemInput = (c: Pick<ComboIdea, 'names'>, categoryId: string, price: number): MenuItemInput => ({
  categoryId,
  name: comboTitle(c),
  description: `${c.names.slice(0, -1).join(', ')} and ${c.names[c.names.length - 1]} together.`,
  photoUrl: null,
  basePrice: price,
  tags: [],
  isDeal: true,
  serves: 1,
  days: EVERY_DAY,
  isActive: true,
});

export const savingLine = (c: Pick<ComboIdea, 'regularPrice'>, price: number) =>
  price < c.regularPrice ? `${formatPKR(c.regularPrice - price)} less than both apart (${formatPKR(c.regularPrice)})` : `Both apart: ${formatPKR(c.regularPrice)}`;

// ── Photo check ──
export const PHOTO_VERDICT: Record<PhotoVerdict, { label: string; tone: KitchenTone }> = {
  good: { label: 'Good to use', tone: 'success' },
  ok: { label: 'Fine, could be better', tone: 'warning' },
  retake: { label: 'Worth taking again', tone: 'warning' },
};

export const TIP_KIND: Record<PhotoTipKind, { label: string; icon: string }> = {
  light: { label: 'Light', icon: 'sunny-outline' },
  framing: { label: 'Framing', icon: 'crop-outline' },
  background: { label: 'Background', icon: 'image-outline' },
  focus: { label: 'Focus', icon: 'scan-outline' },
};

// ── Review weeks ──
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (date: string) => ({ d: Number(date.slice(8, 10)), m: MONTHS[Number(date.slice(5, 7)) - 1] });

/** "12–18 Oct", or "28 Sep – 4 Oct" across a month. */
export const weekLabel = (monday: string) => {
  const a = dayMonth(monday);
  const b = dayMonth(addDays(monday, 6));
  return a.m === b.m ? `${a.d}–${b.d} ${a.m}` : `${a.d} ${a.m} – ${b.d} ${b.m}`;
};

// ── Nutrition ──
export const NUTRITION_METHOD: Record<NutritionMethod, string> = {
  recipe: 'From your recipe card',
  ai_estimate: 'Estimated from the dish’s name',
  none: 'Not worked out yet',
};

export const confidenceOf = (c: number): { label: string; tone: KitchenTone } =>
  c >= 0.9 ? { label: 'High confidence', tone: 'success' } : c >= 0.5 ? { label: 'Medium confidence', tone: 'warning' } : { label: 'Low confidence', tone: 'neutral' };

/** "973 kcal · protein 43 g · carbs 118 g · fat 35 g" (one order, as sold). */
export const nutritionLine = (n: Pick<DishNutrition, 'kcal' | 'protein' | 'carbs' | 'fat'>) =>
  n.kcal === null ? 'No numbers yet' : `${n.kcal} kcal · protein ${n.protein ?? 0} g · carbs ${n.carbs ?? 0} g · fat ${n.fat ?? 0} g`;

export const PER_LABEL: Record<'g100' | 'ml100' | 'piece', string> = { g100: 'per 100 g', ml100: 'per 100 ml', piece: 'per piece' };
