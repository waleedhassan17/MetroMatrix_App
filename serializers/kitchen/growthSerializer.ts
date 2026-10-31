// MetroMatrix — Kitchen serializers: tiffin and catering (5B).
// docs/API_KITCHEN_ASSUMED.md §2.9, §2.10 (TODO(API_KITCHEN): an assumed contract).

import type {
  CateringCalendar,
  CateringInbox,
  CateringMode,
  CateringQuote,
  CateringRequest,
  CateringSettings,
  CateringStatus,
  CateringVendor,
  EventType,
  Meal,
  QuoteState,
  TiffinCalendar,
  TiffinDay,
  TiffinDayState,
  TiffinInbox,
  TiffinPayMethod,
  TiffinPeriod,
  TiffinPlan,
  TiffinPlanCard,
  TiffinStatus,
  TiffinSubscription,
  TiffinTomorrow,
  TiffinWindow,
} from '../../types/kitchen';
import { arr, bool, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { PAY_STATUSES, count, dateOrNull, list, numOrNull, transferPaymentSerializer } from './kitchenCommon';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const PERIODS = ['week', 'month'] as const;
const MODES = ['delivery', 'pickup'] as const;
const TIFFIN_STATUSES: readonly TiffinStatus[] = ['pending', 'active', 'paused', 'declined', 'ended', 'cancelled'];
const TIFFIN_PAY: readonly TiffinPayMethod[] = ['transfer', 'cash'];
const DAY_STATES: readonly TiffinDayState[] = ['before_start', 'off', 'pending', 'upcoming', 'skipped', 'paused', 'ordered', 'delivered', 'cancelled', 'ended', 'none'];
export const EVENT_TYPES: readonly EventType[] = ['mehndi', 'baraat', 'walima', 'birthday', 'aqiqah', 'milad', 'quran_khwani', 'office', 'family', 'other'];
const CATERING_MODES: readonly CateringMode[] = ['delivery', 'pickup', 'on_site'];
const CATERING_STATUSES: readonly CateringStatus[] = ['requested', 'quoted', 'accepted', 'confirmed', 'declined', 'cancelled', 'completed'];
const QUOTE_STATES: readonly QuoteState[] = ['current', 'outdated', 'expired', 'accepted'];

const weekdays = (raw: unknown) => arr(raw).map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
const strings = (raw: unknown) => arr(raw).filter((x): x is string => typeof x === 'string');

const windowSerializer = (raw: unknown): TiffinWindow => {
  const w = isObject(raw) ? raw : {};
  return { from: str(w.from), to: str(w.to), label: str(w.label) };
};

const placeSerializer = (raw: unknown) =>
  isObject(raw) ? { line1: strOrNull(raw.line1), area: strOrNull(raw.area), city: strOrNull(raw.city), lat: numOrNull(raw.lat), lng: numOrNull(raw.lng) } : null;

const personSerializer = (raw: unknown) => (isObject(raw) ? { name: str(raw.name, 'Customer'), phone: strOrNull(raw.phone) } : null);

const vendorSerializer = (raw: unknown) => {
  const v = isObject(raw) ? raw : {};
  return { id: str(v.id), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), phone: strOrNull(v.phone) };
};

// ── Tiffin ──
export const tiffinPlanSerializer = fromResponse((raw: unknown): TiffinPlan | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  return {
    id: str(raw.id),
    vendor: { id: str(v.id), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), isHomeKitchen: bool(v.isHomeKitchen) },
    name: str(raw.name),
    description: strOrNull(raw.description),
    meal: oneOf(raw.meal, MEALS, 'lunch'),
    days: weekdays(raw.days),
    period: oneOf(raw.period, PERIODS, 'week'),
    price: count(raw.price),
    perMeal: count(raw.perMeal),
    mealsPerPeriod: count(raw.mealsPerPeriod),
    mode: oneOf(raw.mode, MODES, 'delivery'),
    window: windowSerializer(raw.window),
    capacity: count(raw.capacity),
    subscribers: count(raw.subscribers),
    seatsLeft: count(raw.seatsLeft),
    skipCutoffHours: count(raw.skipCutoffHours),
    rotation: list(raw.rotation, r =>
      isObject(r)
        ? {
            weekday: count(r.weekday),
            dishes: list(r.dishes, d => (isObject(d) && str(d.itemId) ? { itemId: str(d.itemId), name: str(d.name), photoUrl: strOrNull(d.photoUrl) } : null)),
            note: strOrNull(r.note),
          }
        : null,
    ),
    photoUrl: strOrNull(raw.photoUrl),
    isActive: raw.isActive !== false,
    nextStart: dateOrNull(raw.nextStart),
  };
});

export const tiffinPlansSerializer = fromResponse((raw: unknown): TiffinPlan[] => list(isObject(raw) ? raw.items : raw, tiffinPlanSerializer));

/** A plan on the vendor page (an addition to API_FOOD's VendorPage). */
export const tiffinPlanCardSerializer = (raw: unknown): TiffinPlanCard | null =>
  isObject(raw) && str(raw.id)
    ? {
        id: str(raw.id),
        name: str(raw.name),
        meal: oneOf(raw.meal, MEALS, 'lunch'),
        days: weekdays(raw.days),
        period: oneOf(raw.period, PERIODS, 'week'),
        price: count(raw.price),
        perMeal: count(raw.perMeal),
        window: str(raw.window),
        seatsLeft: count(raw.seatsLeft),
        photoUrl: strOrNull(raw.photoUrl),
      }
    : null;

const periodSerializer = (raw: unknown): TiffinPeriod | null =>
  isObject(raw) && str(raw.id)
    ? {
        id: str(raw.id),
        from: dateOrNull(raw.from) ?? '',
        to: dateOrNull(raw.to) ?? '',
        meals: count(raw.meals),
        credit: count(raw.credit),
        amount: count(raw.amount),
        payment: transferPaymentSerializer(raw.payment, TIFFIN_PAY, 'cash'),
      }
    : null;

export const tiffinSubscriptionSerializer = fromResponse((raw: unknown): TiffinSubscription | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const p = isObject(raw.plan) ? raw.plan : {};
  const next = isObject(raw.nextDelivery) ? raw.nextDelivery : null;
  return {
    code: str(raw.code),
    status: oneOf(raw.status, TIFFIN_STATUSES, 'pending'),
    plan: {
      id: str(p.id),
      name: str(p.name),
      meal: oneOf(p.meal, MEALS, 'lunch'),
      days: weekdays(p.days),
      period: oneOf(p.period, PERIODS, 'week'),
      price: count(p.price),
      perMeal: count(p.perMeal),
      mode: oneOf(p.mode, MODES, 'delivery'),
      window: windowSerializer(p.window),
      skipCutoffHours: count(p.skipCutoffHours),
    },
    vendor: vendorSerializer(raw.vendor),
    customer: personSerializer(raw.customer),
    startDate: dateOrNull(raw.startDate) ?? '',
    endDate: dateOrNull(raw.endDate),
    nextDelivery: next && dateOrNull(next.date) ? { date: dateOrNull(next.date)!, dishes: strings(next.dishes), cutoffAt: strOrNull(next.cutoffAt) } : null,
    address: placeSerializer(raw.address),
    paymentMethod: oneOf(raw.paymentMethod, TIFFIN_PAY, 'cash'),
    period: periodSerializer(raw.period),
    pausedFrom: dateOrNull(raw.pausedFrom),
    pausedUntil: dateOrNull(raw.pausedUntil),
    declineReason: strOrNull(raw.declineReason),
    endReason: strOrNull(raw.endReason),
    canPause: bool(raw.canPause),
    canResume: bool(raw.canResume),
    canCancel: bool(raw.canCancel),
    createdAt: str(raw.createdAt),
  };
});

export const tiffinSubscriptionsSerializer = fromResponse((raw: unknown): TiffinSubscription[] => list(isObject(raw) ? raw.items : raw, tiffinSubscriptionSerializer));

export const tiffinInboxSerializer = fromResponse((raw: unknown): TiffinInbox => {
  const c = isObject(raw) && isObject(raw.counts) ? raw.counts : {};
  return {
    counts: { pending: count(c.pending), active: count(c.active), paused: count(c.paused), toCheck: count(c.toCheck) },
    items: tiffinSubscriptionsSerializer(raw),
  };
});

export const tiffinDaySerializer = fromResponse((raw: unknown): TiffinDay | null =>
  isObject(raw) && dateOrNull(raw.date)
    ? {
        date: dateOrNull(raw.date)!,
        state: oneOf(raw.state, DAY_STATES, 'none'),
        dishes: strings(raw.dishes),
        cutoffAt: strOrNull(raw.cutoffAt),
        canSkip: bool(raw.canSkip),
        canUnskip: bool(raw.canUnskip),
        orderCode: strOrNull(raw.orderCode),
      }
    : null);

export const tiffinCalendarSerializer = fromResponse((raw: unknown): TiffinCalendar => {
  const r = isObject(raw) ? raw : {};
  return { month: str(r.month), days: list(r.days, tiffinDaySerializer) };
});

export const tiffinTomorrowSerializer = fromResponse((raw: unknown): TiffinTomorrow => {
  const r = isObject(raw) ? raw : {};
  return {
    date: dateOrNull(r.date) ?? '',
    plans: list(r.plans, p =>
      isObject(p) && str(p.planId)
        ? {
            planId: str(p.planId),
            name: str(p.name),
            meal: oneOf(p.meal, MEALS, 'lunch'),
            window: str(p.window),
            dishes: strings(p.dishes),
            count: count(p.count),
            skipped: count(p.skipped),
            paused: count(p.paused),
            cutoffAt: str(p.cutoffAt),
            deliveries: list(p.deliveries, d =>
              isObject(d) && str(d.code)
                ? { code: str(d.code), customerName: str(d.customerName, 'Customer'), area: strOrNull(d.area), state: oneOf(d.state, DAY_STATES, 'none'), orderCode: strOrNull(d.orderCode) }
                : null,
            ),
          }
        : null,
    ),
  };
});

// ── Catering ──
const quoteSerializer = (raw: unknown): CateringQuote | null =>
  isObject(raw) && Number.isInteger(Number(raw.version))
    ? {
        version: count(raw.version),
        lines: list(raw.lines, l =>
          isObject(l) ? { itemId: strOrNull(l.itemId), name: str(l.name), qty: count(l.qty), unitPrice: count(l.unitPrice), total: count(l.total) } : null,
        ),
        subtotal: count(raw.subtotal),
        deliveryFee: count(raw.deliveryFee),
        total: count(raw.total),
        advancePct: count(raw.advancePct),
        advance: count(raw.advance),
        validUntil: str(raw.validUntil),
        notes: strOrNull(raw.notes),
        createdAt: str(raw.createdAt),
        state: oneOf(raw.state, QUOTE_STATES, 'outdated'),
      }
    : null;

export const cateringRequestSerializer = fromResponse((raw: unknown): CateringRequest | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const adv = isObject(raw.advance) ? raw.advance : null;
  const pay = adv ? transferPaymentSerializer(adv, ['transfer'], 'transfer') : null;
  return {
    code: str(raw.code),
    status: oneOf(raw.status, CATERING_STATUSES, 'requested'),
    vendor: vendorSerializer(raw.vendor),
    customer: personSerializer(raw.customer),
    date: dateOrNull(raw.date) ?? '',
    time: str(raw.time),
    startsAt: str(raw.startsAt),
    guests: count(raw.guests),
    eventType: oneOf(raw.eventType, EVENT_TYPES, 'other'),
    dishes: list(raw.dishes, d => (isObject(d) && str(d.name) ? { itemId: strOrNull(d.itemId), name: str(d.name), qty: count(d.qty) } : null)),
    budget: numOrNull(raw.budget),
    mode: oneOf(raw.mode, CATERING_MODES, 'delivery'),
    address: placeSerializer(raw.address),
    notes: strOrNull(raw.notes),
    quotes: list(raw.quotes, quoteSerializer),
    acceptedVersion: numOrNull(raw.acceptedVersion),
    advance: adv && pay
      ? { amount: count(adv.amount), status: oneOf(adv.status, PAY_STATUSES, 'awaiting_transfer'), payBy: pay.payBy, accounts: pay.accounts, reference: pay.reference, proofUrl: pay.proofUrl, rejectedReason: pay.rejectedReason }
      : null,
    balance: numOrNull(raw.balance),
    declineReason: strOrNull(raw.declineReason),
    cancelReason: strOrNull(raw.cancelReason),
    canAccept: bool(raw.canAccept),
    canCancel: bool(raw.canCancel),
    canQuote: bool(raw.canQuote),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
});

export const cateringRequestsSerializer = fromResponse((raw: unknown): CateringRequest[] => list(isObject(raw) ? raw.items : raw, cateringRequestSerializer));

export const cateringInboxSerializer = fromResponse((raw: unknown): CateringInbox => {
  const c = isObject(raw) && isObject(raw.counts) ? raw.counts : {};
  return { counts: { new: count(c.new), quoted: count(c.quoted), confirmed: count(c.confirmed), past: count(c.past) }, items: cateringRequestsSerializer(raw) };
});

export const cateringVendorSerializer = fromResponse((raw: unknown): CateringVendor | null =>
  isObject(raw) && str(raw.vendorId)
    ? {
        vendorId: str(raw.vendorId),
        open: bool(raw.open),
        minGuests: count(raw.minGuests),
        leadDays: count(raw.leadDays),
        earliestDate: dateOrNull(raw.earliestDate) ?? '',
        modes: arr(raw.modes).map(m => oneOf(m, CATERING_MODES, 'delivery')),
        menu: list(raw.menu, m => (isObject(m) && str(m.itemId) ? { itemId: str(m.itemId), name: str(m.name), price: count(m.price), photoUrl: strOrNull(m.photoUrl) } : null)),
      }
    : null);

export const cateringCalendarSerializer = fromResponse((raw: unknown): CateringCalendar => {
  const r = isObject(raw) ? raw : {};
  return {
    month: str(r.month),
    days: list(r.days, d =>
      isObject(d) && dateOrNull(d.date)
        ? {
            date: dateOrNull(d.date)!,
            events: list(d.events, e =>
              isObject(e) && str(e.code)
                ? { code: str(e.code), time: str(e.time), guests: count(e.guests), eventType: oneOf(e.eventType, EVENT_TYPES, 'other'), status: oneOf(e.status, CATERING_STATUSES, 'confirmed'), customerName: str(e.customerName, 'Customer') }
                : null,
            ),
          }
        : null,
    ),
  };
});

export const cateringSettingsSerializer = fromResponse((raw: unknown): CateringSettings => {
  const r = isObject(raw) ? raw : {};
  return { open: bool(r.open), minGuests: count(r.minGuests), leadDays: count(r.leadDays) };
});

/** A tiffin plan removed. */
export const tiffinRemovedSerializer = fromResponse(raw => ({ removed: !!(raw as { removed?: boolean })?.removed }));
