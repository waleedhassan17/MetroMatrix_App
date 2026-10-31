// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy assistant routes (5C)
// ═══════════════════════════════════════════════════════
// Descriptions in English and Urdu, today's specials from expiring stock,
// combo ideas, a photo check, the week's review themes, and the kitchen's
// nutrition with the ingredients still to map. Every draft is gated by the
// assistant's switch and the monthly actions (AI_ASSUMED §2) and counted
// once; nothing here saves a dish, a deal or a recipe (the app confirms
// through the ordinary routes). TODO(API_AI) TODO(API_KITCHEN)

import type { ShopCtx } from '../shop/shopRoutes';
import type { MockFoodVendor } from '../food/foodTypes';
import { dateInZone } from '../../../../utils/health-time/healthTime';
import { DATE, KitchenError, invalid, itemsOf, k, notFound, text, todayOf } from './kitchenLogic';
import { aiGate, recordAiUse, usageWire } from './aiLogic';
import { THEMES, categoryFor, defaultReviewWeek, comboIdeas, describeItem, foodSuggestions, nutritionOf, photoCheck, reviewThemes, specialIdeas, themeMatches, weekOf } from './assistantLogic';
import type { KitchenKit } from './kitchenRoutes';

const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;
export const MAX_DESCRIPTION_ITEMS = 10;
export const MAX_URDU_DESCRIPTION = 1000;

/** Counted once per key (a week's themes, a dish's estimate). */
const countOnce = (ctx: ShopCtx, key: string) => {
  const seen = k(ctx.db).aiCounted ?? (k(ctx.db).aiCounted = []);
  if (seen.includes(key)) return false;
  seen.push(key);
  return true;
};

export function registerAssistantRoutes(kit: KitchenKit) {
  const { route, myVendor } = kit;

  const gate = (ctx: ShopCtx, v: MockFoodVendor, feature: Parameters<typeof aiGate>[3]) => {
    aiGate(ctx.db, v.businessId, 'vendor', feature, ctx.now);
    recordAiUse(ctx.db, v.businessId, feature, ctx.now);
  };

  // ── Descriptions: English and Urdu drafts ──
  route('POST', '/food/vendor/ai/descriptions', ctx => {
    const v = myVendor(ctx);
    const ids: unknown = ctx.body.itemIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_DESCRIPTION_ITEMS || ids.some(x => typeof x !== 'string'))
      throw invalid('itemIds', `Pick 1 to ${MAX_DESCRIPTION_ITEMS} dishes.`);
    const items = (ids as string[]).map(id => {
      const i = ctx.db.food.items.find(x => x.id === id && x.businessId === v.businessId);
      if (!i) throw notFound('Dish');
      return i;
    });
    gate(ctx, v, 'descriptions');
    return {
      items: items.map(i => {
        const draft = describeItem(ctx.db, v.businessId, i);
        const ur = (k(ctx.db).itemTexts ?? []).find(t => t.itemId === i.id)?.descriptionUr ?? null;
        return { itemId: i.id, name: i.name, current: { en: i.description, ur }, en: draft.en, ur: draft.ur };
      }),
    };
  });

  // ── Today's specials ──
  route('POST', '/food/vendor/ai/specials', ctx => {
    const v = myVendor(ctx);
    const raw: unknown = ctx.body.ingredientIds;
    if (raw !== undefined && raw !== null && (!Array.isArray(raw) || raw.length > 10 || raw.some(x => typeof x !== 'string'))) throw invalid('ingredientIds', 'Up to 10 ingredients.');
    const ids = Array.isArray(raw) && raw.length ? (raw as string[]) : null;
    if (ids?.some(id => !k(ctx.db).ingredients.some(i => i.id === id && i.businessId === v.businessId))) throw notFound('Ingredient');
    gate(ctx, v, 'specials');
    const category = categoryFor(ctx.db, v.businessId, /special|today|chef/i);
    return { items: specialIdeas(ctx.db, v, ids, ctx.now), category };
  });

  // ── Combo ideas ──
  route('POST', '/food/vendor/ai/combos', ctx => {
    const v = myVendor(ctx);
    gate(ctx, v, 'combos');
    return { items: comboIdeas(ctx.db, v), category: categoryFor(ctx.db, v.businessId, /deal|combo/i) };
  });

  // ── Photo check ──
  route('POST', '/food/vendor/ai/photo-check', ctx => {
    const v = myVendor(ctx);
    const url = text(ctx.body.imageUrl);
    if (!IMAGE_URL.test(url)) throw invalid('imageUrl', 'Upload the photo first.');
    if (ctx.body.itemId !== undefined && ctx.body.itemId !== null && !ctx.db.food.items.some(i => i.id === ctx.body.itemId && i.businessId === v.businessId)) throw notFound('Dish');
    gate(ctx, v, 'photo_check');
    return { imageUrl: url, ...photoCheck(url) };
  });

  // ── The week's review themes ──
  route('GET', '/food/vendor/reviews/insights', ctx => {
    const v = myVendor(ctx);
    const today = todayOf(v, ctx.now);
    const week = ctx.query.week ? String(ctx.query.week) : defaultReviewWeek(ctx.db, v, ctx.now);
    if (!DATE.test(week) || weekOf(week) !== week) throw invalid('week', 'week is a Monday (YYYY-MM-DD).');
    if (week > weekOf(today)) throw invalid('week', 'That week hasn’t started.');
    // A week is read (and counted) once; looking again is free.
    const key = `review_insights:${v.businessId}:${week}`;
    aiGate(ctx.db, v.businessId, 'vendor', 'review_insights', ctx.now);
    if (countOnce(ctx, key)) recordAiUse(ctx.db, v.businessId, 'review_insights', ctx.now);
    return reviewThemes(ctx.db, v, week, ctx.now);
  });

  // ── Nutrition (the kitchen's view; customers see it only where the kitchen doesn't hide it) ──
  const nutritionRows = (ctx: ShopCtx, v: MockFoodVendor) => {
    const u = usageWire(ctx.db, v.businessId, 'vendor', ctx.now);
    let left = u.enabled ? u.left : 0;
    return itemsOf(ctx.db, v.businessId).map(i => {
      const key = `nutrition_estimate:${i.id}`;
      const counted = (k(ctx.db).aiCounted ?? []).includes(key);
      const row = nutritionOf(ctx.db, v.businessId, i, u.enabled && (counted || left > 0));
      if (row.method === 'ai_estimate' && countOnce(ctx, key)) {
        recordAiUse(ctx.db, v.businessId, 'nutrition_estimate', ctx.now);
        left -= 1;
      }
      return row;
    });
  };

  route('GET', '/food/vendor/nutrition', ctx => {
    const v = myVendor(ctx);
    const items = nutritionRows(ctx, v);
    const mine = k(ctx.db).ingredients.filter(i => i.businessId === v.businessId && i.category !== 'packaging' && !i.nutritionFoodId && i.priceRefKey !== 'salt');
    const recipes = k(ctx.db).recipes.filter(r => r.businessId === v.businessId);
    const unmapped = mine
      .map(i => ({
        ingredientId: i.id,
        name: i.name,
        usedIn: [...new Set(recipes.filter(r => r.lines.some(l => l.ingredientId === i.id)).map(r => ctx.db.food.items.find(x => x.id === r.itemId)?.name).filter((x): x is string => !!x))],
        suggestions: foodSuggestions(ctx.db, i.name),
      }))
      .sort((a, b) => b.usedIn.length - a.usedIn.length || a.name.localeCompare(b.name));
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
  });

  route('PATCH', '/food/vendor/nutrition/:itemId', ctx => {
    const v = myVendor(ctx);
    const i = ctx.db.food.items.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.businessId === v.businessId);
    if (!i) throw notFound('Dish');
    if (typeof ctx.body.hidden !== 'boolean') throw invalid('hidden', 'hidden must be true or false');
    const all = k(ctx.db).nutritionHidden ?? (k(ctx.db).nutritionHidden = []);
    k(ctx.db).nutritionHidden = ctx.body.hidden ? [...new Set([...all, i.id])] : all.filter(x => x !== i.id);
    const u = usageWire(ctx.db, v.businessId, 'vendor', ctx.now);
    return nutritionOf(ctx.db, v.businessId, i, u.enabled && (k(ctx.db).aiCounted ?? []).includes(`nutrition_estimate:${i.id}`));
  });

  /** The nutrition foods an ingredient can map to (searching the staff's list). */
  route('GET', '/food/vendor/kitchen/nutrition-foods', ctx => {
    myVendor(ctx);
    const q = text(ctx.query.q).toLowerCase();
    const rows = k(ctx.db)
      .nutritionFoods.filter(f => !q || f.name.toLowerCase().includes(q) || f.key.includes(q.replace(/\s+/g, '_')))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
    return { items: rows.map(f => ({ id: f.id, name: f.name, per: f.per, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat })) };
  });
}

/** Food hooks for the assistant: a dish's Urdu description, and reviews by theme. */
export const assistantHooks = {
  onItemSaved: (db: ShopCtx['db'], i: { id: string }, body: Record<string, unknown>) => {
    if (!db.kitchen || body.descriptionUr === undefined) return;
    if (body.descriptionUr !== null && (typeof body.descriptionUr !== 'string' || body.descriptionUr.trim().length > MAX_URDU_DESCRIPTION))
      throw invalid('descriptionUr', `descriptionUr must be at most ${MAX_URDU_DESCRIPTION} characters`);
    const value = typeof body.descriptionUr === 'string' && body.descriptionUr.trim() ? body.descriptionUr.trim() : null;
    const all = k(db).itemTexts ?? (k(db).itemTexts = []);
    const at = all.findIndex(t => t.itemId === i.id);
    if (at >= 0) all[at] = { itemId: i.id, descriptionUr: value };
    else all.push({ itemId: i.id, descriptionUr: value });
  },
  vendorReviewFilter: (_db: ShopCtx['db'], v: MockFoodVendor, query: Record<string, string>) => {
    const theme = query.theme ? THEMES.find(t => t.key === query.theme) : null;
    if (query.theme && !theme) throw new KitchenError(400, 'VALIDATION_FAILED', `theme must be one of the following values: ${THEMES.map(t => t.key).join(', ')}`, { fields: { theme: ['unknown theme'] } });
    const week = query.week ? String(query.week) : null;
    if (week && !DATE.test(week)) throw invalid('week', 'week is a Monday (YYYY-MM-DD).');
    return (r: { tags: string[]; text: string | null; createdAt: string }) =>
      (!theme || themeMatches(theme, r)) && (!week || weekOf(dateInZone(r.createdAt, v.timezone)) === week);
  },
};
