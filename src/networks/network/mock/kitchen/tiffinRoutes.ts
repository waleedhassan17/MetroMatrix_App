// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy tiffin routes (plans, subscriptions, periods)
// ═══════════════════════════════════════════════════════
// Customers: plans by kitchen, subscribing (Idempotency-Key), their
// subscriptions with a month calendar, skipping a day before its cut-off
// (409 TIFFIN_SKIP_CLOSED after), pausing, cancelling, and the period's
// transfer receipt. The kitchen: plans, subscribers (approve, decline,
// pause, end), period payments, and tomorrow's tiffins.
// Mirrors docs/API_KITCHEN_ASSUMED.md §2.9, §3.9, §4.6.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx } from '../shop/shopRoutes';
import type { MockFoodVendor } from '../food/foodTypes';
import { isVisible } from '../food/foodDiscovery';
import { addDays, isoWeekday } from '../../../../utils/healthTime';
import type { MockMeal, MockTiffinPeriod, MockTiffinPlan, MockTiffinSub } from './kitchenTypes';
import { DATE, KitchenError, invalid, isInt, isoNow, k, nextId, notFound, text, todayOf, vendorOf } from './kitchenLogic';
import {
  MAX_PLANS,
  MAX_START_DAYS,
  MEALS,
  currentPeriod,
  cutoffOf,
  dayOf,
  dayRow,
  dishesFor,
  isPlanDay,
  mealsPerPeriod,
  newTiffinCode,
  nextDelivery,
  openPeriod,
  perMeal,
  planOf,
  seatsTaken,
  windowLabel,
} from './tiffinLogic';
import type { KitchenKit } from './kitchenRoutes';

const enc = (s: string) => decodeURIComponent(s);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;

const accountsOf = (v: MockFoodVendor) => v.accounts.filter(a => a.isActive).map(a => ({ kind: a.kind, accountTitle: a.accountTitle, accountNumber: a.accountNumber, bankName: a.bankName }));

// ── Wire ──
export const planWire = (db: MockDb, p: MockTiffinPlan, now: number) => {
  const v = vendorOf(db, p.businessId);
  const taken = seatsTaken(db, p.id);
  return {
    id: p.id,
    vendor: { id: v.brandId, slug: v.slug, name: v.name, logoUrl: v.logoUrl, isHomeKitchen: v.kind === 'home_kitchen' },
    name: p.name,
    description: p.description,
    meal: p.meal,
    days: p.days,
    period: p.period,
    price: p.price,
    perMeal: perMeal(p),
    mealsPerPeriod: mealsPerPeriod(p),
    mode: p.mode,
    window: { from: p.windowFrom, to: p.windowTo, label: windowLabel(p, v.timezone) },
    capacity: p.capacity,
    subscribers: taken,
    seatsLeft: Math.max(0, p.capacity - taken),
    skipCutoffHours: p.skipCutoffHours,
    rotation: [...p.rotation]
      .sort((a, b) => a.weekday - b.weekday)
      .map(r => ({ weekday: r.weekday, dishes: dishesFor(db, p, r.weekday).items.map(i => ({ itemId: i.id, name: i.name, photoUrl: i.photoUrl })), note: r.note })),
    photoUrl: p.photoUrl,
    isActive: p.isActive,
    nextStart: firstStart(db, p, now),
  };
};

/** The vendor page's short form of a plan (an addition to API_FOOD's page). */
export const planCardWire = (db: MockDb, p: MockTiffinPlan) => {
  const v = vendorOf(db, p.businessId);
  return { id: p.id, name: p.name, meal: p.meal, days: p.days, period: p.period, price: p.price, perMeal: perMeal(p), window: windowLabel(p, v.timezone), seatsLeft: Math.max(0, p.capacity - seatsTaken(db, p.id)), photoUrl: p.photoUrl };
};

/** The earliest day a new subscription can start: a plan day whose cut-off hasn't passed. */
const firstStart = (db: MockDb, p: MockTiffinPlan, now: number) => {
  const v = vendorOf(db, p.businessId);
  const today = todayOf(v, now);
  for (let n = 0; n <= MAX_START_DAYS; n++) {
    const d = addDays(today, n);
    if (isPlanDay(p, d) && cutoffOf(p, d, v.timezone) > now) return d;
  }
  return null;
};

const periodWire = (db: MockDb, s: MockTiffinSub, x: MockTiffinPeriod | null) => {
  if (!x) return null;
  const v = vendorOf(db, s.businessId);
  return {
    id: x.id,
    from: x.from,
    to: x.to,
    meals: x.meals,
    credit: x.credit,
    amount: x.amount,
    payment: {
      method: s.paymentMethod,
      status: x.paymentStatus,
      payBy: x.paymentStatus === 'awaiting_transfer' ? x.payBy : null,
      accounts: s.paymentMethod === 'transfer' ? accountsOf(v) : null,
      reference: x.paymentRef,
      proofUrl: x.paymentProofUrl,
      rejectedReason: x.paymentRejectedReason,
    },
  };
};

export const subWire = (db: MockDb, s: MockTiffinSub, viewer: 'customer' | 'vendor', now: number) => {
  const p = planOf(db, s);
  const v = vendorOf(db, s.businessId);
  const u = db.users.find(x => x.id === s.userId);
  const today = todayOf(v, now);
  const next = nextDelivery(db, s, now);
  const a = s.address as Record<string, unknown> | null;
  return {
    code: s.code,
    status: s.status,
    plan: { id: p.id, name: p.name, meal: p.meal, days: p.days, period: p.period, price: p.price, perMeal: perMeal(p), mode: p.mode, window: { from: p.windowFrom, to: p.windowTo, label: windowLabel(p, v.timezone) }, skipCutoffHours: p.skipCutoffHours },
    vendor: { id: v.brandId, slug: v.slug, name: v.name, logoUrl: v.logoUrl, phone: v.phone },
    ...(viewer === 'vendor' ? { customer: { name: u?.name ?? 'Customer', phone: u?.phone ?? null } } : null),
    startDate: s.startDate,
    endDate: s.endDate,
    nextDelivery: next ? { date: next.date, dishes: next.dishes, cutoffAt: next.cutoffAt } : null,
    address: a ? { line1: a.line1 ?? null, area: a.area ?? null, city: a.city ?? null, lat: a.lat ?? null, lng: a.lng ?? null } : null,
    paymentMethod: s.paymentMethod,
    period: periodWire(db, s, currentPeriod(db, s, today)),
    pausedFrom: s.pausedFrom,
    pausedUntil: s.pausedUntil,
    declineReason: s.declineReason,
    endReason: s.endReason,
    canPause: s.status === 'active',
    canResume: s.status === 'paused',
    canCancel: viewer === 'customer' && ['pending', 'active', 'paused'].includes(s.status),
    createdAt: s.createdAt,
  };
};

const monthDays = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

export function registerTiffinRoutes(kit: KitchenKit) {
  const { route, myVendor, requireUser, optionalUser } = kit;

  const customer = (ctx: ShopCtx): MockUser => {
    const u = requireUser(ctx);
    if (u.role !== 'customer') throw new KitchenError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return u;
  };

  const visiblePlan = (ctx: ShopCtx, id: string) => {
    const p = k(ctx.db).tiffinPlans.find(x => x.id === id && x.isActive);
    const v = p ? ctx.db.food.vendors.find(x => x.businessId === p.businessId && isVisible(ctx.db, x)) : undefined;
    if (!p || !v) throw new KitchenError(404, 'NOT_FOUND', 'This tiffin plan isn’t available.');
    return { p, v };
  };

  const mySub = (ctx: ShopCtx, u: MockUser, code: string) => {
    const s = k(ctx.db).tiffinSubs.find(x => x.code === code.toUpperCase() && x.userId === u.id);
    if (!s) throw notFound('Subscription');
    return s;
  };

  const vendorSub = (ctx: ShopCtx, v: MockFoodVendor, code: string) => {
    const s = k(ctx.db).tiffinSubs.find(x => x.code === code.toUpperCase() && x.businessId === v.businessId);
    if (!s) throw notFound('Subscription');
    return s;
  };

  const notTransition = (s: MockTiffinSub) => new KitchenError(409, 'INVALID_TRANSITION', `This subscription is ${s.status}.`, { status: s.status });

  // ── Customers ──
  route('GET', '/food/tiffin/plans', ctx => {
    optionalUser(ctx);
    const key = text(ctx.query.vendor);
    const v = key ? ctx.db.food.vendors.find(x => (x.brandId === key || x.slug === key) && isVisible(ctx.db, x)) : undefined;
    if (key && !v) throw new KitchenError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    const plans = k(ctx.db).tiffinPlans.filter(p => p.isActive && (!v || p.businessId === v.businessId) && ctx.db.food.vendors.some(x => x.businessId === p.businessId && isVisible(ctx.db, x)));
    return { items: plans.map(p => planWire(ctx.db, p, ctx.now)) };
  });

  route('GET', '/food/tiffin/plans/:id', ctx => {
    optionalUser(ctx);
    return planWire(ctx.db, visiblePlan(ctx, enc(ctx.params[0])).p, ctx.now);
  });

  route('POST', '/food/tiffin/plans/:id/subscribe', ctx => {
    const u = customer(ctx);
    const key = ctx.headers['idempotency-key'];
    if (!key) throw new KitchenError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (a fresh UUID per attempt) so a retry can never subscribe twice.');
    const replay = k(ctx.db).idempotency[`${u.id}|tiffin|${key}`];
    if (replay) {
      const s = k(ctx.db).tiffinSubs.find(x => x.code === replay);
      if (s) {
        ctx.setStatus(201);
        return subWire(ctx.db, s, 'customer', ctx.now);
      }
    }
    const { p, v } = visiblePlan(ctx, enc(ctx.params[0]));
    const b = ctx.body;
    const startDate = text(b.startDate);
    const today = todayOf(v, ctx.now);
    if (!DATE.test(startDate) || startDate < today || startDate > addDays(today, MAX_START_DAYS)) throw invalid('startDate', `Start within the next ${MAX_START_DAYS} days.`);
    if (!isPlanDay(p, startDate)) throw invalid('startDate', 'Start on a day the plan is delivered.');
    if (cutoffOf(p, startDate, v.timezone) <= ctx.now) throw invalid('startDate', 'That day has closed. Start on a later day.');
    if (b.paymentMethod !== 'transfer' && b.paymentMethod !== 'cash') throw invalid('paymentMethod', 'paymentMethod must be transfer or cash');
    if (b.paymentMethod === 'transfer' && !accountsOf(v).length) throw new KitchenError(422, 'PAYMENT_METHOD_UNAVAILABLE', 'This kitchen takes cash only.');
    if (k(ctx.db).tiffinSubs.some(s => s.userId === u.id && s.planId === p.id && ['pending', 'active', 'paused'].includes(s.status)))
      throw new KitchenError(409, 'TIFFIN_ALREADY_SUBSCRIBED', 'You already have this plan.');
    if (seatsTaken(ctx.db, p.id) >= p.capacity) throw new KitchenError(409, 'TIFFIN_FULL', 'This plan is full. Ask the kitchen about a place.', { capacity: p.capacity });
    let address: Record<string, unknown> | null = null;
    if (p.mode === 'delivery') {
      const a = ctx.db.shop.addresses.find(x => x.id === text(b.addressId) && x.userId === u.id);
      if (!a || a.lat === null || a.lng === null) throw new KitchenError(422, 'ADDRESS_LOCATION_REQUIRED', 'Choose a delivery address with its pin on the map.');
      address = { label: a.label, fullName: a.fullName, phone: a.phone, city: a.city, area: a.area, line1: a.line1, landmark: a.landmark ?? null, lat: a.lat, lng: a.lng };
    }
    const s: MockTiffinSub = {
      id: nextId(ctx.db, 'ts'),
      code: newTiffinCode(ctx.db),
      planId: p.id,
      businessId: p.businessId,
      userId: u.id,
      status: 'pending',
      startDate,
      endDate: null,
      address,
      paymentMethod: b.paymentMethod,
      pausedFrom: null,
      pausedUntil: null,
      declineReason: null,
      endReason: null,
      createdAt: isoNow(ctx.now),
      approvedAt: null,
    };
    k(ctx.db).tiffinSubs.push(s);
    k(ctx.db).idempotency[`${u.id}|tiffin|${key}`] = s.code;
    ctx.setStatus(201);
    return subWire(ctx.db, s, 'customer', ctx.now);
  });

  route('GET', '/food/tiffin/subscriptions', ctx => {
    const u = customer(ctx);
    return {
      items: k(ctx.db)
        .tiffinSubs.filter(s => s.userId === u.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(s => subWire(ctx.db, s, 'customer', ctx.now)),
    };
  });

  route('GET', '/food/tiffin/subscriptions/:code', ctx => subWire(ctx.db, mySub(ctx, customer(ctx), enc(ctx.params[0])), 'customer', ctx.now));

  route('GET', '/food/tiffin/subscriptions/:code/calendar', ctx => {
    const s = mySub(ctx, customer(ctx), enc(ctx.params[0]));
    const v = vendorOf(ctx.db, s.businessId);
    const month = text(ctx.query.month) || todayOf(v, ctx.now).slice(0, 7);
    if (!MONTH.test(month)) throw invalid('month', 'month must be YYYY-MM');
    return { month, days: monthDays(month).map(d => dayOf(ctx.db, s, d, ctx.now)) };
  });

  const skipOrUnskip = (skip: boolean) => (ctx: ShopCtx) => {
    const s = mySub(ctx, customer(ctx), enc(ctx.params[0]));
    const date = enc(ctx.params[1]);
    if (!DATE.test(date)) throw invalid('date', 'date must be YYYY-MM-DD');
    const day = dayOf(ctx.db, s, date, ctx.now);
    if (skip ? day.canSkip : day.canUnskip) {
      if (skip) k(ctx.db).tiffinDays.push({ subId: s.id, date, state: 'skipped', orderId: null, at: isoNow(ctx.now) });
      else k(ctx.db).tiffinDays = k(ctx.db).tiffinDays.filter(d => !(d.subId === s.id && d.date === date && d.state === 'skipped'));
      return dayOf(ctx.db, s, date, ctx.now);
    }
    if (day.cutoffAt && Date.parse(day.cutoffAt) <= ctx.now && (day.state === 'upcoming' || day.state === 'skipped' || day.state === 'ordered'))
      throw new KitchenError(409, 'TIFFIN_SKIP_CLOSED', 'The kitchen has started on this day. Changes closed at the cut-off.', { cutoffAt: day.cutoffAt });
    throw new KitchenError(409, 'INVALID_TRANSITION', skip ? 'There is no delivery to skip that day.' : 'That day isn’t skipped.', { state: day.state });
  };
  route('POST', '/food/tiffin/subscriptions/:code/days/:date/skip', skipOrUnskip(true));
  route('POST', '/food/tiffin/subscriptions/:code/days/:date/unskip', skipOrUnskip(false));

  /** From the first day whose cut-off hasn't passed, until `until` (inclusive) or resumed. */
  const pause = (ctx: ShopCtx, s: MockTiffinSub) => {
    if (s.status !== 'active') throw notTransition(s);
    const p = planOf(ctx.db, s);
    const v = vendorOf(ctx.db, s.businessId);
    const today = todayOf(v, ctx.now);
    let from = today;
    while (cutoffOf(p, from, v.timezone) <= ctx.now) from = addDays(from, 1);
    const until = ctx.body.until === undefined || ctx.body.until === null ? null : text(ctx.body.until);
    if (until !== null && (!DATE.test(until) || until < from || until > addDays(today, 60))) throw invalid('until', 'Pause until a day within the next 60 days.');
    s.status = 'paused';
    s.pausedFrom = from;
    s.pausedUntil = until;
  };

  route('POST', '/food/tiffin/subscriptions/:code/pause', ctx => {
    const s = mySub(ctx, customer(ctx), enc(ctx.params[0]));
    pause(ctx, s);
    return subWire(ctx.db, s, 'customer', ctx.now);
  });

  route('POST', '/food/tiffin/subscriptions/:code/resume', ctx => {
    const s = mySub(ctx, customer(ctx), enc(ctx.params[0]));
    if (s.status !== 'paused') throw notTransition(s);
    s.status = 'active';
    s.pausedFrom = null;
    s.pausedUntil = null;
    return subWire(ctx.db, s, 'customer', ctx.now);
  });

  /** Ends after the last day already closed (made or past its cut-off). */
  const endSub = (ctx: ShopCtx, s: MockTiffinSub, status: 'cancelled' | 'ended', reason: string | null) => {
    const p = planOf(ctx.db, s);
    const v = vendorOf(ctx.db, s.businessId);
    let last = addDays(todayOf(v, ctx.now), -1);
    for (const d of [todayOf(v, ctx.now), addDays(todayOf(v, ctx.now), 1)]) if (isPlanDay(p, d) && (dayRow(ctx.db, s.id, d)?.state === 'ordered' || cutoffOf(p, d, v.timezone) <= ctx.now)) last = d;
    const wasPending = s.status === 'pending';
    s.status = status;
    // A request that was never approved had no deliveries.
    s.endDate = wasPending ? null : last;
    s.endReason = reason;
    for (const x of k(ctx.db).tiffinPeriods.filter(x => x.subId === s.id && x.from > last && x.paymentStatus !== 'paid')) x.paymentStatus = 'void';
  };

  route('POST', '/food/tiffin/subscriptions/:code/cancel', ctx => {
    const s = mySub(ctx, customer(ctx), enc(ctx.params[0]));
    if (!['pending', 'active', 'paused'].includes(s.status)) throw notTransition(s);
    endSub(ctx, s, 'cancelled', text(ctx.body.reason) || null);
    return subWire(ctx.db, s, 'customer', ctx.now);
  });

  route('POST', '/food/tiffin/periods/:id/payment-proof', ctx => {
    const u = customer(ctx);
    const x = k(ctx.db).tiffinPeriods.find(y => y.id === enc(ctx.params[0]));
    const s = x ? k(ctx.db).tiffinSubs.find(y => y.id === x.subId && y.userId === u.id) : undefined;
    if (!x || !s) throw notFound('Period');
    if (s.paymentMethod !== 'transfer' || x.paymentStatus !== 'awaiting_transfer') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no transfer waiting for this period.', { status: x.paymentStatus });
    const tx = text(ctx.body.transactionId);
    if (tx.length < 4 || tx.length > 40) throw invalid('transactionId', 'Enter the transaction ID from your receipt.');
    if (ctx.body.imageUrl !== undefined && ctx.body.imageUrl !== null && !IMAGE_URL.test(String(ctx.body.imageUrl))) throw invalid('imageUrl', 'Upload the receipt first.');
    x.paymentStatus = 'proof_submitted';
    x.paymentRef = tx;
    x.paymentProofUrl = ctx.body.imageUrl ?? null;
    x.paymentRejectedReason = null;
    return subWire(ctx.db, s, 'customer', ctx.now);
  });

  // ── The kitchen ──
  const myPlan = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const p = k(ctx.db).tiffinPlans.find(x => x.id === id && x.businessId === v.businessId);
    if (!p) throw notFound('Tiffin plan');
    return p;
  };

  /** The plan as sent; every field is checked against the menu and the API's limits. */
  const planIn = (ctx: ShopCtx, v: MockFoodVendor, b: Record<string, any>, current?: MockTiffinPlan): Omit<MockTiffinPlan, 'id' | 'businessId' | 'createdAt'> => {
    const pick = <T,>(key: string, fallback: T): T => (b[key] === undefined ? fallback : b[key]);
    const name = text(pick('name', current?.name ?? ''));
    if (name.length < 3 || name.length > 60) throw invalid('name', 'name must be 3 to 60 characters');
    const meal = pick<MockMeal>('meal', current?.meal ?? ('lunch' as MockMeal));
    if (!MEALS.includes(meal)) throw invalid('meal', 'meal must be breakfast, lunch or dinner');
    const days = pick<number[]>('days', current?.days ?? []);
    if (!Array.isArray(days) || !days.length || days.some(d => !isInt(d) || d < 1 || d > 7) || new Set(days).size !== days.length) throw invalid('days', 'days: weekdays 1 (Monday) to 7, at least one');
    const period = pick<'week' | 'month'>('period', current?.period ?? 'week');
    if (period !== 'week' && period !== 'month') throw invalid('period', 'period must be week or month');
    const price = pick<number>('price', current?.price ?? 0);
    if (!isInt(price) || price < 100 || price > 200_000) throw invalid('price', 'price must be whole rupees, 100 or more');
    const mode = pick<'delivery' | 'pickup'>('mode', current?.mode ?? 'delivery');
    if (mode !== 'delivery' && mode !== 'pickup') throw invalid('mode', 'mode must be delivery or pickup');
    const w = pick<{ from?: string; to?: string }>('window', current ? { from: current.windowFrom, to: current.windowTo } : {});
    if (!w || !HHMM.test(String(w.from)) || !HHMM.test(String(w.to)) || String(w.to) <= String(w.from)) throw invalid('window', 'window: from and to as HH:mm, to after from');
    const capacity = pick<number>('capacity', current?.capacity ?? 0);
    if (!isInt(capacity) || capacity < 1 || capacity > 500) throw invalid('capacity', 'capacity must be 1 to 500');
    if (current && capacity < seatsTaken(ctx.db, current.id)) throw invalid('capacity', `capacity can’t be under the ${seatsTaken(ctx.db, current.id)} subscribers you have`);
    const skipCutoffHours = pick<number>('skipCutoffHours', current?.skipCutoffHours ?? 12);
    if (!isInt(skipCutoffHours) || skipCutoffHours < 2 || skipCutoffHours > 48) throw invalid('skipCutoffHours', 'skipCutoffHours must be 2 to 48');
    const rotationIn = pick<any[]>('rotation', current?.rotation ?? []);
    if (!Array.isArray(rotationIn)) throw invalid('rotation', 'rotation must be a list');
    const mine = new Set(ctx.db.food.items.filter(i => i.businessId === v.businessId).map(i => i.id));
    const rotation = rotationIn.map((r, n) => {
      const field = `rotation.${n}`;
      if (!isInt(r?.weekday) || !days.includes(r.weekday)) throw invalid(`${field}.weekday`, 'Each day in the rotation is one of the plan’s days.');
      const itemIds = Array.isArray(r.itemIds) ? r.itemIds.map(String) : [];
      if (itemIds.some((id: string) => !mine.has(id)) || itemIds.length > 4) throw invalid(`${field}.itemIds`, 'Pick up to four dishes from your menu.');
      const note = text(r.note).slice(0, 80) || null;
      if (!itemIds.length && !note) throw invalid(`${field}.note`, 'Say what is cooked that day.');
      return { weekday: r.weekday, itemIds, note };
    });
    if (new Set(rotation.map(r => r.weekday)).size !== rotation.length) throw invalid('rotation', 'Each weekday once.');
    const photoUrl = pick<string | null>('photoUrl', current?.photoUrl ?? null);
    if (photoUrl !== null && !IMAGE_URL.test(String(photoUrl))) throw invalid('photoUrl', 'Upload the photo first.');
    const description = text(pick('description', current?.description ?? '')).slice(0, 300) || null;
    const isActive = pick<boolean>('isActive', current?.isActive ?? true);
    if (typeof isActive !== 'boolean') throw invalid('isActive', 'isActive must be true or false');
    return { name, description, meal, days: [...days].sort((a, c) => a - c), period, price, mode, windowFrom: w.from!, windowTo: w.to!, capacity, skipCutoffHours, rotation, photoUrl, isActive };
  };

  route('GET', '/food/vendor/tiffin/plans', ctx => {
    const v = myVendor(ctx);
    return { items: k(ctx.db).tiffinPlans.filter(p => p.businessId === v.businessId).map(p => planWire(ctx.db, p, ctx.now)) };
  });

  route('POST', '/food/vendor/tiffin/plans', ctx => {
    const v = myVendor(ctx);
    if (k(ctx.db).tiffinPlans.filter(p => p.businessId === v.businessId && p.isActive).length >= MAX_PLANS) throw new KitchenError(409, 'TIFFIN_PLAN_LIMIT', `Up to ${MAX_PLANS} tiffin plans.`, { max: MAX_PLANS });
    const p: MockTiffinPlan = { id: nextId(ctx.db, 'tp'), businessId: v.businessId, createdAt: isoNow(ctx.now), ...planIn(ctx, v, ctx.body) };
    k(ctx.db).tiffinPlans.push(p);
    ctx.setStatus(201);
    return planWire(ctx.db, p, ctx.now);
  });

  route('GET', '/food/vendor/tiffin/plans/:id', ctx => {
    const v = myVendor(ctx);
    return planWire(ctx.db, myPlan(ctx, v, enc(ctx.params[0])), ctx.now);
  });

  route('PATCH', '/food/vendor/tiffin/plans/:id', ctx => {
    const v = myVendor(ctx);
    const p = myPlan(ctx, v, enc(ctx.params[0]));
    Object.assign(p, planIn(ctx, v, ctx.body, p));
    return planWire(ctx.db, p, ctx.now);
  });

  route('DELETE', '/food/vendor/tiffin/plans/:id', ctx => {
    const v = myVendor(ctx);
    const p = myPlan(ctx, v, enc(ctx.params[0]));
    if (k(ctx.db).tiffinSubs.some(s => s.planId === p.id)) {
      if (seatsTaken(ctx.db, p.id)) throw new KitchenError(409, 'TIFFIN_HAS_SUBSCRIBERS', 'End its subscriptions first, or stop taking new ones.', { subscribers: seatsTaken(ctx.db, p.id) });
      p.isActive = false;
      return { removed: false, deactivated: true };
    }
    k(ctx.db).tiffinPlans = k(ctx.db).tiffinPlans.filter(x => x.id !== p.id);
    return { removed: true, deactivated: false };
  });

  const subsOf = (ctx: ShopCtx, v: MockFoodVendor, filter: (s: MockTiffinSub) => boolean) =>
    k(ctx.db)
      .tiffinSubs.filter(s => s.businessId === v.businessId && filter(s))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt))
      .map(s => subWire(ctx.db, s, 'vendor', ctx.now));

  const counts = (ctx: ShopCtx, v: MockFoodVendor, planId?: string) => {
    const mine = k(ctx.db).tiffinSubs.filter(s => s.businessId === v.businessId && (!planId || s.planId === planId));
    const proofs = k(ctx.db).tiffinPeriods.filter(x => x.businessId === v.businessId && x.paymentStatus === 'proof_submitted' && mine.some(s => s.id === x.subId)).length;
    return { pending: mine.filter(s => s.status === 'pending').length, active: mine.filter(s => s.status === 'active').length, paused: mine.filter(s => s.status === 'paused').length, toCheck: proofs };
  };

  route('GET', '/food/vendor/tiffin/plans/:id/subscribers', ctx => {
    const v = myVendor(ctx);
    const p = myPlan(ctx, v, enc(ctx.params[0]));
    return { counts: counts(ctx, v, p.id), items: subsOf(ctx, v, s => s.planId === p.id) };
  });

  route('GET', '/food/vendor/tiffin/subscriptions', ctx => {
    const v = myVendor(ctx);
    const status = ctx.query.status === undefined ? null : String(ctx.query.status);
    if (status !== null && !['pending', 'active', 'paused', 'ended'].includes(status)) throw invalid('status', 'status must be pending, active, paused or ended');
    return {
      counts: counts(ctx, v),
      items: subsOf(ctx, v, s => status === null || (status === 'ended' ? ['ended', 'cancelled', 'declined'].includes(s.status) : s.status === status)),
    };
  });

  route('POST', '/food/vendor/tiffin/subscriptions/:code/approve', ctx => {
    const v = myVendor(ctx);
    const s = vendorSub(ctx, v, enc(ctx.params[0]));
    if (s.status !== 'pending') throw notTransition(s);
    const p = planOf(ctx.db, s);
    // A start whose cut-off passed while it waited moves to the next open day.
    while (cutoffOf(p, s.startDate, v.timezone) <= ctx.now || !isPlanDay(p, s.startDate)) s.startDate = addDays(s.startDate, 1);
    s.status = 'active';
    s.approvedAt = isoNow(ctx.now);
    openPeriod(ctx.db, s, s.startDate, ctx.now, null);
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/tiffin/subscriptions/:code/decline', ctx => {
    const v = myVendor(ctx);
    const s = vendorSub(ctx, v, enc(ctx.params[0]));
    if (s.status !== 'pending') throw notTransition(s);
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 200) throw invalid('reason', 'Say why (3 to 200 characters).');
    s.status = 'declined';
    s.declineReason = reason;
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/tiffin/subscriptions/:code/pause', ctx => {
    const v = myVendor(ctx);
    const s = vendorSub(ctx, v, enc(ctx.params[0]));
    pause(ctx, s);
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/tiffin/subscriptions/:code/resume', ctx => {
    const v = myVendor(ctx);
    const s = vendorSub(ctx, v, enc(ctx.params[0]));
    if (s.status !== 'paused') throw notTransition(s);
    s.status = 'active';
    s.pausedFrom = null;
    s.pausedUntil = null;
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/tiffin/subscriptions/:code/end', ctx => {
    const v = myVendor(ctx);
    const s = vendorSub(ctx, v, enc(ctx.params[0]));
    if (!['active', 'paused'].includes(s.status)) throw notTransition(s);
    endSub(ctx, s, 'ended', text(ctx.body.reason).slice(0, 200) || null);
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  const myPeriod = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const x = k(ctx.db).tiffinPeriods.find(y => y.id === id && y.businessId === v.businessId);
    if (!x) throw notFound('Period');
    return { x, s: k(ctx.db).tiffinSubs.find(y => y.id === x.subId)! };
  };

  route('POST', '/food/vendor/tiffin/periods/:id/payment/confirm', ctx => {
    const v = myVendor(ctx);
    const { x, s } = myPeriod(ctx, v, enc(ctx.params[0]));
    if (!['awaiting_transfer', 'proof_submitted', 'unpaid'].includes(x.paymentStatus)) throw new KitchenError(409, 'INVALID_TRANSITION', 'There is nothing to confirm.', { status: x.paymentStatus });
    x.paymentStatus = 'paid';
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/tiffin/periods/:id/payment/reject', ctx => {
    const v = myVendor(ctx);
    const { x, s } = myPeriod(ctx, v, enc(ctx.params[0]));
    if (x.paymentStatus !== 'proof_submitted') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no receipt to reject.', { status: x.paymentStatus });
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 200) throw invalid('reason', 'Say why (3 to 200 characters).');
    x.paymentStatus = 'awaiting_transfer';
    x.paymentRejectedReason = reason;
    return subWire(ctx.db, s, 'vendor', ctx.now);
  });

  route('GET', '/food/vendor/tiffin/tomorrow', ctx => {
    const v = myVendor(ctx);
    const date = addDays(todayOf(v, ctx.now), 1);
    const plans = k(ctx.db).tiffinPlans.filter(p => p.businessId === v.businessId && isPlanDay(p, date));
    return {
      date,
      plans: plans.map(p => {
        const subs = k(ctx.db).tiffinSubs.filter(s => s.planId === p.id && ['active', 'paused'].includes(s.status));
        const rows = subs.map(s => ({ s, day: dayOf(ctx.db, s, date, ctx.now) })).filter(r => ['upcoming', 'ordered', 'skipped', 'paused'].includes(r.day.state));
        const cooking = rows.filter(r => r.day.state === 'upcoming' || r.day.state === 'ordered');
        return {
          planId: p.id,
          name: p.name,
          meal: p.meal,
          window: windowLabel(p, v.timezone),
          dishes: dishesFor(ctx.db, p, isoWeekday(date)).names,
          count: cooking.length,
          skipped: rows.filter(r => r.day.state === 'skipped').length,
          paused: rows.filter(r => r.day.state === 'paused').length,
          cutoffAt: isoNow(cutoffOf(p, date, v.timezone)),
          deliveries: rows.map(r => {
            const a = r.s.address as Record<string, unknown> | null;
            return { code: r.s.code, customerName: ctx.db.users.find(u => u.id === r.s.userId)?.name ?? 'Customer', area: (a?.area as string) ?? null, state: r.day.state, orderCode: r.day.orderCode };
          }),
        };
      }),
    };
  });
}
