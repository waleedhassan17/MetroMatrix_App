// MetroMatrix — Kitchen serializers: Bachat Box (the kitchen's boxes, reservations, the customer's cards).
// docs/API_KITCHEN_ASSUMED.md §2.7, §4.4.

import type {
  BoxPaymentMethod,
  BoxStatus,
  ReservationStatus,
  SurplusBox,
  SurplusBoxDetail,
  SurplusCard,
  SurplusDetail,
  SurplusReservation,
  SurplusSuggestion,
} from '../../types/kitchen';
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { PAY_STATUSES, count, list, numOrNull, transferAccountSerializer } from './kitchenCommon';

const BOX_STATUSES: readonly BoxStatus[] = ['live', 'sold_out', 'ended', 'cancelled'];
const RES_STATUSES: readonly ReservationStatus[] = ['reserved', 'collected', 'no_show', 'cancelled'];
const METHODS: readonly BoxPaymentMethod[] = ['pay_at_pickup', 'transfer'];

const point = (raw: unknown) => {
  const p = isObject(raw) ? raw : {};
  return { addressLine: strOrNull(p.addressLine), area: strOrNull(p.area), city: strOrNull(p.city), lat: numOrNull(p.lat), lng: numOrNull(p.lng) };
};


export const surplusBoxSerializer = (raw: unknown): SurplusBox | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    title: str(raw.title),
    contentsHint: str(raw.contentsHint),
    photoUrl: strOrNull(raw.photoUrl),
    value: count(raw.value),
    price: count(raw.price),
    quantity: count(raw.quantity),
    reserved: count(raw.reserved),
    collected: count(raw.collected),
    left: count(raw.left),
    pickupFrom: str(raw.pickupFrom),
    pickupTo: str(raw.pickupTo),
    pickupLabel: str(raw.pickupLabel),
    status: oneOf(raw.status, BOX_STATUSES, 'ended'),
    createdAt: str(raw.createdAt),
  };
};

export const surplusBoxesSerializer = (raw: unknown): SurplusBox[] => list(isObject(raw) ? raw.items : raw, surplusBoxSerializer);

export const reservationSerializer = (raw: unknown): SurplusReservation | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const box = isObject(raw.box) ? raw.box : {};
  const v = isObject(raw.vendor) ? raw.vendor : {};
  const pay = isObject(raw.payment) ? raw.payment : {};
  return {
    code: str(raw.code),
    status: oneOf(raw.status, RES_STATUSES, 'reserved'),
    quantity: Math.max(1, count(raw.quantity)),
    total: count(raw.total),
    box: { id: str(box.id), title: str(box.title), photoUrl: strOrNull(box.photoUrl), value: count(box.value), price: count(box.price) },
    vendor: { id: str(v.id), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), phone: strOrNull(v.phone), location: point(v.location) },
    pickupFrom: str(raw.pickupFrom),
    pickupTo: str(raw.pickupTo),
    pickupLabel: str(raw.pickupLabel),
    payment: {
      method: oneOf(pay.method, METHODS, 'pay_at_pickup'),
      status: oneOf(pay.status, PAY_STATUSES, 'unpaid'),
      payBy: strOrNull(pay.payBy),
      accounts: Array.isArray(pay.accounts) ? list(pay.accounts, transferAccountSerializer) : null,
      reference: strOrNull(pay.reference),
      proofUrl: strOrNull(pay.proofUrl),
      rejectedReason: strOrNull(pay.rejectedReason),
    },
    customerName: strOrNull(raw.customerName),
    canCancel: bool(raw.canCancel),
    reservedAt: str(raw.reservedAt),
    collectedAt: strOrNull(raw.collectedAt),
  };
};

export const reservationsSerializer = (raw: unknown): SurplusReservation[] => list(isObject(raw) ? raw.items : raw, reservationSerializer);

export const surplusBoxDetailSerializer = (raw: unknown): SurplusBoxDetail | null => {
  const b = surplusBoxSerializer(raw);
  return b && isObject(raw) ? { ...b, reservations: list(raw.reservations, reservationSerializer) } : null;
};

export const surplusSuggestionSerializer = (raw: unknown): SurplusSuggestion | null => {
  const s = isObject(raw) ? raw.suggestion : null;
  if (!isObject(s) || !str(s.title)) return null;
  return {
    title: str(s.title),
    contentsHint: str(s.contentsHint),
    value: count(s.value),
    price: count(s.price),
    quantity: Math.max(1, count(s.quantity)),
    pickupFrom: str(s.pickupFrom),
    pickupTo: str(s.pickupTo),
    basis: str(s.basis),
  };
};

export const surplusCardSerializer = (raw: unknown): SurplusCard | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  return {
    id: str(raw.id),
    title: str(raw.title),
    contentsHint: str(raw.contentsHint),
    photoUrl: strOrNull(raw.photoUrl),
    value: count(raw.value),
    price: count(raw.price),
    left: count(raw.left),
    status: oneOf(raw.status, BOX_STATUSES, 'ended'),
    pickupFrom: str(raw.pickupFrom),
    pickupTo: str(raw.pickupTo),
    pickupLabel: str(raw.pickupLabel),
    vendor: { id: str(v.id), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), area: strOrNull(v.area), isHomeKitchen: bool(v.isHomeKitchen), distanceKm: numOrNull(v.distanceKm) },
  };
};

export const surplusCardsSerializer = (raw: unknown): SurplusCard[] => list(isObject(raw) ? raw.items : raw, surplusCardSerializer);

export const surplusDetailSerializer = (raw: unknown): SurplusDetail | null => {
  const c = surplusCardSerializer(raw);
  if (!c || !isObject(raw)) return null;
  const methods = enumList(raw.paymentMethods, METHODS);
  return {
    ...c,
    whatToExpect: str(raw.whatToExpect),
    pickup: { ...point(raw.pickup), phone: isObject(raw.pickup) ? strOrNull(raw.pickup.phone) : null },
    paymentMethods: methods.length ? methods : ['pay_at_pickup'],
    maxPerCustomer: Math.max(1, count(raw.maxPerCustomer) || 2),
    myReservations: arr(raw.myReservations).map(x => str(x)).filter(Boolean),
  };
};

export { num };

/** The assistant's Bachat Box suggestion (a draft). */
export const surplusSuggestionResponseSerializer = fromResponse(raw => ({ suggestion: surplusSuggestionSerializer(raw) }));
