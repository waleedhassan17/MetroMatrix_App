// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food rules
// ═══════════════════════════════════════════════════════
// The API's rules for a vendor's own setup, ported so the dummy API answers
// as the real one does: open now / opens next (overnight ranges, closures,
// pause), the go-live checklist, the Community plan, brand-colour contrast,
// payment-account numbers, and rider usernames and passwords.
// Taken from the API's services (docs/API_FOOD.md).

import { ShopError } from '../shop/shopLogic';
import type { MockBusiness, MockDb } from '../mockDb';
import { addDays, dateInZone, formatSlot, zonedToIso } from '../../../../utils/health-time/healthTime';
import type { MockFoodVendor, MockHoursRow, MockItemOverride, MockKitchenKind, MockMenuItem, MockPlanEntitlementKey, MockPlanLimitKey } from './foodTypes';

export class FoodError extends ShopError {}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const MAX_RANGES_PER_DAY = 4;
export const MAX_FEE_BANDS = 6;
export const MAX_ACTIVE_ACCOUNTS = 4;
export const MAX_BUSY_MS = 6 * HOUR;
export const LIVE_WINDOW_MS = 2 * MINUTE;

export const isoNow = (now: number) => new Date(now).toISOString();

export const nextId = (db: MockDb, prefix: string) => {
  db.food.seq += 1;
  return `${prefix}_${db.food.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

/** 400 VALIDATION_FAILED with `details.fields` (and any extra details). */
export const invalid = (field: string, message: string, extra: Record<string, unknown> = {}) =>
  new FoodError(400, 'VALIDATION_FAILED', message, { fields: { [field]: [message] }, ...extra });

export const notFound = (what: string) => new FoodError(404, 'NOT_FOUND', `${what} not found.`);

export const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// ─── Brand colour (AA for the text painted on it) ─────
const WHITE = '#FFFFFF';
const INK = '#16151A';
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** White or ink on the brand colour — whichever reads better — or null when neither reaches 4.5:1. */
export const onBrandColor = (brandColor: string): string | null => {
  const white = contrast(brandColor, WHITE);
  const ink = contrast(brandColor, INK);
  const best = white >= ink ? { color: WHITE, ratio: white } : { color: INK, ratio: ink };
  return best.ratio >= 4.5 ? best.color : null;
};

// ─── Payment account numbers ─────────────────────────
const PK_IBAN = /^PK\d{2}[A-Z]{4}\d{16}$/;

const ibanChecksumOk = (iban: string) => {
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
};

export const normalizeAccountNumber = (kind: string, raw: string): { ok: true; value: string } | { ok: false; reason: string } => {
  if (kind === 'bank') {
    const iban = raw.replace(/\s+/g, '').toUpperCase();
    if (!PK_IBAN.test(iban)) return { ok: false, reason: 'Enter a 24-character Pakistani IBAN (PK00 ABCD 0000 0000 0000 0000).' };
    if (!ibanChecksumOk(iban)) return { ok: false, reason: 'That IBAN has a typo — its check digits do not match.' };
    return { ok: true, value: iban };
  }
  const digits = raw.replace(/[^\d+]/g, '');
  const phone = digits.startsWith('+92') ? digits : digits.startsWith('92') ? `+${digits}` : digits.startsWith('0') ? `+92${digits.slice(1)}` : digits;
  if (!/^\+923\d{9}$/.test(phone)) {
    const label = kind === 'raast' ? 'Raast ID' : kind === 'jazzcash' ? 'JazzCash' : 'Easypaisa';
    return { ok: false, reason: `Enter the ${label} mobile number (e.g. 0312 3456789).` };
  }
  return { ok: true, value: phone };
};

// ─── Hours ───────────────────────────────────────────
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
export const isHhmm = (v: unknown) => typeof v === 'string' && HHMM.test(v);
export const toMinutes = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

interface Range {
  weekday: number;
  opens: number;
  closes: number;
}

const rangesOf = (rows: MockHoursRow[]): Range[] =>
  rows.map(r => ({ weekday: r.weekday, opens: toMinutes(r.opensAt), closes: toMinutes(r.closesAt) }));

/** Two ranges in the week (overnight spill included) may not overlap. */
export const overlappingRanges = (rows: MockHoursRow[]): [Range, Range] | null => {
  const spans = rangesOf(rows).map(h => ({
    h,
    start: h.weekday * 1440 + h.opens,
    end: h.weekday * 1440 + (h.closes > h.opens ? h.closes : h.closes + 1440),
  }));
  const week = 7 * 1440;
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      for (const shift of [-week, 0, week]) {
        if (spans[i].start < spans[j].end + shift && spans[j].start + shift < spans[i].end) return [spans[i].h, spans[j].h];
      }
    }
  }
  return null;
};

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const minutesToHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface Interval {
  start: number;
  end: number;
}

/** Open stretches from yesterday to `days` ahead, closures cut out, touching ones merged. */
export const openIntervals = (v: Pick<MockFoodVendor, 'hours' | 'closures' | 'timezone'>, now: number, days = 7): Interval[] => {
  const today = dateInZone(isoNow(now), v.timezone);
  const raw: Interval[] = [];
  for (let i = -1; i <= days; i++) {
    const date = addDays(today, i);
    for (const r of rangesOf(v.hours).filter(h => h.weekday === weekdayOf(date))) {
      const end = r.closes > r.opens ? r.closes : r.closes + 1440;
      const start = Date.parse(zonedToIso(date, minutesToHhmm(r.opens), v.timezone));
      const endAt = end >= 1440 ? Date.parse(zonedToIso(addDays(date, 1), minutesToHhmm(end - 1440), v.timezone)) : Date.parse(zonedToIso(date, minutesToHhmm(end), v.timezone));
      if (endAt > start) raw.push({ start, end: endAt });
    }
  }
  raw.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  let out = merged;
  for (const c of v.closures.map(x => ({ start: Date.parse(x.startsAt), end: Date.parse(x.endsAt) }))) {
    const next: Interval[] = [];
    for (const iv of out) {
      if (c.end <= iv.start || c.start >= iv.end) {
        next.push(iv);
        continue;
      }
      if (c.start > iv.start) next.push({ start: iv.start, end: c.start });
      if (c.end < iv.end) next.push({ start: c.end, end: iv.end });
    }
    out = next;
  }
  return out;
};

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayWord = (at: number, tz: string, now: number) => {
  const d = dateInZone(isoNow(at), tz);
  const today = dateInZone(isoNow(now), tz);
  if (d === today) return '';
  if (d === addDays(today, 1)) return 'tomorrow ';
  return `${NAMES[weekdayOf(d)]} `;
};

/** The API's openState: "Open until 2:00 AM" · "Opens tomorrow 12:00 PM" · "Closed" · the pause message. */
export const openState = (v: MockFoodVendor, now: number) => {
  const intervals = openIntervals(v, now);
  const current = intervals.find(iv => iv.start <= now && now < iv.end);
  const next = intervals.find(iv => iv.start > now) ?? null;
  if (v.isPaused) {
    return { open: false, paused: true, closesAt: null, opensAt: null, label: v.pauseMessage?.trim() || 'Not taking orders right now' };
  }
  if (current) {
    return { open: true, paused: false, closesAt: isoNow(current.end), opensAt: null, label: `Open until ${formatSlot(isoNow(current.end), v.timezone)}` };
  }
  return {
    open: false,
    paused: false,
    closesAt: null,
    opensAt: next ? isoNow(next.start) : null,
    label: next ? `Opens ${dayWord(next.start, v.timezone, now)}${formatSlot(isoNow(next.start), v.timezone)}` : 'Closed',
  };
};

// ─── The go-live checklist ───────────────────────────
interface Check {
  key: string;
  label: string;
  kinds?: MockKitchenKind[];
  applies?: (v: MockFoodVendor, db: MockDb) => boolean;
  done: (v: MockFoodVendor, db: MockDb) => boolean;
}

const CHECKS: Check[] = [
  { key: 'profile', label: 'Brand name, logo and at least one cuisine', done: v => !!v.logoUrl && v.cuisineIds.length > 0 },
  { key: 'location', label: 'Address, map pin and phone', done: v => v.lat !== null && v.lng !== null && !!v.addressLine && !!v.phone },
  { key: 'hours', label: 'Opening hours', done: v => v.hours.length > 0 },
  { key: 'zones', label: 'Delivery fee bands', applies: v => v.acceptsDelivery, done: v => v.feeBands.length > 0 },
  {
    key: 'payment',
    label: 'A way to be paid: cash, pay at pickup, or a transfer account',
    done: v => (v.acceptsCod && v.acceptsDelivery) || v.acceptsPickup || v.accounts.some(a => a.isActive),
  },
  {
    key: 'food_safety',
    label: 'MetroMatrix food-safety check (after a test order)',
    kinds: ['home_kitchen'],
    done: v => !!v.foodSafetyCheckedAt,
  },
  {
    key: 'menu',
    label: 'At least one dish on the menu',
    done: (v, db) => db.food.items.some(i => i.businessId === v.businessId && i.isActive && db.food.categories.some(c => c.id === i.categoryId && c.isActive)),
  },
  {
    key: 'portions',
    label: 'Today’s portions for at least one dish',
    kinds: ['home_kitchen'],
    applies: v => !v.preorderOnly,
    done: (v, db) => db.food.items.some(i => i.businessId === v.businessId && i.override?.dailyLimit != null),
  },
  {
    key: 'slots',
    label: 'Pre-order slots',
    kinds: ['home_kitchen'],
    applies: v => v.preorderOnly,
    done: (v, db) => db.food.slots.some(s => s.businessId === v.businessId),
  },
];

export const setupOf = (v: MockFoodVendor, db: MockDb) => {
  const items = CHECKS.filter(c => !c.kinds || c.kinds.includes(v.kind)).map(c => ({
    key: c.key,
    label: c.label,
    required: c.applies ? c.applies(v, db) : true,
    done: c.done(v, db),
  }));
  const required = items.filter(i => i.required);
  const done = required.filter(i => i.done).length;
  return {
    subType: v.kind,
    items,
    percent: required.length ? Math.round((done / required.length) * 100) : 100,
    missing: required.filter(i => !i.done).map(i => i.key),
    ready: done === required.length,
    isLive: v.status === 'active',
  };
};

// ─── The Community plan ──────────────────────────────
export const COMMUNITY_PLAN = {
  planKey: 'community',
  label: 'Community',
  priceMinorUnits: 0,
  currency: 'PKR',
  limits: { brands: 1, branches: 1, riders: 25, menu_items: 1000, promotions_active: 10 },
  entitlements: { riders: true, promotions: true, insights: true, preorders: true },
};

export const activeRiders = (db: MockDb, businessId: string, exceptId?: string) =>
  db.food.riders.filter(r => r.businessId === businessId && r.status === 'active' && r.id !== exceptId).length;

/** The vendor's plan: Community, with staff overrides merged on top (limits and entitlements only). */
export const planOf = (v: MockFoodVendor) => {
  const o = v.planOverrides ?? {};
  const limits = { ...COMMUNITY_PLAN.limits };
  for (const k of Object.keys(limits) as MockPlanLimitKey[]) if (Number.isInteger(o.limits?.[k])) limits[k] = o.limits![k]!;
  const entitlements = { ...COMMUNITY_PLAN.entitlements };
  for (const k of Object.keys(entitlements) as MockPlanEntitlementKey[]) if (typeof o.entitlements?.[k] === 'boolean') entitlements[k] = o.entitlements![k]!;
  return { ...COMMUNITY_PLAN, limits, entitlements };
};

const LIMIT_LABELS: Record<MockPlanLimitKey, string> = {
  brands: 'brand',
  branches: 'branch',
  riders: 'active rider',
  menu_items: 'menu item',
  promotions_active: 'active promotion',
};

/** 409 PLAN_LIMIT_REACHED {key, limit, used, planKey} when the plan has no room. */
export const assertWithinPlan = (v: MockFoodVendor, key: MockPlanLimitKey, wanted: number) => {
  const plan = planOf(v);
  const limit = plan.limits[key];
  if (wanted > limit) {
    throw new FoodError(409, 'PLAN_LIMIT_REACHED', `Your ${plan.label} plan allows ${limit} ${LIMIT_LABELS[key]}${limit === 1 ? '' : 's'}.`, {
      key,
      limit,
      used: wanted - 1,
      planKey: plan.planKey,
    });
  }
};

/** 409 PLAN_LIMIT_REACHED {entitlement} when the plan doesn't include it (every one is on in Community). */
export const assertEntitled = (v: MockFoodVendor, key: MockPlanEntitlementKey) => {
  const plan = planOf(v);
  if (!plan.entitlements[key]) {
    throw new FoodError(409, 'PLAN_LIMIT_REACHED', `Your ${plan.label} plan doesn't include ${key}.`, { entitlement: key, planKey: plan.planKey });
  }
};

// ─── Riders ──────────────────────────────────────────
const slugifyName = (raw: string) =>
  raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** `<brand-slug>.<first-name>` (then 2, 3… on a clash), as the API builds it. */
export const riderUsername = (db: MockDb, brandSlug: string, fullName: string) => {
  const code =
    brandSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24)
      .replace(/-$/, '') || 'rider';
  const who = slugifyName(fullName.trim().split(/\s+/)[0] ?? '') || 'rider';
  let base = `${code}.${who}`.slice(0, 58).replace(/[._-]+$/, '');
  while (base.length < 3) base += '0';
  for (let n = 1; n <= 1000; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    if (!db.users.some(u => u.username === candidate)) return candidate;
  }
  throw new Error('No free rider username.');
};

export const riderEmail = (username: string) => `${username}@riders.metromatrix.invalid`;

/** 10 characters with a lower-case letter, an upper-case letter and a digit; no look-alikes. */
export const riderPassword = () => {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digit = '23456789';
  const all = lower + upper + digit;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(lower), pick(upper), pick(digit), ...Array.from({ length: 7 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

// ─── The vendor row ──────────────────────────────────
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'kitchen';

export const KITCHEN_KINDS: MockKitchenKind[] = ['restaurant', 'home_kitchen', 'cloud_kitchen'];

/** A fresh brand + draft branch for an approved food business (the API's ensureForBusiness). */
export const newVendor = (db: MockDb, b: MockBusiness, now: number): MockFoodVendor => {
  const kind = (KITCHEN_KINDS as string[]).includes(b.subType) ? (b.subType as MockKitchenKind) : 'restaurant';
  let slug = slugify(b.name);
  if (db.food.vendors.some(v => v.slug === slug)) slug = `${slug}-${b.id.slice(-4)}`;
  return {
    businessId: b.id,
    ownerId: b.ownerId,
    kind,
    brandId: nextId(db, 'fb'),
    name: b.name,
    slug,
    tagline: null,
    logoUrl: null,
    coverUrl: null,
    brandColor: '#B4532A',
    onBrandColor: '#FFFFFF',
    cuisineIds: [],
    priceLevel: 2,
    ratingAvg: 0,
    ratingCount: 0,
    branchId: nextId(db, 'br'),
    status: 'draft',
    wentLiveAt: null,
    foodSafetyCheckedAt: null,
    isPaused: false,
    pauseMessage: null,
    busyUntil: null,
    busyExtraMinutes: 0,
    acceptsDelivery: true,
    acceptsPickup: kind !== 'cloud_kitchen',
    acceptsCod: true,
    codLimit: 10000,
    transferConfirmBeforePrep: true,
    autoRejectMinutes: 5,
    prepMinutes: 20,
    maxRadiusKm: 5,
    freeDeliveryOver: null,
    preorderOnly: false,
    addressLine: b.address || null,
    area: null,
    city: b.city || null,
    lat: b.location?.lat ?? null,
    lng: b.location?.lng ?? null,
    phone: b.phone || null,
    timezone: 'Asia/Karachi',
    hours: [],
    feeBands: [],
    closures: [],
    accounts: [],
    planStartedAt: isoNow(now),
  };
};

/** The vendor row of a food business, made on first use (as the API does for older approvals). */
export const ensureVendor = (db: MockDb, b: MockBusiness, now: number): MockFoodVendor => {
  let v = db.food.vendors.find(x => x.businessId === b.id);
  if (!v) {
    v = newVendor(db, b, now);
    db.food.vendors.push(v);
  }
  return v;
};

/** The session's `business.food` (approved or suspended food businesses only). */
export const foodSessionOf = (db: MockDb, b: MockBusiness, now: number) => {
  if (b.serviceType !== 'food' || (b.status !== 'approved' && b.status !== 'suspended')) return undefined;
  const v = ensureVendor(db, b, now);
  return { brandId: v.brandId, brandSlug: v.slug, branchStatus: v.status, isLive: v.status === 'active', setupComplete: setupOf(v, db).ready };
};

// ─── The menu ────────────────────────────────────────
export const ITEM_TAGS = ['spicy', 'veg', 'bestseller', 'new', 'contains_nuts'] as const;
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The kitchen's local date and weekday (0 = Sunday). */
export const kitchenToday = (v: Pick<MockFoodVendor, 'timezone'>, now: number) => {
  const date = dateInZone(isoNow(now), v.timezone);
  return { date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
};

/**
 * A dish's switches for today: what is left resets to the day's portions
 * the first time it is read on a new day (the API's nightly reset).
 */
export const overrideOf = (i: MockMenuItem, v: Pick<MockFoodVendor, 'timezone'>, now: number): MockItemOverride => {
  const o = i.override ?? { isAvailable: true, unavailableUntil: null, dailyLimit: null, remainingToday: null, portionsDate: null };
  const { date } = kitchenToday(v, now);
  if (o.dailyLimit !== null && o.portionsDate !== date) {
    o.remainingToday = o.dailyLimit;
    o.portionsDate = date;
  }
  if (i.override) i.override = o;
  return o;
};

/** On now: switched on, not off until a later time. */
export const isItemAvailable = (o: MockItemOverride, now: number) =>
  o.isAvailable && !(o.unavailableUntil && Date.parse(o.unavailableUntil) > now);

export const menuItemCount = (db: MockDb, businessId: string) => db.food.items.filter(i => i.businessId === businessId).length;
