// MetroMatrix — Bag and checkout-preview serializers. Totals are the server's.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

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
} from '../../types/shopping';
import { arr, bool, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { compact, count, isoOrNull, money, moneyOrNull, storeRefSerializer } from './common';

const WARNING_CODES: readonly CartWarningCode[] = ['PRICE_CHANGED', 'OUT_OF_STOCK', 'LOW_STOCK', 'STORE_PAUSED'];
const METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];

const warningSerializer = (raw: unknown): CartWarning | null => {
  if (!isObject(raw)) return null;
  const code = oneOf(raw.code, WARNING_CODES, null);
  if (!code) return null;
  return {
    code,
    message: str(raw.message),
    lineId: strOrNull(raw.lineId),
    previousPrice: moneyOrNull(raw.previousPrice),
    currentPrice: moneyOrNull(raw.currentPrice),
    available: raw.available === null || raw.available === undefined ? null : count(raw.available),
  };
};

export const cartLineSerializer = (raw: unknown): CartLine | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const quantity = Math.max(1, count(raw.quantity));
  const unitPrice = Math.max(0, money(raw.unitPrice));
  return {
    id,
    productId: str(raw.productId),
    variantId: str(raw.variantId),
    name: str(raw.name, 'Item'),
    variantLabel: str(raw.variantLabel),
    imageUrl: strOrNull(raw.imageUrl),
    unitPrice,
    quantity,
    lineTotal: Math.max(0, money(raw.lineTotal, unitPrice * quantity)),
    available: count(raw.available),
    warnings: compact(arr(raw.warnings).map(warningSerializer)),
  };
};

const cartGroupSerializer = (raw: unknown): CartGroup | null => {
  if (!isObject(raw)) return null;
  const store = storeRefSerializer(raw.store);
  if (!store) return null;
  const lines = compact(arr(raw.lines).map(cartLineSerializer));
  if (!lines.length) return null;
  return {
    store,
    isPaused: bool(raw.isPaused),
    lines,
    subtotal: money(raw.subtotal),
    shippingFee: Math.max(0, money(raw.shippingFee)),
    freeShippingOver: moneyOrNull(raw.freeShippingOver),
    toFreeShipping: moneyOrNull(raw.toFreeShipping),
    warnings: compact(arr(raw.warnings).map(warningSerializer)),
  };
};

export const EMPTY_CART: Cart = { groups: [], itemCount: 0, itemsTotal: 0, shippingTotal: 0, total: 0, blocking: false };

export const cartSerializer = fromResponse((raw: unknown): Cart => {
  if (!isObject(raw)) return EMPTY_CART;
  const groups = compact(arr(raw.groups).map(cartGroupSerializer));
  return {
    groups,
    itemCount: count(raw.itemCount) || groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.quantity, 0), 0),
    itemsTotal: money(raw.itemsTotal),
    shippingTotal: money(raw.shippingTotal),
    total: money(raw.total),
    blocking: bool(raw.blocking),
  };
});

const issueSerializer = (raw: unknown): ApiIssue | null =>
  isObject(raw) && str(raw.code) ? { code: str(raw.code), message: str(raw.message, 'Something is not right here.') } : null;

const paymentOptionSerializer = (raw: unknown): PaymentOption | null => {
  if (!isObject(raw)) return null;
  const method = oneOf(raw.method, METHODS, null);
  return method ? { method, available: bool(raw.available), reason: strOrNull(raw.reason) } : null;
};

const previewStoreSerializer = (raw: unknown): PreviewStore | null => {
  if (!isObject(raw)) return null;
  const store = storeRefSerializer(raw.store);
  if (!store) return null;
  const lines = compact(arr(raw.lines).map(cartLineSerializer));
  return {
    store,
    lineCount: count(raw.lineCount) || lines.length,
    lines,
    itemsTotal: money(raw.itemsTotal),
    shippingFee: Math.max(0, money(raw.shippingFee)),
    discount: Math.max(0, money(raw.discount)),
    total: money(raw.total),
    couponCode: strOrNull(raw.couponCode),
    couponError: issueSerializer(raw.couponError),
    paymentOptions: compact(arr(raw.paymentOptions).map(paymentOptionSerializer)),
    paymentMethod: oneOf(raw.paymentMethod, METHODS, 'cod'),
    error: issueSerializer(raw.error),
    dispatchMinDays: count(raw.dispatchMinDays),
    dispatchMaxDays: count(raw.dispatchMaxDays),
  };
};

export const checkoutPreviewSerializer = fromResponse((raw: unknown): CheckoutPreview => {
  const r = isObject(raw) ? raw : {};
  const stores = compact(arr(r.stores).map(previewStoreSerializer));
  return {
    stores,
    itemsTotal: money(r.itemsTotal),
    shippingTotal: money(r.shippingTotal),
    discountTotal: Math.max(0, money(r.discountTotal)),
    total: money(r.total),
    canPlace: bool(r.canPlace) && stores.length > 0 && stores.every(s => !s.error),
  };
});

export const availableCouponSerializer = (raw: unknown): AvailableCoupon | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  if (!code) return null;
  return { code, label: str(raw.label), minOrder: moneyOrNull(raw.minOrder), endsAt: isoOrNull(raw.endsAt), shortBy: Math.max(0, money(raw.shortBy)) };
};

/** A list of availableCoupons, as the API answers it. */
export const availableCouponListSerializer = fromResponse(raw => compact(arr(raw).map(availableCouponSerializer)));
