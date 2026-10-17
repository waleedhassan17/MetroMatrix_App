// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider serializers (vendor's Riders, the rider's app)
// ═══════════════════════════════════════════════════════
// TODO(API_FOOD): taken from the API's committed rider routes; check against
// docs/API_FOOD.md when it is published.

import type { FoodRider, RiderCredential, RiderHome } from '../../types/food';
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
