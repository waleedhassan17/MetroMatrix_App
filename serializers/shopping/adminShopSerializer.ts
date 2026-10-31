// MetroMatrix — Admin (Shopping) serializers.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type { AdminBanner, AdminOrderLookup, ProductReport, ReportStatus, ShopOverview } from '../../models/shopping';
import { bool, isObject, num, oneOf, str, strOrNull, arr, fromResponse } from '../serializerUtils';
import { bannerSerializer } from './catalogSerializer';
import { count, iso, isoOrNull, compact, paged } from './common';
import { orderGroupSerializer } from './orderSerializer';

export const shopOverviewSerializer = fromResponse((raw: unknown): ShopOverview => {
  const r = isObject(raw) ? raw : {};
  return {
    stores: count(r.stores),
    activeProducts: count(r.activeProducts),
    openReports: count(r.openReports),
    ordersToday: count(r.ordersToday),
  };
});

export const adminBannerSerializer = fromResponse((raw: unknown): AdminBanner | null => {
  const banner = bannerSerializer(raw);
  if (!banner || !isObject(raw)) return null;
  return {
    ...banner,
    startsAt: iso(raw.startsAt),
    endsAt: isoOrNull(raw.endsAt),
    position: Math.round(num(raw.position)),
    isActive: bool(raw.isActive, true),
  };
});

const REPORT_STATUSES: readonly ReportStatus[] = ['open', 'dismissed', 'removed'];

export const productReportSerializer = fromResponse((raw: unknown): ProductReport | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    productId: str(raw.productId),
    productName: str(raw.productName, 'Product'),
    productImage: strOrNull(raw.productImage),
    storeName: str(raw.storeName),
    reason: str(raw.reason, 'Reported'),
    details: strOrNull(raw.details),
    reportCount: Math.max(1, count(raw.reportCount)),
    status: oneOf(raw.status, REPORT_STATUSES, 'open'),
    createdAt: iso(raw.createdAt),
  };
});

export const orderLookupSerializer = fromResponse((raw: unknown): AdminOrderLookup | null => {
  if (!isObject(raw)) return null;
  const group = orderGroupSerializer(raw.group);
  if (!group) return null;
  const c = isObject(raw.customer) ? raw.customer : {};
  return { group, customer: { name: str(c.name, 'Customer'), email: str(c.email) } };
});

/** A list of adminBanners, as the API answers it. */
export const adminBannerListSerializer = fromResponse(raw => compact(arr(raw).map(adminBannerSerializer)));

/** A page of productReports, as the API answers it. */
export const productReportPageSerializer = fromResponse(raw => paged(raw, productReportSerializer));
