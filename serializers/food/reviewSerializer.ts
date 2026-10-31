// ═══════════════════════════════════════════════════════
// MetroMatrix — Food reviews, insights and home banners
// ═══════════════════════════════════════════════════════
// A review (the customer's, the vendor page's, the kitchen's own list), the
// vendor page's rating block, the kitchen's insights and the staff banners
// the Food home shows → the app's shapes (models/food.ts). Defensive: a
// missing field is a sensible default, never a crash.
// docs/API_FOOD.md §2 Review, §4.2 review, §4.3 Reviews and Insights, §4.1
// home banners.

import type {
  FoodBannerTarget,
  FoodHomeBanner,
  FoodInsights,
  FoodOrderStatus,
  FoodRatingSummary,
  FoodReview,
  FoodReviewTag,
  VendorReview,
} from '../../models/food';
import type { Paged } from '../../models/payments';
import { arr, enumList, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { paged } from '../shopping/common';
import { FOOD_ORDER_STATUSES } from './orderSerializer';

export const FOOD_REVIEW_TAGS: readonly FoodReviewTag[] = ['tasty', 'hot_and_fresh', 'good_portion', 'well_packed', 'on_time', 'polite_rider', 'value_for_money'];

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const count = (v: unknown) => Math.max(0, Math.round(num(v)));
const stars = (v: unknown) => Math.max(1, Math.min(5, Math.round(num(v, 5))));
const rate = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(1, Number(v))));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export const foodReviewSerializer = fromResponse((raw: unknown): FoodReview | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    author: strOrNull(raw.author),
    foodRating: stars(raw.foodRating),
    deliveryRating: raw.deliveryRating === null || raw.deliveryRating === undefined ? null : stars(raw.deliveryRating),
    tags: enumList(raw.tags, FOOD_REVIEW_TAGS),
    text: strOrNull(raw.text),
    photos: arr(raw.photos).map(p => str(p)).filter(Boolean),
    vendorReply: strOrNull(raw.vendorReply),
    repliedAt: strOrNull(raw.repliedAt),
    createdAt: str(raw.createdAt),
  };
});

export const foodReviewsPageSerializer = fromResponse((raw: unknown): Paged<FoodReview> => paged(raw, foodReviewSerializer));

export const vendorReviewSerializer = (raw: unknown): VendorReview | null => {
  const r = foodReviewSerializer(raw);
  return r && isObject(raw) ? { ...r, orderCode: strOrNull(raw.orderCode) } : null;
};

export const vendorReviewsPageSerializer = fromResponse((raw: unknown): Paged<VendorReview> => paged(raw, vendorReviewSerializer));

/** The vendor page's rating block; null when the API sends none (no reviews yet). */
export const ratingSummarySerializer = (raw: unknown): FoodRatingSummary | null => {
  if (!isObject(raw)) return null;
  const d = isObject(raw.distribution) ? raw.distribution : {};
  return {
    ratingAvg: Math.max(0, Math.min(5, num(raw.ratingAvg))),
    ratingCount: count(raw.ratingCount),
    distribution: { 5: count(d[5]), 4: count(d[4]), 3: count(d[3]), 2: count(d[2]), 1: count(d[1]) },
    topTags: compact(
      arr(raw.topTags).map(t => {
        const tag = isObject(t) ? oneOf(t.tag, FOOD_REVIEW_TAGS, null) : null;
        return tag && isObject(t) ? { tag, count: count(t.count) } : null;
      }),
    ),
    recent: compact(arr(raw.recent).map(foodReviewSerializer)),
  };
};

export const foodInsightsSerializer = fromResponse((raw: unknown): FoodInsights | null => {
  if (!isObject(raw)) return null;
  const range = isObject(raw.range) ? raw.range : {};
  const t = isObject(raw.totals) ? raw.totals : {};
  const rc = isObject(raw.repeatCustomers) ? raw.repeatCustomers : {};
  return {
    range: { from: str(range.from), to: str(range.to), timezone: str(range.timezone, 'Asia/Karachi') },
    note: strOrNull(raw.note),
    totals: { orders: count(t.orders), completed: count(t.completed), recordedSales: count(t.recordedSales), averageOrderValue: count(t.averageOrderValue) },
    days: compact(
      arr(raw.days).map(d =>
        isObject(d) && str(d.date)
          ? { date: str(d.date), orders: count(d.orders), completed: count(d.completed), cancelled: count(d.cancelled), recordedSales: count(d.recordedSales) }
          : null,
      ),
    ),
    acceptanceRate: rate(raw.acceptanceRate),
    autoRejected: count(raw.autoRejected),
    avgAcceptSeconds: numOrNull(raw.avgAcceptSeconds),
    avgPrepMinutes: numOrNull(raw.avgPrepMinutes),
    onTimeRate: rate(raw.onTimeRate),
    cancelReasons: compact(
      arr(raw.cancelReasons).map(c => {
        const status = isObject(c) ? oneOf<FoodOrderStatus>(c.status, FOOD_ORDER_STATUSES, null) : null;
        return status && isObject(c) ? { status, reason: str(c.reason), count: count(c.count) } : null;
      }),
    ),
    topItems: compact(arr(raw.topItems).map(i => (isObject(i) && str(i.name) ? { name: str(i.name), quantity: count(i.quantity), recordedSales: count(i.recordedSales) } : null))),
    repeatCustomers: { customers: count(rc.customers), repeat: count(rc.repeat), rate: rate(rc.rate) },
  };
});

const bannerTargetSerializer = (raw: unknown): FoodBannerTarget | null => {
  if (!isObject(raw)) return null;
  if (raw.type === 'search') return str(raw.query) ? { type: 'search', query: str(raw.query) } : null;
  if ((raw.type === 'vendor' || raw.type === 'cuisine') && str(raw.slug)) return { type: raw.type, id: str(raw.id), slug: str(raw.slug), name: str(raw.name) };
  return null;
};

/** A home banner; one whose target the app can't open is left out. */
export const foodHomeBannerSerializer = (raw: unknown): FoodHomeBanner | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.imageUrl)) return null;
  const target = bannerTargetSerializer(raw.target);
  return target ? { id: str(raw.id), imageUrl: str(raw.imageUrl), title: str(raw.title), subtitle: strOrNull(raw.subtitle), target } : null;
};

export const foodHomeBannersSerializer = (raw: unknown): FoodHomeBanner[] => compact(arr(raw).map(foodHomeBannerSerializer));
