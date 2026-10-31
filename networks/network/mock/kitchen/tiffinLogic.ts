// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy tiffin rules (plans, subscriptions, the calendar)
// ═══════════════════════════════════════════════════════
// A plan is the same meal on set weekdays, paid per period (a week, or four
// weeks). A customer subscribes from a delivery day; the kitchen approves,
// and the first period's payment is due (a transfer to the kitchen's own
// account, or cash with the first delivery). A day can be skipped until the
// plan's cut-off before its window; meals skipped in one period come off
// the next. At the cut-off the day becomes an ordinary scheduled order on
// the kitchen's board (origin tiffin, paid by the plan), taken from stock
// like any accepted order. Mirrors docs/API_KITCHEN_ASSUMED.md §2.9, §3.9.

import type { MockDb } from '../mockDb';
import type { MockFoodOrder } from '../food/foodTypes';
import { addDays, formatSlot, isoWeekday, zonedToIso } from '../../../../utils/healthTime';
import type { MockTiffinDay, MockTiffinPeriod, MockTiffinPlan, MockTiffinSub } from './kitchenTypes';
import { HOUR, afterMove, isoNow, k, nextId, orderKitchenOf, todayOf, vendorOf } from './kitchenLogic';

export const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
export const MAX_PLANS = 6;
export const MAX_START_DAYS = 30;
/** Weeks in a "month" period: four, so every period has the same meals. */
export const WEEKS_IN_MONTH = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newTiffinCode = (db: MockDb) => {
  for (;;) {
    const c = `TF-${Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')}`;
    if (!k(db).tiffinSubs.some(x => x.code === c)) return c;
  }
};

export const mealsPerPeriod = (p: Pick<MockTiffinPlan, 'days' | 'period'>) => p.days.length * (p.period === 'week' ? 1 : WEEKS_IN_MONTH);
export const perMeal = (p: Pick<MockTiffinPlan, 'days' | 'period' | 'price'>) => Math.round(p.price / Math.max(1, mealsPerPeriod(p)));
export const periodDays = (p: Pick<MockTiffinPlan, 'period'>) => (p.period === 'week' ? 7 : 7 * WEEKS_IN_MONTH);

export const isPlanDay = (p: Pick<MockTiffinPlan, 'days'>, date: string) => p.days.includes(isoWeekday(date));

/** The moment a day can no longer be skipped (and its order is made). */
export const cutoffOf = (p: MockTiffinPlan, date: string, tz: string) => Date.parse(zonedToIso(date, p.windowFrom, tz)) - p.skipCutoffHours * HOUR;

export const windowLabel = (p: Pick<MockTiffinPlan, 'windowFrom' | 'windowTo'>, tz: string, date = '2026-01-05') =>
  `${formatSlot(zonedToIso(date, p.windowFrom, tz), tz)} – ${formatSlot(zonedToIso(date, p.windowTo, tz), tz)}`;

export const planOf = (db: MockDb, sub: Pick<MockTiffinSub, 'planId'>) => k(db).tiffinPlans.find(p => p.id === sub.planId)!;

/** Who holds a place: pending, active and paused subscriptions. */
export const seatsTaken = (db: MockDb, planId: string) => k(db).tiffinSubs.filter(s => s.planId === planId && ['pending', 'active', 'paused'].includes(s.status)).length;

export const dishesFor = (db: MockDb, p: MockTiffinPlan, weekday: number) => {
  const r = p.rotation.find(x => x.weekday === weekday);
  const items = (r?.itemIds ?? []).map(id => db.food.items.find(i => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
  return { items, note: r?.note ?? null, names: [...items.map(i => i.name), ...(r?.note ? [r.note] : [])] };
};

export const isPaused = (s: Pick<MockTiffinSub, 'pausedFrom' | 'pausedUntil'>, date: string) =>
  !!s.pausedFrom && date >= s.pausedFrom && (!s.pausedUntil || date <= s.pausedUntil);

export const dayRow = (db: MockDb, subId: string, date: string): MockTiffinDay | undefined => k(db).tiffinDays.find(d => d.subId === subId && d.date === date);

export type DayState = 'before_start' | 'off' | 'pending' | 'upcoming' | 'skipped' | 'paused' | 'ordered' | 'delivered' | 'cancelled' | 'ended' | 'none';

/** What a day is for a subscription, and whether it can still be skipped. */
export const dayOf = (db: MockDb, s: MockTiffinSub, date: string, now: number) => {
  const p = planOf(db, s);
  const v = vendorOf(db, s.businessId);
  const today = todayOf(v, now);
  const cutoffAt = cutoffOf(p, date, v.timezone);
  const row = dayRow(db, s.id, date);
  const order = row?.orderId ? db.food.orders.find(o => o.id === row.orderId) : undefined;
  let state: DayState;
  if (!isPlanDay(p, date)) state = 'off';
  else if (date < s.startDate) state = 'before_start';
  else if (row?.state === 'ordered')
    state = order ? (['delivered', 'picked_up'].includes(order.status) ? 'delivered' : ['cancelled', 'rejected', 'auto_rejected'].includes(order.status) ? 'cancelled' : 'ordered') : 'delivered';
  else if (row?.state === 'skipped') state = 'skipped';
  else if (s.endDate && date > s.endDate) state = 'ended';
  else if (['declined', 'cancelled', 'ended'].includes(s.status)) state = 'ended';
  else if (s.status === 'pending') state = 'pending';
  else if (isPaused(s, date)) state = 'paused';
  else if (date < today) state = 'none';
  else state = 'upcoming';
  const open = now < cutoffAt && ['active', 'paused'].includes(s.status);
  return {
    date,
    state,
    dishes: isPlanDay(p, date) ? dishesFor(db, p, isoWeekday(date)).names : [],
    cutoffAt: isPlanDay(p, date) ? isoNow(cutoffAt) : null,
    canSkip: state === 'upcoming' && open,
    canUnskip: state === 'skipped' && open,
    orderCode: order?.code ?? null,
  };
};

/** The next day something is delivered (or null). */
export const nextDelivery = (db: MockDb, s: MockTiffinSub, now: number) => {
  if (!['active', 'paused'].includes(s.status)) return null;
  const v = vendorOf(db, s.businessId);
  const today = todayOf(v, now);
  for (let n = 0; n < 60; n++) {
    const d = addDays(today < s.startDate ? s.startDate : today, n);
    const day = dayOf(db, s, d, now);
    if (day.state === 'upcoming' || day.state === 'ordered') return day;
  }
  return null;
};

// ── Periods ──
export const currentPeriod = (db: MockDb, s: MockTiffinSub, today: string): MockTiffinPeriod | null => {
  const mine = k(db).tiffinPeriods.filter(x => x.subId === s.id).sort((a, b) => a.from.localeCompare(b.from));
  return mine.find(x => x.from <= today && today <= x.to) ?? mine[mine.length - 1] ?? null;
};

const skippedIn = (db: MockDb, s: MockTiffinSub, from: string, to: string) => k(db).tiffinDays.filter(d => d.subId === s.id && d.state === 'skipped' && d.date >= from && d.date <= to).length;

/** A new period from `from`: the plan's price less the meals skipped in the one before. */
export const openPeriod = (db: MockDb, s: MockTiffinSub, from: string, now: number, previous: MockTiffinPeriod | null) => {
  const p = planOf(db, s);
  const v = vendorOf(db, s.businessId);
  const credit = previous ? skippedIn(db, s, previous.from, previous.to) : 0;
  const amount = Math.max(0, p.price - credit * perMeal(p));
  const transfer = s.paymentMethod === 'transfer';
  const period: MockTiffinPeriod = {
    id: nextId(db, 'tpd'),
    subId: s.id,
    businessId: s.businessId,
    from,
    to: addDays(from, periodDays(p) - 1),
    meals: mealsPerPeriod(p),
    credit,
    amount,
    paymentStatus: amount === 0 ? 'paid' : transfer ? 'awaiting_transfer' : 'unpaid',
    // A transfer is due by the end of the period's first day.
    payBy: transfer && amount > 0 ? zonedToIso(from, '23:59', v.timezone) : null,
    paymentRef: null,
    paymentProofUrl: null,
    paymentRejectedReason: null,
    createdAt: isoNow(now),
  };
  k(db).tiffinPeriods.push(period);
  return period;
};

/** Makes one tiffin day an order on the kitchen's board: accepted, for its window, paid by the plan. */
const makeOrder = (db: MockDb, s: MockTiffinSub, date: string, now: number): MockFoodOrder => {
  const p = planOf(db, s);
  const v = vendorOf(db, s.businessId);
  const { items, note } = dishesFor(db, p, isoWeekday(date));
  const price = perMeal(p);
  const lines = items.length
    ? items.map((i, n) => ({ itemId: i.id, name: i.name, unitPrice: n === 0 ? price : 0 }))
    : [{ itemId: `tiffin:${p.id}`, name: note ?? p.name, unitPrice: price }];
  const scheduledFor = zonedToIso(date, p.windowFrom, v.timezone);
  const at = isoNow(now);
  const order: MockFoodOrder = {
    id: nextId(db, 'fo'),
    code: newOrderCodeFor(db),
    userId: s.userId,
    businessId: s.businessId,
    fulfilment: p.mode,
    scheduledFor,
    slotId: null,
    portionDate: null,
    status: 'accepted',
    paymentMethod: 'tiffin_plan',
    paymentStatus: 'paid',
    payBy: null,
    accounts: null,
    paymentRef: s.code,
    paymentProofUrl: null,
    paymentRejectedReason: null,
    address: p.mode === 'delivery' && s.address ? { ...s.address, building: null, floor: null, riderInstructions: null } : null,
    distanceKm: null,
    items: lines.map(l => ({ id: nextId(db, 'oi'), itemId: l.itemId, name: l.name, variantId: null, variant: null, options: [], quantity: 1, unitPrice: l.unitPrice, lineTotal: l.unitPrice, notes: null, portions: 0 })),
    subtotal: price,
    discount: 0,
    deliveryFee: 0,
    total: price,
    promotion: null,
    cutlery: false,
    note: `Tiffin ${s.code}`,
    etaMinutes: null,
    promisedAt: zonedToIso(date, p.windowTo, v.timezone),
    acceptBy: null,
    riderId: null,
    riderStep: null,
    handedToExternal: false,
    codCollected: null,
    cancelledBy: null,
    cancelReason: null,
    placedAt: at,
    acceptedAt: at,
    preparingAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    cancelledAt: null,
    events: [
      { kind: 'status', from: null, to: 'placed', actorRole: 'system', note: `Tiffin ${s.code}`, at },
      { kind: 'status', from: 'placed', to: 'accepted', actorRole: 'system', note: `Tiffin ${s.code}`, at },
    ],
    updatedAt: at,
  };
  db.food.orders.push(order);
  orderKitchenOf(db, order.id).origin = { kind: 'tiffin', ref: s.code };
  // Taken from stock as any accepted order is.
  afterMove(db, order, 'placed', 'accepted', now);
  return order;
};

const newOrderCodeFor = (db: MockDb) => {
  for (;;) {
    const c = `FC-${Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')}`;
    if (!db.food.orders.some(o => o.code === c)) return c;
  }
};

/**
 * The minute jobs: a paused subscription resumes after its last paused day;
 * a new period opens when one ends; at each day's cut-off (and before its
 * window ends) the day becomes an order. Returns the orders made.
 */
export const settleTiffin = (db: MockDb, now: number): MockFoodOrder[] => {
  if (!db.kitchen?.tiffinSubs) return [];
  const made: MockFoodOrder[] = [];
  for (const s of k(db).tiffinSubs) {
    if (!['active', 'paused'].includes(s.status)) continue;
    const p = planOf(db, s);
    const v = vendorOf(db, s.businessId);
    if (!p || !v) continue;
    const today = todayOf(v, now);
    if (s.status === 'paused' && s.pausedUntil && s.pausedUntil < today) {
      s.status = 'active';
      s.pausedFrom = null;
      s.pausedUntil = null;
    }
    // A new period once the last one is over.
    const last = k(db).tiffinPeriods.filter(x => x.subId === s.id).sort((a, b) => b.from.localeCompare(a.from))[0];
    if (last && last.to < today && (!s.endDate || s.endDate > last.to)) openPeriod(db, s, addDays(last.to, 1), now, last);
    for (const date of [today, addDays(today, 1)]) {
      if (!isPlanDay(p, date) || date < s.startDate || (s.endDate && date > s.endDate) || isPaused(s, date)) continue;
      if (dayRow(db, s.id, date)) continue;
      if (now < cutoffOf(p, date, v.timezone)) continue;
      if (now >= Date.parse(zonedToIso(date, p.windowTo, v.timezone))) continue;
      const o = makeOrder(db, s, date, now);
      k(db).tiffinDays.push({ subId: s.id, date, state: 'ordered', orderId: o.id, at: isoNow(now) });
      made.push(o);
    }
  }
  return made;
};
