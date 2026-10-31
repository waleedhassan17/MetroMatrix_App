// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Bachat Box routes (surplus food, sold for pickup)
// ═══════════════════════════════════════════════════════
// A kitchen puts tonight's surplus up as boxes at a lower price, picked up
// in a window today; customers nearby reserve (Idempotency-Key, one box
// can't be sold twice) and pay at pickup or by transfer to the kitchen.
// The kitchen collects by the customer's code, or marks a no-show; an
// unpaid transfer lapses and an uncollected box is a no-show an hour after
// the window, both by the minute jobs.
// Mirrors docs/API_KITCHEN_ASSUMED.md §4.4.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx } from '../shop/shopRoutes';
import type { MockFoodVendor } from '../food/foodTypes';
import { distanceKm, isVisible, PICKUP_REACH_KM } from '../food/foodDiscovery';
import { TRANSFER_WINDOW_MINUTES } from '../food/foodOrders';
import { addDays, dateInZone, zonedToIso } from '../../../../utils/health-time/healthTime';
import type { MockSurplusBox, MockSurplusReservation } from './kitchenTypes';
import { HOUR, KitchenError, MINUTE, invalid, isInt, isoNow, itemsOf, k, localHour, nextId, notFound, text, todayOf, vendorOf } from './kitchenLogic';
import { boxStatusOf, boxWire, reservationWire, surplusCardWire } from './kitchenWire';
import type { KitchenKit } from './kitchenRoutes';

const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;
export const MAX_LIVE_BOXES = 5;
export const MAX_PER_CUSTOMER = 2;
/** A Bachat Box is at least this much off what its food is worth. */
export const MIN_DISCOUNT = 0.2;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const enc = (s: string) => decodeURIComponent(s);

const newCode = (db: MockDb) => {
  for (;;) {
    const c = `BB-${Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')}`;
    if (!k(db).reservations.some(r => r.code === c)) return c;
  }
};

const leftOf = (db: MockDb, b: MockSurplusBox) =>
  b.quantity - k(db).reservations.filter(r => r.boxId === b.id && r.status !== 'cancelled').reduce((n, r) => n + r.quantity, 0);

/** The minute jobs: lapse unpaid transfers, no-show what wasn't collected an hour after the window. */
export const settleSurplus = (db: MockDb, now: number) => {
  if (!db.kitchen) return;
  for (const r of k(db).reservations) {
    if (r.status !== 'reserved') continue;
    const b = k(db).boxes.find(x => x.id === r.boxId);
    if (r.paymentStatus === 'awaiting_transfer' && r.payBy && Date.parse(r.payBy) < now) {
      r.status = 'cancelled';
      r.paymentStatus = 'void';
      r.cancelledAt = isoNow(now);
    } else if (b && Date.parse(b.pickupTo) + HOUR < now) {
      r.status = 'no_show';
      if (r.paymentStatus !== 'paid' && r.paymentStatus !== 'proof_submitted') r.paymentStatus = 'void';
    }
  }
};

export function registerSurplusRoutes(kit: KitchenKit) {
  const { route, myVendor, requireUser, optionalUser } = kit;

  const customer = (ctx: ShopCtx): MockUser => {
    const u = requireUser(ctx);
    if (u.role !== 'customer') throw new KitchenError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return u;
  };

  const myBox = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const b = k(ctx.db).boxes.find(x => x.id === id && x.businessId === v.businessId);
    if (!b) throw notFound('Bachat Box');
    return b;
  };

  const myReservation = (ctx: ShopCtx, v: MockFoodVendor, code: string) => {
    const r = k(ctx.db).reservations.find(x => x.code === code.toUpperCase() && x.businessId === v.businessId);
    if (!r) throw notFound('Reservation');
    return r;
  };

  const windowIn = (v: MockFoodVendor, raw: Record<string, any>, now: number, current?: MockSurplusBox) => {
    const from = raw.pickupFrom !== undefined ? Date.parse(String(raw.pickupFrom)) : current ? Date.parse(current.pickupFrom) : NaN;
    const to = raw.pickupTo !== undefined ? Date.parse(String(raw.pickupTo)) : current ? Date.parse(current.pickupTo) : NaN;
    if (!Number.isFinite(from)) throw invalid('pickupFrom', 'pickupFrom must be a time');
    if (!Number.isFinite(to)) throw invalid('pickupTo', 'pickupTo must be a time');
    if (to - from < 30 * MINUTE) throw invalid('pickupTo', 'Give customers at least 30 minutes to collect.');
    if (to <= now) throw invalid('pickupTo', 'The pickup window has to end later than now.');
    if (!current && from < now - HOUR) throw invalid('pickupFrom', 'The pickup window starts today.');
    // Tonight's food: the window ends by 2 AM.
    const today = todayOf(v, now);
    const lastEnd = Date.parse(zonedToIso(addDays(today, 1), '02:00', v.timezone));
    if (to > lastEnd) throw invalid('pickupTo', 'Bachat Boxes are for pickup today.');
    return { pickupFrom: isoNow(from), pickupTo: isoNow(to) };
  };

  // ── The kitchen ──
  route('GET', '/food/vendor/surplus', ctx => {
    const v = myVendor(ctx);
    const scope = String(ctx.query.scope ?? 'live');
    if (scope !== 'live' && scope !== 'past') throw invalid('scope', 'scope must be live or past');
    const mine = k(ctx.db).boxes.filter(b => b.businessId === v.businessId);
    const live = (b: MockSurplusBox) => ['live', 'sold_out'].includes(boxStatusOf(ctx.db, b, ctx.now));
    const items = (scope === 'live' ? mine.filter(live) : mine.filter(b => !live(b)).slice(-50))
      .sort((a, b) => (scope === 'live' ? a.pickupFrom.localeCompare(b.pickupFrom) : b.createdAt.localeCompare(a.createdAt)))
      .map(b => boxWire(ctx.db, b, ctx.now));
    return { items };
  });

  route('GET', '/food/vendor/surplus/suggestion', ctx => {
    const v = myVendor(ctx);
    const hour = localHour(v, ctx.now);
    if (hour < 17) return { suggestion: null };
    const today = todayOf(v, ctx.now);
    const items = itemsOf(ctx.db, v.businessId);
    // A home kitchen's leftover portions; a restaurant's mix of the day's popular dishes.
    const left = items.filter(i => i.override?.portionsDate === today && (i.override.remainingToday ?? 0) > 0);
    // On a quarter hour, at least 15 minutes from now (the form offers quarter hours too).
    const from = Math.max(Math.ceil((ctx.now + 15 * MINUTE) / (15 * MINUTE)) * 15 * MINUTE, Date.parse(zonedToIso(today, '21:00', v.timezone)));
    const to = Math.min(from + 2 * HOUR, Date.parse(zonedToIso(addDays(today, 1), '01:30', v.timezone)));
    if (left.length) {
      const value = left.reduce((n, i) => n + (i.override!.remainingToday ?? 0) * i.basePrice, 0);
      const quantity = Math.min(5, Math.max(1, Math.ceil(left.reduce((n, i) => n + (i.override!.remainingToday ?? 0), 0) / 2)));
      const per = Math.round(value / quantity / 10) * 10;
      return {
        suggestion: {
          title: 'Tonight’s handi box',
          contentsHint: left.map(i => i.name).join(', '),
          value: per,
          price: Math.max(50, Math.round((per * 0.4) / 10) * 10),
          quantity,
          pickupFrom: isoNow(from),
          pickupTo: isoNow(to),
          basis: 'portions_left',
        },
      };
    }
    const popular = [...items].sort((a, b) => b.sold30d - a.sold30d).slice(0, 3);
    return {
      suggestion: {
        title: 'Chef’s mix box',
        contentsHint: `Some of today’s ${popular.map(i => i.name.toLowerCase()).join(', ')}`,
        value: 1200,
        price: 450,
        quantity: 3,
        pickupFrom: isoNow(from),
        pickupTo: isoNow(to),
        basis: 'end_of_day',
      },
    };
  });

  route('POST', '/food/vendor/surplus', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    const title = text(b.title);
    if (title.length < 3 || title.length > 60) throw invalid('title', 'title must be 3 to 60 characters');
    const contentsHint = text(b.contentsHint);
    if (contentsHint.length < 3 || contentsHint.length > 200) throw invalid('contentsHint', 'Say roughly what is inside (3 to 200 characters).');
    if (!isInt(b.value) || b.value < 50 || b.value > 100_000) throw invalid('value', 'value must be whole rupees, 50 or more');
    if (!isInt(b.price) || b.price < 50) throw invalid('price', 'price must be whole rupees, 50 or more');
    if (b.price > Math.floor(b.value * (1 - MIN_DISCOUNT))) throw invalid('price', `A Bachat Box is at least ${MIN_DISCOUNT * 100}% off its value.`);
    if (!isInt(b.quantity) || b.quantity < 1 || b.quantity > 50) throw invalid('quantity', 'quantity must be 1 to 50');
    if (b.photoUrl !== undefined && b.photoUrl !== null && !IMAGE_URL.test(String(b.photoUrl))) throw invalid('photoUrl', 'Upload the photo first.');
    const live = k(ctx.db).boxes.filter(x => x.businessId === v.businessId && ['live', 'sold_out'].includes(boxStatusOf(ctx.db, x, ctx.now)));
    if (live.length >= MAX_LIVE_BOXES) throw new KitchenError(409, 'SURPLUS_LIMIT', `Up to ${MAX_LIVE_BOXES} Bachat Boxes at a time.`, { max: MAX_LIVE_BOXES });
    const box: MockSurplusBox = {
      id: nextId(ctx.db, 'sb'),
      businessId: v.businessId,
      title,
      contentsHint,
      photoUrl: b.photoUrl ?? null,
      value: b.value,
      price: b.price,
      quantity: b.quantity,
      ...windowIn(v, b, ctx.now),
      status: 'live',
      createdAt: isoNow(ctx.now),
    };
    k(ctx.db).boxes.push(box);
    ctx.setStatus(201);
    return boxWire(ctx.db, box, ctx.now);
  });

  route('GET', '/food/vendor/surplus/:id', ctx => {
    const v = myVendor(ctx);
    const b = myBox(ctx, v, enc(ctx.params[0]));
    return {
      ...boxWire(ctx.db, b, ctx.now),
      reservations: k(ctx.db)
        .reservations.filter(r => r.boxId === b.id)
        .sort((a, c) => a.reservedAt.localeCompare(c.reservedAt))
        .map(r => reservationWire(ctx.db, r, 'vendor', ctx.now)),
    };
  });

  route('PATCH', '/food/vendor/surplus/:id', ctx => {
    const v = myVendor(ctx);
    const b = myBox(ctx, v, enc(ctx.params[0]));
    if (b.status !== 'live') throw new KitchenError(409, 'SURPLUS_CLOSED', 'This Bachat Box has ended.');
    if (ctx.body.quantity !== undefined) {
      const reserved = b.quantity - leftOf(ctx.db, b);
      if (!isInt(ctx.body.quantity) || ctx.body.quantity < Math.max(1, reserved) || ctx.body.quantity > 50) throw invalid('quantity', `quantity must be ${Math.max(1, reserved)} to 50 (${reserved} reserved)`);
      b.quantity = ctx.body.quantity;
    }
    if (ctx.body.pickupTo !== undefined) Object.assign(b, windowIn(v, { pickupTo: ctx.body.pickupTo }, ctx.now, b));
    return boxWire(ctx.db, b, ctx.now);
  });

  route('POST', '/food/vendor/surplus/:id/end', ctx => {
    const v = myVendor(ctx);
    const b = myBox(ctx, v, enc(ctx.params[0]));
    // No more reservations; the ones made can still be collected.
    if (b.status === 'live') b.status = 'ended';
    return boxWire(ctx.db, b, ctx.now);
  });

  route('POST', '/food/vendor/surplus/reservations/:code/collect', ctx => {
    const v = myVendor(ctx);
    const r = myReservation(ctx, v, enc(ctx.params[0]));
    if (r.status !== 'reserved') throw new KitchenError(409, 'INVALID_TRANSITION', `This reservation is ${r.status.replace('_', ' ')}.`, { status: r.status });
    if (r.paymentMethod === 'transfer' && r.paymentStatus !== 'paid') throw new KitchenError(409, 'PAYMENT_NOT_CONFIRMED', 'Confirm the transfer before handing the box over.');
    r.status = 'collected';
    r.collectedAt = isoNow(ctx.now);
    if (r.paymentMethod === 'pay_at_pickup') r.paymentStatus = 'paid';
    return reservationWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/surplus/reservations/:code/no-show', ctx => {
    const v = myVendor(ctx);
    const r = myReservation(ctx, v, enc(ctx.params[0]));
    if (r.status !== 'reserved') throw new KitchenError(409, 'INVALID_TRANSITION', `This reservation is ${r.status.replace('_', ' ')}.`, { status: r.status });
    const b = k(ctx.db).boxes.find(x => x.id === r.boxId)!;
    if (Date.parse(b.pickupFrom) > ctx.now) throw new KitchenError(409, 'TOO_EARLY', 'The pickup window hasn’t started yet.');
    r.status = 'no_show';
    if (r.paymentStatus !== 'paid' && r.paymentStatus !== 'proof_submitted') r.paymentStatus = 'void';
    return reservationWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/surplus/reservations/:code/payment/confirm', ctx => {
    const v = myVendor(ctx);
    const r = myReservation(ctx, v, enc(ctx.params[0]));
    if (r.paymentMethod !== 'transfer' || !['proof_submitted', 'awaiting_transfer'].includes(r.paymentStatus)) throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no transfer to confirm.', { status: r.paymentStatus });
    r.paymentStatus = 'paid';
    return reservationWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/surplus/reservations/:code/payment/reject', ctx => {
    const v = myVendor(ctx);
    const r = myReservation(ctx, v, enc(ctx.params[0]));
    if (r.paymentStatus !== 'proof_submitted') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no receipt to reject.', { status: r.paymentStatus });
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 200) throw invalid('reason', 'Say why (3 to 200 characters).');
    r.paymentStatus = 'awaiting_transfer';
    r.paymentRejectedReason = reason;
    r.payBy = isoNow(ctx.now + 15 * MINUTE);
    return reservationWire(ctx.db, r, 'vendor', ctx.now);
  });

  // ── Customers ──
  const visibleBox = (ctx: ShopCtx, id: string) => {
    const b = k(ctx.db).boxes.find(x => x.id === id);
    const v = b ? ctx.db.food.vendors.find(x => x.businessId === b.businessId && isVisible(ctx.db, x)) : undefined;
    if (!b || !v) throw new KitchenError(404, 'NOT_FOUND', 'This Bachat Box is no longer available.');
    return { b, v };
  };

  const pointOf = (q: Record<string, any>) => {
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    return q.lat !== undefined && q.lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };

  route('GET', '/food/surplus', ctx => {
    optionalUser(ctx);
    const at = pointOf(ctx.query);
    if (!at) throw invalid('lat', 'lat and lng are required');
    const items = k(ctx.db)
      .boxes.filter(b => boxStatusOf(ctx.db, b, ctx.now) === 'live')
      .map(b => {
        const v = ctx.db.food.vendors.find(x => x.businessId === b.businessId);
        if (!v || !isVisible(ctx.db, v) || v.lat === null || v.lng === null) return null;
        const d = Math.round(distanceKm(at, { lat: v.lat, lng: v.lng }) * 10) / 10;
        return d <= PICKUP_REACH_KM ? { b, d } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, c) => a.d - c.d || a.b.pickupTo.localeCompare(c.b.pickupTo))
      .slice(0, 20)
      .map(x => surplusCardWire(ctx.db, x.b, x.d, ctx.now));
    return { items };
  });

  route('GET', '/food/surplus/reservations', ctx => {
    const u = customer(ctx);
    return {
      items: k(ctx.db)
        .reservations.filter(r => r.userId === u.id)
        .sort((a, b) => b.reservedAt.localeCompare(a.reservedAt))
        .map(r => reservationWire(ctx.db, r, 'customer', ctx.now)),
    };
  });

  const mine = (ctx: ShopCtx, u: MockUser, code: string): MockSurplusReservation => {
    const r = k(ctx.db).reservations.find(x => x.code === code.toUpperCase() && x.userId === u.id);
    if (!r) throw notFound('Reservation');
    return r;
  };

  route('GET', '/food/surplus/reservations/:code', ctx => reservationWire(ctx.db, mine(ctx, customer(ctx), enc(ctx.params[0])), 'customer', ctx.now));

  route('POST', '/food/surplus/reservations/:code/cancel', ctx => {
    const u = customer(ctx);
    const r = mine(ctx, u, enc(ctx.params[0]));
    const b = k(ctx.db).boxes.find(x => x.id === r.boxId)!;
    if (r.status !== 'reserved') throw new KitchenError(409, 'INVALID_TRANSITION', `This reservation is ${r.status.replace('_', ' ')}.`, { status: r.status });
    if (Date.parse(b.pickupFrom) <= ctx.now) throw new KitchenError(409, 'CANCEL_NOT_ALLOWED', 'The pickup window has started. Call the kitchen if you can’t make it.');
    if (r.paymentStatus === 'paid') throw new KitchenError(409, 'CANCEL_NOT_ALLOWED', 'You’ve paid already. Call the kitchen to cancel.');
    r.status = 'cancelled';
    r.cancelledAt = isoNow(ctx.now);
    r.paymentStatus = 'void';
    return reservationWire(ctx.db, r, 'customer', ctx.now);
  });

  route('POST', '/food/surplus/reservations/:code/payment-proof', ctx => {
    const u = customer(ctx);
    const r = mine(ctx, u, enc(ctx.params[0]));
    if (r.paymentMethod !== 'transfer' || r.status !== 'reserved' || !['awaiting_transfer'].includes(r.paymentStatus)) {
      throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no transfer waiting on this reservation.', { status: r.paymentStatus });
    }
    const tx = text(ctx.body.transactionId);
    if (tx.length < 4 || tx.length > 40) throw invalid('transactionId', 'Enter the transaction ID from your receipt.');
    if (ctx.body.imageUrl !== undefined && ctx.body.imageUrl !== null && !IMAGE_URL.test(String(ctx.body.imageUrl))) throw invalid('imageUrl', 'Upload the receipt first.');
    r.paymentStatus = 'proof_submitted';
    r.paymentRef = tx;
    r.paymentProofUrl = ctx.body.imageUrl ?? null;
    r.paymentRejectedReason = null;
    return reservationWire(ctx.db, r, 'customer', ctx.now);
  });

  route('GET', '/food/surplus/:id', ctx => {
    const user = optionalUser(ctx);
    const { b, v } = visibleBox(ctx, enc(ctx.params[0]));
    const at = pointOf(ctx.query);
    const d = at && v.lat !== null && v.lng !== null ? Math.round(distanceKm(at, { lat: v.lat, lng: v.lng }) * 10) / 10 : null;
    const accounts = v.accounts.filter(a => a.isActive);
    const reserved = user ? k(ctx.db).reservations.filter(r => r.boxId === b.id && r.userId === user.id && r.status !== 'cancelled') : [];
    return {
      ...surplusCardWire(ctx.db, b, d, ctx.now),
      whatToExpect: 'A surprise selection of today’s food from this kitchen, packed fresh tonight. What is inside depends on what is left.',
      pickup: { addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng, phone: v.phone },
      paymentMethods: accounts.length ? ['pay_at_pickup', 'transfer'] : ['pay_at_pickup'],
      maxPerCustomer: MAX_PER_CUSTOMER,
      myReservations: reserved.map(r => r.code),
    };
  });

  route('POST', '/food/surplus/:id/reserve', ctx => {
    const u = customer(ctx);
    const key = ctx.headers['idempotency-key'];
    if (!key) throw new KitchenError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (a fresh UUID per attempt) so a retry can never reserve twice.');
    const replay = k(ctx.db).idempotency[`${u.id}|${key}`];
    if (replay) {
      const r = k(ctx.db).reservations.find(x => x.code === replay);
      if (r) {
        ctx.setStatus(201);
        return reservationWire(ctx.db, r, 'customer', ctx.now);
      }
    }
    const { b, v } = visibleBox(ctx, enc(ctx.params[0]));
    const qty = ctx.body.quantity ?? 1;
    if (!isInt(qty) || qty < 1 || qty > MAX_PER_CUSTOMER) throw invalid('quantity', `quantity must be 1 to ${MAX_PER_CUSTOMER}`);
    const method = ctx.body.paymentMethod;
    if (method !== 'pay_at_pickup' && method !== 'transfer') throw invalid('paymentMethod', 'paymentMethod must be pay_at_pickup or transfer');
    const status = boxStatusOf(ctx.db, b, ctx.now);
    if (status === 'ended' || status === 'cancelled') throw new KitchenError(409, 'SURPLUS_CLOSED', 'This Bachat Box has closed for today.');
    const left = leftOf(ctx.db, b);
    if (left < qty) throw new KitchenError(409, 'SURPLUS_SOLD_OUT', left > 0 ? `Only ${left} left.` : 'Someone just reserved the last one.', { left });
    const held = k(ctx.db).reservations.filter(r => r.boxId === b.id && r.userId === u.id && r.status !== 'cancelled').reduce((n, r) => n + r.quantity, 0);
    if (held + qty > MAX_PER_CUSTOMER) throw new KitchenError(422, 'SURPLUS_LIMIT', `Up to ${MAX_PER_CUSTOMER} per person, so more people get one.`, { max: MAX_PER_CUSTOMER, held });
    if (method === 'transfer' && !v.accounts.some(a => a.isActive)) throw new KitchenError(422, 'PAYMENT_METHOD_UNAVAILABLE', 'This kitchen takes payment at pickup only.');
    const r: MockSurplusReservation = {
      id: nextId(ctx.db, 'sr'),
      code: newCode(ctx.db),
      boxId: b.id,
      businessId: b.businessId,
      userId: u.id,
      quantity: qty,
      total: b.price * qty,
      status: 'reserved',
      paymentMethod: method,
      paymentStatus: method === 'transfer' ? 'awaiting_transfer' : 'unpaid',
      payBy: method === 'transfer' ? isoNow(ctx.now + TRANSFER_WINDOW_MINUTES * MINUTE) : null,
      paymentRef: null,
      paymentProofUrl: null,
      paymentRejectedReason: null,
      reservedAt: isoNow(ctx.now),
      collectedAt: null,
      cancelledAt: null,
    };
    k(ctx.db).reservations.push(r);
    k(ctx.db).idempotency[`${u.id}|${key}`] = r.code;
    ctx.setStatus(201);
    return reservationWire(ctx.db, r, 'customer', ctx.now);
  });

  void vendorOf;
  void dateInZone;
}
