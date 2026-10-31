// MetroMatrix — Delivery address serializer (core; Shopping now, Food later).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type { Address, AddressLabel } from '../models/shopping';
import { bool, isObject, num, oneOf, str, strOrNull, arr, fromResponse } from './serializerUtils';
import { compact } from './shopping/common';

const LABELS: readonly AddressLabel[] = ['home', 'work', 'other'];

export const addressSerializer = fromResponse((raw: unknown): Address | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  // An address nobody can deliver to is not an address.
  if (!id || !str(raw.city) || !str(raw.line1)) return null;
  const lat = raw.lat === null || raw.lat === undefined ? null : num(raw.lat, NaN);
  const lng = raw.lng === null || raw.lng === undefined ? null : num(raw.lng, NaN);
  return {
    id,
    label: oneOf(raw.label, LABELS, 'home'),
    fullName: str(raw.fullName),
    phone: str(raw.phone),
    city: str(raw.city),
    area: str(raw.area),
    line1: str(raw.line1),
    landmark: strOrNull(raw.landmark),
    lat: lat !== null && Number.isFinite(lat) ? lat : null,
    lng: lng !== null && Number.isFinite(lng) ? lng : null,
    isDefault: bool(raw.isDefault),
  };
});

/** GET /addresses: the address book. */
export const addressListSerializer = fromResponse(raw => compact(arr(raw).map(addressSerializer)));
