// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food staff console (/admin/food)
// ═══════════════════════════════════════════════════════
// The overview, vendors (feature, suspend and reinstate — the business
// suspension — and the plan), orders for disputes (read-only), review
// moderation, cuisines and the Food home's banners (and the live set the
// home shows). Staff only.
// TODO(API_FOOD): mirrors the API's committed admin-food, admin-food-plan
// and food-banners services.

import type { MockDb } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { COMMUNITY_PLAN, FoodError, invalid, isoNow, nextId, planOf, setupOf, text } from './foodLogic';
import { isVisible } from './foodDiscovery';
import { ACTIVE_STATUSES, boardView, orderView } from './foodOrders';
import { feeBandsWire, hoursWire, planWire, profileWire, settingsWire } from './foodWire';
import { recomputeRating, reviewSummary, reviewView } from './foodReviewRoutes';
import type { MockFoodBanner, MockFoodVendor, MockPlanEntitlementKey, MockPlanLimitKey, MockPlanOverrides } from './foodTypes';
import { dateInZone } from '../../../../utils/healthTime';

const PKT = 'Asia/Karachi';
const SUB_TYPE_LABEL: Record<string, string> = { restaurant: 'Restaurant', cloud_kitchen: 'Cloud kitchen', home_kitchen: 'Home kitchen' };
const SLUG = /^[a-z0-9-]{2,40}$/;
const isIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

const paged = <T>(rows: T[], q: Record<string, any>) => {
  const p = Math.max(1, Number(q.page) || 1);
  const size = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  return { items: rows.slice((p - 1) * size, p * size), total: rows.length, page: p, pageSize: size };
};

const businessOf = (db: MockDb, v: MockFoodVendor) => db.businesses.find(b => b.id === v.businessId)!;

/** What a banner opens, if it still exists. */
const targetOf = (db: MockDb, b: Pick<MockFoodBanner, 'targetType' | 'targetId' | 'targetQuery'>) => {
  if (b.targetType === 'search') return { type: 'search', query: b.targetQuery };
  if (b.targetType === 'cuisine') {
    const c = db.food.cuisines.find(x => x.id === b.targetId && x.isActive);
    return c ? { type: 'cuisine', id: c.id, slug: c.slug, name: c.name } : null;
  }
  const v = db.food.vendors.find(x => x.brandId === b.targetId && isVisible(db, x));
  return v ? { type: 'vendor', id: v.brandId, slug: v.slug, name: v.name } : null;
};

export const bannerView = (b: MockFoodBanner) => ({
  id: b.id,
  imageUrl: b.imageUrl,
  title: b.title,
  subtitle: b.subtitle,
  targetType: b.targetType,
  targetId: b.targetId,
  targetQuery: b.targetQuery,
  city: b.city,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  sort: b.sort,
  isActive: b.isActive,
});

/** The banners the Food home shows now: between their dates, for the city or everywhere, whose target is still there. */
export const liveBanners = (db: MockDb, city: string | null, now: number) =>
  db.food.banners
    .filter(b => b.isActive && Date.parse(b.startsAt) <= now && (!b.endsAt || Date.parse(b.endsAt) > now) && (!b.city || b.city.toLowerCase() === (city ?? '').toLowerCase()))
    .sort((a, b) => a.sort - b.sort || b.createdAt.localeCompare(a.createdAt))
    .map(b => ({ banner: b, target: targetOf(db, b) }))
    .filter(x => x.target)
    .map(x => ({ ...bannerView(x.banner), target: x.target }));

/**
 * Riders follow the plan's seat count: beyond a lowered limit they become
 * plan_locked (signed out, off duty); when it goes back up, locked riders
 * come back first. Riders mid-delivery keep their seat, then the longest
 * serving. The vendor's own inactive / on-leave riders are never touched.
 */
export const reconcileRiderSeats = (db: MockDb, v: MockFoodVendor, revokeSessions: (db: MockDb, userId: string) => void) => {
  const seats = Math.max(0, planOf(v).limits.riders);
  const ranked = db.food.riders
    .filter(r => r.businessId === v.businessId && (r.status === 'active' || r.status === 'plan_locked'))
    .sort((a, b) => Number(b.activeOrderCount > 0) - Number(a.activeOrderCount > 0) || a.createdAt.localeCompare(b.createdAt) || a.userId.localeCompare(b.userId));
  ranked.forEach((r, i) => {
    if (i < seats && r.status === 'plan_locked') r.status = 'active';
    if (i >= seats && r.status === 'active') {
      r.status = 'plan_locked';
      r.onDuty = false;
      revokeSessions(db, r.userId);
    }
  });
};

const LIMIT_MAX: Record<MockPlanLimitKey, number> = { brands: 1, branches: 1, riders: 500, menu_items: 10000, promotions_active: 100 };

export interface AdminRouteDeps {
  route: ShopKit['route'];
  requireAdmin: ShopKit['requireAdmin'];
  revokeSessions: (db: MockDb, userId: string) => void;
}

export function registerFoodAdminRoutes({ route, requireAdmin, revokeSessions }: AdminRouteDeps) {
  const vendorById = (ctx: ShopCtx) => {
    const v = ctx.db.food.vendors.find(x => x.brandId === decodeURIComponent(ctx.params[0]));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'Vendor not found.');
    return v;
  };
  const admin = (ctx: ShopCtx) => requireAdmin(ctx);

  route('GET', '/admin/food/overview', ctx => {
    admin(ctx);
    const db = ctx.db;
    const today = dateInZone(isoNow(ctx.now), PKT);
    const live = db.food.vendors.filter(v => isVisible(db, v));
    const by = (t: string) => live.filter(v => v.kind === t).length;
    const todays = db.food.orders.filter(o => dateInZone(o.placedAt, PKT) === today);
    const accepted = todays.filter(o => o.acceptedAt).length;
    const answered = todays.filter(o => o.acceptedAt || o.status === 'rejected' || o.status === 'auto_rejected').length;
    const weekAgo = ctx.now - 7 * 86_400_000;
    const cuisineOrders = new Map<string, number>();
    for (const o of db.food.orders.filter(x => Date.parse(x.placedAt) > weekAgo)) {
      const v = db.food.vendors.find(x => x.businessId === o.businessId);
      for (const id of v?.cuisineIds ?? []) cuisineOrders.set(id, (cuisineOrders.get(id) ?? 0) + 1);
    }
    const foodBusinesses = db.businesses.filter(b => b.serviceType === 'food');
    return {
      date: today,
      activeVendors: { restaurant: by('restaurant'), cloud_kitchen: by('cloud_kitchen'), home_kitchen: by('home_kitchen'), total: live.length },
      ordersToday: todays.length,
      activeOrders: todays.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
      acceptanceRateToday: answered ? Math.round((accepted / answered) * 1000) / 1000 : null,
      autoRejectsToday: todays.filter(o => o.status === 'auto_rejected').length,
      topCuisines: [...cuisineOrders]
        .map(([id, orders]) => ({ c: db.food.cuisines.find(x => x.id === id), orders }))
        .filter(x => x.c)
        .sort((a, b) => b.orders - a.orders || a.c!.name.localeCompare(b.c!.name))
        .slice(0, 5)
        .map(x => ({ slug: x.c!.slug, name: x.c!.name, orders: x.orders })),
      waiting: {
        approvals: foodBusinesses.filter(b => b.status === 'pending_approval').length,
        foodSafetyChecks: foodBusinesses.filter(b => b.status === 'approved' && b.subType === 'home_kitchen' && !db.food.vendors.find(v => v.businessId === b.id)?.foodSafetyCheckedAt).length,
      },
    };
  });

  route('GET', '/admin/food/vendors', ctx => {
    admin(ctx);
    const db = ctx.db;
    const q = ctx.query;
    if (q.type !== undefined && !SUB_TYPE_LABEL[q.type]) throw invalid('type', 'type must be one of the following values: restaurant, cloud_kitchen, home_kitchen');
    if (q.status !== undefined && !['live', 'draft', 'paused', 'suspended'].includes(q.status)) throw invalid('status', 'status must be one of the following values: live, draft, paused, suspended');
    const needle = String(q.q ?? '').trim().toLowerCase();
    const rows = db.food.vendors
      .map(v => ({ v, b: businessOf(db, v) }))
      .filter(({ b }) => !!b && b.serviceType === 'food')
      .filter(({ v }) => !q.type || v.kind === q.type)
      .filter(({ v, b }) =>
        q.status === 'live'
          ? b.status === 'approved' && v.status === 'active' && !v.isPaused
          : q.status === 'draft'
            ? b.status === 'approved' && v.status === 'draft'
            : q.status === 'paused'
              ? b.status === 'approved' && v.isPaused
              : q.status === 'suspended'
                ? b.status === 'suspended'
                : true,
      )
      .filter(({ v }) => !q.city || (v.city ?? '').toLowerCase() === String(q.city).toLowerCase())
      .filter(({ v, b }) => {
        if (!needle) return true;
        const email = db.users.find(u => u.id === b.ownerId)?.email ?? '';
        return [v.name, v.slug, email].some(x => x.toLowerCase().includes(needle));
      })
      .map(({ v, b }) => ({
        id: v.brandId,
        businessId: v.businessId,
        name: v.name,
        slug: v.slug,
        subType: v.kind,
        subTypeLabel: SUB_TYPE_LABEL[v.kind] ?? v.kind,
        city: v.city,
        businessStatus: b.status,
        branchStatus: v.status,
        isPaused: v.isPaused,
        isFeatured: !!v.isFeatured,
        ratingAvg: v.ratingAvg,
        ratingCount: v.ratingCount,
        orders30d: db.food.orders.filter(o => o.businessId === v.businessId && ctx.now - Date.parse(o.placedAt) < 30 * 86_400_000).length,
        wentLiveAt: v.wentLiveAt,
        foodSafetyCheckedAt: v.foodSafetyCheckedAt,
        ownerEmail: db.users.find(u => u.id === b.ownerId)?.email ?? null,
        planKey: 'community',
      }));
    return paged(rows, q);
  });

  route('GET', '/admin/food/vendors/:id', ctx => {
    admin(ctx);
    const db = ctx.db;
    const v = vendorById(ctx);
    const b = businessOf(db, v);
    return {
      id: v.brandId,
      businessId: v.businessId,
      subType: v.kind,
      subTypeLabel: SUB_TYPE_LABEL[v.kind] ?? v.kind,
      businessStatus: b.status,
      suspensionReason: b.suspensionReason ?? null,
      ownerEmail: db.users.find(u => u.id === b.ownerId)?.email ?? null,
      profile: profileWire(db, v, ctx.now),
      settings: settingsWire(v),
      hours: hoursWire(v),
      feeBands: feeBandsWire(v),
      setup: setupOf(v, db),
      plan: planWire(db, v),
      menu: db.food.categories
        .filter(c => c.businessId === v.businessId)
        .sort((a, c) => a.sort - c.sort || a.name.localeCompare(c.name))
        .map(c => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
          items: db.food.items
            .filter(i => i.categoryId === c.id)
            .sort((a, c2) => a.sort - c2.sort || a.name.localeCompare(c2.name))
            .map(i => ({ id: i.id, name: i.name, basePrice: i.basePrice, isActive: i.isActive })),
        })),
      recentOrders: db.food.orders
        .filter(o => o.businessId === v.businessId)
        .sort((a, c) => c.placedAt.localeCompare(a.placedAt))
        .slice(0, 10)
        .map(o => boardView(db, o)),
      ratings: reviewSummary(db, v),
      complaints: db.food.reviews
        .filter(r => r.businessId === v.businessId && r.foodRating <= 2)
        .sort((a, c) => c.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map(r => ({
          ...reviewView(r, db.users.find(u => u.id === r.userId)?.name ?? 'Customer'),
          vendorId: v.brandId,
          orderCode: r.orderId ? (db.food.orders.find(o => o.id === r.orderId)?.code ?? null) : null,
          isHidden: r.isHidden,
          hiddenReason: r.hiddenReason,
        })),
    };
  });

  for (const [path, featured] of [
    ['feature', true],
    ['unfeature', false],
  ] as const) {
    route('POST', `/admin/food/vendors/:id/${path}`, ctx => {
      admin(ctx);
      const v = vendorById(ctx);
      v.isFeatured = featured;
      ctx.setStatus(200);
      return { id: v.brandId, isFeatured: featured };
    });
  }

  const reasonOf = (ctx: ShopCtx) => {
    const reason = text(ctx.body.reason);
    if (reason.length < 3 || reason.length > 500) throw invalid('reason', 'reason must be longer than or equal to 3 characters');
    return reason;
  };

  route('POST', '/admin/food/vendors/:id/suspend', ctx => {
    admin(ctx);
    const v = vendorById(ctx);
    const reason = reasonOf(ctx);
    const b = businessOf(ctx.db, v);
    if (b.status !== 'approved') throw new FoodError(409, 'INVALID_TRANSITION', 'Only an approved business can be suspended.', { from: b.status, to: 'suspended', allowed: [] });
    b.status = 'suspended';
    b.suspensionReason = reason;
    ctx.setStatus(200);
    return { id: v.brandId, businessStatus: b.status, suspensionReason: b.suspensionReason };
  });

  route('POST', '/admin/food/vendors/:id/reinstate', ctx => {
    admin(ctx);
    const v = vendorById(ctx);
    reasonOf(ctx);
    const b = businessOf(ctx.db, v);
    if (b.status !== 'suspended') throw new FoodError(409, 'INVALID_TRANSITION', 'Only a suspended business can be reinstated.', { from: b.status, to: 'approved', allowed: [] });
    b.status = 'approved';
    b.suspensionReason = null;
    ctx.setStatus(200);
    return { id: v.brandId, businessStatus: b.status, suspensionReason: null };
  });

  route('GET', '/admin/food/vendors/:id/plan', ctx => {
    admin(ctx);
    return planWire(ctx.db, vendorById(ctx));
  });

  // { planKey?, overrides?: { limits?, entitlements? } | null }: takes effect at once.
  route('PATCH', '/admin/food/vendors/:id/plan', ctx => {
    admin(ctx);
    const v = vendorById(ctx);
    const b = ctx.body;
    if (b.planKey !== undefined && b.planKey !== COMMUNITY_PLAN.planKey) throw invalid('planKey', 'planKey must be one of the following values: community');
    if (b.overrides !== undefined) {
      if (b.overrides === null) v.planOverrides = null;
      else {
        if (typeof b.overrides !== 'object' || Array.isArray(b.overrides)) throw invalid('overrides', 'overrides must be an object');
        const next: MockPlanOverrides = {};
        const limits = b.overrides.limits;
        if (limits !== undefined) {
          next.limits = {};
          for (const [k, n] of Object.entries(limits ?? {})) {
            const max = LIMIT_MAX[k as MockPlanLimitKey];
            if (max === undefined) throw invalid(`overrides.limits.${k}`, `property ${k} should not exist`);
            if (!(Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max)) throw invalid(`overrides.limits.${k}`, `${k} must not be greater than ${max}`);
            next.limits[k as MockPlanLimitKey] = n as number;
          }
        }
        const ents = b.overrides.entitlements;
        if (ents !== undefined) {
          next.entitlements = {};
          for (const [k, x] of Object.entries(ents ?? {})) {
            if (!(k in COMMUNITY_PLAN.entitlements)) throw invalid(`overrides.entitlements.${k}`, `property ${k} should not exist`);
            if (typeof x !== 'boolean') throw invalid(`overrides.entitlements.${k}`, `${k} must be a boolean value`);
            next.entitlements[k as MockPlanEntitlementKey] = x;
          }
        }
        v.planOverrides = next;
      }
      reconcileRiderSeats(ctx.db, v, revokeSessions);
    }
    return planWire(ctx.db, v);
  });

  // ── Orders (read-only) ──
  route('GET', '/admin/food/orders', ctx => {
    admin(ctx);
    const db = ctx.db;
    const q = ctx.query;
    const code = q.code ? String(q.code).trim().toUpperCase() : null;
    const rows = db.food.orders
      .filter(o => !code || o.code === code)
      .filter(o => !q.vendorId || db.food.vendors.find(v => v.businessId === o.businessId)?.brandId === q.vendorId)
      .filter(o => !q.status || o.status === q.status)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt) || a.id.localeCompare(b.id))
      .map(o => ({ ...boardView(db, o), vendorId: db.food.vendors.find(v => v.businessId === o.businessId)?.brandId ?? null }));
    return paged(rows, q);
  });

  route('GET', '/admin/food/orders/:id', ctx => {
    admin(ctx);
    const o = ctx.db.food.orders.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    const u = ctx.db.users.find(x => x.id === o.userId);
    return { ...orderView(ctx.db, o, 'admin', ctx.now), customer: { userId: o.userId, name: u?.name ?? null, email: u?.email, phone: u?.phone } };
  });

  // ── Reviews ──
  route('GET', '/admin/food/reviews', ctx => {
    admin(ctx);
    const db = ctx.db;
    const q = ctx.query;
    const max = q.maxRating ? Number(q.maxRating) : null;
    const rows = db.food.reviews
      .filter(r => !q.vendorId || db.food.vendors.find(v => v.businessId === r.businessId)?.brandId === q.vendorId)
      .filter(r => (q.hidden === 'true' ? r.isHidden : q.hidden === 'false' ? !r.isHidden : true))
      .filter(r => max === null || r.foodRating <= max)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(r => ({
        ...reviewView(r, db.users.find(u => u.id === r.userId)?.name ?? 'Customer'),
        vendorId: db.food.vendors.find(v => v.businessId === r.businessId)?.brandId ?? null,
        orderCode: r.orderId ? (db.food.orders.find(o => o.id === r.orderId)?.code ?? null) : null,
        isHidden: r.isHidden,
        hiddenReason: r.hiddenReason,
      }));
    return paged(rows, q);
  });

  const setHidden = (ctx: ShopCtx, hidden: boolean) => {
    admin(ctx);
    const r = ctx.db.food.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!r) throw new FoodError(404, 'NOT_FOUND', 'Review not found.');
    if (hidden) {
      const reason = text(ctx.body.reason);
      if (reason.length < 3 || reason.length > 300) throw invalid('reason', 'reason must be longer than or equal to 3 characters');
      r.hiddenReason = reason;
    } else r.hiddenReason = null;
    r.isHidden = hidden;
    const v = ctx.db.food.vendors.find(x => x.businessId === r.businessId);
    if (v) recomputeRating(ctx.db, v);
    ctx.setStatus(200);
    return { id: r.id, isHidden: r.isHidden, hiddenReason: r.hiddenReason };
  };
  route('POST', '/admin/food/reviews/:id/hide', ctx => setHidden(ctx, true));
  route('POST', '/admin/food/reviews/:id/unhide', ctx => setHidden(ctx, false));

  // ── Cuisines ──
  const cuisineRow = (db: MockDb, c: MockDb['food']['cuisines'][number]) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    sort: c.sort,
    isActive: c.isActive,
    vendors: db.food.vendors.filter(v => v.cuisineIds.includes(c.id)).length,
  });

  route('GET', '/admin/food/cuisines', ctx => {
    admin(ctx);
    return [...ctx.db.food.cuisines].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map(c => cuisineRow(ctx.db, c));
  });

  const cuisineFields = (b: Record<string, any>, partial: boolean) => {
    const out: Partial<MockDb['food']['cuisines'][number]> = {};
    if (!partial || b.name !== undefined) {
      const name = text(b.name);
      if (name.length < 2 || name.length > 60) throw invalid('name', 'name must be longer than or equal to 2 characters');
      out.name = name;
    }
    if (!partial || b.slug !== undefined) {
      if (typeof b.slug !== 'string' || !SLUG.test(b.slug)) throw invalid('slug', 'slug is 2–40 lowercase letters, digits or dashes');
      out.slug = b.slug;
    }
    if (b.icon !== undefined) {
      if (typeof b.icon !== 'string' || b.icon.length > 40) throw invalid('icon', 'icon must be shorter than or equal to 40 characters');
      out.icon = b.icon;
    }
    if (b.sort !== undefined) {
      if (!(Number.isInteger(b.sort) && b.sort >= 0 && b.sort <= 999)) throw invalid('sort', 'sort must not be greater than 999');
      out.sort = b.sort;
    }
    if (partial && b.isActive !== undefined) {
      if (typeof b.isActive !== 'boolean') throw invalid('isActive', 'isActive must be a boolean value');
      out.isActive = b.isActive;
    }
    return out;
  };

  route('POST', '/admin/food/cuisines', ctx => {
    admin(ctx);
    const f = cuisineFields(ctx.body, false);
    if (ctx.db.food.cuisines.some(c => c.slug === f.slug)) throw new FoodError(409, 'CONFLICT', `A cuisine with the slug ${f.slug} exists.`, { field: 'slug' });
    const c = { id: nextId(ctx.db, 'cu'), slug: f.slug!, name: f.name!, icon: f.icon ?? f.slug!, sort: f.sort ?? 0, isActive: true };
    ctx.db.food.cuisines.push(c);
    ctx.setStatus(201);
    return { ...c, createdAt: isoNow(ctx.now), updatedAt: isoNow(ctx.now) };
  });

  route('PATCH', '/admin/food/cuisines/:id', ctx => {
    admin(ctx);
    const c = ctx.db.food.cuisines.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw new FoodError(404, 'NOT_FOUND', 'Cuisine not found.');
    const f = cuisineFields(ctx.body, true);
    if (f.slug && f.slug !== c.slug && ctx.db.food.cuisines.some(x => x.slug === f.slug)) throw new FoodError(409, 'CONFLICT', `A cuisine with the slug ${f.slug} exists.`, { field: 'slug' });
    Object.assign(c, f);
    return { ...c, createdAt: isoNow(ctx.now), updatedAt: isoNow(ctx.now) };
  });

  route('DELETE', '/admin/food/cuisines/:id', ctx => {
    admin(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    const n = ctx.db.food.vendors.filter(v => v.cuisineIds.includes(id)).length;
    if (n > 0) throw new FoodError(409, 'CONFLICT', `${n} vendor${n === 1 ? ' uses' : 's use'} this cuisine — deactivate it instead.`, { vendors: n });
    if (!ctx.db.food.cuisines.some(c => c.id === id)) throw new FoodError(404, 'NOT_FOUND', 'Cuisine not found.');
    ctx.db.food.cuisines = ctx.db.food.cuisines.filter(c => c.id !== id);
    return { deleted: true };
  });

  // ── Banners ──
  route('GET', '/admin/food/banners', ctx => {
    admin(ctx);
    return [...ctx.db.food.banners].sort((a, b) => a.sort - b.sort || b.createdAt.localeCompare(a.createdAt)).map(bannerView);
  });

  const bannerFields = (b: Record<string, any>, partial: boolean) => {
    const out: Partial<MockFoodBanner> = {};
    if (!partial || b.imageUrl !== undefined) {
      // The API takes only this staff member's own `banner` uploads; the dummy API takes any uploaded file (its uploads stay local).
      if (typeof b.imageUrl !== 'string' || !/^(https?:|blob:|file:|data:image\/)/.test(b.imageUrl)) throw invalid('imageUrl', 'Files must be uploaded through the app.');
      out.imageUrl = b.imageUrl;
    }
    if (!partial || b.title !== undefined) {
      const t = text(b.title);
      if (t.length < 2 || t.length > 80) throw invalid('title', 'title must be longer than or equal to 2 characters');
      out.title = t;
    }
    if (b.subtitle !== undefined) out.subtitle = b.subtitle === null ? null : text(b.subtitle).slice(0, 160) || null;
    if (!partial || b.targetType !== undefined) {
      if (!['vendor', 'cuisine', 'search'].includes(b.targetType)) throw invalid('targetType', 'targetType must be one of the following values: vendor, cuisine, search');
      out.targetType = b.targetType;
    }
    if (b.targetId !== undefined) out.targetId = b.targetId;
    if (b.targetQuery !== undefined) out.targetQuery = b.targetQuery === null ? null : text(b.targetQuery) || null;
    if (b.city !== undefined) out.city = b.city === null ? null : text(b.city) || null;
    if (b.startsAt !== undefined) {
      if (!isIso(b.startsAt)) throw invalid('startsAt', 'startsAt must be a valid ISO 8601 date string');
      out.startsAt = isoNow(Date.parse(b.startsAt));
    }
    if (b.endsAt !== undefined) {
      if (b.endsAt !== null && !isIso(b.endsAt)) throw invalid('endsAt', 'endsAt must be a valid ISO 8601 date string');
      out.endsAt = b.endsAt ? isoNow(Date.parse(b.endsAt)) : null;
    }
    if (b.sort !== undefined) out.sort = Number(b.sort) || 0;
    if (b.isActive !== undefined) out.isActive = !!b.isActive;
    return out;
  };

  const checkBanner = (db: MockDb, b: MockFoodBanner) => {
    if (b.endsAt && Date.parse(b.endsAt) <= Date.parse(b.startsAt)) throw invalid('endsAt', 'A banner must end after it starts.');
    if (b.targetType === 'search') {
      if (!b.targetQuery) throw invalid('targetQuery', 'A search banner needs targetQuery.');
      b.targetId = null;
      return;
    }
    if (!b.targetId) throw invalid('targetId', `A ${b.targetType} banner needs targetId.`);
    b.targetQuery = null;
    if (!targetOf(db, b)) throw invalid('targetId', `That ${b.targetType} isn’t on Food Court.`);
  };

  route('POST', '/admin/food/banners', ctx => {
    admin(ctx);
    const f = bannerFields(ctx.body, false);
    const b: MockFoodBanner = {
      id: nextId(ctx.db, 'fbn'),
      imageUrl: f.imageUrl!,
      title: f.title!,
      subtitle: f.subtitle ?? null,
      targetType: f.targetType!,
      targetId: f.targetId ?? null,
      targetQuery: f.targetQuery ?? null,
      city: f.city ?? null,
      startsAt: f.startsAt ?? isoNow(ctx.now),
      endsAt: f.endsAt ?? null,
      sort: f.sort ?? 0,
      isActive: f.isActive ?? true,
      createdAt: isoNow(ctx.now),
    };
    checkBanner(ctx.db, b);
    ctx.db.food.banners.push(b);
    ctx.setStatus(201);
    return bannerView(b);
  });

  route('PATCH', '/admin/food/banners/:id', ctx => {
    admin(ctx);
    const b = ctx.db.food.banners.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!b) throw new FoodError(404, 'NOT_FOUND', 'Banner not found.');
    Object.assign(b, bannerFields(ctx.body, true));
    checkBanner(ctx.db, b);
    return bannerView(b);
  });

  route('DELETE', '/admin/food/banners/:id', ctx => {
    admin(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    if (!ctx.db.food.banners.some(b => b.id === id)) throw new FoodError(404, 'NOT_FOUND', 'Banner not found.');
    ctx.db.food.banners = ctx.db.food.banners.filter(b => b.id !== id);
    return { deleted: true };
  });
}
