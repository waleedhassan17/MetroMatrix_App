// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's Kitchen tools (5C)
// ═══════════════════════════════════════════════════════
// The assistant's use and limits, the city price list and nutrition foods
// (CSV imports with a dry run), aliases, calendar events, signature dishes,
// the platform's demand map and a tiffin or catering code lookup.
// docs/API_KITCHEN.md §13, §21–25, §36.

import type { DemandMap, Hygiene, NutritionFood } from './kitchen';

/** GET /admin/ai/usage (the last days) with the switches as running (GET /admin/ai/settings). */
export interface AiUsageReport {
  days: number;
  enabled: boolean;
  /** The model in use, or null when none is set up. */
  model: string | null;
  totals: { actions: number; failures: number; failureRate: number; cached: number };
  byFeature: { feature: string; actions: number; failures: number; p50Ms: number; p95Ms: number }[];
  byBusiness: { businessId: string; name: string; actions: number; failures: number }[];
}

export type PriceUnit = 'kg' | 'l' | 'pc';

/** A PBS SPI item kitchens' purchases are compared with: in how many cities, and the latest week staff loaded. */
export interface ReferenceItem {
  key: string;
  name: string;
  /** The unit PBS prices it in ("kg", "dozen", "litre"). */
  unit: string;
  cities: number;
  latestWeek: string | null;
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}

/** A dry run's answer, or an import's: what was read, what's wrong, what it did (or would do). */
export interface CsvImportResult {
  dryRun: boolean;
  rows: number;
  valid: number;
  errors: CsvRowError[];
  /** What it covers, in a line ("2 cities, the week of 15 Oct", "3 new, 1 changed"). */
  summary: string;
  imported: number;
}

export type NutritionPer = NutritionFood['per'];

/** A nutrition food as staff keep it: per 100 g, its key and source. */
export interface StaffNutritionFood extends NutritionFood {
  key: string;
  nameUr: string | null;
  group: string | null;
  source: string;
  isActive: boolean;
}

export type NutritionFoodInput = Pick<StaffNutritionFood, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat'> & { key?: string; nameUr?: string | null; group?: string | null };

export type AliasLanguage = 'ur' | 'roman' | 'en';

export interface IngredientAlias {
  id: string;
  word: string;
  language: AliasLanguage;
  /** The canonical name it means ("tomato"). */
  key: string;
  keyName: string;
}

export interface IngredientKey {
  key: string;
  name: string;
}

export type CalendarEventKind = 'ramadan' | 'eid' | 'public_holiday' | 'other';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  name: string;
  startsOn: string;
  endsOn: string;
  /** Only in this city; null: everywhere. */
  city: string | null;
  days: number;
  state: 'upcoming' | 'now' | 'past';
}

export type CalendarEventInput = Pick<CalendarEvent, 'kind' | 'name' | 'startsOn' | 'endsOn'> & { city?: string | null };

/** A claim goes live at once; staff can take it down (with a reason the kitchen is told). */
export type SignatureStatus = 'claimed' | 'removed';

export interface SignatureDish {
  recipeCardId: string;
  itemId: string;
  name: string;
  photoUrl: string | null;
  vendor: { id: string; name: string; slug: string } | null;
  creatorName: string | null;
  since: string | null;
  status: SignatureStatus;
  /** Why it was taken down. */
  note: string | null;
  reviewedAt: string | null;
}

export interface SignatureList {
  items: SignatureDish[];
  counts: Record<SignatureStatus, number>;
}

export interface AdminDemandMap extends DemandMap {
  cities: string[];
}

/** A code staff looked up (CT- catering, FC- order, or a tiffin's id): what it is, in lines. */
export interface GrowthLookup {
  kind: 'tiffin' | 'catering' | 'order';
  code: string;
  status: string;
  vendor: string;
  customer: string;
  lines: { label: string; value: string }[];
}

/** A kitchen's hygiene checklist as staff review it. */
export interface HygieneReview extends Hygiene {
  brandId: string;
  businessId: string;
  vendor: { id: string; name: string; slug: string; isHomeKitchen: boolean } | null;
  city: string | null;
  cookName: string | null;
  photoUrls: string[];
  videoUrl: string | null;
}
