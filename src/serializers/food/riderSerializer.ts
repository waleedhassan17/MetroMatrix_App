// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider serializers (vendor's Riders, the rider's app)
// ═══════════════════════════════════════════════════════
// docs/API_FOOD.md §2 RiderOrder, §4.3 Riders and §4.4.

import type { FoodOrderStatus, FoodPaymentMethod, FoodPaymentStatus, FoodRider, LiveRider, RiderCash, RiderCredential, RiderHome, RiderOrder, RiderSuggestion } from '../../types/food';
import type { Paged } from '../../types/payments';
import { arr, bool, isObject, num, str, strOrNull } from '../serializerUtils';

const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
};

export const foodRiderSerializer = (raw: unknown): FoodRider | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const geo = isObject(raw.lastGeo) && Number.isFinite(Number(raw.lastGeo.lat)) && Number.isFinite(Number(raw.lastGeo.lng)) ? raw.lastGeo : null;
  return {
    id: str(raw.id),
    fullName: str(raw.fullName, 'Rider'),
    phone: strOrNull(raw.phone),
    vehicle: strOrNull(raw.vehicle),
    status: str(raw.status, 'active'),
    onDuty: bool(raw.onDuty),
    username: strOrNull(raw.username),
    activeOrderCount: Math.max(0, Math.round(num(raw.activeOrderCount))),
    lastPosition: geo ? { lat: Number(geo.lat), lng: Number(geo.lng) } : null,
    locationUpdatedAt: isoOrNull(raw.locationUpdatedAt),
    locationLive: bool(raw.locationLive),
    createdAt: isoOrNull(raw.createdAt) ?? new Date(0).toISOString(),
  };
};

export const foodRidersSerializer = (raw: unknown): FoodRider[] =>
  arr(raw)
    .map(foodRiderSerializer)
    .filter((r): r is FoodRider => r !== null);

export const riderCredentialSerializer = (raw: unknown): RiderCredential | null =>
  isObject(raw) && str(raw.username) && str(raw.password) ? { username: str(raw.username), password: str(raw.password) } : null;

/** `POST /food/vendor/riders` → the rider and their one-time credential. */
export const createdRiderSerializer = (raw: unknown): { rider: FoodRider; credential: RiderCredential } | null => {
  if (!isObject(raw)) return null;
  const rider = foodRiderSerializer(raw.rider);
  const credential = riderCredentialSerializer(raw.credential);
  return rider && credential ? { rider, credential } : null;
};

export const riderHomeSerializer = (raw: unknown): RiderHome | null => {
  if (!isObject(raw)) return null;
  const rider = foodRiderSerializer(raw.rider);
  if (!rider) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  return {
    rider,
    vendor: {
      id: str(v.id),
      name: str(v.name, 'Your vendor'),
      logoUrl: strOrNull(v.logoUrl),
      phone: strOrNull(v.phone),
      addressLine: strOrNull(v.addressLine),
      area: strOrNull(v.area),
      city: strOrNull(v.city),
    },
  };
};

// ─── Riders on orders ─────────────────────────────────
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const ORDER_STATUSES: readonly FoodOrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'picked_up', 'rejected', 'auto_rejected', 'cancelled'];
const statusOf = (v: unknown): FoodOrderStatus => (ORDER_STATUSES.includes(v as FoodOrderStatus) ? (v as FoodOrderStatus) : 'placed');

export const riderOrderSerializer = (raw: unknown): RiderOrder | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const p = isObject(raw.pickup) ? raw.pickup : {};
  const d = isObject(raw.drop) ? raw.drop : null;
  const pay = isObject(raw.payment) ? raw.payment : {};
  return {
    id: str(raw.id),
    code: str(raw.code),
    status: statusOf(raw.status),
    statusLabel: str(raw.statusLabel),
    riderStep: strOrNull(raw.riderStep),
    nextSteps: arr(raw.nextSteps).map(x => str(x)).filter(Boolean),
    pickup: { name: str(p.name), phone: strOrNull(p.phone), addressLine: strOrNull(p.addressLine), area: strOrNull(p.area), city: strOrNull(p.city), lat: numOrNull(p.lat), lng: numOrNull(p.lng) },
    drop: d
      ? {
          name: strOrNull(d.name),
          phone: strOrNull(d.phone),
          line1: strOrNull(d.line1),
          area: strOrNull(d.area),
          city: strOrNull(d.city),
          landmark: strOrNull(d.landmark),
          building: strOrNull(d.building),
          floor: strOrNull(d.floor),
          riderInstructions: strOrNull(d.riderInstructions),
          lat: numOrNull(d.lat),
          lng: numOrNull(d.lng),
        }
      : null,
    items: arr(raw.items)
      .map(i => (isObject(i) ? { name: str(i.name), variant: strOrNull(i.variant), options: arr(i.options).map(o => str(o)).filter(Boolean), quantity: Math.max(1, Math.round(num(i.quantity, 1))) } : null))
      .filter((i): i is NonNullable<typeof i> => i !== null),
    itemCount: Math.max(0, Math.round(num(raw.itemCount))),
    cutlery: bool(raw.cutlery),
    note: strOrNull(raw.note),
    payment: { method: (['cod', 'transfer', 'pay_at_pickup'].includes(String(pay.method)) ? pay.method : 'cod') as FoodPaymentMethod, status: str(pay.status, 'cod_pending') as FoodPaymentStatus },
    total: Math.max(0, Math.round(num(raw.total))),
    cashToCollect: Math.max(0, Math.round(num(raw.cashToCollect))),
    codCollected: numOrNull(raw.codCollected),
    readyAt: isoOrNull(raw.readyAt),
    promisedAt: isoOrNull(raw.promisedAt),
  };
};

export const riderOrdersPageSerializer = (raw: unknown): Paged<RiderOrder> => {
  const r = isObject(raw) ? raw : {};
  return {
    items: arr(r.items)
      .map(riderOrderSerializer)
      .filter((o): o is RiderOrder => o !== null),
    total: Math.max(0, Math.round(num(r.total))),
    page: Math.max(1, Math.round(num(r.page, 1))),
    pageSize: Math.max(1, Math.round(num(r.pageSize, 20))),
  };
};

export const riderCashSerializer = (raw: unknown): RiderCash | null =>
  isObject(raw)
    ? {
        riderId: str(raw.riderId),
        balance: Math.round(num(raw.balance)),
        entries: arr(raw.entries)
          .map(e =>
            isObject(e) && str(e.id)
              ? { id: str(e.id), kind: (e.kind === 'handover' ? 'handover' : 'cod_collected') as 'handover' | 'cod_collected', amount: Math.round(num(e.amount)), orderCode: strOrNull(e.orderCode), note: strOrNull(e.note), at: isoOrNull(e.at) ?? '' }
              : null,
          )
          .filter((e): e is NonNullable<typeof e> => e !== null),
      }
    : null;

export const liveRidersSerializer = (raw: unknown): LiveRider[] =>
  arr(isObject(raw) ? raw.items : raw)
    .map(r => {
      if (!isObject(r) || !str(r.id)) return null;
      const loc = isObject(r.location) && numOrNull(r.location.lat) !== null && numOrNull(r.location.lng) !== null ? r.location : null;
      return {
        id: str(r.id),
        fullName: str(r.fullName, 'Rider'),
        phone: strOrNull(r.phone),
        vehicle: strOrNull(r.vehicle),
        onDuty: bool(r.onDuty),
        locationLive: bool(r.locationLive),
        location: loc ? { lat: Number(loc.lat), lng: Number(loc.lng), at: isoOrNull(loc.at) } : null,
        lastSeenAt: isoOrNull(r.lastSeenAt),
        activeOrders: arr(r.activeOrders)
          .map(o => (isObject(o) && str(o.id) ? { id: str(o.id), code: str(o.code), status: statusOf(o.status), riderStep: strOrNull(o.riderStep) } : null))
          .filter((o): o is NonNullable<typeof o> => o !== null),
      };
    })
    .filter((r): r is LiveRider => r !== null);

export const riderSuggestionsSerializer = (raw: unknown): RiderSuggestion[] =>
  arr(isObject(raw) ? raw.items : raw)
    .map(r =>
      isObject(r) && str(r.riderId)
        ? {
            riderId: str(r.riderId),
            fullName: str(r.fullName, 'Rider'),
            vehicle: strOrNull(r.vehicle),
            phone: strOrNull(r.phone),
            activeOrders: Math.max(0, Math.round(num(r.activeOrders))),
            locationLive: bool(r.locationLive),
            distanceKm: numOrNull(r.distanceKm),
          }
        : null,
    )
    .filter((r): r is RiderSuggestion => r !== null);
