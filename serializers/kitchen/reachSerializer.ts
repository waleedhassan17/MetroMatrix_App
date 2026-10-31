// MetroMatrix — Kitchen serializers: reaching customers (5B): Ramadan, the
// storefront, demand, menu insights and experiments, story, hygiene, batching.
// docs/API_KITCHEN_ASSUMED.md §2.11–2.14 (TODO(API_KITCHEN): an assumed contract).

import type { HygieneReview } from '../../models/kitchenAdmin';
import type {
  BatchSuggestion,
  DemandCell,
  DemandMap,
  Experiment,
  ExperimentStatus,
  ExperimentVerdict,
  Hygiene,
  HygieneItem,
  HygieneStatus,
  IftarKitchen,
  IftarNearby,
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
import { arr, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list, numOrNull, whole } from './kitchenCommon';

const RAMADAN_STATES: readonly RamadanState[] = ['active', 'upcoming', 'none'];
const QUADRANTS: readonly Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog', 'unknown'];
const SUGGESTIONS: readonly SuggestionKind[] = ['keep', 'price', 'photo', 'drop', 'recipe'];
const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = ['running', 'done', 'kept', 'adjusted', 'dropped', 'stopped'];
const VERDICTS: readonly ExperimentVerdict[] = ['keep', 'adjust', 'drop'];
const HYGIENE_STATUSES: readonly HygieneStatus[] = ['none', 'self_declared', 'pending', 'verified', 'rejected'];

const share = (v: unknown) => Math.max(0, Math.min(1, num(v)));
const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);
const isoOrNull = (v: unknown) => {
  const s = strOrNull(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};

const windowSerializer = (raw: unknown): TimeWindow => {
  const w = isObject(raw) ? raw : {};
  return { from: str(w.from), to: str(w.to), label: str(w.label, `${str(w.from)} – ${str(w.to)}`) };
};

const eventSerializer = (raw: unknown): RamadanEvent | null =>
  isObject(raw) && str(raw.name) ? { name: str(raw.name), startsOn: dateOrNull(raw.startsOn) ?? '', endsOn: dateOrNull(raw.endsOn) ?? '' } : null;

// ── Ramadan ──
export const ramadanSettingsSerializer = fromResponse((raw: unknown): RamadanSettings => {
  const r = isObject(raw) ? raw : {};
  return {
    event: eventSerializer(r.event),
    state: oneOf(r.state, RAMADAN_STATES, 'none'),
    opensOn: dateOrNull(r.opensOn),
    enabled: bool(r.enabled),
    sehri: windowSerializer(r.sehri),
    iftar: windowSerializer(r.iftar),
    iftarPreorderOnly: bool(r.iftarPreorderOnly),
  };
});

const iftarKitchenSerializer = (raw: unknown): IftarKitchen | null =>
  isObject(raw) && str(raw.vendorId)
    ? {
        vendorId: str(raw.vendorId),
        slug: str(raw.slug),
        name: str(raw.name),
        logoUrl: strOrNull(raw.logoUrl),
        coverUrl: strOrNull(raw.coverUrl),
        distanceKm: numOrNull(raw.distanceKm),
        iftar: windowSerializer(raw.iftar),
        preorderOnly: bool(raw.preorderOnly),
      }
    : null;

export const iftarNearbySerializer = fromResponse((raw: unknown): IftarNearby => {
  const r = isObject(raw) ? raw : {};
  return { state: oneOf(r.state, RAMADAN_STATES, 'none'), event: eventSerializer(r.event), items: list(r.items, iftarKitchenSerializer) };
});

// ── Storefront ──
export const storefrontSerializer = fromResponse((raw: unknown): Storefront => {
  const r = isObject(raw) ? raw : {};
  const st = isObject(r.stats) ? r.stats : {};
  const url = str(r.url);
  return {
    url,
    qrUrl: str(r.qrUrl, url ? `${url}?via=qr` : ''),
    slug: str(r.slug),
    name: str(r.name, 'Your kitchen'),
    shareText: str(r.shareText, url),
    stats: { month: str(st.month), link: count(st.link), qr: count(st.qr), app: count(st.app), tiffin: count(st.tiffin) },
  };
});

// ── Demand ──
const point = (raw: unknown) => {
  const p = isObject(raw) ? raw : {};
  const lat = numOrNull(p.lat);
  const lng = numOrNull(p.lng);
  return lat === null || lng === null ? null : { lat, lng };
};

const cellSerializer = (raw: unknown): DemandCell | null => {
  if (!isObject(raw) || !str(raw.geohash)) return null;
  const sw = point(raw.sw);
  const ne = point(raw.ne);
  return sw && ne ? { geohash: str(raw.geohash), sw, ne, searches: count(raw.searches), unmetShare: share(raw.unmetShare) } : null;
};

const curve = (raw: unknown) => {
  const xs = arr(raw).map(share);
  return Array.from({ length: 24 }, (_, h) => xs[h] ?? 0);
};

export const demandMapSerializer = fromResponse((raw: unknown): DemandMap => {
  const r = isObject(raw) ? raw : {};
  const minCount = Math.max(1, count(r.minCount) || 10);
  const hc = isObject(r.hourCurve) ? r.hourCurve : {};
  return {
    city: strOrNull(r.city),
    center: point(r.center),
    radiusKm: Math.max(1, num(r.radiusKm, 8)),
    minCount,
    total: count(r.total),
    hidden: count(r.hidden),
    // Never draw a cell the server should have held back.
    cells: list(r.cells, cellSerializer).filter(c => c.searches >= minCount),
    topUnmet: list(r.topUnmet, x =>
      isObject(x) && str(x.query) ? { query: str(x.query), searches: count(x.searches), unmetShare: share(x.unmetShare), hour: Math.max(0, Math.min(23, Math.round(num(x.hour)))) } : null,
    ),
    hourCurve: { area: curve(hc.area), own: curve(hc.own) },
  };
});

// ── Menu insights and experiments ──
const insightItemSerializer = (raw: unknown): MenuInsightItem | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const s = isObject(raw.suggestion) ? raw.suggestion : {};
  const keep = numOrNull(raw.keep);
  return {
    itemId: str(raw.itemId),
    name: str(raw.name),
    photoUrl: strOrNull(raw.photoUrl),
    price: count(raw.price),
    hasSizes: bool(raw.hasSizes),
    sold: count(raw.sold),
    keep: keep === null ? null : whole(keep),
    keepPct: numOrNull(raw.keepPct),
    popularity: share(raw.popularity),
    profit: raw.profit === null || raw.profit === undefined ? null : share(raw.profit),
    quadrant: keep === null ? 'unknown' : oneOf(raw.quadrant, QUADRANTS, 'unknown'),
    suggestion: { kind: oneOf(s.kind, SUGGESTIONS, 'keep'), text: str(s.text), price: numOrNull(s.price) },
    experimentRunning: bool(raw.experimentRunning),
  };
};

export const menuInsightsSerializer = fromResponse((raw: unknown): MenuInsights => {
  const r = isObject(raw) ? raw : {};
  const m = isObject(r.medians) ? r.medians : {};
  return { range: str(r.range, '30d'), medians: { sold: num(m.sold), keep: num(m.keep) }, items: list(r.items, insightItemSerializer) };
});

const rate = (raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  return { perDay: Math.max(0, num(r.perDay)), salesPerDay: count(r.salesPerDay) };
};

export const experimentSerializer = fromResponse((raw: unknown): Experiment | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const c = isObject(raw.change) ? raw.change : {};
  const p = isObject(raw.progress) ? raw.progress : {};
  const res = isObject(raw.result) ? raw.result : null;
  const days = Math.max(1, count(raw.days));
  return {
    id: str(raw.id),
    itemId: str(raw.itemId),
    itemName: str(raw.itemName, 'A dish'),
    change: c.kind === 'photo' ? { kind: 'photo', photoUrl: str(c.photoUrl), oldPhotoUrl: strOrNull(c.oldPhotoUrl) } : { kind: 'price', price: count(c.price), oldPrice: count(c.oldPrice) },
    days,
    startedAt: isoOrNull(raw.startedAt) ?? '',
    endsAt: isoOrNull(raw.endsAt) ?? '',
    status: oneOf(raw.status, EXPERIMENT_STATUSES, 'running'),
    progress: { daysIn: Math.min(days, count(p.daysIn)), days: Math.max(1, count(p.days) || days) },
    result: res ? { verdict: res.verdict ? oneOf(res.verdict, VERDICTS, 'adjust') : null, before: rate(res.before), during: rate(res.during) } : null,
    decidedAt: isoOrNull(raw.decidedAt),
  };
});

export const experimentsSerializer = fromResponse((raw: unknown): Experiment[] => list(isObject(raw) ? raw.items : raw, experimentSerializer));

// ── Story, hygiene, batching ──
export const storySerializer = fromResponse((raw: unknown): KitchenStory => {
  const r = isObject(raw) ? raw : {};
  return { text: str(r.text), cookName: str(r.cookName), photoUrls: strings(r.photoUrls), videoUrl: strOrNull(r.videoUrl), updatedAt: isoOrNull(r.updatedAt) };
});

const hygieneItemSerializer = (raw: unknown): HygieneItem | null =>
  isObject(raw) && str(raw.key) ? { key: str(raw.key), label: str(raw.label, str(raw.key)), done: bool(raw.done), evidenceUrl: strOrNull(raw.evidenceUrl) } : null;

export const hygieneSerializer = fromResponse((raw: unknown): Hygiene => {
  const r = isObject(raw) ? raw : {};
  return {
    status: oneOf(r.status, HYGIENE_STATUSES, 'none'),
    note: strOrNull(r.note),
    items: list(r.items, hygieneItemSerializer),
    requestedAt: isoOrNull(r.requestedAt),
    reviewedAt: isoOrNull(r.reviewedAt),
    canRequest: bool(r.canRequest),
  };
});

const batchSerializer = (raw: unknown): BatchSuggestion | null =>
  isObject(raw) && str(raw.orderId)
    ? { orderId: str(raw.orderId), code: str(raw.code), extraKm: Math.max(0, num(raw.extraKm)), sameDirection: bool(raw.sameDirection), readyAt: isoOrNull(raw.readyAt) }
    : null;

export const batchSuggestionsSerializer = fromResponse((raw: unknown): BatchSuggestion[] => list(isObject(raw) ? raw.items : raw, batchSerializer));

// ── Staff: the hygiene queue ──

const hygieneReviewSerializer = (raw: unknown): HygieneReview | null => {
  if (!isObject(raw) || !str(raw.businessId)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : null;
  return {
    ...hygieneSerializer(raw),
    businessId: str(raw.businessId),
    vendor: v ? { id: str(v.id), name: str(v.name), slug: str(v.slug), isHomeKitchen: v.kind === 'home_kitchen' } : null,
  };
};

export const hygieneQueueSerializer = fromResponse((raw: unknown): HygieneReview[] => list(isObject(raw) ? raw.items : raw, hygieneReviewSerializer));
