// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor serializers (the vendor's own app)
// ═══════════════════════════════════════════════════════
// The Food API's vendor shapes → the app's (types/food.ts). Defensive: a
// missing field becomes a sensible default, never a crash.
// docs/API_FOOD.md §4.3 (setup, profile, settings, hours, zones, payment
// accounts, plan).

import type {
  FeeBand,
  FoodCuisine,
  FoodVendorSession,
  HoursRange,
  KitchenKind,
  OpenState,
  VendorBranch,
  VendorBusy,
  VendorClosure,
  VendorLocation,
  PlanOverrides,
  VendorPlan,
  VendorProfile,
  VendorSettings,
  VendorSetup,
  VendorSetupItem,
} from '../../types/food';
import type { PaymentAccount, PaymentAccountKind } from '../../types/payments';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';

export const KITCHEN_KINDS: readonly KitchenKind[] = ['restaurant', 'home_kitchen', 'cloud_kitchen'];
const ACCOUNT_KINDS: readonly PaymentAccountKind[] = ['raast', 'jazzcash', 'easypaisa', 'bank'];

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
};

export const foodCuisineSerializer = (raw: unknown): FoodCuisine | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.name)) return null;
  return { id: str(raw.id), name: str(raw.name), slug: str(raw.slug), icon: str(raw.icon, str(raw.slug)) };
};

export const foodCuisinesSerializer = (raw: unknown): FoodCuisine[] => compact(arr(raw).map(foodCuisineSerializer));

/** The session's `business.food` (vendors only). */
export const foodVendorSessionSerializer = (raw: unknown): FoodVendorSession | null => {
  if (!isObject(raw) || !str(raw.brandId)) return null;
  return {
    brandId: str(raw.brandId),
    brandSlug: str(raw.brandSlug),
    branchStatus: str(raw.branchStatus, 'draft'),
    isLive: bool(raw.isLive),
    setupComplete: bool(raw.setupComplete),
  };
};

const setupItemSerializer = (raw: unknown): VendorSetupItem | null => {
  if (!isObject(raw) || !str(raw.key)) return null;
  return { key: str(raw.key), label: str(raw.label, str(raw.key)), required: raw.required !== false, done: bool(raw.done) };
};

export const vendorSetupSerializer = (raw: unknown): VendorSetup | null => {
  if (!isObject(raw)) return null;
  const items = compact(arr(raw.items).map(setupItemSerializer));
  return {
    kind: oneOf(raw.subType, KITCHEN_KINDS, 'restaurant'),
    items,
    percent: Math.max(0, Math.min(100, Math.round(num(raw.percent)))),
    missing: arr(raw.missing).map(m => str(m)).filter(Boolean),
    ready: bool(raw.ready),
    isLive: bool(raw.isLive),
  };
};

export const openStateSerializer = (raw: unknown): OpenState => {
  const r = isObject(raw) ? raw : {};
  return {
    open: bool(r.open),
    paused: bool(r.paused),
    closesAt: isoOrNull(r.closesAt),
    opensAt: isoOrNull(r.opensAt),
    label: str(r.label, bool(r.open) ? 'Open' : 'Closed'),
  };
};

const busySerializer = (raw: unknown): VendorBusy | null => {
  if (!isObject(raw) || !num(raw.extraMinutes)) return null;
  return { extraMinutes: Math.round(num(raw.extraMinutes)), until: isoOrNull(raw.until), label: str(raw.label) };
};

const branchSerializer = (raw: unknown): VendorBranch => {
  const r = isObject(raw) ? raw : {};
  return {
    id: str(r.id),
    status: str(r.status, 'draft'),
    isLive: bool(r.isLive),
    wentLiveAt: isoOrNull(r.wentLiveAt),
    foodSafetyCheckedAt: isoOrNull(r.foodSafetyCheckedAt),
    isPaused: bool(r.isPaused),
    pauseMessage: strOrNull(r.pauseMessage),
    busy: busySerializer(r.busy),
    openState: openStateSerializer(r.openState),
  };
};

export const vendorProfileSerializer = (raw: unknown): VendorProfile | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    businessId: str(raw.businessId),
    kind: oneOf(raw.subType, KITCHEN_KINDS, 'restaurant'),
    name: str(raw.name),
    slug: str(raw.slug),
    tagline: strOrNull(raw.tagline),
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    brandColor: str(raw.brandColor),
    onBrandColor: str(raw.onBrandColor),
    cuisines: foodCuisinesSerializer(raw.cuisines),
    priceLevel: Math.max(1, Math.min(3, Math.round(num(raw.priceLevel, 2)))),
    isHomeKitchen: bool(raw.isHomeKitchen) || raw.subType === 'home_kitchen',
    ratingAvg: Math.max(0, num(raw.ratingAvg)),
    ratingCount: Math.max(0, Math.round(num(raw.ratingCount))),
    branch: branchSerializer(raw.branch),
  };
};

const locationSerializer = (raw: unknown): VendorLocation => {
  const r = isObject(raw) ? raw : {};
  return {
    addressLine: str(r.addressLine),
    area: strOrNull(r.area),
    city: str(r.city),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    phone: strOrNull(r.phone),
    timezone: str(r.timezone, 'Asia/Karachi'),
  };
};

export const vendorSettingsSerializer = (raw: unknown): VendorSettings | null => {
  if (!isObject(raw)) return null;
  return {
    acceptsDelivery: bool(raw.acceptsDelivery),
    acceptsPickup: bool(raw.acceptsPickup),
    acceptsCod: bool(raw.acceptsCod),
    codLimit: Math.max(0, Math.round(num(raw.codLimit))),
    transferConfirmBeforePrep: bool(raw.transferConfirmBeforePrep),
    autoRejectMinutes: Math.round(num(raw.autoRejectMinutes, 5)),
    prepMinutes: Math.round(num(raw.prepMinutes, 20)),
    maxRadiusKm: num(raw.maxRadiusKm, 5),
    freeDeliveryOver: numOrNull(raw.freeDeliveryOver),
    preorderOnly: bool(raw.preorderOnly),
    location: locationSerializer(raw.location),
  };
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

const hoursRangeSerializer = (raw: unknown): HoursRange | null => {
  if (!isObject(raw)) return null;
  const weekday = Math.round(num(raw.weekday, -1));
  const opensAt = str(raw.opensAt).slice(0, 5);
  const closesAt = str(raw.closesAt).slice(0, 5);
  if (weekday < 0 || weekday > 6 || !HHMM.test(opensAt) || !HHMM.test(closesAt)) return null;
  return { weekday, opensAt, closesAt, overnight: raw.overnight !== undefined ? bool(raw.overnight) : closesAt <= opensAt };
};

export const hoursSerializer = (raw: unknown): HoursRange[] =>
  compact(arr(raw).map(hoursRangeSerializer)).sort((a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt));

const feeBandSerializer = (raw: unknown): FeeBand | null => {
  if (!isObject(raw)) return null;
  const toKm = num(raw.toKm, NaN);
  if (!Number.isFinite(toKm)) return null;
  return { fromKm: Math.max(0, num(raw.fromKm)), toKm, fee: Math.max(0, Math.round(num(raw.fee))), minOrder: Math.max(0, Math.round(num(raw.minOrder))) };
};

export const feeBandsSerializer = (raw: unknown): FeeBand[] => compact(arr(raw).map(feeBandSerializer)).sort((a, b) => a.fromKm - b.fromKm);

const closureSerializer = (raw: unknown): VendorClosure | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const startsAt = isoOrNull(raw.startsAt);
  const endsAt = isoOrNull(raw.endsAt);
  if (!startsAt || !endsAt) return null;
  return { id: str(raw.id), startsAt, endsAt, reason: strOrNull(raw.reason) };
};

export const closuresSerializer = (raw: unknown): VendorClosure[] =>
  compact(arr(raw).map(closureSerializer)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/** The API's `{ accountTitle, accountNumber }` → the app's PaymentAccount (shared with stores and doctors). */
export const vendorPaymentAccountSerializer = (raw: unknown): PaymentAccount | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    kind: oneOf(raw.kind, ACCOUNT_KINDS, 'bank'),
    title: str(raw.accountTitle ?? raw.title),
    number: str(raw.accountNumber ?? raw.number),
    bankName: strOrNull(raw.bankName),
    isActive: raw.isActive !== false,
  };
};

export const vendorPaymentAccountsSerializer = (raw: unknown): PaymentAccount[] => compact(arr(raw).map(vendorPaymentAccountSerializer));

const counts = (raw: unknown): Record<string, number> =>
  isObject(raw) ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(0, Math.round(num(v)))])) : {};
const flags = (raw: unknown): Record<string, boolean> =>
  isObject(raw) ? Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => [k, v as boolean])) : {};
const overridesOf = (raw: unknown): PlanOverrides => {
  if (!isObject(raw)) return {};
  return {
    ...(isObject(raw.limits) ? { limits: counts(raw.limits) } : null),
    ...(isObject(raw.entitlements) ? { entitlements: flags(raw.entitlements) } : null),
  };
};

/** The plan, in rupees (the API counts in minor units). */
export const vendorPlanSerializer = (raw: unknown): VendorPlan | null => {
  if (!isObject(raw)) return null;
  return {
    key: str(raw.planKey, 'community'),
    label: str(raw.label, 'Community'),
    price: Math.round(num(raw.priceMinorUnits) / 100),
    limits: counts(raw.limits),
    usage: counts(raw.usage),
    entitlements: flags(raw.entitlements),
    overrides: overridesOf(raw.overrides),
    startedAt: isoOrNull(raw.startedAt),
  };
};
