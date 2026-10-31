// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy kitchen routes (vendor operations, voice, assistant)
// ═══════════════════════════════════════════════════════
// /food/vendor/kitchen/* (stock, purchases, recipes, forecast, waste),
// the order board's packing photo and spoken announcement, the vendor's
// assistant (usage, receipt scan) and /ai/voice/interpret. Writes go
// through the Food route wrapper: all-or-nothing, jobs first.
// Mirrors docs/API_KITCHEN_ASSUMED.md §4.1–4.3, docs/AI_ASSUMED.md and
// docs/VOICE_ASSUMED.md.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import type { MockFoodOrder, MockFoodVendor } from '../food/foodTypes';
import { formatSlot } from '../../../../utils/health-time/healthTime';
import { addDays } from '../../../../utils/health-time/healthTime';
import { STANDARD_UNITS, UNITS, toBase, type BaseUnit, type StandardUnit } from '../../../../utils/units/units';
import type { MockIngredient, MockIngredientCategory, MockWasteReason } from './kitchenTypes';
import {
  DATE,
  KitchenError,
  LOW_SERVINGS,
  MAX_INGREDIENTS,
  addStock,
  costOf,
  costOfTaken,
  defaultVariantOf,
  ingredientsOf,
  invalid,
  isInt,
  isNum,
  isoNow,
  itemBlocked,
  itemServingsLeft,
  itemsOf,
  k,
  localHour,
  myIngredient,
  nextId,
  notFound,
  onHandOf,
  orderKitchenOf,
  perServing,
  recipeFor,
  recipeLines,
  settingsOf,
  stateOf,
  takeStock,
  text,
  todayOf,
  expiringOf,
} from './kitchenLogic';
import {
  donationWire,
  ingredientDetailWire,
  ingredientWire,
  kitchenSettingsWire,
  purchaseWire,
  recipeWire,
  recipesListWire,
  supplierWire,
  wasteWire,
} from './kitchenWire';
import { accuracy, forecastDay, prepSheet, shoppingList } from './forecastLogic';
import { cardsWire, mealsRescued, snoozeCard, summaryWire } from './insightCards';
import { aiGate, recordAiUse, usageWire } from './aiLogic';
import { checkPacking, scanReceipt } from './aiStandIns';
import { DEMO_PHRASES, VOICE_CONTEXTS, interpret, type VoiceContext, type VoiceWorld } from './voiceStandIn';
import { CANON } from './kitchenSeed';

export interface KitchenKit {
  route: ShopKit['route'];
  requireUser: ShopKit['requireUser'];
  optionalUser: ShopKit['optionalUser'];
  requireAdmin: ShopKit['requireAdmin'];
  myVendor: (ctx: ShopCtx) => MockFoodVendor;
}

const CATEGORIES: MockIngredientCategory[] = ['meat_poultry', 'vegetables', 'fruit', 'dairy', 'grains_flour', 'spices', 'oils_ghee', 'bakery', 'drinks', 'packaging', 'other'];
const BASES: BaseUnit[] = ['g', 'ml', 'pc'];
const WASTE_REASONS: MockWasteReason[] = ['expired', 'spoiled', 'burnt', 'dropped', 'leftover', 'other'];
const PACKING = ['off', 'optional', 'required'] as const;
const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;
/** A forecast or prep sheet is for today and the next seven days. */
const FORECAST_DAYS = 7;

const enc = (s: string) => decodeURIComponent(s);

const bodyIs = (v: unknown, keys: string[]) => !!v && typeof v === 'object' && keys.some(k_ => k_ in (v as object));

/** A quantity in a unit the ingredient can be counted in → base units. */
export const toBaseFor = (i: Pick<MockIngredient, 'baseUnit' | 'customUnits'>, qty: unknown, unit: unknown, field: string) => {
  if (!isNum(qty) || qty <= 0 || qty > 1_000_000) throw invalid(`${field}.qty`, 'qty must be a positive number');
  const u = String(unit ?? '');
  if ((STANDARD_UNITS as readonly string[]).includes(u)) {
    if (UNITS[u as StandardUnit].base !== i.baseUnit) throw invalid(`${field}.unit`, `This is counted in ${i.baseUnit === 'g' ? 'weight' : i.baseUnit === 'ml' ? 'volume' : 'pieces'}.`);
    return toBase(qty, u as StandardUnit);
  }
  const custom = i.customUnits.find(c => c.name.toLowerCase() === u.toLowerCase());
  if (custom) return toBase(qty, custom);
  if (!u) return Math.round(qty);
  throw invalid(`${field}.unit`, 'Pick a unit from the list.');
};

export function registerKitchenRoutes(kit: KitchenKit) {
  const { route, myVendor, requireUser } = kit;

  const window = (v: MockFoodVendor, raw: unknown, now: number, field = 'date') => {
    const today = todayOf(v, now);
    const date = raw === undefined || raw === '' ? addDays(today, 1) : String(raw);
    if (!DATE.test(date) || date < today || date > addDays(today, FORECAST_DAYS)) throw invalid(field, `Pick a day from today to ${FORECAST_DAYS} days ahead.`);
    return date;
  };

  const ingredientIn = (ctx: ShopCtx, v: MockFoodVendor, raw: Record<string, any>, existing?: MockIngredient) => {
    const out: Partial<MockIngredient> = {};
    if (!existing || raw.name !== undefined) {
      const name = text(raw.name);
      if (name.length < 2 || name.length > 60) throw invalid('name', 'name must be 2 to 60 characters');
      const clash = ingredientsOf(ctx.db, v.businessId).find(i => i.name.toLowerCase() === name.toLowerCase() && i.id !== existing?.id);
      if (clash) throw new KitchenError(409, 'INGREDIENT_EXISTS', `${clash.name} is already in your stock.`, { ingredientId: clash.id });
      out.name = name;
    }
    if (!existing || raw.category !== undefined) {
      if (!CATEGORIES.includes(raw.category)) throw invalid('category', `category must be one of ${CATEGORIES.join(', ')}`);
      out.category = raw.category;
    }
    if (!existing || raw.baseUnit !== undefined) {
      if (!BASES.includes(raw.baseUnit)) throw invalid('baseUnit', 'baseUnit must be g, ml or pc');
      if (existing && raw.baseUnit !== existing.baseUnit && (k(ctx.db).batches.some(b => b.ingredientId === existing.id) || existing.deficit)) {
        throw new KitchenError(409, 'BASE_UNIT_LOCKED', 'This ingredient already has stock in its unit. Add a new ingredient instead.');
      }
      out.baseUnit = raw.baseUnit;
    }
    if (raw.dozens !== undefined) out.dozens = raw.dozens === true;
    if (raw.customUnits !== undefined) {
      if (!Array.isArray(raw.customUnits) || raw.customUnits.length > 4) throw invalid('customUnits', 'customUnits: at most 4');
      out.customUnits = raw.customUnits.map((c: any, n: number) => {
        const name = text(c?.name);
        if (name.length < 1 || name.length > 20) throw invalid(`customUnits.${n}.name`, 'name must be 1 to 20 characters');
        if (!isInt(c?.base) || c.base < 1) throw invalid(`customUnits.${n}.base`, 'base must be a whole number of base units');
        return { name, base: c.base };
      });
    }
    if (raw.parLevel !== undefined) {
      if (raw.parLevel !== null && (!isInt(raw.parLevel) || raw.parLevel < 0)) throw invalid('parLevel', 'parLevel must be a whole number of base units, or null');
      out.parLevel = raw.parLevel;
    }
    if (raw.priceRefKey !== undefined) {
      if (raw.priceRefKey !== null && !CANON[String(raw.priceRefKey)]) throw invalid('priceRefKey', 'Pick a match from the list.');
      out.priceRefKey = raw.priceRefKey;
    }
    if (raw.nutritionFoodId !== undefined) {
      if (raw.nutritionFoodId !== null && !k(ctx.db).nutritionFoods.some(f => f.id === raw.nutritionFoodId)) throw invalid('nutritionFoodId', 'Pick a food from the list.');
      out.nutritionFoodId = raw.nutritionFoodId;
    }
    return out;
  };

  const newIngredient = (ctx: ShopCtx, v: MockFoodVendor, raw: Record<string, any>): MockIngredient => {
    const used = ingredientsOf(ctx.db, v.businessId).length;
    if (used >= MAX_INGREDIENTS) {
      throw new KitchenError(409, 'PLAN_LIMIT_REACHED', `Your Community plan allows ${MAX_INGREDIENTS} ingredients.`, { key: 'ingredients', limit: MAX_INGREDIENTS, used, planKey: 'community' });
    }
    const fields = ingredientIn(ctx, v, raw);
    // A known name (tomato, murghi) is matched to the canonical list for prices and nutrition.
    const word = String(fields.name).toLowerCase();
    const alias = k(ctx.db).aliases.find(a => a.word === word);
    const key = fields.priceRefKey ?? alias?.key ?? Object.keys(CANON).find(c => CANON[c].name.toLowerCase() === word) ?? null;
    const i: MockIngredient = {
      id: nextId(ctx.db, 'ing'),
      businessId: v.businessId,
      name: fields.name!,
      category: fields.category!,
      baseUnit: fields.baseUnit!,
      dozens: fields.dozens ?? false,
      customUnits: fields.customUnits ?? [],
      parLevel: fields.parLevel ?? null,
      priceRefKey: key,
      nutritionFoodId: fields.nutritionFoodId ?? (key && k(ctx.db).nutritionFoods.some(f => f.key === key) ? `nf_${key}` : null),
      deficit: 0,
      createdAt: isoNow(ctx.now),
      updatedAt: isoNow(ctx.now),
    };
    k(ctx.db).ingredients.push(i);
    return i;
  };

  // ── Settings, hub, insight cards, board hints ──
  route('GET', '/food/vendor/kitchen/settings', ctx => kitchenSettingsWire(settingsOf(ctx.db, myVendor(ctx).businessId)));

  route('PATCH', '/food/vendor/kitchen/settings', ctx => {
    const s = settingsOf(ctx.db, myVendor(ctx).businessId);
    const b = ctx.body;
    if (b.targetFoodCostPct !== undefined) {
      if (!isInt(b.targetFoodCostPct) || b.targetFoodCostPct < 10 || b.targetFoodCostPct > 80) throw invalid('targetFoodCostPct', 'targetFoodCostPct must be 10 to 80');
      s.targetFoodCostPct = b.targetFoodCostPct;
    }
    if (b.autoSellOut !== undefined) {
      if (typeof b.autoSellOut !== 'boolean') throw invalid('autoSellOut', 'autoSellOut must be true or false');
      s.autoSellOut = b.autoSellOut;
    }
    if (b.packingPhoto !== undefined) {
      if (!PACKING.includes(b.packingPhoto)) throw invalid('packingPhoto', 'packingPhoto must be off, optional or required');
      s.packingPhoto = b.packingPhoto;
    }
    return kitchenSettingsWire(s);
  });

  route('GET', '/food/vendor/kitchen/summary', ctx => summaryWire(ctx.db, myVendor(ctx).businessId, ctx.now));
  route('GET', '/food/vendor/kitchen/insights/cards', ctx => cardsWire(ctx.db, myVendor(ctx).businessId, ctx.now));
  route('POST', '/food/vendor/kitchen/insights/cards/:id/snooze', ctx => snoozeCard(ctx.db, myVendor(ctx).businessId, enc(ctx.params[0]), ctx.now));

  /** Usually ready in N minutes at this hour: accepted → ready over the last four weeks, else the kitchen's own prep time. */
  const prepHint = (db: MockDb, v: MockFoodVendor, now: number) => {
    const hour = localHour(v, now);
    const since = now - 28 * 24 * 60 * 60 * 1000;
    const samples = db.food.orders
      .filter(o => o.businessId === v.businessId && o.acceptedAt && o.readyAt && Date.parse(o.acceptedAt) >= since && localHour(v, Date.parse(o.acceptedAt)) === hour)
      .map(o => (Date.parse(o.readyAt!) - Date.parse(o.acceptedAt!)) / 60_000)
      .sort((a, b) => a - b);
    const rush = (hour >= 12 && hour < 15) || (hour >= 19 && hour < 23);
    const minutes = samples.length >= 5 ? Math.round(samples[Math.floor(samples.length / 2)]) : Math.round(v.prepMinutes * (rush ? 1.2 : 1));
    return { minutes, label: `Usually ready in ${minutes} min at this hour`, basis: samples.length >= 5 ? 'orders' : 'prep_time' };
  };

  route('GET', '/food/vendor/kitchen/board', ctx => {
    const v = myVendor(ctx);
    const items = itemsOf(ctx.db, v.businessId);
    const lowStock = items
      .map(i => ({ i, left: itemServingsLeft(ctx.db, i) }))
      .filter(x => x.left !== null && x.left >= 1 && x.left < LOW_SERVINGS)
      .map(x => ({ itemId: x.i.id, name: x.i.name, servingsLeft: x.left! }));
    const soldOutByStock = items.filter(i => itemBlocked(ctx.db, v, i)).map(i => ({ itemId: i.id, name: i.name }));
    return { lowStock, soldOutByStock, prepHint: prepHint(ctx.db, v, ctx.now), packingPhoto: settingsOf(ctx.db, v.businessId).packingPhoto };
  });

  // ── Stock ──
  route('GET', '/food/vendor/kitchen/stock', ctx => {
    const v = myVendor(ctx);
    const today = todayOf(v, ctx.now);
    const all = ingredientsOf(ctx.db, v.businessId);
    const segment = String(ctx.query.segment ?? 'all');
    if (!['all', 'low', 'expiring', 'negative'].includes(segment)) throw invalid('segment', 'segment must be all, low, expiring or negative');
    const q = text(ctx.query.q).toLowerCase();
    const is = {
      all: () => true,
      low: (i: MockIngredient) => ['low', 'out'].includes(stateOf(ctx.db, i)),
      expiring: (i: MockIngredient) => !!expiringOf(ctx.db, i, today),
      negative: (i: MockIngredient) => stateOf(ctx.db, i) === 'negative',
    } as Record<string, (i: MockIngredient) => boolean>;
    const items = all
      .filter(is[segment])
      .filter(i => !q || i.name.toLowerCase().includes(q) || k(ctx.db).aliases.some(a => a.key === i.priceRefKey && a.word.includes(q)))
      .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name))
      .map(i => ingredientWire(ctx.db, i, today));
    return {
      items,
      counts: { all: all.length, low: all.filter(is.low).length, expiring: all.filter(is.expiring).length, negative: all.filter(is.negative).length },
    };
  });

  route('POST', '/food/vendor/kitchen/ingredients', ctx => {
    const v = myVendor(ctx);
    const i = newIngredient(ctx, v, ctx.body);
    ctx.setStatus(201);
    return ingredientDetailWire(ctx.db, i, todayOf(v, ctx.now));
  });

  route('GET', '/food/vendor/kitchen/ingredients/:id', ctx => {
    const v = myVendor(ctx);
    return ingredientDetailWire(ctx.db, myIngredient(ctx.db, v.businessId, enc(ctx.params[0])), todayOf(v, ctx.now));
  });

  route('PATCH', '/food/vendor/kitchen/ingredients/:id', ctx => {
    const v = myVendor(ctx);
    const i = myIngredient(ctx.db, v.businessId, enc(ctx.params[0]));
    Object.assign(i, ingredientIn(ctx, v, ctx.body, i), { updatedAt: isoNow(ctx.now) });
    return ingredientDetailWire(ctx.db, i, todayOf(v, ctx.now));
  });

  route('DELETE', '/food/vendor/kitchen/ingredients/:id', ctx => {
    const v = myVendor(ctx);
    const i = myIngredient(ctx.db, v.businessId, enc(ctx.params[0]));
    const used = k(ctx.db).recipes.filter(r => r.businessId === v.businessId && [...r.lines, ...r.packaging, ...r.addOns.flatMap(a => a.lines)].some(l => l.ingredientId === i.id));
    if (used.length) {
      const names = [...new Set(used.map(r => ctx.db.food.items.find(x => x.id === r.itemId)?.name ?? r.itemId))];
      throw new KitchenError(409, 'INGREDIENT_IN_USE', `Take it out of ${names.slice(0, 3).join(', ')} first.`, { items: names });
    }
    const kk = k(ctx.db);
    kk.ingredients = kk.ingredients.filter(x => x.id !== i.id);
    kk.batches = kk.batches.filter(b => b.ingredientId !== i.id);
    kk.movements = kk.movements.filter(m => m.ingredientId !== i.id);
    return { deleted: true };
  });

  route('POST', '/food/vendor/kitchen/stock-takes', ctx => {
    const v = myVendor(ctx);
    const lines = ctx.body.lines;
    if (!Array.isArray(lines) || !lines.length || lines.length > 200) throw invalid('lines', 'lines: 1 to 200 counts');
    const seen = new Set<string>();
    const out = lines.map((l: any, n: number) => {
      const i = myIngredient(ctx.db, v.businessId, String(l?.ingredientId));
      if (seen.has(i.id)) throw invalid(`lines.${n}.ingredientId`, 'Each ingredient once.');
      seen.add(i.id);
      if (!isInt(l.counted) || l.counted < 0) throw invalid(`lines.${n}.counted`, 'counted must be a whole number of base units, 0 or more');
      const before = onHandOf(ctx.db, i);
      const change = l.counted - before;
      const note = text(ctx.body.note) || 'Stock count';
      if (change > 0) {
        // Found more than recorded: back into stock at what it cost on average.
        addStock(ctx.db, i, change, costOf(ctx.db, i), ctx.now, { kind: 'count', note });
      } else if (change < 0) takeStock(ctx.db, i, -change, ctx.now, 'count', { note });
      return { ingredientId: i.id, name: i.name, baseUnit: i.baseUnit, dozens: i.dozens, before, counted: l.counted, change };
    });
    ctx.setStatus(201);
    return { id: nextId(ctx.db, 'st'), at: isoNow(ctx.now), lines: out, adjusted: out.filter(l => l.change !== 0).length };
  });

  // ── Suppliers ──
  route('GET', '/food/vendor/kitchen/suppliers', ctx => {
    const v = myVendor(ctx);
    return k(ctx.db).suppliers.filter(s => s.businessId === v.businessId).sort((a, b) => a.name.localeCompare(b.name)).map(s => supplierWire(ctx.db, s));
  });

  const supplierIn = (raw: Record<string, any>, partial: boolean) => {
    const out: Record<string, string | null> = {};
    if (!partial || raw.name !== undefined) {
      const name = text(raw.name);
      if (name.length < 2 || name.length > 80) throw invalid('name', 'name must be 2 to 80 characters');
      out.name = name;
    }
    if (raw.phone !== undefined) out.phone = raw.phone === null ? null : text(raw.phone).slice(0, 20) || null;
    if (raw.note !== undefined) out.note = raw.note === null ? null : text(raw.note).slice(0, 200) || null;
    return out;
  };

  route('POST', '/food/vendor/kitchen/suppliers', ctx => {
    const v = myVendor(ctx);
    const f = supplierIn(ctx.body, false);
    const s = { id: nextId(ctx.db, 'sp'), businessId: v.businessId, name: f.name!, phone: f.phone ?? null, note: f.note ?? null, createdAt: isoNow(ctx.now) };
    k(ctx.db).suppliers.push(s);
    ctx.setStatus(201);
    return supplierWire(ctx.db, s);
  });

  const mySupplier = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const s = k(ctx.db).suppliers.find(x => x.id === id && x.businessId === v.businessId);
    if (!s) throw notFound('Supplier');
    return s;
  };

  route('PATCH', '/food/vendor/kitchen/suppliers/:id', ctx => {
    const v = myVendor(ctx);
    const s = mySupplier(ctx, v, enc(ctx.params[0]));
    Object.assign(s, supplierIn(ctx.body, true));
    return supplierWire(ctx.db, s);
  });

  route('DELETE', '/food/vendor/kitchen/suppliers/:id', ctx => {
    const v = myVendor(ctx);
    const s = mySupplier(ctx, v, enc(ctx.params[0]));
    // Past purchases keep the name they were bought under.
    k(ctx.db).suppliers = k(ctx.db).suppliers.filter(x => x.id !== s.id);
    for (const p of k(ctx.db).purchases) if (p.supplierId === s.id) p.supplierId = null;
    return { deleted: true };
  });

  // ── Purchases ──
  route('GET', '/food/vendor/kitchen/purchases', ctx => {
    const v = myVendor(ctx);
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 20));
    const all = k(ctx.db).purchases.filter(p => p.businessId === v.businessId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const weekAgo = addDays(todayOf(v, ctx.now), -6);
    return {
      items: all.slice((page - 1) * pageSize, page * pageSize).map(p => purchaseWire(ctx.db, p)),
      total: all.length,
      page,
      pageSize,
      weekTotal: all.filter(p => p.date >= weekAgo).reduce((n, p) => n + p.total, 0),
    };
  });

  route('GET', '/food/vendor/kitchen/purchases/:id', ctx => {
    const v = myVendor(ctx);
    const p = k(ctx.db).purchases.find(x => x.id === enc(ctx.params[0]) && x.businessId === v.businessId);
    if (!p) throw notFound('Purchase');
    return purchaseWire(ctx.db, p);
  });

  route('POST', '/food/vendor/kitchen/purchases', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    const today = todayOf(v, ctx.now);
    const date = b.date === undefined ? today : String(b.date);
    if (!DATE.test(date) || date > today || date < addDays(today, -60)) throw invalid('date', 'date must be within the last 60 days');
    const source = b.source ?? 'manual';
    if (!['manual', 'receipt', 'voice'].includes(source)) throw invalid('source', 'source must be manual, receipt or voice');
    if (b.receiptUrl !== undefined && b.receiptUrl !== null && !IMAGE_URL.test(String(b.receiptUrl))) throw invalid('receiptUrl', 'Upload the receipt first.');
    let supplierId: string | null = null;
    if (b.supplierId) supplierId = mySupplier(ctx, v, String(b.supplierId)).id;
    else if (text(b.supplierName)) {
      const name = text(b.supplierName).slice(0, 80);
      const existing = k(ctx.db).suppliers.find(s => s.businessId === v.businessId && s.name.toLowerCase() === name.toLowerCase());
      if (existing) supplierId = existing.id;
      else {
        const s = { id: nextId(ctx.db, 'sp'), businessId: v.businessId, name, phone: null, note: null, createdAt: isoNow(ctx.now) };
        k(ctx.db).suppliers.push(s);
        supplierId = s.id;
      }
    }
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 40) throw invalid('lines', 'lines: 1 to 40 items');
    const purchaseId = nextId(ctx.db, 'pu');
    const lines = b.lines.map((l: any, n: number) => {
      const field = `lines.${n}`;
      let i: MockIngredient;
      if (l?.ingredientId) i = myIngredient(ctx.db, v.businessId, String(l.ingredientId));
      else if (bodyIs(l?.newIngredient, ['name'])) {
        const name = text(l.newIngredient.name).toLowerCase();
        i = ingredientsOf(ctx.db, v.businessId).find(x => x.name.toLowerCase() === name) ?? newIngredient(ctx, v, l.newIngredient);
      } else throw invalid(`${field}.ingredientId`, 'Pick an ingredient, or add it as a new one.');
      const qty = toBaseFor(i, l.qty, l.unit, field);
      if (!isInt(l.total) || l.total < 0 || l.total > 10_000_000) throw invalid(`${field}.total`, 'total must be whole rupees');
      if (l.expiresOn !== undefined && l.expiresOn !== null && (!DATE.test(String(l.expiresOn)) || String(l.expiresOn) < date)) throw invalid(`${field}.expiresOn`, 'expiresOn must be on or after the purchase date');
      const batch = addStock(ctx.db, i, qty, qty ? l.total / qty : 0, ctx.now, { expiresOn: l.expiresOn ?? null, purchaseId })!;
      return { id: nextId(ctx.db, 'pl'), ingredientId: i.id, qty, total: l.total, expiresOn: l.expiresOn ?? null, batchId: batch.id };
    });
    const p = { id: purchaseId, businessId: v.businessId, date, supplierId, source, receiptUrl: b.receiptUrl ?? null, lines, total: lines.reduce((n: number, l: { total: number }) => n + l.total, 0), createdAt: isoNow(ctx.now) };
    k(ctx.db).purchases.push(p);
    ctx.setStatus(201);
    return purchaseWire(ctx.db, p);
  });

  route('GET', '/food/vendor/kitchen/price-watch', ctx => {
    const v = myVendor(ctx);
    const city = v.city ?? 'Lahore';
    const refs = k(ctx.db).priceRefs.filter(r => r.city === city);
    const latestWeek = refs.map(r => r.week).sort().pop() ?? null;
    const items = ingredientsOf(ctx.db, v.businessId)
      .map(i => {
        const series = refs.filter(r => r.key === i.priceRefKey).sort((a, b) => a.week.localeCompare(b.week));
        const city_ = series.find(r => r.week === latestWeek);
        const yours = k(ctx.db).batches.filter(b => b.ingredientId === i.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]?.costPerBase ?? 0;
        if (!city_ || !yours) return null;
        const diffPct = Math.round(((yours - city_.costPerBase) / city_.costPerBase) * 100);
        return {
          ingredientId: i.id,
          name: i.name,
          baseUnit: i.baseUnit,
          yourCostPerBase: Math.round(yours * 10000) / 10000,
          cityCostPerBase: city_.costPerBase,
          diffPct,
          trend: series.map(r => ({ week: r.week, costPerBase: r.costPerBase })),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.diffPct >= 10)
      .sort((a, b) => b.diffPct - a.diffPct);
    return { city, week: latestWeek, items };
  });

  // ── Recipes and costs ──
  const myItem = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const i = ctx.db.food.items.find(x => x.id === id && x.businessId === v.businessId);
    if (!i) throw notFound('Dish');
    return i;
  };

  const variantParam = (item: { variants: { id: string }[] }, raw: unknown) => {
    if (raw === undefined || raw === '' || raw === 'null') return null;
    const id = String(raw);
    if (!item.variants.some(x => x.id === id)) throw invalid('variantId', 'That size is not on this dish.');
    return id;
  };

  route('GET', '/food/vendor/kitchen/recipes', ctx => {
    const v = myVendor(ctx);
    const items = itemsOf(ctx.db, v.businessId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    return recipesListWire(ctx.db, v.businessId, items, ctx.query.needs === 'recipe');
  });

  route('GET', '/food/vendor/kitchen/recipes/:itemId', ctx => {
    const v = myVendor(ctx);
    const item = myItem(ctx, v, enc(ctx.params[0]));
    const variantId = ctx.query.variantId !== undefined ? variantParam(item, ctx.query.variantId) : (defaultVariantOf(item)?.id ?? null);
    return recipeWire(ctx.db, item, variantId);
  });

  route('PUT', '/food/vendor/kitchen/recipes/:itemId', ctx => {
    const v = myVendor(ctx);
    const item = myItem(ctx, v, enc(ctx.params[0]));
    const variantId = variantParam(item, ctx.query.variantId);
    const b = ctx.body;
    const yieldN = b.yield ?? 1;
    if (!isInt(yieldN) || yieldN < 1 || yieldN > 500) throw invalid('yield', 'yield must be 1 to 500 servings');
    const lines = recipeLines(ctx.db, v.businessId, b.lines, 'lines');
    if (!lines.length) throw invalid('lines', 'Add at least one ingredient.');
    const packaging = recipeLines(ctx.db, v.businessId, b.packaging, 'packaging');
    const optionIds = new Set(item.links.flatMap(l => ctx.db.food.groups.find(g => g.id === l.groupId)?.options.map(o => o.id) ?? []));
    const addOns = (Array.isArray(b.addOns) ? b.addOns : []).map((a: any, n: number) => {
      if (!optionIds.has(String(a?.optionId))) throw invalid(`addOns.${n}.optionId`, 'That add-on is not on this dish.');
      return { optionId: String(a.optionId), lines: recipeLines(ctx.db, v.businessId, a.lines, `addOns.${n}.lines`) };
    });
    const sig = b.signature ?? { on: false, creatorName: null };
    if (sig.on === true && (text(sig.creatorName).length < 2 || text(sig.creatorName).length > 60)) throw invalid('signature.creatorName', 'Name who created the recipe (2 to 60 characters).');
    const all = k(ctx.db).recipes;
    const at = all.findIndex(r => r.businessId === v.businessId && r.itemId === item.id && r.variantId === variantId);
    const recipe = {
      businessId: v.businessId,
      itemId: item.id,
      variantId,
      yield: yieldN,
      lines,
      addOns,
      packaging,
      signature: { on: sig.on === true, creatorName: sig.on === true ? text(sig.creatorName) : null },
      updatedAt: isoNow(ctx.now),
    };
    if (at >= 0) all[at] = recipe;
    else all.push(recipe);
    return recipeWire(ctx.db, item, variantId);
  });

  route('DELETE', '/food/vendor/kitchen/recipes/:itemId', ctx => {
    const v = myVendor(ctx);
    const item = myItem(ctx, v, enc(ctx.params[0]));
    const variantId = variantParam(item, ctx.query.variantId);
    k(ctx.db).recipes = k(ctx.db).recipes.filter(r => !(r.businessId === v.businessId && r.itemId === item.id && r.variantId === variantId));
    return recipeWire(ctx.db, item, variantId);
  });

  // ── Forecast and prep ──
  const forecastWire = (db: MockDb, v: MockFoodVendor, date: string, now: number) => {
    const day = forecastDay(db, v.businessId, date, now);
    return {
      date,
      learning: day.learning,
      basisDays: day.basisDays,
      dishes: day.totals.dishes,
      orders: day.totals.orders,
      items: day.rows
        .sort((a, b) => b.f.expected - a.f.expected || a.item.name.localeCompare(b.item.name))
        .map(r => ({ itemId: r.item.id, name: r.item.name, photoUrl: r.item.photoUrl, expected: r.f.expected, low: r.f.low, high: r.f.high, learning: r.f.learning, adjusted: r.adjusted, fixed: r.fixed, planned: day.planned(r) })),
    };
  };
  route('GET', '/food/vendor/kitchen/forecast', ctx => {
    const v = myVendor(ctx);
    return forecastWire(ctx.db, v, window(v, ctx.query.date, ctx.now), ctx.now);
  });

  route('PUT', '/food/vendor/kitchen/forecast/:date/items/:itemId', ctx => {
    const v = myVendor(ctx);
    const date = window(v, enc(ctx.params[0]), ctx.now);
    const item = myItem(ctx, v, enc(ctx.params[1]));
    const adjusted = ctx.body.adjusted;
    if (adjusted !== null && (!isInt(adjusted) || adjusted < 0 || adjusted > 9999)) throw invalid('adjusted', 'adjusted must be a whole number of dishes, or null');
    const all = k(ctx.db).adjustments;
    const at = all.findIndex(a => a.businessId === v.businessId && a.date === date && a.itemId === item.id);
    if (adjusted === null) {
      if (at >= 0) all.splice(at, 1);
    } else if (at >= 0) all[at].adjusted = adjusted;
    else all.push({ businessId: v.businessId, date, itemId: item.id, adjusted });
    const day = forecastWire(ctx.db, v, date, ctx.now);
    const row = day.items.find(r => r.itemId === item.id);
    if (!row) throw new KitchenError(409, 'NOT_COOKED_THAT_DAY', `${item.name} isn’t on the menu that day.`);
    return row;
  });

  route('GET', '/food/vendor/kitchen/forecast/accuracy', ctx => {
    const v = myVendor(ctx);
    const pct = accuracy(ctx.db, v.businessId, ctx.now, 7);
    return {
      days: 7,
      accuracyPct: pct,
      learning: pct === null,
      method: 'wmape',
      note: pct === null ? 'We need about three weeks of orders before we can measure this.' : `Over the last 7 days, expected dishes were ${pct}% close to what sold.`,
    };
  });

  route('GET', '/food/vendor/kitchen/prep-sheet', ctx => {
    const v = myVendor(ctx);
    const date = window(v, ctx.query.date, ctx.now);
    const sheet = prepSheet(ctx.db, v.businessId, date, ctx.now);
    return { ...sheet, groups: sheet.groups.map(g => ({ ...g, lines: g.lines.map(({ label: _label, ...l }) => l) })) };
  });

  route('GET', '/food/vendor/kitchen/shopping-list', ctx => {
    const v = myVendor(ctx);
    const date = window(v, ctx.query.date, ctx.now);
    const list = shoppingList(ctx.db, v.businessId, date, ctx.now);
    return { ...list, lines: list.lines.map(({ label: _label, ...l }) => l) };
  });

  // ── Waste and donations ──
  route('POST', '/food/vendor/kitchen/waste', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 30) throw invalid('lines', 'lines: 1 to 30 items');
    const lines = b.lines.map((l: any, n: number) => {
      const field = `lines.${n}`;
      if (!WASTE_REASONS.includes(l?.reason)) throw invalid(`${field}.reason`, `reason must be one of ${WASTE_REASONS.join(', ')}`);
      if (l.ingredientId) {
        const i = myIngredient(ctx.db, v.businessId, String(l.ingredientId));
        const qty = toBaseFor(i, l.qty, l.unit, field);
        const taken = takeStock(ctx.db, i, qty, ctx.now, 'waste', { note: `Waste: ${l.reason}` });
        return { ingredientId: i.id, itemId: null, name: i.name, qty, baseUnit: i.baseUnit, cost: Math.round(costOfTaken(taken)), reason: l.reason };
      }
      if (l.itemId) {
        const item = myItem(ctx, v, String(l.itemId));
        if (!isInt(l.qty) || l.qty < 1 || l.qty > 500) throw invalid(`${field}.qty`, 'qty must be a whole number of servings');
        // A cooked dish that went to waste: its recipe comes out of stock.
        const r = recipeFor(ctx.db, v.businessId, item.id, defaultVariantOf(item)?.id ?? null);
        let cost = 0;
        for (const s of r ? perServing(r) : []) {
          const i = k(ctx.db).ingredients.find(x => x.id === s.ingredientId);
          if (i) cost += costOfTaken(takeStock(ctx.db, i, Math.round(s.qty * l.qty), ctx.now, 'waste', { note: `Waste: ${item.name}` }));
        }
        return { ingredientId: null, itemId: item.id, name: item.name, qty: l.qty, baseUnit: null, cost: Math.round(cost), reason: l.reason };
      }
      throw invalid(`${field}.ingredientId`, 'Pick an ingredient or a dish.');
    });
    const w = { id: nextId(ctx.db, 'ws'), businessId: v.businessId, at: isoNow(ctx.now), lines, cost: lines.reduce((n: number, l: { cost: number }) => n + l.cost, 0), note: text(b.note).slice(0, 200) || null };
    k(ctx.db).waste.push(w);
    ctx.setStatus(201);
    return wasteWire(w);
  });

  route('GET', '/food/vendor/kitchen/waste', ctx => {
    const v = myVendor(ctx);
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 20));
    const all = k(ctx.db).waste.filter(w => w.businessId === v.businessId).sort((a, b) => b.at.localeCompare(a.at));
    return { items: all.slice((page - 1) * pageSize, page * pageSize).map(wasteWire), total: all.length, page, pageSize };
  });

  route('GET', '/food/vendor/kitchen/waste/summary', ctx => {
    const v = myVendor(ctx);
    const range = String(ctx.query.range ?? '7d');
    if (range !== '7d' && range !== '30d') throw invalid('range', 'range must be 7d or 30d');
    const to = todayOf(v, ctx.now);
    const from = addDays(to, range === '7d' ? -6 : -29);
    const mine = k(ctx.db).waste.filter(w => w.businessId === v.businessId && w.at.slice(0, 10) >= from);
    const byReason = new Map<string, number>();
    const byItem = new Map<string, { name: string; cost: number }>();
    for (const w of mine)
      for (const l of w.lines) {
        byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + l.cost);
        const key = l.ingredientId ?? l.itemId ?? l.name;
        const e = byItem.get(key) ?? { name: l.name, cost: 0 };
        e.cost += l.cost;
        byItem.set(key, e);
      }
    return {
      range,
      from,
      to,
      cost: mine.reduce((n, w) => n + w.cost, 0),
      entries: mine.length,
      topReasons: [...byReason].map(([reason, cost]) => ({ reason, cost })).sort((a, b) => b.cost - a.cost),
      topItems: [...byItem.values()].sort((a, b) => b.cost - a.cost).slice(0, 5),
      mealsRescued: { total: mealsRescued(ctx.db, v.businessId), inRange: mealsRescued(ctx.db, v.businessId, from) },
    };
  });

  route('GET', '/food/vendor/kitchen/donations', ctx => {
    const v = myVendor(ctx);
    const weekAgo = addDays(todayOf(v, ctx.now), -6);
    return {
      items: k(ctx.db).donations.filter(d => d.businessId === v.businessId).sort((a, b) => b.at.localeCompare(a.at)).map(donationWire),
      mealsRescued: { total: mealsRescued(ctx.db, v.businessId), week: mealsRescued(ctx.db, v.businessId, weekAgo) },
    };
  });

  route('POST', '/food/vendor/kitchen/donations', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    if (!isInt(b.meals) || b.meals < 1 || b.meals > 1000) throw invalid('meals', 'meals must be 1 to 1000');
    const to = text(b.to);
    if (to.length < 2 || to.length > 80) throw invalid('to', 'to must be 2 to 80 characters');
    const d = { id: nextId(ctx.db, 'dn'), businessId: v.businessId, at: isoNow(ctx.now), meals: b.meals, to, note: text(b.note).slice(0, 200) || null };
    k(ctx.db).donations.push(d);
    ctx.setStatus(201);
    return donationWire(d);
  });

  // ── The board: packing photo, spoken announcement ──
  const myOrder = (ctx: ShopCtx, v: MockFoodVendor, id: string): MockFoodOrder => {
    const o = ctx.db.food.orders.find(x => (x.id === id || x.code === id) && x.businessId === v.businessId);
    if (!o) throw notFound('Order');
    return o;
  };

  route('POST', '/food/vendor/orders/:id/packing-photo', ctx => {
    const v = myVendor(ctx);
    const o = myOrder(ctx, v, enc(ctx.params[0]));
    if (!['accepted', 'preparing', 'ready'].includes(o.status)) throw new KitchenError(409, 'INVALID_TRANSITION', 'Packing photos are taken before the order leaves.', { status: o.status });
    const url = String(ctx.body.imageUrl ?? '');
    if (!IMAGE_URL.test(url)) throw invalid('imageUrl', 'Upload the photo first.');
    const row = orderKitchenOf(ctx.db, o.id);
    row.packedPhotoUrl = url;
    row.packingCheck = null;
    // The assistant's look is advice only: off, or out of actions, it is simply left out.
    try {
      aiGate(ctx.db, v.businessId, 'vendor', 'packing_check', ctx.now);
      row.packingCheck = checkPacking(url);
      recordAiUse(ctx.db, v.businessId, 'packing_check', ctx.now);
    } catch {
      row.packingCheck = null;
    }
    o.updatedAt = isoNow(ctx.now);
    return { orderId: o.id, packedPhotoUrl: row.packedPhotoUrl, check: row.packingCheck };
  });

  route('GET', '/food/vendor/orders/:id/announcement', ctx => {
    const v = myVendor(ctx);
    const o = myOrder(ctx, v, enc(ctx.params[0]));
    const language = String(ctx.query.language ?? '');
    if (language !== 'ur' && language !== 'en') throw invalid('language', 'language must be ur or en');
    const items = o.items.map(i => `${i.quantity} ${i.name}`);
    const when = o.scheduledFor ? formatSlot(o.scheduledFor, v.timezone) : null;
    // The code letter by letter, without its dash (a voice would say "dash").
    const text_ =
      language === 'en'
        ? `New order, ${o.code.replace(/-/g, '').split('').join(' ')}. ${items.join(', ')}. ${o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}${when ? ` at ${when}` : ''}.`
        : `نیا آرڈر، ${o.code}۔ ${items.join('، ')}۔ ${o.fulfilment === 'delivery' ? 'ڈیلیوری' : 'پک اپ'}${when ? `، ${when}` : ''}۔`;
    // TODO(API_VOICE): the API's recorded clip for phones without an Urdu voice.
    return { orderId: o.id, text: text_, language, ttsUrl: null };
  });

  // ── The vendor's assistant ──
  route('GET', '/food/vendor/ai/usage', ctx => usageWire(ctx.db, myVendor(ctx).businessId, 'vendor', ctx.now));

  route('POST', '/food/vendor/ai/receipt-scan', ctx => {
    const v = myVendor(ctx);
    const url = String(ctx.body.imageUrl ?? '');
    if (!IMAGE_URL.test(url)) throw invalid('imageUrl', 'Upload the receipt photo first.');
    aiGate(ctx.db, v.businessId, 'vendor', 'receipt_scan', ctx.now);
    recordAiUse(ctx.db, v.businessId, 'receipt_scan', ctx.now);
    return { ...scanReceipt(ctx.db, v.businessId, url), date: todayOf(v, ctx.now), imageUrl: url };
  });

  // ── Voice ──
  const VENDOR_CONTEXTS: VoiceContext[] = ['board', 'stock', 'purchases', 'today'];
  const names = Object.fromEntries(Object.entries(CANON).map(([key, c]) => [key, c.name]));

  const worldFor = (ctx: ShopCtx, user: MockUser, context: VoiceContext): { owner: string; world: VoiceWorld } => {
    const aliases = k(ctx.db).aliases.map(a => ({ word: a.word, key: a.key }));
    if (VENDOR_CONTEXTS.includes(context)) {
      const v = myVendor(ctx);
      return {
        owner: v.businessId,
        world: {
          today: todayOf(v, ctx.now),
          ingredients: ingredientsOf(ctx.db, v.businessId).map(i => ({ id: i.id, name: i.name, key: i.priceRefKey })),
          aliases,
          names,
          items: itemsOf(ctx.db, v.businessId).map(i => ({ id: i.id, name: i.name })),
          orders: ctx.db.food.orders
            .filter(o => o.businessId === v.businessId && ['placed', 'accepted', 'preparing'].includes(o.status))
            .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
            .map(o => ({ id: o.id, code: o.code, status: o.status, placedAt: o.placedAt })),
        },
      };
    }
    if (user.role !== 'customer') throw new KitchenError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return {
      owner: user.id,
      world: {
        today: todayOf({ timezone: 'Asia/Karachi' }, ctx.now),
        ingredients: Object.entries(CANON).map(([key, c]) => ({ id: key, name: c.name, key })),
        aliases,
        names,
        items: [],
        orders: [],
      },
    };
  };

  route('POST', '/ai/voice/interpret', ctx => {
    const user = requireUser(ctx);
    const b = ctx.body;
    const context = b.context as VoiceContext;
    if (!VOICE_CONTEXTS.includes(context)) throw invalid('context', `context must be one of ${VOICE_CONTEXTS.join(', ')}`);
    const language = b.language ?? 'auto';
    if (!['ur', 'en', 'auto'].includes(language)) throw invalid('language', 'language must be ur, en or auto');
    const typed = text(b.text);
    const audio = typeof b.audioUrl === 'string' && b.audioUrl ? String(b.audioUrl) : null;
    if (!typed && !audio) throw invalid('audioUrl', 'Send the recording (audioUrl) or the words (text).');
    if (typed.length > 300) throw invalid('text', 'text must be at most 300 characters');
    if (b.durationMs !== undefined && (!isNum(b.durationMs) || b.durationMs > 30_500)) throw new KitchenError(413, 'CLIP_TOO_LONG', 'Keep it under 30 seconds.', { maxMs: 30_000 });
    const { owner, world } = worldFor(ctx, user, context);
    aiGate(ctx.db, owner, VENDOR_CONTEXTS.includes(context) ? 'vendor' : 'customer', 'voice', ctx.now);
    let said = typed;
    if (!said) {
      // The dummy API can't hear: a recording stands for the context's next sample phrase.
      const key = `${owner}:${context}`;
      const n = k(ctx.db).voiceCursor[key] ?? 0;
      k(ctx.db).voiceCursor[key] = n + 1;
      const phrases = DEMO_PHRASES[context];
      said = phrases[n % phrases.length];
    }
    const r = interpret(said, context, world);
    recordAiUse(ctx.db, owner, 'voice', ctx.now);
    return { id: nextId(ctx.db, 'vc'), ...r, heard: typed ? 'text' : 'audio' };
  });

  // ── Staff: the assistant's switch and quotas (the console is Admin/Kitchen) ──
  route('PATCH', '/admin/kitchen/ai/settings', ctx => {
    kit.requireAdmin(ctx);
    if (typeof ctx.body.enabled !== 'boolean') throw invalid('enabled', 'enabled must be true or false');
    k(ctx.db).aiEnabled = ctx.body.enabled;
    return { enabled: k(ctx.db).aiEnabled };
  });

  route('PUT', '/admin/kitchen/ai/quotas/:ownerId', ctx => {
    kit.requireAdmin(ctx);
    const owner = enc(ctx.params[0]);
    const limit = ctx.body.limit;
    if (limit !== null && (!isInt(limit) || limit < 0 || limit > 100_000)) throw invalid('limit', 'limit must be a whole number, or null for the plan’s');
    if (limit === null) delete k(ctx.db).aiLimits[owner];
    else k(ctx.db).aiLimits[owner] = limit;
    return { ownerId: owner, limit: k(ctx.db).aiLimits[owner] ?? null };
  });
}
