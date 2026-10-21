// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's Kitchen tools (5C)
// ═══════════════════════════════════════════════════════
// The assistant's use and limits, the city price list and nutrition foods
// (CSV imports with a dry run), aliases, calendar events, signature dishes,
// the platform's demand map and a tiffin or catering code lookup.
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §4.8.

import type { CateringRequest, DemandMap, Hygiene, NutritionFood, TiffinSubscription } from './kitchen';

export interface AiUseSum {
  actions: number;
  failures: number;
  avgMs: number;
}

export interface AiUsageReport {
  from: string;
  to: string;
  enabled: boolean;
  totals: AiUseSum & { failureRate: number; p50Ms: number; p95Ms: number };
  byFeature: (AiUseSum & { feature: string })[];
  byOwner: (AiUseSum & {
    ownerId: string;
    kind: 'kitchen' | 'customer';
    name: string;
    usedThisMonth: number;
    limit: number;
    /** Staff's own limit; null = the plan's. */
    override: number | null;
  })[];
}

export type AiOwnerUse = AiUsageReport['byOwner'][number];

export type PriceUnit = 'kg' | 'l' | 'pc';

export interface ReferencePriceList {
  city: string;
  cities: string[];
  /** The Monday of the latest week. */
  week: string | null;
  items: { key: string; name: string; price: number; unit: PriceUnit; changePct: number | null }[];
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}

/** A dry run's answer, or an import's: what was read, what's wrong, what it would do. */
export interface CsvImportResult<T> {
  dryRun: boolean;
  rows: number;
  valid: number;
  errors: CsvRowError[];
  preview: T[];
  imported: number;
}

export interface PriceImportRow {
  row: number;
  key: string;
  name: string;
  city: string;
  week: string;
  price: number;
  unit: PriceUnit;
  /** The price already kept for that week, if any. */
  previous: number | null;
}

export type NutritionPer = NutritionFood['per'];

/** A nutrition food as staff keep it: its key, and how many kitchens' ingredients use it. */
export interface StaffNutritionFood extends NutritionFood {
  key: string;
  /** Kitchens' ingredients mapped to it. */
  usedBy: number;
  updatedAt: string | null;
}

export type NutritionFoodInput = Pick<StaffNutritionFood, 'name' | 'per' | 'kcal' | 'protein' | 'carbs' | 'fat'> & { key?: string };

export interface NutritionFoodImportRow extends Omit<StaffNutritionFood, 'id' | 'usedBy' | 'updatedAt'> {
  row: number;
  change: 'new' | 'update' | 'same';
}

export type AliasLanguage = 'ur' | 'roman_ur' | 'en';

export interface IngredientAlias {
  id: string;
  word: string;
  language: AliasLanguage;
  key: string;
  keyName: string;
}

export interface IngredientKey {
  key: string;
  name: string;
}

export type CalendarEventKind = 'ramadan' | 'eid' | 'other';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  name: string;
  startsOn: string;
  endsOn: string;
  days: number;
  state: 'upcoming' | 'now' | 'past';
}

export type CalendarEventInput = Pick<CalendarEvent, 'kind' | 'name' | 'startsOn' | 'endsOn'>;

export type SignatureStatus = 'new' | 'approved' | 'removed';

export interface SignatureDish {
  itemId: string;
  name: string;
  photoUrl: string | null;
  vendor: { id: string; name: string; slug: string } | null;
  creatorName: string | null;
  status: SignatureStatus;
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

export type GrowthLookup =
  | { kind: 'tiffin'; tiffin: TiffinSubscription }
  | { kind: 'catering'; catering: CateringRequest };

/** A kitchen's hygiene checklist as staff review it. */
export interface HygieneReview extends Hygiene {
  businessId: string;
  vendor: { id: string; name: string; slug: string; isHomeKitchen: boolean } | null;
}
