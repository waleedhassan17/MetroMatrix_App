// ═══════════════════════════════════════════════════════
// MetroMatrix — Food menu rules (the vendor's editors; the API decides)
// ═══════════════════════════════════════════════════════
// Dishes with sizes, reusable add-on groups, categories with a daily window,
// what is off and until when, a home kitchen's portions, weekly menu and
// pre-order slots. Limits mirror the Food API's DTOs.
// TODO(API_FOOD): check each limit against docs/API_FOOD.md.

import type { ItemTag, MenuItemInput, OptionGroup, OptionGroupInput, PreorderSlot, VendorMenuItem } from '../../types/food';
import { formatPKR } from '../../utils/money';

export type ValidationErrors = Record<string, string>;

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Tags ─────────────────────────────────────────────
export const ITEM_TAG_LABEL: Record<ItemTag, string> = {
  bestseller: 'Bestseller',
  new: 'New',
  spicy: 'Spicy',
  veg: 'Vegetarian',
  contains_nuts: 'Contains nuts',
};
export const ITEM_TAGS = Object.keys(ITEM_TAG_LABEL) as ItemTag[];
export const MAX_TAGS = 5;

// ─── Weekdays ─────────────────────────────────────────
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
/** Monday first, as the vendor reads a week; the API counts 0 = Sunday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Every day", "Weekdays", "Weekends", "Thu–Sat", "Mon, Wed, Fri". */
export const daysLabel = (days: number[]): string => {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (!set.size) return 'No days';
  if (set.size === 5 && [1, 2, 3, 4, 5].every(d => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  const ordered = WEEK_ORDER.filter(d => set.has(d));
  const idx = ordered.map(d => WEEK_ORDER.indexOf(d));
  const run = idx.every((x, i) => i === 0 || x === idx[i - 1] + 1);
  if (run && ordered.length >= 3) return `${DAY_SHORT[ordered[0]]}–${DAY_SHORT[ordered[ordered.length - 1]]}`;
  return ordered.map(d => DAY_SHORT[d]).join(', ');
};

// ─── Categories ───────────────────────────────────────
export interface CategoryForm {
  name: string;
  /** Both empty, or both "HH:MM". */
  availableFrom: string;
  availableTo: string;
}

export const validateCategory = (f: CategoryForm): ValidationErrors => {
  const e: ValidationErrors = {};
  const name = f.name.trim();
  if (!name || name.length > 80) e.name = 'Use 1 to 80 characters';
  const from = f.availableFrom.trim();
  const to = f.availableTo.trim();
  if (from || to) {
    if (!HHMM.test(from)) e.availableFrom = 'Use HH:MM, e.g. 18:00';
    if (!HHMM.test(to)) e.availableTo = 'Use HH:MM, e.g. 23:30';
    if (!e.availableFrom && !e.availableTo && from === to) e.availableTo = 'The window needs a length';
  }
  return e;
};

/** "Served 6:00 PM – 11:30 PM" or "All day". */
export const categoryWindowLabel = (from: string | null, to: string | null): string => {
  if (!from || !to) return 'All day';
  const t = (hhmm: string) => {
    const h = Number(hhmm.slice(0, 2));
    return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
  };
  return `${t(from)} – ${t(to)}`;
};

// ─── Dishes ───────────────────────────────────────────
export const MAX_VARIANTS = 10;
export const MAX_PRICE = 500000;

export interface VariantRow {
  id?: string;
  name: string;
  price: string;
}

export interface ItemForm {
  categoryId: string;
  name: string;
  description: string;
  photoUrl: string | null;
  basePrice: string;
  tags: ItemTag[];
  isDeal: boolean;
  serves: string;
  days: number[];
  isActive: boolean;
  variants: VariantRow[];
  /** Add-on group ids, in display order. */
  groupIds: string[];
}

export const emptyItemForm = (categoryId: string): ItemForm => ({
  categoryId,
  name: '',
  description: '',
  photoUrl: null,
  basePrice: '',
  tags: [],
  isDeal: false,
  serves: '',
  days: EVERY_DAY,
  isActive: true,
  variants: [],
  groupIds: [],
});

export const itemForm = (i: VendorMenuItem): ItemForm => ({
  categoryId: i.categoryId,
  name: i.name,
  description: i.description ?? '',
  photoUrl: i.photoUrl,
  basePrice: String(i.basePrice),
  tags: i.tags,
  isDeal: i.isDeal,
  serves: i.serves ? String(i.serves) : '',
  days: i.days,
  isActive: i.isActive,
  variants: i.variants.map(v => ({ id: v.id, name: v.name, price: String(v.price) })),
  // Groups for every size (per-size links are kept by the API, edited on the web later).
  groupIds: i.optionGroups.filter(l => !l.variantId).map(l => l.groupId),
});

export const validateItem = (f: ItemForm): ValidationErrors => {
  const e: ValidationErrors = {};
  if (!f.categoryId) e.categoryId = 'Pick a category';
  const name = f.name.trim();
  if (name.length < 2 || name.length > 120) e.name = 'Use 2 to 120 characters';
  if (f.description.trim().length > 1000) e.description = 'Keep it under 1,000 characters';
  const price = int(f.basePrice);
  if (!f.variants.length && (!Number.isFinite(price) || price > MAX_PRICE)) e.basePrice = 'Enter the price in rupees';
  if (f.serves.trim()) {
    const s = int(f.serves);
    if (!Number.isFinite(s) || s < 1 || s > 50) e.serves = '1 to 50 people';
  }
  if (!f.days.length) e.days = 'Pick at least one day';
  if (f.tags.length > MAX_TAGS) e.tags = `Up to ${MAX_TAGS} tags`;
  if (f.variants.length > MAX_VARIANTS) e.variants = `Up to ${MAX_VARIANTS} sizes`;
  if (f.variants.length === 1) e.variants = 'Add a second size, or remove this one and use the price above';
  f.variants.forEach((v, i) => {
    if (!v.name.trim() || v.name.trim().length > 60) e[`variants.${i}.name`] = 'Name the size';
    const p = int(v.price);
    if (!Number.isFinite(p) || p > MAX_PRICE) e[`variants.${i}.price`] = 'Enter the price';
  });
  const names = f.variants.map(v => v.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) e.variants = 'Two sizes have the same name';
  return e;
};

/** With sizes, the base price is the cheapest size (what "from Rs X" shows). */
export const itemInput = (f: ItemForm): MenuItemInput => {
  const sizes = f.variants.map(v => int(v.price)).filter(Number.isFinite);
  return {
    categoryId: f.categoryId,
    name: f.name.trim(),
    description: f.description.trim() || null,
    photoUrl: f.photoUrl,
    basePrice: sizes.length ? Math.min(...sizes) : int(f.basePrice),
    tags: f.tags,
    isDeal: f.isDeal,
    serves: f.serves.trim() ? int(f.serves) : null,
    days: [...f.days].sort((a, b) => a - b),
    isActive: f.isActive,
  };
};

export const variantsInput = (f: ItemForm) => f.variants.map(v => ({ ...(v.id ? { id: v.id } : null), name: v.name.trim(), price: int(v.price) }));

/** "Rs 650" or "from Rs 650" for a dish with sizes. */
export const itemPriceLabel = (i: Pick<VendorMenuItem, 'basePrice' | 'variants'>): string =>
  i.variants.length ? `from ${formatPKR(Math.min(...i.variants.map(v => v.price)))}` : formatPKR(i.basePrice);

// ─── Add-on groups ────────────────────────────────────
export const MAX_OPTIONS = 40;

export interface OptionRow {
  id?: string;
  name: string;
  priceDelta: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface GroupForm {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: OptionRow[];
}

export const emptyGroupForm = (): GroupForm => ({
  name: '',
  minSelect: 0,
  maxSelect: 1,
  options: [
    { name: '', priceDelta: '0', isDefault: false, isActive: true },
    { name: '', priceDelta: '0', isDefault: false, isActive: true },
  ],
});

export const groupForm = (g: OptionGroup): GroupForm => ({
  name: g.name,
  minSelect: g.minSelect,
  maxSelect: g.maxSelect,
  options: g.options.map(o => ({ id: o.id, name: o.name, priceDelta: String(o.priceDelta), isDefault: o.isDefault, isActive: o.isActive })),
});

export const validateGroup = (f: GroupForm): ValidationErrors => {
  const e: ValidationErrors = {};
  const name = f.name.trim();
  if (!name || name.length > 80) e.name = 'Name the group, e.g. “Choose your drink”';
  if (!f.options.length) e.options = 'Add at least one choice';
  if (f.options.length > MAX_OPTIONS) e.options = `Up to ${MAX_OPTIONS} choices`;
  f.options.forEach((o, i) => {
    if (!o.name.trim() || o.name.trim().length > 80) e[`options.${i}.name`] = 'Name the choice';
    const p = int(o.priceDelta);
    if (!Number.isFinite(p) || p > 100000) e[`options.${i}.priceDelta`] = 'Rs 0 or more';
  });
  if (f.minSelect > f.maxSelect) e.rule = 'Customers can’t be asked to pick more than they’re allowed';
  else if (f.maxSelect > f.options.length) e.rule = `There are only ${f.options.length} choices to pick from`;
  if (f.options.filter(o => o.isDefault).length > f.maxSelect) e.rule = 'More choices start ticked than customers may pick';
  return e;
};

export const groupInput = (f: GroupForm): OptionGroupInput => ({
  name: f.name.trim(),
  minSelect: f.minSelect,
  maxSelect: f.maxSelect,
  options: f.options.map(o => ({ ...(o.id ? { id: o.id } : null), name: o.name.trim(), priceDelta: int(o.priceDelta), isDefault: o.isDefault, isActive: o.isActive })),
});

/** "Required · pick 1", "Optional · up to 3", "Required · pick 2 to 4". */
export const groupRuleLabel = (g: Pick<OptionGroup, 'minSelect' | 'maxSelect'>): string => {
  if (g.minSelect >= 1) return g.minSelect === g.maxSelect ? `Required · pick ${g.minSelect}` : `Required · pick ${g.minSelect} to ${g.maxSelect}`;
  return g.maxSelect === 1 ? 'Optional · pick 1' : `Optional · up to ${g.maxSelect}`;
};

// ─── Off for a while (86) ─────────────────────────────
export type OffFor = '1h' | '2h' | 'today' | 'manual';

export const OFF_CHOICES: { key: OffFor; label: string }[] = [
  { key: '1h', label: 'For 1 hour' },
  { key: '2h', label: 'For 2 hours' },
  { key: 'today', label: 'Until tomorrow' },
  { key: 'manual', label: 'Until I switch it on' },
];

/**
 * When an "off for" choice ends, as an instant: an hour or two from now, or
 * the start of tomorrow in the kitchen's time zone; null means off until the
 * vendor switches it back.
 */
export const offUntil = (choice: OffFor, now: number, tomorrowStartIso: string): string | null => {
  if (choice === '1h') return new Date(now + 3_600_000).toISOString();
  if (choice === '2h') return new Date(now + 7_200_000).toISOString();
  if (choice === 'today') return tomorrowStartIso;
  return null;
};

// ─── Today (home kitchens) ────────────────────────────
export const MAX_PORTIONS = 5000;

// ─── Pre-order slots ──────────────────────────────────
export const MAX_SLOTS = 30;
export const CUTOFF_CHOICES = [60, 120, 180, 360, 1440];

export const cutoffLabel = (minutes: number): string =>
  minutes >= 1440 && minutes % 1440 === 0 ? `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before` : minutes >= 60 ? `${minutes / 60} h before` : `${minutes} min before`;

export interface SlotRow {
  weekday: number;
  slotStart: string;
  cutoffMinutesBefore: number;
  maxOrders: string;
}

export const slotRow = (s: PreorderSlot): SlotRow => ({ weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: String(s.maxOrders) });

export const validateSlots = (rows: SlotRow[]): ValidationErrors => {
  const e: ValidationErrors = {};
  if (rows.length > MAX_SLOTS) e.slots = `Up to ${MAX_SLOTS} slots a week`;
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!HHMM.test(r.slotStart)) e[`${i}.slotStart`] = 'Use HH:MM, e.g. 13:00';
    const n = int(r.maxOrders);
    if (!Number.isFinite(n) || n < 1 || n > 500) e[`${i}.maxOrders`] = '1 to 500 orders';
    const key = `${r.weekday}|${r.slotStart}`;
    if (seen.has(key)) e[`${i}.slotStart`] = 'Two slots at the same time';
    seen.add(key);
  });
  return e;
};

export const slotsInput = (rows: SlotRow[]): Omit<PreorderSlot, 'id'>[] =>
  rows.map(r => ({ weekday: r.weekday, slotStart: r.slotStart, cutoffMinutesBefore: r.cutoffMinutesBefore, maxOrders: int(r.maxOrders) }));
