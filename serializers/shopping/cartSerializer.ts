// MetroMatrix — Bag and checkout-preview serializers, from the real API's
// CartView and CheckoutPlan (docs/API_SHOPPING.md §2). Totals are the server's.

import type {
  ApiIssue,
  AvailableCoupon,
  Cart,
  CartGroup,
  CartLine,
  CartWarning,
  CartWarningCode,
  CheckoutPreview,
  PaymentMethod,
  PaymentOption,
  PreviewStore,
} from '../../models/shopping';
import { formatPKR } from '../../utils/money/money';
import { arr, bool, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { compact, count, isoOrNull, money, moneyOrNull, storeRefSerializer } from './common';

const METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];

/** The API's line and store warning codes → the app's (a store that can't sell now is "paused"). */
const WARNING_CODE: Record<string, CartWarningCode> = {
  PRICE_CHANGED: 'PRICE_CHANGED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PRODUCT_UNAVAILABLE: 'OUT_OF_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  STORE_UNAVAILABLE: 'STORE_PAUSED',
};

const warningSerializer = (raw: unknown, lineId: string | null): CartWarning | null => {
  if (!isObject(raw)) return null;
  const code = WARNING_CODE[str(raw.code)];
  if (!code) return null;
  const d = isObject(raw.details) ? raw.details : {};
  return {
    code,
    message: str(raw.message),
    lineId,
    previousPrice: moneyOrNull(d.was),
    currentPrice: moneyOrNull(d.now),
    available: code === 'OUT_OF_STOCK' ? 0 : d.available === null || d.available === undefined ? null : count(d.available),
  };
};

/** A CartView line (`items[]`), or a CheckoutPlan line (`cartItemId`). */
export const cartLineSerializer = (raw: unknown): CartLine | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id) || str(raw.cartItemId);
  if (!id) return null;
  const quantity = Math.max(1, count(raw.quantity));
  const unitPrice = Math.max(0, money(raw.unitPrice));
  return {
    id,
    productId: str(raw.productId),
    variantId: str(raw.variantId),
    name: str(raw.productName, 'Item'),
    variantLabel: str(raw.variantLabel),
    imageUrl: strOrNull(raw.imageUrl),
    unitPrice,
    quantity,
    lineTotal: Math.max(0, money(raw.lineTotal, unitPrice * quantity)),
    // `maxQuantity` is what the line can hold now (stock, and 20 a line).
    available: raw.maxQuantity === undefined ? quantity : bool(raw.inStock, true) ? count(raw.maxQuantity) : 0,
    warnings: compact(arr(raw.warnings).map(w => warningSerializer(w, id))),
  };
};

const cartGroupSerializer = (raw: unknown): CartGroup | null => {
  if (!isObject(raw)) return null;
  const store = storeRefSerializer(raw.store);
  if (!store) return null;
  const lines = compact(arr(raw.items).map(cartLineSerializer));
  if (!lines.length) return null;
  const freeShippingOver = moneyOrNull(raw.freeShippingOver);
  return {
    store,
    isPaused: !bool(raw.isAvailable, true),
    lines,
    subtotal: money(raw.subtotal),
    shippingFee: Math.max(0, money(raw.shippingFee)),
    freeShippingOver,
    toFreeShipping: freeShippingOver === null ? null : Math.max(0, money(raw.amountToFreeShipping)),
    warnings: compact(arr(raw.warnings).map(w => warningSerializer(w, null))),
  };
};

export const EMPTY_CART: Cart = { groups: [], itemCount: 0, itemsTotal: 0, shippingTotal: 0, total: 0, blocking: false };

/** GET /shop/cart and every cart write: `{ stores: [{ store, items, … }], itemCount, grandTotal, hasWarnings, … }`. */
export const cartSerializer = fromResponse((raw: unknown): Cart => {
  if (!isObject(raw)) return EMPTY_CART;
  const groups = compact(arr(raw.stores).map(cartGroupSerializer));
  return {
    groups,
    itemCount: count(raw.itemCount) || groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.quantity, 0), 0),
    itemsTotal: money(raw.itemsTotal),
    shippingTotal: money(raw.shippingTotal),
    total: money(raw.grandTotal),
    blocking: bool(raw.hasWarnings),
  };
});

const issueSerializer = (raw: unknown): ApiIssue | null =>
  isObject(raw) && str(raw.code) ? { code: str(raw.code), message: str(raw.message, 'Something is not right here.') } : null;

/** The API's store issues, in the words the checkout screen branches on. */
const STORE_ERROR: Record<string, string> = {
  STORE_UNAVAILABLE: 'STORE_PAUSED',
  DELIVERY_UNAVAILABLE: 'CITY_NOT_SERVED',
  PAYMENT_METHOD_UNAVAILABLE: 'NO_PAYMENT_METHOD',
  COD_LIMIT_EXCEEDED: 'NO_PAYMENT_METHOD',
  OUT_OF_STOCK: 'BAG_NEEDS_ATTENTION',
};

const previewStoreSerializer = (raw: unknown): PreviewStore | null => {
  if (!isObject(raw)) return null;
  const store = storeRefSerializer({ id: raw.storeId, slug: raw.storeSlug, name: raw.storeName });
  if (!store) return null;
  const lines = compact(arr(raw.items).map(cartLineSerializer));
  const issues = compact(arr(raw.issues).map(issueSerializer));
  const method = oneOf(raw.paymentMethod, METHODS, 'cod');
  const couponError = issues.find(i => i.code.startsWith('COUPON_')) ?? null;
  const codIssue = issues.find(i => i.code === 'COD_LIMIT_EXCEEDED' || (method === 'cod' && i.code === 'PAYMENT_METHOD_UNAVAILABLE')) ?? null;
  // The plan checks only the chosen method (`transferVia` is empty on a cash plan), so transfer reads as open
  // until a plan for it says otherwise.
  const transferIssue = method === 'transfer' ? (issues.find(i => i.code === 'PAYMENT_METHOD_UNAVAILABLE') ?? null) : null;
  const paymentOptions: PaymentOption[] = [
    { method: 'cod', available: !codIssue, reason: codIssue?.message ?? null },
    { method: 'transfer', available: !transferIssue, reason: transferIssue?.message ?? null },
  ];
  const blocking = issues.find(i => !i.code.startsWith('COUPON_')) ?? null;
  return {
    store,
    lineCount: lines.length,
    lines,
    itemsTotal: money(raw.subtotal),
    shippingFee: Math.max(0, money(raw.shippingFee)),
    discount: Math.max(0, money(raw.discount)),
    total: money(raw.total),
    couponCode: strOrNull(raw.couponCode),
    couponError,
    paymentOptions,
    paymentMethod: method,
    error: blocking ? { code: STORE_ERROR[blocking.code] ?? blocking.code, message: blocking.message } : null,
    // The plan doesn't say how long a store takes to dispatch (its store page does).
    dispatchMinDays: count(raw.dispatchDaysMin),
    dispatchMaxDays: count(raw.dispatchDaysMax),
  };
};

/** POST /shop/cart/preview: the CheckoutPlan (`ok`, `issues`, `stores`, `totals`). */
export const checkoutPreviewSerializer = fromResponse((raw: unknown): CheckoutPreview => {
  const r = isObject(raw) ? raw : {};
  const stores = compact(arr(r.stores).map(previewStoreSerializer));
  const t = isObject(r.totals) ? r.totals : {};
  return {
    stores,
    itemsTotal: money(t.itemsTotal),
    shippingTotal: money(t.shippingTotal),
    discountTotal: Math.max(0, money(t.discountTotal)),
    total: money(t.grandTotal),
    canPlace: bool(r.ok) && stores.length > 0 && stores.every(s => !s.error && !s.couponError),
  };
});

const couponLabel = (c: Record<string, unknown>): string => {
  const value = count(c.value);
  const cap = moneyOrNull(c.maxDiscount);
  if (str(c.type) === 'percent') return cap ? `${value}% off, up to ${formatPKR(cap)}` : `${value}% off`;
  return `${formatPKR(value)} off`;
};

export const availableCouponSerializer = (raw: unknown): AvailableCoupon | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  if (!code) return null;
  return { code, label: couponLabel(raw), minOrder: moneyOrNull(raw.minOrder) || null, endsAt: isoOrNull(raw.endsAt), shortBy: Math.max(0, money(raw.shortBy)) };
};

/** GET /shop/stores/:storeId/coupons/available: `{ storeSubtotal, items }`. */
export const availableCouponListSerializer = fromResponse(raw =>
  compact(arr(isObject(raw) ? raw.items : raw).map(availableCouponSerializer)),
);
