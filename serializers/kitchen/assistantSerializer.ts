// MetroMatrix — Kitchen serializers: the assistant's drafts (5C), review themes and nutrition.
// docs/AI_ASSUMED.md §3.1 (TODO(API_AI)), docs/API_KITCHEN_ASSUMED.md §4.7 (TODO(API_KITCHEN)).

import type {
  ComboIdea,
  DescriptionDraft,
  DishNutrition,
  DraftCategory,
  NutritionFood,
  NutritionMethod,
  PhotoCheck,
  PhotoTipKind,
  PhotoVerdict,
  ReviewInsights,
  ReviewTheme,
  ReviewThemeKey,
  SpecialIdea,
  UnmappedIngredient,
  VendorNutrition,
} from '../../models/kitchen';
import { arr, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { costSerializer, count, dateOrNull, list, numOrNull } from './kitchenCommon';

const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);
const THEME_KEYS: readonly ReviewThemeKey[] = ['taste', 'fresh', 'portion', 'packing', 'value', 'late', 'cold', 'spice', 'small', 'spill'];
const VERDICTS: readonly PhotoVerdict[] = ['good', 'ok', 'retake'];
const TIP_KINDS: readonly PhotoTipKind[] = ['light', 'framing', 'background', 'focus'];
const METHODS: readonly NutritionMethod[] = ['recipe', 'ai_estimate', 'none'];
const PERS: readonly NutritionFood['per'][] = ['g100', 'ml100', 'piece'];

export const draftCategorySerializer = (raw: unknown): DraftCategory | null => (isObject(raw) && str(raw.id) ? { id: str(raw.id), name: str(raw.name) } : null);

const descriptionSerializer = (raw: unknown): DescriptionDraft | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const c = isObject(raw.current) ? raw.current : {};
  return { itemId: str(raw.itemId), name: str(raw.name), current: { en: strOrNull(c.en), ur: strOrNull(c.ur) }, en: str(raw.en), ur: str(raw.ur) };
};

export const descriptionDraftsSerializer = fromResponse((raw: unknown): DescriptionDraft[] => list(isObject(raw) ? raw.items : raw, descriptionSerializer));

const specialSerializer = (raw: unknown): SpecialIdea | null => {
  if (!isObject(raw) || !str(raw.title)) return null;
  const cost = costSerializer(raw.cost);
  if (!cost) return null;
  return {
    id: str(raw.id, str(raw.title)),
    title: str(raw.title),
    description: str(raw.description),
    uses: strings(raw.uses),
    usesExpiring: strings(raw.usesExpiring),
    lines: list(raw.lines, l => (isObject(l) && str(l.ingredientId) && num(l.qty) > 0 ? { ingredientId: str(l.ingredientId), qty: num(l.qty) } : null)),
    suggestedPrice: count(raw.suggestedPrice),
    cost,
  };
};

export const specialIdeasSerializer = fromResponse((raw: unknown): { items: SpecialIdea[]; category: DraftCategory | null } => {
  const r = isObject(raw) ? raw : {};
  return { items: list(r.items, specialSerializer), category: draftCategorySerializer(r.category) };
});

const comboSerializer = (raw: unknown): ComboIdea | null => {
  if (!isObject(raw)) return null;
  const itemIds = strings(raw.itemIds);
  if (itemIds.length < 2) return null;
  return {
    id: str(raw.id, itemIds.join('+')),
    itemIds,
    names: strings(raw.names),
    orderedTogether: count(raw.orderedTogether),
    regularPrice: count(raw.regularPrice),
    bundlePrice: count(raw.bundlePrice),
    cost: costSerializer(raw.cost),
  };
};

export const comboIdeasSerializer = fromResponse((raw: unknown): { items: ComboIdea[]; category: DraftCategory | null } => {
  const r = isObject(raw) ? raw : {};
  return { items: list(r.items, comboSerializer), category: draftCategorySerializer(r.category) };
});

export const photoCheckSerializer = fromResponse((raw: unknown): PhotoCheck | null => {
  if (!isObject(raw)) return null;
  return {
    imageUrl: str(raw.imageUrl),
    score: Math.max(0, Math.min(100, Math.round(num(raw.score)))),
    verdict: oneOf(raw.verdict, VERDICTS, 'ok'),
    tips: list(raw.tips, t => (isObject(t) && str(t.text) ? { kind: oneOf(t.kind, TIP_KINDS, 'framing'), text: str(t.text) } : null)),
  };
});

const themeSerializer = (raw: unknown): ReviewTheme | null =>
  isObject(raw) && THEME_KEYS.includes(raw.key as ReviewThemeKey)
    ? {
        key: raw.key as ReviewThemeKey,
        label: str(raw.label),
        tone: raw.tone === 'negative' ? 'negative' : 'positive',
        count: count(raw.count),
        snippets: strings(raw.snippets).slice(0, 3),
      }
    : null;

export const reviewInsightsSerializer = fromResponse((raw: unknown): ReviewInsights | null => {
  if (!isObject(raw)) return null;
  const week = dateOrNull(raw.week);
  if (!week) return null;
  return {
    week,
    from: dateOrNull(raw.from) ?? week,
    to: dateOrNull(raw.to) ?? week,
    reviewCount: count(raw.reviewCount),
    weeks: list(raw.weeks, w => (isObject(w) && dateOrNull(w.week) ? { week: dateOrNull(w.week)!, count: count(w.count) } : null)),
    themes: list(raw.themes, themeSerializer),
  };
});

const macro = (v: unknown) => {
  const n = numOrNull(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

export const dishNutritionSerializer = fromResponse((raw: unknown): DishNutrition | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const method = oneOf(raw.method, METHODS, 'none');
  return {
    itemId: str(raw.itemId),
    name: str(raw.name),
    kcal: method === 'none' ? null : macro(raw.kcal),
    protein: method === 'none' ? null : macro(raw.protein),
    carbs: method === 'none' ? null : macro(raw.carbs),
    fat: method === 'none' ? null : macro(raw.fat),
    method,
    confidence: Math.max(0, Math.min(1, num(raw.confidence))),
    hidden: bool(raw.hidden),
    missing: strings(raw.missing),
  };
});

const unmappedSerializer = (raw: unknown): UnmappedIngredient | null =>
  isObject(raw) && str(raw.ingredientId)
    ? {
        ingredientId: str(raw.ingredientId),
        name: str(raw.name),
        usedIn: strings(raw.usedIn),
        suggestions: list(raw.suggestions, x => (isObject(x) && str(x.foodId) ? { foodId: str(x.foodId), name: str(x.name), per: oneOf(x.per, PERS, 'g100') } : null)),
      }
    : null;

export const vendorNutritionSerializer = fromResponse((raw: unknown): VendorNutrition => {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.counts) ? r.counts : {};
  return {
    counts: { recipe: count(c.recipe), estimate: count(c.estimate), none: count(c.none), hidden: count(c.hidden) },
    items: list(r.items, dishNutritionSerializer),
    unmapped: list(r.unmapped, unmappedSerializer),
  };
});

const foodSerializer = (raw: unknown): NutritionFood | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), name: str(raw.name), per: oneOf(raw.per, PERS, 'g100'), kcal: num(raw.kcal), protein: num(raw.protein), carbs: num(raw.carbs), fat: num(raw.fat) }
    : null;

export const nutritionFoodsSerializer = fromResponse((raw: unknown): NutritionFood[] => list(isObject(raw) ? raw.items : raw, foodSerializer));
