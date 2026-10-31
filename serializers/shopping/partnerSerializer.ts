// MetroMatrix — Store-partner serializers.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type { Coupon, CouponStatus, CouponType, Insights, InsightsRange, InventoryMovement, InventoryRow, MovementReason, PartnerOrderAction, PartnerOrderDetail, PartnerOrderRow, PartnerProduct, PartnerProductRow, PartnerProductStatus, PartnerReview, PartnerSummary, PaymentAccount, PaymentAccountKind, StoreProfile, StoreSettings, PartnerOrderSegment } from '../../types/shopping';
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { addressSerializer } from '../addressSerializer';
import { reviewSerializer } from './catalogSerializer';
import { BRAND_FALLBACK, color, compact, count, iso, isoOrNull, money, moneyOrNull, paged } from './common';
import { ORDER_STATUSES, PAYMENT_STATUSES, storeOrderSerializer } from './orderSerializer';

const PRODUCT_STATUSES: readonly PartnerProductStatus[] = ['draft', 'active', 'archived'];
const ACTIONS: readonly PartnerOrderAction[] = [
  'confirm',
  'pack',
  'ship',
  'deliver',
  'cancel',
  'confirm_payment',
  'reject_payment',
  'cash_collected',
  'approve_cancellation',
];
const ACCOUNT_KINDS: readonly PaymentAccountKind[] = ['raast', 'jazzcash', 'easypaisa', 'bank'];

const series = <K extends 'amount' | 'count'>(raw: unknown, key: K) =>
  arr(raw)
    .filter(isObject)
    .map(p => ({ date: str(p.date), [key]: key === 'amount' ? money(p[key]) : count(p[key]) }) as { date: string } & Record<K, number>)
    .filter(p => p.date);

export const partnerSummarySerializer = fromResponse((raw: unknown): PartnerSummary => {
  const r = isObject(raw) ? raw : {};
  const c = isObject(r.counts) ? r.counts : {};
  return {
    storeName: str(r.storeName, 'Your store'),
    storeSlug: str(r.storeSlug),
    isPaused: bool(r.isPaused),
    pauseMessage: strOrNull(r.pauseMessage),
    counts: {
      newOrders: count(c.newOrders),
      toShip: count(c.toShip),
      paymentsToConfirm: count(c.paymentsToConfirm),
      returnsOpen: count(c.returnsOpen),
      lowStock: count(c.lowStock),
    },
    sales7d: series(r.sales7d, 'amount'),
    recordedSales7d: money(r.recordedSales7d),
  };
});

export const partnerOrderRowSerializer = (raw: unknown): PartnerOrderRow | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    code: str(raw.code, id),
    customerFirstName: str(raw.customerFirstName, 'Customer'),
    itemCount: count(raw.itemCount),
    total: money(raw.total),
    status: oneOf(raw.status, ORDER_STATUSES, 'placed'),
    paymentMethod: oneOf(raw.paymentMethod, ['cod', 'transfer'] as const, 'cod'),
    paymentStatus: oneOf(raw.paymentStatus, PAYMENT_STATUSES, 'cod_pending'),
    createdAt: iso(raw.createdAt),
  };
};

export const partnerOrderDetailSerializer = fromResponse((raw: unknown): PartnerOrderDetail | null => {
  const order = storeOrderSerializer(raw);
  if (!order || !isObject(raw)) return null;
  const address = addressSerializer(raw.address);
  if (!address) return null;
  const customer = isObject(raw.customer) ? raw.customer : {};
  return {
    ...order,
    customer: { name: str(customer.name, 'Customer'), phone: str(customer.phone) },
    address,
    internalNote: strOrNull(raw.internalNote),
    allowedActions: enumList(raw.allowedActions, ACTIONS),
    shipBlockedReason: strOrNull(raw.shipBlockedReason),
  };
});

export const partnerProductRowSerializer = (raw: unknown): PartnerProductRow | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name, 'Untitled product'),
    status: oneOf(raw.status, PRODUCT_STATUSES, 'draft'),
    price: money(raw.price),
    salePrice: moneyOrNull(raw.salePrice),
    imageUrl: strOrNull(raw.imageUrl),
    totalStock: count(raw.totalStock),
    variantCount: count(raw.variantCount),
    lowStock: bool(raw.lowStock),
    updatedAt: iso(raw.updatedAt),
  };
};

export const partnerProductSerializer = fromResponse((raw: unknown): PartnerProduct | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const opt = (o: unknown) =>
    isObject(o) && str(o.name) ? { name: str(o.name), values: arr(o.values).map(v => str(v)).filter(Boolean) } : null;
  const o2 = opt(raw.option2);
  const swatches: Record<string, string> = {};
  if (isObject(raw.option2) && isObject(raw.option2.swatches)) {
    for (const [k, v] of Object.entries(raw.option2.swatches)) {
      const c = color(v, '');
      if (c) swatches[k] = c;
    }
  }
  return {
    id,
    name: str(raw.name),
    description: str(raw.description),
    categoryId: strOrNull(raw.categoryId),
    collectionId: strOrNull(raw.collectionId),
    price: money(raw.price),
    salePrice: moneyOrNull(raw.salePrice),
    status: oneOf(raw.status, PRODUCT_STATUSES, 'draft'),
    images: arr(raw.images)
      .filter(isObject)
      .map(i => ({ url: str(i.url), publicId: str(i.publicId) }))
      .filter(i => i.url),
    option1: opt(raw.option1),
    option2: o2 ? { ...o2, swatches } : null,
    variants: arr(raw.variants)
      .filter(isObject)
      .map(v => ({
        id: strOrNull(v.id),
        option1: strOrNull(v.option1),
        option2: strOrNull(v.option2),
        sku: str(v.sku),
        stock: count(v.stock),
        priceDelta: money(v.priceDelta),
      })),
    updatedAt: iso(raw.updatedAt),
  };
});

export const inventoryRowSerializer = fromResponse((raw: unknown): InventoryRow | null => {
  if (!isObject(raw)) return null;
  const variantId = str(raw.variantId);
  if (!variantId) return null;
  return {
    variantId,
    productId: str(raw.productId),
    productName: str(raw.productName, 'Product'),
    variantLabel: str(raw.variantLabel),
    sku: str(raw.sku),
    stock: count(raw.stock),
    lowStock: bool(raw.lowStock),
    imageUrl: strOrNull(raw.imageUrl),
  };
});

const MOVEMENT_REASONS: readonly MovementReason[] = ['initial', 'manual', 'bulk', 'order', 'cancel', 'return_restock'];

export const movementSerializer = (raw: unknown): InventoryMovement | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    delta: Math.round(num(raw.delta)),
    stockAfter: count(raw.stockAfter),
    reason: oneOf(raw.reason, MOVEMENT_REASONS, 'manual'),
    note: strOrNull(raw.note),
    createdAt: iso(raw.createdAt),
  };
};

const COUPON_TYPES: readonly CouponType[] = ['percent', 'fixed'];
const COUPON_STATUSES: readonly CouponStatus[] = ['active', 'scheduled', 'expired', 'used_up', 'inactive'];

export const couponSerializer = fromResponse((raw: unknown): Coupon | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const code = str(raw.code);
  if (!id || !code) return null;
  const limit = raw.usageLimit === null || raw.usageLimit === undefined ? null : count(raw.usageLimit);
  const per = raw.perCustomerLimit === null || raw.perCustomerLimit === undefined ? null : count(raw.perCustomerLimit);
  return {
    id,
    code,
    type: oneOf(raw.type, COUPON_TYPES, 'fixed'),
    value: count(raw.value),
    minOrder: moneyOrNull(raw.minOrder),
    maxDiscount: moneyOrNull(raw.maxDiscount),
    startsAt: iso(raw.startsAt),
    endsAt: isoOrNull(raw.endsAt),
    usageLimit: limit || null,
    perCustomerLimit: per || null,
    usedCount: count(raw.usedCount),
    isActive: bool(raw.isActive, true),
    status: oneOf(raw.status, COUPON_STATUSES, 'active'),
  };
});

export const partnerReviewSerializer = fromResponse((raw: unknown): PartnerReview | null => {
  const review = reviewSerializer(raw);
  if (!review || !isObject(raw)) return null;
  return { ...review, productName: str(raw.productName, 'Product'), productImage: strOrNull(raw.productImage) };
});

const RANGES: readonly InsightsRange[] = ['7d', '30d', '90d'];

export const insightsSerializer = fromResponse((raw: unknown): Insights => {
  const r = isObject(raw) ? raw : {};
  return {
    range: oneOf(r.range, RANGES, '7d'),
    orders: series(r.orders, 'count'),
    sales: series(r.sales, 'amount'),
    recordedSales: money(r.recordedSales),
    orderCount: count(r.orderCount),
    topProducts: arr(r.topProducts)
      .filter(isObject)
      .map(p => ({
        productId: str(p.productId),
        name: str(p.name, 'Product'),
        imageUrl: strOrNull(p.imageUrl),
        units: count(p.units),
        amount: money(p.amount),
      }))
      .filter(p => p.productId),
    repeatCustomerPct: Math.min(100, count(r.repeatCustomerPct)),
    deliveredRatePct: Math.min(100, count(r.deliveredRatePct)),
  };
});

export const storeProfileSerializer = fromResponse((raw: unknown): StoreProfile | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const s = isObject(raw.socials) ? raw.socials : {};
  return {
    id,
    slug: str(raw.slug, id),
    name: str(raw.name, 'Your store'),
    tagline: str(raw.tagline),
    about: str(raw.about),
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    brandColor: color(raw.brandColor, BRAND_FALLBACK.brand),
    onBrandColor: color(raw.onBrandColor, BRAND_FALLBACK.onBrand),
    socials: {
      instagram: strOrNull(s.instagram),
      facebook: strOrNull(s.facebook),
      tiktok: strOrNull(s.tiktok),
      website: strOrNull(s.website),
    },
    phone: strOrNull(raw.phone),
    whatsapp: strOrNull(raw.whatsapp),
  };
});

export const storeSettingsSerializer = fromResponse((raw: unknown): StoreSettings => {
  const r = isObject(raw) ? raw : {};
  const min = count(r.dispatchMinDays);
  return {
    shippingFee: Math.max(0, money(r.shippingFee)),
    freeShippingOver: moneyOrNull(r.freeShippingOver),
    nationwide: bool(r.nationwide),
    deliveryCities: arr(r.deliveryCities).map(c => str(c)).filter(Boolean),
    dispatchMinDays: min,
    dispatchMaxDays: Math.max(min, count(r.dispatchMaxDays)),
    returnWindowDays: count(r.returnWindowDays),
    codEnabled: bool(r.codEnabled, true),
    codLimit: moneyOrNull(r.codLimit),
    isPaused: bool(r.isPaused),
    pauseMessage: strOrNull(r.pauseMessage),
  };
});

export const paymentAccountSerializer = fromResponse((raw: unknown): PaymentAccount | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const number = str(raw.number);
  if (!id || !number) return null;
  return {
    id,
    kind: oneOf(raw.kind, ACCOUNT_KINDS, 'bank'),
    title: str(raw.title),
    number,
    bankName: strOrNull(raw.bankName),
    isActive: bool(raw.isActive, true),
  };
});

export { compact };

/** A page of partnerReviews, as the API answers it. */
export const partnerReviewPageSerializer = fromResponse(raw => paged(raw, partnerReviewSerializer));

/** A list of paymentAccounts, as the API answers it. */
export const paymentAccountListSerializer = fromResponse(raw => compact(arr(raw).map(paymentAccountSerializer)));

/** A page of partnerProductRows, as the API answers it. */
export const partnerProductRowPageSerializer = fromResponse(raw => paged(raw, partnerProductRowSerializer));

/** A list of coupons, as the API answers it. */
export const couponListSerializer = fromResponse(raw => compact(arr(raw).map(couponSerializer)));

/** A page of inventoryRows, as the API answers it. */
export const inventoryRowPageSerializer = fromResponse(raw => paged(raw, inventoryRowSerializer));

/** A list of inventoryRows, as the API answers it. */
export const inventoryRowListSerializer = fromResponse(raw => compact(arr(raw).map(inventoryRowSerializer)));

/** A list of movements, as the API answers it. */
export const movementListSerializer = fromResponse(raw => compact(arr(raw).map(movementSerializer)));

/** A page of the store's orders, with each segment's count. */
export const partnerOrderPageSerializer = fromResponse(raw => ({
    ...paged(raw, partnerOrderRowSerializer),
    segmentCounts: isObject(raw) && isObject(raw.segmentCounts)
      ? (Object.fromEntries(Object.entries(raw.segmentCounts).map(([k, v]) => [k, Math.max(0, Math.round(num(v)))])) as Record<
          PartnerOrderSegment,
          number
        >)
      : null,
  }));
