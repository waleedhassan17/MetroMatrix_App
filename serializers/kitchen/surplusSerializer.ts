// MetroMatrix — Kitchen serializers: Bachat Box (the kitchen's boxes, reservations, the customer's cards).
// docs/API_KITCHEN.md §10. Boxes are `originalValue` and `remaining` on the wire; an expired
// box reads as ended; every pickup window is said in Pakistan time ("Today, 9:00 PM – 11:00 PM").

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
} from '../../models/kitchen';
import { MAX_PER_RESERVATION } from '../../models/kitchen/surplusModel';
import { addDays, dateInZone, formatTimeRange, formatDayShort, PKT, todayInZone } from '../../utils/health-time/healthTime';
import { bool, enumList, isObject, oneOf, str, strOrNull, bodiesOf, fromResponse } from '../serializerUtils';
import { PAY_STATUSES, count, list, numOrNull, transferAccountSerializer } from './kitchenCommon';

const BOX_STATUSES: readonly BoxStatus[] = ['live', 'sold_out', 'ended', 'cancelled'];
const RES_STATUSES: readonly ReservationStatus[] = ['reserved', 'collected', 'no_show', 'cancelled'];
const METHODS: readonly BoxPaymentMethod[] = ['pay_at_pickup', 'transfer'];

const boxStatus = (v: unknown): BoxStatus => (v === 'expired' ? 'ended' : oneOf(v, BOX_STATUSES, 'ended'));

/** "Today, 9:00 PM – 11:00 PM" (or Tomorrow, or the day). */
export const pickupLabelOf = (from: string, to: string, now: number = Date.now()): string => {
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) return '';
  const day = dateInZone(from, PKT);
  const today = todayInZone(PKT, now);
  const when = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : formatDayShort(day);
  return `${when}, ${formatTimeRange(from, to, PKT)}`;
};

/** The kitchen's own box, with its reserved and collected counts. */
export const surplusBoxSerializer = fromResponse((raw: unknown): SurplusBox | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const quantity = count(raw.quantity);
  const left = count(raw.remaining);
  return {
    id: str(raw.id),
    title: str(raw.title),
    contentsHint: str(raw.contentsHint),
    photoUrl: strOrNull(raw.photoUrl),
    value: count(raw.originalValue),
    price: count(raw.price),
    quantity,
    // The list counts both; a box just saved answers without them (all still to reserve).
    reserved: raw.reserved === undefined ? Math.max(0, quantity - left) : count(raw.reserved),
    collected: count(raw.collected),
    left,
    pickupFrom: str(raw.pickupFrom),
    pickupTo: str(raw.pickupTo),
    pickupLabel: pickupLabelOf(str(raw.pickupFrom), str(raw.pickupTo)),
    status: boxStatus(raw.status),
  };
});

export const surplusBoxesSerializer = fromResponse((raw: unknown): SurplusBox[] => list(raw, surplusBoxSerializer));

/** The live ones, soonest pickup first (the kitchen's Waste and Bachat Box page). */
export const liveBoxesSerializer = fromResponse((raw: unknown): SurplusBox[] =>
  list(raw, surplusBoxSerializer)
    .filter(b => b.status === 'live' || b.status === 'sold_out')
    .sort((a, b) => a.pickupTo.localeCompare(b.pickupTo)));

const location = (v: Record<string, unknown>) => ({ addressLine: strOrNull(v.address), area: null, city: null, lat: numOrNull(v.lat), lng: numOrNull(v.lng) });

/**
 * A reservation, as the customer (box, kitchen, the accounts while a transfer is owed) or the
 * kitchen (its customer, the receipt) sees it.
 */
export const reservationSerializer = fromResponse((raw: unknown): SurplusReservation | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.code)) return null;
  const box = isObject(raw.box) ? raw.box : {};
  const v = isObject(raw.vendor) ? raw.vendor : {};
  const pay = isObject(raw.payment) ? raw.payment : {};
  const quantity = Math.max(1, count(raw.quantity));
  const total = count(raw.total);
  const pickupFrom = str(box.pickupFrom);
  const pickupTo = str(box.pickupTo);
  return {
    id: str(raw.id),
    code: str(raw.code),
    status: oneOf(raw.status, RES_STATUSES, 'reserved'),
    quantity,
    total,
    box: { id: str(box.id) || str(raw.boxId), title: str(box.title) || str(raw.title), photoUrl: null, value: 0, price: Math.round(total / quantity) },
    vendor: { id: str(v.slug), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), phone: strOrNull(v.phone), location: location(v) },
    pickupFrom,
    pickupTo,
    pickupLabel: pickupLabelOf(pickupFrom, pickupTo),
    payment: {
      method: oneOf(pay.method ?? raw.paymentMethod, METHODS, 'pay_at_pickup'),
      status: oneOf(pay.status, PAY_STATUSES, 'unpaid'),
      payBy: strOrNull(pay.payBy),
      accounts: Array.isArray(raw.payTo) && raw.payTo.length ? list(raw.payTo, transferAccountSerializer) : null,
      reference: strOrNull(pay.ref),
      proofUrl: strOrNull(pay.proofUrl),
      rejectedReason: strOrNull(pay.rejectedReason),
    },
    customerName: isObject(raw.customer) ? strOrNull(raw.customer.name) : null,
    canCancel: bool(raw.canCancel),
    reservedAt: str(raw.reservedAt),
    collectedAt: strOrNull(raw.collectedAt),
  };
});

export const reservationsSerializer = fromResponse((raw: unknown): SurplusReservation[] => list(raw, reservationSerializer));

/** One of the customer's reservations, found by the code they were given. */
export const myReservationSerializer = fromResponse((raw: unknown, code: string): SurplusReservation | null =>
  list(raw, reservationSerializer).find(r => r.code === code) ?? null);

/** The kitchen's box (from its list) with its reservations. */
export const surplusBoxDetailSerializer = (parts: { boxes: unknown; reservations: unknown }, id: string): SurplusBoxDetail | null => {
  const raw = bodiesOf(parts);
  const box = list(raw.boxes, surplusBoxSerializer).find(b => b.id === id);
  return box ? { ...box, reservations: list(raw.reservations, reservationSerializer) } : null;
};

/** The end-of-day draft (null when there is nothing worth a box). */
export const surplusSuggestionSerializer = fromResponse((raw: unknown): SurplusSuggestion | null => {
  const s = isObject(raw) ? raw.draft : null;
  if (!isObject(s) || !str(s.title) || !isObject(raw)) return null;
  return {
    title: str(s.title),
    contentsHint: str(s.contentsHint),
    value: count(s.originalValue),
    price: count(s.price),
    quantity: Math.max(1, count(s.quantity)),
    pickupFrom: str(s.pickupFrom),
    pickupTo: str(s.pickupTo),
    basis: count(raw.leftover) ? `About ${count(raw.leftover)} portions may be left tonight` : '',
  };
});

/** A Bachat Box as customers see it (nearby, or its own page). */
export const surplusCardSerializer = (raw: unknown): SurplusCard | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  return {
    id: str(raw.id),
    title: str(raw.title),
    contentsHint: str(raw.contentsHint),
    photoUrl: strOrNull(raw.photoUrl),
    value: count(raw.originalValue),
    price: count(raw.price),
    left: count(raw.remaining),
    status: boxStatus(raw.status),
    pickupFrom: str(raw.pickupFrom),
    pickupTo: str(raw.pickupTo),
    pickupLabel: pickupLabelOf(str(raw.pickupFrom), str(raw.pickupTo)),
    vendor: { id: str(v.slug), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), area: strOrNull(v.address), isHomeKitchen: bool(v.isHomeKitchen), distanceKm: numOrNull(raw.distanceKm) },
  };
};

export const surplusCardsSerializer = fromResponse((raw: unknown): SurplusCard[] => list(raw, surplusCardSerializer));

/** The box's page, with the codes the customer already holds for it (from their reservations). */
export const surplusDetailSerializer = (parts: { box: unknown; mine?: unknown }): SurplusDetail | null => {
  const raw = bodiesOf(parts);
  const c = surplusCardSerializer(raw.box);
  if (!c || !isObject(raw.box)) return null;
  const b = raw.box;
  const v = isObject(b.vendor) ? b.vendor : {};
  const methods = enumList(b.paymentMethods, METHODS);
  return {
    ...c,
    whatToExpect: str(b.description) || str(b.contentsHint),
    pickup: { ...location(v), phone: strOrNull(v.phone) },
    paymentMethods: methods.length ? methods : ['pay_at_pickup'],
    maxPerCustomer: Math.max(1, count(b.maxPerReservation) || MAX_PER_RESERVATION),
    myReservations: list(raw.mine, reservationSerializer)
      .filter(r => r.box.id === c.id && r.status === 'reserved')
      .map(r => r.code),
  };
};
