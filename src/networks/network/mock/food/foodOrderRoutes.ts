// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food ordering routes
// ═══════════════════════════════════════════════════════
// The customer's bag (/food/cart), its preview, checkout (Idempotency-Key),
// pre-order slots, their orders (/food/orders), and the vendor's board
// (/food/vendor/orders) and deals (/food/vendor/promotions). Rules live in
// foodOrders; the shapes and error codes are the API's.
// Mirrors the API's cart, checkout, orders and promotions controllers
// (docs/API_FOOD.md §4.2–4.3).

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { FoodError, assertEntitled, assertWithinPlan, invalid, isHhmm, isoNow, kitchenToday, nextId, openState, overrideOf, text } from './foodLogic';
import { isVisible, unavailableReason } from './foodDiscovery';
import {
  ACTIVE_STATUSES,
  ENDED_STATUSES,
  MAX_LINES,
  MAX_QUANTITY,
  TRANSFER_WINDOW_MINUTES,
  VENDOR_BUCKETS,
  boardView,
  cartWire,
  invalidTransition,
  move,
  movePayment,
  orderView,
  placeOrder,
  plan,
  planError,
  previewWire,
  priceChoice,
  promotionWire,
  slotsWire,
  summaryView,
  trackingView,
  vendorOrderView,
  type PlanInput,
} from './foodOrders';
import type { MockFoodCart, MockFoodOrder, MockFoodVendor, MockMenuItem, MockPromotion } from './foodTypes';
import { emitOrder, type OrderChange } from './foodRealtime';

const MINUTE = 60_000;
const FULFILMENTS = ['delivery', 'pickup'];
const PAYMENT_METHODS = ['cod', 'transfer', 'pay_at_pickup'];
const PROMOTION_KINDS: MockPromotion['kind'][] = ['percent_off_order', 'percent_off_items', 'flat_off', 'free_delivery'];
const PROMOTION_STATES = ['live', 'scheduled', 'ended', 'inactive'];
const STATUSES: MockFoodOrder['status'][] = ['placed', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'picked_up', 'rejected', 'auto_rejected', 'cancelled'];
const CODE = /^[A-Za-z0-9-]{3,20}$/;

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const isIso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
const has = (b: Record<string, unknown>, k: string) => b[k] !== undefined;

const page = (q: Record<string, any>) => {
  const p = Number(q.page ?? 1);
  const size = Number(q.pageSize ?? 20);
  if (!Number.isInteger(p) || p < 1) throw invalid('page', 'page must not be less than 1');
  if (!Number.isInteger(size) || size < 1 || size > 100) throw invalid('pageSize', size > 100 ? 'pageSize must not be greater than 100' : 'pageSize must not be less than 1');
  return { page: p, pageSize: size };
};
const paged = <T>(rows: T[], q: Record<string, any>) => {
  const { page: p, pageSize } = page(q);
  return { items: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize };
};

/** An optional trimmed string up to `max` (null allowed when `nullable`). */
const optText = (b: Record<string, any>, k: string, max: number, opts: { min?: number; nullable?: boolean } = {}) => {
  const v = b[k];
  if (v === undefined || (v === null && opts.nullable)) return v;
  if (typeof v !== 'string') throw invalid(k, `${k} must be a string`);
  const t = v.trim();
  if (opts.min !== undefined && t.length < opts.min) throw invalid(k, `${k} must be longer than or equal to ${opts.min} characters`);
  if (t.length > max) throw invalid(k, `${k} must be shorter than or equal to ${max} characters`);
  return t;
};

/** What both preview and checkout take. */
const orderDetails = (b: Record<string, any>, paymentRequired: boolean): PlanInput & Record<string, any> => {
  if (has(b, 'addressId') && typeof b.addressId !== 'string') throw invalid('addressId', 'addressId must be a UUID');
  const promoCode = optText(b, 'promoCode', 20, { min: 1, nullable: true });
  if (has(b, 'cutlery') && typeof b.cutlery !== 'boolean') throw invalid('cutlery', 'cutlery must be a boolean value');
  const note = optText(b, 'note', 300);
  const building = optText(b, 'building', 80);
  const floor = optText(b, 'floor', 30);
  const riderInstructions = optText(b, 'riderInstructions', 200);
  if ((paymentRequired || has(b, 'paymentMethod')) && !PAYMENT_METHODS.includes(b.paymentMethod))
    throw invalid('paymentMethod', `paymentMethod must be one of the following values: ${PAYMENT_METHODS.join(', ')}`);
  // `source` is Kitchen Intelligence's addition (foodHooks.onPlaced reads it).
  return { addressId: b.addressId, promoCode, paymentMethod: b.paymentMethod, cutlery: b.cutlery, note, building, floor, riderInstructions, ...(has(b, 'source') ? { source: b.source } : null) };
};

const reasonOf = (b: Record<string, any>) => {
  const r = optText(b, 'reason', 300, { min: 3 });
  if (!r) throw invalid('reason', 'reason must be longer than or equal to 3 characters');
  return r;
};

export interface OrderRouteDeps {
  /** The rollback-wrapped router (every write all-or-nothing). */
  route: ShopKit['route'];
  /** The plain router, for the one write the API commits before answering with an error. */
  rawRoute: ShopKit['route'];
  requireUser: ShopKit['requireUser'];
  myVendor: (ctx: ShopCtx) => MockFoodVendor;
  /** Filled in by reviews: may the customer rate this order? */
  canReview: (db: MockDb, o: MockFoodOrder, now: number) => boolean;
  /** Filled in by riders: a delivered order's cash goes on the rider's ledger. */
  onDelivered: (db: MockDb, o: MockFoodOrder, actor: string, now: number) => void;
}

export function registerOrderRoutes(deps: OrderRouteDeps) {
  const { route, rawRoute, requireUser, myVendor } = deps;

  const customer = (ctx: ShopCtx): MockUser => {
    const u = requireUser(ctx);
    if (u.role !== 'customer') throw new FoodError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return u;
  };
  const cartOf = (db: MockDb, user: MockUser) => db.food.carts.find(c => c.userId === user.id);
  const myOrder = (ctx: ShopCtx, user: MockUser) => {
    const o = ctx.db.food.orders.find(x => x.code === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    return o;
  };
  const vendorOrder = (ctx: ShopCtx, v: MockFoodVendor) => {
    const o = ctx.db.food.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.businessId === v.businessId);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    return o;
  };
  const customerView = (ctx: ShopCtx, o: MockFoodOrder) => orderView(ctx.db, o, 'customer', ctx.now, deps.canReview(ctx.db, o, ctx.now));

  // ── Adding a dish: the cart's own checks ──
  const sameDay = (v: MockFoodVendor, at: number, now: number) => kitchenToday(v, at).date === kitchenToday(v, now).date;

  /** The unit price, or why the choice can't go in the bag. */
  const validateLine = (db: MockDb, v: MockFoodVendor, i: MockMenuItem, scheduledFor: string | null, choice: { variantId?: string | null; optionIds?: string[] }, now: number) => {
    const at = scheduledFor ? Date.parse(scheduledFor) : now;
    let reason = unavailableReason(db, v, i, now, at);
    if (reason === 'sold_out' && !sameDay(v, at, now)) reason = null;
    if (reason)
      throw new FoodError(
        409,
        reason === 'sold_out' ? 'PORTIONS_SOLD_OUT' : 'ITEM_UNAVAILABLE',
        reason === 'sold_out' ? `${i.name} is sold out today.` : `${i.name} isn’t available ${scheduledFor ? 'at that time' : 'right now'}.`,
        { item: i.name, itemId: i.id, reason, remaining: overrideOf(i, v, now).remainingToday },
      );
    return priceChoice(db, i, choice.variantId ?? null, choice.optionIds ?? []).unitPrice;
  };

  const assertPortions = (v: MockFoodVendor, i: MockMenuItem, scheduledFor: string | null, others: MockFoodCart['lines'], adding: number, now: number) => {
    const remaining = overrideOf(i, v, now).remainingToday;
    if (remaining === null) return;
    if (scheduledFor && !sameDay(v, Date.parse(scheduledFor), now)) return;
    const inCart = others.filter(l => l.itemId === i.id).reduce((n, l) => n + l.quantity, 0);
    if (inCart + adding > remaining) throw new FoodError(409, 'PORTIONS_SOLD_OUT', `Only ${remaining} ${i.name} left today.`, { item: i.name, itemId: i.id, remaining });
  };

  const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

  const choiceOf = (b: Record<string, any>, partial: boolean) => {
    if (has(b, 'variantId') && b.variantId !== null && typeof b.variantId !== 'string') throw invalid('variantId', 'variantId must be a UUID');
    if (has(b, 'optionIds') && (!Array.isArray(b.optionIds) || b.optionIds.length > 30 || b.optionIds.some((x: unknown) => typeof x !== 'string')))
      throw invalid('optionIds', 'each value in optionIds must be a UUID');
    if ((!partial || has(b, 'quantity')) && !(isInt(b.quantity) && b.quantity >= 1 && b.quantity <= MAX_QUANTITY))
      throw invalid('quantity', b.quantity > MAX_QUANTITY ? `quantity must not be greater than ${MAX_QUANTITY}` : 'quantity must not be less than 1');
    const notes = optText(b, 'notes', 200, { nullable: true });
    return { notes: notes === '' ? null : notes };
  };

  // ── The bag ──
  route('GET', '/food/cart', ctx => cartWire(ctx.db, customer(ctx), ctx.now));

  route('DELETE', '/food/cart', ctx => {
    const user = customer(ctx);
    ctx.db.food.carts = ctx.db.food.carts.filter(c => c.userId !== user.id);
    return { cleared: true };
  });

  rawRoute('PATCH', '/food/cart', ctx => {
    const user = customer(ctx);
    const b = ctx.body;
    if (has(b, 'fulfilment') && !FULFILMENTS.includes(b.fulfilment)) throw invalid('fulfilment', `fulfilment must be one of the following values: ${FULFILMENTS.join(', ')}`);
    if (has(b, 'scheduledFor') && b.scheduledFor !== null && !isIso(b.scheduledFor)) throw invalid('scheduledFor', 'scheduledFor must be a valid ISO 8601 date string');
    const cart = cartOf(ctx.db, user);
    if (!cart) throw new FoodError(400, 'CART_EMPTY', 'Your cart is empty.');
    const v = ctx.db.food.vendors.find(x => x.businessId === cart.businessId)!;
    if (b.fulfilment === 'delivery' && !v.acceptsDelivery) throw new FoodError(400, 'FULFILMENT_UNAVAILABLE', 'This vendor doesn’t deliver — choose pickup.');
    if (b.fulfilment === 'pickup' && !v.acceptsPickup) throw new FoodError(400, 'FULFILMENT_UNAVAILABLE', 'This vendor doesn’t offer pickup.');
    if (b.fulfilment) cart.fulfilment = b.fulfilment;
    if (has(b, 'scheduledFor')) cart.scheduledFor = b.scheduledFor ? isoNow(Date.parse(b.scheduledFor)) : null;
    const view = cartWire(ctx.db, user, ctx.now);
    const scheduling = view.issues.find(i => i.code === 'SLOT_INVALID' || i.code === 'SLOT_FULL');
    if (b.scheduledFor && scheduling) {
      // Don't keep a time that can't be used.
      cart.scheduledFor = null;
      throw new FoodError(scheduling.code === 'SLOT_FULL' ? 409 : 400, scheduling.code, scheduling.message, scheduling.details);
    }
    return view;
  });

  route('POST', '/food/cart/items', ctx => {
    const user = customer(ctx);
    const b = ctx.body;
    if (typeof b.vendorId !== 'string' || !b.vendorId) throw invalid('vendorId', 'vendorId must be a UUID');
    if (typeof b.itemId !== 'string' || !b.itemId) throw invalid('itemId', 'itemId must be a UUID');
    const { notes } = choiceOf(b, false);
    if (has(ctx.query, 'replace') && !['true', 'false'].includes(String(ctx.query.replace))) throw invalid('replace', 'replace must be one of the following values: true, false');
    const replace = String(ctx.query.replace) === 'true';
    const db = ctx.db;
    const v = db.food.vendors.find(x => x.brandId === b.vendorId && isVisible(db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    const i = db.food.items.find(x => x.id === b.itemId && x.businessId === v.businessId);
    if (!i) throw new FoodError(404, 'NOT_FOUND', 'Dish not found.');

    let cart = cartOf(db, user);
    if (!cart) {
      cart = { userId: user.id, businessId: v.businessId, fulfilment: v.acceptsDelivery ? 'delivery' : 'pickup', scheduledFor: null, lines: [] };
      db.food.carts.push(cart);
    }
    if (cart.businessId !== v.businessId) {
      if (cart.lines.length && !replace) {
        const current = db.food.vendors.find(x => x.businessId === cart!.businessId)!;
        throw new FoodError(409, 'CART_OTHER_VENDOR', `Your cart has dishes from ${current.name}. Start a new cart from ${v.name}?`, {
          currentVendor: { id: current.brandId, name: current.name },
          itemCount: cart.lines.reduce((n, l) => n + l.quantity, 0),
        });
      }
      Object.assign(cart, { businessId: v.businessId, fulfilment: v.acceptsDelivery ? 'delivery' : 'pickup', scheduledFor: null, lines: [] });
    }
    const unitPrice = validateLine(db, v, i, cart.scheduledFor, b, ctx.now);
    const optionIds: string[] = [...new Set<string>(b.optionIds ?? [])];
    const same = cart.lines.find(l => l.itemId === i.id && (l.variantId ?? null) === (b.variantId ?? null) && sameSet(l.optionIds, optionIds) && (l.notes ?? null) === (notes ?? null));
    const quantity = (same?.quantity ?? 0) + b.quantity;
    if (quantity > MAX_QUANTITY) throw new FoodError(400, 'VALIDATION_FAILED', `At most ${MAX_QUANTITY} of one dish per order.`, { fields: { quantity: [`at most ${MAX_QUANTITY}`] } });
    assertPortions(v, i, cart.scheduledFor, cart.lines, b.quantity, ctx.now);
    if (same) {
      same.quantity = quantity;
      same.unitPriceSeen = unitPrice;
    } else {
      if (cart.lines.length >= MAX_LINES) throw new FoodError(400, 'VALIDATION_FAILED', `A cart holds at most ${MAX_LINES} lines.`);
      cart.lines.push({ id: nextId(db, 'cl'), itemId: i.id, variantId: b.variantId ?? null, optionIds, quantity: b.quantity, notes: notes ?? null, unitPriceSeen: unitPrice, createdAt: isoNow(ctx.now) });
    }
    ctx.setStatus(201);
    return cartWire(db, user, ctx.now);
  });

  const lineOf = (ctx: ShopCtx, user: MockUser) => {
    const cart = cartOf(ctx.db, user);
    const line = cart?.lines.find(l => l.id === decodeURIComponent(ctx.params[0]));
    if (!cart || !line) throw new FoodError(404, 'NOT_FOUND', 'That line isn’t in your cart.');
    return { cart, line };
  };

  route('PATCH', '/food/cart/items/:id', ctx => {
    const user = customer(ctx);
    const b = ctx.body;
    const { notes } = choiceOf(b, true);
    const { cart, line } = lineOf(ctx, user);
    const v = ctx.db.food.vendors.find(x => x.businessId === cart.businessId)!;
    const i = ctx.db.food.items.find(x => x.id === line.itemId && x.businessId === v.businessId);
    if (!i) throw new FoodError(404, 'NOT_FOUND', 'That dish is no longer on the menu — remove it from your cart.');
    const next = {
      variantId: has(b, 'variantId') ? b.variantId : line.variantId,
      optionIds: (b.optionIds as string[] | undefined) ?? line.optionIds,
      quantity: (b.quantity as number | undefined) ?? line.quantity,
      notes: has(b, 'notes') ? notes : line.notes,
    };
    const unitPrice = validateLine(ctx.db, v, i, cart.scheduledFor, next, ctx.now);
    assertPortions(v, i, cart.scheduledFor, cart.lines.filter(l => l.id !== line.id), next.quantity, ctx.now);
    Object.assign(line, { variantId: next.variantId ?? null, optionIds: [...new Set(next.optionIds)], quantity: next.quantity, notes: next.notes ?? null, unitPriceSeen: unitPrice });
    return cartWire(ctx.db, user, ctx.now);
  });

  route('DELETE', '/food/cart/items/:id', ctx => {
    const user = customer(ctx);
    const { cart, line } = lineOf(ctx, user);
    if (cart.lines.length === 1) ctx.db.food.carts = ctx.db.food.carts.filter(c => c !== cart);
    else cart.lines = cart.lines.filter(l => l !== line);
    return cartWire(ctx.db, user, ctx.now);
  });

  route('POST', '/food/cart/preview', ctx => {
    const user = customer(ctx);
    const input = orderDetails(ctx.body, false);
    ctx.setStatus(200);
    return previewWire(plan(ctx.db, user, cartOf(ctx.db, user), input, ctx.now), input, ctx.now);
  });

  // ── Checkout ──
  route('POST', '/food/checkout', ctx => {
    const user = customer(ctx);
    const key = ctx.headers['idempotency-key'] ?? ctx.headers['Idempotency-Key'];
    if (!key)
      throw new FoodError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (a fresh UUID per attempt) so a retry can never place the order twice.');
    const replayKey = `${user.id}|${key}`;
    const replayed = ctx.db.food.idempotency[replayKey];
    if (replayed) {
      const o = ctx.db.food.orders.find(x => x.code === replayed);
      if (o) {
        ctx.setStatus(201);
        return customerView(ctx, o);
      }
    }
    const input = orderDetails(ctx.body, true);
    const p = plan(ctx.db, user, cartOf(ctx.db, user), input, ctx.now);
    if (!p.ok) throw planError(p);
    const order = placeOrder(ctx.db, user, p, input, ctx.now);
    ctx.db.food.idempotency[replayKey] = order.code;
    emitOrder(ctx.db, order, 'new');
    ctx.setStatus(201);
    return customerView(ctx, order);
  });

  route('GET', '/food/vendors/:id/slots', ctx => {
    const id = decodeURIComponent(ctx.params[0]);
    const v = ctx.db.food.vendors.find(x => (x.brandId === id || x.slug === id) && isVisible(ctx.db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    return slotsWire(ctx.db, v, ctx.now);
  });

  // ── The customer's orders ──
  route('GET', '/food/orders', ctx => {
    const user = customer(ctx);
    const status = ctx.query.status;
    if (status !== undefined && status !== 'active' && status !== 'past') throw invalid('status', 'status must be one of the following values: active, past');
    const rows = ctx.db.food.orders
      .filter(o => o.userId === user.id)
      .filter(o => (status === 'active' ? ACTIVE_STATUSES.includes(o.status) : status === 'past' ? ENDED_STATUSES.includes(o.status) : true))
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt) || a.id.localeCompare(b.id));
    return paged(
      rows.map(o => summaryView(ctx.db, o)),
      ctx.query,
    );
  });

  route('GET', '/food/orders/:code', ctx => customerView(ctx, myOrder(ctx, customer(ctx))));

  route('GET', '/food/orders/:code/tracking', ctx => trackingView(ctx.db, myOrder(ctx, customer(ctx)), ctx.now));

  route('POST', '/food/orders/:code/cancel', ctx => {
    const user = customer(ctx);
    const reason = optText(ctx.body, 'reason', 300) || undefined;
    const o = myOrder(ctx, user);
    move(ctx.db, o, 'cancelled', 'customer', ctx.now, {
      note: reason ?? null,
      patch: { cancelReason: reason ?? 'Cancelled by the customer' },
      message: o.status === 'placed' ? undefined : 'The restaurant has already accepted this order — call them to cancel.',
    });
    emitOrder(ctx.db, o, 'updated');
    ctx.setStatus(200);
    return customerView(ctx, o);
  });

  route('POST', '/food/orders/:code/payment-proof', ctx => {
    const user = customer(ctx);
    const paymentRef = optText(ctx.body, 'paymentRef', 100, { min: 3 });
    if (!paymentRef) throw invalid('paymentRef', 'paymentRef must be longer than or equal to 3 characters');
    const proofUrl = optText(ctx.body, 'proofUrl', 500, { nullable: true });
    const o = myOrder(ctx, user);
    if (o.paymentMethod !== 'transfer') throw invalidTransition(o.paymentStatus, 'proof_submitted', [], 'This order isn’t paid by transfer.');
    if (['rejected', 'auto_rejected', 'cancelled'].includes(o.status)) throw invalidTransition(o.paymentStatus, 'proof_submitted', [], 'This order was cancelled.');
    movePayment(o, 'proof_submitted', 'customer', ctx.now, { note: paymentRef, patch: { paymentRef, paymentProofUrl: proofUrl ?? null, paymentRejectedReason: null } });
    emitOrder(ctx.db, o, 'payment');
    ctx.setStatus(200);
    return customerView(ctx, o);
  });

  /** Rebuild the bag from a past order at today's menu and prices; what can't be ordered is said. */
  route('POST', '/food/orders/:code/reorder', ctx => {
    const user = customer(ctx);
    const db = ctx.db;
    const o = myOrder(ctx, user);
    const v = db.food.vendors.find(x => x.businessId === o.businessId && isVisible(db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is no longer on Food Court.');
    const fulfilment =
      (o.fulfilment === 'delivery' && v.acceptsDelivery) || (o.fulfilment === 'pickup' && v.acceptsPickup) ? o.fulfilment : v.acceptsDelivery ? 'delivery' : 'pickup';
    db.food.carts = db.food.carts.filter(c => c.userId !== user.id);
    const cart: MockFoodCart = { userId: user.id, businessId: v.businessId, fulfilment, scheduledFor: null, lines: [] };
    const dropped: { name: string; reason: string; message: string }[] = [];
    const priceChanges: { name: string; was: number; now: number }[] = [];
    for (const it of o.items) {
      const i = db.food.items.find(x => x.id === it.itemId && x.businessId === v.businessId);
      if (!i) {
        dropped.push({ name: it.name, reason: 'not_on_menu', message: `${it.name} is no longer on the menu.` });
        continue;
      }
      const choice = { variantId: it.variantId, optionIds: it.options.map(x => x.id) };
      let unitPrice: number;
      try {
        unitPrice = validateLine(db, v, i, null, choice, ctx.now);
        assertPortions(v, i, null, cart.lines, it.quantity, ctx.now);
      } catch (e) {
        if (!(e instanceof FoodError)) throw e;
        dropped.push({ name: it.name, reason: e.code, message: e.message });
        continue;
      }
      if (unitPrice !== it.unitPrice) priceChanges.push({ name: it.name, was: it.unitPrice, now: unitPrice });
      cart.lines.push({ id: nextId(db, 'cl'), itemId: i.id, variantId: choice.variantId, optionIds: choice.optionIds, quantity: it.quantity, notes: it.notes, unitPriceSeen: unitPrice, createdAt: isoNow(ctx.now) });
    }
    if (cart.lines.length) db.food.carts.push(cart);
    ctx.setStatus(200);
    return { cart: cartWire(db, user, ctx.now), dropped, priceChanges };
  });

  // ── The vendor's board ──
  route('GET', '/food/vendor/orders', ctx => {
    const v = myVendor(ctx);
    const q = ctx.query;
    if (q.status !== undefined && !VENDOR_BUCKETS[q.status] && !STATUSES.includes(q.status))
      throw invalid('status', `status must be one of the following values: new, active, done, ${STATUSES.join(', ')}`);
    if (q.scheduled !== undefined && q.scheduled !== 'true' && q.scheduled !== 'false') throw invalid('scheduled', 'scheduled must be one of the following values: true, false');
    const wanted: MockFoodOrder['status'][] | null = q.status ? (VENDOR_BUCKETS[q.status] ?? [q.status]) : null;
    const oldestFirst = q.status === 'new' || q.status === 'active';
    const rows = ctx.db.food.orders
      .filter(o => o.businessId === v.businessId)
      .filter(o => !wanted || wanted.includes(o.status))
      .filter(o => (q.scheduled === 'true' ? !!o.scheduledFor : q.scheduled === 'false' ? !o.scheduledFor : true))
      .sort((a, b) => (oldestFirst ? a.placedAt.localeCompare(b.placedAt) : b.placedAt.localeCompare(a.placedAt)) || a.id.localeCompare(b.id));
    return paged(
      rows.map(o => boardView(ctx.db, o)),
      q,
    );
  });

  route('GET', '/food/vendor/orders/:id', ctx => vendorOrderView(ctx.db, vendorOrder(ctx, myVendor(ctx)), ctx.now));

  /** One vendor action: the order (theirs only), the move, the live event, then their detail view. */
  const act = (action: string, work: (ctx: ShopCtx, o: MockFoodOrder, v: MockFoodVendor) => void, change: OrderChange = 'updated') =>
    route('POST', `/food/vendor/orders/:id/${action}`, ctx => {
      const v = myVendor(ctx);
      const o = vendorOrder(ctx, v);
      work(ctx, o, v);
      emitOrder(ctx.db, o, change);
      ctx.setStatus(200);
      return vendorOrderView(ctx.db, o, ctx.now);
    });

  act('accept', (ctx, o) => {
    const eta = ctx.body.etaMinutes;
    if (eta !== undefined && !(isInt(eta) && eta >= 5 && eta <= 180))
      throw invalid('etaMinutes', isInt(eta) && eta > 180 ? 'etaMinutes must not be greater than 180' : 'etaMinutes must not be less than 5');
    const minutes: number = eta ?? o.etaMinutes ?? 30;
    move(ctx.db, o, 'accepted', 'vendor', ctx.now, { patch: { etaMinutes: o.scheduledFor ? null : minutes, promisedAt: o.scheduledFor ?? isoNow(ctx.now + minutes * MINUTE) } });
  });

  act('reject', (ctx, o) => {
    const reason = reasonOf(ctx.body);
    move(ctx.db, o, 'rejected', 'vendor', ctx.now, { note: reason, patch: { cancelReason: reason } });
  });

  act('preparing', (ctx, o, v) => {
    if (o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid' && v.transferConfirmBeforePrep)
      throw new FoodError(409, 'PAYMENT_NOT_CONFIRMED', 'Confirm the transfer before you start cooking.', { paymentStatus: o.paymentStatus });
    move(ctx.db, o, 'preparing', 'vendor', ctx.now);
  });

  act('ready', (ctx, o) => move(ctx.db, o, 'ready', 'vendor', ctx.now));

  act('handed-external', (ctx, o) => {
    if (o.riderId) throw invalidTransition(o.status, 'on_the_way', [], 'A rider is assigned — they pick it up in the Rider app.');
    move(ctx.db, o, 'on_the_way', 'vendor', ctx.now, { patch: { handedToExternal: true }, note: 'Handed to own rider' });
  });

  act('picked-up', (ctx, o) => move(ctx.db, o, 'picked_up', 'vendor', ctx.now));

  act('delivered', (ctx, o) => {
    const c = ctx.body.codCollected;
    if (c !== undefined && !(isInt(c) && c >= 0)) throw invalid('codCollected', 'codCollected must not be less than 0');
    let cod: number | null = null;
    if (o.paymentMethod === 'cod') {
      cod = c ?? o.total;
      if (cod! > o.total)
        throw new FoodError(400, 'VALIDATION_FAILED', `Cash collected can’t be more than the order total (Rs ${o.total.toLocaleString('en-PK')}).`, {
          fields: { codCollected: [`at most ${o.total}`] },
        });
    }
    move(ctx.db, o, 'delivered', 'vendor', ctx.now, { patch: { codCollected: cod } });
    deps.onDelivered(ctx.db, o, 'vendor', ctx.now);
  });

  act('cancel', (ctx, o) => {
    const reason = reasonOf(ctx.body);
    move(ctx.db, o, 'cancelled', 'vendor', ctx.now, { note: reason, patch: { cancelReason: reason } });
  });

  act(
    'payment/confirm',
    (ctx, o) => {
      if (['rejected', 'auto_rejected', 'cancelled'].includes(o.status)) throw invalidTransition(o.paymentStatus, 'paid', [], 'This order was cancelled.');
      movePayment(o, 'paid', 'vendor', ctx.now);
    },
    'payment',
  );

  act(
    'payment/reject',
    (ctx, o) => {
      const reason = reasonOf(ctx.body);
      movePayment(o, 'awaiting_transfer', 'vendor', ctx.now, {
        note: reason,
        patch: { paymentRejectedReason: reason, payBy: isoNow(ctx.now + TRANSFER_WINDOW_MINUTES * MINUTE) },
      });
    },
    'payment',
  );

  // ── Saved kitchens ──
  route('GET', '/food/favourites', ctx => {
    const user = customer(ctx);
    const items = ctx.db.food.favourites
      .filter(f => f.userId === user.id)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map(f => {
        const v = ctx.db.food.vendors.find(x => x.businessId === f.businessId && isVisible(ctx.db, x));
        if (!v) return null;
        const o = openState(v, ctx.now);
        return {
          id: v.brandId,
          slug: v.slug,
          name: v.name,
          logoUrl: v.logoUrl,
          coverUrl: v.coverUrl,
          ratingAvg: v.ratingAvg,
          ratingCount: v.ratingCount,
          openState: { open: o.open, paused: o.paused, label: o.label },
          savedAt: f.savedAt,
        };
      })
      .filter(Boolean);
    return { items };
  });

  route('POST', '/food/favourites/:vendorId', ctx => {
    const user = customer(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    const v = ctx.db.food.vendors.find(x => x.brandId === id && isVisible(ctx.db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    if (!ctx.db.food.favourites.some(f => f.userId === user.id && f.businessId === v.businessId)) ctx.db.food.favourites.push({ userId: user.id, businessId: v.businessId, savedAt: isoNow(ctx.now) });
    ctx.setStatus(201);
    return { vendorId: id, favourite: true };
  });

  route('DELETE', '/food/favourites/:vendorId', ctx => {
    const user = customer(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    const v = ctx.db.food.vendors.find(x => x.brandId === id);
    ctx.db.food.favourites = ctx.db.food.favourites.filter(f => !(f.userId === user.id && v && f.businessId === v.businessId));
    return { vendorId: id, favourite: false };
  });

  // ── The vendor's deals ──
  const myPromotion = (ctx: ShopCtx, v: MockFoodVendor) => {
    const p = ctx.db.food.promotions.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.businessId === v.businessId);
    if (!p) throw new FoodError(404, 'NOT_FOUND', 'Promotion not found.');
    return p;
  };
  const running = (p: MockPromotion, now: number) => p.isActive && (!p.endsAt || Date.parse(p.endsAt) > now);

  /** The body's fields, checked as the API's DTO checks them. */
  const promotionFields = (b: Record<string, any>, partial: boolean): Partial<MockPromotion> & { weekdays?: number[] } => {
    const out: Partial<MockPromotion> = {};
    if (!partial || has(b, 'title')) {
      const t = text(b.title);
      if (t.length < 2 || t.length > 80) throw invalid('title', t.length < 2 ? 'title must be longer than or equal to 2 characters' : 'title must be shorter than or equal to 80 characters');
      out.title = t;
    }
    if (!partial || has(b, 'kind')) {
      if (!PROMOTION_KINDS.includes(b.kind)) throw invalid('kind', `kind must be one of the following values: ${PROMOTION_KINDS.join(', ')}`);
      out.kind = b.kind;
    }
    const intField = (k: string, min: number, max: number, nullable = false) => {
      if (!has(b, k)) return;
      if (nullable && b[k] === null) return void ((out as Record<string, unknown>)[k] = null);
      if (!(isInt(b[k]) && b[k] >= min && b[k] <= max)) throw invalid(k, b[k] > max ? `${k} must not be greater than ${max}` : `${k} must not be less than ${min}`);
      (out as Record<string, unknown>)[k] = b[k];
    };
    intField('value', 0, 100000);
    intField('minOrder', 0, 1000000);
    intField('maxDiscount', 1, 1000000, true);
    intField('usageLimit', 1, Number.MAX_SAFE_INTEGER, true);
    intField('perUserLimit', 1, Number.MAX_SAFE_INTEGER, true);
    if (has(b, 'itemIds')) {
      if (!Array.isArray(b.itemIds) || b.itemIds.length > 100 || b.itemIds.some((x: unknown) => typeof x !== 'string')) throw invalid('itemIds', 'each value in itemIds must be a UUID');
      out.itemIds = [...b.itemIds];
    }
    if (has(b, 'code')) {
      if (b.code === null) out.code = null;
      else if (typeof b.code !== 'string' || !CODE.test(b.code.trim())) throw invalid('code', 'code is 3–20 letters, digits or dashes');
      else out.code = b.code.trim().toUpperCase();
    }
    if (has(b, 'startsAt')) {
      if (!isIso(b.startsAt)) throw invalid('startsAt', 'startsAt must be a valid ISO 8601 date string');
      out.startsAt = isoNow(Date.parse(b.startsAt));
    }
    if (has(b, 'endsAt')) {
      if (b.endsAt !== null && !isIso(b.endsAt)) throw invalid('endsAt', 'endsAt must be a valid ISO 8601 date string');
      out.endsAt = b.endsAt ? isoNow(Date.parse(b.endsAt)) : null;
    }
    if (has(b, 'weekdays')) {
      if (!Array.isArray(b.weekdays) || !b.weekdays.length || b.weekdays.length > 7 || b.weekdays.some((d: unknown) => !isInt(d) || (d as number) < 0 || (d as number) > 6))
        throw invalid('weekdays', 'weekdays must contain at least 1 elements');
      out.weekdays = [...new Set<number>(b.weekdays)].sort();
    }
    for (const k of ['timeFrom', 'timeTo'] as const) {
      if (!has(b, k)) continue;
      if (b[k] !== null && !isHhmm(b[k])) throw invalid(k, `${k} is HH:MM`);
      out[k] = b[k];
    }
    for (const k of ['firstOrderOnly', 'isActive'] as const) {
      if (!has(b, k)) continue;
      if (typeof b[k] !== 'boolean') throw invalid(k, `${k} must be a boolean value`);
      out[k] = b[k];
    }
    return out;
  };

  /** The rules a vendor can't break, and the plan's active-promotion limit. */
  const checkPromotion = (db: MockDb, v: MockFoodVendor, p: MockPromotion, alreadyCounted: boolean, now: number) => {
    const bad = (message: string, field: string) => invalid(field, message);
    if ((p.kind === 'percent_off_order' || p.kind === 'percent_off_items') && (p.value < 1 || p.value > 100)) throw bad('A percent deal is 1–100%.', 'value');
    if (p.kind === 'flat_off' && p.value < 1) throw bad('A flat deal needs an amount in rupees.', 'value');
    if (p.kind === 'percent_off_items') {
      if (!p.itemIds.length) throw bad('Choose the dishes this deal applies to.', 'itemIds');
      const mine = new Set(db.food.items.filter(i => i.businessId === v.businessId).map(i => i.id));
      if (!new Set(p.itemIds).size || [...new Set(p.itemIds)].some(id => !mine.has(id))) throw bad('Some of those dishes aren’t on your menu.', 'itemIds');
    } else p.itemIds = [];
    if ((p.timeFrom === null) !== (p.timeTo === null)) throw bad('Give both times of a daily window, or neither.', 'timeTo');
    if (p.timeFrom && p.timeFrom === p.timeTo) throw bad('The daily window can’t start and end together.', 'timeTo');
    if (p.endsAt && Date.parse(p.endsAt) <= Date.parse(p.startsAt)) throw bad('A promotion must end after it starts.', 'endsAt');
    if (p.code && db.food.promotions.some(x => x.businessId === v.businessId && x.code === p.code && x.id !== p.id))
      throw new FoodError(409, 'CONFLICT', `You already have a promotion with the code ${p.code}.`, { field: 'code' });
    if (running(p, now) && !alreadyCounted) {
      const used = db.food.promotions.filter(x => x.businessId === v.businessId && x.id !== p.id && running(x, now)).length;
      assertWithinPlan(v, 'promotions_active', used + 1);
    }
  };

  route('GET', '/food/vendor/promotions', ctx => {
    const v = myVendor(ctx);
    const state = ctx.query.state;
    if (state !== undefined && !PROMOTION_STATES.includes(state)) throw invalid('state', `state must be one of the following values: ${PROMOTION_STATES.join(', ')}`);
    const rows = ctx.db.food.promotions
      .filter(p => p.businessId === v.businessId)
      .reverse()
      .map(p => promotionWire(p, ctx.now))
      .filter(p => !state || p.state === state);
    return paged(rows, ctx.query);
  });

  route('POST', '/food/vendor/promotions', ctx => {
    const v = myVendor(ctx);
    assertEntitled(v, 'promotions');
    const f = promotionFields(ctx.body, false);
    const p: MockPromotion = {
      id: nextId(ctx.db, 'pr'),
      businessId: v.businessId,
      title: f.title!,
      kind: f.kind!,
      value: f.kind === 'free_delivery' ? 0 : (f.value ?? 0),
      itemIds: f.itemIds ?? [],
      minOrder: f.minOrder ?? 0,
      maxDiscount: f.maxDiscount ?? null,
      code: f.code ?? null,
      startsAt: f.startsAt ?? isoNow(ctx.now),
      endsAt: f.endsAt ?? null,
      weekdays: f.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      timeFrom: f.timeFrom ?? null,
      timeTo: f.timeTo ?? null,
      usageLimit: f.usageLimit ?? null,
      perUserLimit: f.perUserLimit ?? null,
      usedCount: 0,
      firstOrderOnly: f.firstOrderOnly ?? false,
      isActive: f.isActive ?? true,
    };
    checkPromotion(ctx.db, v, p, false, ctx.now);
    ctx.db.food.promotions.push(p);
    ctx.setStatus(201);
    return promotionWire(p, ctx.now);
  });

  route('GET', '/food/vendor/promotions/:id', ctx => promotionWire(myPromotion(ctx, myVendor(ctx)), ctx.now));

  route('PATCH', '/food/vendor/promotions/:id', ctx => {
    const v = myVendor(ctx);
    const p = myPromotion(ctx, v);
    const wasRunning = running(p, ctx.now);
    Object.assign(p, promotionFields(ctx.body, true));
    if (p.kind === 'free_delivery') p.value = 0;
    checkPromotion(ctx.db, v, p, wasRunning, ctx.now);
    return promotionWire(p, ctx.now);
  });

  route('POST', '/food/vendor/promotions/:id/deactivate', ctx => {
    const p = myPromotion(ctx, myVendor(ctx));
    p.isActive = false;
    ctx.setStatus(200);
    return promotionWire(p, ctx.now);
  });

  route('DELETE', '/food/vendor/promotions/:id', ctx => {
    const p = myPromotion(ctx, myVendor(ctx));
    if (p.usedCount > 0 || ctx.db.food.orders.some(o => o.promotion?.id === p.id))
      throw new FoodError(409, 'CONFLICT', 'Orders have used this promotion — deactivate it instead of deleting.');
    ctx.db.food.promotions = ctx.db.food.promotions.filter(x => x !== p);
    return { deleted: true };
  });
}

/** Vendors this customer received food from, most recent first (brand ids). */
export const orderAgain = (db: MockDb, user: MockUser) => {
  const last = new Map<string, string>();
  for (const o of db.food.orders)
    if (o.userId === user.id && (o.status === 'delivered' || o.status === 'picked_up')) {
      const v = db.food.vendors.find(x => x.businessId === o.businessId);
      if (v && (last.get(v.brandId) ?? '') < o.placedAt) last.set(v.brandId, o.placedAt);
    }
  return [...last]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 10)
    .map(([id]) => id);
};
