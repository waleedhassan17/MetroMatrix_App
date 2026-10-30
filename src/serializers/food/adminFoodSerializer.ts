// ═══════════════════════════════════════════════════════
// MetroMatrix — The staff Food console serializers (/admin/food)
// ═══════════════════════════════════════════════════════
// The overview, vendors (list and detail), orders for disputes, review
// moderation, cuisines and banners → the app's shapes (types/food.ts).
// docs/API_FOOD.md §4.5.

import type {
  AdminCuisine,
  AdminFoodBanner,
  AdminFoodOrder,
  AdminFoodOrderRow,
  AdminFoodOverview,
  AdminFoodReview,
  AdminFoodVendor,
  AdminFoodVendorRow,
  FoodBannerTargetType,
  KitchenKind,
} from '../../types/food';
import type { Paged } from '../../types/payments';
import { arr, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { paged } from '../shopping/common';
import { boardCardSerializer, foodOrderSerializer } from './orderSerializer';
import { foodReviewSerializer, ratingSummarySerializer } from './reviewSerializer';
import {
  KITCHEN_KINDS,
  feeBandsSerializer,
  hoursSerializer,
  vendorPlanSerializer,
  vendorProfileSerializer,
  vendorSettingsSerializer,
  vendorSetupSerializer,
} from './vendorSerializer';

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const count = (v: unknown) => Math.max(0, Math.round(num(v)));
const rate = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(1, Number(v))));
const kind = (v: unknown): KitchenKind => oneOf(v, KITCHEN_KINDS, 'restaurant');
const BANNER_TARGETS: readonly FoodBannerTargetType[] = ['vendor', 'cuisine', 'search'];

export const adminFoodOverviewSerializer = (raw: unknown): AdminFoodOverview | null => {
  if (!isObject(raw)) return null;
  const a = isObject(raw.activeVendors) ? raw.activeVendors : {};
  const w = isObject(raw.waiting) ? raw.waiting : {};
  return {
    date: str(raw.date),
    activeVendors: { restaurant: count(a.restaurant), cloud_kitchen: count(a.cloud_kitchen), home_kitchen: count(a.home_kitchen), total: count(a.total) },
    ordersToday: count(raw.ordersToday),
    activeOrders: count(raw.activeOrders),
    acceptanceRateToday: rate(raw.acceptanceRateToday),
    autoRejectsToday: count(raw.autoRejectsToday),
    topCuisines: compact(arr(raw.topCuisines).map(c => (isObject(c) && str(c.slug) ? { slug: str(c.slug), name: str(c.name), orders: count(c.orders) } : null))),
    waiting: { approvals: count(w.approvals), foodSafetyChecks: count(w.foodSafetyChecks) },
  };
};

export const adminFoodVendorRowSerializer = (raw: unknown): AdminFoodVendorRow | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    businessId: str(raw.businessId),
    name: str(raw.name),
    slug: str(raw.slug),
    subType: kind(raw.subType),
    subTypeLabel: str(raw.subTypeLabel),
    city: strOrNull(raw.city),
    businessStatus: str(raw.businessStatus),
    branchStatus: str(raw.branchStatus),
    isPaused: bool(raw.isPaused),
    isFeatured: bool(raw.isFeatured),
    ratingAvg: Math.max(0, Math.min(5, num(raw.ratingAvg))),
    ratingCount: count(raw.ratingCount),
    orders30d: count(raw.orders30d),
    wentLiveAt: strOrNull(raw.wentLiveAt),
    foodSafetyCheckedAt: strOrNull(raw.foodSafetyCheckedAt),
    ownerEmail: strOrNull(raw.ownerEmail),
    planKey: str(raw.planKey, 'community'),
  };
};

export const adminFoodVendorsPageSerializer = (raw: unknown): Paged<AdminFoodVendorRow> => paged(raw, adminFoodVendorRowSerializer);

export const adminFoodReviewSerializer = (raw: unknown): AdminFoodReview | null => {
  const r = foodReviewSerializer(raw);
  if (!r || !isObject(raw)) return null;
  return { ...r, vendorId: strOrNull(raw.vendorId), orderCode: strOrNull(raw.orderCode), isHidden: bool(raw.isHidden), hiddenReason: strOrNull(raw.hiddenReason) };
};

export const adminFoodReviewsPageSerializer = (raw: unknown): Paged<AdminFoodReview> => paged(raw, adminFoodReviewSerializer);

export const adminFoodVendorSerializer = (raw: unknown): AdminFoodVendor | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    businessId: str(raw.businessId),
    subType: kind(raw.subType),
    subTypeLabel: str(raw.subTypeLabel),
    businessStatus: str(raw.businessStatus),
    suspensionReason: strOrNull(raw.suspensionReason),
    ownerEmail: strOrNull(raw.ownerEmail),
    profile: vendorProfileSerializer(raw.profile),
    settings: vendorSettingsSerializer(raw.settings),
    hours: hoursSerializer(raw.hours),
    feeBands: feeBandsSerializer(raw.feeBands),
    setup: vendorSetupSerializer(raw.setup),
    plan: vendorPlanSerializer(raw.plan),
    menu: compact(
      arr(raw.menu).map(c =>
        isObject(c) && str(c.id)
          ? {
              id: str(c.id),
              name: str(c.name),
              isActive: c.isActive !== false,
              items: compact(
                arr(c.items).map(i =>
                  isObject(i) && str(i.id) ? { id: str(i.id), name: str(i.name), basePrice: count(i.basePrice), isActive: i.isActive !== false } : null,
                ),
              ),
            }
          : null,
      ),
    ),
    recentOrders: compact(arr(raw.recentOrders).map(boardCardSerializer)),
    ratings: ratingSummarySerializer(raw.ratings),
    complaints: compact(arr(raw.complaints).map(adminFoodReviewSerializer)),
  };
};

/** The vendor after feature / unfeature (only what changed). */
export const adminFeaturedSerializer = (raw: unknown): { id: string; isFeatured: boolean } | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), isFeatured: bool(raw.isFeatured) } : null;

/** The vendor after suspend / reinstate. */
export const adminSuspensionSerializer = (raw: unknown): { id: string; businessStatus: string; suspensionReason: string | null } | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), businessStatus: str(raw.businessStatus), suspensionReason: strOrNull(raw.suspensionReason) } : null;

export const adminFoodOrderRowSerializer = (raw: unknown): AdminFoodOrderRow | null => {
  const card = boardCardSerializer(raw);
  return card && isObject(raw) ? { ...card, vendorId: strOrNull(raw.vendorId) } : null;
};

export const adminFoodOrdersPageSerializer = (raw: unknown): Paged<AdminFoodOrderRow> => paged(raw, adminFoodOrderRowSerializer);

export const adminFoodOrderSerializer = (raw: unknown): AdminFoodOrder | null => {
  const o = foodOrderSerializer(raw);
  if (!o || !isObject(raw)) return null;
  const c = isObject(raw.customer) ? raw.customer : {};
  return {
    ...o,
    codCollected: raw.codCollected === null || raw.codCollected === undefined ? null : count(raw.codCollected),
    customer: { userId: str(c.userId), name: strOrNull(c.name), email: strOrNull(c.email), phone: strOrNull(c.phone) },
  };
};

/** The review after hide / unhide. */
export const adminHiddenSerializer = (raw: unknown): { id: string; isHidden: boolean; hiddenReason: string | null } | null =>
  isObject(raw) && str(raw.id) ? { id: str(raw.id), isHidden: bool(raw.isHidden), hiddenReason: strOrNull(raw.hiddenReason) } : null;

export const adminCuisineSerializer = (raw: unknown): AdminCuisine | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    slug: str(raw.slug),
    name: str(raw.name),
    icon: str(raw.icon, str(raw.slug)),
    sort: count(raw.sort),
    isActive: raw.isActive !== false,
    vendors: count(raw.vendors),
  };
};

export const adminCuisinesSerializer = (raw: unknown): AdminCuisine[] => compact(arr(raw).map(adminCuisineSerializer));

export const adminFoodBannerSerializer = (raw: unknown): AdminFoodBanner | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    imageUrl: str(raw.imageUrl),
    title: str(raw.title),
    subtitle: strOrNull(raw.subtitle),
    targetType: oneOf(raw.targetType, BANNER_TARGETS, 'search'),
    targetId: strOrNull(raw.targetId),
    targetQuery: strOrNull(raw.targetQuery),
    city: strOrNull(raw.city),
    startsAt: str(raw.startsAt),
    endsAt: strOrNull(raw.endsAt),
    sort: count(raw.sort),
    isActive: raw.isActive !== false,
  };
};

export const adminFoodBannersSerializer = (raw: unknown): AdminFoodBanner[] => compact(arr(raw).map(adminFoodBannerSerializer));

/** The food-safety check's recorded outcome. */
export const foodSafetyOutcomeSerializer = fromResponse(raw => (isObject(raw) && str(raw.outcome) ? str(raw.outcome) : null));
