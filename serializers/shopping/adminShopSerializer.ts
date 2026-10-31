// MetroMatrix — Admin (Shopping) serializers: MetroMatrix-API's /admin/shop
// views (admin-shop.response.ts) in the app's words.

import type { AdminBanner, AdminOrderLookup, ProductReport, ReportStatus, ShopCategory, ShopOverview, StoreSummary } from '../../models/shopping';
import { REPORT_REASON_LABEL } from '../../models/shopping/reportModel';
import { bool, bodiesOf, isObject, num, str, strOrNull, arr, fromResponse } from '../serializerUtils';
import { bannerSerializer } from './catalogSerializer';
import { count, iso, isoOrNull, compact, money, paged } from './common';
import { storeOrderSerializer } from './orderSerializer';

/** GET /admin/shop/overview. */
export const shopOverviewSerializer = fromResponse((raw: unknown): ShopOverview => {
  const r = isObject(raw) ? raw : {};
  return {
    stores: count(r.stores),
    activeProducts: count(r.activeProducts),
    openReports: count(r.openReports),
    ordersToday: count(r.ordersToday),
  };
});

/** A banner with its schedule; the stores and categories name its target. */
export const adminBannerSerializer = fromResponse(
  (raw: unknown, home: { stores: StoreSummary[]; categories: ShopCategory[] } = { stores: [], categories: [] }): AdminBanner | null => {
    const banner = bannerSerializer(raw, home);
    if (!banner || !isObject(raw)) return null;
    return {
      ...banner,
      startsAt: isoOrNull(raw.startsAt),
      endsAt: isoOrNull(raw.endsAt),
      position: Math.round(num(raw.sort)),
      isActive: bool(raw.isActive, true),
    };
  },
);

/** The API's "actioned" is the app's "removed". */
const REPORT_STATUS: Record<string, ReportStatus> = { open: 'open', dismissed: 'dismissed', actioned: 'removed' };

export const productReportSerializer = fromResponse((raw: unknown): ProductReport | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const product = isObject(raw.product) ? raw.product : {};
  const store = isObject(raw.store) ? raw.store : {};
  if (!id || !str(product.id)) return null;
  return {
    id,
    productId: str(product.id),
    productName: str(product.name, 'Product'),
    productImage: null,
    storeName: str(store.name),
    reason: REPORT_REASON_LABEL[str(raw.reason)] ?? 'Reported',
    details: strOrNull(raw.details),
    reportCount: Math.max(1, count(raw.openReportsOnProduct)),
    status: REPORT_STATUS[str(raw.status)] ?? 'open',
    createdAt: iso(raw.createdAt),
  };
});

/**
 * The lookup: the store-order rows a code found (each with its group, store and
 * customer) and each one's detail (items and timeline). The group is the one
 * the code names exactly, or the first row's.
 */
export const orderLookupSerializer = (parts: { rows: unknown; details: unknown[] }, code = ''): AdminOrderLookup | null => {
  const mine = lookupRowsSerializer(isObject(parts) ? parts.rows : null, code);
  const first = mine[0];
  if (!first) return null;
  const group = str(first.groupCode);
  const details = new Map(
    arr(isObject(parts) ? parts.details : null)
      .map(d => bodiesOf({ d }).d)
      .filter(isObject)
      .map(d => [str(d.id), d] as const),
  );
  const orders = compact(mine.map(r => storeOrderSerializer({ ...(details.get(str(r.id)) ?? r), store: r.store, groupCode: group })));
  return {
    code: group,
    customerName: str(first.customerName, 'Customer'),
    city: str(first.city),
    placedAt: iso(mine.map(r => str(r.placedAt)).sort()[0]),
    total: mine.reduce((s, r) => s + money(r.total), 0),
    orders,
  };
};

/** A store featured or not, as the API answers `{ id, isFeatured }`. */
export const featuredStateSerializer = fromResponse((raw: unknown) =>
  isObject(raw) && str(raw.id) && typeof raw.isFeatured === 'boolean' ? { id: str(raw.id), isFeatured: raw.isFeatured } : null,
);

/** The banners, in order, their targets named from the stores and categories. */
export const adminBannerListSerializer = fromResponse((raw: unknown, home?: { stores: StoreSummary[]; categories: ShopCategory[] }) =>
  compact(arr(raw).map(b => adminBannerSerializer(b, home))).sort((a, b) => a.position - b.position),
);

/** A page of productReports, as the API answers it. */
export const productReportPageSerializer = fromResponse(raw => paged(raw, productReportSerializer));

/**
 * The rows a lookup opens: the group the code names (a code is a prefix, so
 * other groups can match too), or just the store order a full store-order
 * code names.
 */
export const lookupRowsSerializer = fromResponse((raw: unknown, code: string = ''): Record<string, unknown>[] => {
  const rows = arr(isObject(raw) ? raw.items : null).filter(r => isObject(r) && str(r.id)) as Record<string, unknown>[];
  const wanted = code.trim().toUpperCase();
  const exact = rows.find(r => str(r.code) === wanted);
  if (exact) return [exact];
  const first = rows.find(r => str(r.groupCode) === wanted) ?? rows[0];
  return first ? rows.filter(r => str(r.groupCode) === str(first.groupCode)) : [];
});
