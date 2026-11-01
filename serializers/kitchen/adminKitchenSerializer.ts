// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's Kitchen tools: serializers
// ═══════════════════════════════════════════════════════
// The assistant's use, the PBS reference items, nutrition foods, CSV dry
// runs, aliases, calendar events, signature dishes, the platform demand map,
// the hygiene list and a code lookup. Defensive: a row the app can't read is
// dropped. docs/API_KITCHEN.md §13, §21–25, §36.

import type {
  AdminDemandMap,
  AiUsageReport,
  CalendarEvent,
  CalendarEventKind,
  CsvImportResult,
  CsvRowError,
  GrowthLookup,
  HygieneReview,
  IngredientAlias,
  IngredientKey,
  ReferenceItem,
  SignatureDish,
  SignatureList,
  StaffNutritionFood,
} from '../../models/kitchenAdmin';
import { formatDayShort, PKT, todayInZone } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { arr, bodiesOf, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { count, dateOrNull, list } from './kitchenCommon';
import { demandMapSerializer, hygieneSerializer } from './reachSerializer';

const LANGUAGES = ['ur', 'roman', 'en'] as const;
const KINDS: readonly CalendarEventKind[] = ['ramadan', 'eid', 'public_holiday', 'other'];
const isoOrNull = (v: unknown) => {
  const s = strOrNull(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};
const macro = (v: unknown) => Math.max(0, Math.round(num(v) * 100) / 100);

// ── The assistant ──
/** GET /admin/ai/usage and GET /admin/ai/settings, read together. */
export const aiUsageReportSerializer = (parts: { usage: unknown; settings: unknown }): AiUsageReport | null => {
  const raw = bodiesOf(parts);
  if (!isObject(raw.usage)) return null;
  const u = raw.usage;
  const st = isObject(raw.settings) ? raw.settings : {};
  const t = isObject(u.totals) ? u.totals : {};
  const actions = count(t.calls);
  const failures = count(t.failures);
  return {
    days: count(u.days) || 30,
    enabled: bool(st.enabled),
    model: bool(st.providerConfigured) ? strOrNull(st.model) : null,
    totals: { actions, failures, failureRate: actions ? failures / actions : 0, cached: count(t.cached) },
    byFeature: list(u.byFeature, f =>
      isObject(f) && str(f.feature)
        ? { feature: str(f.feature), actions: count(f.calls), failures: count(f.invalid) + count(f.timeout) + count(f.quota) + count(f.error), p50Ms: count(f.p50Ms), p95Ms: count(f.p95Ms) }
        : null,
    ),
    byBusiness: list(u.byBusiness, b => (isObject(b) && str(b.businessId) ? { businessId: str(b.businessId), name: str(b.name, 'A kitchen'), actions: count(b.calls), failures: count(b.failures) } : null)),
  };
};

// ── PBS reference items ──
export const referenceItemsSerializer = fromResponse((raw: unknown): ReferenceItem[] =>
  list(isObject(raw) ? raw.items : raw, x =>
    isObject(x) && str(x.id) ? { key: str(x.id), name: str(x.name), unit: str(x.unit), cities: count(x.cities), latestWeek: dateOrNull(x.latestWeek) } : null,
  ));

// ── CSV dry runs and imports ──
const rowErrorSerializer = (raw: unknown): CsvRowError | null =>
  isObject(raw) && num(raw.line) > 0 ? { row: count(raw.line), field: '', message: str(raw.error, 'This row has a problem.') } : null;

/** The errors a refused import names. */
export const csvErrorsSerializer = (raw: unknown): CsvRowError[] => list(isObject(raw) ? raw.errors : raw, rowErrorSerializer);

/** POST /reference-prices/import: prices read (per city and week), and the rows refused. */
export const priceImportSerializer = fromResponse((raw: unknown): CsvImportResult | null => {
  if (!isObject(raw)) return null;
  const valid = count(raw.prices);
  const weeks = list(raw.weeks, w => dateOrNull(w));
  const cities = arr(raw.cities).length;
  return {
    dryRun: bool(raw.dryRun),
    rows: valid + count(raw.rejected),
    valid,
    errors: list(raw.errors, rowErrorSerializer),
    summary: `${valid} ${valid === 1 ? 'price' : 'prices'} for ${count(raw.items)} ${count(raw.items) === 1 ? 'item' : 'items'}, ${cities} ${cities === 1 ? 'city' : 'cities'}${weeks.length ? `, the week ending ${formatDayShort(weeks[weeks.length - 1])}` : ''}`,
    imported: bool(raw.dryRun) ? 0 : valid,
  };
});

/** POST /admin/nutrition/foods/import: foods added and changed (by key), and the rows refused. */
export const nutritionFoodImportSerializer = fromResponse((raw: unknown): CsvImportResult | null => {
  if (!isObject(raw)) return null;
  const valid = count(raw.inserted) + count(raw.updated);
  return {
    dryRun: bool(raw.dryRun),
    rows: valid + count(raw.rejected),
    valid,
    errors: list(raw.errors, rowErrorSerializer),
    summary: `${count(raw.inserted)} new, ${count(raw.updated)} changed`,
    imported: bool(raw.dryRun) ? 0 : valid,
  };
});

// ── Nutrition foods ──
export const nutritionFoodSerializer = fromResponse((raw: unknown): StaffNutritionFood | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const p = isObject(raw.per100g) ? raw.per100g : {};
  return {
    id: str(raw.id),
    key: str(raw.key),
    name: str(raw.name, str(raw.key)),
    nameUr: strOrNull(raw.nameUr),
    group: strOrNull(raw.group),
    source: str(raw.source, 'staff'),
    isActive: raw.isActive !== false,
    per: 'g100',
    kcal: macro(p.kcal),
    protein: macro(p.proteinG),
    carbs: macro(p.carbsG),
    fat: macro(p.fatG),
  };
});

export const staffNutritionFoodsSerializer = fromResponse((raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  return { items: list(r.items, nutritionFoodSerializer), total: count(r.total) };
});

// ── Aliases ──
export const aliasSerializer = fromResponse((raw: unknown): IngredientAlias | null =>
  isObject(raw) && str(raw.id) && str(raw.alias)
    ? { id: str(raw.id), word: str(raw.alias), language: oneOf(raw.lang, LANGUAGES, 'roman'), key: str(raw.canonical), keyName: str(raw.canonical) }
    : null);

export const aliasesSerializer = fromResponse((raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  const items = list(r.items, aliasSerializer);
  return { items, total: Math.max(items.length, count(r.total)) };
});

/** The canonical names the aliases point to (staff may type a new one). */
export const ingredientKeysSerializer = fromResponse((raw: unknown): IngredientKey[] =>
  [...new Set(list(isObject(raw) ? raw.items : raw, x => (isObject(x) ? strOrNull(x.canonical) : null)))].sort().map(key => ({ key, name: key })));

// ── Calendar events ──
export const calendarEventSerializer = fromResponse((raw: unknown, now: number = Date.now()): CalendarEvent | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const startsOn = dateOrNull(raw.startsOn);
  const endsOn = dateOrNull(raw.endsOn);
  if (!startsOn || !endsOn) return null;
  const today = todayInZone(PKT, now);
  return {
    id: str(raw.id),
    kind: oneOf(raw.kind, KINDS, 'other'),
    name: str(raw.name),
    startsOn,
    endsOn,
    city: strOrNull(raw.city),
    days: Math.max(1, Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1),
    state: endsOn < today ? 'past' : startsOn > today ? 'upcoming' : 'now',
  };
});

export const calendarEventsSerializer = fromResponse((raw: unknown): CalendarEvent[] => list(isObject(raw) ? raw.items : raw, x => calendarEventSerializer(x)));

// ── Signature dishes ──
export const signatureDishSerializer = fromResponse((raw: unknown): SignatureDish | null => {
  if (!isObject(raw) || !str(raw.recipeCardId)) return null;
  return {
    recipeCardId: str(raw.recipeCardId),
    itemId: str(raw.itemId),
    name: [str(raw.item, 'Dish'), str(raw.variant)].filter(Boolean).join(' · '),
    photoUrl: null,
    vendor: str(raw.brandId) ? { id: str(raw.brandId), name: str(raw.brand), slug: str(raw.slug) } : null,
    creatorName: strOrNull(raw.by),
    since: dateOrNull(raw.since),
    status: raw.removedAt ? 'removed' : 'claimed',
    note: strOrNull(raw.removedReason),
    reviewedAt: isoOrNull(raw.removedAt),
  };
});

/** One status's list (GET ?status=claimed|removed); the other count is the total the other read gave. */
export const signatureListSerializer = (parts: { claimed: unknown; removed: unknown }, status: 'claimed' | 'removed'): SignatureList => {
  const raw = bodiesOf(parts);
  const totalOf = (r: unknown) => (isObject(r) ? count(r.total) || list(r.items, x => x).length : 0);
  return {
    items: list(isObject(raw[status]) ? (raw[status] as Record<string, unknown>).items : [], x => signatureDishSerializer(x)),
    counts: { claimed: totalOf(raw.claimed), removed: totalOf(raw.removed) },
  };
};

// ── The platform's demand map ──
export const adminDemandSerializer = (parts: { map: unknown; cities: unknown }): AdminDemandMap => {
  const raw = bodiesOf(parts);
  return {
    ...demandMapSerializer({ map: raw.map }),
    cities: list(isObject(raw.cities) ? raw.cities.items : raw.cities, c => (isObject(c) ? strOrNull(c.city) : null)),
  };
};

// ── A code looked up ──
const day = (v: unknown) => (dateOrNull(v) ? formatDayShort(dateOrNull(v)!) : '');

/** GET /admin/food/lookup: a catering request (CT-), an order (FC-) or a tiffin, as plain lines. */
export const growthLookupSerializer = fromResponse((raw: unknown): GrowthLookup | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const kind = raw.kind === 'tiffin' || raw.kind === 'catering' || raw.kind === 'order' ? raw.kind : null;
  if (!kind) return null;
  const lines: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) lines.push({ label, value });
  };
  if (kind === 'tiffin') {
    add('Plan', str(raw.plan));
    add('Starts', day(raw.starts_on));
    add('This period', raw.period_start ? `${day(raw.period_start)}${raw.period_end ? ` – ${day(raw.period_end)}` : ''}` : null);
    add('Pays by', raw.payment_method === 'transfer_per_period' ? 'Transfer each period' : 'Cash');
    add('Period payment', str(raw.period_payment_status).replace(/_/g, ' '));
    add('Delivered', `${count(raw.deliveries)} (missed ${count(raw.missed)})`);
    add('Customer email', strOrNull(raw.customer_email));
  } else if (kind === 'catering') {
    add('Event', `${str(raw.event_type).replace(/_/g, ' ')} · ${count(raw.guests)} guests · ${day(raw.event_date)}`);
    add('Collected or delivered', str(raw.fulfilment).replace(/_/g, ' '));
    add('Accepted quote', raw.accepted_version === null || raw.accepted_version === undefined ? null : `v${count(raw.accepted_version)}`);
    add('Quotes', arr(raw.quotes).length ? `${arr(raw.quotes).length}` : null);
    add('Customer email', strOrNull(raw.customer_email));
  } else {
    add('Total', formatPKR(count(raw.total)));
    add('Came from', [str(raw.source), str(raw.campaign)].filter(Boolean).join(' · ') || null);
    add('Payment', `${str(raw.payment_method)} · ${str(raw.payment_status).replace(/_/g, ' ')}`);
    add('Scheduled for', isoOrNull(raw.scheduled_for));
    add('From a dawat', strOrNull(raw.catering_code));
    add('From a tiffin', strOrNull(raw.tiffin_subscription_id));
  }
  return { kind, code: str(raw.code) || str(raw.id), status: str(raw.status), vendor: str(raw.vendor), customer: str(raw.customer), lines };
});

// ── Hygiene, for staff ──
const hygieneReviewSerializer = (raw: unknown): HygieneReview | null => {
  if (!isObject(raw) || !str(raw.brandId)) return null;
  const h = hygieneSerializer({ hygieneChecklist: raw.checklist, hygieneStatus: raw.status, declaredAt: raw.declaredAt, verifiedAt: raw.verifiedAt, verifiedMethod: raw.verifiedNote ?? raw.verifiedMethod });
  return {
    ...h,
    brandId: str(raw.brandId),
    businessId: str(raw.businessId),
    vendor: str(raw.name) ? { id: str(raw.brandId), name: str(raw.name), slug: str(raw.slug), isHomeKitchen: false } : null,
    city: strOrNull(raw.city),
    cookName: strOrNull(raw.cookName),
    photoUrls: list(raw.photos, p => (typeof p === 'string' ? p : null)),
    videoUrl: strOrNull(raw.videoUrl),
  };
};

/** GET /admin/food/hygiene?status: kitchens' checklists (self-declared, or verified). */
export const hygieneQueueSerializer = fromResponse((raw: unknown): HygieneReview[] => list(isObject(raw) ? raw.items : raw, hygieneReviewSerializer));

/** A verify or revoke answers the kitchen's status only. */
export const hygieneDecisionSerializer = fromResponse((raw: unknown) => (isObject(raw) && str(raw.brandId) ? { brandId: str(raw.brandId), status: str(raw.status) } : null));
