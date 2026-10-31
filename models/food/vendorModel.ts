// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor rules (instant feedback; the API decides)
// ═══════════════════════════════════════════════════════
// The vendor app's forms: the brand, how the branch works, opening hours,
// delivery fee bands, closures, the go-live checklist and riders. Limits
// mirror the Food API's DTOs so a form never sends what the server refuses.
// Every limit is the API's own (food/vendor/dto/vendor.dto.ts).

import type { FeeBand, HoursRange, KitchenKind, RiderInput, RiderStatus, VendorProfileInput, VendorSettings, VendorSetupKey } from '../food';
import { brandContrast } from '../shopping/storeModel';
import { isValidPkMobile, isValidPkPhone, PK_MOBILE_MESSAGE } from '../../utils/phone/phone';

export type ValidationErrors = Record<string, string>;

export const KITCHEN_KIND_NAME: Record<KitchenKind, string> = {
  restaurant: 'Restaurant',
  home_kitchen: 'Home kitchen',
  cloud_kitchen: 'Cloud kitchen',
};

// ─── The brand ────────────────────────────────────────
export const MAX_CUISINES = 3;
export const PRICE_LEVELS = [
  { value: 1, label: 'Rs', hint: 'Everyday' },
  { value: 2, label: 'Rs Rs', hint: 'Mid-range' },
  { value: 3, label: 'Rs Rs Rs', hint: 'Premium' },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface VendorBrandForm {
  name: string;
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  cuisineIds: string[];
  priceLevel: number;
  brandColor: string;
}

export const validateVendorBrand = (f: VendorBrandForm): ValidationErrors => {
  const e: ValidationErrors = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 120) e.name = 'Use 2 to 120 characters';
  if (f.tagline.trim().length > 140) e.tagline = 'Keep it under 140 characters';
  if (!f.logoUrl) e.logoUrl = 'Add your logo — customers see it on every card';
  if (f.cuisineIds.length < 1) e.cuisineIds = 'Pick at least one cuisine';
  else if (f.cuisineIds.length > MAX_CUISINES) e.cuisineIds = `Pick up to ${MAX_CUISINES}`;
  if (!HEX.test(f.brandColor)) e.brandColor = 'Use a colour like #B45309';
  else if (!brandContrast(f.brandColor, '#FFFFFF').passes && !brandContrast(f.brandColor, '#111827').passes) {
    e.brandColor = 'Text on this colour is hard to read. Pick a darker or lighter shade.';
  }
  return e;
};

/** Only what changed, as the API's PATCH body. */
export const brandPatch = (f: VendorBrandForm): VendorProfileInput => ({
  name: f.name.trim(),
  tagline: f.tagline.trim() || null,
  logoUrl: f.logoUrl,
  coverUrl: f.coverUrl,
  cuisineIds: f.cuisineIds,
  priceLevel: f.priceLevel,
  brandColor: f.brandColor.toUpperCase(),
});

// ─── How the branch works ────────────────────────────
export const AUTO_REJECT_CHOICES = [3, 5, 7, 10];
export const PREP_CHOICES = [10, 15, 20, 30, 45, 60];

export interface VendorSettingsForm {
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  acceptsCod: boolean;
  codLimit: string;
  transferConfirmBeforePrep: boolean;
  autoRejectMinutes: number;
  prepMinutes: string;
  maxRadiusKm: string;
  freeDeliveryOver: string;
  preorderOnly: boolean;
  addressLine: string;
  area: string;
  city: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

export const settingsForm = (s: VendorSettings): VendorSettingsForm => ({
  acceptsDelivery: s.acceptsDelivery,
  acceptsPickup: s.acceptsPickup,
  acceptsCod: s.acceptsCod,
  codLimit: String(s.codLimit),
  transferConfirmBeforePrep: s.transferConfirmBeforePrep,
  autoRejectMinutes: s.autoRejectMinutes,
  prepMinutes: String(s.prepMinutes),
  maxRadiusKm: String(s.maxRadiusKm),
  freeDeliveryOver: s.freeDeliveryOver === null ? '' : String(s.freeDeliveryOver),
  preorderOnly: s.preorderOnly,
  addressLine: s.location.addressLine,
  area: s.location.area ?? '',
  city: s.location.city,
  phone: s.location.phone ?? '',
  lat: s.location.lat,
  lng: s.location.lng,
});

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
const dec = (s: string) => (/^\d+(\.\d{1,2})?$/.test(s.trim()) ? Number(s.trim()) : NaN);

export const validateVendorSettings = (f: VendorSettingsForm): ValidationErrors => {
  const e: ValidationErrors = {};
  if (!f.acceptsDelivery && !f.acceptsPickup) e.fulfilment = 'Offer delivery, pick-up or both';
  const cod = int(f.codLimit);
  if (f.acceptsCod && (!Number.isFinite(cod) || cod > 200000)) e.codLimit = 'Rs 0 to Rs 200,000';
  const prep = int(f.prepMinutes);
  if (!Number.isFinite(prep) || prep < 5 || prep > 180) e.prepMinutes = '5 to 180 minutes';
  const radius = dec(f.maxRadiusKm);
  if (!Number.isFinite(radius) || radius < 0.5 || radius > 50) e.maxRadiusKm = '0.5 to 50 km';
  if (f.freeDeliveryOver.trim()) {
    const free = int(f.freeDeliveryOver);
    if (!Number.isFinite(free) || free > 200000) e.freeDeliveryOver = 'Rs 0 to Rs 200,000, or leave it empty';
  }
  const address = f.addressLine.trim();
  if (address.length < 5 || address.length > 255) e.addressLine = 'Enter the street address';
  if (f.area.trim() && (f.area.trim().length < 2 || f.area.trim().length > 80)) e.area = 'Use 2 to 80 characters';
  if (f.city.trim().length < 2 || f.city.trim().length > 60) e.city = 'Enter the city';
  if (!isValidPkPhone(f.phone)) e.phone = 'Enter a Pakistani mobile or landline number';
  if (f.lat === null || f.lng === null) e.pin = 'Drop the pin on your kitchen';
  return e;
};

export const settingsPatch = (f: VendorSettingsForm) => ({
  acceptsDelivery: f.acceptsDelivery,
  acceptsPickup: f.acceptsPickup,
  acceptsCod: f.acceptsCod,
  ...(f.acceptsCod ? { codLimit: int(f.codLimit) } : null),
  transferConfirmBeforePrep: f.transferConfirmBeforePrep,
  autoRejectMinutes: f.autoRejectMinutes,
  prepMinutes: int(f.prepMinutes),
  maxRadiusKm: dec(f.maxRadiusKm),
  freeDeliveryOver: f.freeDeliveryOver.trim() ? int(f.freeDeliveryOver) : null,
  preorderOnly: f.preorderOnly,
  addressLine: f.addressLine.trim(),
  ...(f.area.trim() ? { area: f.area.trim() } : null),
  city: f.city.trim(),
  phone: f.phone.trim(),
  ...(f.lat !== null && f.lng !== null ? { lat: Number(f.lat.toFixed(6)), lng: Number(f.lng.toFixed(6)) } : null),
});

// ─── Opening hours ────────────────────────────────────
/** Shown Monday first; the API counts 0 = Sunday. */
export const WEEK: { weekday: number; label: string; short: string }[] = [
  { weekday: 1, label: 'Monday', short: 'Mon' },
  { weekday: 2, label: 'Tuesday', short: 'Tue' },
  { weekday: 3, label: 'Wednesday', short: 'Wed' },
  { weekday: 4, label: 'Thursday', short: 'Thu' },
  { weekday: 5, label: 'Friday', short: 'Fri' },
  { weekday: 6, label: 'Saturday', short: 'Sat' },
  { weekday: 0, label: 'Sunday', short: 'Sun' },
];

/** At most this many ranges a day (lunch, dinner, a late window). */
export const MAX_RANGES_PER_DAY = 4;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "18:00" → "6:00 PM"; "24:00" and "00:00" → "midnight". */
export const time12 = (hhmm: string): string => {
  if (hhmm === '24:00' || hhmm === '00:00') return 'midnight';
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "6:00 PM – 2:00 AM (next day)". */
export const rangeLabel = (r: Pick<HoursRange, 'opensAt' | 'closesAt'>): string => {
  const overnight = r.closesAt !== '24:00' && minutes(r.closesAt) <= minutes(r.opensAt);
  return `${time12(r.opensAt)} – ${time12(r.closesAt)}${overnight ? ' (next day)' : ''}`;
};

/** A range's span within the week, in minutes from Sunday 00:00 (overnight runs into the next day). */
const span = (r: Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>) => {
  const start = r.weekday * 1440 + minutes(r.opensAt);
  const close = r.closesAt === '24:00' ? 1440 : minutes(r.closesAt);
  const end = r.weekday * 1440 + (close <= minutes(r.opensAt) ? close + 1440 : close);
  return [start, end] as const;
};

/** Field errors keyed `weekday.index.opensAt|closesAt`, plus `weekday.index.overlap`. */
export const validateHours = (ranges: Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>[]): ValidationErrors => {
  const e: ValidationErrors = {};
  const counts: Record<number, number> = {};
  ranges.forEach((r, i) => {
    const key = `${r.weekday}.${(counts[r.weekday] = (counts[r.weekday] ?? -1) + 1)}`;
    if (!HHMM.test(r.opensAt)) e[`${key}.opensAt`] = 'Use HH:MM, e.g. 12:00';
    if (!CLOSE.test(r.closesAt)) e[`${key}.closesAt`] = 'Use HH:MM, e.g. 23:30';
    if (HHMM.test(r.opensAt) && CLOSE.test(r.closesAt) && r.opensAt === r.closesAt) e[`${key}.closesAt`] = 'Opening and closing can’t be the same';
    void i;
  });
  if (Object.keys(e).length) return e;
  // Overlaps across the whole week, overnight ranges included (Saturday night into Sunday wraps).
  const WEEK_MIN = 7 * 1440;
  const spans = ranges.map((r, i) => ({ i, r, s: span(r) }));
  for (let a = 0; a < spans.length; a++) {
    for (let b = a + 1; b < spans.length; b++) {
      const [s1, e1] = spans[a].s;
      for (const shift of [0, WEEK_MIN, -WEEK_MIN]) {
        const [s2, e2] = [spans[b].s[0] + shift, spans[b].s[1] + shift];
        if (s1 < e2 && s2 < e1) {
          const day = WEEK.find(w => w.weekday === spans[b].r.weekday)?.label ?? 'that day';
          e.overlap = `Two ranges overlap on ${day}`;
        }
      }
    }
  }
  return e;
};

// ─── Delivery fee bands ──────────────────────────────
export const MAX_FEE_BANDS = 6;

export interface FeeBandForm {
  toKm: string;
  fee: string;
  minOrder: string;
}

/** Bands start at 0 km and follow each other: each starts where the one before ended. */
export const bandsFromForm = (rows: FeeBandForm[]): FeeBand[] => {
  let from = 0;
  return rows.map(r => {
    const band = { fromKm: from, toKm: dec(r.toKm), fee: int(r.fee), minOrder: int(r.minOrder) };
    from = Number.isFinite(band.toKm) ? band.toKm : from;
    return band;
  });
};

export const feeBandForm = (b: FeeBand): FeeBandForm => ({ toKm: String(b.toKm), fee: String(b.fee), minOrder: String(b.minOrder) });

export const validateFeeBands = (rows: FeeBandForm[], maxRadiusKm: number): ValidationErrors => {
  const e: ValidationErrors = {};
  if (!rows.length) e.bands = 'Add at least one band';
  if (rows.length > MAX_FEE_BANDS) e.bands = `Up to ${MAX_FEE_BANDS} bands`;
  let from = 0;
  rows.forEach((r, i) => {
    const to = dec(r.toKm);
    if (!Number.isFinite(to) || to <= from || to > 50) e[`${i}.toKm`] = `More than ${from} km, up to 50`;
    else if (to > maxRadiusKm) e[`${i}.toKm`] = `Your delivery radius is ${maxRadiusKm} km`;
    const fee = int(r.fee);
    if (!Number.isFinite(fee) || fee > 5000) e[`${i}.fee`] = 'Rs 0 to Rs 5,000';
    const min = int(r.minOrder);
    if (!Number.isFinite(min) || min > 50000) e[`${i}.minOrder`] = 'Rs 0 to Rs 50,000';
    if (Number.isFinite(to)) from = to;
  });
  return e;
};

// ─── Going live ───────────────────────────────────────
export interface SetupTarget {
  name: string;
  params?: object;
}

/** Where each checklist step is fixed (null: MetroMatrix does it). */
export const SETUP_ROUTE: Record<string, SetupTarget | null> = {
  profile: { name: 'VendorBrand' },
  location: { name: 'VendorSettings' },
  hours: { name: 'VendorHours' },
  zones: { name: 'VendorZones' },
  payment: { name: 'VendorSettings' },
  food_safety: null,
  menu: { name: 'VendorTabs', params: { screen: 'MenuTab' } },
  portions: { name: 'VendorTabs', params: { screen: 'TodayTab' } },
  slots: { name: 'VendorPreorderSlots' },
};

/** The menu and the riders: tabs, except for a home kitchen (Today · Orders · Kitchen · More), where they are pages. */
export const menuPlace = (homeKitchen: boolean): SetupTarget => (homeKitchen ? { name: 'VendorMenuPage' } : { name: 'VendorTabs', params: { screen: 'MenuTab' } });
export const ridersPlace = (homeKitchen: boolean): SetupTarget => (homeKitchen ? { name: 'VendorRidersPage' } : { name: 'VendorTabs', params: { screen: 'RidersTab' } });

export const setupRoute = (key: VendorSetupKey, homeKitchen = false): SetupTarget | null => (key === 'menu' ? menuPlace(homeKitchen) : (SETUP_ROUTE[key] ?? null));

/** Short names for the checklist rows (the API's own label is the fallback for a step the app doesn't know yet). */
export const SETUP_TITLE: Record<string, string> = {
  profile: 'Your brand',
  location: 'Address, pin and phone',
  hours: 'Opening hours',
  zones: 'Delivery zones',
  payment: 'A way to be paid',
  food_safety: 'Food-safety check',
  menu: 'Your menu',
  portions: 'Today’s portions',
  slots: 'Pre-order slots',
};

export const setupTitle = (key: VendorSetupKey, apiLabel: string) => SETUP_TITLE[key] ?? apiLabel;

// ─── Riders ───────────────────────────────────────────
export const RIDER_VEHICLES: { key: string; label: string }[] = [
  { key: 'bike', label: 'Motorbike' },
  { key: 'bicycle', label: 'Bicycle' },
  { key: 'car', label: 'Car' },
  { key: 'on_foot', label: 'On foot' },
];

export const riderVehicleLabel = (v: string | null) => RIDER_VEHICLES.find(x => x.key === v)?.label ?? 'Motorbike';

export const RIDER_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  on_leave: 'On leave',
  inactive: 'Inactive',
  plan_locked: 'Over your plan',
};

export const riderStatusLabel = (s: RiderStatus) => RIDER_STATUS_LABEL[s] ?? 'Inactive';

export const validateRider = (r: RiderInput): ValidationErrors => {
  const e: ValidationErrors = {};
  const name = r.fullName.trim();
  if (name.length < 2 || name.length > 80) e.fullName = 'Enter the rider’s name';
  if (r.phone && !isValidPkMobile(r.phone)) e.phone = PK_MOBILE_MESSAGE;
  return e;
};

/** "12-C Main Boulevard, Gulberg III, Lahore": each part once (an address line often has the area in it already). */
export const placeLine = (...parts: (string | null | undefined)[]) =>
  parts.filter((p, i, all): p is string => !!p && !all.slice(0, i).some(q => q?.toLowerCase().includes(p.toLowerCase()))).join(', ');
