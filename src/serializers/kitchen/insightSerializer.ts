// MetroMatrix — Kitchen serializers: the hub's numbers, insight cards, the board's hints,
// the assistant's usage and drafts, packing photos and announcements.
// docs/API_KITCHEN_ASSUMED.md §2.8, §4.1, §4.5; docs/AI_ASSUMED.md §2–3.

import type {
  AiUsage,
  Announcement,
  BoardHints,
  InsightActionKind,
  InsightCard,
  InsightSeverity,
  KitchenSummary,
  PackingPhotoRule,
  PackingResult,
  ReceiptDraft,
} from '../../types/kitchen';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { count, dateOrNull, intOrNull, list } from './kitchenCommon';

const SEVERITIES: readonly InsightSeverity[] = ['critical', 'warning', 'info'];
export const INSIGHT_ACTIONS: readonly InsightActionKind[] = [
  'open_stock',
  'open_ingredient',
  'add_purchase',
  'stock_take',
  'open_recipe',
  'open_recipes',
  'open_prep',
  'create_surplus',
  'apply_portions',
  'make_special',
  'open_demand',
  'open_experiment',
  'open_review_insights',
  'open_tiffin',
  'open_catering',
];
const PACKING: readonly PackingPhotoRule[] = ['off', 'optional', 'required'];

const params = (raw: unknown): Record<string, string | number | string[]> => {
  if (!isObject(raw)) return {};
  const out: Record<string, string | number | string[]> = {};
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === 'string' || typeof v === 'number') out[key] = v;
    else if (Array.isArray(v)) out[key] = v.map(x => str(x)).filter(Boolean);
  }
  return out;
};

/** A card the app can't act on is left out. */
export const insightCardSerializer = (raw: unknown): InsightCard | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.title) || !isObject(raw.action)) return null;
  const kind = oneOf(raw.action.kind, INSIGHT_ACTIONS, null);
  if (!kind) return null;
  return {
    id: str(raw.id),
    kind: str(raw.kind),
    severity: oneOf(raw.severity, SEVERITIES, 'info'),
    title: str(raw.title),
    why: str(raw.why),
    action: { kind, label: str(raw.action.label, 'Open'), params: params(raw.action.params) },
  };
};

export const insightCardsSerializer = (raw: unknown): InsightCard[] => list(isObject(raw) ? raw.items : raw, insightCardSerializer).slice(0, 5);

const growthSerializer = (raw: unknown): KitchenSummary['growth'] => {
  const g = isObject(raw) ? raw : {};
  const t = isObject(g.tiffin) ? g.tiffin : {};
  const c = isObject(g.catering) ? g.catering : {};
  return {
    tiffin: { plans: count(t.plans), active: count(t.active), pending: count(t.pending), tomorrow: count(t.tomorrow) },
    catering: { new: count(c.new), upcoming: count(c.upcoming) },
  };
};

export const kitchenSummarySerializer = (raw: unknown): KitchenSummary | null => {
  if (!isObject(raw)) return null;
  const s = isObject(raw.stock) ? raw.stock : {};
  const r = isObject(raw.recipes) ? raw.recipes : {};
  const p = isObject(raw.purchases) ? raw.purchases : {};
  const f = isObject(raw.forecast) ? raw.forecast : {};
  const w = isObject(raw.waste) ? raw.waste : {};
  return {
    date: dateOrNull(raw.date) ?? '',
    stock: { total: count(s.total), low: count(s.low), negative: count(s.negative), expiring: count(s.expiring) },
    recipes: { avgFoodCostPct: intOrNull(r.avgFoodCostPct), targetFoodCostPct: count(r.targetFoodCostPct) || 40, missing: count(r.missing), overTarget: count(r.overTarget) },
    purchases: { weekTotal: count(p.weekTotal), weekCount: count(p.weekCount) },
    forecast: { date: dateOrNull(f.date) ?? '', dishes: count(f.dishes), orders: count(f.orders), learning: bool(f.learning) },
    waste: { weekCost: count(w.weekCost), mealsRescued: count(w.mealsRescued) },
    growth: growthSerializer(raw.growth),
  };
};

export const boardHintsSerializer = (raw: unknown): BoardHints | null => {
  if (!isObject(raw)) return null;
  const h = isObject(raw.prepHint) && num(raw.prepHint.minutes) > 0 ? { minutes: count(raw.prepHint.minutes), label: str(raw.prepHint.label) } : null;
  return {
    lowStock: list(raw.lowStock, x => (isObject(x) && str(x.itemId) ? { itemId: str(x.itemId), name: str(x.name), servingsLeft: count(x.servingsLeft) } : null)),
    soldOutByStock: list(raw.soldOutByStock, x => (isObject(x) && str(x.itemId) ? { itemId: str(x.itemId), name: str(x.name) } : null)),
    prepHint: h,
    packingPhoto: oneOf(raw.packingPhoto, PACKING, 'off'),
  };
};

export const aiUsageSerializer = (raw: unknown): AiUsage | null => {
  if (!isObject(raw)) return null;
  const v = isObject(raw.voice) ? raw.voice : {};
  return {
    enabled: bool(raw.enabled, true),
    limit: count(raw.limit),
    used: count(raw.used),
    left: count(raw.left),
    resetsAt: str(raw.resetsAt),
    voice: { limit: count(v.limit), used: count(v.used), left: count(v.left), resetsAt: str(v.resetsAt) },
  };
};

export const receiptDraftSerializer = (raw: unknown): ReceiptDraft | null => {
  if (!isObject(raw)) return null;
  return {
    supplierName: strOrNull(raw.supplierName),
    date: dateOrNull(raw.date),
    imageUrl: str(raw.imageUrl),
    total: count(raw.total),
    lines: list(raw.lines, l =>
      isObject(l) && str(l.name)
        ? {
            name: str(l.name),
            qty: Math.max(0, num(l.qty)),
            unit: str(l.unit, 'kg'),
            total: count(l.total),
            match: isObject(l.match) && str(l.match.ingredientId) ? { ingredientId: str(l.match.ingredientId), name: str(l.match.name), confidence: Math.max(0, Math.min(1, num(l.match.confidence))) } : null,
          }
        : null,
    ),
  };
};

export const packingResultSerializer = (raw: unknown): PackingResult | null =>
  isObject(raw) && str(raw.packedPhotoUrl)
    ? {
        orderId: str(raw.orderId),
        packedPhotoUrl: str(raw.packedPhotoUrl),
        check: isObject(raw.check) && str(raw.check.note) ? { ok: bool(raw.check.ok, true), note: str(raw.check.note) } : null,
      }
    : null;

export const announcementSerializer = (raw: unknown): Announcement | null =>
  isObject(raw) && str(raw.text)
    ? { orderId: str(raw.orderId), text: str(raw.text), language: raw.language === 'ur' ? 'ur' : 'en', ttsUrl: strOrNull(raw.ttsUrl) }
    : null;

export { arr };
