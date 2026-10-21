// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's Kitchen tools: serializers
// ═══════════════════════════════════════════════════════
// The assistant's use, the city price list, nutrition foods, CSV dry runs,
// aliases, calendar events, signature dishes, the platform demand map and a
// code lookup. Defensive: a row the app can't read is dropped.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §4.8.

import type {
  AdminDemandMap,
  AiOwnerUse,
  AiUsageReport,
  AiUseSum,
  AliasLanguage,
  CalendarEvent,
  CalendarEventKind,
  CsvImportResult,
  CsvRowError,
  GrowthLookup,
  IngredientAlias,
  IngredientKey,
  NutritionFoodImportRow,
  NutritionPer,
  PriceImportRow,
  PriceUnit,
  ReferencePriceList,
  SignatureDish,
  SignatureList,
  SignatureStatus,
  StaffNutritionFood,
} from '../../types/kitchenAdmin';
import { arr, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { count, dateOrNull, list, numOrNull } from './kitchenCommon';
import { demandMapSerializer } from './reachSerializer';
import { cateringRequestSerializer, tiffinSubscriptionSerializer } from './growthSerializer';

const PRICE_UNITS: readonly PriceUnit[] = ['kg', 'l', 'pc'];
const PERS: readonly NutritionPer[] = ['g100', 'ml100', 'piece'];
const LANGUAGES: readonly AliasLanguage[] = ['ur', 'roman_ur', 'en'];
const KINDS: readonly CalendarEventKind[] = ['ramadan', 'eid', 'other'];
const SIGNATURE: readonly SignatureStatus[] = ['new', 'approved', 'removed'];
const money = (v: unknown) => Math.max(0, Math.round(num(v) * 100) / 100);
const isoOrNull = (v: unknown) => {
  const s = strOrNull(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};
const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string' && !!x);

// ── The assistant's use ──
const sumOf = (r: Record<string, unknown>): AiUseSum => ({ actions: count(r.actions), failures: count(r.failures), avgMs: count(r.avgMs) });

const ownerSerializer = (raw: unknown): AiOwnerUse | null =>
  isObject(raw) && str(raw.ownerId)
    ? {
        ...sumOf(raw),
        ownerId: str(raw.ownerId),
        kind: raw.kind === 'customer' ? 'customer' : 'kitchen',
        name: str(raw.name, str(raw.ownerId)),
        usedThisMonth: count(raw.usedThisMonth),
        limit: count(raw.limit),
        override: numOrNull(raw.override),
      }
    : null;

export const aiUsageReportSerializer = (raw: unknown): AiUsageReport => {
  const r = isObject(raw) ? raw : {};
  const t = isObject(r.totals) ? r.totals : {};
  return {
    from: dateOrNull(r.from) ?? '',
    to: dateOrNull(r.to) ?? '',
    enabled: r.enabled !== false,
    totals: { ...sumOf(t), failureRate: Math.max(0, Math.min(1, num(t.failureRate))), p50Ms: count(t.p50Ms), p95Ms: count(t.p95Ms) },
    byFeature: list(r.byFeature, x => (isObject(x) && str(x.feature) ? { ...sumOf(x), feature: str(x.feature) } : null)),
    byOwner: list(r.byOwner, ownerSerializer),
  };
};

// ── The city price list ──
export const referencePricesSerializer = (raw: unknown): ReferencePriceList => {
  const r = isObject(raw) ? raw : {};
  return {
    city: str(r.city, 'Lahore'),
    cities: strings(r.cities),
    week: dateOrNull(r.week),
    items: list(r.items, x =>
      isObject(x) && str(x.key)
        ? { key: str(x.key), name: str(x.name, str(x.key)), price: money(x.price), unit: oneOf(x.unit, PRICE_UNITS, 'kg'), changePct: numOrNull(x.changePct) }
        : null,
    ),
  };
};

// ── CSV dry runs and imports ──
const rowErrorSerializer = (raw: unknown): CsvRowError | null =>
  isObject(raw) && num(raw.row) > 0 ? { row: count(raw.row), field: str(raw.field), message: str(raw.message, 'This row has a problem.') } : null;

/** The errors a refused import names (`422 CSV_HAS_ERRORS { errors }`). */
export const csvErrorsSerializer = (raw: unknown): CsvRowError[] => list(isObject(raw) ? raw.errors : raw, rowErrorSerializer);

const importSerializer =
  <T>(row: (x: unknown) => T | null) =>
  (raw: unknown): CsvImportResult<T> => {
    const r = isObject(raw) ? raw : {};
    return {
      dryRun: r.dryRun === true,
      rows: count(r.rows),
      valid: count(r.valid),
      errors: list(r.errors, rowErrorSerializer),
      preview: list(r.preview, row),
      imported: count(r.imported),
    };
  };

export const priceImportSerializer = importSerializer<PriceImportRow>(x =>
  isObject(x) && str(x.key)
    ? {
        row: count(x.row),
        key: str(x.key),
        name: str(x.name, str(x.key)),
        city: str(x.city),
        week: str(x.week),
        price: money(x.price),
        unit: oneOf(x.unit, PRICE_UNITS, 'kg'),
        previous: numOrNull(x.previous),
      }
    : null,
);

// ── Nutrition foods ──
const macros = (x: Record<string, unknown>) => ({ kcal: money(x.kcal), protein: money(x.protein), carbs: money(x.carbs), fat: money(x.fat) });

export const nutritionFoodSerializer = (raw: unknown): StaffNutritionFood | null =>
  isObject(raw) && str(raw.id)
    ? { id: str(raw.id), key: str(raw.key), name: str(raw.name, str(raw.key)), per: oneOf(raw.per, PERS, 'g100'), ...macros(raw), usedBy: count(raw.usedBy), updatedAt: isoOrNull(raw.updatedAt) }
    : null;

export const staffNutritionFoodsSerializer = (raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  return { items: list(r.items, nutritionFoodSerializer), total: count(r.total) };
};

export const nutritionFoodImportSerializer = importSerializer<NutritionFoodImportRow>(x =>
  isObject(x) && str(x.key)
    ? { row: count(x.row), key: str(x.key), name: str(x.name, str(x.key)), per: oneOf(x.per, PERS, 'g100'), ...macros(x), change: oneOf(x.change, ['new', 'update', 'same'] as const, 'update') }
    : null,
);

// ── Aliases ──
export const aliasSerializer = (raw: unknown): IngredientAlias | null =>
  isObject(raw) && str(raw.id) && str(raw.word)
    ? { id: str(raw.id), word: str(raw.word), language: oneOf(raw.language, LANGUAGES, 'roman_ur'), key: str(raw.key), keyName: str(raw.keyName, str(raw.key)) }
    : null;

export const aliasesSerializer = (raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  const items = list(r.items, aliasSerializer);
  return { items, total: Math.max(items.length, count(r.total)) };
};

export const ingredientKeysSerializer = (raw: unknown): IngredientKey[] =>
  list(isObject(raw) ? raw.items : raw, x => (isObject(x) && str(x.key) ? { key: str(x.key), name: str(x.name, str(x.key)) } : null));

// ── Calendar events ──
export const calendarEventSerializer = (raw: unknown): CalendarEvent | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const startsOn = dateOrNull(raw.startsOn);
  const endsOn = dateOrNull(raw.endsOn);
  if (!startsOn || !endsOn) return null;
  return {
    id: str(raw.id),
    kind: oneOf(raw.kind, KINDS, 'other'),
    name: str(raw.name),
    startsOn,
    endsOn,
    days: Math.max(1, count(raw.days)),
    state: oneOf(raw.state, ['upcoming', 'now', 'past'] as const, 'upcoming'),
  };
};

export const calendarEventsSerializer = (raw: unknown): CalendarEvent[] => list(isObject(raw) ? raw.items : raw, calendarEventSerializer);

// ── Signature dishes ──
export const signatureDishSerializer = (raw: unknown): SignatureDish | null => {
  if (!isObject(raw) || !str(raw.itemId)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : null;
  return {
    itemId: str(raw.itemId),
    name: str(raw.name, 'Dish'),
    photoUrl: strOrNull(raw.photoUrl),
    vendor: v && str(v.id) ? { id: str(v.id), name: str(v.name), slug: str(v.slug) } : null,
    creatorName: strOrNull(raw.creatorName),
    status: oneOf(raw.status, SIGNATURE, 'new'),
    note: strOrNull(raw.note),
    reviewedAt: isoOrNull(raw.reviewedAt),
  };
};

export const signatureListSerializer = (raw: unknown): SignatureList => {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.counts) ? r.counts : {};
  return { items: list(r.items, signatureDishSerializer), counts: { new: count(c.new), approved: count(c.approved), removed: count(c.removed) } };
};

// ── The platform's demand map ──
export const adminDemandSerializer = (raw: unknown): AdminDemandMap => ({ ...demandMapSerializer(raw), cities: strings(isObject(raw) ? raw.cities : null) });

// ── A code looked up ──
export const growthLookupSerializer = (raw: unknown): GrowthLookup | null => {
  if (!isObject(raw)) return null;
  if (raw.kind === 'tiffin') {
    const tiffin = tiffinSubscriptionSerializer(raw.tiffin);
    return tiffin ? { kind: 'tiffin', tiffin } : null;
  }
  if (raw.kind === 'catering') {
    const catering = cateringRequestSerializer(raw.catering);
    return catering ? { kind: 'catering', catering } : null;
  }
  return null;
};
