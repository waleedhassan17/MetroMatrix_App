// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy growth rules (5B): Ramadan, demand, menu insights,
// experiments, story and hygiene, badges, batching, the storefront
// ═══════════════════════════════════════════════════════
// Demand is anonymous: searches are kept only as a ~1 km cell (geohash 6),
// the hour, the cuisine and whether an open kitchen matched, and a cell
// with fewer than 10 searches is never sent. Menu insights place each dish
// by how much it sells against what it earns. An experiment changes one
// thing (a price or the photo) for 3–14 days and compares orders a day
// with the same days before. The demo kitchens keep selling as the clock
// moves (their seeded history goes on), so experiments and forecasts have
// something to read. Mirrors docs/API_KITCHEN_ASSUMED.md §2.11–2.14, §3.11.

import type { MockDb } from '../mockDb';
import type { MockFoodOrder, MockFoodVendor } from '../food/foodTypes';
import { distanceKm } from '../food/foodDiscovery';
import { addDays, dateInZone, hourOfDay } from '../../../../utils/health-time/healthTime';
import type { MockExperiment, MockHygiene, MockRamadanSettings, MockSearchLog } from './kitchenTypes';
import { defaultVariantOf, isoNow, itemsOf, k, recipeCost, recipeFor, todayOf, vendorOf } from './kitchenLogic';
import { HYGIENE_KEYS, KITCHENS, WEEKDAY_FACTOR } from './kitchenSeed';

const DAY = 86_400_000;

// ── Geohash (precision 6: about 1.2 × 0.6 km) ──
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const geohash = (lat: number, lng: number, precision = 6) => {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let even = true;
  let bit = 0;
  let ch = 0;
  let out = '';
  while (out.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) {
      ch |= 1 << (4 - bit);
      r[0] = mid;
    } else r[1] = mid;
    if (even) lngR = r;
    else latR = r;
    even = !even;
    if (bit < 4) bit++;
    else {
      out += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return out;
};

export const geohashBounds = (hash: string) => {
  const lat = [-90, 90];
  const lng = [-180, 180];
  let even = true;
  for (const c of hash) {
    const n = BASE32.indexOf(c);
    for (let b = 4; b >= 0; b--) {
      const r = even ? lng : lat;
      const mid = (r[0] + r[1]) / 2;
      if ((n >> b) & 1) r[0] = mid;
      else r[1] = mid;
      even = !even;
    }
  }
  const round = (x: number) => Math.round(x * 1e5) / 1e5;
  return { sw: { lat: round(lat[0]), lng: round(lng[0]) }, ne: { lat: round(lat[1]), lng: round(lng[1]) } };
};

// ── Ramadan ──
/** Ramadan mode opens this many days before the first fast. */
export const RAMADAN_LEAD_DAYS = 30;

export const ramadanState = (db: MockDb, today: string) => {
  const events = (k(db).calendarEvents ?? []).filter(e => e.kind === 'ramadan' && e.endsOn >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const e = events[0] ?? null;
  if (!e) return { event: null, state: 'none' as const, opensOn: null };
  const opensOn = addDays(e.startsOn, -RAMADAN_LEAD_DAYS);
  const state = today >= e.startsOn ? ('active' as const) : today >= opensOn ? ('upcoming' as const) : ('none' as const);
  return { event: e, state, opensOn };
};

export const ramadanSettingsOf = (db: MockDb, businessId: string): MockRamadanSettings => {
  const all = k(db).ramadan ?? (k(db).ramadan = []);
  let r = all.find(x => x.businessId === businessId);
  if (!r) {
    r = { businessId, enabled: false, sehriFrom: '02:30', sehriTo: '04:30', iftarFrom: '17:30', iftarTo: '19:00', iftarPreorderOnly: true };
    all.push(r);
  }
  return r;
};

// ── Demand ──
export const MIN_CELL_SEARCHES = 10;
export const DEMAND_RADIUS_KM = 8;

/** Cells and the most-missed searches over some searches (cells under MIN_CELL_SEARCHES are never sent). */
export const demandParts = (picked: MockSearchLog[]) => {
  const cells = new Map<string, { searches: number; unmet: number }>();
  for (const s of picked) {
    const h = geohash(s.lat, s.lng);
    const c = cells.get(h) ?? { searches: 0, unmet: 0 };
    c.searches += 1;
    if (!s.foundOpen) c.unmet += 1;
    cells.set(h, c);
  }
  const queries = new Map<string, { searches: number; unmet: number; hours: number[] }>();
  for (const s of picked) {
    const x = queries.get(s.text) ?? { searches: 0, unmet: 0, hours: Array(24).fill(0) };
    x.searches += 1;
    if (!s.foundOpen) {
      x.unmet += 1;
      x.hours[s.hour] += 1;
    }
    queries.set(s.text, x);
  }
  return {
    minCount: MIN_CELL_SEARCHES,
    total: picked.length,
    hidden: [...cells.values()].filter(c => c.searches < MIN_CELL_SEARCHES).reduce((n, c) => n + c.searches, 0),
    cells: [...cells]
      .filter(([, c]) => c.searches >= MIN_CELL_SEARCHES)
      .sort((a, b) => b[1].searches - a[1].searches)
      .map(([hash, c]) => ({ geohash: hash, ...geohashBounds(hash), searches: c.searches, unmetShare: Math.round((c.unmet / c.searches) * 100) / 100 })),
    topUnmet: [...queries]
      .filter(([, x]) => x.searches >= MIN_CELL_SEARCHES && x.unmet > 0)
      .sort((a, b) => b[1].unmet - a[1].unmet)
      .slice(0, 5)
      .map(([query, x]) => ({ query, searches: x.searches, unmetShare: Math.round((x.unmet / x.searches) * 100) / 100, hour: x.hours.indexOf(Math.max(...x.hours)) })),
  };
};

/** Each hour's share of the busiest hour (0 to 1). */
export const normHours = (xs: number[]) => {
  const max = Math.max(...xs);
  return xs.map(x => (max ? Math.round((x / max) * 100) / 100 : 0));
};

export const demandWire = (db: MockDb, v: MockFoodVendor, q: { cuisine: string | null; hour: number | null }, now: number) => {
  const since = now - 30 * DAY;
  const near = (k(db).searches ?? []).filter(s => Date.parse(s.at) >= since && v.lat !== null && v.lng !== null && distanceKm({ lat: s.lat, lng: s.lng }, { lat: v.lat, lng: v.lng }) <= DEMAND_RADIUS_KM);
  const picked = near.filter(s => (!q.cuisine || s.cuisine === q.cuisine) && (q.hour === null || s.hour === q.hour));
  const { minCount, total, hidden, cells, topUnmet } = demandParts(picked);
  const areaHours = Array(24).fill(0) as number[];
  for (const s of near.filter(s => !q.cuisine || s.cuisine === q.cuisine)) areaHours[s.hour] += 1;
  const ownHours = Array(24).fill(0) as number[];
  for (const o of db.food.orders.filter(o => o.businessId === v.businessId && Date.parse(o.placedAt) >= since)) ownHours[Math.floor(hourOfDay(o.placedAt, v.timezone))] += 1;
  return {
    city: v.city,
    center: v.lat !== null && v.lng !== null ? { lat: v.lat, lng: v.lng } : null,
    radiusKm: DEMAND_RADIUS_KM,
    minCount,
    total,
    hidden,
    cells,
    topUnmet,
    hourCurve: { area: normHours(areaHours), own: normHours(ownHours) },
  };
};

// ── Menu insights ──
export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Servings sold in the 30 days to yesterday. */
export const soldIn = (db: MockDb, businessId: string, itemId: string, from: string, to: string) =>
  k(db).sales.filter(s => s.businessId === businessId && s.itemId === itemId && s.date >= from && s.date <= to).reduce((n, s) => n + s.qty, 0);

export const menuInsightsWire = (db: MockDb, v: MockFoodVendor, now: number) => {
  const today = todayOf(v, now);
  const from = addDays(today, -30);
  const to = addDays(today, -1);
  const rows = itemsOf(db, v.businessId).map(i => {
    const r = recipeFor(db, v.businessId, i.id, defaultVariantOf(i)?.id ?? null);
    const cost = r ? recipeCost(db, r, i) : null;
    const recorded = soldIn(db, v.businessId, i.id, from, to);
    return { i, sold: recorded || i.sold30d, keep: cost ? cost.keep : null, keepPct: cost ? cost.keepPct : null };
  });
  const maxSold = Math.max(1, ...rows.map(r => r.sold));
  const known = rows.filter(r => r.keep !== null);
  const maxKeep = Math.max(1, ...known.map(r => r.keep!));
  const soldMid = median(rows.map(r => r.sold));
  const keepMid = median(known.map(r => r.keep!));
  const running = new Set((k(db).experiments ?? []).filter(e => e.businessId === v.businessId && e.status === 'running').map(e => e.itemId));
  return {
    range: '30d',
    medians: { sold: soldMid, keep: keepMid },
    items: rows
      .sort((a, b) => b.sold - a.sold)
      .map(r => {
        const popular = r.sold >= soldMid;
        const earns = r.keep !== null && r.keep >= keepMid;
        const quadrant: Quadrant = r.keep === null ? 'unknown' : popular ? (earns ? 'star' : 'plowhorse') : earns ? 'puzzle' : 'dog';
        const price = r.i.variants.length ? null : r.i.basePrice;
        const up = price ? Math.round((price * 1.1) / 10) * 10 : null;
        const suggestion =
          quadrant === 'star'
            ? { kind: 'keep', text: 'Sells well and earns well. Keep it where people see it first.', price: null }
            : quadrant === 'plowhorse'
              ? { kind: 'price', text: up ? `Popular but earns little. Try Rs ${String(up).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} for a week and see if orders hold.` : 'Popular but earns little. Look at its recipe card for savings.', price: up }
              : quadrant === 'puzzle'
                ? { kind: 'photo', text: 'Earns well but few order it. A better photo or a spot higher on the menu may help.', price: null }
                : quadrant === 'dog'
                  ? { kind: 'drop', text: 'Few order it and it earns little. Consider taking it off the menu.', price: null }
                  : { kind: 'recipe', text: 'Add its recipe card to see what it earns.', price: null };
        return {
          itemId: r.i.id,
          name: r.i.name,
          photoUrl: r.i.photoUrl,
          price: r.i.basePrice,
          hasSizes: r.i.variants.length > 0,
          sold: r.sold,
          keep: r.keep,
          keepPct: r.keepPct,
          popularity: Math.round((r.sold / maxSold) * 100) / 100,
          profit: r.keep === null ? null : Math.round((Math.max(0, r.keep) / maxKeep) * 100) / 100,
          quadrant,
          suggestion,
          experimentRunning: running.has(r.i.id),
        };
      }),
  };
};

// ── Experiments ──
/** Orders a day for an item over `days` days ending the day before `end` (exclusive). */
const perDay = (db: MockDb, businessId: string, itemId: string, start: string, days: number) => {
  const to = addDays(start, days - 1);
  return Math.round((soldIn(db, businessId, itemId, start, to) / days) * 10) / 10;
};

export const experimentWire = (db: MockDb, e: MockExperiment, now: number) => {
  const v = vendorOf(db, e.businessId);
  const item = db.food.items.find(i => i.id === e.itemId);
  const start = dateInZone(e.startedAt, v.timezone);
  const today = todayOf(v, now);
  const daysIn = Math.max(0, Math.min(e.days, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY)));
  const before = perDay(db, e.businessId, e.itemId, addDays(start, -e.days), e.days);
  const during = daysIn ? perDay(db, e.businessId, e.itemId, start, daysIn) : null;
  const priceBefore = e.change.kind === 'price' ? e.change.oldPrice : (item?.basePrice ?? 0);
  const priceDuring = e.change.kind === 'price' ? e.change.price : (item?.basePrice ?? 0);
  const ended = e.status !== 'running';
  let verdict: 'keep' | 'adjust' | 'drop' | null = null;
  if (ended && during !== null) {
    const rb = before * priceBefore;
    const rd = during * priceDuring;
    if (e.change.kind === 'price') verdict = rd >= rb * 1.03 ? 'keep' : rd >= rb * 0.97 ? 'adjust' : 'drop';
    else verdict = during >= before * 1.05 ? 'keep' : during >= before * 0.95 ? 'adjust' : 'drop';
  }
  return {
    id: e.id,
    itemId: e.itemId,
    itemName: item?.name ?? 'A dish',
    change: e.change.kind === 'price' ? { kind: 'price', price: e.change.price, oldPrice: e.change.oldPrice } : { kind: 'photo', photoUrl: e.change.photoUrl, oldPhotoUrl: e.change.oldPhotoUrl },
    days: e.days,
    startedAt: e.startedAt,
    endsAt: e.endsAt,
    status: e.status,
    progress: { daysIn, days: e.days },
    result:
      during === null
        ? null
        : {
            verdict,
            before: { perDay: before, salesPerDay: Math.round(before * priceBefore) },
            during: { perDay: during, salesPerDay: Math.round(during * priceDuring) },
          },
    decidedAt: e.decidedAt,
  };
};

/** The minute job: an experiment past its end is done (its change stays until the kitchen decides). */
export const settleExperiments = (db: MockDb, now: number) => {
  for (const e of k(db).experiments ?? []) if (e.status === 'running' && Date.parse(e.endsAt) <= now) e.status = 'done';
};

/** How a running experiment moves a day's sales in the dummy (price elasticity −1.3; a better photo +12%). */
const experimentFactor = (db: MockDb, businessId: string, itemId: string, date: string, tz: string) => {
  const e = (k(db).experiments ?? []).find(x => x.businessId === businessId && x.itemId === itemId && dateInZone(x.startedAt, tz) <= date && date < dateInZone(x.endsAt, tz));
  if (!e) return 1;
  return e.change.kind === 'price' ? Math.pow(e.change.oldPrice / Math.max(1, e.change.price), 1.3) : 1.12;
};

/** A steady 0.75–1.25 from the dish and the day (the same every time). */
const noiseOf = (key: string) => {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 0.75 + ((h >>> 0) % 1000) / 2000;
};

/** The demo kitchens keep selling: their everyday sales are filled in to yesterday as the clock moves. */
export const continueSales = (db: MockDb, now: number) => {
  const through = k(db).salesThrough ?? (k(db).salesThrough = {});
  for (const kitchen of KITCHENS) {
    const v = db.food.vendors.find(x => x.businessId === kitchen.businessId);
    if (!v) continue;
    const yesterday = addDays(todayOf(v, now), -1);
    let d = through[kitchen.businessId] ?? yesterday;
    if (d >= yesterday) continue;
    for (d = addDays(d, 1); d <= yesterday; d = addDays(d, 1)) {
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      for (const i of itemsOf(db, kitchen.businessId).filter(x => x.sold30d > 0 && x.days.includes(weekday))) {
        const share = i.days.length < 7 ? 7 / i.days.length : 1;
        const qty = Math.round((i.sold30d / 30) * share * WEEKDAY_FACTOR[weekday] * noiseOf(`${i.id}|${d}`) * experimentFactor(db, kitchen.businessId, i.id, d, v.timezone));
        if (qty > 0) k(db).sales.push({ businessId: kitchen.businessId, itemId: i.id, date: d, qty });
      }
    }
    through[kitchen.businessId] = yesterday;
  }
};

// ── Story and hygiene ──
export const HYGIENE_LABEL: Record<string, string> = {
  clean_kitchen: 'Kitchen and counters cleaned every day',
  water: 'Filtered or boiled water for cooking',
  storage: 'Raw and cooked food kept apart; fridge under 5°C',
  hands: 'A hand-washing place with soap',
  pests: 'No pests; bins covered',
  medical: 'Cooks have a medical certificate',
};

export const hygieneOf = (db: MockDb, businessId: string): MockHygiene => {
  const all = k(db).hygiene ?? (k(db).hygiene = []);
  let h = all.find(x => x.businessId === businessId);
  if (!h) {
    h = { businessId, status: 'none', note: null, items: HYGIENE_KEYS.map(key => ({ key, done: false, evidenceUrl: null })), requestedAt: null, reviewedAt: null };
    all.push(h);
  }
  return h;
};

export const hygieneWire = (h: MockHygiene) => ({
  status: h.status,
  note: h.note,
  items: h.items.map(i => ({ key: i.key, label: HYGIENE_LABEL[i.key] ?? i.key, done: i.done, evidenceUrl: i.evidenceUrl })),
  requestedAt: h.requestedAt,
  reviewedAt: h.reviewedAt,
  canRequest: h.items.every(i => i.done) && (h.status === 'self_declared' || h.status === 'rejected'),
});

/** Dishes marked as signature recipes. */
export const signatureItemIds = (db: MockDb, businessId: string) => [...new Set(k(db).recipes.filter(r => r.businessId === businessId && r.signature?.on).map(r => r.itemId))];

// ── Badges (on vendor cards) ──
export const badgesOf = (db: MockDb, v: MockFoodVendor, now: number): string[] => {
  const out: string[] = [];
  const h = (k(db).hygiene ?? []).find(x => x.businessId === v.businessId);
  if (h?.status === 'verified') out.push('hygiene_verified');
  else if (h && (h.status === 'self_declared' || h.status === 'pending')) out.push('hygiene_self_declared');
  if (signatureItemIds(db, v.businessId).length) out.push('signature');
  if (v.kind === 'home_kitchen') out.push('home_kitchen');
  const today = todayOf(v, now);
  if ((k(db).boxes ?? []).some(b => b.businessId === v.businessId && b.status === 'live' && dateInZone(b.pickupTo, v.timezone) >= today && Date.parse(b.pickupTo) > now)) out.push('bachat_today');
  return out;
};

// ── Batching ──
const dropOf = (o: MockFoodOrder) => {
  const a = o.address as { lat?: number | null; lng?: number | null } | null;
  return a && typeof a.lat === 'number' && typeof a.lng === 'number' ? { lat: a.lat, lng: a.lng } : null;
};

const bearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;

/** Other deliveries going the same way, a short way from this one's drop (no rider yet, or the same one before pickup). */
export const batchSuggestions = (db: MockDb, o: MockFoodOrder) => {
  const v = vendorOf(db, o.businessId);
  const here = dropOf(o);
  if (!here || v.lat === null || v.lng === null || o.fulfilment !== 'delivery') return [];
  const kitchen = { lat: v.lat, lng: v.lng };
  return db.food.orders
    .filter(x => x.id !== o.id && x.businessId === o.businessId && x.fulfilment === 'delivery' && ['accepted', 'preparing', 'ready'].includes(x.status) && !x.handedToExternal && (!x.riderId || x.riderId === o.riderId))
    .map(x => ({ x, drop: dropOf(x) }))
    .filter((r): r is { x: MockFoodOrder; drop: { lat: number; lng: number } } => !!r.drop)
    .map(r => {
      const diff = Math.abs(((bearing(kitchen, here) - bearing(kitchen, r.drop) + 540) % 360) - 180);
      return { orderId: r.x.id, code: r.x.code, extraKm: Math.round(distanceKm(here, r.drop) * 10) / 10, sameDirection: diff <= 45, readyAt: r.x.readyAt ?? r.x.promisedAt };
    })
    .filter(s => s.extraKm <= 3)
    .sort((a, b) => Number(b.sameDirection) - Number(a.sameDirection) || a.extraKm - b.extraKm);
};

/** A rider carrying two or more of a kitchen's orders drops the nearest to the kitchen first. */
export const dropOrderOf = (db: MockDb, o: MockFoodOrder) => {
  if (!o.riderId || o.fulfilment !== 'delivery') return null;
  const v = vendorOf(db, o.businessId);
  if (v.lat === null || v.lng === null) return null;
  const kitchen = { lat: v.lat, lng: v.lng };
  const run = db.food.orders
    .filter(x => x.riderId === o.riderId && x.businessId === o.businessId && ['accepted', 'preparing', 'ready', 'on_the_way'].includes(x.status))
    .map(x => ({ x, d: dropOf(x) }))
    .filter((r): r is { x: MockFoodOrder; d: { lat: number; lng: number } } => !!r.d)
    .sort((a, b) => distanceKm(kitchen, a.d) - distanceKm(kitchen, b.d));
  if (run.length < 2) return null;
  return { position: run.findIndex(r => r.x.id === o.id) + 1, of: run.length };
};

// ── Storefront ──
export const STOREFRONT_BASE = 'https://metromatrix.app/s/';

export const storefrontWire = (db: MockDb, v: MockFoodVendor, now: number) => {
  const month = todayOf(v, now).slice(0, 7);
  const mine = db.food.orders.filter(o => o.businessId === v.businessId && dateInZone(o.placedAt, v.timezone).startsWith(month) && !['rejected', 'auto_rejected'].includes(o.status));
  const kindOf = (o: MockFoodOrder) => k(db).orders.find(r => r.orderId === o.id)?.origin.kind ?? 'app';
  const count = (kind: string) => mine.filter(o => kindOf(o) === kind).length;
  const url = `${STOREFRONT_BASE}${v.slug}`;
  return {
    url,
    qrUrl: `${url}?via=qr`,
    slug: v.slug,
    name: v.name,
    shareText: `Order from ${v.name} on Food Court: ${url}\nYou pay the kitchen directly; no commission is taken.`,
    stats: { month, link: count('link'), qr: count('qr'), app: count('app'), tiffin: count('tiffin') },
  };
};

export { isoNow };
