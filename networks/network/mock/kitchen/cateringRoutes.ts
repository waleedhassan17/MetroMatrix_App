// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy catering routes ("Plan a dawat")
// ═══════════════════════════════════════════════════════
// A customer asks a kitchen to cater an event (date, time, guests, the
// dishes, a budget, delivery, pickup or on site). The kitchen answers with
// a quote; each new quote is a new version and the older ones go out of
// date. The customer accepts the latest one before it expires (409
// QUOTE_OUTDATED / QUOTE_EXPIRED otherwise), pays the advance to the
// kitchen's own account and sends the receipt; the kitchen confirms it and
// the event is confirmed. Mirrors docs/API_KITCHEN_ASSUMED.md §2.10, §3.10.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx } from '../shop/shopRoutes';
import type { MockFoodVendor } from '../food/foodTypes';
import { isVisible } from '../food/foodDiscovery';
import { addDays, zonedToIso } from '../../../../utils/healthTime';
import type { MockCateringQuote, MockCateringRequest, MockCateringSettings } from './kitchenTypes';
import { DATE, KitchenError, invalid, isInt, isoNow, k, nextId, notFound, text, todayOf, vendorOf } from './kitchenLogic';
import type { KitchenKit } from './kitchenRoutes';

export const EVENT_TYPES = ['mehndi', 'baraat', 'walima', 'birthday', 'aqiqah', 'milad', 'quran_khwani', 'office', 'family', 'other'] as const;
const MODES = ['delivery', 'pickup', 'on_site'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const IMAGE_URL = /^(https?:|blob:|file:|data:image\/)/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_GUESTS = 2000;
export const MAX_DISHES = 20;
export const MAX_AHEAD_DAYS = 180;
/** An accepted quote's advance is due within this long. */
export const ADVANCE_HOURS = 48;

const enc = (s: string) => decodeURIComponent(s);

export const cateringSettingsOf = (db: MockDb, businessId: string): MockCateringSettings => {
  const all = k(db).cateringSettings ?? (k(db).cateringSettings = []);
  let s = all.find(x => x.businessId === businessId);
  if (!s) {
    s = { businessId, open: false, minGuests: 20, leadDays: 2 };
    all.push(s);
  }
  return s;
};

const newCode = (db: MockDb) => {
  for (;;) {
    const c = `CT-${Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')}`;
    if (!k(db).catering.some(x => x.code === c)) return c;
  }
};

const latest = (r: MockCateringRequest) => r.quotes[r.quotes.length - 1] ?? null;

/** A quote as it stands now: the one accepted, the current one, out of date, or expired. */
const quoteState = (r: MockCateringRequest, q: MockCateringQuote, now: number) =>
  r.acceptedVersion === q.version ? 'accepted' : q !== latest(r) ? 'outdated' : Date.parse(q.validUntil) < now ? 'expired' : r.acceptedVersion ? 'outdated' : 'current';

const accountsOf = (v: MockFoodVendor) => v.accounts.filter(a => a.isActive).map(a => ({ kind: a.kind, accountTitle: a.accountTitle, accountNumber: a.accountNumber, bankName: a.bankName }));

/** A confirmed event whose day has passed is done. */
const statusOf = (db: MockDb, r: MockCateringRequest, now: number) => {
  const v = vendorOf(db, r.businessId);
  return r.status === 'confirmed' && r.date < todayOf(v, now) ? 'completed' : r.status;
};

export const requestWire = (db: MockDb, r: MockCateringRequest, viewer: 'customer' | 'vendor', now: number) => {
  const v = vendorOf(db, r.businessId);
  const u = db.users.find(x => x.id === r.userId);
  const accepted = r.acceptedVersion ? r.quotes.find(q => q.version === r.acceptedVersion) ?? null : null;
  const status = statusOf(db, r, now);
  const a = r.address as Record<string, unknown> | null;
  return {
    code: r.code,
    status,
    vendor: { id: v.brandId, slug: v.slug, name: v.name, logoUrl: v.logoUrl, phone: v.phone },
    ...(viewer === 'vendor' ? { customer: { name: u?.name ?? 'Customer', phone: u?.phone ?? null } } : null),
    date: r.date,
    time: r.time,
    startsAt: zonedToIso(r.date, r.time, v.timezone),
    guests: r.guests,
    eventType: r.eventType,
    dishes: r.dishes,
    budget: r.budget,
    mode: r.mode,
    address: a ? { line1: a.line1 ?? null, area: a.area ?? null, city: a.city ?? null, lat: a.lat ?? null, lng: a.lng ?? null } : null,
    notes: r.notes,
    quotes: r.quotes.map(q => ({ ...q, state: quoteState(r, q, now) })),
    acceptedVersion: r.acceptedVersion,
    advance: accepted && accepted.advance > 0
      ? {
          amount: accepted.advance,
          status: r.advanceStatus === 'none' ? 'awaiting_transfer' : r.advanceStatus,
          payBy: r.advanceStatus === 'awaiting_transfer' ? isoNow(Date.parse(r.updatedAt) + ADVANCE_HOURS * 3_600_000) : null,
          accounts: accountsOf(v),
          reference: r.advanceRef,
          proofUrl: r.advanceProofUrl,
          rejectedReason: r.advanceRejectedReason,
        }
      : null,
    balance: accepted ? accepted.total - accepted.advance : null,
    declineReason: r.declineReason,
    cancelReason: r.cancelReason,
    canAccept: viewer === 'customer' && status === 'quoted' && !!latest(r) && quoteState(r, latest(r)!, now) === 'current',
    canCancel: viewer === 'customer' && ['requested', 'quoted', 'accepted'].includes(status),
    canQuote: viewer === 'vendor' && ['requested', 'quoted'].includes(status),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

export function registerCateringRoutes(kit: KitchenKit) {
  const { route, myVendor, requireUser, optionalUser } = kit;

  const customer = (ctx: ShopCtx): MockUser => {
    const u = requireUser(ctx);
    if (u.role !== 'customer') throw new KitchenError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return u;
  };
  const mine = (ctx: ShopCtx, u: MockUser, code: string) => {
    const r = k(ctx.db).catering.find(x => x.code === code.toUpperCase() && x.userId === u.id);
    if (!r) throw notFound('Catering request');
    return r;
  };
  const theirs = (ctx: ShopCtx, v: MockFoodVendor, code: string) => {
    const r = k(ctx.db).catering.find(x => x.code === code.toUpperCase() && x.businessId === v.businessId);
    if (!r) throw notFound('Catering request');
    return r;
  };
  const touch = (ctx: ShopCtx, r: MockCateringRequest) => {
    r.updatedAt = isoNow(ctx.now);
  };
  const notNow = (r: MockCateringRequest, ctx: ShopCtx) =>
    new KitchenError(409, 'INVALID_TRANSITION', `This request is ${statusOf(ctx.db, r, ctx.now)}.`, { status: statusOf(ctx.db, r, ctx.now) });

  // ── Customers ──
  route('GET', '/food/catering/vendors/:id', ctx => {
    optionalUser(ctx);
    const id = enc(ctx.params[0]);
    const v = ctx.db.food.vendors.find(x => (x.brandId === id || x.slug === id) && isVisible(ctx.db, x));
    if (!v) throw new KitchenError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    const s = cateringSettingsOf(ctx.db, v.businessId);
    const today = todayOf(v, ctx.now);
    return {
      vendorId: v.brandId,
      open: s.open,
      minGuests: s.minGuests,
      leadDays: s.leadDays,
      earliestDate: addDays(today, s.leadDays),
      modes: v.lat !== null ? MODES : ['delivery', 'pickup'],
      menu: ctx.db.food.items
        .filter(i => i.businessId === v.businessId && i.isActive)
        .map(i => ({ itemId: i.id, name: i.name, price: i.basePrice, photoUrl: i.photoUrl })),
    };
  });

  route('POST', '/food/catering/requests', ctx => {
    const u = customer(ctx);
    const b = ctx.body;
    const v = ctx.db.food.vendors.find(x => x.brandId === String(b.vendorId ?? '') && isVisible(ctx.db, x));
    if (!v) throw new KitchenError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    const s = cateringSettingsOf(ctx.db, v.businessId);
    if (!s.open) throw new KitchenError(409, 'CATERING_CLOSED', `${v.name} isn’t taking catering requests right now.`);
    const today = todayOf(v, ctx.now);
    const date = text(b.date);
    if (!DATE.test(date) || date < addDays(today, s.leadDays) || date > addDays(today, MAX_AHEAD_DAYS))
      throw invalid('date', `Ask at least ${s.leadDays} days ahead.`, { earliestDate: addDays(today, s.leadDays) });
    if (!HHMM.test(text(b.time))) throw invalid('time', 'time must be HH:mm');
    if (!isInt(b.guests) || b.guests < s.minGuests || b.guests > MAX_GUESTS) throw invalid('guests', `${s.minGuests} to ${MAX_GUESTS} guests.`, { minGuests: s.minGuests });
    if (!(EVENT_TYPES as readonly string[]).includes(b.eventType)) throw invalid('eventType', `eventType must be one of ${EVENT_TYPES.join(', ')}`);
    if (!(MODES as readonly string[]).includes(b.mode)) throw invalid('mode', 'mode must be delivery, pickup or on_site');
    if (!Array.isArray(b.dishes) || !b.dishes.length || b.dishes.length > MAX_DISHES) throw invalid('dishes', `Ask for 1 to ${MAX_DISHES} dishes.`);
    const dishes = b.dishes.map((d: any, n: number) => {
      const item = d?.itemId ? ctx.db.food.items.find(i => i.id === String(d.itemId) && i.businessId === v.businessId) : null;
      if (d?.itemId && !item) throw invalid(`dishes.${n}.itemId`, 'Pick dishes from this kitchen’s menu, or name them.');
      const name = item?.name ?? text(d?.name);
      if (name.length < 2 || name.length > 60) throw invalid(`dishes.${n}.name`, 'Name each dish.');
      if (!isInt(d?.qty) || d.qty < 1 || d.qty > MAX_GUESTS * 3) throw invalid(`dishes.${n}.qty`, 'How many of each.');
      return { itemId: item?.id ?? null, name, qty: d.qty };
    });
    const budget = b.budget === undefined || b.budget === null ? null : b.budget;
    if (budget !== null && (!isInt(budget) || budget < 1000)) throw invalid('budget', 'A budget in whole rupees, or none.');
    let address: Record<string, unknown> | null = null;
    if (b.mode !== 'pickup') {
      const a = ctx.db.shop.addresses.find(x => x.id === text(b.addressId) && x.userId === u.id);
      if (!a) throw new KitchenError(422, 'ADDRESS_REQUIRED', 'Choose where the event is.');
      address = { label: a.label, fullName: a.fullName, phone: a.phone, city: a.city, area: a.area, line1: a.line1, landmark: a.landmark ?? null, lat: a.lat, lng: a.lng };
    }
    const r: MockCateringRequest = {
      id: nextId(ctx.db, 'ct'),
      code: newCode(ctx.db),
      businessId: v.businessId,
      userId: u.id,
      status: 'requested',
      date,
      time: text(b.time),
      guests: b.guests,
      eventType: b.eventType,
      dishes,
      budget,
      mode: b.mode,
      address,
      notes: text(b.notes).slice(0, 500) || null,
      quotes: [],
      acceptedVersion: null,
      advanceStatus: 'none',
      advanceRef: null,
      advanceProofUrl: null,
      advanceRejectedReason: null,
      declineReason: null,
      cancelReason: null,
      createdAt: isoNow(ctx.now),
      updatedAt: isoNow(ctx.now),
    };
    k(ctx.db).catering.push(r);
    ctx.setStatus(201);
    return requestWire(ctx.db, r, 'customer', ctx.now);
  });

  route('GET', '/food/catering/requests', ctx => {
    const u = customer(ctx);
    return {
      items: k(ctx.db)
        .catering.filter(r => r.userId === u.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(r => requestWire(ctx.db, r, 'customer', ctx.now)),
    };
  });

  route('GET', '/food/catering/requests/:code', ctx => requestWire(ctx.db, mine(ctx, customer(ctx), enc(ctx.params[0])), 'customer', ctx.now));

  route('POST', '/food/catering/requests/:code/quotes/:version/accept', ctx => {
    const r = mine(ctx, customer(ctx), enc(ctx.params[0]));
    const version = Number(enc(ctx.params[1]));
    const q = r.quotes.find(x => x.version === version);
    if (!q) throw notFound('Quote');
    if (statusOf(ctx.db, r, ctx.now) !== 'quoted') throw notNow(r, ctx);
    const state = quoteState(r, q, ctx.now);
    if (state === 'outdated') throw new KitchenError(409, 'QUOTE_OUTDATED', `${vendorOf(ctx.db, r.businessId).name} has sent a newer quote. Look at version ${latest(r)!.version}.`, { latest: latest(r)!.version });
    if (state === 'expired') throw new KitchenError(409, 'QUOTE_EXPIRED', 'This quote has expired. Ask the kitchen for a new one.', { validUntil: q.validUntil });
    r.acceptedVersion = q.version;
    r.status = q.advance > 0 ? 'accepted' : 'confirmed';
    r.advanceStatus = q.advance > 0 ? 'awaiting_transfer' : 'none';
    touch(ctx, r);
    return requestWire(ctx.db, r, 'customer', ctx.now);
  });

  route('POST', '/food/catering/requests/:code/advance-proof', ctx => {
    const r = mine(ctx, customer(ctx), enc(ctx.params[0]));
    if (r.status !== 'accepted' || r.advanceStatus !== 'awaiting_transfer') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no advance waiting on this request.', { status: r.advanceStatus });
    const tx = text(ctx.body.transactionId);
    if (tx.length < 4 || tx.length > 40) throw invalid('transactionId', 'Enter the transaction ID from your receipt.');
    if (ctx.body.imageUrl !== undefined && ctx.body.imageUrl !== null && !IMAGE_URL.test(String(ctx.body.imageUrl))) throw invalid('imageUrl', 'Upload the receipt first.');
    r.advanceStatus = 'proof_submitted';
    r.advanceRef = tx;
    r.advanceProofUrl = ctx.body.imageUrl ?? null;
    r.advanceRejectedReason = null;
    touch(ctx, r);
    return requestWire(ctx.db, r, 'customer', ctx.now);
  });

  route('POST', '/food/catering/requests/:code/cancel', ctx => {
    const r = mine(ctx, customer(ctx), enc(ctx.params[0]));
    if (!['requested', 'quoted', 'accepted'].includes(statusOf(ctx.db, r, ctx.now))) throw notNow(r, ctx);
    if (r.advanceStatus === 'paid') throw new KitchenError(409, 'CANCEL_NOT_ALLOWED', 'You’ve paid the advance. Call the kitchen to cancel.');
    r.status = 'cancelled';
    r.cancelReason = text(ctx.body.reason).slice(0, 200) || null;
    touch(ctx, r);
    return requestWire(ctx.db, r, 'customer', ctx.now);
  });

  // ── The kitchen ──
  route('GET', '/food/vendor/catering/settings', ctx => {
    const s = cateringSettingsOf(ctx.db, myVendor(ctx).businessId);
    return { open: s.open, minGuests: s.minGuests, leadDays: s.leadDays };
  });

  route('PATCH', '/food/vendor/catering/settings', ctx => {
    const s = cateringSettingsOf(ctx.db, myVendor(ctx).businessId);
    const b = ctx.body;
    if (b.open !== undefined) {
      if (typeof b.open !== 'boolean') throw invalid('open', 'open must be true or false');
      s.open = b.open;
    }
    if (b.minGuests !== undefined) {
      if (!isInt(b.minGuests) || b.minGuests < 1 || b.minGuests > 500) throw invalid('minGuests', 'minGuests must be 1 to 500');
      s.minGuests = b.minGuests;
    }
    if (b.leadDays !== undefined) {
      if (!isInt(b.leadDays) || b.leadDays < 1 || b.leadDays > 30) throw invalid('leadDays', 'leadDays must be 1 to 30');
      s.leadDays = b.leadDays;
    }
    return { open: s.open, minGuests: s.minGuests, leadDays: s.leadDays };
  });

  route('GET', '/food/vendor/catering/requests', ctx => {
    const v = myVendor(ctx);
    const status = ctx.query.status === undefined ? null : String(ctx.query.status);
    const GROUPS: Record<string, string[]> = { new: ['requested'], quoted: ['quoted', 'accepted'], confirmed: ['confirmed'], past: ['completed', 'declined', 'cancelled'] };
    if (status !== null && !GROUPS[status]) throw invalid('status', 'status must be new, quoted, confirmed or past');
    const all = k(ctx.db).catering.filter(r => r.businessId === v.businessId);
    const count = (g: string) => all.filter(r => GROUPS[g].includes(statusOf(ctx.db, r, ctx.now))).length;
    return {
      counts: { new: count('new'), quoted: count('quoted'), confirmed: count('confirmed'), past: count('past') },
      items: all
        .filter(r => status === null || GROUPS[status].includes(statusOf(ctx.db, r, ctx.now)))
        .sort((a, b) => (status === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
        .map(r => requestWire(ctx.db, r, 'vendor', ctx.now)),
    };
  });

  route('GET', '/food/vendor/catering/requests/:code', ctx => requestWire(ctx.db, theirs(ctx, myVendor(ctx), enc(ctx.params[0])), 'vendor', ctx.now));

  route('POST', '/food/vendor/catering/requests/:code/quotes', ctx => {
    const v = myVendor(ctx);
    const r = theirs(ctx, v, enc(ctx.params[0]));
    if (!['requested', 'quoted'].includes(statusOf(ctx.db, r, ctx.now))) throw notNow(r, ctx);
    const b = ctx.body;
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 40) throw invalid('lines', 'lines: 1 to 40');
    const lines = b.lines.map((l: any, n: number) => {
      const item = l?.itemId ? ctx.db.food.items.find(i => i.id === String(l.itemId) && i.businessId === v.businessId) : null;
      if (l?.itemId && !item) throw invalid(`lines.${n}.itemId`, 'Pick dishes from your menu, or name them.');
      const name = text(l?.name) || item?.name || '';
      if (name.length < 2 || name.length > 60) throw invalid(`lines.${n}.name`, 'Name each line.');
      if (!isInt(l?.qty) || l.qty < 1 || l.qty > 10_000) throw invalid(`lines.${n}.qty`, 'qty must be 1 or more');
      if (!isInt(l?.unitPrice) || l.unitPrice < 0 || l.unitPrice > 100_000) throw invalid(`lines.${n}.unitPrice`, 'unitPrice in whole rupees');
      return { itemId: item?.id ?? null, name, qty: l.qty, unitPrice: l.unitPrice, total: l.qty * l.unitPrice };
    });
    const deliveryFee = b.deliveryFee ?? 0;
    if (!isInt(deliveryFee) || deliveryFee < 0 || deliveryFee > 100_000) throw invalid('deliveryFee', 'deliveryFee in whole rupees');
    if (!isInt(b.advancePct) || b.advancePct < 0 || b.advancePct > 100) throw invalid('advancePct', 'advancePct must be 0 to 100');
    const validUntil = Date.parse(String(b.validUntil ?? ''));
    const eventAt = Date.parse(zonedToIso(r.date, r.time, v.timezone));
    if (!Number.isFinite(validUntil) || validUntil <= ctx.now || validUntil > eventAt) throw invalid('validUntil', 'The quote is valid until a time before the event.');
    const subtotal = lines.reduce((n: number, l: { total: number }) => n + l.total, 0);
    const total = subtotal + deliveryFee;
    const q: MockCateringQuote = {
      version: r.quotes.length + 1,
      lines,
      subtotal,
      deliveryFee,
      total,
      advancePct: b.advancePct,
      advance: Math.round((total * b.advancePct) / 100),
      validUntil: isoNow(validUntil),
      notes: text(b.notes).slice(0, 500) || null,
      createdAt: isoNow(ctx.now),
    };
    r.quotes.push(q);
    r.status = 'quoted';
    touch(ctx, r);
    ctx.setStatus(201);
    return requestWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/catering/requests/:code/decline', ctx => {
    const v = myVendor(ctx);
    const r = theirs(ctx, v, enc(ctx.params[0]));
    if (!['requested', 'quoted'].includes(statusOf(ctx.db, r, ctx.now))) throw notNow(r, ctx);
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 200) throw invalid('reason', 'Say why (3 to 200 characters).');
    r.status = 'declined';
    r.declineReason = reason;
    touch(ctx, r);
    return requestWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/catering/requests/:code/advance/confirm', ctx => {
    const v = myVendor(ctx);
    const r = theirs(ctx, v, enc(ctx.params[0]));
    if (r.status !== 'accepted' || !['awaiting_transfer', 'proof_submitted'].includes(r.advanceStatus))
      throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no advance to confirm.', { status: r.advanceStatus });
    r.advanceStatus = 'paid';
    r.status = 'confirmed';
    touch(ctx, r);
    return requestWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('POST', '/food/vendor/catering/requests/:code/advance/reject', ctx => {
    const v = myVendor(ctx);
    const r = theirs(ctx, v, enc(ctx.params[0]));
    if (r.advanceStatus !== 'proof_submitted') throw new KitchenError(409, 'INVALID_TRANSITION', 'There is no receipt to reject.', { status: r.advanceStatus });
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 200) throw invalid('reason', 'Say why (3 to 200 characters).');
    r.advanceStatus = 'awaiting_transfer';
    r.advanceRejectedReason = reason;
    touch(ctx, r);
    return requestWire(ctx.db, r, 'vendor', ctx.now);
  });

  route('GET', '/food/vendor/catering/calendar', ctx => {
    const v = myVendor(ctx);
    const month = text(ctx.query.month) || todayOf(v, ctx.now).slice(0, 7);
    if (!MONTH.test(month)) throw invalid('month', 'month must be YYYY-MM');
    const events = k(ctx.db).catering.filter(r => r.businessId === v.businessId && r.date.startsWith(month) && ['accepted', 'confirmed', 'completed'].includes(statusOf(ctx.db, r, ctx.now)));
    const days = [...new Set(events.map(r => r.date))].sort();
    return {
      month,
      days: days.map(date => ({
        date,
        events: events
          .filter(r => r.date === date)
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(r => ({ code: r.code, time: r.time, guests: r.guests, eventType: r.eventType, status: statusOf(ctx.db, r, ctx.now), customerName: ctx.db.users.find(u => u.id === r.userId)?.name ?? 'Customer' })),
      })),
    };
  });
}
