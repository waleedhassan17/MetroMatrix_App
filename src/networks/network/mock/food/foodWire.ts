// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food rows → the API's shapes
// ═══════════════════════════════════════════════════════
// Exactly what the API's vendor and rider routes answer (the serializer
// fixture holds real responses; the parity test compares their keys).

import type { MockDb } from '../mockDb';
import { COMMUNITY_PLAN, LIVE_WINDOW_MS, activeRiders, isoNow, openState } from './foodLogic';
import { formatSlot } from '../../../../utils/healthTime';
import type { MockFoodVendor, MockRider, MockVendorAccount } from './foodTypes';

export const cuisineWire = (c: MockDb['food']['cuisines'][number]) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon });

export const profileWire = (db: MockDb, v: MockFoodVendor, now: number) => {
  const busy = v.busyUntil && Date.parse(v.busyUntil) > now;
  return {
    id: v.brandId,
    businessId: v.businessId,
    subType: v.kind,
    name: v.name,
    slug: v.slug,
    tagline: v.tagline,
    logoUrl: v.logoUrl,
    coverUrl: v.coverUrl,
    brandColor: v.brandColor,
    onBrandColor: v.onBrandColor,
    cuisines: v.cuisineIds
      .map(id => db.food.cuisines.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(cuisineWire),
    priceLevel: v.priceLevel,
    isHomeKitchen: v.kind === 'home_kitchen',
    ratingAvg: v.ratingAvg,
    ratingCount: v.ratingCount,
    branch: {
      id: v.branchId,
      status: v.status,
      isLive: v.status === 'active',
      wentLiveAt: v.wentLiveAt,
      foodSafetyCheckedAt: v.foodSafetyCheckedAt,
      isPaused: v.isPaused,
      pauseMessage: v.pauseMessage,
      busy: busy
        ? {
            extraMinutes: v.busyExtraMinutes,
            until: v.busyUntil,
            label: `Busy until ${formatSlot(v.busyUntil!, v.timezone)} (+${v.busyExtraMinutes} min)`,
          }
        : null,
      openState: openState(v, now),
    },
  };
};

export const settingsWire = (v: MockFoodVendor) => ({
  acceptsDelivery: v.acceptsDelivery,
  acceptsPickup: v.acceptsPickup,
  acceptsCod: v.acceptsCod,
  codLimit: v.codLimit,
  transferConfirmBeforePrep: v.transferConfirmBeforePrep,
  autoRejectMinutes: v.autoRejectMinutes,
  prepMinutes: v.prepMinutes,
  maxRadiusKm: v.maxRadiusKm,
  freeDeliveryOver: v.freeDeliveryOver,
  preorderOnly: v.preorderOnly,
  location: { addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng, phone: v.phone, timezone: v.timezone },
});

export const hoursWire = (v: MockFoodVendor) =>
  [...v.hours]
    .sort((a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt))
    .map(h => ({ weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt, overnight: h.closesAt <= h.opensAt }));

export const feeBandsWire = (v: MockFoodVendor) => [...v.feeBands].sort((a, b) => a.fromKm - b.fromKm).map(b => ({ ...b }));

export const closuresWire = (v: MockFoodVendor, now: number) =>
  v.closures
    .filter(c => Date.parse(c.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(c => ({ id: c.id, startsAt: c.startsAt, endsAt: c.endsAt, reason: c.reason }));

export const accountWire = (a: MockVendorAccount) => ({ ...a });

export const planWire = (db: MockDb, v: MockFoodVendor) => ({
  ...COMMUNITY_PLAN,
  limits: { ...COMMUNITY_PLAN.limits },
  usage: { brands: 1, branches: 1, riders: activeRiders(db, v.businessId), menu_items: 0, promotions_active: 0 },
  entitlements: { ...COMMUNITY_PLAN.entitlements },
  startedAt: v.planStartedAt,
  expiresAt: null,
  overrides: {},
});

export const riderWire = (db: MockDb, r: MockRider, now: number) => ({
  id: r.id,
  fullName: r.fullName,
  phone: r.phone,
  vehicle: r.vehicle,
  status: r.status,
  onDuty: r.onDuty,
  username: db.users.find(u => u.id === r.userId)?.username ?? null,
  activeOrderCount: r.activeOrderCount,
  lastGeo: r.lastGeo ? { ...r.lastGeo } : null,
  locationUpdatedAt: r.locationUpdatedAt,
  locationLive: !!r.locationUpdatedAt && now - Date.parse(r.locationUpdatedAt) < LIVE_WINDOW_MS,
  createdAt: r.createdAt,
});

export const riderMeWire = (db: MockDb, r: MockRider, v: MockFoodVendor, now: number) => ({
  rider: riderWire(db, r, now),
  vendor: { id: v.brandId, name: v.name, logoUrl: v.logoUrl, phone: v.phone, addressLine: v.addressLine, area: v.area, city: v.city },
});

export { isoNow };
