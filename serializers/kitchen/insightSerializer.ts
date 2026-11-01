// MetroMatrix — Kitchen serializers: the Kitchen tab's numbers, insight cards, the board's
// hints, the assistant's meter and drafts, packing photos and announcements.
// docs/API_KITCHEN.md §4, §7, §11; docs/AI.md §4; docs/VOICE.md (the announcement).

import type {
  AiUsage,
  HygieneStatus,
  RamadanState,
  Announcement,
  BoardHints,
  InsightActionKind,
  InsightCard,
  InsightSeverity,
  KitchenSummary,
  PackingResult,
  ReceiptDraft,
} from '../../models/kitchen';
import { bool, isObject, num, str, strOrNull, fromResponse, bodiesOf } from '../serializerUtils';
import { count, dateOrNull, intOrNull, list } from './kitchenCommon';

/** The API's stock filters → the app's segments. */
const SEGMENT: Record<string, string> = { all: 'all', expiring: 'expiring', below_par: 'low', negative: 'negative' };

type Params = Record<string, string | number | string[]>;

/** `{ key: value }`, or nothing when there is no value. */
const param = (key: string, value: string | null | undefined): Params => (value ? { [key]: value } : {});

/** A card's screen (and params) → the one action the app takes; a screen it has no page for leaves the card out. */
const ACTION: Record<string, (p: Record<string, unknown>) => { kind: InsightActionKind; params: Params }> = {
  'kitchen.stock': p => ({ kind: 'open_stock', params: param('segment', SEGMENT[str(p.filter)]) }),
  'kitchen.costing': p => (str(p.itemId) ? { kind: 'open_recipe', params: param('itemId', str(p.itemId)) } : { kind: 'open_recipes', params: {} }),
  'kitchen.price-watch': () => ({ kind: 'open_price_watch', params: {} }),
  'kitchen.purchase.new': () => ({ kind: 'add_purchase', params: {} }),
  'kitchen.shopping-list': p => ({ kind: 'open_prep', params: param('date', dateOrNull(p.date)) }),
  'kitchen.surplus.new': () => ({ kind: 'create_surplus', params: {} }),
  'kitchen.waste': () => ({ kind: 'open_waste', params: {} }),
};

/** Priority 5 is "act today"; 3–4 deserve attention; below is good to know. */
const severityOf = (priority: number): InsightSeverity => (priority >= 5 ? 'critical' : priority >= 3 ? 'warning' : 'info');

export const insightCardSerializer = (raw: unknown): InsightCard | null => {
  if (!isObject(raw) || !str(raw.key) || !str(raw.title) || !isObject(raw.action)) return null;
  const act = ACTION[str(raw.action.screen)];
  if (!act) return null;
  const { kind, params } = act(isObject(raw.action.params) ? raw.action.params : {});
  return {
    id: str(raw.key),
    kind: str(raw.kind),
    severity: severityOf(num(raw.priority)),
    title: str(raw.title),
    why: str(raw.body),
    action: { kind, label: str(raw.action.label, 'Open'), params },
  };
};

/** At most five, most urgent first (the API sorts them). */
export const insightCardsSerializer = fromResponse((raw: unknown): InsightCard[] => list(raw, insightCardSerializer).slice(0, 5));

const HYGIENE: Record<string, HygieneStatus> = { self_declared: 'self_declared', verified: 'verified' };
const RAMADAN: Record<string, RamadanState> = { now: 'active', ahead: 'upcoming', none: 'none' };

const growthSerializer = (raw: unknown): KitchenSummary['growth'] => {
  const g = isObject(raw) ? raw : {};
  const t = isObject(g.tiffin) ? g.tiffin : {};
  const c = isObject(g.catering) ? g.catering : {};
  const r = isObject(g.ramadan) ? g.ramadan : {};
  return {
    tiffin: { plans: count(t.plans), active: count(t.subscribers), pending: count(t.requested), tomorrow: count(t.mealsTomorrow) },
    catering: { new: count(c.requested), upcoming: count(c.upcoming) },
    storefront: { brought: count(isObject(g.storefront) ? g.storefront.orders : 0) },
    demand: { unmet: count(isObject(g.demand) ? g.demand.unmetSearches : 0) },
    experiments: { running: count(isObject(g.experiments) ? g.experiments.running : 0), results: count(isObject(g.experiments) ? g.experiments.results : 0) },
    hygiene: HYGIENE[str(g.hygiene)] ?? 'none',
    ramadan: { state: RAMADAN[str(r.period)] ?? 'none', enabled: bool(r.enabled) },
  };
};

/** GET /summary: the Kitchen tab's numbers. */
export const kitchenSummarySerializer = fromResponse((raw: unknown): KitchenSummary | null => {
  if (!isObject(raw)) return null;
  const s = isObject(raw.stock) ? raw.stock : {};
  const r = isObject(raw.recipes) ? raw.recipes : {};
  const p = isObject(raw.purchases) ? raw.purchases : {};
  const f = isObject(raw.forecast) ? raw.forecast : {};
  const w = isObject(raw.waste) ? raw.waste : {};
  const negative = count(s.negative);
  return {
    date: dateOrNull(raw.date) ?? '',
    // `attention` counts each ingredient below par or below zero once: low + negative add up to it.
    stock: { total: count(s.ingredients), low: Math.max(0, count(s.attention) - negative), negative, expiring: count(s.expiring) },
    recipes: { avgFoodCostPct: intOrNull(r.avgFoodCostPct), targetFoodCostPct: count(r.targetFoodCostPct) || 35, missing: count(r.withoutRecipe), overTarget: count(r.aboveTarget) },
    purchases: { weekTotal: count(p.weekTotal), weekCount: count(p.weekCount) },
    forecast: { date: dateOrNull(f.date) ?? '', dishes: count(f.portions), orders: 0, learning: bool(f.learning) },
    waste: { weekCost: count(w.weekCost), mealsRescued: count(w.mealsRescued) },
    growth: growthSerializer(raw.growth),
  };
});

/** GET /board: the board's kitchen side. */
export const boardHintsSerializer = fromResponse((raw: unknown): BoardHints | null => {
  if (!isObject(raw)) return null;
  const prep = isObject(raw.prep) && num(raw.prep.minutes) > 0 ? raw.prep : null;
  return {
    lowStock: list(raw.lowStock, x => (isObject(x) && str(x.itemId) ? { itemId: str(x.itemId), name: str(x.name), servingsLeft: count(x.servings) } : null)),
    soldOutByStock: list(raw.soldOutByStock, x => (isObject(x) && str(x.itemId) ? { itemId: str(x.itemId), name: str(x.name) } : null)),
    prepHint: prep
      ? { minutes: count(prep.minutes), label: prep.source === 'learned' ? `Usually ready in ${count(prep.minutes)} min at this hour` : `Ready in about ${count(prep.minutes)} min` }
      : null,
    packingPhoto: bool(raw.requirePackingPhoto) ? 'required' : 'optional',
  };
});

/** GET /ai/usage: this month's smart actions and voice minutes (they reset on the 1st, Pakistan time). */
export const aiUsageSerializer = fromResponse((raw: unknown): AiUsage | null => {
  if (!isObject(raw)) return null;
  const a = isObject(raw.aiActions) ? raw.aiActions : {};
  const v = isObject(raw.voiceMinutes) ? raw.voiceMinutes : {};
  const resetsAt = dateOrNull(raw.resetsOn) ? `${dateOrNull(raw.resetsOn)}T00:00:00+05:00` : '';
  return {
    enabled: bool(raw.enabled, true),
    limit: count(a.limit),
    used: count(a.used),
    left: Math.max(0, count(a.limit) - count(a.used)),
    resetsAt,
    voice: { limit: count(v.limit), used: count(v.used), left: Math.max(0, count(v.limit) - count(v.used)), resetsAt },
  };
});

/** POST /purchases/scan: the bill read into lines; a line the kitchen doesn't stock has no match. */
export const receiptDraftSerializer = fromResponse((raw: unknown): ReceiptDraft | null => {
  if (!isObject(raw)) return null;
  const draft = isObject(raw.draft) ? raw.draft : {};
  return {
    supplierName: (isObject(raw.supplier) ? strOrNull(raw.supplier.name) : null) ?? strOrNull(raw.supplierName),
    date: dateOrNull(raw.date),
    imageUrl: str(draft.receiptUrl),
    total: count(raw.total),
    lines: list(raw.lines, l =>
      isObject(l) && (str(l.spoken) || str(l.name))
        ? {
            name: str(l.spoken) || str(l.suggestedName) || str(l.name),
            qty: Math.max(0, num(l.qty)),
            unit: str(l.unit, 'kg'),
            total: count(l.totalPrice),
            match: l.status === 'ok' && str(l.ingredientId) ? { ingredientId: str(l.ingredientId), name: str(l.name), confidence: Math.max(0, Math.min(1, num(raw.confidence, 1))) } : null,
          }
        : null,
    ),
  };
});

/** POST /orders/:id/packing-proof: the photo, and the assistant's advisory look (null when off). */
export const packingResultSerializer = fromResponse((raw: unknown): PackingResult | null =>
  isObject(raw) && str(raw.photoUrl)
    ? {
        orderId: str(raw.orderId),
        packedPhotoUrl: str(raw.photoUrl),
        check: isObject(raw.aiCheck) ? { ok: bool(raw.aiCheck.match, true), note: str(raw.aiCheck.note) } : null,
      }
    : null);

/** GET /ai/announce: the template's words, spoken by the device (a TTS clip only when the server makes one). */
export const announcementSerializer = fromResponse((raw: unknown, orderId: string = '', language: 'ur' | 'en' = 'ur'): Announcement | null =>
  isObject(raw) && str(raw.text) ? { orderId: str(raw.orderId) || orderId, text: str(raw.text), language, ttsUrl: strOrNull(raw.ttsUrl) } : null);

/** A snoozed card: its key (the app's card id) and until when. */
export const snoozedCardSerializer = fromResponse(raw => (isObject(raw) ? { id: str(raw.key), snoozedUntil: str(raw.snoozedUntil) } : null));

/** The hub's three answers (tiles, cards, the assistant's meter), read together. */
export const kitchenHubSerializer = (parts: { summary: unknown; cards: unknown; usage: unknown }) => {
  const raw = bodiesOf(parts);
  const summary = kitchenSummarySerializer(raw.summary);
  return summary ? { summary, cards: insightCardsSerializer(raw.cards), usage: aiUsageSerializer(raw.usage) } : null;
};
