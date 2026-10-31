// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy My Kitchen routes (5C)
// ═══════════════════════════════════════════════════════
// /my-kitchen: the pantry (segments, add in lines, use, throw away, add from
// a Shopping order, reminders, the month's numbers), recipe ideas (an
// assistant action, 30 a month), a recipe, its missing items priced from
// Shopping; the person's nutrition settings, summary and "delete it all".
// /food/healthy-picks: dishes under 600 kcal or high in protein nearby.
// Only the signed-in person's own rows, ever. TODO(API_KITCHEN) §4.7.

import type { ShopCtx } from '../shop/shopRoutes';
import { addDays, dateInZone } from '../../../../utils/healthTime';
import { STANDARD_UNITS, UNITS, toBase, type StandardUnit } from '../../../../utils/units';
import { distanceKm, isVisible, quote, unavailableReason } from '../food/foodDiscovery';
import type { MockNutritionSettings, MockPantryItem } from './kitchenTypes';
import { DATE, KitchenError, invalid, isInt, isNum, isoNow, k, nextId, notFound, text } from './kitchenLogic';
import { aiGate, recordAiUse } from './aiLogic';
import { CANON } from './kitchenSeed';
import {
  RECIPES,
  dishNutritionFor,
  healthyTags,
  isMeal,
  keyOfName,
  missingItems,
  nutritionSettingsOf,
  nutritionSettingsWire,
  nutritionSummary,
  pantryOf,
  pantryState,
  pantryWire,
  recipeById,
  recipeWire,
  shelfDays,
  suggestRecipes,
  todayPk,
} from './myKitchenLogic';
import type { KitchenKit } from './kitchenRoutes';

export const MAX_PANTRY_LINES = 30;
export const MAX_PANTRY_ITEMS = 300;
export const PICK_MAX_KCAL = 800;
const SEGMENTS = ['all', 'use_soon', 'expired'] as const;
const GOALS: MockNutritionSettings['goal'][] = ['eat_better', 'maintain', 'lose', 'gain'];
const ACTIVITIES = ['low', 'moderate', 'high'] as const;

export function registerMyKitchenRoutes(kit: KitchenKit) {
  const { route, requireUser } = kit;
  const me = (ctx: ShopCtx) => requireUser(ctx);
  const enc = (s: string) => decodeURIComponent(s);
  const pantryAll = (ctx: ShopCtx) => k(ctx.db).pantry ?? (k(ctx.db).pantry = []);
  const myItem = (ctx: ShopCtx, id: string) => {
    const p = pantryAll(ctx).find(x => x.id === id && x.userId === me(ctx).id && x.status === 'in');
    if (!p) throw notFound('Pantry item');
    return p;
  };

  // ── The pantry ──
  route('GET', '/my-kitchen/pantry', ctx => {
    const u = me(ctx);
    const segment = (ctx.query.segment ?? 'all') as (typeof SEGMENTS)[number];
    if (!SEGMENTS.includes(segment)) throw invalid('segment', `segment must be one of the following values: ${SEGMENTS.join(', ')}`);
    const today = todayPk(ctx.now);
    const mine = pantryOf(ctx.db, u.id).sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') || a.name.localeCompare(b.name));
    const counts = { all: mine.length, use_soon: mine.filter(p => pantryState(p, today) === 'use_soon').length, expired: mine.filter(p => pantryState(p, today) === 'expired').length };
    return { counts, items: mine.filter(p => segment === 'all' || pantryState(p, today) === segment).map(p => pantryWire(p, today)) };
  });

  /** Lines from a form, a voice draft or a receipt: each in a unit people use, matched to an ingredient when it can be. */
  const lineOf = (ctx: ShopCtx, raw: unknown, n: number): Omit<MockPantryItem, 'id' | 'userId' | 'addedAt' | 'source' | 'status' | 'doneAt' | 'savedFromWaste'> => {
    const l = (raw ?? {}) as Record<string, unknown>;
    const name = text(l.name);
    if (name.length < 2 || name.length > 60) throw invalid(`lines.${n}.name`, 'Name it (2 to 60 characters).');
    const unit = l.unit as StandardUnit;
    if (!STANDARD_UNITS.includes(unit)) throw invalid(`lines.${n}.unit`, `unit must be one of the following values: ${STANDARD_UNITS.join(', ')}`);
    if (!isNum(l.qty) || l.qty <= 0 || l.qty > 10000) throw invalid(`lines.${n}.qty`, 'How much?');
    const key = typeof l.key === 'string' && CANON[l.key] ? l.key : keyOfName(ctx.db, name);
    const base = UNITS[unit].base;
    if (key && CANON[key].base !== base) throw invalid(`lines.${n}.unit`, `${CANON[key].name} is counted in ${CANON[key].base === 'pc' ? 'pieces' : CANON[key].base === 'ml' ? 'litres' : 'kilos'}.`);
    const expiresOn = l.expiresOn === undefined || l.expiresOn === null ? null : String(l.expiresOn);
    if (expiresOn !== null && !DATE.test(expiresOn)) throw invalid(`lines.${n}.expiresOn`, 'expiresOn is a date (YYYY-MM-DD).');
    const shelf = shelfDays(key);
    return { name, key, qty: Math.round(toBase(l.qty, unit)), unit: base, expiresOn: expiresOn ?? (shelf ? addDays(todayPk(ctx.now), shelf) : null) };
  };

  route('POST', '/my-kitchen/pantry', ctx => {
    const u = me(ctx);
    const lines: unknown[] = Array.isArray(ctx.body.lines) ? ctx.body.lines : [];
    if (!lines.length || lines.length > MAX_PANTRY_LINES) throw invalid('lines', `Add 1 to ${MAX_PANTRY_LINES} things at a time.`);
    const source: MockPantryItem['source'] = ctx.body.source === 'voice' ? 'voice' : 'manual';
    if (pantryOf(ctx.db, u.id).length + lines.length > MAX_PANTRY_ITEMS) throw new KitchenError(409, 'PANTRY_FULL', `Up to ${MAX_PANTRY_ITEMS} things in your kitchen.`, { max: MAX_PANTRY_ITEMS });
    const added = lines.map((l, n) => lineOf(ctx, l, n)).map(l => ({ ...l, id: nextId(ctx.db, 'pn'), userId: u.id, addedAt: isoNow(ctx.now), source, status: 'in' as const, doneAt: null, savedFromWaste: false }));
    pantryAll(ctx).push(...added);
    ctx.setStatus(201);
    const today = todayPk(ctx.now);
    return { items: added.map(p => pantryWire(p, today)) };
  });

  route('PATCH', '/my-kitchen/pantry/:id', ctx => {
    const p = myItem(ctx, enc(ctx.params[0]));
    const b = ctx.body;
    if (b.expiresOn !== undefined) {
      if (b.expiresOn !== null && !DATE.test(String(b.expiresOn))) throw invalid('expiresOn', 'expiresOn is a date (YYYY-MM-DD).');
      p.expiresOn = b.expiresOn === null ? null : String(b.expiresOn);
    }
    if (b.qty !== undefined || b.unit !== undefined) {
      const unit = (b.unit ?? (p.unit === 'g' ? 'g' : p.unit === 'ml' ? 'ml' : 'pc')) as StandardUnit;
      if (!STANDARD_UNITS.includes(unit) || UNITS[unit].base !== p.unit) throw invalid('unit', 'Keep the same kind of unit.');
      if (!isNum(b.qty) || b.qty <= 0) throw invalid('qty', 'How much?');
      p.qty = Math.round(toBase(b.qty, unit));
    }
    return pantryWire(p, todayPk(ctx.now));
  });

  /** Thrown away: counts as wasted when it had expired. */
  route('DELETE', '/my-kitchen/pantry/:id', ctx => {
    const p = myItem(ctx, enc(ctx.params[0]));
    p.status = 'thrown';
    p.doneAt = isoNow(ctx.now);
    return { removed: true, wasted: pantryState(p, todayPk(ctx.now)) === 'expired' };
  });

  /** Used up (all of it, or some): used before it expired is "saved from waste". */
  route('POST', '/my-kitchen/pantry/:id/use', ctx => {
    const p = myItem(ctx, enc(ctx.params[0]));
    const today = todayPk(ctx.now);
    const all = ctx.body.qty === undefined || ctx.body.all === true;
    if (!all) {
      const unit = (ctx.body.unit ?? (p.unit === 'g' ? 'g' : p.unit === 'ml' ? 'ml' : 'pc')) as StandardUnit;
      if (!STANDARD_UNITS.includes(unit) || UNITS[unit].base !== p.unit || !isNum(ctx.body.qty) || ctx.body.qty <= 0) throw invalid('qty', 'How much did you use?');
      const used = Math.round(toBase(ctx.body.qty, unit));
      if (used < p.qty) {
        p.qty -= used;
        return { item: pantryWire(p, today), usedUp: false };
      }
    }
    p.status = 'used';
    p.doneAt = isoNow(ctx.now);
    p.savedFromWaste = pantryState(p, today) === 'use_soon';
    return { item: null, usedUp: true, savedFromWaste: p.savedFromWaste };
  });

  // From a Shopping order: its grocery lines (each pack's net quantity × how many).
  const groceryLinesOf = (ctx: ShopCtx, userId: string) =>
    ctx.db.shop.orders
      .filter(o => o.userId === userId && Date.parse(o.createdAt) >= ctx.now - 45 * 86_400_000 && !['cancelled'].includes(o.status))
      .map(o => ({
        o,
        lines: o.items
          .map(i => ({ i, p: ctx.db.shop.products.find(x => x.id === i.productId) }))
          .filter(x => x.p?.netQuantity && x.p.ingredientKey),
      }))
      .filter(x => x.lines.length);

  route('GET', '/my-kitchen/pantry/shopping-orders', ctx => {
    const u = me(ctx);
    const added = new Set(pantryAll(ctx).filter(p => p.userId === u.id && p.source === 'shopping').map(p => p.name));
    return {
      items: groceryLinesOf(ctx, u.id)
        .sort((a, b) => b.o.createdAt.localeCompare(a.o.createdAt))
        .map(({ o, lines }) => ({
          orderId: o.id,
          code: o.code,
          storeName: ctx.db.shop.stores.find(s => s.id === o.storeId)?.name ?? 'A store',
          placedAt: o.createdAt,
          status: o.status,
          lines: lines.map(({ i, p }) => ({ lineId: i.id, name: i.name, quantity: i.quantity, netQuantity: p!.netQuantity!, alreadyAdded: added.has(i.name) })),
        })),
    };
  });

  route('POST', '/my-kitchen/pantry/from-shopping-order', ctx => {
    const u = me(ctx);
    const found = groceryLinesOf(ctx, u.id).find(x => x.o.id === String(ctx.body.orderId ?? ''));
    if (!found) throw notFound('Order');
    const ids: string[] = Array.isArray(ctx.body.lineIds) ? ctx.body.lineIds.map(String) : [];
    const picked = ids.length ? found.lines.filter(l => ids.includes(l.i.id)) : found.lines;
    if (!picked.length) throw invalid('lineIds', 'Pick the things to add.');
    const today = todayPk(ctx.now);
    const added: MockPantryItem[] = picked.map(({ i, p }) => {
      const key = p!.ingredientKey!;
      const shelf = shelfDays(key);
      return {
        id: nextId(ctx.db, 'pn'),
        userId: u.id,
        name: i.name,
        key,
        qty: p!.netQuantity!.qty * i.quantity,
        unit: p!.netQuantity!.unit,
        expiresOn: shelf ? addDays(today, shelf) : null,
        addedAt: isoNow(ctx.now),
        source: 'shopping',
        status: 'in',
        doneAt: null,
        savedFromWaste: false,
      };
    });
    pantryAll(ctx).push(...added);
    ctx.setStatus(201);
    return { items: added.map(p => pantryWire(p, today)) };
  });

  // Reminders (the morning a thing is about to expire).
  const remindersOf = (ctx: ShopCtx) => (k(ctx.db).pantryReminders ?? []).find(r => r.userId === me(ctx).id) ?? { userId: me(ctx).id, enabled: true, time: '09:00', daysBefore: 1 };
  const remindersWire = (r: ReturnType<typeof remindersOf>) => ({ enabled: r.enabled, time: r.time, daysBefore: r.daysBefore });
  route('GET', '/my-kitchen/pantry/reminders', ctx => remindersWire(remindersOf(ctx)));
  route('PUT', '/my-kitchen/pantry/reminders', ctx => {
    const r = { ...remindersOf(ctx) };
    const b = ctx.body;
    if (b.enabled !== undefined) {
      if (typeof b.enabled !== 'boolean') throw invalid('enabled', 'enabled must be true or false');
      r.enabled = b.enabled;
    }
    if (b.time !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.time))) throw invalid('time', 'time is HH:MM');
      r.time = String(b.time);
    }
    if (b.daysBefore !== undefined) {
      if (!isInt(b.daysBefore) || b.daysBefore < 0 || b.daysBefore > 3) throw invalid('daysBefore', 'daysBefore is 0 to 3');
      r.daysBefore = b.daysBefore;
    }
    const all = k(ctx.db).pantryReminders ?? (k(ctx.db).pantryReminders = []);
    const at = all.findIndex(x => x.userId === r.userId);
    if (at >= 0) all[at] = r;
    else all.push(r);
    return remindersWire(r);
  });

  /** The month: used, saved from waste (used in its last days), thrown after it expired. */
  route('GET', '/my-kitchen/stats', ctx => {
    const u = me(ctx);
    const month = ctx.query.month ? String(ctx.query.month) : todayPk(ctx.now).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw invalid('month', 'month is YYYY-MM');
    const done = pantryAll(ctx).filter(p => p.userId === u.id && p.doneAt && dateInZone(p.doneAt, 'Asia/Karachi').startsWith(month));
    return {
      month,
      used: done.filter(p => p.status === 'used').length,
      savedFromWaste: done.filter(p => p.status === 'used' && p.savedFromWaste).length,
      wasted: done.filter(p => p.status === 'thrown' && p.expiresOn && p.expiresOn < dateInZone(p.doneAt!, 'Asia/Karachi')).length,
      inKitchen: pantryOf(ctx.db, u.id).length,
    };
  });

  // ── Recipes ──
  route('POST', '/my-kitchen/recipes/suggest', ctx => {
    const u = me(ctx);
    const b = ctx.body;
    const language = b.language === 'ur' ? 'ur' : b.language === 'en' || b.language === undefined ? 'en' : null;
    if (!language) throw invalid('language', 'language must be one of the following values: ur, en');
    if (b.maxMinutes !== undefined && b.maxMinutes !== null && (!isInt(b.maxMinutes) || b.maxMinutes < 5 || b.maxMinutes > 240)) throw invalid('maxMinutes', 'maxMinutes is 5 to 240');
    if (b.servings !== undefined && b.servings !== null && (!isInt(b.servings) || b.servings < 1 || b.servings > 20)) throw invalid('servings', 'servings is 1 to 20');
    aiGate(ctx.db, u.id, 'customer', 'recipe_suggestions', ctx.now);
    recordAiUse(ctx.db, u.id, 'recipe_suggestions', ctx.now);
    return { language, items: suggestRecipes(ctx.db, u.id, { language, maxMinutes: b.maxMinutes ?? null, servings: b.servings ?? null }, ctx.now) };
  });

  const recipeOf = (ctx: ShopCtx) => {
    const r = recipeById(enc(ctx.params[0]));
    if (!r) throw notFound('Recipe');
    return r;
  };
  const servingsOf = (ctx: ShopCtx) => {
    const s = ctx.query.servings ? Number(ctx.query.servings) : null;
    if (s !== null && (!Number.isInteger(s) || s < 1 || s > 20)) throw invalid('servings', 'servings is 1 to 20');
    return s;
  };

  route('GET', '/my-kitchen/recipes/:id/missing-items', ctx => ({ items: missingItems(ctx.db, me(ctx).id, recipeOf(ctx), servingsOf(ctx), ctx.now) }));

  route('GET', '/my-kitchen/recipes/:id', ctx => {
    const language = ctx.query.language === 'ur' ? 'ur' : 'en';
    return recipeWire(ctx.db, me(ctx).id, recipeOf(ctx), language, servingsOf(ctx), ctx.now);
  });

  // ── Nutrition: the person's own ──
  const settingsAll = (ctx: ShopCtx) => k(ctx.db).nutritionSettings ?? (k(ctx.db).nutritionSettings = []);
  route('GET', '/my-kitchen/nutrition/settings', ctx => nutritionSettingsWire(nutritionSettingsOf(ctx.db, me(ctx).id)));

  route('PUT', '/my-kitchen/nutrition/settings', ctx => {
    const u = me(ctx);
    const s: MockNutritionSettings = { ...nutritionSettingsOf(ctx.db, u.id) };
    const b = ctx.body;
    for (const f of ['enabled', 'showCalories'] as const) {
      if (b[f] === undefined) continue;
      if (typeof b[f] !== 'boolean') throw invalid(f, `${f} must be true or false`);
      s[f] = b[f];
    }
    if (b.goal !== undefined) {
      if (!GOALS.includes(b.goal)) throw invalid('goal', `goal must be one of the following values: ${GOALS.join(', ')}`);
      s.goal = b.goal;
    }
    if (b.metrics !== undefined) {
      if (b.metrics === null) s.metrics = null;
      else {
        const m = b.metrics;
        if (m.sex !== 'female' && m.sex !== 'male') throw invalid('metrics.sex', 'sex must be female or male');
        if (!isInt(m.age) || m.age < 14 || m.age > 100) throw invalid('metrics.age', 'Age 14 to 100');
        if (!isNum(m.heightCm) || m.heightCm < 120 || m.heightCm > 230) throw invalid('metrics.heightCm', 'Height 120 to 230 cm');
        if (!isNum(m.weightKg) || m.weightKg < 30 || m.weightKg > 250) throw invalid('metrics.weightKg', 'Weight 30 to 250 kg');
        if (!ACTIVITIES.includes(m.activity)) throw invalid('metrics.activity', `activity must be one of the following values: ${ACTIVITIES.join(', ')}`);
        s.metrics = { sex: m.sex, age: m.age, heightCm: Math.round(m.heightCm), weightKg: Math.round(m.weightKg * 10) / 10, activity: m.activity };
      }
    }
    if (b.manualTargetKcal !== undefined) {
      if (b.manualTargetKcal !== null && (!isInt(b.manualTargetKcal) || b.manualTargetKcal < 1000 || b.manualTargetKcal > 5000)) throw invalid('manualTargetKcal', 'A daily target of 1,000 to 5,000 kcal');
      s.manualTargetKcal = b.manualTargetKcal;
    }
    // Turned off: calories go too.
    if (!s.enabled) s.showCalories = false;
    s.updatedAt = isoNow(ctx.now);
    const all = settingsAll(ctx);
    const at = all.findIndex(x => x.userId === u.id);
    if (at >= 0) all[at] = s;
    else all.push(s);
    return nutritionSettingsWire(s);
  });

  /** Everything about the person's nutrition goes: settings and metrics (the summary is worked out, never stored). */
  route('DELETE', '/my-kitchen/nutrition', ctx => {
    const u = me(ctx);
    k(ctx.db).nutritionSettings = settingsAll(ctx).filter(x => x.userId !== u.id);
    return { deleted: true, settings: nutritionSettingsWire(nutritionSettingsOf(ctx.db, u.id)) };
  });

  route('GET', '/my-kitchen/nutrition/summary', ctx => {
    const u = me(ctx);
    const s = nutritionSettingsOf(ctx.db, u.id);
    if (!s.enabled) throw new KitchenError(409, 'NUTRITION_OFF', 'Turn on nutrition first.');
    const days = ctx.query.days ? Number(ctx.query.days) : 7;
    if (!Number.isInteger(days) || days < 1 || days > 30) throw invalid('days', 'days is 1 to 30');
    return { ...nutritionSummary(ctx.db, u.id, days, ctx.now), targetKcal: nutritionSettingsWire(s).targetKcal };
  });

  // ── Healthy picks (Food Court) ──
  route('GET', '/food/healthy-picks', ctx => {
    const lat = Number(ctx.query.lat);
    const lng = Number(ctx.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw invalid('lat', 'lat and lng are required');
    // Open kitchens nearby, and only dishes that can be ordered now.
    const near = ctx.db.food.vendors.filter(
      v => isVisible(ctx.db, v) && v.lat !== null && v.lng !== null && distanceKm({ lat, lng }, { lat: v.lat!, lng: v.lng! }) <= 10 && quote(v, 'delivery', { lat, lng }, ctx.now).open.open,
    );
    const items = near.flatMap(v =>
      ctx.db.food.items
        .filter(i => i.businessId === v.businessId && i.isActive && !i.isDeal && !unavailableReason(ctx.db, v, i, ctx.now))
        .map(i => ({ v, i, n: dishNutritionFor(ctx.db, v, i.id) }))
        // A pick is under 600 kcal, or high in protein at up to 800 kcal a person.
        .filter(x => {
          if (!x.n || !isMeal(x.i.name, x.n.kcal, x.i.serves)) return false;
          const tags = healthyTags(x.n, x.i.serves);
          return tags.includes('under_600') || (tags.includes('high_protein') && x.n.kcal / Math.max(1, x.i.serves ?? 1) <= PICK_MAX_KCAL);
        })
        .map(({ v, i, n }) => ({
          itemId: i.id,
          name: i.name,
          photoUrl: i.photoUrl,
          price: i.variants.length ? Math.min(...i.variants.map(x => x.price)) : i.basePrice,
          // Per person.
          kcal: Math.round(n!.kcal / Math.max(1, i.serves ?? 1)),
          protein: Math.round((n!.protein ?? 0) / Math.max(1, i.serves ?? 1)),
          serves: i.serves ?? 1,
          tags: healthyTags(n, i.serves),
          vendor: { id: v.brandId, slug: v.slug, name: v.name },
        })),
    );
    return { items: items.sort((a, b) => a.kcal - b.kcal).slice(0, 12) };
  });
}

/** Search's `?nutrition=under_600|high_protein`: dishes qualify, vendors with none drop. */
export const nutritionSearchFilter = (db: ShopCtx['db'], v: Parameters<typeof dishNutritionFor>[1], i: { id: string } | null, query: Record<string, unknown>) => {
  const want = query.nutrition;
  if (!want) return true;
  if (want !== 'under_600' && want !== 'high_protein') throw invalid('nutrition', 'nutrition must be one of the following values: under_600, high_protein');
  const ok = (id: string) => healthyTags(dishNutritionFor(db, v, id), db.food.items.find(x => x.id === id)?.serves ?? 1).includes(want as string);
  return i ? ok(i.id) : db.food.items.some(x => x.businessId === v.businessId && x.isActive && ok(x.id));
};

export { RECIPES };
