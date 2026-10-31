// MetroMatrix — Store-partner serializers: MetroMatrix-API's /shop/partner
// shapes (API_SHOPPING.md) in the app's words.

import type {
  Coupon,
  CouponStatus,
  CouponType,
  Insights,
  InsightsRange,
  InventoryMovement,
  InventoryRow,
  MovementReason,
  PartnerOrderAction,
  PartnerOrderDetail,
  PartnerOrderRow,
  PartnerProduct,
  PartnerProductRow,
  PartnerProductStatus,
  PartnerReview,
  PartnerSummary,
  PaymentAccount,
  PaymentAccountKind,
  StoreProfile,
  StoreSettings,
} from '../../models/shopping';
import { arr, bool, bodiesOf, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { LOW_STOCK, reviewSerializer } from './catalogSerializer';
import { BRAND_FALLBACK, color, compact, count, iso, isoOrNull, money, moneyOrNull, paged } from './common';
import { orderStatusOf, paymentStatusOf, storeOrderSerializer } from './orderSerializer';
import { COD_NO_LIMIT } from '../../models/shopping/storeModel';

const PRODUCT_STATUSES: readonly PartnerProductStatus[] = ['draft', 'active', 'archived'];
const ACCOUNT_KINDS: readonly PaymentAccountKind[] = ['raast', 'jazzcash', 'easypaisa', 'bank'];
const METHODS = ['cod', 'transfer'] as const;

const series = <K extends 'amount' | 'count'>(raw: unknown, from: string, key: K) =>
  arr(raw)
    .filter(isObject)
    .map(p => ({ date: str(p.date), [key]: key === 'amount' ? money(p[from]) : count(p[from]) }) as { date: string } & Record<K, number>)
    .filter(p => p.date);

/**
 * The Today screen, from four answers: the dashboard's counts, the store's
 * name, its pause (a setting) and a week of recorded sales (insights, 7d).
 */
export const partnerSummarySerializer = (parts: { dashboard: unknown; store: unknown; settings: unknown; insights: unknown }): PartnerSummary => {
  const raw = bodiesOf(isObject(parts) ? parts : { dashboard: null, store: null, settings: null, insights: null });
  const d = isObject(raw.dashboard) ? raw.dashboard : {};
  const store = isObject(raw.store) ? raw.store : {};
  const settings = isObject(raw.settings) ? raw.settings : {};
  const sales = isObject(d.recordedSales) ? d.recordedSales : {};
  return {
    storeName: str(store.name, 'Your store'),
    storeSlug: str(store.slug),
    isPaused: bool(settings.isPaused, bool(store.isPaused)),
    pauseMessage: strOrNull(settings.pauseMessage),
    counts: {
      newOrders: count(d.newOrders),
      toShip: count(d.toShip),
      paymentsToConfirm: count(d.awaitingPaymentConfirmation),
      refundsDue: count(d.refundsDue),
      cancelRequests: count(d.cancelRequests),
      returnsOpen: count(d.openReturns),
      lowStock: count(d.lowStockVariants),
    },
    sales7d: series(isObject(raw.insights) ? raw.insights.recordedSalesPerDay : [], 'amount', 'amount'),
    recordedSales7d: money(sales.last7Days),
  };
};

/** A pause or resume answers with the settings: the summary keeps its counts. */
export const pauseStateSerializer = fromResponse((raw: unknown) =>
  isObject(raw) && typeof raw.isPaused === 'boolean' ? { isPaused: raw.isPaused, pauseMessage: strOrNull(raw.pauseMessage) } : null,
);

export const partnerOrderRowSerializer = (raw: unknown): PartnerOrderRow | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const method = oneOf(raw.paymentMethod, METHODS, 'cod');
  return {
    id,
    code: str(raw.code, id),
    customerFirstName: str(raw.customerName, 'Customer').split(/\s+/)[0],
    itemCount: count(raw.itemCount),
    total: money(raw.total),
    status: orderStatusOf(raw),
    paymentMethod: method,
    paymentStatus: paymentStatusOf(method, raw.paymentStatus, null),
    createdAt: iso(raw.placedAt),
  };
};

/** The status moves the API offers (`can.moveTo`), as the app's actions. */
const MOVE_ACTION: Record<string, PartnerOrderAction> = { confirmed: 'confirm', packed: 'pack', shipped: 'ship', delivered: 'deliver', cancelled: 'cancel' };

/**
 * The store's view of an order. The API lists its status moves; the payment
 * steps follow from the payment state (a transfer is checked once its proof is
 * in, cash is taken after delivery, a refund is recorded when one is due), and
 * a transfer order ships only once it is paid.
 */
export const partnerOrderDetailSerializer = fromResponse((raw: unknown): PartnerOrderDetail | null => {
  const order = storeOrderSerializer(raw);
  if (!order || !isObject(raw)) return null;
  const customer = isObject(raw.customer) ? raw.customer : {};
  const where = isObject(customer.address) ? customer.address : {};
  const can = isObject(raw.can) ? raw.can : {};
  const payStatus = str(raw.paymentStatus);
  const unpaidTransfer = order.paymentMethod === 'transfer' && payStatus !== 'paid';
  const moves = arr(can.moveTo).map(m => MOVE_ACTION[str(m)]).filter((a): a is PartnerOrderAction => !!a);
  const allowed: PartnerOrderAction[] = [];
  if (order.status === 'cancellation_requested' && moves.includes('cancel')) allowed.push('approve_cancellation');
  allowed.push(...moves.filter(a => !(a === 'ship' && unpaidTransfer)));
  if (payStatus === 'proof_submitted') allowed.push('confirm_payment', 'reject_payment');
  if (order.paymentMethod === 'cod' && payStatus === 'cod_pending' && order.status === 'delivered') allowed.push('cash_collected');
  if (payStatus === 'refund_due') allowed.push('refund');
  const name = str(customer.name, 'Customer');
  const phone = str(customer.phone);
  const lat = where.lat === null || where.lat === undefined ? null : num(where.lat, NaN);
  const lng = where.lng === null || where.lng === undefined ? null : num(where.lng, NaN);
  return {
    ...order,
    customer: { name, phone },
    address: {
      id: '',
      label: 'home',
      fullName: name,
      phone,
      city: str(where.city),
      area: str(where.area),
      line1: str(where.line1),
      landmark: strOrNull(where.landmark),
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lng: lng !== null && Number.isFinite(lng) ? lng : null,
      isDefault: false,
    },
    allowedActions: allowed,
    shipBlockedReason: moves.includes('ship') && unpaidTransfer ? 'Confirm the customer’s transfer before you ship.' : null,
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
    price: money(raw.basePrice ?? raw.price),
    salePrice: moneyOrNull(raw.salePrice),
    imageUrl: strOrNull(raw.coverUrl),
    totalStock: count(raw.totalStock),
    variantCount: count(raw.variantCount),
    lowStock: bool(raw.lowStock),
    updatedAt: iso(raw.updatedAt),
  };
};

/** Distinct option values in variant order. */
const valuesOf = (variants: Record<string, unknown>[], key: 'option1' | 'option2') => [
  ...new Set(variants.map(v => str(v[key])).filter(Boolean)),
];

/** The API names no options: option 1 is the size, option 2 the colour (with each variant's swatch). */
export const partnerProductSerializer = fromResponse((raw: unknown): PartnerProduct | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const variants = arr(raw.variants).filter(isObject);
  const sizes = valuesOf(variants, 'option1');
  const colours = valuesOf(variants, 'option2');
  const swatches: Record<string, string> = {};
  for (const v of variants) {
    const c = color(v.colorHex, '');
    if (c && str(v.option2)) swatches[str(v.option2)] = c;
  }
  return {
    id,
    name: str(raw.name),
    description: str(raw.description),
    categoryId: strOrNull(raw.categoryId),
    collectionId: strOrNull(raw.collectionId),
    price: money(raw.basePrice ?? raw.price),
    salePrice: moneyOrNull(raw.salePrice),
    status: oneOf(raw.status, PRODUCT_STATUSES, 'draft'),
    images: arr(raw.images)
      .filter(isObject)
      .sort((a, b) => num(a.sort) - num(b.sort))
      .map(i => ({ url: str(i.url), publicId: str(i.publicId) }))
      .filter(i => i.url),
    option1: sizes.length ? { name: 'Size', values: sizes } : null,
    option2: colours.length ? { name: 'Colour', values: colours, swatches } : null,
    variants: variants.map(v => ({
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
    variantLabel: str(raw.label),
    sku: str(raw.sku),
    stock: count(raw.stock),
    lowStock: bool(raw.lowStock),
    imageUrl: strOrNull(raw.imageUrl),
  };
});

/** A stock write answers `{ variantId, stock }` (a bulk one, `{ items: [those] }`); low is the API's 3 or fewer. */
export const stockLevelSerializer = (raw: unknown): { variantId: string; stock: number; lowStock: boolean } | null => {
  if (!isObject(raw) || !str(raw.variantId)) return null;
  const stock = count(raw.stock);
  return { variantId: str(raw.variantId), stock, lowStock: stock <= LOW_STOCK };
};
export const stockLevelResponseSerializer = fromResponse(stockLevelSerializer);
export const stockLevelListSerializer = fromResponse(raw => compact(arr(isObject(raw) ? raw.items : raw).map(stockLevelSerializer)));

const MOVEMENT_REASONS: readonly MovementReason[] = ['manual', 'bulk', 'order', 'cancel', 'return_restock'];

export const movementSerializer = (raw: unknown): InventoryMovement | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    delta: Math.round(num(raw.delta)),
    stockAfter: count(raw.balanceAfter),
    reason: oneOf(raw.reason, MOVEMENT_REASONS, 'manual'),
    note: null,
    createdAt: iso(raw.createdAt),
  };
};

const COUPON_TYPES: readonly CouponType[] = ['percent', 'fixed'];
/** The API's coupon states; one used up is "exhausted" there. */
const COUPON_STATE: Record<string, CouponStatus> = { active: 'active', scheduled: 'scheduled', expired: 'expired', exhausted: 'used_up', inactive: 'inactive' };

export const couponSerializer = fromResponse((raw: unknown): Coupon | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const code = str(raw.code);
  if (!id || !code) return null;
  const limit = raw.usageLimit === null || raw.usageLimit === undefined ? null : count(raw.usageLimit);
  return {
    id,
    code,
    type: oneOf(raw.type, COUPON_TYPES, 'fixed'),
    value: count(raw.value),
    minOrder: money(raw.minOrder) || null,
    maxDiscount: moneyOrNull(raw.maxDiscount),
    startsAt: iso(raw.startsAt),
    endsAt: isoOrNull(raw.endsAt),
    usageLimit: limit || null,
    perCustomerLimit: count(raw.perUserLimit) || null,
    usedCount: count(raw.usedCount),
    isActive: bool(raw.isActive, true),
    status: COUPON_STATE[str(raw.state)] ?? 'inactive',
  };
});

export const partnerReviewSerializer = fromResponse((raw: unknown): PartnerReview | null => {
  const review = reviewSerializer(raw);
  if (!review || !isObject(raw)) return null;
  return { ...review, productName: str(raw.productName, 'Product'), productImage: strOrNull(raw.productImage) };
});

const RANGES: readonly InsightsRange[] = ['7d', '30d', '90d'];
const pct = (share: unknown) => Math.min(100, Math.round(Math.max(0, num(share)) * 100));

export const insightsSerializer = fromResponse((raw: unknown): Insights => {
  const r = isObject(raw) ? raw : {};
  const totals = isObject(r.totals) ? r.totals : {};
  return {
    range: oneOf(r.range, RANGES, '7d'),
    orders: series(r.ordersPerDay, 'orders', 'count'),
    sales: series(r.recordedSalesPerDay, 'amount', 'amount'),
    recordedSales: money(totals.recordedSales),
    orderCount: count(totals.orders),
    topProducts: arr(r.topProducts)
      .filter(isObject)
      .map(p => ({
        productId: str(p.productId),
        name: str(p.name, 'Product'),
        imageUrl: strOrNull(p.imageUrl),
        units: count(p.units),
        amount: money(p.value),
      }))
      .filter(p => p.productId),
    repeatCustomerPct: pct(isObject(r.repeatCustomers) ? r.repeatCustomers.share : 0),
    deliveredRatePct: pct(isObject(r.conversion) ? r.conversion.rate : 0),
  };
});

/** The store's profile; WhatsApp is one of its links, and there is no public phone. */
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
    whatsapp: strOrNull(s.whatsapp),
  };
});

/** No delivery cities is nationwide; the API's top cash limit reads as none. */
export const storeSettingsSerializer = fromResponse((raw: unknown): StoreSettings => {
  const r = isObject(raw) ? raw : {};
  const min = count(r.dispatchDaysMin);
  const cities = arr(r.deliveryCities).map(c => str(c)).filter(Boolean);
  const codLimit = moneyOrNull(r.codLimit);
  return {
    shippingFee: Math.max(0, money(r.shippingFlatFee)),
    freeShippingOver: moneyOrNull(r.freeShippingOver),
    nationwide: cities.length === 0,
    deliveryCities: cities,
    dispatchMinDays: min,
    dispatchMaxDays: Math.max(min, count(r.dispatchDaysMax)),
    returnWindowDays: count(r.returnWindowDays),
    codEnabled: bool(r.codEnabled, true),
    codLimit: codLimit === null || codLimit >= COD_NO_LIMIT ? null : codLimit,
    isPaused: bool(r.isPaused),
    pauseMessage: strOrNull(r.pauseMessage),
  };
});

export const paymentAccountSerializer = fromResponse((raw: unknown): PaymentAccount | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const number = str(raw.accountNumber);
  if (!id || !number) return null;
  return {
    id,
    kind: oneOf(raw.kind, ACCOUNT_KINDS, 'bank'),
    title: str(raw.accountTitle),
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

/** The store's coupons (one page holds them all). */
export const couponListSerializer = fromResponse(raw => compact(arr(isObject(raw) ? raw.items : raw).map(couponSerializer)));

/** A page of inventoryRows, as the API answers it. */
export const inventoryRowPageSerializer = fromResponse(raw => paged(raw, inventoryRowSerializer));

/** A variant's movements, newest first. */
export const movementListSerializer = fromResponse(raw => compact(arr(isObject(raw) ? raw.items : raw).map(movementSerializer)));

/** A page of the store's orders. */
export const partnerOrderPageSerializer = fromResponse(raw => paged(raw, partnerOrderRowSerializer));
