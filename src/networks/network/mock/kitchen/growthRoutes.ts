// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy growth routes (5B): Ramadan, the storefront, demand,
// menu insights and experiments, story and hygiene, batching
// ═══════════════════════════════════════════════════════
// Mirrors docs/API_KITCHEN_ASSUMED.md §2.11–2.14, §3.11–3.13, §4.6. The
// rules live in growthLogic.ts.

import type { ShopCtx } from '../shop/shopRoutes';
import type { MockFoodVendor } from '../food/foodTypes';
import { distanceKm, isVisible } from '../food/foodDiscovery';
import { formatSlot, zonedToIso } from '../../../../utils/healthTime';
import type { MockExperiment } from './kitchenTypes';
import { KitchenError, invalid, isInt, isoNow, k, nextId, notFound, text, todayOf } from './kitchenLogic';
import {
  HYGIENE_LABEL,
  batchSuggestions,
  demandWire,
  experimentWire,
  hygieneOf,
  hygieneWire,
  menuInsightsWire,
  ramadanSettingsOf,
  ramadanState,
  storefrontWire,
} from './growthLogic';
import type { KitchenKit } from './kitchenRoutes';

const enc = (s: string) => decodeURIComponent(s);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;
const VIDEO_URL = /^(https?:|blob:|file:)/;
export const MAX_RUNNING_EXPERIMENTS = 3;
export const MAX_STORY_PHOTOS = 6;

const windowLabel = (from: string, to: string, tz: string, date: string) => `${formatSlot(zonedToIso(date, from, tz), tz)} – ${formatSlot(zonedToIso(date, to, tz), tz)}`;

export function registerGrowthRoutes(kit: KitchenKit) {
  const { route, myVendor, optionalUser, requireAdmin } = kit;

  // ── Ramadan ──
  const ramadanWire = (ctx: ShopCtx, v: MockFoodVendor) => {
    const today = todayOf(v, ctx.now);
    const st = ramadanState(ctx.db, today);
    const r = ramadanSettingsOf(ctx.db, v.businessId);
    return {
      event: st.event ? { name: st.event.name, startsOn: st.event.startsOn, endsOn: st.event.endsOn } : null,
      state: st.state,
      opensOn: st.opensOn,
      enabled: r.enabled && st.state !== 'none',
      sehri: { from: r.sehriFrom, to: r.sehriTo, label: windowLabel(r.sehriFrom, r.sehriTo, v.timezone, today) },
      iftar: { from: r.iftarFrom, to: r.iftarTo, label: windowLabel(r.iftarFrom, r.iftarTo, v.timezone, today) },
      iftarPreorderOnly: r.iftarPreorderOnly,
    };
  };

  route('GET', '/food/vendor/ramadan', ctx => ramadanWire(ctx, myVendor(ctx)));

  route('PUT', '/food/vendor/ramadan', ctx => {
    const v = myVendor(ctx);
    const st = ramadanState(ctx.db, todayOf(v, ctx.now));
    if (st.state === 'none')
      throw new KitchenError(409, 'RAMADAN_NOT_ACTIVE', st.event ? `Ramadan mode opens on ${st.opensOn}, a month before the first fast.` : 'There is no Ramadan on the calendar yet.', {
        event: st.event ? { name: st.event.name, startsOn: st.event.startsOn } : null,
        opensOn: st.opensOn,
      });
    const r = ramadanSettingsOf(ctx.db, v.businessId);
    const b = ctx.body;
    if (b.enabled !== undefined) {
      if (typeof b.enabled !== 'boolean') throw invalid('enabled', 'enabled must be true or false');
      r.enabled = b.enabled;
    }
    for (const [key, from, to] of [['sehri', 'sehriFrom', 'sehriTo'], ['iftar', 'iftarFrom', 'iftarTo']] as const) {
      const w = b[key];
      if (w === undefined) continue;
      if (!w || !HHMM.test(String(w.from)) || !HHMM.test(String(w.to))) throw invalid(key, `${key}: from and to as HH:mm`);
      r[from] = String(w.from);
      r[to] = String(w.to);
    }
    if (b.iftarPreorderOnly !== undefined) {
      if (typeof b.iftarPreorderOnly !== 'boolean') throw invalid('iftarPreorderOnly', 'iftarPreorderOnly must be true or false');
      r.iftarPreorderOnly = b.iftarPreorderOnly;
    }
    return ramadanWire(ctx, v);
  });

  route('GET', '/food/ramadan/iftar', ctx => {
    optionalUser(ctx);
    const lat = Number(ctx.query.lat);
    const lng = Number(ctx.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw invalid('lat', 'lat and lng are required');
    const live = ctx.db.food.vendors.filter(v => isVisible(ctx.db, v) && v.lat !== null && v.lng !== null);
    const today = live[0] ? todayOf(live[0], ctx.now) : new Date(ctx.now).toISOString().slice(0, 10);
    const st = ramadanState(ctx.db, today);
    if (st.state !== 'active') return { state: st.state, event: st.event ? { name: st.event.name, startsOn: st.event.startsOn, endsOn: st.event.endsOn } : null, items: [] };
    return {
      state: st.state,
      event: { name: st.event!.name, startsOn: st.event!.startsOn, endsOn: st.event!.endsOn },
      items: live
        .map(v => ({ v, r: ramadanSettingsOf(ctx.db, v.businessId), d: Math.round(distanceKm({ lat, lng }, { lat: v.lat!, lng: v.lng! }) * 10) / 10 }))
        .filter(x => x.r.enabled && x.d <= 10)
        .sort((a, b) => a.d - b.d)
        .slice(0, 20)
        .map(x => ({
          vendorId: x.v.brandId,
          slug: x.v.slug,
          name: x.v.name,
          logoUrl: x.v.logoUrl,
          coverUrl: x.v.coverUrl,
          distanceKm: x.d,
          iftar: { from: x.r.iftarFrom, to: x.r.iftarTo, label: windowLabel(x.r.iftarFrom, x.r.iftarTo, x.v.timezone, today) },
          preorderOnly: x.r.iftarPreorderOnly,
        })),
    };
  });

  // ── The storefront ──
  route('GET', '/food/vendor/storefront', ctx => {
    const v = myVendor(ctx);
    return storefrontWire(ctx.db, v, ctx.now);
  });

  // ── Demand ──
  route('GET', '/food/vendor/demand', ctx => {
    const v = myVendor(ctx);
    const cuisine = ctx.query.cuisine ? String(ctx.query.cuisine) : null;
    const hour = ctx.query.hour === undefined || ctx.query.hour === '' ? null : Number(ctx.query.hour);
    if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) throw invalid('hour', 'hour must be 0 to 23');
    return demandWire(ctx.db, v, { cuisine, hour }, ctx.now);
  });

  // ── Menu insights and experiments ──
  route('GET', '/food/vendor/menu-insights', ctx => menuInsightsWire(ctx.db, myVendor(ctx), ctx.now));

  const myExperiment = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const e = (k(ctx.db).experiments ?? []).find(x => x.id === id && x.businessId === v.businessId);
    if (!e) throw notFound('Experiment');
    return e;
  };
  const itemOf = (ctx: ShopCtx, e: MockExperiment) => ctx.db.food.items.find(i => i.id === e.itemId);
  /** Puts the dish back as it was before the experiment. */
  const revert = (ctx: ShopCtx, e: MockExperiment) => {
    const i = itemOf(ctx, e);
    if (!i) return;
    if (e.change.kind === 'price') i.basePrice = e.change.oldPrice;
    else i.photoUrl = e.change.oldPhotoUrl;
  };

  route('GET', '/food/vendor/experiments', ctx => {
    const v = myVendor(ctx);
    return {
      items: (k(ctx.db).experiments ?? [])
        .filter(e => e.businessId === v.businessId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map(e => experimentWire(ctx.db, e, ctx.now)),
    };
  });

  route('POST', '/food/vendor/experiments', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    const item = ctx.db.food.items.find(i => i.id === String(b.itemId ?? '') && i.businessId === v.businessId && i.isActive);
    if (!item) throw notFound('Dish');
    if (!isInt(b.days) || b.days < 3 || b.days > 14) throw invalid('days', 'days must be 3 to 14');
    const all = k(ctx.db).experiments ?? (k(ctx.db).experiments = []);
    if (all.some(e => e.itemId === item.id && e.status === 'running')) throw new KitchenError(409, 'EXPERIMENT_RUNNING', `${item.name} already has a test running.`);
    if (all.filter(e => e.businessId === v.businessId && e.status === 'running').length >= MAX_RUNNING_EXPERIMENTS)
      throw new KitchenError(409, 'EXPERIMENT_LIMIT', `Up to ${MAX_RUNNING_EXPERIMENTS} tests at a time.`, { max: MAX_RUNNING_EXPERIMENTS });
    const c = b.change ?? {};
    let change: MockExperiment['change'];
    if (c.kind === 'price') {
      if (item.variants.length) throw new KitchenError(422, 'EXPERIMENT_NOT_SUPPORTED', 'Price tests are for dishes without sizes.');
      if (!isInt(c.price) || c.price === item.basePrice || c.price < Math.ceil(item.basePrice * 0.6) || c.price > Math.floor(item.basePrice * 1.4))
        throw invalid('change.price', 'A new price within 40% of today’s.');
      change = { kind: 'price', price: c.price, oldPrice: item.basePrice };
      item.basePrice = c.price;
    } else if (c.kind === 'photo') {
      if (!IMAGE_URL.test(String(c.photoUrl ?? ''))) throw invalid('change.photoUrl', 'Upload the photo first.');
      change = { kind: 'photo', photoUrl: String(c.photoUrl), oldPhotoUrl: item.photoUrl };
      item.photoUrl = String(c.photoUrl);
    } else throw invalid('change.kind', 'change.kind must be price or photo');
    const e: MockExperiment = { id: nextId(ctx.db, 'ex'), businessId: v.businessId, itemId: item.id, change, days: b.days, startedAt: isoNow(ctx.now), endsAt: isoNow(ctx.now + b.days * 86_400_000), status: 'running', decidedAt: null };
    all.push(e);
    ctx.setStatus(201);
    return experimentWire(ctx.db, e, ctx.now);
  });

  route('GET', '/food/vendor/experiments/:id', ctx => experimentWire(ctx.db, myExperiment(ctx, myVendor(ctx), enc(ctx.params[0])), ctx.now));

  const decide = (kind: 'keep' | 'adjust' | 'drop' | 'stop') => (ctx: ShopCtx) => {
    const v = myVendor(ctx);
    const e = myExperiment(ctx, v, enc(ctx.params[0]));
    if (kind === 'stop' ? e.status !== 'running' : e.status !== 'done')
      throw new KitchenError(409, 'INVALID_TRANSITION', kind === 'stop' ? 'This test has finished.' : 'Decide once the test has finished.', { status: e.status });
    if (kind === 'adjust') {
      if (e.change.kind !== 'price') throw new KitchenError(422, 'EXPERIMENT_NOT_SUPPORTED', 'Only a price can be adjusted.');
      const item = itemOf(ctx, e);
      const p = ctx.body.price;
      if (!item || !isInt(p) || p < Math.ceil(e.change.oldPrice * 0.6) || p > Math.floor(e.change.oldPrice * 1.4)) throw invalid('price', 'A price within 40% of the old one.');
      item.basePrice = p;
    }
    if (kind === 'drop' || kind === 'stop') revert(ctx, e);
    e.status = kind === 'keep' ? 'kept' : kind === 'adjust' ? 'adjusted' : kind === 'drop' ? 'dropped' : 'stopped';
    e.decidedAt = isoNow(ctx.now);
    return experimentWire(ctx.db, e, ctx.now);
  };
  route('POST', '/food/vendor/experiments/:id/keep', decide('keep'));
  route('POST', '/food/vendor/experiments/:id/adjust', decide('adjust'));
  route('POST', '/food/vendor/experiments/:id/drop', decide('drop'));
  route('POST', '/food/vendor/experiments/:id/stop', decide('stop'));

  // ── Story and hygiene ──
  const storyWire = (ctx: ShopCtx, v: MockFoodVendor) => {
    const s = (k(ctx.db).stories ?? []).find(x => x.businessId === v.businessId);
    return s ? { text: s.text, cookName: s.cookName, photoUrls: s.photoUrls, videoUrl: s.videoUrl, updatedAt: s.updatedAt } : { text: '', cookName: '', photoUrls: [], videoUrl: null, updatedAt: null };
  };

  route('GET', '/food/vendor/story', ctx => storyWire(ctx, myVendor(ctx)));

  route('PUT', '/food/vendor/story', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    const t = text(b.text);
    if (t.length < 20 || t.length > 600) throw invalid('text', 'Tell it in 20 to 600 characters.');
    const cookName = text(b.cookName);
    if (cookName.length < 2 || cookName.length > 60) throw invalid('cookName', 'Who cooks? 2 to 60 characters.');
    const photoUrls = Array.isArray(b.photoUrls) ? b.photoUrls.map(String) : [];
    if (photoUrls.length > MAX_STORY_PHOTOS || photoUrls.some((u: string) => !IMAGE_URL.test(u))) throw invalid('photoUrls', `Up to ${MAX_STORY_PHOTOS} photos, uploaded first.`);
    const videoUrl = b.videoUrl === undefined || b.videoUrl === null ? null : String(b.videoUrl);
    if (videoUrl !== null && !VIDEO_URL.test(videoUrl)) throw invalid('videoUrl', 'Upload the video first.');
    const all = k(ctx.db).stories ?? (k(ctx.db).stories = []);
    const row = { businessId: v.businessId, text: t, cookName, photoUrls, videoUrl, updatedAt: isoNow(ctx.now) };
    const at = all.findIndex(x => x.businessId === v.businessId);
    if (at >= 0) all[at] = row;
    else all.push(row);
    return storyWire(ctx, v);
  });

  route('GET', '/food/vendor/hygiene', ctx => hygieneWire(hygieneOf(ctx.db, myVendor(ctx).businessId)));

  route('PUT', '/food/vendor/hygiene/items/:key', ctx => {
    const v = myVendor(ctx);
    const h = hygieneOf(ctx.db, v.businessId);
    const item = h.items.find(i => i.key === enc(ctx.params[0]));
    if (!item) throw notFound('Checklist item');
    if (typeof ctx.body.done !== 'boolean') throw invalid('done', 'done must be true or false');
    const evidence = ctx.body.evidenceUrl === undefined ? item.evidenceUrl : ctx.body.evidenceUrl === null ? null : String(ctx.body.evidenceUrl);
    if (evidence !== null && !IMAGE_URL.test(evidence)) throw invalid('evidenceUrl', 'Upload the photo first.');
    const changed = item.done !== ctx.body.done || item.evidenceUrl !== evidence;
    item.done = ctx.body.done;
    item.evidenceUrl = evidence;
    // A change after a request or a review is declared again, and verified again.
    if (changed) {
      h.status = h.items.every(i => i.done) ? 'self_declared' : 'none';
      h.note = null;
    }
    return hygieneWire(h);
  });

  route('POST', '/food/vendor/hygiene/request-verification', ctx => {
    const v = myVendor(ctx);
    const h = hygieneOf(ctx.db, v.businessId);
    if (!h.items.every(i => i.done)) throw new KitchenError(422, 'HYGIENE_INCOMPLETE', 'Tick every item first.', { missing: h.items.filter(i => !i.done).map(i => HYGIENE_LABEL[i.key] ?? i.key) });
    if (h.status === 'pending' || h.status === 'verified') throw new KitchenError(409, 'INVALID_TRANSITION', h.status === 'pending' ? 'Staff are checking it already.' : 'It is verified already.', { status: h.status });
    h.status = 'pending';
    h.requestedAt = isoNow(ctx.now);
    h.note = null;
    return hygieneWire(h);
  });

  // ── Staff: the hygiene queue (the console's screens come in P7) ──
  route('GET', '/admin/kitchen/hygiene', ctx => {
    requireAdmin(ctx);
    const status = String(ctx.query.status ?? 'pending');
    return {
      items: (k(ctx.db).hygiene ?? [])
        .filter(h => h.status === status)
        .map(h => {
          const v = ctx.db.food.vendors.find(x => x.businessId === h.businessId);
          return { businessId: h.businessId, vendor: v ? { id: v.brandId, name: v.name, slug: v.slug, kind: v.kind } : null, ...hygieneWire(h) };
        }),
    };
  });

  const review = (verify: boolean) => (ctx: ShopCtx) => {
    requireAdmin(ctx);
    const h = (k(ctx.db).hygiene ?? []).find(x => x.businessId === enc(ctx.params[0]));
    if (!h) throw notFound('Hygiene checklist');
    if (h.status !== 'pending') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no request to review.', { status: h.status });
    const note = text(ctx.body.note);
    if (!verify && (note.length < 3 || note.length > 300)) throw invalid('note', 'Say what needs fixing (3 to 300 characters).');
    h.status = verify ? 'verified' : 'rejected';
    h.note = verify ? null : note;
    h.reviewedAt = isoNow(ctx.now);
    return hygieneWire(h);
  };
  route('POST', '/admin/kitchen/hygiene/:businessId/verify', review(true));
  route('POST', '/admin/kitchen/hygiene/:businessId/reject', review(false));

  // ── Batching ──
  route('GET', '/food/vendor/orders/:id/batch-suggestions', ctx => {
    const v = myVendor(ctx);
    const id = enc(ctx.params[0]);
    const o = ctx.db.food.orders.find(x => (x.id === id || x.code === id) && x.businessId === v.businessId);
    if (!o) throw notFound('Order');
    return { items: batchSuggestions(ctx.db, o) };
  });

}
