// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's Kitchen tools: words and forms
// ═══════════════════════════════════════════════════════
// What each assistant feature is called, a response time and a failure
// rate said plainly, a reference price per unit, a nutrition food's form,
// an alias, a calendar event, a signature dish's state, a CSV dry run's
// summary, and the checks each form runs before it is sent. The limits are
// the assumed API's own (docs/API_KITCHEN.md §4.8).

import type {
  AliasLanguage,
  CalendarEvent,
  CalendarEventInput,
  CalendarEventKind,
  CsvImportResult,
  NutritionFoodInput,
  NutritionPer,
  ReferenceItem,
  SignatureStatus,
} from '../kitchenAdmin';
import { formatDayShort } from '../../utils/health-time/healthTime';
import type { KitchenTone } from './kitchenStatusModel';

type Errors = Record<string, string>;

// ── The assistant ──
export const AI_FEATURE_LABEL: Record<string, string> = {
  voice: 'Voice',
  receipt_scan: 'Receipt scans',
  packing_check: 'Packing photo checks',
  descriptions: 'Dish descriptions',
  specials: 'Specials',
  combos: 'Combos',
  photo_check: 'Photo tips',
  review_insights: 'Review themes',
  nutrition_estimate: 'Nutrition estimates',
  recipe_suggestions: 'Recipe ideas (customers)',
};

export const aiFeatureLabel = (feature: string) => AI_FEATURE_LABEL[feature] ?? feature.replace(/_/g, ' ');

/** "0.8 s", "2.9 s"; under a tenth, "under 0.1 s". */
export const secondsLabel = (ms: number) => (ms < 100 ? 'under 0.1 s' : `${(ms / 1000).toFixed(1)} s`);

/** "2% failed", "none failed". */
export const failedLabel = (failures: number, actions: number) => (!failures ? 'none failed' : `${Math.max(1, Math.round((failures / Math.max(1, actions)) * 100))}% failed`);


/** "Kg · 3 cities · the week ending Thu 15 Oct", or "no prices yet". */
export const referenceLine = (i: Pick<ReferenceItem, 'unit' | 'cities' | 'latestWeek'>) =>
  i.latestWeek ? `${i.unit} · ${i.cities} ${i.cities === 1 ? 'city' : 'cities'} · the week ending ${formatDayShort(i.latestWeek)}` : `${i.unit} · no prices yet`;

// ── CSV imports ──
/** The backend's headers (docs/API_KITCHEN.md §13, §36). */
export const PRICE_COLUMNS = ['week_ending', 'city', 'item', 'unit', 'price'];
export const NUTRITION_COLUMNS = ['key', 'name', 'name_ur', 'food_group', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sodium_mg', 'piece_grams'];
export const MAX_CSV_ROWS = 2000;

/** "3 rows · 1 ready · 2 with problems". */
export const importSummary = (r: Pick<CsvImportResult, 'rows' | 'valid'>) => {
  const bad = r.rows - r.valid;
  return `${r.rows} ${r.rows === 1 ? 'row' : 'rows'} · ${r.valid} ready${bad ? ` · ${bad} with problems` : ''}`;
};

/** Every row is fine: the import can go. */
export const canImport = (r: Pick<CsvImportResult, 'rows' | 'valid' | 'errors'> | null) => !!r && r.rows > 0 && r.valid === r.rows && !r.errors.length;

/** What a CSV needs before it is sent. */
export const validateCsvText = (csv: string, columns: string[]): Errors => {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { csv: 'Choose a CSV file or paste its text.' };
  const head = lines[0].replace(/^﻿/, '').split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase());
  const missing = columns.filter(c => !head.includes(c));
  if (missing.length) return { csv: `The first row should name the columns: ${columns.join(', ')}.` };
  if (lines.length < 2) return { csv: 'The file has a header but no rows.' };
  if (lines.length - 1 > MAX_CSV_ROWS) return { csv: `Up to ${MAX_CSV_ROWS} rows at a time.` };
  return {};
};

// ── Nutrition foods ──
export const PER_LABEL: Record<NutritionPer, string> = { g100: 'per 100 g', ml100: 'per 100 ml', piece: 'per piece' };

export interface NutritionFoodForm {
  key: string;
  name: string;
  per: NutritionPer;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

export const emptyNutritionFoodForm = (): NutritionFoodForm => ({ key: '', name: '', per: 'g100', kcal: '', protein: '', carbs: '', fat: '' });

export const nutritionFoodFormOf = (f: NutritionFoodInput & { key: string }): NutritionFoodForm => ({
  key: f.key,
  name: f.name,
  per: 'g100',
  kcal: String(f.kcal),
  protein: String(f.protein),
  carbs: String(f.carbs),
  fat: String(f.fat),
});

/** "spinach-palak" from "Spinach (palak)". */
export const foodKeyOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const validateNutritionFood = (f: NutritionFoodForm, isNew: boolean): Errors => {
  const e: Errors = {};
  if (isNew && !/^[a-z0-9][a-z0-9-]{1,59}$/.test(f.key.trim())) e.key = 'Lower-case letters, digits and dashes (2 to 60)';
  const name = f.name.trim();
  if (name.length < 2 || name.length > 60) e.name = 'A name, 2 to 60 characters';
  const check = (field: 'kcal' | 'protein' | 'carbs' | 'fat', max: number) => {
    const v = Number(f[field]);
    if (f[field].trim() === '' || !Number.isFinite(v) || v < 0 || v > max) e[field] = `0 to ${max}`;
  };
  // Per 100 g (the API's limits).
  check('kcal', 950);
  check('protein', 100);
  check('carbs', 100);
  check('fat', 100);
  return e;
};

/** Values are per 100 g (the API keeps no other base). */
export const nutritionFoodInputOf = (f: NutritionFoodForm): NutritionFoodInput => ({
  name: f.name.trim(),
  kcal: Number(f.kcal),
  protein: Number(f.protein),
  carbs: Number(f.carbs),
  fat: Number(f.fat),
});

/** "18 kcal · 0.9 g protein · 3.9 g carbs · 0.2 g fat, per 100 g". */
export const macrosLine = (f: { per: NutritionPer; kcal: number; protein: number; carbs: number; fat: number }) =>
  `${f.kcal} kcal · ${f.protein} g protein · ${f.carbs} g carbs · ${f.fat} g fat, ${PER_LABEL[f.per]}`;

// ── Aliases ──
export const ALIAS_LANGUAGE_LABEL: Record<AliasLanguage, string> = { roman: 'Roman Urdu', ur: 'Urdu', en: 'English' };
export const ALIAS_LANGUAGES: AliasLanguage[] = ['roman', 'ur', 'en'];

export interface AliasForm {
  word: string;
  language: AliasLanguage;
  key: string;
  keyName: string;
}

export const emptyAliasForm = (): AliasForm => ({ word: '', language: 'roman', key: '', keyName: '' });

export const validateAlias = (f: AliasForm): Errors => {
  const e: Errors = {};
  const w = f.word.trim();
  if (!w) e.word = 'The word people say or write';
  else if (w.length > 40) e.word = 'Up to 40 characters';
  else if (f.language === 'ur' && !/[؀-ۿ]/.test(w)) e.word = 'Urdu words are written in Urdu script';
  else if (f.language !== 'ur' && /[؀-ۿ]/.test(w)) e.word = 'Pick Urdu for a word in Urdu script';
  if (!f.key.trim()) e.key = 'The ingredient it means, in English (for example “tomato”)';
  return e;
};

// ── Calendar events ──
export const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = { ramadan: 'Ramadan', eid: 'Eid', public_holiday: 'Public holiday', other: 'Other' };
export const EVENT_KINDS: CalendarEventKind[] = ['ramadan', 'eid', 'public_holiday', 'other'];
export const MAX_EVENT_DAYS = 40;

export const EVENT_STATE: Record<CalendarEvent['state'], { label: string; tone: KitchenTone }> = {
  upcoming: { label: 'Upcoming', tone: 'accent' },
  now: { label: 'On now', tone: 'success' },
  past: { label: 'Past', tone: 'neutral' },
};

/** "Mon 8 Feb – Tue 9 Mar · 30 days". */
export const eventLine = (e: Pick<CalendarEvent, 'startsOn' | 'endsOn' | 'days'>) =>
  `${formatDayShort(e.startsOn)}${e.endsOn !== e.startsOn ? ` – ${formatDayShort(e.endsOn)}` : ''} · ${e.days} ${e.days === 1 ? 'day' : 'days'}`;

export const emptyEventForm = (today: string): CalendarEventInput => ({ kind: 'other', name: '', startsOn: today, endsOn: today });

export const validateEvent = (f: CalendarEventInput): Errors => {
  const e: Errors = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 60) e.name = 'A name, 2 to 60 characters';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.startsOn)) e.startsOn = 'Pick the first day';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.endsOn)) e.endsOn = 'Pick the last day';
  else if (f.endsOn < f.startsOn) e.endsOn = 'The last day is on or after the first';
  else if ((Date.parse(f.endsOn) - Date.parse(f.startsOn)) / 86_400_000 + 1 > MAX_EVENT_DAYS) e.endsOn = `Up to ${MAX_EVENT_DAYS} days`;
  return e;
};

// ── Signature dishes ──
/** A claim is live as soon as a kitchen makes it; staff take one down with a reason. */
export const SIGNATURE_STATUS: Record<SignatureStatus, { label: string; tone: KitchenTone }> = {
  claimed: { label: 'Live', tone: 'success' },
  removed: { label: 'Taken off', tone: 'neutral' },
};

export const SIGNATURE_TABS: { key: SignatureStatus; label: string }[] = [
  { key: 'claimed', label: 'Live' },
  { key: 'removed', label: 'Taken off' },
];

/** A note the kitchen sees: why the label came off, or what needs fixing. */
export const validateStaffNote = (note: string): Errors => {
  const n = note.trim();
  return n.length < 3 ? { note: 'Say why, so the kitchen knows (3 characters or more)' } : n.length > 300 ? { note: 'Up to 300 characters' } : {};
};

// ── A code looked up ──
/** A catering code (CT-…), an order code (FC-…), or a tiffin subscription's id. */
export const validateLookupCode = (code: string): Errors =>
  /^(CT|FC)-[A-Z0-9]{4,10}$/i.test(code.trim()) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code.trim())
    ? {}
    : { code: 'A catering code (CT-…), an order code (FC-…) or a tiffin’s id' };
