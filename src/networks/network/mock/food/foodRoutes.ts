// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food routes (the vendor's own setup, riders)
// ═══════════════════════════════════════════════════════
// /food/cuisines, the vendor under /food/vendor, the rider under
// /food/rider, staff under /admin/food. Bodies, statuses, error codes and
// shapes are the API's (foodWire); the rules are foodLogic's. Writes are
// all-or-nothing, like the shop's and Health's.
// TODO(API_FOOD): mirrors the API's committed routes; reconcile with
// docs/API_FOOD.md when it is published.

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import {
  DAY,
  FoodError,
  HEX_COLOR,
  HOUR,
  MAX_ACTIVE_ACCOUNTS,
  MAX_BUSY_MS,
  MAX_FEE_BANDS,
  MAX_RANGES_PER_DAY,
  activeRiders,
  assertEntitled,
  assertWithinPlan,
  ensureVendor,
  invalid,
  isHhmm,
  isoNow,
  nextId,
  normalizeAccountNumber,
  notFound,
  onBrandColor,
  overlappingRanges,
  riderEmail,
  riderPassword,
  riderUsername,
  setupOf,
  text,
  toMinutes,
} from './foodLogic';
import {
  accountWire,
  closuresWire,
  cuisineWire,
  feeBandsWire,
  hoursWire,
  planWire,
  profileWire,
  riderMeWire,
  riderWire,
  settingsWire,
} from './foodWire';
import type { MockFoodVendor, MockRider, MockRiderVehicle } from './foodTypes';
import { registerMenuRoutes } from './foodMenuRoutes';
import { registerDiscoveryRoutes } from './foodDiscoveryRoutes';
import { orderAgain, registerOrderRoutes } from './foodOrderRoutes';
import { recordCod, registerRiderRoutes } from './foodRiderRoutes';
import { canReview, registerReviewRoutes, reviewSummary } from './foodReviewRoutes';
import { liveBanners, registerFoodAdminRoutes } from './foodAdminRoutes';
import { dealsFor, settleFoodOrders } from './foodOrders';
import { beginEmits, dropEmits, emitOrder, flushEmits, registerFoodRealtime } from './foodRealtime';
import { isValidPkMobile, isValidPkPhone, normalizePkPhone } from '../../../../utils/phone';

export interface FoodKit extends ShopKit {
  /** Ends every session of a user (a rider deactivated or given a new password). */
  revokeSessions: (db: MockDb, userId: string) => void;
}

const VEHICLES: MockRiderVehicle[] = ['bike', 'bicycle', 'car', 'on_foot'];
const VENDOR_RIDER_STATUSES = ['active', 'inactive', 'on_leave'] as const;
const ACCOUNT_KINDS = ['raast', 'jazzcash', 'easypaisa', 'bank'] as const;

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

export function registerFoodRoutes(kit: FoodKit) {
  const { requireUser, requirePartnerBusiness, requireAdmin, revokeSessions } = kit;

  // Writes are all-or-nothing: a request that fails part-way leaves the
  // dummy database as it was.
  // The API's minute jobs (declining unanswered orders, cancelling unpaid
  // transfers) run before every Food request instead, and say so live.
  const settle = (ctx: ShopCtx) => {
    beginEmits();
    for (const o of settleFoodOrders(ctx.db, ctx.now)) emitOrder(ctx.db, o, 'updated');
    flushEmits();
  };
  // Live events go out only when the write succeeds (after the commit, as the API's).
  const route: ShopKit['route'] = (method, pattern, handler) =>
    kit.route(method, pattern, ctx => {
      settle(ctx);
      beginEmits();
      if (method === 'GET') {
        try {
          return handler(ctx);
        } finally {
          flushEmits();
        }
      }
      const food = JSON.stringify(ctx.db.food);
      const users = JSON.stringify(ctx.db.users);
      try {
        const out = handler(ctx);
        flushEmits();
        return out;
      } catch (e) {
        dropEmits();
        ctx.db.food = JSON.parse(food);
        ctx.db.users = JSON.parse(users);
        throw e;
      }
    });
  const rawRoute: ShopKit['route'] = (method, pattern, handler) =>
    kit.route(method, pattern, ctx => {
      settle(ctx);
      beginEmits();
      try {
        return handler(ctx);
      } finally {
        flushEmits();
      }
    });
  registerFoodRealtime();

  /** The approved food partner's vendor row (403 for anyone else). */
  const myVendor = (ctx: ShopCtx): MockFoodVendor => {
    const { business } = requirePartnerBusiness(ctx);
    if (!business || business.serviceType !== 'food') {
      throw new FoodError(403, 'WRONG_SERVICE', 'Only Food Court vendors can do this.', { required: 'food', actual: business?.serviceType ?? null });
    }
    if (business.status !== 'approved') {
      throw new FoodError(403, 'BUSINESS_NOT_APPROVED', 'Your kitchen opens once MetroMatrix approves it.', { status: business.status });
    }
    return ensureVendor(ctx.db, business, ctx.now);
  };

  const myRider = (ctx: ShopCtx, v: MockFoodVendor, id: string): MockRider => {
    const r = ctx.db.food.riders.find(x => x.id === decodeURIComponent(id) && x.businessId === v.businessId);
    if (!r) throw notFound('Rider');
    return r;
  };

  const meRider = (ctx: ShopCtx) => {
    const user = requireUser(ctx);
    if (user.role !== 'rider') throw new FoodError(403, 'FORBIDDEN', 'Only riders can do this.');
    const r = ctx.db.food.riders.find(x => x.userId === user.id);
    if (!r || r.status !== 'active') {
      throw new FoodError(
        403,
        'RIDER_INACTIVE',
        r?.status === 'plan_locked'
          ? "Your vendor's plan has no free rider seat for you right now. Ask them to free one."
          : 'Your rider account is not active. Ask your vendor to reactivate it.',
        { status: r?.status ?? null },
      );
    }
    const b = ctx.db.businesses.find(x => x.id === r.businessId);
    if (!b || b.status !== 'approved') {
      throw new FoodError(403, b?.status === 'suspended' ? 'BUSINESS_SUSPENDED' : 'BUSINESS_NOT_APPROVED', 'Your vendor is not taking orders on MetroMatrix right now.');
    }
    return { rider: r, vendor: ensureVendor(ctx.db, b, ctx.now) };
  };

  // ── Reference ──
  route('GET', '/food/cuisines', ctx =>
    ctx.db.food.cuisines
      .filter(c => c.isActive)
      .sort((a, b) => a.sort - b.sort)
      .map(cuisineWire),
  );

  // ── Setup and going live ──
  route('GET', '/food/vendor/setup', ctx => setupOf(myVendor(ctx), ctx.db));

  route('POST', '/food/vendor/go-live', ctx => {
    const v = myVendor(ctx);
    if (v.status === 'suspended') throw new FoodError(403, 'FORBIDDEN', 'MetroMatrix has suspended this branch. Contact support.');
    if (v.status !== 'active') {
      const s = setupOf(v, ctx.db);
      if (s.missing.some(k => k !== 'food_safety')) {
        throw new FoodError(422, 'PROFILE_INCOMPLETE', 'Finish setting up before going live.', { missing: s.missing });
      }
      if (s.missing.includes('food_safety')) {
        throw new FoodError(422, 'FOOD_SAFETY_CHECK_REQUIRED', 'Home kitchens go live after MetroMatrix’s food-safety check. We will arrange a test order.');
      }
      v.status = 'active';
      v.wentLiveAt = isoNow(ctx.now);
    }
    return setupOf(v, ctx.db);
  });

  // ── Profile ──
  route('GET', '/food/vendor/profile', ctx => profileWire(ctx.db, myVendor(ctx), ctx.now));

  route('PATCH', '/food/vendor/profile', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    if (b.name !== undefined) {
      if (!between(text(b.name).length, 2, 120)) throw invalid('name', 'name must be 2 to 120 characters');
      v.name = text(b.name);
    }
    if (b.tagline !== undefined) {
      if (b.tagline !== null && text(b.tagline).length > 140) throw invalid('tagline', 'tagline must be at most 140 characters');
      v.tagline = b.tagline === null ? null : text(b.tagline) || null;
    }
    for (const key of ['logoUrl', 'coverUrl'] as const) {
      if (b[key] === undefined) continue;
      if (b[key] !== null && !/^https:\/\//.test(String(b[key]))) throw invalid(key, 'Upload the image first.');
      v[key] = b[key];
    }
    if (b.cuisineIds !== undefined) {
      const ids = [...new Set(Array.isArray(b.cuisineIds) ? b.cuisineIds.map(String) : [])];
      if (ids.length > 3) throw invalid('cuisineIds', 'cuisineIds must contain no more than 3 elements');
      if (!ids.every(id => ctx.db.food.cuisines.some(c => c.id === id && c.isActive))) throw invalid('cuisineIds', 'Pick cuisines from the list.');
      v.cuisineIds = ids;
    }
    if (b.priceLevel !== undefined) {
      if (!isInt(b.priceLevel) || !between(b.priceLevel, 1, 3)) throw invalid('priceLevel', 'priceLevel must be 1 to 3');
      v.priceLevel = b.priceLevel;
    }
    if (b.brandColor !== undefined) {
      if (!HEX_COLOR.test(String(b.brandColor))) throw invalid('brandColor', 'brandColor is #RRGGBB');
      const on = onBrandColor(String(b.brandColor));
      if (!on) throw invalid('brandColor', 'Text can’t be read on that colour. Pick a darker or lighter one.');
      v.brandColor = String(b.brandColor).toUpperCase();
      v.onBrandColor = on;
    }
    return profileWire(ctx.db, v, ctx.now);
  });

  route('POST', '/food/vendor/pause', ctx => {
    const v = myVendor(ctx);
    const message = text(ctx.body.message);
    if (message.length > 200) throw invalid('message', 'message must be at most 200 characters');
    v.isPaused = true;
    v.pauseMessage = message || null;
    return profileWire(ctx.db, v, ctx.now);
  });

  route('POST', '/food/vendor/resume', ctx => {
    const v = myVendor(ctx);
    v.isPaused = false;
    v.pauseMessage = null;
    return profileWire(ctx.db, v, ctx.now);
  });

  route('POST', '/food/vendor/busy', ctx => {
    const v = myVendor(ctx);
    const extra = ctx.body.extraMinutes;
    if (!isInt(extra) || !between(extra, 0, 60)) throw invalid('extraMinutes', 'extraMinutes must be 0 to 60');
    if (extra === 0) {
      v.busyUntil = null;
      v.busyExtraMinutes = 0;
    } else {
      const until = ctx.body.until ? Date.parse(String(ctx.body.until)) : ctx.now + HOUR;
      if (!Number.isFinite(until) || until <= ctx.now || until - ctx.now > MAX_BUSY_MS) throw invalid('until', 'Busy mode lasts up to 6 hours from now.');
      v.busyUntil = isoNow(until);
      v.busyExtraMinutes = extra;
    }
    return profileWire(ctx.db, v, ctx.now);
  });

  // ── Settings ──
  route('GET', '/food/vendor/settings', ctx => settingsWire(myVendor(ctx)));

  route('PATCH', '/food/vendor/settings', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    const delivery = b.acceptsDelivery ?? v.acceptsDelivery;
    const pickup = b.acceptsPickup ?? v.acceptsPickup;
    if (!delivery && !pickup) throw invalid('acceptsDelivery', 'Offer delivery, pickup or both.');
    if (b.preorderOnly && v.kind !== 'home_kitchen') throw invalid('preorderOnly', 'Pre-order only is for home kitchens.');
    if ((b.lat === undefined) !== (b.lng === undefined)) throw invalid('lat', 'Send lat and lng together.');
    const ints: [string, number, number][] = [
      ['codLimit', 0, 200000],
      ['autoRejectMinutes', 3, 10],
      ['prepMinutes', 5, 180],
    ];
    for (const [k, lo, hi] of ints) if (b[k] !== undefined && (!isInt(b[k]) || !between(b[k], lo, hi))) throw invalid(k, `${k} must be ${lo} to ${hi}`);
    if (b.maxRadiusKm !== undefined && (!isNum(b.maxRadiusKm) || !between(b.maxRadiusKm, 0.5, 50))) throw invalid('maxRadiusKm', 'maxRadiusKm must be 0.5 to 50');
    if (b.freeDeliveryOver !== undefined && b.freeDeliveryOver !== null && (!isInt(b.freeDeliveryOver) || !between(b.freeDeliveryOver, 0, 200000))) {
      throw invalid('freeDeliveryOver', 'freeDeliveryOver must be 0 to 200000');
    }
    const lengths: [string, number, number][] = [
      ['addressLine', 5, 255],
      ['area', 2, 80],
      ['city', 2, 60],
    ];
    for (const [k, lo, hi] of lengths) if (b[k] !== undefined && !between(text(b[k]).length, lo, hi)) throw invalid(k, `${k} must be ${lo} to ${hi} characters`);
    if (b.phone !== undefined && !isValidPkPhone(b.phone)) throw invalid('phone', 'Enter a Pakistani mobile or landline number.');
    if (b.lat !== undefined && (!isNum(b.lat) || !isNum(b.lng) || !between(b.lat, -90, 90) || !between(b.lng, -180, 180))) throw invalid('lat', 'Move the pin onto your kitchen.');
    for (const k of ['acceptsDelivery', 'acceptsPickup', 'acceptsCod', 'transferConfirmBeforePrep', 'preorderOnly'] as const) {
      if (typeof b[k] === 'boolean') v[k] = b[k];
    }
    for (const k of ['codLimit', 'autoRejectMinutes', 'prepMinutes', 'maxRadiusKm'] as const) if (b[k] !== undefined) v[k] = b[k];
    if (b.freeDeliveryOver !== undefined) v.freeDeliveryOver = b.freeDeliveryOver;
    for (const k of ['addressLine', 'area', 'city'] as const) if (b[k] !== undefined) v[k] = text(b[k]);
    if (b.phone !== undefined) v.phone = normalizePkPhone(b.phone) ?? null;
    if (b.lat !== undefined) {
      v.lat = b.lat;
      v.lng = b.lng;
    }
    return settingsWire(v);
  });

  // ── Hours ──
  route('GET', '/food/vendor/hours', ctx => hoursWire(myVendor(ctx)));

  route('PUT', '/food/vendor/hours', ctx => {
    const v = myVendor(ctx);
    const rows = Array.isArray(ctx.body) ? ctx.body : Array.isArray((ctx.body as any)?.ranges) ? (ctx.body as any).ranges : null;
    if (!rows) throw invalid('hours', 'Send the week as a list of ranges.');
    const ranges: { weekday: number; opensAt: string; closesAt: string }[] = rows.map((r: any, i: number) => {
      if (!isInt(r?.weekday) || !between(r.weekday, 0, 6)) throw invalid(`${i}.weekday`, 'weekday must be 0 to 6');
      if (!isHhmm(r.opensAt)) throw invalid(`${i}.opensAt`, 'opensAt is HH:MM');
      if (!isHhmm(r.closesAt)) throw invalid(`${i}.closesAt`, 'closesAt is HH:MM (or 24:00)');
      return { weekday: r.weekday as number, opensAt: String(r.opensAt), closesAt: String(r.closesAt) };
    });
    if (ranges.some(r => r.opensAt === r.closesAt)) throw invalid('hours', 'A range must open and close at different times.');
    for (let wd = 0; wd <= 6; wd++) {
      if (ranges.filter(r => r.weekday === wd).length > MAX_RANGES_PER_DAY) throw invalid('hours', `At most ${MAX_RANGES_PER_DAY} ranges a day.`);
    }
    const clash = overlappingRanges(ranges);
    if (clash) throw invalid('hours', 'Two of your ranges overlap.', { conflict: clash.map(c => ({ weekday: c.weekday, opens: c.opens, closes: c.closes })) });
    v.hours = ranges.sort((a, b) => a.weekday - b.weekday || toMinutes(a.opensAt) - toMinutes(b.opensAt));
    return hoursWire(v);
  });

  // ── Delivery zones ──
  route('GET', '/food/vendor/fee-bands', ctx => feeBandsWire(myVendor(ctx)));

  route('PUT', '/food/vendor/fee-bands', ctx => {
    const v = myVendor(ctx);
    const rows = Array.isArray(ctx.body) ? ctx.body : null;
    if (!rows) throw invalid('bands', 'Send the bands as a list.');
    const bands = rows.map((b: any, i: number) => {
      if (!isNum(b?.fromKm) || !between(b.fromKm, 0, 50)) throw invalid(`${i}.fromKm`, 'fromKm must be 0 to 50');
      if (!isNum(b.toKm) || !between(b.toKm, 0.1, 50)) throw invalid(`${i}.toKm`, 'toKm must be 0.1 to 50');
      if (!isInt(b.fee) || !between(b.fee, 0, 5000)) throw invalid(`${i}.fee`, 'fee must be 0 to 5000');
      if (!isInt(b.minOrder) || !between(b.minOrder, 0, 50000)) throw invalid(`${i}.minOrder`, 'minOrder must be 0 to 50000');
      return { fromKm: b.fromKm as number, toKm: b.toKm as number, fee: b.fee as number, minOrder: b.minOrder as number };
    });
    const sorted = [...bands].sort((a, b) => a.fromKm - b.fromKm);
    if (sorted.length > MAX_FEE_BANDS) throw invalid('bands', `At most ${MAX_FEE_BANDS} bands.`);
    sorted.forEach((b, i) => {
      if (b.toKm <= b.fromKm) throw invalid('bands', 'Each band must end after it starts.');
      if (i === 0 && b.fromKm !== 0) throw invalid('bands', 'The first band starts at 0 km.');
      if (i > 0 && b.fromKm !== sorted[i - 1].toKm) throw invalid('bands', 'Bands must follow on from each other with no gaps.');
    });
    v.feeBands = sorted;
    return feeBandsWire(v);
  });

  // ── Closures ──
  route('GET', '/food/vendor/closures', ctx => closuresWire(myVendor(ctx), ctx.now));

  route('POST', '/food/vendor/closures', ctx => {
    const v = myVendor(ctx);
    const startsAt = Date.parse(String(ctx.body.startsAt ?? ''));
    const endsAt = Date.parse(String(ctx.body.endsAt ?? ''));
    if (!Number.isFinite(startsAt)) throw invalid('startsAt', 'startsAt must be a date');
    if (!Number.isFinite(endsAt)) throw invalid('endsAt', 'endsAt must be a date');
    if (endsAt <= startsAt) throw invalid('endsAt', 'A closure must end after it starts.');
    if (endsAt <= ctx.now) throw invalid('endsAt', 'That closure is already over.');
    if (endsAt - startsAt > 60 * DAY) throw invalid('endsAt', 'Closures are at most 60 days.');
    const reason = text(ctx.body.reason);
    if (reason.length > 200) throw invalid('reason', 'reason must be at most 200 characters');
    const c = { id: nextId(ctx.db, 'cl'), startsAt: isoNow(startsAt), endsAt: isoNow(endsAt), reason: reason || null };
    v.closures.push(c);
    ctx.setStatus(201);
    return { ...c };
  });

  route('DELETE', '/food/vendor/closures/:id', ctx => {
    const v = myVendor(ctx);
    const before = v.closures.length;
    v.closures = v.closures.filter(c => c.id !== decodeURIComponent(ctx.params[0]));
    if (v.closures.length === before) throw notFound('Closure');
    return { removed: true };
  });

  // ── Payment accounts ──
  route('GET', '/food/vendor/payment-accounts', ctx =>
    [...myVendor(ctx).accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(accountWire),
  );

  route('POST', '/food/vendor/payment-accounts', ctx => {
    const v = myVendor(ctx);
    const b = ctx.body;
    if (!(ACCOUNT_KINDS as readonly string[]).includes(b.kind)) throw invalid('kind', 'kind must be one of raast, jazzcash, easypaisa, bank');
    if (!between(text(b.accountTitle).length, 2, 80)) throw invalid('accountTitle', 'accountTitle must be 2 to 80 characters');
    const norm = normalizeAccountNumber(b.kind, String(b.accountNumber ?? ''));
    if (!norm.ok) throw invalid('accountNumber', norm.reason);
    if (b.kind === 'bank' && !text(b.bankName)) throw invalid('bankName', 'Bank accounts need the bank name.');
    const isActive = b.isActive !== false;
    if (isActive && v.accounts.filter(a => a.isActive).length >= MAX_ACTIVE_ACCOUNTS) {
      throw invalid('isActive', `You can have at most ${MAX_ACTIVE_ACCOUNTS} active accounts.`);
    }
    if (v.accounts.some(a => a.accountNumber === norm.value)) throw new FoodError(409, 'CONFLICT', 'You already added this account.');
    const a = {
      id: nextId(ctx.db, 'va'),
      kind: b.kind,
      accountTitle: text(b.accountTitle),
      accountNumber: norm.value,
      bankName: text(b.bankName) || null,
      isActive,
      createdAt: isoNow(ctx.now),
    };
    v.accounts.push(a);
    ctx.setStatus(201);
    return accountWire(a);
  });

  route('PATCH', '/food/vendor/payment-accounts/:id', ctx => {
    const v = myVendor(ctx);
    const a = v.accounts.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!a) throw notFound('Payment account');
    const b = ctx.body;
    if (b.accountTitle !== undefined && !between(text(b.accountTitle).length, 2, 80)) throw invalid('accountTitle', 'accountTitle must be 2 to 80 characters');
    if (b.bankName !== undefined && !between(text(b.bankName).length, 2, 80)) throw invalid('bankName', 'bankName must be 2 to 80 characters');
    if (b.isActive === true && !a.isActive && v.accounts.filter(x => x.isActive).length >= MAX_ACTIVE_ACCOUNTS) {
      throw invalid('isActive', `You can have at most ${MAX_ACTIVE_ACCOUNTS} active accounts.`);
    }
    if (b.accountTitle !== undefined) a.accountTitle = text(b.accountTitle);
    if (b.bankName !== undefined) a.bankName = text(b.bankName);
    if (typeof b.isActive === 'boolean') a.isActive = b.isActive;
    return accountWire(a);
  });

  route('DELETE', '/food/vendor/payment-accounts/:id', ctx => {
    const v = myVendor(ctx);
    const before = v.accounts.length;
    v.accounts = v.accounts.filter(a => a.id !== decodeURIComponent(ctx.params[0]));
    if (v.accounts.length === before) throw notFound('Payment account');
    return { removed: true };
  });

  // ── Plan ──
  route('GET', '/food/vendor/plan', ctx => planWire(ctx.db, myVendor(ctx)));

  // ── Riders (the vendor's own) ──
  route('GET', '/food/vendor/riders', ctx => {
    const v = myVendor(ctx);
    return ctx.db.food.riders
      .filter(r => r.businessId === v.businessId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map(r => riderWire(ctx.db, r, ctx.now));
  });

  const riderFields = (b: Record<string, any>, creating: boolean) => {
    if (creating || b.fullName !== undefined) {
      if (!between(text(b.fullName).length, 2, 80)) throw invalid('fullName', 'fullName must be 2 to 80 characters');
    }
    if (b.phone !== undefined && b.phone !== null && !isValidPkMobile(b.phone)) throw invalid('phone', 'Enter a Pakistani mobile number.');
    if (b.vehicle !== undefined && !VEHICLES.includes(b.vehicle)) throw invalid('vehicle', `vehicle must be one of ${VEHICLES.join(', ')}`);
  };

  route('POST', '/food/vendor/riders', ctx => {
    const v = myVendor(ctx);
    riderFields(ctx.body, true);
    assertEntitled(v, 'riders');
    assertWithinPlan(v, 'riders', activeRiders(ctx.db, v.businessId) + 1);
    const fullName = text(ctx.body.fullName);
    const username = riderUsername(ctx.db, v.slug, fullName);
    const password = riderPassword();
    const now = isoNow(ctx.now);
    const user: MockUser = {
      id: nextId(ctx.db, 'u'),
      email: riderEmail(username),
      username,
      name: fullName,
      phone: normalizePkPhone(ctx.body.phone) ?? null,
      role: 'rider',
      avatarUrl: null,
      isEmailVerified: true,
      hasPassword: true,
      providers: ['password'],
      createdAt: now,
      profileComplete: true,
      dateOfBirth: null,
      gender: null,
      streetAddress: null,
      city: null,
      postalCode: null,
      providerServiceType: null,
      providerSubType: null,
      password,
      verificationSentAt: 0,
      totpEnrolled: false,
      recoveryCodes: [],
    };
    ctx.db.users.push(user);
    const rider: MockRider = {
      id: nextId(ctx.db, 'rd'),
      userId: user.id,
      businessId: v.businessId,
      fullName,
      phone: normalizePkPhone(ctx.body.phone) ?? null,
      vehicle: ctx.body.vehicle ?? 'bike',
      status: 'active',
      onDuty: false,
      activeOrderCount: 0,
      lastGeo: null,
      locationUpdatedAt: null,
      createdAt: now,
    };
    ctx.db.food.riders.push(rider);
    ctx.setStatus(201);
    // Shown once. The dummy API, like the real one, never shows it again.
    return { rider: riderWire(ctx.db, rider, ctx.now), credential: { username, password } };
  });

  // Riders on orders (before /riders/:id, which would take /riders/suggest).
  registerRiderRoutes({ route, myVendor, meRider });

  route('GET', '/food/vendor/riders/:id', ctx => riderWire(ctx.db, myRider(ctx, myVendor(ctx), ctx.params[0]), ctx.now));

  route('PATCH', '/food/vendor/riders/:id', ctx => {
    const v = myVendor(ctx);
    const r = myRider(ctx, v, ctx.params[0]);
    riderFields(ctx.body, false);
    if (ctx.body.fullName !== undefined) {
      r.fullName = text(ctx.body.fullName);
      const u = ctx.db.users.find(x => x.id === r.userId);
      if (u) u.name = r.fullName;
    }
    if (ctx.body.phone !== undefined) r.phone = normalizePkPhone(ctx.body.phone) ?? null;
    if (ctx.body.vehicle !== undefined) r.vehicle = ctx.body.vehicle;
    return riderWire(ctx.db, r, ctx.now);
  });

  route('PATCH', '/food/vendor/riders/:id/status', ctx => {
    const v = myVendor(ctx);
    const r = myRider(ctx, v, ctx.params[0]);
    const status = ctx.body.status;
    if (!(VENDOR_RIDER_STATUSES as readonly string[]).includes(status)) throw invalid('status', 'status must be one of active, inactive, on_leave');
    if (status !== r.status) {
      if (status === 'active') assertWithinPlan(v, 'riders', activeRiders(ctx.db, v.businessId, r.id) + 1);
      else if (r.activeOrderCount > 0) {
        throw new FoodError(409, 'INVALID_TRANSITION', 'This rider is on a delivery. Reassign or finish it first.', {
          from: r.status,
          to: status,
          activeOrders: r.activeOrderCount,
        });
      }
      r.status = status;
      if (status !== 'active') {
        r.onDuty = false;
        revokeSessions(ctx.db, r.userId);
      }
    }
    return riderWire(ctx.db, r, ctx.now);
  });

  route('POST', '/food/vendor/riders/:id/reset-password', ctx => {
    const v = myVendor(ctx);
    const r = myRider(ctx, v, ctx.params[0]);
    const u = ctx.db.users.find(x => x.id === r.userId);
    if (!u) throw notFound('Rider');
    u.password = riderPassword();
    revokeSessions(ctx.db, u.id);
    return { username: u.username, password: u.password };
  });

  route('GET', '/food/vendor/riders/:id/credential', ctx => {
    const r = myRider(ctx, myVendor(ctx), ctx.params[0]);
    return {
      username: ctx.db.users.find(u => u.id === r.userId)?.username ?? null,
      passwordAvailable: false,
      hint: 'Passwords are shown once. Reset it to issue a new one.',
    };
  });

  // ── The rider's own view ──
  /** An active rider of an approved vendor (403 RIDER_INACTIVE / BUSINESS_SUSPENDED otherwise). */

  route('GET', '/food/rider/me', ctx => {
    const { rider, vendor } = meRider(ctx);
    return riderMeWire(ctx.db, rider, vendor, ctx.now);
  });

  // ── The menu ──
  registerMenuRoutes(route, myVendor);

  // ── Discovery (customers, signed in or not) ──
  registerDiscoveryRoutes(route, kit.optionalUser, { dealsFor, orderAgain, banners: liveBanners, ratingSummary: reviewSummary });

  // ── The bag, checkout, orders, the board, deals ──
  registerOrderRoutes({ route, rawRoute, requireUser, myVendor, canReview: (db, o) => canReview(db, o), onDelivered: (db, o, _actor, now) => recordCod(db, o, now) });

  // ── Reviews and insights ──
  registerReviewRoutes({ route, requireUser, myVendor });

  // ── Staff ──
  registerFoodAdminRoutes({ route, requireAdmin, revokeSessions });
  route('POST', '/admin/food/branches/:id/food-safety-check', ctx => {
    requireAdmin(ctx);
    const v = ctx.db.food.vendors.find(x => x.branchId === decodeURIComponent(ctx.params[0]));
    if (!v) throw notFound('Branch');
    const outcome = ctx.body.outcome;
    if (outcome !== 'passed' && outcome !== 'failed') throw invalid('outcome', 'outcome must be one of passed, failed');
    if (!between(text(ctx.body.note).length, 3, 1000)) throw invalid('note', 'note must be 3 to 1000 characters');
    v.foodSafetyCheckedAt = outcome === 'passed' ? isoNow(ctx.now) : null;
    return { branchId: v.branchId, outcome, foodSafetyCheckedAt: v.foodSafetyCheckedAt, setup: setupOf(v, ctx.db) };
  });
}
