// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food ordering rules
// ═══════════════════════════════════════════════════════
// Deals (one per order, the best for the customer), pricing a line, the
// checkout planner (vendor, address, time, lines, minimum, deal, how to
// pay — in that order), the order's status and payment machines, the views
// each side sees, and the jobs the API runs every minute (declining orders
// not answered in time, cancelling unpaid transfers), run here on each
// request. TODO(API_FOOD): ported from the API's committed promotions,
// checkout, orders and views services.

import type { MockDb, MockUser } from '../mockDb';
import { addDays, formatDayShort, formatSlot, zonedToIso } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { zoned } from '../health/healthWire';
import { FoodError, isoNow, kitchenToday, nextId, openIntervals, overrideOf, planOf } from './foodLogic';
import { inWindow, isVisible, quote, unavailableReason, type Deal } from './foodDiscovery';
import type {
  MockFoodCart,
  MockFoodOrder,
  MockFoodVendor,
  MockMenuItem,
  MockPromotion,
} from './foodTypes';

export const TRANSFER_WINDOW_MINUTES = 10;
/** A scheduled order is at least this far ahead (or prep time, if longer), at most a week. */
export const MIN_LEAD_MINUTES = 30;
export const MAX_AHEAD_DAYS = 7;
export const MAX_QUANTITY = 50;
export const MAX_LINES = 40;
export const AUTO_REJECT_REASON = 'The restaurant didn’t respond in time.';
export const UNPAID_REASON = 'The transfer wasn’t received in time.';
const MINUTE = 60_000;
const NEGATIVE: MockFoodOrder['status'][] = ['rejected', 'auto_rejected', 'cancelled'];
const ENDED: MockFoodOrder['status'][] = ['delivered', 'picked_up', ...NEGATIVE];

const issue = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : null),
});
export type Issue = ReturnType<typeof issue>;

// ─── Deals ────────────────────────────────────────────
const localMinutes = (v: MockFoodVendor, now: number) => {
  const t = formatSlot(isoNow(now), v.timezone);
  const [hm, ap] = t.split(' ');
  const [h, m] = hm.split(':').map(Number);
  return ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m;
};

export const isLive = (p: MockPromotion, v: MockFoodVendor, now: number) => {
  if (!p.isActive || Date.parse(p.startsAt) > now) return false;
  if (p.endsAt && Date.parse(p.endsAt) <= now) return false;
  if (!p.weekdays.includes(kitchenToday(v, now).weekday)) return false;
  return inWindow(p.timeFrom, p.timeTo, localMinutes(v, now));
};

export const dealLabel = (p: Pick<MockPromotion, 'kind' | 'value' | 'minOrder'>) => {
  const over = p.minOrder > 0 ? ` over ${formatPKR(p.minOrder)}` : '';
  switch (p.kind) {
    case 'percent_off_order':
      return `${p.value}% off${over}`;
    case 'percent_off_items':
      return `${p.value}% off selected items`;
    case 'flat_off':
      return `${formatPKR(p.value)} off${over}`;
    case 'free_delivery':
      return `Free delivery${over}`;
  }
};

export interface PromoCtx {
  now: number;
  subtotal: number;
  lines: { itemId: string; lineTotal: number }[];
  deliveryFee: number;
  userUses: Map<string, number>;
  isFirstOrder: boolean;
}

export const discountOf = (p: MockPromotion, ctx: PromoCtx) => {
  const cap = (n: number) =>
    Math.max(
      0,
      Math.min(
        n,
        p.maxDiscount ?? Number.MAX_SAFE_INTEGER,
        p.kind === 'free_delivery' ? ctx.deliveryFee : ctx.subtotal,
      ),
    );
  switch (p.kind) {
    case 'percent_off_order':
      return cap(Math.floor((ctx.subtotal * p.value) / 100));
    case 'percent_off_items':
      return cap(
        Math.floor(
          (ctx.lines
            .filter(l => p.itemIds.includes(l.itemId))
            .reduce((s, l) => s + l.lineTotal, 0) *
            p.value) /
            100,
        ),
      );
    case 'flat_off':
      return cap(p.value);
    case 'free_delivery':
      return cap(ctx.deliveryFee);
  }
};

const promotionIssue = (p: MockPromotion, v: MockFoodVendor, ctx: PromoCtx) => {
  const name = p.code ? `“${p.code}”` : p.title;
  if (!p.isActive || Date.parse(p.startsAt) > ctx.now)
    return issue('PROMO_INVALID', `${name} isn’t on yet.`);
  if (p.endsAt && Date.parse(p.endsAt) <= ctx.now)
    return issue('PROMO_EXPIRED', `${name} has ended.`);
  if (!isLive(p, v, ctx.now)) return issue('PROMO_INVALID', `${name} isn’t valid at this time.`);
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit)
    return issue('PROMO_LIMIT_REACHED', `${name} has been fully used.`);
  if (p.perUserLimit !== null && (ctx.userUses.get(p.id) ?? 0) >= p.perUserLimit)
    return issue('PROMO_LIMIT_REACHED', `You’ve already used ${name}.`);
  if (p.firstOrderOnly && !ctx.isFirstOrder)
    return issue('PROMO_INVALID', `${name} is for your first order from this vendor.`);
  if (ctx.subtotal < p.minOrder)
    return issue('PROMO_INVALID', `${name} needs an order of Rs ${p.minOrder} or more.`);
  if (discountOf(p, ctx) <= 0)
    return issue('PROMO_INVALID', `${name} doesn’t apply to this order.`);
  return null;
};

/** One promotion per order: the best for the customer; a code only when typed. */
export const bestPromotion = (
  rules: MockPromotion[],
  v: MockFoodVendor,
  ctx: PromoCtx,
  code: string | null,
) => {
  const wanted = code?.trim().toLowerCase() || null;
  let codeIssue: Issue | null = null;
  const candidates: MockPromotion[] = [];
  for (const p of rules) {
    if (p.code === null) candidates.push(p);
    else if (wanted && p.code.toLowerCase() === wanted) {
      codeIssue = promotionIssue(p, v, ctx);
      if (!codeIssue) candidates.push(p);
    }
  }
  if (wanted && !codeIssue && !candidates.some(p => p.code !== null))
    codeIssue = issue('PROMO_INVALID', `“${code!.trim()}” isn’t a code for this vendor.`);
  let best: { promotion: MockPromotion; discount: number } | null = null;
  for (const p of candidates) {
    if (p.code === null && promotionIssue(p, v, ctx)) continue;
    const discount = discountOf(p, ctx);
    if (
      discount > 0 &&
      (!best ||
        discount > best.discount ||
        (discount === best.discount && p.code !== null && !best.promotion.code))
    )
      best = { promotion: p, discount };
  }
  return { applied: best, codeIssue };
};

const KIND_RANK: Record<MockPromotion['kind'], number> = {
  percent_off_order: 0,
  percent_off_items: 1,
  flat_off: 2,
  free_delivery: 3,
};
export const dealRank = (a: MockPromotion, b: MockPromotion) =>
  KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.value - a.value || a.id.localeCompare(b.id);

/** Live automatic deals for cards and the vendor's page, best first. */
export const dealsFor = (db: MockDb, v: MockFoodVendor, now: number): Deal[] =>
  db.food.promotions
    .filter(
      p =>
        p.businessId === v.businessId &&
        p.code === null &&
        isLive(p, v, now) &&
        (p.usageLimit === null || p.usedCount < p.usageLimit),
    )
    .sort(dealRank)
    .map(p => ({
      id: p.id,
      title: p.title,
      label: dealLabel(p),
      freeDelivery: p.kind === 'free_delivery' && p.minOrder === 0,
    }));

export const promotionState = (p: MockPromotion, now: number) =>
  !p.isActive
    ? 'inactive'
    : p.endsAt && Date.parse(p.endsAt) <= now
    ? 'ended'
    : Date.parse(p.startsAt) > now
    ? 'scheduled'
    : 'live';

export const promotionWire = (p: MockPromotion, now: number) => ({
  id: p.id,
  title: p.title,
  kind: p.kind,
  value: p.value,
  itemIds: [...p.itemIds],
  minOrder: p.minOrder,
  maxDiscount: p.maxDiscount,
  code: p.code,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
  weekdays: [...p.weekdays],
  timeFrom: p.timeFrom,
  timeTo: p.timeTo,
  usageLimit: p.usageLimit,
  perUserLimit: p.perUserLimit,
  usedCount: p.usedCount,
  firstOrderOnly: p.firstOrderOnly,
  isActive: p.isActive,
  state: promotionState(p, now),
  label: dealLabel(p),
});

// ─── Pricing a line ───────────────────────────────────
export const groupsForLine = (db: MockDb, i: MockMenuItem, variantId: string | null) =>
  [...i.links]
    .sort((a, b) => a.sort - b.sort)
    .filter(l => l.variantId === null || l.variantId === variantId)
    .map(l => db.food.groups.find(g => g.id === l.groupId))
    .filter((g): g is NonNullable<typeof g> => !!g);

/** The API's priceChoice: the size, the choices and their rules → the unit price. */
export const priceChoice = (
  db: MockDb,
  i: MockMenuItem,
  variantId: string | null,
  optionIds: string[],
) => {
  const fail = (code: string, message: string, details: Record<string, unknown>) => {
    throw new FoodError(400, code, message, { item: i.name, itemId: i.id, ...details });
  };
  let variant: (typeof i.variants)[number] | null = null;
  if (i.variants.length) {
    variant = i.variants.find(v => v.id === variantId) ?? null;
    if (!variant) fail('OPTION_REQUIRED', `Choose a size for ${i.name}.`, { group: 'Size' });
  } else if (variantId) fail('OPTION_INVALID', `${i.name} has no sizes.`, { group: 'Size' });
  const groups = groupsForLine(db, i, variant?.id ?? null);
  const picked: { id: string; name: string; group: string; groupId: string; priceDelta: number }[] =
    [];
  for (const id of [...new Set(optionIds)]) {
    const g = groups.find(x => x.options.some(o => o.id === id));
    const o = g?.options.find(x => x.id === id);
    if (!g || !o || !o.isActive)
      fail('OPTION_INVALID', `That choice isn’t available for ${i.name}.`, {
        group: g?.name ?? null,
        optionId: id,
      });
    if (!o!.available)
      fail('OPTION_INVALID', `${o!.name} has run out today.`, { group: g!.name, optionId: id });
    picked.push({
      id: o!.id,
      name: o!.name,
      group: g!.name,
      groupId: g!.id,
      priceDelta: o!.priceDelta,
    });
  }
  for (const g of groups) {
    const n = picked.filter(p => p.groupId === g.id).length;
    if (n < g.minSelect)
      fail(
        'OPTION_REQUIRED',
        g.minSelect === 1
          ? `Choose ${g.name.toLowerCase()} for ${i.name}.`
          : `Choose at least ${g.minSelect} in “${g.name}” for ${i.name}.`,
        { group: g.name, min: g.minSelect },
      );
    if (n > g.maxSelect)
      fail('OPTION_LIMIT', `Choose at most ${g.maxSelect} in “${g.name}” for ${i.name}.`, {
        group: g.name,
        max: g.maxSelect,
      });
  }
  return {
    unitPrice: (variant?.price ?? i.basePrice) + picked.reduce((s, p) => s + p.priceDelta, 0),
    variant: variant ? { id: variant.id, name: variant.name } : null,
    options: picked.map(({ id, name, group, priceDelta }) => ({ id, name, group, priceDelta })),
  };
};

// ─── Scheduling ───────────────────────────────────────
const weekdayOfDate = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const dayLabel = (v: MockFoodVendor, at: number) =>
  `${formatDayShort(kitchenToday(v, at).date)} · ${formatSlot(isoNow(at), v.timezone)}`;

export interface SlotChoice {
  slotId: string;
  startsAt: number;
  cutoffAt: number;
  maxOrders: number;
  remaining: number;
}

/** The kitchen's pre-order slots over the next `days` days whose cutoff hasn't passed. */
export const upcomingSlots = (
  db: MockDb,
  v: MockFoodVendor,
  now: number,
  days = MAX_AHEAD_DAYS,
) => {
  const slots = db.food.slots.filter(s => s.businessId === v.businessId);
  const today = kitchenToday(v, now).date;
  const out: Omit<SlotChoice, 'remaining'>[] = [];
  for (let i = 0; i < days && slots.length; i++) {
    const date = addDays(today, i);
    for (const s of slots.filter(x => x.weekday === weekdayOfDate(date))) {
      const startsAt = Date.parse(zonedToIso(date, s.slotStart.slice(0, 5), v.timezone));
      const cutoffAt = startsAt - s.cutoffMinutesBefore * MINUTE;
      if (cutoffAt > now) out.push({ slotId: s.id, startsAt, cutoffAt, maxOrders: s.maxOrders });
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
};

/** Orders already holding a place in one slot occurrence. */
export const slotTaken = (db: MockDb, slotId: string, startsAt: number) =>
  db.food.orders.filter(
    o =>
      o.slotId === slotId &&
      o.scheduledFor &&
      Date.parse(o.scheduledFor) === startsAt &&
      !NEGATIVE.includes(o.status),
  ).length;

/** "Can this vendor take an order for that time?" — slots for home kitchens with them, else any time inside hours. */
export const scheduleCheck = (
  db: MockDb,
  v: MockFoodVendor,
  at: number,
  now: number,
): { issue: Issue | null; slot: SlotChoice | null } => {
  // Scheduled orders are the plan's `preorders` entitlement (on in Community).
  if (!planOf(v).entitlements.preorders)
    return { issue: issue('SLOT_INVALID', 'This vendor isn’t taking scheduled orders.', { preorders: false }), slot: null };
  if (at > now + MAX_AHEAD_DAYS * 86_400_000)
    return {
      issue: issue('SLOT_INVALID', `You can schedule up to ${MAX_AHEAD_DAYS} days ahead.`),
      slot: null,
    };
  if (db.food.slots.some(s => s.businessId === v.businessId)) {
    const s = upcomingSlots(db, v, now, MAX_AHEAD_DAYS + 1).find(x => x.startsAt === at);
    if (!s)
      return {
        issue: issue(
          'SLOT_INVALID',
          'Choose one of the kitchen’s pre-order slots (orders for a slot close before it starts).',
        ),
        slot: null,
      };
    const slot = {
      ...s,
      remaining: Math.max(0, s.maxOrders - slotTaken(db, s.slotId, s.startsAt)),
    };
    if (slot.remaining <= 0)
      return {
        issue: issue(
          'SLOT_FULL',
          `The ${formatSlot(isoNow(s.startsAt), v.timezone)} slot is full — choose another.`,
          { slotId: s.slotId, startsAt: zoned(isoNow(s.startsAt), v.timezone) },
        ),
        slot,
      };
    return { issue: null, slot };
  }
  if (v.preorderOnly)
    return {
      issue: issue('SLOT_INVALID', 'This kitchen hasn’t opened pre-order slots yet.'),
      slot: null,
    };
  const lead = Math.max(MIN_LEAD_MINUTES, v.prepMinutes);
  if (at < now + lead * MINUTE)
    return {
      issue: issue('SLOT_INVALID', `Choose a time at least ${lead} minutes from now.`, {
        minLeadMinutes: lead,
      }),
      slot: null,
    };
  if (!openIntervals(v, now, MAX_AHEAD_DAYS + 1).some(iv => iv.start <= at && at < iv.end))
    return {
      issue: issue(
        'VENDOR_CLOSED',
        `Closed at ${formatSlot(isoNow(at), v.timezone)} on ${formatDayShort(
          kitchenToday(v, at).date,
        )} — choose a time inside opening hours.`,
        {
          scheduledFor: zoned(isoNow(at), v.timezone),
        },
      ),
      slot: null,
    };
  return { issue: null, slot: null };
};

/** GET /food/vendors/:id/slots */
export const slotsWire = (db: MockDb, v: MockFoodVendor, now: number) => {
  const slots = upcomingSlots(db, v, now);
  return {
    timezone: v.timezone,
    preorderOnly: v.preorderOnly,
    usesSlots: slots.length > 0,
    slots: slots.map(s => {
      const remaining = Math.max(0, s.maxOrders - slotTaken(db, s.slotId, s.startsAt));
      return {
        slotId: s.slotId,
        startsAt: zoned(isoNow(s.startsAt), v.timezone),
        cutoffAt: zoned(isoNow(s.cutoffAt), v.timezone),
        label: dayLabel(v, s.startsAt),
        maxOrders: s.maxOrders,
        remaining,
        full: remaining === 0,
      };
    }),
  };
};

// ─── The planner ──────────────────────────────────────
const REASON_TEXT: Record<string, (n: string, later: boolean) => string> = {
  not_on_menu: n => `${n} is no longer on the menu.`,
  unavailable: (n, later) => `${n} isn’t available ${later ? 'at that time' : 'right now'}.`,
  not_today: (n, later) => `${n} isn’t on the menu ${later ? 'that day' : 'today'}.`,
  outside_hours: (n, later) =>
    `${n} isn’t served ${later ? 'at that time' : 'at this time of day'}.`,
  sold_out: n => `${n} is sold out today.`,
};

export interface PlanInput {
  addressId?: string | null;
  paymentMethod?: string | null;
  promoCode?: string | null;
}

export const cartVendorWire = (v: MockFoodVendor, now: number) => {
  const q = quote(v, 'delivery', null, now);
  return {
    id: v.brandId,
    name: v.name,
    slug: v.slug,
    logoUrl: v.logoUrl,
    openState: { open: q.open.open, paused: q.open.paused, label: q.open.label },
    acceptsDelivery: v.acceptsDelivery,
    acceptsPickup: v.acceptsPickup,
    preorderOnly: v.preorderOnly,
  };
};

/** Validates and prices the bag without changing anything (the bag, the preview and checkout). */
export const plan = (
  db: MockDb,
  user: MockUser,
  cart: MockFoodCart | undefined,
  input: PlanInput,
  now: number,
  opts: { defaultAddress?: boolean } = {},
) => {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const out = {
    ok: false,
    issues,
    warnings,
    vendor: null as MockFoodVendor | null,
    cart: cart ?? null,
    fulfilment: cart?.fulfilment ?? 'delivery',
    lines: [] as {
      id: string;
      itemId: string;
      name: string;
      photoUrl: string | null;
      variant: { id: string; name: string } | null;
      options: { id: string; name: string; group: string; priceDelta: number }[];
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      notes: string | null;
      priceChanged: boolean;
      portioned: boolean;
      error: Issue | null;
    }[],
    subtotal: 0,
    discount: 0,
    deliveryFee: 0,
    total: 0,
    promotion: null as (MockPromotion & { discount: number }) | null,
    minOrder: 0,
    shortfall: 0,
    address: null as Record<string, any> | null,
    distanceKm: null as number | null,
    eta: { min: 0, max: 0 },
    paymentMethods: { cod: false, pay_at_pickup: false, transfer: false },
    slot: null as SlotChoice | null,
    forToday: true,
    scheduledLabel: null as string | null,
  };
  if (!cart || !cart.lines.length) {
    issues.push(issue('CART_EMPTY', 'Your cart is empty.'));
    return out;
  }
  const v = db.food.vendors.find(x => x.businessId === cart.businessId && isVisible(db, x));
  if (!v) {
    issues.push(issue('NOT_FOUND', 'This vendor is no longer on Food Court.'));
    return out;
  }
  out.vendor = v;
  const fulfilment = cart.fulfilment;

  // Where it goes.
  let point: { lat: number; lng: number } | null = null;
  const addressIssues: Issue[] = [];
  if (fulfilment === 'delivery') {
    const addrs = db.shop.addresses.filter(a => a.userId === user.id);
    const addressId =
      input.addressId || (opts.defaultAddress ? addrs.find(x => x.isDefault)?.id : undefined);
    const a = addressId ? addrs.find(x => x.id === addressId) : null;
    if (addressId && !a) addressIssues.push(issue('NOT_FOUND', 'Address not found.'));
    else if (a && (a.lat === null || a.lng === null))
      addressIssues.push(
        issue(
          'ADDRESS_LOCATION_REQUIRED',
          'Drop a pin on the map for this address so the rider can find you.',
          { addressId: a.id },
        ),
      );
    else if (a) {
      out.address = a;
      point = { lat: a.lat!, lng: a.lng! };
    } else addressIssues.push(issue('ADDRESS_LOCATION_REQUIRED', 'Choose a delivery address.'));
  }

  const at = cart.scheduledFor ? Date.parse(cart.scheduledFor) : now;
  const later = !!cart.scheduledFor;
  out.forToday = kitchenToday(v, at).date === kitchenToday(v, now).date;
  if (cart.scheduledFor) out.scheduledLabel = dayLabel(v, at);

  // The lines, priced from the menu.
  for (const l of cart.lines) {
    const i = db.food.items.find(x => x.id === l.itemId && x.businessId === v.businessId);
    const line: (typeof out.lines)[number] = {
      id: l.id,
      itemId: l.itemId,
      name: i?.name ?? 'Dish',
      photoUrl: i?.photoUrl ?? null,
      variant: null,
      options: [],
      quantity: l.quantity,
      unitPrice: l.unitPriceSeen,
      lineTotal: l.unitPriceSeen * l.quantity,
      notes: l.notes,
      priceChanged: false,
      portioned: false,
      error: null,
    };
    out.lines.push(line);
    if (!i) {
      line.error = issue('ITEM_UNAVAILABLE', 'A dish in your cart is no longer on the menu.', {
        lineId: l.id,
        reason: 'not_on_menu',
      });
      continue;
    }
    let reason = unavailableReason(db, v, i, now, at);
    if (reason === 'sold_out' && !out.forToday) reason = null;
    if (reason) {
      line.error = issue('ITEM_UNAVAILABLE', REASON_TEXT[reason](i.name, later), {
        lineId: l.id,
        item: i.name,
        reason,
      });
      continue;
    }
    try {
      const priced = priceChoice(db, i, l.variantId, l.optionIds);
      line.variant = priced.variant;
      line.options = priced.options;
      line.unitPrice = priced.unitPrice;
      line.lineTotal = priced.unitPrice * l.quantity;
      line.priceChanged = priced.unitPrice !== l.unitPriceSeen;
      line.portioned = out.forToday && overrideOf(i, v, now).remainingToday !== null;
    } catch (e) {
      const err = e as FoodError;
      line.error = issue(err.code, err.message, { ...(err.details ?? {}), lineId: l.id });
    }
  }
  // Today's portions, across lines of the same dish.
  const wanted = new Map<string, number>();
  for (const l of out.lines)
    if (!l.error && l.portioned) wanted.set(l.itemId, (wanted.get(l.itemId) ?? 0) + l.quantity);
  for (const [itemId, qty] of wanted) {
    const remaining = overrideOf(db.food.items.find(x => x.id === itemId)!, v, now).remainingToday!;
    if (qty > remaining)
      for (const l of out.lines.filter(x => x.itemId === itemId && !x.error))
        l.error = issue(
          'PORTIONS_SOLD_OUT',
          remaining === 0
            ? `${l.name} is sold out today.`
            : `Only ${remaining} ${l.name} left today.`,
          { lineId: l.id, item: l.name, remaining },
        );
  }
  for (const l of out.lines)
    if (!l.error && l.priceChanged)
      warnings.push(
        issue('PRICE_CHANGED', `${l.name} is now Rs ${l.unitPrice.toLocaleString('en-PK')}.`, {
          lineId: l.id,
          unitPrice: l.unitPrice,
        }),
      );
  out.subtotal = out.lines.filter(l => !l.error).reduce((s, l) => s + l.lineTotal, 0);

  const q = quote(v, fulfilment, point, now, out.subtotal);
  out.distanceKm = q.distanceKm;
  out.eta = q.eta;
  // Vendor-level problems first, then address, time, lines, money.
  if (v.isPaused)
    issues.push(
      issue('VENDOR_PAUSED', v.pauseMessage || `${v.name} isn’t taking orders right now.`, {
        message: v.pauseMessage,
      }),
    );
  if (fulfilment === 'delivery' && !v.acceptsDelivery)
    issues.push(
      issue('FULFILMENT_UNAVAILABLE', `${v.name} isn’t delivering right now — switch to pickup.`, {
        fulfilment,
      }),
    );
  if (fulfilment === 'pickup' && !v.acceptsPickup)
    issues.push(issue('FULFILMENT_UNAVAILABLE', `${v.name} doesn’t offer pickup.`, { fulfilment }));
  issues.push(...addressIssues);
  if (fulfilment === 'delivery' && v.acceptsDelivery && point && !q.serviceable)
    issues.push(
      issue('OUT_OF_ZONE', `${v.name} doesn’t deliver to this address.`, {
        distanceKm: q.distanceKm,
        maxRadiusKm: v.maxRadiusKm,
      }),
    );
  if (cart.scheduledFor) {
    const r = scheduleCheck(db, v, at, now);
    out.slot = r.slot;
    if (r.issue) issues.push(r.issue);
  } else if (v.preorderOnly)
    issues.push(
      issue('SLOT_INVALID', `${v.name} takes pre-orders only — choose a slot.`, {
        preorderOnly: true,
      }),
    );
  else if (!q.open.open && !v.isPaused)
    issues.push(
      issue('VENDOR_CLOSED', `${v.name} is closed. ${q.open.label} — you can schedule for later.`, {
        opensAt: q.open.opensAt,
        label: q.open.label,
      }),
    );
  for (const l of out.lines) if (l.error) issues.push(l.error);
  if (fulfilment === 'delivery' && point && q.serviceable) {
    out.minOrder = q.minOrder;
    out.shortfall = Math.max(0, q.minOrder - out.subtotal);
    if (out.shortfall > 0)
      issues.push(
        issue(
          'BELOW_MIN_ORDER',
          `Add Rs ${out.shortfall.toLocaleString(
            'en-PK',
          )} more — the minimum order here is Rs ${q.minOrder.toLocaleString('en-PK')}.`,
          {
            minOrder: q.minOrder,
            subtotal: out.subtotal,
            shortfall: out.shortfall,
          },
        ),
      );
  }
  out.deliveryFee = fulfilment === 'delivery' ? q.deliveryFee : 0;

  // One promotion: the best for the customer.
  const rules = db.food.promotions.filter(p => p.businessId === v.businessId);
  if (rules.length && out.subtotal > 0) {
    const mine = db.food.orders.filter(o => o.userId === user.id && o.businessId === v.businessId);
    const uses = new Map<string, number>();
    for (const o of mine)
      if (o.promotion && !NEGATIVE.includes(o.status))
        uses.set(o.promotion.id, (uses.get(o.promotion.id) ?? 0) + 1);
    const { applied, codeIssue } = bestPromotion(
      rules,
      v,
      {
        now,
        subtotal: out.subtotal,
        lines: out.lines
          .filter(l => !l.error)
          .map(l => ({ itemId: l.itemId, lineTotal: l.lineTotal })),
        deliveryFee: out.deliveryFee,
        userUses: uses,
        isFirstOrder: !mine.some(o => !NEGATIVE.includes(o.status)),
      },
      input.promoCode ?? null,
    );
    if (codeIssue) issues.push({ ...codeIssue, details: { code: input.promoCode } });
    if (applied) out.promotion = { ...applied.promotion, discount: applied.discount };
  } else if (input.promoCode)
    issues.push(
      issue('PROMO_INVALID', `“${input.promoCode}” isn’t a code for this vendor.`, {
        code: input.promoCode,
      }),
    );
  out.discount = out.promotion?.discount ?? 0;
  out.total = out.subtotal - out.discount + out.deliveryFee;

  // How they pay — always the vendor, directly.
  const accounts = v.accounts.filter(a => a.isActive);
  out.paymentMethods = {
    cod: fulfilment === 'delivery' && v.acceptsCod,
    pay_at_pickup: fulfilment === 'pickup',
    transfer: accounts.length > 0,
  };
  const method = input.paymentMethod as keyof typeof out.paymentMethods | undefined;
  if (method && !out.paymentMethods[method])
    issues.push(
      issue(
        'PAYMENT_METHOD_UNAVAILABLE',
        method === 'transfer'
          ? `${v.name} hasn’t added an account for transfers.`
          : method === 'cod'
          ? `${v.name} doesn’t take cash on delivery for this order.`
          : 'Pay at pickup is for pickup orders.',
        { paymentMethod: method },
      ),
    );
  if (method === 'cod' && out.total > v.codLimit)
    issues.push(
      issue(
        'COD_LIMIT_EXCEEDED',
        `Cash on delivery is up to Rs ${v.codLimit.toLocaleString(
          'en-PK',
        )} — pay by transfer instead.`,
        { limit: v.codLimit, total: out.total },
      ),
    );
  out.ok = issues.length === 0;
  return out;
};

export type Plan = ReturnType<typeof plan>;

const lineWire = (l: Plan['lines'][number]) => ({
  id: l.id,
  itemId: l.itemId,
  name: l.name,
  photoUrl: l.photoUrl,
  variant: l.variant,
  options: l.options,
  quantity: l.quantity,
  unitPrice: l.unitPrice,
  lineTotal: l.lineTotal,
  notes: l.notes,
  priceChanged: l.priceChanged,
  error: l.error,
});

const scheduledWire = (p: Plan) =>
  p.cart?.scheduledFor && p.vendor
    ? {
        at: zoned(p.cart.scheduledFor, p.vendor.timezone),
        label: p.scheduledLabel,
        slotId: p.slot?.slotId ?? null,
      }
    : null;

/** GET /food/cart: every problem is a warning here; checkout is where they block. */
export const cartWire = (db: MockDb, user: MockUser, now: number) => {
  const cart = db.food.carts.find(c => c.userId === user.id);
  if (!cart || !cart.lines.length)
    return {
      empty: true,
      vendor: null,
      fulfilment: null,
      scheduledFor: null,
      lines: [],
      itemCount: 0,
      subtotal: 0,
      warnings: [],
      issues: [],
    };
  const p = plan(db, user, cart, {}, now, { defaultAddress: true });
  return {
    empty: false,
    vendor: p.vendor ? cartVendorWire(p.vendor, now) : null,
    fulfilment: cart.fulfilment,
    scheduledFor: scheduledWire(p),
    lines: p.lines.map(lineWire),
    itemCount: p.lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: p.subtotal,
    warnings: [...p.issues, ...p.warnings].filter(i => i.code !== 'ADDRESS_LOCATION_REQUIRED'),
    issues: p.issues,
  };
};

/** POST /food/cart/preview: totals exactly as checkout would charge them. */
export const previewWire = (p: Plan, input: PlanInput, now: number) => ({
  ok: p.ok,
  issues: p.issues,
  warnings: p.warnings,
  vendor: p.vendor ? cartVendorWire(p.vendor, now) : null,
  fulfilment: p.cart?.fulfilment ?? null,
  scheduledFor: scheduledWire(p),
  lines: p.lines.map(lineWire),
  totals: {
    subtotal: p.subtotal,
    discount: p.discount,
    deliveryFee: p.deliveryFee,
    total: p.total,
  },
  deal: p.promotion
    ? {
        id: p.promotion.id,
        title: p.promotion.title,
        kind: p.promotion.kind,
        code: p.promotion.code,
        discount: p.promotion.discount,
      }
    : null,
  minOrder: p.minOrder,
  shortfall: p.shortfall,
  freeDeliveryOver: p.vendor ? p.vendor.freeDeliveryOver : null,
  distanceKm: p.distanceKm === null ? null : Math.round(p.distanceKm * 10) / 10,
  eta:
    p.vendor && !p.cart?.scheduledFor
      ? { min: p.eta.min, max: p.eta.max, label: `${p.eta.min}–${p.eta.max} min` }
      : null,
  payment: {
    method: input.paymentMethod ?? null,
    available: p.paymentMethods,
    codLimit: p.vendor ? p.vendor.codLimit : null,
    accounts: p.paymentMethods.transfer
      ? (p.vendor?.accounts ?? [])
          .filter(a => a.isActive)
          .map(a => ({
            kind: a.kind,
            accountTitle: a.accountTitle,
            accountNumber: a.accountNumber,
            bankName: a.bankName,
          }))
      : [],
  },
});

// ─── The order's life ─────────────────────────────────
type Status = MockFoodOrder['status'];
type PayStatus = MockFoodOrder['paymentStatus'];

export const STATUS_LABEL: Record<Status, string> = {
  placed: 'Waiting for the restaurant',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  picked_up: 'Collected',
  rejected: 'Declined by the restaurant',
  auto_rejected: 'Not accepted in time',
  cancelled: 'Cancelled',
};

const MOVES: Partial<Record<Status, Status[]>> = {
  placed: ['accepted', 'rejected', 'auto_rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['on_the_way', 'picked_up', 'cancelled'],
  on_the_way: ['delivered'],
};
const ACTORS: Record<string, string[]> = {
  'placed>accepted': ['vendor'],
  'placed>rejected': ['vendor'],
  'placed>auto_rejected': ['system'],
  'placed>cancelled': ['customer', 'system', 'admin'],
  'accepted>preparing': ['vendor'],
  'accepted>cancelled': ['vendor', 'system', 'admin'],
  'preparing>ready': ['vendor'],
  'preparing>cancelled': ['vendor', 'admin'],
  'ready>on_the_way': ['vendor', 'rider'],
  'ready>picked_up': ['vendor'],
  'ready>cancelled': ['vendor', 'admin'],
  'on_the_way>delivered': ['vendor', 'rider'],
};
const ONLY_FOR: Partial<Record<Status, MockFoodOrder['fulfilment']>> = {
  on_the_way: 'delivery',
  delivered: 'delivery',
  picked_up: 'pickup',
};

export const allowedMoves = (o: MockFoodOrder, actor: string) =>
  (MOVES[o.status] ?? []).filter(
    to =>
      ACTORS[`${o.status}>${to}`]?.includes(actor) &&
      (!ONLY_FOR[to] || ONLY_FOR[to] === o.fulfilment),
  );

/** cod and pay at pickup are paid when the food changes hands; a transfer when the vendor confirms it. */
const PAYMENT_MOVES: Record<PayStatus, PayStatus[]> = {
  cod_pending: ['paid', 'void'],
  unpaid: ['paid', 'void'],
  awaiting_transfer: ['proof_submitted', 'paid', 'void'],
  proof_submitted: ['paid', 'awaiting_transfer', 'void'],
  paid: ['refund_due'],
  refund_due: ['refunded'],
  void: [],
  refunded: [],
};
const ANYONE = ['customer', 'vendor', 'rider', 'system', 'admin'];
const PAYMENT_ACTORS: Record<string, string[]> = {
  'cod_pending>paid': ['vendor', 'rider', 'system'],
  'unpaid>paid': ['vendor', 'system'],
  'awaiting_transfer>proof_submitted': ['customer'],
  'awaiting_transfer>paid': ['vendor'],
  'proof_submitted>paid': ['vendor'],
  'proof_submitted>awaiting_transfer': ['vendor'],
  'cod_pending>void': ANYONE,
  'unpaid>void': ANYONE,
  'awaiting_transfer>void': ANYONE,
  'proof_submitted>void': ANYONE,
  'paid>refund_due': ANYONE,
  'refund_due>refunded': ['vendor', 'admin'],
};
export const paymentMovesOf = (from: PayStatus) => PAYMENT_MOVES[from];

const STAMP: Partial<Record<Status, keyof MockFoodOrder>> = {
  accepted: 'acceptedAt',
  preparing: 'preparingAt',
  ready: 'readyAt',
  on_the_way: 'pickedUpAt',
  picked_up: 'pickedUpAt',
  delivered: 'deliveredAt',
  rejected: 'cancelledAt',
  auto_rejected: 'cancelledAt',
  cancelled: 'cancelledAt',
};
const PAYMENT_ON_CANCEL: Partial<Record<PayStatus, PayStatus>> = {
  cod_pending: 'void',
  unpaid: 'void',
  awaiting_transfer: 'void',
  proof_submitted: 'void',
  paid: 'refund_due',
};
const PAYMENT_ON_HANDOVER: Partial<Record<PayStatus, PayStatus>> = {
  cod_pending: 'paid',
  unpaid: 'paid',
};

const words = (s: string) => s.replace(/_/g, ' ');
/** 409 INVALID_TRANSITION { from, to, allowed }, as the API words it. */
export const invalidTransition = (from: string, to: string, allowed: string[], message?: string) =>
  new FoodError(
    409,
    'INVALID_TRANSITION',
    message ?? `Cannot move from ${words(from)} to ${words(to)}.`,
    { from, to, allowed },
  );

interface MoveOpts {
  note?: string | null;
  patch?: Partial<MockFoodOrder>;
  message?: string;
}

/** The order's payment machine: who may move it where. */
export const movePayment = (
  o: MockFoodOrder,
  to: PayStatus,
  actor: string,
  now: number,
  opts: MoveOpts = {},
) => {
  const from = o.paymentStatus;
  const allowed = PAYMENT_MOVES[from].filter(x => PAYMENT_ACTORS[`${from}>${x}`]?.includes(actor));
  if (!allowed.includes(to)) throw invalidTransition(from, to, allowed, opts.message);
  Object.assign(o, opts.patch ?? {});
  o.paymentStatus = to;
  o.updatedAt = isoNow(now);
  o.events.push({
    kind: 'payment',
    from,
    to,
    actorRole: actor,
    note: opts.note ?? null,
    at: isoNow(now),
  });
};

const releaseRider = (db: MockDb, riderId: string) => {
  const r = db.food.riders.find(x => x.id === riderId);
  if (r) r.activeOrderCount = Math.max(0, r.activeOrderCount - 1);
};

/**
 * The only way an order's status changes: checked for the actor (and the
 * order's fulfilment), stamped, recorded. A negative end gives back today's
 * portions and the promotion use, settles the payment and frees the rider;
 * handing the food over settles cash.
 */
export const move = (
  db: MockDb,
  o: MockFoodOrder,
  to: Status,
  actor: string,
  now: number,
  opts: MoveOpts = {},
) => {
  const from = o.status;
  const allowed = allowedMoves(o, actor);
  if (!allowed.includes(to)) throw invalidTransition(from, to, allowed, opts.message);
  Object.assign(o, opts.patch ?? {});
  o.status = to;
  const stamp = STAMP[to];
  if (stamp) (o as unknown as Record<string, unknown>)[stamp] = isoNow(now);
  if (NEGATIVE.includes(to)) o.cancelledBy = actor;
  o.updatedAt = isoNow(now);
  o.events.push({
    kind: 'status',
    from,
    to,
    actorRole: actor,
    note: opts.note ?? null,
    at: isoNow(now),
  });
  if (NEGATIVE.includes(to)) {
    const v = db.food.vendors.find(x => x.businessId === o.businessId)!;
    if (o.portionDate && o.portionDate === kitchenToday(v, now).date)
      for (const it of o.items) {
        const i = db.food.items.find(x => x.id === it.itemId);
        if (!i || !it.portions || !i.override) continue;
        const ov = overrideOf(i, v, now);
        if (ov.remainingToday === null) continue;
        ov.remainingToday = Math.min(
          ov.remainingToday + it.portions,
          ov.dailyLimit ?? ov.remainingToday + it.portions,
        );
      }
    if (o.promotion) {
      const p = db.food.promotions.find(x => x.id === o.promotion!.id);
      if (p && p.usedCount > 0) p.usedCount -= 1;
    }
    const pay = PAYMENT_ON_CANCEL[o.paymentStatus];
    if (pay) movePayment(o, pay, actor, now);
    if (o.riderId) releaseRider(db, o.riderId);
  }
  if (to === 'delivered' || to === 'picked_up') {
    const pay = PAYMENT_ON_HANDOVER[o.paymentStatus];
    if (pay) movePayment(o, pay, actor, now);
    if (o.riderId) releaseRider(db, o.riderId);
  }
};

/** The API's minute jobs, run lazily: declining unanswered orders, cancelling unpaid transfers. Returns the orders it moved. */
export const settleFoodOrders = (db: MockDb, now: number): MockFoodOrder[] => {
  const moved: MockFoodOrder[] = [];
  for (const o of db.food.orders) {
    if (o.status === 'placed' && o.acceptBy && Date.parse(o.acceptBy) < now) {
      move(db, o, 'auto_rejected', 'system', now, {
        note: AUTO_REJECT_REASON,
        patch: { cancelReason: AUTO_REJECT_REASON },
      });
      moved.push(o);
    } else if (
      o.paymentMethod === 'transfer' &&
      o.paymentStatus === 'awaiting_transfer' &&
      (o.status === 'placed' || o.status === 'accepted') &&
      o.payBy &&
      Date.parse(o.payBy) < now
    ) {
      move(db, o, 'cancelled', 'system', now, {
        note: UNPAID_REASON,
        patch: { cancelReason: UNPAID_REASON },
      });
      moved.push(o);
    }
  }
  return moved;
};

const rs = (n: number) => formatPKR(n);

export const paymentInstructions = (o: MockFoodOrder, tz: string) => {
  if (o.paymentStatus === 'paid') return null;
  switch (o.paymentMethod) {
    case 'cod':
      return `Pay ${rs(o.total)} in cash when your order arrives.`;
    case 'pay_at_pickup':
      return `Pay ${rs(o.total)} at the counter when you collect.`;
    case 'transfer':
      return o.paymentStatus === 'proof_submitted'
        ? 'Waiting for the vendor to confirm your transfer.'
        : `Transfer ${rs(o.total)} to one of the vendor’s accounts${
            o.payBy ? ` by ${formatSlot(o.payBy, tz)}` : ''
          }, then upload the receipt.`;
  }
};

export const riderCardOf = (db: MockDb, o: MockFoodOrder, now: number) => {
  if (!o.riderId) return null;
  const r = db.food.riders.find(x => x.id === o.riderId);
  if (!r) return null;
  return {
    name: r.fullName,
    phone: r.phone,
    vehicle: r.vehicle,
    step: o.riderStep ?? 'assigned',
    locationLive: !!r.locationUpdatedAt && now - Date.parse(r.locationUpdatedAt) <= 2 * MINUTE,
    // The position only while it's live (the API's riderCard).
    lastGeo: r.lastGeo && !!r.locationUpdatedAt && now - Date.parse(r.locationUpdatedAt) <= 2 * MINUTE ? { ...r.lastGeo } : null,
    at: r.locationUpdatedAt ?? o.updatedAt,
  };
};

const vendorOf = (db: MockDb, o: MockFoodOrder) =>
  db.food.vendors.find(x => x.businessId === o.businessId)!;
const brandOf = (v: MockFoodVendor) => ({
  id: v.brandId,
  name: v.name,
  slug: v.slug,
  logoUrl: v.logoUrl,
});

/** The full order: lines, money, payment, events, and what the viewer may do next. */
export const orderView = (
  db: MockDb,
  o: MockFoodOrder,
  viewer: 'customer' | 'vendor' | 'rider' | 'admin',
  now: number,
  canReview = false,
) => {
  const v = vendorOf(db, o);
  const ended = ENDED.includes(o.status);
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    fulfilment: o.fulfilment,
    scheduledFor: zoned(o.scheduledFor, v.timezone),
    placedAt: o.placedAt,
    acceptBy: o.status === 'placed' ? o.acceptBy : null,
    vendor: {
      ...brandOf(v),
      phone: v.phone,
      location: { addressLine: v.addressLine, area: v.area, city: v.city, lat: v.lat, lng: v.lng },
    },
    items: o.items.map(i => ({
      id: i.id,
      itemId: i.itemId,
      name: i.name,
      variant: i.variant,
      options: i.options.map(x => ({ name: x.name, group: x.group, priceDelta: x.priceDelta })),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      notes: i.notes,
    })),
    totals: {
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryFee: o.deliveryFee,
      total: o.total,
    },
    deal: o.promotion,
    payment: {
      method: o.paymentMethod,
      status: o.paymentStatus,
      payBy: o.paymentStatus === 'awaiting_transfer' ? o.payBy : null,
      accounts: o.paymentMethod === 'transfer' ? o.accounts : null,
      reference: o.paymentRef,
      proofUrl: o.paymentProofUrl,
      rejectedReason: o.paymentRejectedReason,
      instructions:
        ended && o.status !== 'delivered' && o.status !== 'picked_up'
          ? null
          : paymentInstructions(o, v.timezone),
    },
    address: o.address,
    distanceKm: o.distanceKm,
    cutlery: o.cutlery,
    note: o.note,
    eta: { minutes: o.etaMinutes, promisedAt: o.promisedAt },
    rider: riderCardOf(db, o, now),
    handedToExternal: o.handedToExternal,
    ...(viewer === 'customer' ? null : { codCollected: o.codCollected }),
    cancelledBy: o.cancelledBy,
    cancelReason: o.cancelReason,
    timestamps: {
      acceptedAt: o.acceptedAt,
      preparingAt: o.preparingAt,
      readyAt: o.readyAt,
      pickedUpAt: o.pickedUpAt,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
    },
    events: o.events.map(e => ({
      kind: e.kind,
      from: e.from,
      to: e.to,
      actorRole: e.actorRole,
      note: e.note,
      at: e.at,
    })),
    canCancel: viewer === 'customer' && o.status === 'placed',
    canReview: viewer === 'customer' && canReview,
    canReorder: viewer === 'customer' && ended,
  };
};

const customerOf = (db: MockDb, o: MockFoodOrder) => {
  const u = db.users.find(x => x.id === o.userId);
  return {
    name: (o.address?.fullName as string | undefined) ?? u?.name ?? 'Customer',
    phone: (o.address?.phone as string | undefined) ?? u?.phone ?? null,
  };
};

/** The vendor's detail: the customer's contact and the moves the vendor can make. */
export const vendorOrderView = (db: MockDb, o: MockFoodOrder, now: number) => {
  const ended = ENDED.includes(o.status);
  return {
    ...orderView(db, o, 'vendor', now),
    customer: customerOf(db, o),
    actions: {
      status: allowedMoves(o, 'vendor'),
      payment: PAYMENT_MOVES[o.paymentStatus].filter(
        x =>
          (x === 'paid' && o.paymentMethod === 'transfer' && !ended) ||
          (x === 'awaiting_transfer' && o.paymentStatus === 'proof_submitted'),
      ),
    },
  };
};

export const summaryView = (db: MockDb, o: MockFoodOrder) => ({
  id: o.id,
  code: o.code,
  status: o.status,
  statusLabel: STATUS_LABEL[o.status],
  fulfilment: o.fulfilment,
  vendor: brandOf(vendorOf(db, o)),
  itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  total: o.total,
  placedAt: o.placedAt,
  scheduledFor: o.scheduledFor,
});

/** Board cards (also what board.sync and order.new carry). */
export const boardView = (db: MockDb, o: MockFoodOrder) => ({
  id: o.id,
  code: o.code,
  status: o.status,
  statusLabel: STATUS_LABEL[o.status],
  fulfilment: o.fulfilment,
  scheduledFor: o.scheduledFor,
  placedAt: o.placedAt,
  acceptBy: o.status === 'placed' ? o.acceptBy : null,
  promisedAt: o.promisedAt,
  total: o.total,
  payment: { method: o.paymentMethod, status: o.paymentStatus },
  itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  itemsSummary: o.items.map(i => `${i.quantity}× ${i.name}`).join(', '),
  customerName: customerOf(db, o).name,
  riderId: o.riderId,
  handedToExternal: o.handedToExternal,
});

export const VENDOR_BUCKETS: Record<string, Status[]> = {
  new: ['placed'],
  active: ['accepted', 'preparing', 'ready', 'on_the_way'],
  done: ENDED,
};
export const ACTIVE_STATUSES: Status[] = ['placed', 'accepted', 'preparing', 'ready', 'on_the_way'];
export const ENDED_STATUSES = ENDED;

export const trackingView = (db: MockDb, o: MockFoodOrder, now: number) => {
  const v = vendorOf(db, o);
  return {
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    fulfilment: o.fulfilment,
    eta: {
      promisedAt: o.promisedAt,
      minutesLeft:
        o.promisedAt && !ENDED.includes(o.status)
          ? Math.max(0, Math.ceil((Date.parse(o.promisedAt) - now) / MINUTE))
          : null,
    },
    branch: { name: v.name, phone: v.phone, lat: v.lat, lng: v.lng },
    drop: o.address ? { lat: o.address.lat as number, lng: o.address.lng as number } : null,
    rider: riderCardOf(db, o, now),
    handedToExternal: o.handedToExternal,
    updatedAt: o.updatedAt,
  };
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newOrderCode = (db: MockDb) => {
  for (;;) {
    const c = `FC-${Array.from(
      { length: 6 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join('')}`;
    if (!db.food.orders.some(o => o.code === c)) return c;
  }
};

/** The first problem as the error; every problem in details (checkout). */
const PLAN_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  CART_OTHER_VENDOR: 409,
  ITEM_UNAVAILABLE: 409,
  PORTIONS_SOLD_OUT: 409,
  SLOT_FULL: 409,
  PROMO_LIMIT_REACHED: 409,
  VENDOR_CLOSED: 409,
  VENDOR_PAUSED: 409,
};
export const planError = (p: Plan) => {
  const first = p.issues[0];
  return new FoodError(PLAN_STATUS[first.code] ?? 400, first.code, first.message, {
    ...(first.details ?? {}),
    issues: p.issues,
  });
};

/**
 * Checkout from a plan that passed: a place in the slot, today's portions
 * (only where enough are left), one promotion use, the order and its
 * snapshot lines, the bag cleared. The route wrapper rolls all of it back
 * if anything throws.
 */
export const placeOrder = (
  db: MockDb,
  user: MockUser,
  p: Plan,
  input: Record<string, any>,
  now: number,
): MockFoodOrder => {
  const v = p.vendor!;
  const transfer = input.paymentMethod === 'transfer';
  if (p.slot && slotTaken(db, p.slot.slotId, p.slot.startsAt) >= p.slot.maxOrders)
    throw new FoodError(
      409,
      'SLOT_FULL',
      `The ${formatSlot(
        isoNow(p.slot.startsAt),
        v.timezone,
      )} slot has just filled up — choose another.`,
      { slotId: p.slot.slotId },
    );
  const wanted = new Map<string, { name: string; qty: number }>();
  for (const l of p.lines.filter(x => x.portioned)) {
    const w = wanted.get(l.itemId) ?? { name: l.name, qty: 0 };
    w.qty += l.quantity;
    wanted.set(l.itemId, w);
  }
  for (const [itemId, w] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    const i = db.food.items.find(x => x.id === itemId)!;
    const o = overrideOf(i, v, now);
    const left = o.remainingToday ?? 0;
    if (left < w.qty)
      throw new FoodError(
        409,
        'PORTIONS_SOLD_OUT',
        left > 0 ? `Only ${left} ${w.name} left today.` : `${w.name} has just sold out for today.`,
        { item: w.name, itemId, remaining: left },
      );
    o.remainingToday = left - w.qty;
    i.override = o;
  }
  if (p.promotion) {
    const promo = db.food.promotions.find(x => x.id === p.promotion!.id);
    if (
      !promo ||
      !promo.isActive ||
      (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit)
    )
      throw new FoodError(
        409,
        'PROMO_LIMIT_REACHED',
        `${p.promotion.code ? `“${p.promotion.code}”` : p.promotion.title} has just been used up.`,
        { promotionId: p.promotion.id, code: p.promotion.code },
      );
    promo.usedCount += 1;
  }
  const a = p.address;
  const scheduledFor = p.cart!.scheduledFor;
  const order: MockFoodOrder = {
    id: nextId(db, 'fo'),
    code: newOrderCode(db),
    userId: user.id,
    businessId: v.businessId,
    fulfilment: p.fulfilment,
    scheduledFor,
    slotId: p.slot?.slotId ?? null,
    portionDate: wanted.size ? kitchenToday(v, now).date : null,
    status: 'placed',
    paymentMethod: input.paymentMethod,
    paymentStatus:
      input.paymentMethod === 'cod'
        ? 'cod_pending'
        : input.paymentMethod === 'pay_at_pickup'
        ? 'unpaid'
        : 'awaiting_transfer',
    payBy: transfer ? isoNow(now + TRANSFER_WINDOW_MINUTES * MINUTE) : null,
    accounts: transfer
      ? v.accounts
          .filter(x => x.isActive)
          .map(x => ({
            kind: x.kind,
            accountTitle: x.accountTitle,
            accountNumber: x.accountNumber,
            bankName: x.bankName,
          }))
      : null,
    paymentRef: null,
    paymentProofUrl: null,
    paymentRejectedReason: null,
    address: a
      ? {
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          city: a.city,
          area: a.area,
          line1: a.line1,
          landmark: a.landmark ?? null,
          building: input.building ?? null,
          floor: input.floor ?? null,
          riderInstructions: input.riderInstructions ?? null,
          lat: a.lat,
          lng: a.lng,
        }
      : null,
    distanceKm: a ? p.distanceKm : null,
    items: p.lines.map(l => ({
      id: nextId(db, 'oi'),
      itemId: l.itemId,
      name: l.name,
      variantId: l.variant?.id ?? null,
      variant: l.variant?.name ?? null,
      options: l.options.map(o => ({
        id: o.id,
        name: o.name,
        group: o.group,
        priceDelta: o.priceDelta,
      })),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      notes: l.notes,
      portions: l.portioned ? l.quantity : 0,
    })),
    subtotal: p.subtotal,
    discount: p.discount,
    deliveryFee: p.deliveryFee,
    total: p.total,
    promotion: p.promotion
      ? {
          id: p.promotion.id,
          title: p.promotion.title,
          kind: p.promotion.kind,
          code: p.promotion.code,
        }
      : null,
    cutlery: input.cutlery === true,
    note: input.note ?? null,
    etaMinutes: scheduledFor ? null : p.eta.max,
    promisedAt: scheduledFor ?? isoNow(now + p.eta.max * MINUTE),
    acceptBy: isoNow(now + v.autoRejectMinutes * MINUTE),
    riderId: null,
    riderStep: null,
    handedToExternal: false,
    codCollected: null,
    cancelledBy: null,
    cancelReason: null,
    placedAt: isoNow(now),
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    cancelledAt: null,
    events: [
      {
        kind: 'status',
        from: null,
        to: 'placed',
        actorRole: 'customer',
        note: null,
        at: isoNow(now),
      },
    ],
    updatedAt: isoNow(now),
  };
  db.food.orders.push(order);
  db.food.carts = db.food.carts.filter(c => c.userId !== user.id);
  return order;
};
