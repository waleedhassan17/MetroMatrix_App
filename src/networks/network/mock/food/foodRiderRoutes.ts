// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food rider routes (riders on orders)
// ═══════════════════════════════════════════════════════
// The vendor gives a delivery to one of its own riders (MetroMatrix never
// dispatches); the rider moves through the steps — accept, at the kitchen,
// picked up (ready → on the way), at the customer, delivered (cash onto
// their ledger) — or declines before pickup; the vendor takes the cash back
// with a handover. GPS fixes come over the socket (`rider.location`) or the
// REST batch and fan out to each order's room, at most once every 4 s.
// Mirrors the API's rider-delivery, riders and rider-location services
// (docs/API_FOOD.md §3 rider steps, §4.3 Riders, §4.4).

import type { MockDb } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { mockRealtime } from '../mockRealtime';
import { FoodError, invalid, isoNow, nextId, text } from './foodLogic';
import { STATUS_LABEL, invalidTransition, move, vendorOrderView } from './foodOrders';
import { distanceKm } from './foodDiscovery';
import { emitOrder, rooms } from './foodRealtime';
import type { MockFoodOrder, MockFoodVendor, MockRider } from './foodTypes';

const MINUTE = 60_000;
/** A position is live for two minutes (FinMatrix's presence rule). */
export const LOCATION_LIVE_MS = 2 * MINUTE;
/** rider.location fans out at most once per order every 4 s. */
export const LOCATION_FANOUT_MS = 4_000;
const ASSIGNABLE: MockFoodOrder['status'][] = ['accepted', 'preparing', 'ready'];
const RIDER_ACTIVE: MockFoodOrder['status'][] = ['accepted', 'preparing', 'ready', 'on_the_way'];

type Step = 'assigned' | 'accepted_by_rider' | 'arrived_at_branch' | 'picked_up' | 'arrived_at_customer' | 'delivered' | 'declined';
const STEPS: Record<Step, Step[]> = {
  assigned: ['accepted_by_rider', 'picked_up', 'declined'],
  accepted_by_rider: ['arrived_at_branch', 'picked_up', 'declined'],
  arrived_at_branch: ['picked_up', 'declined'],
  picked_up: ['arrived_at_customer', 'delivered'],
  arrived_at_customer: ['delivered'],
  delivered: [],
  declined: [],
};

const isLive = (at: string | null, now: number) => !!at && now - Date.parse(at) <= LOCATION_LIVE_MS;
const vendorOf = (db: MockDb, o: MockFoodOrder) => db.food.vendors.find(v => v.businessId === o.businessId)!;

/** What a rider needs: where to collect, where to drop, what to collect. */
export const riderOrderView = (db: MockDb, o: MockFoodOrder) => {
  const v = vendorOf(db, o);
  const a = o.address as Record<string, any> | null;
  const step = (o.riderStep as Step | null) ?? null;
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    riderStep: step,
    nextSteps: step && RIDER_ACTIVE.includes(o.status) ? STEPS[step].filter(s => s !== 'picked_up' || o.status === 'ready') : [],
    pickup: { name: v.name, phone: v.phone, addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng },
    drop: a
      ? {
          name: a.fullName ?? null,
          phone: a.phone ?? null,
          line1: a.line1 ?? null,
          area: a.area ?? null,
          city: a.city ?? null,
          landmark: a.landmark ?? null,
          building: a.building ?? null,
          floor: a.floor ?? null,
          riderInstructions: a.riderInstructions ?? null,
          lat: a.lat ?? null,
          lng: a.lng ?? null,
        }
      : null,
    items: o.items.map(i => ({ name: i.name, variant: i.variant, options: i.options.map(x => x.name), quantity: i.quantity })),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    cutlery: o.cutlery,
    note: o.note,
    payment: { method: o.paymentMethod, status: o.paymentStatus },
    total: o.total,
    cashToCollect: o.paymentMethod === 'cod' && o.paymentStatus === 'cod_pending' ? o.total : 0,
    codCollected: o.codCollected,
    readyAt: o.readyAt,
    promisedAt: o.promisedAt,
  };
};

export const cashView = (db: MockDb, riderId: string) => {
  const mine = db.food.cash.filter(c => c.riderId === riderId);
  return {
    riderId,
    balance: mine.reduce((s, c) => s + c.amount, 0),
    // Newest first; same time: the later entry first (the API's created_at tie-break).
    entries: mine
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.at.localeCompare(a.c.at) || b.i - a.i)
      .map(({ c }) => c)
      .slice(0, 50)
      .map(c => ({ id: c.id, kind: c.kind, amount: c.amount, orderCode: c.orderId ? (db.food.orders.find(o => o.id === c.orderId)?.code ?? null) : null, note: c.note, at: c.at })),
  };
};

/** COD delivered by a rider: the cash goes on their ledger. */
export const recordCod = (db: MockDb, o: MockFoodOrder, now: number) => {
  if (!o.riderId || o.paymentMethod !== 'cod' || !o.codCollected) return;
  db.food.cash.push({ id: nextId(db, 'cash'), riderId: o.riderId, orderId: o.id, kind: 'cod_collected', amount: o.codCollected, note: null, at: isoNow(now) });
};

const releaseRider = (db: MockDb, riderId: string) => {
  const r = db.food.riders.find(x => x.id === riderId);
  if (r) r.activeOrderCount = Math.max(0, r.activeOrderCount - 1);
};

const lastFanOut = new Map<string, number>();

export interface LocationPoint {
  orderId?: unknown;
  lat?: unknown;
  lng?: unknown;
  heading?: unknown;
  speed?: unknown;
  accuracy?: unknown;
  at?: unknown;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A rider's fixes: on duty, for their own orders; the newest is their position, fanned out to each order. */
export const recordLocation = (db: MockDb, r: MockRider, points: LocationPoint[], now: number): { ok: true; accepted: number } | { ok: false; code: string; message: string } => {
  if (r.status !== 'active' || !r.onDuty) return { ok: false, code: 'RIDER_NOT_AVAILABLE', message: 'Go on duty to share your location.' };
  const active = db.food.orders.filter(o => o.riderId === r.id && RIDER_ACTIVE.includes(o.status)).map(o => o.id);
  if (points.some(p => typeof p.orderId === 'string' && !active.includes(p.orderId))) return { ok: false, code: 'RIDER_NOT_ASSIGNED', message: 'That order isn’t assigned to you.' };
  const fixes = points
    .map(p => {
      const at = typeof p.at === 'string' && !Number.isNaN(Date.parse(p.at)) ? Math.min(Date.parse(p.at), now) : now;
      return { orderId: typeof p.orderId === 'string' ? p.orderId : null, lat: num(p.lat)!, lng: num(p.lng)!, heading: num(p.heading), speed: num(p.speed), at };
    })
    .sort((a, b) => a.at - b.at);
  const last = fixes[fixes.length - 1];
  if (!r.locationUpdatedAt || Date.parse(r.locationUpdatedAt) <= last.at) {
    r.lastGeo = { lat: last.lat, lng: last.lng };
    r.locationUpdatedAt = isoNow(last.at);
  }
  for (const orderId of last.orderId ? [last.orderId] : active) {
    if (now - (lastFanOut.get(orderId) ?? 0) < LOCATION_FANOUT_MS) continue;
    lastFanOut.set(orderId, now);
    mockRealtime.emitToRoom(rooms.order(orderId), 'rider.location', { orderId, lat: last.lat, lng: last.lng, heading: last.heading, speed: last.speed, at: isoNow(last.at) });
  }
  return { ok: true, accepted: fixes.length };
};

const validPoint = (p: LocationPoint) =>
  !!p && typeof p === 'object' && num(p.lat) !== null && Math.abs(p.lat as number) <= 90 && num(p.lng) !== null && Math.abs(p.lng as number) <= 180;

export interface RiderRouteDeps {
  route: ShopKit['route'];
  myVendor: (ctx: ShopCtx) => MockFoodVendor;
  meRider: (ctx: ShopCtx) => { rider: MockRider; vendor: MockFoodVendor };
}

export function registerRiderRoutes({ route, myVendor, meRider }: RiderRouteDeps) {
  const myOrder = (ctx: ShopCtx, r: MockRider) => {
    const o = ctx.db.food.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.riderId === r.id);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    return o;
  };
  const ownRider = (ctx: ShopCtx, v: MockFoodVendor, id: string) => {
    const r = ctx.db.food.riders.find(x => x.id === decodeURIComponent(id) && x.businessId === v.businessId);
    if (!r) throw new FoodError(404, 'NOT_FOUND', 'Rider not found.');
    return r;
  };

  // ── The rider ──
  route('PATCH', '/food/rider/duty', ctx => {
    const { rider } = meRider(ctx);
    if (typeof ctx.body.onDuty !== 'boolean') throw invalid('onDuty', 'onDuty must be a boolean value');
    rider.onDuty = ctx.body.onDuty;
    return { onDuty: rider.onDuty };
  });

  route('POST', '/food/rider/location', ctx => {
    const { rider } = meRider(ctx);
    const points = ctx.body.points;
    if (!Array.isArray(points) || !points.length || points.length > 100) throw invalid('points', 'points must contain at least 1 elements');
    if (!points.every(validPoint)) throw invalid('points', 'each point needs a latitude and a longitude');
    const res = recordLocation(ctx.db, rider, points, ctx.now);
    if (!res.ok) throw new FoodError(409, res.code, res.message);
    ctx.setStatus(200);
    return { accepted: res.accepted };
  });

  route('GET', '/food/rider/orders', ctx => {
    const { rider } = meRider(ctx);
    const scope = ctx.query.scope ?? 'active';
    if (scope !== 'active' && scope !== 'history') throw invalid('scope', 'scope must be one of the following values: active, history');
    const rows = ctx.db.food.orders
      .filter(o => o.riderId === rider.id && (scope === 'active' ? RIDER_ACTIVE.includes(o.status) : o.status === 'delivered' || o.status === 'cancelled'))
      .sort((a, b) => (scope === 'history' ? b.placedAt.localeCompare(a.placedAt) : a.placedAt.localeCompare(b.placedAt)) || a.id.localeCompare(b.id));
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 20));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(o => riderOrderView(ctx.db, o)), total: rows.length, page, pageSize };
  });

  route('GET', '/food/rider/orders/:id', ctx => riderOrderView(ctx.db, myOrder(ctx, meRider(ctx).rider)));

  /** One rider step: checked against the steps, recorded, said live. */
  const step = (path: string, to: Step, work?: (ctx: ShopCtx, o: MockFoodOrder, r: MockRider) => void) =>
    route('POST', `/food/rider/orders/:id/${path}`, ctx => {
      const { rider } = meRider(ctx);
      const o = myOrder(ctx, rider);
      const from = ((o.riderStep as Step | null) ?? 'assigned') as Step;
      if (!STEPS[from].includes(to)) throw invalidTransition(from, to, STEPS[from]);
      work?.(ctx, o, rider);
      if (to !== 'declined') o.riderStep = to;
      o.updatedAt = isoNow(ctx.now);
      o.events.push({ kind: 'rider', from: null, to, actorRole: 'rider', note: to === 'declined' ? text(ctx.body.reason) : null, at: isoNow(ctx.now) });
      emitOrder(ctx.db, o, 'updated');
      ctx.setStatus(200);
      return to === 'declined' ? { declined: true, orderId: o.id } : riderOrderView(ctx.db, o);
    });

  step('accept', 'accepted_by_rider');
  step('decline', 'declined', (ctx, o, r) => {
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 300) throw invalid('reason', 'reason must be longer than or equal to 3 characters');
    o.riderId = null;
    o.riderStep = null;
    releaseRider(ctx.db, r.id);
  });
  step('arrived-branch', 'arrived_at_branch');
  step('picked-up', 'picked_up', (ctx, o) => {
    if (o.status !== 'ready') throw invalidTransition(o.status, 'on_the_way', [], 'The kitchen hasn’t marked this order ready yet.');
    move(ctx.db, o, 'on_the_way', 'rider', ctx.now);
  });
  step('arrived-customer', 'arrived_at_customer');
  step('delivered', 'delivered', (ctx, o) => {
    const c = ctx.body.codCollected;
    if (c !== undefined && !(typeof c === 'number' && Number.isInteger(c) && c >= 0)) throw invalid('codCollected', 'codCollected must not be less than 0');
    let cod: number | null = null;
    if (o.paymentMethod === 'cod') {
      cod = c ?? o.total;
      if (cod! > o.total)
        throw new FoodError(400, 'VALIDATION_FAILED', `Cash collected can’t be more than the order total (Rs ${o.total.toLocaleString('en-PK')}).`, {
          fields: { codCollected: [`at most ${o.total}`] },
        });
    }
    move(ctx.db, o, 'delivered', 'rider', ctx.now, { patch: { codCollected: cod } });
    recordCod(ctx.db, o, ctx.now);
  });

  route('GET', '/food/rider/cash', ctx => cashView(ctx.db, meRider(ctx).rider.id));

  // ── The vendor ──
  route('POST', '/food/vendor/orders/:id/assign', ctx => {
    const v = myVendor(ctx);
    const o = ctx.db.food.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.businessId === v.businessId);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    if (typeof ctx.body.riderId !== 'string' || !ctx.body.riderId) throw invalid('riderId', 'riderId must be a UUID');
    if (o.fulfilment !== 'delivery') throw invalidTransition(o.status, 'assigned', [], 'Pickup orders don’t need a rider.');
    if (!ASSIGNABLE.includes(o.status) || o.handedToExternal) throw invalidTransition(o.status, 'assigned', [], 'Assign a rider after accepting the order and before it leaves.');
    ctx.setStatus(200);
    if (o.riderId === ctx.body.riderId) return vendorOrderView(ctx.db, o, ctx.now);
    const r = ctx.db.food.riders.find(x => x.id === ctx.body.riderId && x.businessId === v.businessId);
    if (!r) throw new FoodError(404, 'NOT_FOUND', 'Rider not found.');
    if (r.status !== 'active' || !r.onDuty)
      throw new FoodError(409, 'RIDER_NOT_AVAILABLE', r.status !== 'active' ? `${r.fullName} isn’t active.` : `${r.fullName} is off duty.`, {
        reason: r.status !== 'active' ? r.status : 'off_duty',
      });
    if (o.riderId) {
      releaseRider(ctx.db, o.riderId);
      o.events.push({ kind: 'rider', from: null, to: 'unassigned', actorRole: 'vendor', note: null, at: isoNow(ctx.now) });
    }
    o.riderId = r.id;
    o.riderStep = 'assigned';
    o.updatedAt = isoNow(ctx.now);
    r.activeOrderCount += 1;
    o.events.push({ kind: 'rider', from: null, to: 'assigned', actorRole: 'vendor', note: null, at: isoNow(ctx.now) });
    emitOrder(ctx.db, o, 'updated');
    return vendorOrderView(ctx.db, o, ctx.now);
  });

  route('GET', '/food/vendor/riders/suggest', ctx => {
    const v = myVendor(ctx);
    const orderId = String(ctx.query.orderId ?? '');
    if (!orderId) throw invalid('orderId', 'orderId must be a UUID');
    const o = ctx.db.food.orders.find(x => x.id === orderId && x.businessId === v.businessId);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    const items = ctx.db.food.riders
      .filter(r => r.businessId === v.businessId && r.status === 'active' && r.onDuty)
      .map(r => {
        const live = isLive(r.locationUpdatedAt, ctx.now);
        return {
          riderId: r.id,
          fullName: r.fullName,
          vehicle: r.vehicle,
          phone: r.phone,
          activeOrders: r.activeOrderCount,
          locationLive: live,
          distanceKm: live && r.lastGeo && v.lat !== null && v.lng !== null ? distanceKm(r.lastGeo, { lat: v.lat, lng: v.lng }) : null,
        };
      })
      .sort((a, b) => a.activeOrders - b.activeOrders || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.fullName.localeCompare(b.fullName));
    return { orderId, items };
  });

  route('GET', '/food/vendor/riders/live', ctx => {
    const v = myVendor(ctx);
    return {
      items: ctx.db.food.riders
        .filter(r => r.businessId === v.businessId && r.status === 'active')
        .sort((a, b) => Number(b.onDuty) - Number(a.onDuty) || a.fullName.localeCompare(b.fullName))
        .map(r => {
          const live = isLive(r.locationUpdatedAt, ctx.now);
          return {
            id: r.id,
            fullName: r.fullName,
            phone: r.phone,
            vehicle: r.vehicle,
            onDuty: r.onDuty,
            locationLive: live,
            location: live && r.lastGeo ? { lat: r.lastGeo.lat, lng: r.lastGeo.lng, at: r.locationUpdatedAt } : null,
            lastSeenAt: r.locationUpdatedAt,
            activeOrders: ctx.db.food.orders
              .filter(o => o.riderId === r.id && RIDER_ACTIVE.includes(o.status))
              .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
              .map(o => ({ id: o.id, code: o.code, status: o.status, riderStep: o.riderStep })),
          };
        }),
    };
  });

  route('GET', '/food/vendor/riders/:id/cash', ctx => cashView(ctx.db, ownRider(ctx, myVendor(ctx), ctx.params[0]).id));

  route('POST', '/food/vendor/riders/:id/handover', ctx => {
    const r = ownRider(ctx, myVendor(ctx), ctx.params[0]);
    const amount = ctx.body.amount;
    if (!(typeof amount === 'number' && Number.isInteger(amount) && amount >= 1)) throw invalid('amount', 'amount must not be less than 1');
    const note = text(ctx.body.note);
    if (note.length > 200) throw invalid('note', 'note must be shorter than or equal to 200 characters');
    const balance = cashView(ctx.db, r.id).balance;
    if (amount > balance) throw invalid('amount', `The rider holds Rs ${balance.toLocaleString('en-PK')}.`, { balance });
    ctx.db.food.cash.push({ id: nextId(ctx.db, 'cash'), riderId: r.id, orderId: null, kind: 'handover', amount: -amount, note: note || null, at: isoNow(ctx.now) });
    ctx.setStatus(200);
    return cashView(ctx.db, r.id);
  });

  // ── The socket's rider.location (the live path; the REST batch is the fallback) ──
  if (!mockRealtime.getHandler('rider.location') || !(mockRealtime.getHandler('rider.location') as { food?: boolean }).food) {
    mockRealtime.handle(
      'rider.location',
      Object.assign(
        (ctx: { db: MockDb; user: { id: string; role: string } }, payload: LocationPoint) => {
          const r = ctx.user.role === 'rider' ? ctx.db.food.riders.find(x => x.userId === ctx.user.id && x.status === 'active') : undefined;
          if (!r) return { ok: false, code: 'FORBIDDEN' };
          if (!validPoint(payload)) return { ok: false, code: 'VALIDATION_FAILED', fields: ['lat', 'lng'] };
          const res = recordLocation(ctx.db, r, [payload], Date.now());
          return res.ok ? { ok: true } : { ok: false, code: res.code };
        },
        { food: true },
      ),
    );
  }
}

