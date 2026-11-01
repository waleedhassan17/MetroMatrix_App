// MetroMatrix — Kitchen serializers: the assistant's drafts (5C), review themes and nutrition.
// docs/API_KITCHEN.md §31–33. Every draft is a draft: the kitchen sends the ordinary request.

import type {
  ComboIdea,
  Cost,
  DescriptionDraft,
  DishNutrition,
  DraftCategory,
  NutritionFood,
  NutritionMethod,
  PhotoCheck,
  PhotoTipKind,
  ReviewInsights,
  ReviewTheme,
  SpecialIdea,
  VendorNutrition,
} from '../../models/kitchen';
import { arr, bodiesOf, bool, isObject, num, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list, numOrNull } from './kitchenCommon';
import { vendorMenuItemSerializer } from '../food/menuSerializer';

const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);

export const draftCategorySerializer = (raw: unknown): DraftCategory | null => (isObject(raw) && str(raw.id) ? { id: str(raw.id), name: str(raw.name) } : null);

/** POST /ai/describe: the draft (English and Urdu script) beside what the menu says now. Nothing is saved. */
export const descriptionDraftSerializer = fromResponse((raw: unknown): DescriptionDraft | null => {
  if (!isObject(raw) || !str(raw.itemId) || !isObject(raw.draft)) return null;
  const c = isObject(raw.current) ? raw.current : {};
  return {
    itemId: str(raw.itemId),
    name: str(raw.name),
    current: { en: strOrNull(c.description), ur: strOrNull(c.descriptionUr) },
    en: str(raw.draft.description),
    ur: str(raw.draft.descriptionUr),
  };
});

/** Several drafts asked for one dish at a time. */
export const descriptionDraftsSerializer = (raws: unknown[]): DescriptionDraft[] => raws.map(x => descriptionDraftSerializer(x)).filter((x): x is DescriptionDraft => x !== null);

/** A cost from the API's numbers: what it costs to make a serving and what the kitchen keeps. */
const costOf = (toMake: number, sellPrice: number, foodCostPct: number, targetPct: number): Cost => {
  const keep = sellPrice - toMake;
  return { toMake, sellPrice, keep, keepPct: sellPrice ? Math.round((keep / sellPrice) * 100) : 0, foodCostPct: Math.round(foodCostPct), overTarget: foodCostPct > targetPct };
};

/** POST /ai/specials: dishes from what expires in the next 3 days, costed and priced. */
export const specialIdeasSerializer = fromResponse((raw: unknown): { items: SpecialIdea[]; category: DraftCategory | null; message: string | null } => {
  const r = isObject(raw) ? raw : {};
  const target = count(r.targetFoodCostPct) || 35;
  const items = list(r.ideas, i => {
    if (!isObject(i) || !str(i.name)) return null;
    const lines = list(i.lines, l => (isObject(l) && str(l.ingredientId) && num(l.qty) > 0 ? l : null));
    const price = count(i.suggestedPrice);
    const servings = Math.max(1, count(i.servings));
    return {
      id: str(i.name),
      title: str(i.name),
      description: str(i.description),
      uses: lines.map(l => str(l.name)),
      usesExpiring: lines.filter(l => bool(l.expiring)).map(l => str(l.name)),
      lines: lines.map(l => ({ ingredientId: str(l.ingredientId), qty: num(l.qty), unit: str(l.unit) })),
      servings,
      why: strOrNull(i.why),
      suggestedPrice: price,
      cost: costOf(Math.round(num(i.costPerServing)), price, num(i.foodCostPct), target),
    };
  });
  return { items, category: null, message: strOrNull(r.message) };
});

/** POST /ai/specials/create answers `{ item, recipe }`: the new dish. */
export const createdSpecialSerializer = fromResponse((raw: unknown) => vendorMenuItemSerializer(isObject(raw) ? raw.item : null));

/** POST /ai/combos: pairs ordered together, a bundle price and its draft dish (never created for you). */
export const comboIdeasSerializer = fromResponse((raw: unknown): { items: ComboIdea[]; category: DraftCategory | null } => {
  const r = isObject(raw) ? raw : {};
  const items = list(r.combos, c => {
    if (!isObject(c)) return null;
    const dishes = list(c.items, x => (isObject(x) && str(x.itemId) ? x : null));
    if (dishes.length < 2) return null;
    const bundle = count(c.bundlePrice);
    const draft = isObject(c.draft) && isObject(c.draft.body) ? c.draft.body : {};
    return {
      id: str(c.key) || dishes.map(d => str(d.itemId)).join('+'),
      itemIds: dishes.map(d => str(d.itemId)),
      names: dishes.map(d => str(d.name)),
      name: str(c.name),
      description: strOrNull(c.description) ?? strOrNull(draft.description),
      orderedTogether: count(c.together),
      regularPrice: count(c.price),
      bundlePrice: bundle,
      cost: c.cost === null || c.cost === undefined ? null : costOf(Math.round(num(c.cost)), bundle, num(c.foodCostPct), 35),
      categoryId: strOrNull(draft.categoryId),
    };
  });
  return { items, category: null };
});

const TIP_KIND: Record<string, PhotoTipKind> = { dark: 'light', overexposed: 'light', flat: 'background', blurry: 'focus' };

/** POST /ai/photo-check: measured on the server (light, contrast, focus, framing), with the model's tips when AI is on. */
export const photoCheckSerializer = fromResponse((raw: unknown, imageUrl: string = ''): PhotoCheck | null => {
  if (!isObject(raw) || raw.score === undefined) return null;
  const score = Math.max(0, Math.min(100, Math.round(num(raw.score))));
  const problems = strings(raw.problems);
  const tips = strings(raw.tips).map((text, n) => ({ kind: TIP_KIND[problems[n]] ?? ('framing' as PhotoTipKind), text }));
  const extra = strings(raw.aiTips).map(text => ({ kind: 'framing' as PhotoTipKind, text }));
  return { imageUrl, score, verdict: score >= 80 ? 'good' : score >= 60 ? 'ok' : 'retake', tips: [...tips, ...extra].slice(0, 6) };
});

/** GET /review-insights: a week's themes (anonymised; the latest unless another is picked), and the weeks there are. */
export const reviewInsightsSerializer = fromResponse((raw: unknown, week: string | null = null): ReviewInsights | null => {
  if (!isObject(raw) || !isObject(raw.latest)) return null;
  const entries = [raw.latest, ...arr(raw.history)].filter(isObject).filter(e => dateOrNull(e.periodStart));
  const l = (week && entries.find(e => dateOrNull(e.periodStart) === week)) || raw.latest;
  const start = dateOrNull(l.periodStart);
  if (!start) return null;
  const themes = list(l.themes, t =>
    isObject(t) && str(t.theme)
      ? { key: str(t.theme), label: str(t.theme).replace(/^./, c => c.toUpperCase()), tone: t.sentiment === 'negative' ? 'negative' : 'positive', count: count(t.count), snippets: strings(t.examples).slice(0, 3) }
      : null,
  ) as ReviewTheme[];
  return {
    week: start,
    from: start,
    to: dateOrNull(l.periodEnd) ?? start,
    reviewCount: count(l.reviewCount),
    weeks: entries.map(e => ({ week: dateOrNull(e.periodStart)!, count: count(e.reviewCount) })),
    themes,
  };
});

/** How far the next insight is: new written reviews since the last, of the 5 it needs. */
export const reviewInsightsWaitSerializer = fromResponse((raw: unknown) => (isObject(raw) ? { newReviews: count(raw.newReviews), needed: count(raw.needed) || 5 } : null));

const METHOD: Record<string, NutritionMethod> = { recipe: 'recipe', ai: 'ai_estimate', ai_estimate: 'ai_estimate', estimate: 'ai_estimate', none: 'none' };

const macro = (v: unknown) => {
  const n = numOrNull(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

/** A dish's estimated numbers: a row of GET /nutrition/items, or GET /nutrition/items/:id. */
export const dishNutritionSerializer = fromResponse((raw: unknown, name: string = ''): DishNutrition | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const n = isObject(raw.nutrition) ? raw.nutrition : raw;
  const per = isObject(n.perServing) ? n.perServing : n;
  const method = METHOD[str(n.method)] ?? (macro(per.kcal) === null ? 'none' : 'recipe');
  const recipe = isObject(raw.recipe) ? raw.recipe : {};
  return {
    itemId: str(raw.itemId),
    name: str(raw.name) || name,
    kcal: method === 'none' ? null : macro(per.kcal),
    protein: method === 'none' ? null : macro(per.proteinG),
    carbs: method === 'none' ? null : macro(per.carbsG),
    fat: method === 'none' ? null : macro(per.fatG),
    method,
    confidence: Math.max(0, Math.min(1, num(n.confidence, method === 'recipe' ? 0.9 : 0.4))),
    hidden: bool(n.hidden),
    missing: list(recipe.unmapped, u => (isObject(u) ? str(u.name) : typeof u === 'string' ? u : null)),
  };
});

/** The kitchen's dishes with their numbers, and its ingredients without a reference food (with the suggestions). */
export const vendorNutritionSerializer = (parts: { items: unknown; mapping: unknown }): VendorNutrition => {
  const raw = bodiesOf(parts);
  const items = list(isObject(raw.items) ? raw.items.items : raw.items, x => dishNutritionSerializer(x));
  const mapping = list(isObject(raw.mapping) ? raw.mapping.items : raw.mapping, m => (isObject(m) && str(m.ingredientId) ? m : null));
  const unmapped = mapping
    .filter(m => !isObject(m.food) || m.status === 'suggested')
    .map(m => ({
      ingredientId: str(m.ingredientId),
      name: str(m.name),
      usedIn: [],
      suggestions: isObject(m.suggestion) && str(m.suggestion.id) ? [{ foodId: str(m.suggestion.id), name: str(m.suggestion.name), per: 'g100' as const }] : [],
    }));
  return {
    counts: {
      recipe: items.filter(i => i.method === 'recipe').length,
      estimate: items.filter(i => i.method === 'ai_estimate').length,
      none: items.filter(i => i.method === 'none').length,
      hidden: items.filter(i => i.hidden).length,
    },
    items,
    unmapped,
  };
};

/** The reference foods (per 100 g, or a piece when it has a piece weight). */
const foodSerializer = (raw: unknown): NutritionFood | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const p = isObject(raw.per100g) ? raw.per100g : {};
  return { id: str(raw.id), name: str(raw.name), per: 'g100', kcal: num(p.kcal), protein: num(p.proteinG), carbs: num(p.carbsG), fat: num(p.fatG) };
};

export const nutritionFoodsSerializer = fromResponse((raw: unknown): NutritionFood[] => list(isObject(raw) ? raw.items : raw, foodSerializer));
