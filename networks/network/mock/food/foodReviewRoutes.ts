// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food reviews and insights
// ═══════════════════════════════════════════════════════
// One review per order once it was delivered or collected (a food rating, a
// delivery rating for deliveries, tags, words); the vendor's page shows the
// average, the stars, the top tags and three recent; the vendor replies;
// staff can hide one (it leaves every rating and list). The vendor's
// insights: orders, recorded sales (money the vendor received directly),
// acceptance, prep time, on time, top dishes, why orders ended, repeat
// customers — over local days.
// Mirrors the API's reviews and insights services (docs/API_FOOD.md §4.2–4.3).

import type { MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import { addDays, dateInZone } from '../../../../utils/healthTime';
import { FoodError, assertEntitled, invalid, isoNow, kitchenToday, nextId, text } from './foodLogic';
import { isVisible } from './foodDiscovery';
import type { MockFoodOrder, MockFoodReview, MockFoodVendor } from './foodTypes';
import { foodHooks } from './foodHooks';

export const FOOD_REVIEW_TAGS = ['tasty', 'hot_and_fresh', 'good_portion', 'well_packed', 'on_time', 'polite_rider', 'value_for_money'];

const firstName = (name: string | null | undefined) => (name ?? 'Customer').split(/\s+/)[0];
const nameOf = (db: MockDb, userId: string) => db.users.find(u => u.id === userId)?.name ?? null;

export const reviewView = (r: MockFoodReview, author: string | null) => ({
  id: r.id,
  author,
  foodRating: r.foodRating,
  deliveryRating: r.deliveryRating,
  tags: [...r.tags],
  text: r.text,
  photos: [...r.photos],
  vendorReply: r.vendorReply,
  repliedAt: r.repliedAt,
  createdAt: r.createdAt,
});

/**
 * The vendor's rating: its seeded ratings (seeded vendors arrive with
 * earlier ones) plus every visible review written since. The API averages
 * the reviews themselves; the dummy vendors' seeded numbers stand in for
 * reviews it doesn't hold.
 */
export const recomputeRating = (db: MockDb, v: MockFoodVendor) => {
  v.ratingSeed ??= { avg: v.ratingAvg, count: v.ratingCount };
  const fresh = db.food.reviews.filter(r => r.businessId === v.businessId && !r.isHidden && !r.seeded);
  const count = v.ratingSeed.count + fresh.length;
  const sum = v.ratingSeed.avg * v.ratingSeed.count + fresh.reduce((s, r) => s + r.foodRating, 0);
  v.ratingCount = count;
  v.ratingAvg = count ? Math.round((sum / count) * 100) / 100 : 0;
};

/** May the customer rate this order now? */
export const canReview = (db: MockDb, o: MockFoodOrder) => (o.status === 'delivered' || o.status === 'picked_up') && !db.food.reviews.some(r => r.orderId === o.id);

const visibleOf = (db: MockDb, businessId: string) =>
  db.food.reviews.filter(r => r.businessId === businessId && !r.isHidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

/** The vendor page's rating block. */
export const reviewSummary = (db: MockDb, v: MockFoodVendor) => {
  const rows = visibleOf(db, v.businessId);
  const tags = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  return {
    ratingAvg: v.ratingAvg,
    ratingCount: v.ratingCount,
    distribution: Object.fromEntries([5, 4, 3, 2, 1].map(s => [s, rows.filter(r => r.foodRating === s).length])),
    topTags: [...tags]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
    recent: rows.slice(0, 3).map(r => reviewView(r, firstName(nameOf(db, r.userId)))),
  };
};

const page = (q: Record<string, any>) => ({ page: Math.max(1, Number(q.page) || 1), pageSize: Math.min(100, Math.max(1, Number(q.pageSize) || 20)) });
const paged = <T>(rows: T[], q: Record<string, any>) => {
  const { page: p, pageSize } = page(q);
  return { items: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize };
};

export interface ReviewRouteDeps {
  route: ShopKit['route'];
  requireUser: ShopKit['requireUser'];
  myVendor: (ctx: ShopCtx) => MockFoodVendor;
}

export function registerReviewRoutes({ route, requireUser, myVendor }: ReviewRouteDeps) {
  const customer = (ctx: ShopCtx): MockUser => {
    const u = requireUser(ctx);
    if (u.role !== 'customer') throw new FoodError(403, 'FORBIDDEN', 'You don’t have access to this.');
    return u;
  };

  route('POST', '/food/orders/:code/review', ctx => {
    const user = customer(ctx);
    const b = ctx.body;
    if (!(Number.isInteger(b.foodRating) && b.foodRating >= 1 && b.foodRating <= 5)) throw invalid('foodRating', 'foodRating must not be less than 1');
    if (b.deliveryRating !== undefined && !(Number.isInteger(b.deliveryRating) && b.deliveryRating >= 1 && b.deliveryRating <= 5))
      throw invalid('deliveryRating', 'deliveryRating must not be less than 1');
    if (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.some((t: unknown) => !FOOD_REVIEW_TAGS.includes(t as string))))
      throw invalid('tags', `each value in tags must be one of the following values: ${FOOD_REVIEW_TAGS.join(', ')}`);
    const words = text(b.text);
    if (words.length > 1000) throw invalid('text', 'text must be shorter than or equal to 1000 characters');
    if (b.photos !== undefined && (!Array.isArray(b.photos) || b.photos.length > 4)) throw invalid('photos', 'photos must contain no more than 4 elements');
    const o = ctx.db.food.orders.find(x => x.code === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!o) throw new FoodError(404, 'NOT_FOUND', 'Order not found.');
    if (o.status !== 'delivered' && o.status !== 'picked_up')
      throw new FoodError(409, 'REVIEW_NOT_ALLOWED', 'You can review an order once it has been delivered or collected.', { status: o.status });
    if (ctx.db.food.reviews.some(r => r.orderId === o.id)) throw new FoodError(409, 'REVIEW_EXISTS', 'You’ve already reviewed this order.');
    const r: MockFoodReview = {
      id: nextId(ctx.db, 'frv'),
      orderId: o.id,
      businessId: o.businessId,
      userId: user.id,
      foodRating: b.foodRating,
      deliveryRating: o.fulfilment === 'delivery' ? (b.deliveryRating ?? null) : null,
      tags: [...new Set<string>(b.tags ?? [])],
      text: words || null,
      photos: [...(b.photos ?? [])],
      vendorReply: null,
      repliedAt: null,
      isHidden: false,
      hiddenReason: null,
      createdAt: isoNow(ctx.now),
    };
    ctx.db.food.reviews.push(r);
    const v = ctx.db.food.vendors.find(x => x.businessId === o.businessId);
    if (v) recomputeRating(ctx.db, v);
    ctx.setStatus(201);
    return reviewView(r, null);
  });

  route('GET', '/food/vendors/:id/reviews', ctx => {
    const id = decodeURIComponent(ctx.params[0]);
    const v = ctx.db.food.vendors.find(x => (x.brandId === id || x.slug === id) && isVisible(ctx.db, x));
    if (!v) throw new FoodError(404, 'NOT_FOUND', 'This vendor is not on Food Court.');
    return paged(
      visibleOf(ctx.db, v.businessId).map(r => reviewView(r, firstName(nameOf(ctx.db, r.userId)))),
      ctx.query,
    );
  });

  route('GET', '/food/vendor/reviews', ctx => {
    const v = myVendor(ctx);
    const unreplied = ctx.query.unreplied;
    if (unreplied !== undefined && unreplied !== 'true' && unreplied !== 'false') throw invalid('unreplied', 'unreplied must be one of the following values: true, false');
    const extra = foodHooks.vendorReviewFilter(ctx.db, v, ctx.query, ctx.now);
    const rows = visibleOf(ctx.db, v.businessId).filter(r => (unreplied === 'true' ? r.vendorReply === null : unreplied === 'false' ? r.vendorReply !== null : true) && extra(r));
    return paged(
      rows.map(r => ({ ...reviewView(r, firstName(nameOf(ctx.db, r.userId))), orderCode: r.orderId ? (ctx.db.food.orders.find(o => o.id === r.orderId)?.code ?? null) : null })),
      ctx.query,
    );
  });

  route('POST', '/food/vendor/reviews/:id/reply', ctx => {
    const v = myVendor(ctx);
    const reply = text(ctx.body.reply);
    if (reply.length < 2 || reply.length > 1000) throw invalid('reply', 'reply must be longer than or equal to 2 characters');
    const r = ctx.db.food.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.businessId === v.businessId && !x.isHidden);
    if (!r) throw new FoodError(404, 'NOT_FOUND', 'Review not found.');
    r.vendorReply = reply;
    r.repliedAt = isoNow(ctx.now);
    ctx.setStatus(200);
    return reviewView(r, null);
  });

  // ── Insights ──
  route('GET', '/food/vendor/insights', ctx => {
    const v = myVendor(ctx);
    assertEntitled(v, 'insights');
    const q = ctx.query;
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (q.range !== undefined && !['today', '7d', '30d'].includes(q.range)) throw invalid('range', 'range must be one of the following values: today, 7d, 30d');
    const today = kitchenToday(v, ctx.now).date;
    let from: string;
    let to: string;
    if (q.from || q.to) {
      if (!q.from || !q.to || !DATE.test(q.from) || !DATE.test(q.to) || q.from > q.to) throw invalid('from', 'Give both from and to (from ≤ to).');
      if (addDays(q.from, 92) < q.to) throw invalid('to', 'At most 92 days at a time.');
      from = q.from;
      to = q.to;
    } else {
      to = today;
      from = q.range === 'today' ? today : addDays(today, q.range === '30d' ? -29 : -6);
    }
    const dayOf = (iso: string) => dateInZone(iso, v.timezone);
    const rows = ctx.db.food.orders.filter(o => o.businessId === v.businessId && dayOf(o.placedAt) >= from && dayOf(o.placedAt) <= to);
    const done = (o: MockFoodOrder) => o.status === 'delivered' || o.status === 'picked_up';
    const negative = (o: MockFoodOrder) => o.status === 'rejected' || o.status === 'auto_rejected' || o.status === 'cancelled';
    const sum = (xs: MockFoodOrder[]) => xs.reduce((s, o) => s + o.total, 0);
    const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : null);
    const completed = rows.filter(done);
    const accepted = rows.filter(o => o.acceptedAt);
    const answered = rows.filter(o => o.acceptedAt || o.status === 'rejected' || o.status === 'auto_rejected');
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    const acceptSeconds = avg(accepted.map(o => (Date.parse(o.acceptedAt!) - Date.parse(o.placedAt)) / 1000));
    const prepMinutes = avg(rows.filter(o => o.acceptedAt && o.readyAt).map(o => (Date.parse(o.readyAt!) - Date.parse(o.acceptedAt!)) / 60_000));
    const promised = completed.filter(o => o.promisedAt);
    const onTime = promised.filter(o => Date.parse((o.deliveredAt ?? o.pickedUpAt)!) <= Date.parse(o.promisedAt!));
    const reasons = new Map<string, { status: string; reason: string; count: number }>();
    for (const o of rows.filter(negative)) {
      const reason = o.cancelReason ?? 'No reason given';
      const k = `${o.status}|${reason}`;
      const e = reasons.get(k) ?? { status: o.status, reason, count: 0 };
      e.count += 1;
      reasons.set(k, e);
    }
    const items = new Map<string, { name: string; quantity: number; recordedSales: number }>();
    for (const o of completed)
      for (const i of o.items) {
        const e = items.get(i.name) ?? { name: i.name, quantity: 0, recordedSales: 0 };
        e.quantity += i.quantity;
        e.recordedSales += i.lineTotal;
        items.set(i.name, e);
      }
    const perCustomer = new Map<string, number>();
    for (const o of rows) perCustomer.set(o.userId, (perCustomer.get(o.userId) ?? 0) + 1);
    const repeat = [...perCustomer.values()].filter(n => n >= 2).length;
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ofDay = rows.filter(o => dayOf(o.placedAt) === d);
      days.push({ date: d, orders: ofDay.length, completed: ofDay.filter(done).length, cancelled: ofDay.filter(negative).length, recordedSales: sum(ofDay.filter(done)) });
    }
    return {
      range: { from, to, timezone: v.timezone },
      note: 'Recorded sales are the orders you marked delivered or collected. You received this money directly — MetroMatrix holds none of it.',
      totals: { orders: rows.length, completed: completed.length, recordedSales: sum(completed), averageOrderValue: completed.length ? Math.floor(sum(completed) / completed.length) : null },
      days,
      acceptanceRate: ratio(accepted.length, answered.length),
      autoRejected: rows.filter(o => o.status === 'auto_rejected').length,
      avgAcceptSeconds: acceptSeconds === null ? null : Math.round(acceptSeconds),
      avgPrepMinutes: prepMinutes === null ? null : Math.round(prepMinutes * 10) / 10,
      onTimeRate: ratio(onTime.length, promised.length),
      cancelReasons: [...reasons.values()].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)).slice(0, 10),
      topItems: [...items.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5),
      repeatCustomers: { customers: perCustomer.size, repeat, rate: ratio(repeat, perCustomer.size) },
    };
  });
}
