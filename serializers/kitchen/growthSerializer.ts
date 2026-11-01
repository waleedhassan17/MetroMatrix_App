// MetroMatrix — Kitchen serializers: tiffin and catering (5B).
// docs/API_KITCHEN.md §19, §20. A subscription goes by its id (the app's `code`); weekdays
// arrive 0 Sunday … 6 Saturday and are read as ISO; a period's money is the plan's price.

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
  TiffinPeriodKind,
  TiffinStatus,
  TiffinSubscription,
  TiffinTomorrow,
  TiffinWindow,
} from '../../models/kitchen';
import type { FoodPaymentStatus } from '../../models/food';
import { addDays, isoWeekday, PKT, todayInZone, zonedToIso } from '../../utils/health-time/healthTime';
import { arr, bodiesOf, bool, enumList as enumListOf, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { vendorPageSerializer } from '../food/discoverySerializer';
import type { VendorPage } from '../../models/food';
import { count, dateOrNull, list, numOrNull, transferAccountSerializer } from './kitchenCommon';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];
const MODES = ['delivery', 'pickup', 'both'] as const;
const DAY_STATES: readonly TiffinDayState[] = ['before_start', 'off', 'pending', 'upcoming', 'skipped', 'paused', 'ordered', 'delivered', 'missed', 'cancelled', 'ended', 'none'];
export const EVENT_TYPES: readonly EventType[] = ['dawat', 'wedding', 'office', 'birthday', 'milad', 'other'];
const CATERING_MODES: readonly CateringMode[] = ['delivery', 'pickup', 'on_site'];
const CATERING_STATUSES: readonly CateringStatus[] = ['requested', 'quoted', 'accepted', 'advance_proof', 'confirmed', 'declined', 'cancelled', 'expired', 'completed'];

/** The API's weekdays (0 Sunday … 6 Saturday) → ISO (1 Monday … 7 Sunday). */
const isoDay = (d: unknown) => (Number(d) === 0 ? 7 : Number(d));
const weekdays = (raw: unknown) =>
  arr(raw)
    .map(isoDay)
    .filter(d => Number.isInteger(d) && d >= 1 && d <= 7)
    .sort((a, b) => a - b);
const PERIOD: Record<string, TiffinPeriodKind> = { weekly: 'week', monthly: 'month' };
const TIFFIN_STATUS: Record<string, TiffinStatus> = { requested: 'pending', active: 'active', paused: 'paused', declined: 'declined', ended: 'ended', cancelled: 'cancelled' };
const TIFFIN_PAY: Record<string, TiffinPayMethod> = { cash_weekly: 'cash', transfer_per_period: 'transfer' };

/** "12:30" → "12:30 PM". */
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) ? `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : hhmm;
};

const windowSerializer = (raw: unknown): TiffinWindow => {
  const w = isObject(raw) ? raw : {};
  const from = str(w.from).slice(0, 5);
  const to = str(w.to).slice(0, 5);
  return { from, to, label: from && to ? `${clock(from)} – ${clock(to)}` : '' };
};

const dishNames = (raw: unknown) => list(raw, d => (isObject(d) && str(d.name) ? (count(d.quantity) > 1 ? `${count(d.quantity)} × ${str(d.name)}` : str(d.name)) : null));

const placeSerializer = (raw: unknown) =>
  isObject(raw) ? { line1: strOrNull(raw.line1), area: strOrNull(raw.area), city: strOrNull(raw.city), lat: numOrNull(raw.lat), lng: numOrNull(raw.lng) } : null;

const personSerializer = (raw: unknown) => (isObject(raw) ? { name: str(raw.name, 'Customer'), phone: strOrNull(raw.phone) } : null);

const vendorSerializer = (raw: unknown) => {
  const v = isObject(raw) ? raw : {};
  return { id: str(v.id), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), phone: strOrNull(v.phone) };
};

/** A plan's meals in one period: its days in a week, or a month's average of them. */
const mealsIn = (days: number[], period: TiffinPeriodKind) => (period === 'week' ? days.length : Math.round((days.length * 52) / 12));

/** The first day it serves from today (Pakistan time): a new subscription's earliest start. */
const firstServed = (days: number[], now: number) => {
  const today = todayInZone(PKT, now);
  for (let i = 0; i < 8; i++) {
    const d = addDays(today, i);
    if (days.includes(isoWeekday(d))) return d;
  }
  return null;
};

// ── Tiffin ──
/** A plan: the kitchen's own (its counts), or as customers see it (its kitchen, the dishes by name). */
export const tiffinPlanSerializer = fromResponse((raw: unknown, now: number = Date.now()): TiffinPlan | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  const days = weekdays(raw.days);
  const period = PERIOD[str(raw.period)] ?? 'week';
  const price = count(raw.pricePerPeriod);
  return {
    id: str(raw.id),
    vendor: { id: str(v.id) || str(raw.brandId), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), isHomeKitchen: bool(v.isHomeKitchen) },
    name: str(raw.name),
    description: strOrNull(raw.description),
    meal: oneOf(raw.meal, MEALS, 'lunch'),
    days,
    period,
    price,
    perMeal: count(raw.mealValue),
    mealsPerPeriod: mealsIn(days, period),
    mode: oneOf(raw.deliveryMode, MODES, 'delivery'),
    window: windowSerializer(raw.deliveryWindow),
    capacity: count(raw.capacity),
    subscribers: count(raw.subscribers),
    seatsLeft: count(raw.seatsLeft),
    skipCutoffHour: Math.min(23, count(raw.skipCutoffHour ?? 20)),
    rotation: list(raw.rotation, r => {
      if (!isObject(r)) return null;
      const named = new Map(list(r.dishes, d => (isObject(d) && str(d.itemId) ? ([str(d.itemId), str(d.name)] as const) : null)));
      return {
        weekday: isoDay(r.weekday),
        dishes: arr(r.menuItemIds)
          .map(id => str(id))
          .filter(Boolean)
          .map(itemId => ({ itemId, name: named.get(itemId) ?? '', photoUrl: null })),
        note: strOrNull(r.note),
      };
    }).sort((a, b) => a.weekday - b.weekday),
    photoUrl: strOrNull(raw.photoUrl),
    isActive: raw.isActive !== false,
    nextStart: bool(raw.full) || raw.isActive === false ? null : firstServed(days, now),
  };
});

export const tiffinPlansSerializer = fromResponse((raw: unknown): TiffinPlan[] => list(raw, x => tiffinPlanSerializer(x)));

/** A plan on the vendor page. */
export const tiffinPlanCardSerializer = (raw: unknown): TiffinPlanCard | null => {
  const p = tiffinPlanSerializer(raw);
  return p ? { id: p.id, name: p.name, meal: p.meal, days: p.days, period: p.period, price: p.price, perMeal: p.perMeal, window: p.window.label, seatsLeft: p.seatsLeft, photoUrl: p.photoUrl } : null;
};

/** The period now running and how it stands (`due` is unpaid: cash at the first meal, or a transfer to send). */
const periodSerializer = (raw: Record<string, unknown>, method: TiffinPayMethod, plan: { price: number; days: number[]; period: TiffinPeriodKind }): TiffinPeriod | null => {
  const p = isObject(raw.period) ? raw.period : null;
  if (!p || !dateOrNull(p.start)) return null;
  const due = p.paymentStatus === 'due';
  const status: FoodPaymentStatus = p.paymentStatus === 'paid' ? 'paid' : p.paymentStatus === 'proof_submitted' ? 'proof_submitted' : method === 'transfer' ? 'awaiting_transfer' : 'unpaid';
  return {
    id: str(raw.id),
    from: dateOrNull(p.start)!,
    to: dateOrNull(p.end) ?? '',
    meals: mealsIn(plan.days, plan.period),
    amount: plan.price,
    payment: {
      method,
      status,
      payBy: null,
      accounts: Array.isArray(raw.payTo) && raw.payTo.length ? list(raw.payTo, transferAccountSerializer) : null,
      reference: strOrNull(raw.paymentRef),
      proofUrl: null,
      // A refused receipt sends the period back to due, with the kitchen's reason.
      rejectedReason: due && bool(raw.hasProof) ? strOrNull(raw.reason) : null,
    },
  };
};

/** A subscription, as the customer (its plan, kitchen, what can be done) or the kitchen (its customer) sees it. */
export const tiffinSubscriptionSerializer = fromResponse((raw: unknown): TiffinSubscription | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const p = isObject(raw.plan) ? raw.plan : {};
  const status = TIFFIN_STATUS[str(raw.status)] ?? 'pending';
  const days = weekdays(p.days);
  const period = PERIOD[str(p.period)] ?? 'week';
  const price = count(p.pricePerPeriod);
  const method = TIFFIN_PAY[str(raw.paymentMethod)] ?? 'cash';
  const can = isObject(raw.can) ? raw.can : {};
  const next = dateOrNull(raw.nextMeal);
  return {
    code: str(raw.id),
    status,
    plan: {
      id: str(p.id) || str(raw.planId),
      name: str(p.name) || str(raw.planName),
      meal: oneOf(p.meal, MEALS, 'lunch'),
      days,
      period,
      price,
      perMeal: count(p.mealValue),
      mode: oneOf(p.deliveryMode, MODES, 'delivery'),
      window: windowSerializer(p.deliveryWindow),
      skipCutoffHour: Math.min(23, count(p.skipCutoffHour ?? 20)),
    },
    vendor: vendorSerializer(raw.vendor),
    customer: personSerializer(raw.customer),
    startDate: dateOrNull(raw.startsOn) ?? '',
    endDate: null,
    nextDelivery: next && (status === 'active' || status === 'pending') ? { date: next, dishes: dishNames(raw.nextDishes), cutoffAt: strOrNull(raw.nextCutoffAt) } : null,
    address: placeSerializer(raw.address),
    paymentMethod: method,
    period: periodSerializer(raw, method, { price, days, period }),
    pausedFrom: null,
    pausedUntil: dateOrNull(raw.pausedUntil),
    declineReason: status === 'declined' ? strOrNull(raw.reason) : null,
    endReason: status === 'cancelled' || status === 'ended' ? strOrNull(raw.reason) : null,
    canPause: bool(can.pause),
    canResume: bool(can.resume),
    canCancel: bool(can.cancel),
    createdAt: str(raw.approvedAt),
  };
});

export const tiffinSubscriptionsSerializer = fromResponse((raw: unknown): TiffinSubscription[] => list(raw, tiffinSubscriptionSerializer));

/** One of the customer's subscriptions, by its id. */
export const myTiffinSerializer = fromResponse((raw: unknown, id: string): TiffinSubscription | null => list(raw, tiffinSubscriptionSerializer).find(x => x.code === id) ?? null);

/** The kitchen's subscribers, counted (requests to approve, receipts to check). */
export const tiffinInboxSerializer = fromResponse((raw: unknown): TiffinInbox => {
  const items = tiffinSubscriptionsSerializer(raw);
  const n = (f: (x: TiffinSubscription) => boolean) => items.filter(f).length;
  return {
    counts: { pending: n(x => x.status === 'pending'), active: n(x => x.status === 'active'), paused: n(x => x.status === 'paused'), toCheck: n(x => x.period?.payment.status === 'proof_submitted') },
    items,
  };
});

export const tiffinDaySerializer = fromResponse((raw: unknown): TiffinDay | null =>
  isObject(raw) && dateOrNull(raw.date)
    ? {
        date: dateOrNull(raw.date)!,
        state: oneOf(raw.state, DAY_STATES, 'none'),
        dishes: dishNames(raw.dishes),
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

/** Tomorrow's tiffins per plan (counts and dishes; who gets them is the subscribers' list). */
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
            window: windowSerializer(p.window).label,
            dishes: dishNames(p.dishes),
            count: count(p.meals),
            skipped: count(p.skipped),
            paused: 0,
            cutoffAt: str(p.cutoffAt),
            deliveries: [],
          }
        : null,
    ),
  };
});

// ── Catering ──
/** Quote lines, priced per line. */
const quoteLines = (raw: unknown) =>
  list(raw, l => {
    if (!isObject(l) || !str(l.name)) return null;
    const qty = count(l.qty);
    const unitPrice = count(l.unitPrice);
    return { itemId: strOrNull(l.menuItemId), name: str(l.name), qty, unitPrice, total: qty * unitPrice };
  });

const quoteState = (version: number, latest: number, accepted: number | null, validUntil: string, now: number): QuoteState =>
  accepted === version ? 'accepted' : version !== latest ? 'outdated' : Date.parse(validUntil) <= now ? 'expired' : 'current';

/** The latest quote in full, and the earlier versions by their totals. */
const quotesOf = (raw: Record<string, unknown>, now: number): CateringQuote[] => {
  const q = isObject(raw.quote) ? raw.quote : null;
  const accepted = numOrNull(raw.acceptedVersion);
  const latest = q ? count(q.version) : 0;
  const full: CateringQuote[] = q
    ? (() => {
        const lines = quoteLines(q.lines);
        return [
          {
            version: latest,
            lines,
            subtotal: lines.reduce((n, l) => n + l.total, 0),
            deliveryFee: count(q.deliveryFee),
            total: count(q.total),
            advancePct: count(q.advancePct),
            advance: count(q.advance),
            validUntil: str(q.validUntil),
            notes: strOrNull(q.notes),
            createdAt: '',
            state: quoteState(latest, latest, accepted, str(q.validUntil), now),
          },
        ];
      })()
    : [];
  const older = list(raw.versions, v =>
    isObject(v) && count(v.version) && count(v.version) !== latest
      ? {
          version: count(v.version),
          lines: [],
          subtotal: count(v.total),
          deliveryFee: 0,
          total: count(v.total),
          advancePct: 0,
          advance: 0,
          validUntil: str(v.validUntil),
          notes: null,
          createdAt: '',
          state: quoteState(count(v.version), latest, accepted, str(v.validUntil), now),
        }
      : null,
  );
  return [...full, ...older];
};

/** Where the advance stands: sent to the kitchen's own account, then confirmed by them. */
const ADVANCE: Partial<Record<CateringStatus, FoodPaymentStatus>> = { accepted: 'awaiting_transfer', advance_proof: 'proof_submitted', confirmed: 'paid', completed: 'paid' };

/** A dawat request, as the customer (its kitchen) or the kitchen (its customer, the receipt) sees it. */
export const cateringRequestSerializer = fromResponse((raw: unknown, now: number = Date.now()): CateringRequest | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.code)) return null;
  const status = oneOf(raw.status, CATERING_STATUSES, 'requested');
  const quotes = quotesOf(raw, now);
  const current = quotes[0] ?? null;
  const accepted = numOrNull(raw.acceptedVersion);
  const date = dateOrNull(raw.eventDate) ?? '';
  const time = str(raw.eventTime).slice(0, 5);
  const advanceStatus = ADVANCE[status];
  const download = isObject(raw.advanceProofDownload) ? strOrNull(raw.advanceProofDownload.downloadUrl) : null;
  const reason = strOrNull(raw.reason);
  return {
    id: str(raw.id),
    code: str(raw.code),
    status,
    vendor: (() => {
      const v = isObject(raw.vendor) ? raw.vendor : {};
      return { id: str(v.id) || str(v.slug), slug: str(v.slug), name: str(v.name), logoUrl: strOrNull(v.logoUrl), phone: strOrNull(v.phone) };
    })(),
    customer: personSerializer(raw.customer),
    date,
    time,
    startsAt: date && time ? zonedToIso(date, time, PKT) : '',
    guests: count(raw.guests),
    eventType: oneOf(raw.eventType, EVENT_TYPES, 'other'),
    dishes: list(raw.requestedItems, d => (isObject(d) && str(d.name) ? { itemId: strOrNull(d.menuItemId), name: str(d.name), qty: count(d.qty) } : null)),
    budget: numOrNull(raw.budget),
    mode: oneOf(raw.fulfilment, CATERING_MODES, 'delivery'),
    address: placeSerializer(raw.address),
    notes: strOrNull(raw.notes),
    quotes,
    acceptedVersion: accepted,
    advance:
      advanceStatus && numOrNull(raw.advance) !== null
        ? {
            amount: count(raw.advance),
            status: advanceStatus,
            payBy: null,
            accounts: Array.isArray(raw.payTo) && raw.payTo.length ? list(raw.payTo, transferAccountSerializer) : null,
            reference: strOrNull(raw.advanceRef),
            proofUrl: download,
            // A refused receipt sends it back to accepted, with the kitchen's reason.
            rejectedReason: status === 'accepted' && bool(raw.hasAdvanceProof) ? reason : null,
          }
        : null,
    balance: accepted !== null && current ? Math.max(0, current.total - count(raw.advance)) : null,
    declineReason: status === 'declined' ? reason : null,
    cancelReason: status === 'cancelled' ? reason : null,
    canAccept: status === 'quoted' && current?.state === 'current',
    canCancel: ['requested', 'quoted', 'accepted', 'advance_proof'].includes(status),
    canQuote: ['requested', 'quoted'].includes(status),
    createdAt: '',
    updatedAt: '',
  };
});

export const cateringRequestsSerializer = fromResponse((raw: unknown): CateringRequest[] => list(raw, x => cateringRequestSerializer(x)));

/** A request found by the code people read (CT-…) among a list of them. */
export const cateringRequestByCodeSerializer = fromResponse((raw: unknown, code: string): CateringRequest | null =>
  list(raw, x => cateringRequestSerializer(x)).find(r => r.code === code.toUpperCase()) ?? null);

const PAST: CateringStatus[] = ['completed', 'declined', 'cancelled', 'expired'];

/** The kitchen's requests, counted: new, quoted (waiting on the customer), confirmed, past. */
export const cateringInboxSerializer = fromResponse((raw: unknown): CateringInbox => {
  const items = cateringRequestsSerializer(raw);
  const n = (f: (r: CateringRequest) => boolean) => items.filter(f).length;
  return {
    counts: {
      new: n(r => r.status === 'requested'),
      quoted: n(r => ['quoted', 'accepted', 'advance_proof'].includes(r.status)),
      confirmed: n(r => r.status === 'confirmed'),
      past: n(r => PAST.includes(r.status)),
    },
    items,
  };
});

export const cateringVendorSerializer = fromResponse((raw: unknown): CateringVendor | null =>
  isObject(raw) && str(raw.vendorId)
    ? {
        vendorId: str(raw.vendorId),
        open: bool(raw.open),
        minGuests: Math.max(1, count(raw.minGuests)),
        leadDays: count(raw.leadDays),
        earliestDate: dateOrNull(raw.earliestDate) ?? '',
        modes: enumListOf(raw.fulfilments, CATERING_MODES),
        menu: list(raw.menu, m => (isObject(m) && str(m.itemId) ? { itemId: str(m.itemId), name: str(m.name), price: count(m.price), photoUrl: strOrNull(m.photoUrl) } : null)),
      }
    : null);

/** The month's dawats, by day, from the kitchen's requests (those still on: requested to confirmed). */
export const cateringCalendarSerializer = fromResponse((raw: unknown, month: string): CateringCalendar => {
  const live = cateringRequestsSerializer(raw).filter(r => r.date.startsWith(month) && !['declined', 'cancelled', 'expired'].includes(r.status));
  const days = [...new Set(live.map(r => r.date))].sort();
  return {
    month,
    days: days.map(date => ({
      date,
      events: live
        .filter(r => r.date === date)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(r => ({ code: r.code, time: r.time, guests: r.guests, eventType: r.eventType, status: r.status, customerName: r.customer?.name ?? 'Customer' })),
    })),
  };
});

export const cateringSettingsSerializer = fromResponse((raw: unknown): CateringSettings => {
  const r = isObject(raw) ? raw : {};
  return { open: bool(r.open), minGuests: Math.max(1, count(r.minGuests) || 1), leadDays: count(r.leadDays) };
});

/** The vendor page with its tiffin plans (open ones) and whether it takes dawats, read beside it. */
export const vendorPageWithKitchenSerializer = (parts: { page: unknown; tiffinPlans: unknown; catering: unknown }): VendorPage | null => {
  const raw = bodiesOf(parts);
  const page = vendorPageSerializer(raw.page);
  if (!page) return null;
  const c = cateringVendorSerializer(raw.catering);
  return {
    ...page,
    tiffinPlans: list(raw.tiffinPlans, x => tiffinPlanCardSerializer(x)),
    catering: c ? { open: c.open, minGuests: c.minGuests, leadDays: c.leadDays } : null,
  };
};
