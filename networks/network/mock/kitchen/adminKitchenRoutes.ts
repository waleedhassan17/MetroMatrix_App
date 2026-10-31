// ═══════════════════════════════════════════════════════
// MetroMatrix dummy API — the staff console's Kitchen tools (/admin/kitchen)
// ═══════════════════════════════════════════════════════
// The assistant's use (by feature and by kitchen or customer) and limits;
// the city price list and nutrition foods, each imported from CSV after a
// dry run that names every bad row; the words voice understands (aliases);
// calendar events (Ramadan, Eid); signature dishes to keep or take the label
// off; the platform's demand map; a tiffin or catering code looked up for a
// dispute. The hygiene queue lives with hygiene (growthRoutes). Staff only.
// TODO(API_KITCHEN) §4.8.

import type { ShopCtx } from '../shop/shopRoutes';
import type { MockDb } from '../mockDb';
import { addDays, dateInZone } from '../../../../utils/healthTime';
import type { MockCalendarEvent, MockNutritionFood, MockSignatureReview } from './kitchenTypes';
import { DATE, DAY, KitchenError, invalid, isNum, isoNow, k, nextId, notFound, text } from './kitchenLogic';
import { AI_FEATURES, limitOf, usageWire } from './aiLogic';
import { CANON } from './kitchenSeed';
import { demandParts, normHours } from './growthLogic';
import { distanceKm } from '../food/foodDiscovery';
import { subWire } from './tiffinRoutes';
import { requestWire } from './cateringRoutes';
import type { KitchenKit } from './kitchenRoutes';

const TZ = 'Asia/Karachi';
const enc = (s: string) => decodeURIComponent(s);
const round2 = (x: number) => Math.round(x * 100) / 100;

// ── CSV ──
export const MAX_CSV_ROWS = 2000;
export const MAX_CSV_CHARS = 400_000;
/** What a dry run shows: the first rows and the first errors. */
const PREVIEW_ROWS = 50;

/** Rows of fields; quoted fields may hold commas, quotes ("") and line breaks. */
export const parseCsv = (src: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(f => f)) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field.trim());
  if (row.some(f => f)) rows.push(row);
  return rows;
};

type RowError = { row: number; field: string; message: string };

/** The CSV body → its header columns (lower case) and data rows, or a 422 naming what's wrong. */
const csvOf = (body: Record<string, unknown>, columns: string[]) => {
  const csv = typeof body.csv === 'string' ? body.csv.replace(/^﻿/, '') : '';
  if (!csv.trim()) throw invalid('csv', 'Add a CSV file or paste its text.');
  if (csv.length > MAX_CSV_CHARS) throw invalid('csv', `The file is too large (up to ${MAX_CSV_ROWS} rows).`);
  const [head, ...rows] = parseCsv(csv);
  const header = head.map(h => h.toLowerCase());
  const missing = columns.filter(c => !header.includes(c));
  if (missing.length) throw invalid('csv', `The first row should name the columns: ${columns.join(', ')}. Missing: ${missing.join(', ')}.`);
  if (!rows.length) throw invalid('csv', 'The file has a header but no rows.');
  if (rows.length > MAX_CSV_ROWS) throw invalid('csv', `Up to ${MAX_CSV_ROWS} rows at a time; this file has ${rows.length}.`);
  const at = Object.fromEntries(columns.map(c => [c, header.indexOf(c)]));
  return rows.map((r, n) => ({ row: n + 2, get: (c: string) => r[at[c]] ?? '' }));
};

const importResult = <T>(dryRun: boolean, rows: number, errors: RowError[], preview: T[], imported: number) => ({
  dryRun,
  rows,
  valid: rows - new Set(errors.map(e => e.row)).size,
  errors: errors.slice(0, PREVIEW_ROWS),
  preview: preview.slice(0, PREVIEW_ROWS),
  imported,
});

const refuseWithErrors = (errors: RowError[]) =>
  new KitchenError(422, 'CSV_HAS_ERRORS', `${new Set(errors.map(e => e.row)).size} rows have problems. Fix them and try again; nothing was imported.`, { errors: errors.slice(0, PREVIEW_ROWS) });

const isMonday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1;

// ── The city price list ──
/** A reference price shown per kg, litre or piece, by the ingredient's base unit. */
const unitOf = (key: string) => (CANON[key]?.base === 'ml' ? 'l' : CANON[key]?.base === 'pc' ? 'pc' : 'kg');
const toShown = (key: string, perBase: number) => round2(CANON[key]?.base === 'pc' ? perBase : perBase * 1000);
const toBase = (key: string, shown: number) => (CANON[key]?.base === 'pc' ? shown : shown / 1000);
const CITY = /^[A-Za-z][A-Za-z .'-]{1,39}$/;

// ── Nutrition foods ──
const PERS = ['g100', 'ml100', 'piece'] as const;
const FOOD_KEY = /^[a-z][a-z0-9_]{1,39}$/;
const nfWire = (db: MockDb, f: MockNutritionFood) => ({
  id: f.id,
  key: f.key,
  name: f.name,
  per: f.per,
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  usedBy: k(db).ingredients.filter(i => i.nutritionFoodId === f.id).length,
  updatedAt: f.updatedAt,
});

/** A nutrition food's numbers, checked (per 100 g or ml, or per piece). */
const foodNumbers = (get: (f: string) => unknown, partial: boolean) => {
  const out: Partial<Pick<MockNutritionFood, 'kcal' | 'protein' | 'carbs' | 'fat' | 'per' | 'name'>> = {};
  const errors: { field: string; message: string }[] = [];
  const num = (field: 'kcal' | 'protein' | 'carbs' | 'fat', max: number) => {
    const raw = get(field);
    if (raw === undefined && partial) return;
    const v = typeof raw === 'string' ? Number(raw) : raw;
    if (!isNum(v) || v < 0 || v > max) errors.push({ field, message: `${field} should be a number from 0 to ${max}` });
    else out[field] = round2(v);
  };
  const name = get('name');
  if (!(name === undefined && partial)) {
    const n = typeof name === 'string' ? name.trim() : '';
    if (n.length < 2 || n.length > 60) errors.push({ field: 'name', message: 'name should be 2 to 60 characters' });
    else out.name = n;
  }
  const per = get('per');
  if (!(per === undefined && partial)) {
    if (!PERS.includes(per as (typeof PERS)[number])) errors.push({ field: 'per', message: 'per should be g100, ml100 or piece' });
    else out.per = per as MockNutritionFood['per'];
  }
  num('kcal', 2000);
  num('protein', 200);
  num('carbs', 200);
  num('fat', 200);
  return { out, errors };
};

// ── Calendar events ──
const KINDS = ['ramadan', 'eid', 'other'] as const;
const MAX_EVENT_DAYS = 40;
const eventWire = (e: MockCalendarEvent, today: string) => ({
  id: e.id,
  kind: e.kind,
  name: e.name,
  startsOn: e.startsOn,
  endsOn: e.endsOn,
  days: Math.round((Date.parse(e.endsOn) - Date.parse(e.startsOn)) / DAY) + 1,
  state: today < e.startsOn ? 'upcoming' : today > e.endsOn ? 'past' : 'now',
});

// ── Signature dishes ──
const reviewsOf = (db: MockDb): MockSignatureReview[] => (k(db).signatureReviews ??= []);
const lastReview = (db: MockDb, itemId: string) => [...reviewsOf(db)].reverse().find(r => r.itemId === itemId) ?? null;
const signatureRow = (db: MockDb, itemId: string) => {
  const recipes = k(db).recipes.filter(r => r.itemId === itemId);
  const live = recipes.find(r => r.signature?.on);
  const item = db.food.items.find(i => i.id === itemId);
  const v = db.food.vendors.find(x => x.businessId === (live ?? recipes[0])?.businessId);
  const review = lastReview(db, itemId);
  const since = live ? recipes.filter(r => r.signature?.on).map(r => r.updatedAt).sort().slice(-1)[0] : null;
  const status = !live ? 'removed' : review?.status === 'approved' && since && review.at >= since ? 'approved' : 'new';
  return {
    itemId,
    name: item?.name ?? 'Dish',
    photoUrl: item?.photoUrl ?? null,
    vendor: v ? { id: v.brandId, name: v.name, slug: v.slug } : null,
    creatorName: live?.signature.creatorName ?? recipes.find(r => r.signature?.creatorName)?.signature.creatorName ?? null,
    status,
    note: review?.note ?? null,
    reviewedAt: review?.at ?? null,
  };
};

// ── Platform demand ──
export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Lahore: { lat: 31.5204, lng: 74.3587 },
  Karachi: { lat: 24.8607, lng: 67.0011 },
  Islamabad: { lat: 33.6844, lng: 73.0479 },
};
export const CITY_RADIUS_KM = 30;

export function registerAdminKitchenRoutes(kit: KitchenKit) {
  const { route, requireAdmin } = kit;
  const today = (ctx: ShopCtx) => dateInZone(isoNow(ctx.now), TZ);

  // ── The assistant's use ──
  route('GET', '/admin/kitchen/ai/usage', ctx => {
    requireAdmin(ctx);
    const to = DATE.test(String(ctx.query.to ?? '')) ? String(ctx.query.to) : today(ctx);
    const from = DATE.test(String(ctx.query.from ?? '')) ? String(ctx.query.from) : addDays(to, -29);
    if (from > to) throw invalid('from', 'from must be on or before to');
    if (Date.parse(to) - Date.parse(from) > 92 * DAY) throw invalid('from', 'Up to 93 days at a time');
    const uses = k(ctx.db).aiUses.filter(u => {
      const d = dateInZone(u.at, TZ);
      return d >= from && d <= to;
    });
    const sum = (xs: typeof uses) => ({
      actions: xs.length,
      failures: xs.filter(u => !u.ok).length,
      avgMs: xs.length ? Math.round(xs.reduce((n, u) => n + u.ms, 0) / xs.length) : 0,
    });
    const ms = uses.map(u => u.ms).sort((a, b) => a - b);
    const pct = (p: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : 0);
    const owners = [...new Set([...uses.map(u => u.ownerId), ...Object.keys(k(ctx.db).aiLimits)])];
    const ownerRow = (id: string) => {
      const v = ctx.db.food.vendors.find(x => x.businessId === id);
      const kind = v ? 'vendor' : 'customer';
      const mine = uses.filter(u => u.ownerId === id);
      const month = usageWire(ctx.db, id, kind, ctx.now);
      return {
        ownerId: id,
        kind: v ? 'kitchen' : 'customer',
        name: v?.name ?? ctx.db.users.find(u => u.id === id)?.name ?? id,
        ...sum(mine),
        usedThisMonth: month.used,
        limit: limitOf(ctx.db, id, kind),
        override: k(ctx.db).aiLimits[id] ?? null,
      };
    };
    const total = sum(uses);
    return {
      from,
      to,
      enabled: k(ctx.db).aiEnabled,
      totals: { ...total, failureRate: total.actions ? round2(total.failures / total.actions) : 0, p50Ms: pct(0.5), p95Ms: pct(0.95) },
      byFeature: AI_FEATURES.map(feature => ({ feature, ...sum(uses.filter(u => u.feature === feature)) })).filter(f => f.actions > 0),
      byOwner: owners.map(ownerRow).sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name)).slice(0, 50),
    };
  });

  // ── The city price list ──
  route('GET', '/admin/kitchen/reference-prices', ctx => {
    requireAdmin(ctx);
    const refs = k(ctx.db).priceRefs;
    const cities = [...new Set(refs.map(r => r.city))].sort();
    // Lahore (where Food Court started) unless another city is asked for.
    const city = cities.includes(String(ctx.query.city)) ? String(ctx.query.city) : cities.includes('Lahore') ? 'Lahore' : cities[0] ?? 'Lahore';
    const mine = refs.filter(r => r.city === city);
    const week = mine.map(r => r.week).sort().slice(-1)[0] ?? null;
    const q = text(ctx.query.q).toLowerCase();
    const before = week ? addDays(week, -28) : null;
    return {
      city,
      cities,
      week,
      items: mine
        .filter(r => r.week === week && (!q || r.name.toLowerCase().includes(q) || r.key.includes(q)))
        .map(r => {
          const old = mine.find(x => x.key === r.key && x.week === before);
          return {
            key: r.key,
            name: r.name,
            price: toShown(r.key, r.costPerBase),
            unit: unitOf(r.key),
            changePct: old && old.costPerBase ? Math.round(((r.costPerBase - old.costPerBase) / old.costPerBase) * 100) : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  route('POST', '/admin/kitchen/reference-prices', ctx => {
    requireAdmin(ctx);
    const dryRun = ctx.query.dryRun === 'true';
    const rows = csvOf(ctx.body, ['key', 'city', 'week', 'price']);
    const errors: RowError[] = [];
    const preview: { row: number; key: string; name: string; city: string; week: string; price: number; unit: string; previous: number | null }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.get('key').toLowerCase();
      const city = r.get('city');
      const week = r.get('week');
      const price = Number(r.get('price'));
      const bad = (field: string, message: string) => errors.push({ row: r.row, field, message });
      if (!CANON[key]) bad('key', `No ingredient "${r.get('key')}"`);
      if (!CITY.test(city)) bad('city', 'A city name, in letters');
      if (!DATE.test(week) || !isMonday(week)) bad('week', 'The Monday the week starts, as YYYY-MM-DD');
      if (!Number.isFinite(price) || price <= 0 || price > 100_000) bad('price', 'Rupees per kg, litre or piece (above 0)');
      const id = `${key}|${city}|${week}`;
      if (seen.has(id)) bad('key', 'The same ingredient, city and week twice');
      seen.add(id);
      if (!CANON[key]) continue;
      const old = k(ctx.db).priceRefs.find(x => x.key === key && x.city === city && x.week === week);
      preview.push({ row: r.row, key, name: CANON[key].name, city, week, price: Number.isFinite(price) ? round2(price) : 0, unit: unitOf(key), previous: old ? toShown(key, old.costPerBase) : null });
    }
    if (!dryRun && errors.length) throw refuseWithErrors(errors);
    if (!dryRun) {
      for (const p of preview) {
        const costPerBase = Math.round(toBase(p.key, p.price) * 10000) / 10000;
        const old = k(ctx.db).priceRefs.find(x => x.key === p.key && x.city === p.city && x.week === p.week);
        if (old) old.costPerBase = costPerBase;
        else k(ctx.db).priceRefs.push({ key: p.key, name: p.name, city: p.city, week: p.week, costPerBase });
      }
    }
    return importResult(dryRun, rows.length, errors, preview, dryRun ? 0 : preview.length);
  });

  // ── Nutrition foods ──
  route('GET', '/admin/kitchen/nutrition-foods', ctx => {
    requireAdmin(ctx);
    const q = text(ctx.query.q).toLowerCase();
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 30));
    const all = k(ctx.db)
      .nutritionFoods.filter(f => !q || f.name.toLowerCase().includes(q) || f.key.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { items: all.slice((page - 1) * pageSize, page * pageSize).map(f => nfWire(ctx.db, f)), total: all.length, page, pageSize };
  });

  route('POST', '/admin/kitchen/nutrition-foods', ctx => {
    requireAdmin(ctx);
    const key = text(ctx.body.key).toLowerCase();
    if (!FOOD_KEY.test(key)) throw invalid('key', 'key: lower-case letters, digits and _ (2 to 40)');
    if (k(ctx.db).nutritionFoods.some(f => f.key === key)) throw new KitchenError(409, 'NUTRITION_FOOD_EXISTS', 'There is already a food with that key.', { key });
    const { out, errors } = foodNumbers(f => ctx.body[f], false);
    if (errors.length) throw invalid(errors[0].field, errors[0].message);
    const f: MockNutritionFood = { id: nextId(ctx.db, 'nf'), key, ...(out as Required<typeof out>), updatedAt: isoNow(ctx.now) };
    k(ctx.db).nutritionFoods.push(f);
    return nfWire(ctx.db, f);
  });

  route('PATCH', '/admin/kitchen/nutrition-foods/:id', ctx => {
    requireAdmin(ctx);
    const f = k(ctx.db).nutritionFoods.find(x => x.id === enc(ctx.params[0]));
    if (!f) throw notFound('Nutrition food');
    const { out, errors } = foodNumbers(x => ctx.body[x], true);
    if (errors.length) throw invalid(errors[0].field, errors[0].message);
    Object.assign(f, out, { updatedAt: isoNow(ctx.now) });
    return nfWire(ctx.db, f);
  });

  route('POST', '/admin/kitchen/nutrition-foods/import', ctx => {
    requireAdmin(ctx);
    const dryRun = ctx.query.dryRun === 'true';
    const rows = csvOf(ctx.body, ['key', 'name', 'per', 'kcal', 'protein', 'carbs', 'fat']);
    const errors: RowError[] = [];
    const preview: { row: number; key: string; name: string; per: string; kcal: number; protein: number; carbs: number; fat: number; change: 'new' | 'update' | 'same' }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.get('key').toLowerCase();
      if (!FOOD_KEY.test(key)) errors.push({ row: r.row, field: 'key', message: 'Lower-case letters, digits and _' });
      if (seen.has(key)) errors.push({ row: r.row, field: 'key', message: 'The same key twice' });
      seen.add(key);
      const { out, errors: bad } = foodNumbers(f => r.get(f), false);
      errors.push(...bad.map(b => ({ row: r.row, ...b })));
      if (bad.length || !FOOD_KEY.test(key)) continue;
      const v = out as Required<typeof out>;
      const old = k(ctx.db).nutritionFoods.find(f => f.key === key);
      const same = old && old.name === v.name && old.per === v.per && old.kcal === v.kcal && old.protein === v.protein && old.carbs === v.carbs && old.fat === v.fat;
      preview.push({ row: r.row, key, ...v, change: !old ? 'new' : same ? 'same' : 'update' });
    }
    if (!dryRun && errors.length) throw refuseWithErrors(errors);
    if (!dryRun) {
      for (const p of preview) {
        if (p.change === 'same') continue;
        const old = k(ctx.db).nutritionFoods.find(f => f.key === p.key);
        const values = { name: p.name, per: p.per as MockNutritionFood['per'], kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, updatedAt: isoNow(ctx.now) };
        if (old) Object.assign(old, values);
        else k(ctx.db).nutritionFoods.push({ id: nextId(ctx.db, 'nf'), key: p.key, ...values });
      }
    }
    return importResult(dryRun, rows.length, errors, preview, dryRun ? 0 : preview.filter(p => p.change !== 'same').length);
  });

  // ── The words voice understands ──
  route('GET', '/admin/kitchen/ingredient-keys', ctx => {
    requireAdmin(ctx);
    const q = text(ctx.query.q).toLowerCase();
    return {
      items: Object.entries(CANON)
        .filter(([key, c]) => !q || key.includes(q) || c.name.toLowerCase().includes(q))
        .map(([key, c]) => ({ key, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 50),
    };
  });

  const aliasWire = (a: { id: string; word: string; language: string; key: string }) => ({ id: a.id, word: a.word, language: a.language, key: a.key, keyName: CANON[a.key]?.name ?? a.key });

  route('GET', '/admin/kitchen/aliases', ctx => {
    requireAdmin(ctx);
    const q = text(ctx.query.q).toLowerCase();
    const all = k(ctx.db)
      .aliases.filter(a => !q || a.word.toLowerCase().includes(q) || a.key.includes(q) || (CANON[a.key]?.name ?? '').toLowerCase().includes(q))
      .map(aliasWire)
      .sort((a, b) => a.keyName.localeCompare(b.keyName) || a.word.localeCompare(b.word));
    return { items: all.slice(0, 200), total: all.length };
  });

  route('POST', '/admin/kitchen/aliases', ctx => {
    requireAdmin(ctx);
    const language = ctx.body.language;
    if (!['ur', 'roman_ur', 'en'].includes(language as string)) throw invalid('language', 'language should be ur, roman_ur or en');
    const raw = text(ctx.body.word);
    const word = language === 'ur' ? raw : raw.toLowerCase();
    if (word.length < 1 || word.length > 40) throw invalid('word', 'word should be 1 to 40 characters');
    const key = text(ctx.body.key);
    if (!CANON[key]) throw invalid('key', 'Pick an ingredient from the list');
    const clash = k(ctx.db).aliases.find(a => a.word === word && a.language === language);
    if (clash) throw new KitchenError(409, 'ALIAS_EXISTS', `“${word}” already means ${CANON[clash.key]?.name ?? clash.key}.`, { key: clash.key });
    const a = { id: nextId(ctx.db, 'al'), word, language: language as 'ur' | 'roman_ur' | 'en', key };
    k(ctx.db).aliases.push(a);
    return aliasWire(a);
  });

  route('DELETE', '/admin/kitchen/aliases/:id', ctx => {
    requireAdmin(ctx);
    const i = k(ctx.db).aliases.findIndex(a => a.id === enc(ctx.params[0]));
    if (i < 0) throw notFound('Alias');
    k(ctx.db).aliases.splice(i, 1);
    return { deleted: true };
  });

  // ── Calendar events ──
  const eventBody = (b: Record<string, unknown>, e: Partial<MockCalendarEvent>, ctx: ShopCtx) => {
    const next = { ...e };
    if (b.kind !== undefined || !e.kind) {
      if (!KINDS.includes(b.kind as (typeof KINDS)[number])) throw invalid('kind', 'kind should be ramadan, eid or other');
      next.kind = b.kind as MockCalendarEvent['kind'];
    }
    if (b.name !== undefined || !e.name) {
      const name = text(b.name);
      if (name.length < 2 || name.length > 60) throw invalid('name', 'name should be 2 to 60 characters');
      next.name = name;
    }
    for (const f of ['startsOn', 'endsOn'] as const) {
      if (b[f] !== undefined || !e[f]) {
        if (typeof b[f] !== 'string' || !DATE.test(b[f] as string)) throw invalid(f, `${f} should be a date (YYYY-MM-DD)`);
        next[f] = b[f] as string;
      }
    }
    if (next.endsOn! < next.startsOn!) throw invalid('endsOn', 'The event ends on or after the day it starts');
    if ((Date.parse(next.endsOn!) - Date.parse(next.startsOn!)) / DAY + 1 > MAX_EVENT_DAYS) throw invalid('endsOn', `Up to ${MAX_EVENT_DAYS} days`);
    if (next.kind === 'ramadan') {
      const clash = k(ctx.db).calendarEvents.find(x => x.kind === 'ramadan' && x.id !== e.id && x.startsOn <= next.endsOn! && x.endsOn >= next.startsOn!);
      if (clash) throw new KitchenError(409, 'EVENT_OVERLAP', `It overlaps ${clash.name}.`, { id: clash.id });
    }
    return next as MockCalendarEvent;
  };

  route('GET', '/admin/kitchen/calendar-events', ctx => {
    requireAdmin(ctx);
    return { items: [...k(ctx.db).calendarEvents].sort((a, b) => a.startsOn.localeCompare(b.startsOn)).map(e => eventWire(e, today(ctx))) };
  });

  route('POST', '/admin/kitchen/calendar-events', ctx => {
    requireAdmin(ctx);
    const e = eventBody(ctx.body, { id: nextId(ctx.db, 'ev') }, ctx);
    k(ctx.db).calendarEvents.push(e);
    return eventWire(e, today(ctx));
  });

  route('PATCH', '/admin/kitchen/calendar-events/:id', ctx => {
    requireAdmin(ctx);
    const e = k(ctx.db).calendarEvents.find(x => x.id === enc(ctx.params[0]));
    if (!e) throw notFound('Event');
    Object.assign(e, eventBody(ctx.body, e, ctx));
    return eventWire(e, today(ctx));
  });

  route('DELETE', '/admin/kitchen/calendar-events/:id', ctx => {
    requireAdmin(ctx);
    const i = k(ctx.db).calendarEvents.findIndex(x => x.id === enc(ctx.params[0]));
    if (i < 0) throw notFound('Event');
    k(ctx.db).calendarEvents.splice(i, 1);
    return { deleted: true };
  });

  // ── Signature dishes ──
  route('GET', '/admin/kitchen/signatures', ctx => {
    requireAdmin(ctx);
    const status = ['new', 'approved', 'removed'].includes(String(ctx.query.status)) ? String(ctx.query.status) : 'new';
    const ids = [...new Set([...k(ctx.db).recipes.filter(r => r.signature?.on).map(r => r.itemId), ...reviewsOf(ctx.db).map(r => r.itemId)])];
    const rows = ids.map(id => signatureRow(ctx.db, id));
    return { items: rows.filter(r => r.status === status), counts: { new: rows.filter(r => r.status === 'new').length, approved: rows.filter(r => r.status === 'approved').length, removed: rows.filter(r => r.status === 'removed').length } };
  });

  const signatureOf = (ctx: ShopCtx) => {
    const itemId = enc(ctx.params[0]);
    const recipes = k(ctx.db).recipes.filter(r => r.itemId === itemId);
    if (!recipes.some(r => r.signature?.on)) throw notFound('Signature dish');
    return { itemId, recipes };
  };

  route('POST', '/admin/kitchen/signatures/:itemId/approve', ctx => {
    requireAdmin(ctx);
    const { itemId, recipes } = signatureOf(ctx);
    const note = text(ctx.body.note);
    if (note.length > 300) throw invalid('note', 'note: up to 300 characters');
    reviewsOf(ctx.db).push({ itemId, businessId: recipes[0].businessId, status: 'approved', note: note || null, at: isoNow(ctx.now) });
    return signatureRow(ctx.db, itemId);
  });

  route('POST', '/admin/kitchen/signatures/:itemId/remove', ctx => {
    requireAdmin(ctx);
    const { itemId, recipes } = signatureOf(ctx);
    const note = text(ctx.body.note);
    if (note.length < 3 || note.length > 300) throw invalid('note', 'Say why (3 to 300 characters); the kitchen sees it.');
    for (const r of recipes) r.signature = { ...r.signature, on: false };
    reviewsOf(ctx.db).push({ itemId, businessId: recipes[0].businessId, status: 'removed', note, at: isoNow(ctx.now) });
    return signatureRow(ctx.db, itemId);
  });

  // ── The platform's demand map (the same anonymity rule as a kitchen's) ──
  route('GET', '/admin/kitchen/demand', ctx => {
    requireAdmin(ctx);
    const city = CITY_CENTERS[String(ctx.query.city)] ? String(ctx.query.city) : 'Lahore';
    const center = CITY_CENTERS[city];
    const cuisine = ctx.query.cuisine ? String(ctx.query.cuisine) : null;
    const hour = ctx.query.hour === undefined || ctx.query.hour === '' ? null : Number(ctx.query.hour);
    if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) throw invalid('hour', 'hour must be 0 to 23');
    const since = ctx.now - 30 * DAY;
    const inCity = (k(ctx.db).searches ?? []).filter(s => Date.parse(s.at) >= since && distanceKm({ lat: s.lat, lng: s.lng }, center) <= CITY_RADIUS_KM && (!cuisine || s.cuisine === cuisine));
    const areaHours = Array(24).fill(0) as number[];
    for (const s of inCity) areaHours[s.hour] += 1;
    return {
      city,
      cities: Object.keys(CITY_CENTERS),
      center,
      radiusKm: CITY_RADIUS_KM,
      ...demandParts(inCity.filter(s => hour === null || s.hour === hour)),
      hourCurve: { area: normHours(areaHours) },
    };
  });

  // ── A tiffin or catering code, for a dispute ──
  route('GET', '/admin/kitchen/lookup', ctx => {
    requireAdmin(ctx);
    const code = text(ctx.query.code).toUpperCase();
    if (!/^(TF|CT)-[A-Z0-9]{4,10}$/.test(code)) throw invalid('code', 'A tiffin (TF-…) or catering (CT-…) code');
    if (code.startsWith('TF-')) {
      const s = k(ctx.db).tiffinSubs.find(x => x.code === code);
      if (!s) throw new KitchenError(404, 'NOT_FOUND', `No tiffin with the code ${code}.`);
      return { kind: 'tiffin', tiffin: subWire(ctx.db, s, 'vendor', ctx.now), catering: null };
    }
    const r = k(ctx.db).catering.find(x => x.code === code);
    if (!r) throw new KitchenError(404, 'NOT_FOUND', `No catering request with the code ${code}.`);
    return { kind: 'catering', tiffin: null, catering: requestWire(ctx.db, r, 'vendor', ctx.now) };
  });
}
