// MetroMatrix — Kitchen serializers: reaching customers (5B): Ramadan, the
// storefront, demand, menu engineering and experiments, story, hygiene, batching.
// docs/API_KITCHEN.md §21–27.

import type {
  BatchSuggestion,
  DemandCell,
  DemandMap,
  Experiment,
  ExperimentStatus,
  Hygiene,
  HygieneChecklist,
  KitchenStory,
  MenuInsightItem,
  MenuInsights,
  Quadrant,
  RamadanEvent,
  RamadanSettings,
  RamadanState,
  Storefront,
  SuggestionKind,
  TimeWindow,
} from '../../models/kitchen';
import { addDays, PKT, todayInZone } from '../../utils/health-time/healthTime';
import { arr, bodiesOf, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list } from './kitchenCommon';

const QUADRANTS: readonly Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog', 'unknown'];

const share = (v: unknown) => Math.max(0, Math.min(1, num(v)));
const isoOrNull = (v: unknown) => {
  const s = strOrNull(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};

/** "17:30" → "5:30 PM". */
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) ? `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : hhmm;
};
const windowOf = (from: unknown, to: unknown): TimeWindow => {
  const f = str(from).slice(0, 5);
  const t = str(to).slice(0, 5);
  return { from: f, to: t, label: f && t ? `${clock(f)} – ${clock(t)}` : '' };
};

// ── Ramadan ──
/** GET /food/vendor/ramadan: the kitchen's hours, and the season (staff set its dates; it opens 30 days before). */
export const ramadanSettingsSerializer = fromResponse((raw: unknown, now: number = Date.now()): RamadanSettings => {
  const r = isObject(raw) ? raw : {};
  const st = isObject(r.settings) ? r.settings : {};
  const today = todayInZone(PKT, now);
  const events = list(r.events, e => (isObject(e) && dateOrNull(e.startsOn) && dateOrNull(e.endsOn) ? { name: str(e.name, 'Ramadan'), startsOn: dateOrNull(e.startsOn)!, endsOn: dateOrNull(e.endsOn)! } : null))
    .filter(e => e.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const event: RamadanEvent | null = events[0] ?? null;
  const state: RamadanState = bool(r.activeToday) || (event && event.startsOn <= today) ? 'active' : event ? 'upcoming' : 'none';
  return {
    event,
    state,
    opensOn: event ? addDays(event.startsOn, -30) : null,
    enabled: bool(st.enabled),
    sehri: windowOf(st.sehriFrom, st.sehriTo),
    iftar: windowOf(st.iftarFrom, st.iftarTo),
    iftarPreorderOnly: bool(st.iftarPreorderOnly),
  };
});

// ── Storefront ──
/** GET /food/vendor/storefront: the kitchen's own link and QR, and the last 30 days' orders by where they came from. */
export const storefrontSerializer = fromResponse((raw: unknown, name: string = 'Your kitchen'): Storefront => {
  const r = isObject(raw) ? raw : {};
  const links = isObject(r.links) ? r.links : {};
  const by = isObject(r.bySource) ? r.bySource : {};
  const n = (k: string) => (isObject(by[k]) ? count((by[k] as Record<string, unknown>).orders) : 0);
  const days = isObject(r.ordersYouBrought) ? count(r.ordersYouBrought.days) || 30 : 30;
  const url = str(links.storefront) || str(r.url);
  return {
    url,
    qrUrl: str(links.qr) || (isObject(r.qr) ? str(r.qr.payload) : '') || url,
    slug: str(r.slug),
    name,
    shareText: url ? `Order from ${name} on MetroMatrix: ${url}` : '',
    stats: { month: `the last ${days} days`, link: n('storefront'), qr: n('qr'), app: n('app'), tiffin: n('tiffin') },
  };
});

// ── Demand ──
/** The owner's floor: an area under 10 searches is never drawn (the API's own floor is lower). */
const MIN_SEARCHES = 10;

const cellSerializer = (raw: unknown): DemandCell | null => {
  if (!isObject(raw) || !str(raw.geohash6) || !isObject(raw.bounds)) return null;
  const b = raw.bounds;
  const searches = count(raw.searches);
  return {
    geohash: str(raw.geohash6),
    sw: { lat: num(b.south), lng: num(b.west) },
    ne: { lat: num(b.north), lng: num(b.east) },
    searches,
    unmetShare: searches ? share(count(raw.unmetSearches) / searches) : 0,
  };
};

/** Orders per weekday × hour → one value per hour, against the busiest (0–1). */
const hourShares = (raw: unknown) => {
  const rows = arr(raw).map(row => arr(row).map(num));
  const perHour = Array.from({ length: 24 }, (_, h) => rows.reduce((n, row) => n + (row[h] ?? 0), 0));
  const top = Math.max(...perHour, 0);
  return perHour.map(v => (top ? v / top : 0));
};

/** The demand map (searches by area, never under the floor, never a person) and, when read with it, the hours. */
export const demandMapSerializer = (parts: { map: unknown; curve?: unknown }): DemandMap => {
  const raw = bodiesOf(parts);
  const r = isObject(raw.map) ? raw.map : {};
  const c = isObject(raw.curve) ? raw.curve : {};
  const minCount = Math.max(MIN_SEARCHES, count(r.k));
  const all = list(r.cells, cellSerializer);
  const cells = all.filter(x => x.searches >= minCount);
  const centers = cells.length ? cells : all;
  return {
    city: strOrNull(r.city),
    center: centers.length ? { lat: centers.reduce((n, x) => n + (x.sw.lat + x.ne.lat) / 2, 0) / centers.length, lng: centers.reduce((n, x) => n + (x.sw.lng + x.ne.lng) / 2, 0) / centers.length } : null,
    radiusKm: 8,
    minCount,
    total: all.reduce((n, x) => n + x.searches, 0),
    hidden: count(r.hidden) + all.filter(x => x.searches < minCount).length,
    cells,
    topUnmet: list(r.topQueries, x =>
      isObject(x) && str(x.query) && count(x.searches) >= minCount ? { query: str(x.query), searches: count(x.searches), unmetShare: share(num(x.zeroResultShare) + num(x.closedShare)), hour: -1 } : null,
    ),
    hourCurve: { area: hourShares(isObject(c.area) ? (c.area.perKitchen ?? c.area.orders) : []), own: hourShares(isObject(c.own) ? c.own.orders : []) },
  };
};

// ── Menu engineering and experiments ──
const SUGGESTION: Record<string, SuggestionKind> = { feature: 'keep', reprice: 'price', redescribe_or_bundle: 'photo', remove: 'drop' };

/** GET /menu-engineering (+ the experiments, to mark the dishes being tried). */
export const menuInsightsSerializer = (parts: { data: unknown; experiments?: unknown }): MenuInsights => {
  const raw = bodiesOf(parts);
  const r = isObject(raw.data) ? raw.data : {};
  const running = new Set(experimentsSerializer(raw.experiments).filter(e => e.status === 'running').map(e => e.itemId));
  const rows = list(r.items, i => (isObject(i) && str(i.itemId) ? i : null));
  const maxQty = Math.max(1, ...rows.map(i => count(i.qty)));
  const maxMargin = Math.max(1, ...rows.map(i => num(i.margin)));
  const items: MenuInsightItem[] = rows.map(i => {
    const price = count(i.price);
    const keep = Math.round(num(i.margin));
    return {
      itemId: str(i.itemId),
      name: str(i.name),
      photoUrl: null,
      price,
      hasSizes: false,
      sold: count(i.qty),
      keep,
      keepPct: price ? Math.round((keep / price) * 100) : null,
      popularity: share(count(i.qty) / maxQty),
      profit: share(Math.max(0, keep) / maxMargin),
      quadrant: oneOf(i.quadrant, QUADRANTS, 'unknown'),
      suggestion: { kind: SUGGESTION[str(i.action)] ?? 'keep', text: str(i.advice), price: null },
      experimentRunning: running.has(str(i.itemId)),
    };
  });
  const missing = list(r.needsRecipe, i =>
    isObject(i) && str(i.itemId)
      ? { itemId: str(i.itemId), name: str(i.name), photoUrl: null, price: count(i.price), hasSizes: false, sold: count(i.qty), keep: null, keepPct: null, popularity: share(count(i.qty) / maxQty), profit: null, quadrant: 'unknown' as Quadrant, suggestion: { kind: 'recipe' as SuggestionKind, text: 'Add a recipe card to analyse', price: null }, experimentRunning: running.has(str(i.itemId)) }
      : null,
  );
  return { range: `${count(r.days) || 30}d`, medians: { sold: num(r.medianQty), keep: num(r.medianMargin) }, items: [...items, ...missing] };
};

const DECIDED: Record<string, ExperimentStatus> = { Kept: 'kept', Adjusted: 'adjusted', Dropped: 'dropped' };
const STATUS: Record<string, ExperimentStatus> = { planned: 'running', running: 'running', completed: 'done', cancelled: 'stopped' };

/** An experiment: a dish tried for some days (what changed is in its notes, reachModel's experimentNotes); its result against the category's other dishes. */
export const experimentSerializer = fromResponse((raw: unknown): Experiment | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const notes = str(raw.notes);
  const price = notes.match(/Price Rs ([\d,]+) → Rs ([\d,]+)/);
  const decided = notes.match(/ · (Kept|Adjusted|Dropped)$/)?.[1];
  const res = isObject(raw.result) ? raw.result : null;
  const days = Math.max(1, count(raw.days));
  const startsOn = dateOrNull(raw.startsOn) ?? '';
  const endsOn = dateOrNull(raw.endsOn) ?? '';
  const median = res ? num(res.categoryMedianDaily) : 0;
  const daily = res ? num(res.itemDaily) : 0;
  return {
    id: str(raw.id),
    itemId: str(raw.itemId),
    itemName: str(raw.item, 'A dish'),
    change: price
      ? { kind: 'price', oldPrice: Number(price[1].replace(/,/g, '')), price: Number(price[2].replace(/,/g, '')) }
      : notes.startsWith('New photo')
        ? { kind: 'photo', photoUrl: '', oldPhotoUrl: null }
        : { kind: 'price', price: res ? count(res.price) : 0, oldPrice: res ? count(res.price) : 0 },
    days,
    startedAt: startsOn ? `${startsOn}T00:00:00+05:00` : '',
    endsAt: endsOn ? `${endsOn}T23:59:59+05:00` : '',
    status: decided ? DECIDED[decided] : (STATUS[str(raw.status)] ?? 'running'),
    progress: { daysIn: Math.min(days, res ? count(res.days) : 0), days },
    result: res
      ? {
          verdict: res.recommendation === 'keep' || res.recommendation === 'adjust' || res.recommendation === 'drop' ? res.recommendation : null,
          before: { perDay: median, salesPerDay: Math.round(median) },
          during: { perDay: daily, salesPerDay: Math.round(daily) },
        }
      : null,
    decidedAt: decided ? (isoOrNull(raw.completedAt) ?? isoOrNull(raw.createdAt)) : null,
  };
});

export const experimentsSerializer = fromResponse((raw: unknown): Experiment[] => list(isObject(raw) ? raw.items : raw, experimentSerializer));

// ── Story, hygiene, batching ──
/** GET /food/vendor/story: the kitchen's own words and photos (its hygiene checklist rides along). */
export const storySerializer = fromResponse((raw: unknown): KitchenStory => {
  const r = isObject(raw) ? raw : {};
  return { text: str(r.story), cookName: str(r.cookName), photoUrls: list(r.photos, p => (typeof p === 'string' ? p : isObject(p) ? strOrNull(p.url) : null)), videoUrl: strOrNull(r.videoUrl), updatedAt: isoOrNull(r.declaredAt) };
});

/** The checklist's keys in the kitchen's words (the API's list, in its order). */
export const HYGIENE_ITEMS: { key: string; label: string }[] = [
  { key: 'gloves', label: 'Gloves while cooking and packing' },
  { key: 'hairnet', label: 'Hair covered in the kitchen' },
  { key: 'cleanWater', label: 'Clean (filtered or boiled) water' },
  { key: 'fridgeTempLog', label: 'A fridge temperature log' },
  { key: 'separateBoards', label: 'Separate boards for raw and cooked' },
  { key: 'pestControlOn', label: 'Pest control (the date it was last done)' },
];

/** The hygiene checklist and where it stands: ticked by the kitchen (self-declared), verified by staff. */
export const hygieneSerializer = fromResponse((raw: unknown): Hygiene => {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.hygieneChecklist) ? r.hygieneChecklist : {};
  const status = r.hygieneStatus === 'verified' ? 'verified' : r.hygieneStatus === 'self_declared' ? 'self_declared' : 'none';
  return {
    status,
    note: strOrNull(r.verifiedMethod),
    items: HYGIENE_ITEMS.map(i => ({ key: i.key, label: i.label, done: i.key === 'pestControlOn' ? !!dateOrNull(c.pestControlOn) : bool(c[i.key]), evidenceUrl: i.key === 'pestControlOn' ? dateOrNull(c.pestControlOn) : null })),
    requestedAt: isoOrNull(r.declaredAt),
    reviewedAt: isoOrNull(r.verifiedAt),
    canRequest: false,
  };
});

/** The checklist as it stands, to send back whole with a story save. */
export const hygieneChecklistOf = (h: Hygiene | null): HygieneChecklist => {
  const done = (k: string) => !!h?.items.find(i => i.key === k)?.done;
  return {
    gloves: done('gloves'),
    hairnet: done('hairnet'),
    cleanWater: done('cleanWater'),
    fridgeTempLog: done('fridgeTempLog'),
    separateBoards: done('separateBoards'),
    pestControlOn: h?.items.find(i => i.key === 'pestControlOn')?.evidenceUrl ?? null,
  };
};

/** GET /food/vendor/riders/suggest: other ready orders going the same way (`batchWith`). */
export const batchSuggestionsSerializer = fromResponse((raw: unknown): BatchSuggestion[] =>
  list(isObject(raw) ? raw.batchWith : raw, b =>
    isObject(b) && str(b.orderId) ? { orderId: str(b.orderId), code: str(b.code), extraKm: Math.max(0, num(b.extraKm)), sameDirection: num(b.bearingDiff) <= 45, readyAt: null } : null,
  ));
