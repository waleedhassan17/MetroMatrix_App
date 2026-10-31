// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food rows → the API's shapes
// ═══════════════════════════════════════════════════════
// Exactly what the API's vendor and rider routes answer (the serializer
// fixture holds real responses; the parity test compares their keys).

import type { MockDb } from '../mockDb';
import { LIVE_WINDOW_MS, planOf, activeRiders, isItemAvailable, isoNow, kitchenToday, menuItemCount, openState, overrideOf } from './foodLogic';
import { formatSlot } from '../../../../utils/health-time/healthTime';
import type { MockFoodVendor, MockMenuCategory, MockMenuItem, MockOptionGroup, MockPreorderSlot, MockRider, MockVendorAccount } from './foodTypes';
import { foodHooks } from './foodHooks';

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
      ...foodHooks.branchExtras(db, v, now),
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

export const planWire = (db: MockDb, v: MockFoodVendor) => {
  const plan = planOf(v);
  return {
    planKey: plan.planKey,
    label: plan.label,
    priceMinorUnits: plan.priceMinorUnits,
    currency: plan.currency,
    limits: plan.limits,
    usage: { brands: 1, branches: 1, riders: activeRiders(db, v.businessId), menu_items: menuItemCount(db, v.businessId), promotions_active: 0 },
    entitlements: plan.entitlements,
    startedAt: v.planStartedAt,
    expiresAt: null,
    overrides: v.planOverrides ?? {},
  };
};

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

// ─── The menu ────────────────────────────────────────
export const categoryWire = (db: MockDb, c: MockMenuCategory) => ({
  id: c.id,
  name: c.name,
  sort: c.sort,
  availableFrom: c.availableFrom,
  availableTo: c.availableTo,
  isActive: c.isActive,
  itemCount: db.food.items.filter(i => i.categoryId === c.id).length,
});

export const categoriesWire = (db: MockDb, v: MockFoodVendor) =>
  db.food.categories
    .filter(c => c.businessId === v.businessId)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map(c => categoryWire(db, c));

export const itemWire = (i: MockMenuItem) => ({
  id: i.id,
  categoryId: i.categoryId,
  name: i.name,
  description: i.description,
  photoUrl: i.photoUrl,
  basePrice: i.basePrice,
  tags: [...i.tags],
  isDeal: i.isDeal,
  serves: i.serves,
  days: [...i.days].sort((a, b) => a - b),
  isActive: i.isActive,
  sort: i.sort,
  sold30d: i.sold30d,
  variants: [...i.variants].sort((a, b) => a.sort - b.sort || a.price - b.price).map(x => ({ id: x.id, name: x.name, price: x.price })),
  optionGroups: [...i.links].sort((a, b) => a.sort - b.sort).map(l => ({ groupId: l.groupId, variantId: l.variantId, sort: l.sort })),
});

export const itemsWire = (db: MockDb, v: MockFoodVendor, categoryId?: string) =>
  db.food.items
    .filter(i => i.businessId === v.businessId && (!categoryId || i.categoryId === categoryId))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map(itemWire);

export const groupWire = (db: MockDb, g: MockOptionGroup) => ({
  id: g.id,
  name: g.name,
  minSelect: g.minSelect,
  maxSelect: g.maxSelect,
  required: g.minSelect >= 1,
  usedByItems: db.food.items.filter(i => i.links.some(l => l.groupId === g.id)).length,
  options: [...g.options].sort((a, b) => a.sort - b.sort).map(o => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isActive: o.isActive })),
});

export const groupsWire = (db: MockDb, v: MockFoodVendor) =>
  db.food.groups
    .filter(g => g.businessId === v.businessId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(g => groupWire(db, g));

const categorySort = (db: MockDb, id: string) => db.food.categories.find(c => c.id === id)?.sort ?? 0;

export const availabilityWire = (db: MockDb, v: MockFoodVendor, now: number) => ({
  items: db.food.items
    .filter(i => i.businessId === v.businessId)
    .sort((a, b) => categorySort(db, a.categoryId) - categorySort(db, b.categoryId) || a.sort - b.sort || a.name.localeCompare(b.name))
    .map(i => {
      const o = overrideOf(i, v, now);
      const until = o.unavailableUntil && Date.parse(o.unavailableUntil) > now ? o.unavailableUntil : null;
      return {
        itemId: i.id,
        name: i.name,
        category: db.food.categories.find(c => c.id === i.categoryId)?.name ?? '',
        isAvailable: isItemAvailable(o, now),
        unavailableUntil: until,
        dailyLimit: o.dailyLimit,
        remainingToday: o.remainingToday,
      };
    }),
  options: db.food.groups
    .filter(g => g.businessId === v.businessId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(g => [...g.options].sort((a, b) => a.sort - b.sort).map(o => ({ optionId: o.id, name: o.name, group: g.name, isAvailable: o.available }))),
});

export const todayWire = (db: MockDb, v: MockFoodVendor, now: number) => {
  const { date, weekday } = kitchenToday(v, now);
  return {
    date,
    weekday,
    items: db.food.items
      .filter(i => i.businessId === v.businessId)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map(i => {
        const o = overrideOf(i, v, now);
        const onDay = i.days.includes(weekday);
        return {
          itemId: i.id,
          name: i.name,
          onTodaysMenu: onDay,
          cooking: i.isActive && o.isAvailable && onDay,
          dailyLimit: o.dailyLimit,
          remainingToday: o.remainingToday,
          sold: o.dailyLimit !== null && o.remainingToday !== null ? o.dailyLimit - o.remainingToday : null,
        };
      }),
  };
};

export const slotsWire = (db: MockDb, v: MockFoodVendor) =>
  db.food.slots
    .filter(s => s.businessId === v.businessId)
    .sort((a, b) => a.weekday - b.weekday || a.slotStart.localeCompare(b.slotStart))
    .map((s: MockPreorderSlot) => ({ id: s.id, weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders }));

export const weeklyWire = (db: MockDb, v: MockFoodVendor) =>
  db.food.items
    .filter(i => i.businessId === v.businessId)
    .sort((a, b) => a.sort - b.sort)
    .map(i => ({ itemId: i.id, name: i.name, days: [...i.days].sort((a, b) => a - b) }));

export { kitchenToday };
