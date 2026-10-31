// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food live channel
// ═══════════════════════════════════════════════════════
// What the API's Food gateway does, on the dummy socket (mockRealtime):
//   • a vendor's owner joins branch:{id} on connect and gets `board.sync`
//     (the active orders); an active rider joins rider:{userId};
//   • `subscribe { orderId }` joins order:{id} — only the order's customer,
//     its kitchen or its rider (else `{ ok: false, code: 'NOT_FOUND' }`);
//   • after a write: `order.new` to the branch; `order.updated` to the
//     order's room (the customer's view), the branch (a board card) and the
//     rider; `order.payment` to the order and the branch.
// Emits wait for the write to succeed, as the API's go out after the commit:
// the route wrapper flushes them, or drops them when the write is rolled back.
// Mirrors the API's gateway (docs/API_FOOD.md §5).

import type { MockDb, MockUser } from '../mockDb';
import { mockRealtime } from '../mockRealtime';
import { ACTIVE_STATUSES, boardView, orderView } from './foodOrders';
import { isoNow } from './foodLogic';
import type { MockFoodOrder } from './foodTypes';

export const rooms = {
  order: (id: string) => `order:${id}`,
  branch: (id: string) => `branch:${id}`,
  rider: (userId: string) => `rider:${userId}`,
};

export type OrderChange = 'new' | 'updated' | 'payment';

let outbox: (() => void)[] = [];

/** A write is starting: nothing is waiting to go out. */
export const beginEmits = () => {
  outbox = [];
};
/** The write succeeded: send what it queued. */
export const flushEmits = () => {
  const out = outbox;
  outbox = [];
  out.forEach(send => send());
};
/** The write was rolled back: send nothing. */
export const dropEmits = () => {
  outbox = [];
};

const branchOf = (db: MockDb, o: MockFoodOrder) => db.food.vendors.find(v => v.businessId === o.businessId)?.branchId ?? null;

/** Queue the events one order's change sends (read when they go out, so they carry the final state). */
export const emitOrder = (db: MockDb, o: MockFoodOrder, kind: OrderChange) => {
  outbox.push(() => {
    const branch = branchOf(db, o);
    if (!branch) return;
    const branchRoom = rooms.branch(branch);
    const card = boardView(db, o);
    if (kind === 'new') {
      mockRealtime.emitToRoom(branchRoom, 'order.new', { order: card });
      return;
    }
    const head = { orderId: o.id, code: o.code, status: o.status };
    const view = orderView(db, o, 'customer', Date.now());
    mockRealtime.emitToRoom(rooms.order(o.id), 'order.updated', { ...head, order: view }, branchRoom);
    mockRealtime.emitToRoom(branchRoom, 'order.updated', { ...head, order: card });
    const riderUser = o.riderId ? db.food.riders.find(r => r.id === o.riderId)?.userId : null;
    if (riderUser) mockRealtime.emitToRoom(rooms.rider(riderUser), 'order.updated', { ...head, order: view }, rooms.order(o.id));
    if (kind === 'payment') {
      const pay = { ...head, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod };
      mockRealtime.emitToRoom(rooms.order(o.id), 'order.payment', pay, branchRoom);
      mockRealtime.emitToRoom(branchRoom, 'order.payment', pay);
    }
  });
};

/** A vendor's owner: their approved Food branch. */
const branchOfOwner = (db: MockDb, user: MockUser) => {
  if (user.role !== 'partner') return null;
  const b = db.businesses.find(x => x.ownerId === user.id && x.serviceType === 'food' && x.status === 'approved');
  return b ? (db.food.vendors.find(v => v.businessId === b.id) ?? null) : null;
};

const activeRider = (db: MockDb, user: MockUser) => (user.role === 'rider' ? (db.food.riders.find(r => r.userId === user.id && r.status === 'active') ?? null) : null);

/** The active orders, oldest first: what `board.sync` carries. */
export const boardSync = (db: MockDb, businessId: string, now: number) => ({
  at: isoNow(now),
  orders: db.food.orders
    .filter(o => o.businessId === businessId && ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
    .slice(0, 200)
    .map(o => boardView(db, o)),
});

const canWatch = (db: MockDb, user: MockUser, o: MockFoodOrder) =>
  (user.role === 'customer' && o.userId === user.id) || branchOfOwner(db, user)?.businessId === o.businessId || (!!o.riderId && activeRider(db, user)?.id === o.riderId);

let registered = false;

export function registerFoodRealtime() {
  if (registered) return;
  registered = true;

  mockRealtime.handle('subscribe', (ctx, payload: { orderId?: unknown }) => {
    const id = typeof payload?.orderId === 'string' ? payload.orderId : '';
    const o = ctx.db.food.orders.find(x => x.id === id);
    if (!o || !canWatch(ctx.db, ctx.user, o)) return { ok: false, code: 'NOT_FOUND' };
    ctx.join(rooms.order(id));
    return { ok: true, orderId: id };
  });

  mockRealtime.handle('unsubscribe', (ctx, payload: { orderId?: unknown }) => {
    if (typeof payload?.orderId === 'string') ctx.leave(rooms.order(payload.orderId));
    return { ok: true };
  });

  mockRealtime.onConnect(ctx => {
    const v = branchOfOwner(ctx.db, ctx.user);
    if (v) {
      ctx.join(rooms.branch(v.branchId));
      ctx.emit('board.sync', boardSync(ctx.db, v.businessId, Date.now()));
    }
    if (activeRider(ctx.db, ctx.user)) ctx.join(rooms.rider(ctx.user.id));
  });
}
