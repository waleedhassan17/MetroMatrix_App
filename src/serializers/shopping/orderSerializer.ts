// MetroMatrix — Orders, order groups and returns serializers.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type {
  CourierKey,
  OrderEvent,
  OrderEventType,
  OrderGroup,
  OrderGroupSummary,
  OrderItem,
  OrderStatus,
  PaymentAccountKind,
  PaymentInstructions,
  PaymentMethod,
  PaymentProof,
  PaymentStatus,
  ReturnReason,
  ReturnRequest,
  ReturnStatus,
  Shipment,
  StoreOrder,
} from '../../types/shopping';
import { arr, bool, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { addressSerializer } from '../addressSerializer';
import { color, compact, count, iso, isoOrNull, money, storeRefSerializer, BRAND_FALLBACK, paged } from './common';
import { courierName } from '../../models/shopping/orderStatusModel';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'cancellation_requested',
  'returned',
];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'cod_pending',
  'awaiting_transfer',
  'proof_submitted',
  'proof_rejected',
  'paid',
  'cash_collected',
  'refunded',
];
const EVENT_TYPES: readonly OrderEventType[] = [
  ...ORDER_STATUSES,
  'payment_proof_submitted',
  'payment_confirmed',
  'payment_rejected',
  'cash_collected',
  'return_requested',
];
const METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];
const COURIERS: readonly CourierKey[] = ['tcs', 'leopards', 'mnp', 'postex', 'trax', 'own_rider', 'other'];
const ACCOUNT_KINDS: readonly PaymentAccountKind[] = ['raast', 'jazzcash', 'easypaisa', 'bank'];

const eventSerializer = (raw: unknown): OrderEvent | null => {
  if (!isObject(raw)) return null;
  const type = oneOf(raw.type, EVENT_TYPES, null);
  return type ? { type, note: strOrNull(raw.note), createdAt: iso(raw.createdAt) } : null;
};

const shipmentSerializer = (raw: unknown): Shipment | null => {
  if (!isObject(raw)) return null;
  const courier = oneOf(raw.courier, COURIERS, 'other');
  const trackingRef = str(raw.trackingRef);
  if (!trackingRef) return null;
  return { courier, courierName: str(raw.courierName, courierName(courier)), trackingRef };
};

export const orderItemSerializer = (raw: unknown): OrderItem | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const quantity = Math.max(1, count(raw.quantity));
  const unitPrice = money(raw.unitPrice);
  return {
    id,
    productId: str(raw.productId),
    variantId: str(raw.variantId),
    name: str(raw.name, 'Item'),
    variantLabel: str(raw.variantLabel),
    imageUrl: strOrNull(raw.imageUrl),
    unitPrice,
    quantity,
    lineTotal: money(raw.lineTotal, unitPrice * quantity),
    reviewed: bool(raw.reviewed),
    returnableQuantity: Math.min(quantity, count(raw.returnableQuantity)),
  };
};

export const instructionsSerializer = (raw: unknown): PaymentInstructions | null => {
  if (!isObject(raw)) return null;
  const accountNumber = str(raw.accountNumber);
  if (!accountNumber) return null;
  return {
    kind: oneOf(raw.kind, ACCOUNT_KINDS, 'bank'),
    accountTitle: str(raw.accountTitle),
    accountNumber,
    bankName: strOrNull(raw.bankName),
    amount: money(raw.amount),
    payBy: iso(raw.payBy),
  };
};

export const proofSerializer = (raw: unknown): PaymentProof | null => {
  if (!isObject(raw) || !str(raw.transactionId)) return null;
  return {
    transactionId: str(raw.transactionId),
    imageUrl: strOrNull(raw.imageUrl),
    submittedAt: iso(raw.submittedAt),
    rejectionReason: strOrNull(raw.rejectionReason),
  };
};

export const storeOrderSerializer = (raw: unknown): StoreOrder | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const store = storeRefSerializer(raw.store);
  if (!id || !store) return null;
  return {
    id,
    code: str(raw.code, id),
    groupCode: str(raw.groupCode),
    store,
    status: oneOf(raw.status, ORDER_STATUSES, 'placed'),
    paymentMethod: oneOf(raw.paymentMethod, METHODS, 'cod'),
    paymentStatus: oneOf(raw.paymentStatus, PAYMENT_STATUSES, 'cod_pending'),
    items: compact(arr(raw.items).map(orderItemSerializer)),
    itemsTotal: money(raw.itemsTotal),
    shippingFee: money(raw.shippingFee),
    discount: money(raw.discount),
    total: money(raw.total),
    couponCode: strOrNull(raw.couponCode),
    note: strOrNull(raw.note),
    shipment: shipmentSerializer(raw.shipment),
    events: compact(arr(raw.events).map(eventSerializer)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    paymentInstructions: instructionsSerializer(raw.paymentInstructions),
    paymentProof: proofSerializer(raw.paymentProof),
    returnWindowEndsAt: isoOrNull(raw.returnWindowEndsAt),
    cancelReason: strOrNull(raw.cancelReason),
    createdAt: iso(raw.createdAt),
    deliveredAt: isoOrNull(raw.deliveredAt),
    canCancel: bool(raw.canCancel),
    canRequestCancel: bool(raw.canRequestCancel),
    canConfirmReceived: bool(raw.canConfirmReceived),
    canReturn: bool(raw.canReturn),
    canReview: bool(raw.canReview),
  };
};

export const orderGroupSerializer = fromResponse((raw: unknown): OrderGroup | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  const address = addressSerializer(raw.address);
  const orders = compact(arr(raw.orders).map(storeOrderSerializer));
  if (!code || !address || !orders.length) return null;
  return {
    code,
    createdAt: iso(raw.createdAt),
    address,
    orders,
    itemsTotal: money(raw.itemsTotal),
    shippingTotal: money(raw.shippingTotal),
    discountTotal: money(raw.discountTotal),
    total: money(raw.total),
  };
});

export const orderGroupSummarySerializer = (raw: unknown): OrderGroupSummary | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  if (!code) return null;
  const orders = arr(raw.orders)
    .filter(isObject)
    .map(o => ({
      status: oneOf(o.status, ORDER_STATUSES, 'placed'),
      paymentStatus: oneOf(o.paymentStatus, PAYMENT_STATUSES, 'cod_pending'),
      paymentMethod: oneOf(o.paymentMethod, METHODS, 'cod'),
    }));
  if (!orders.length) return null;
  return {
    code,
    createdAt: iso(raw.createdAt),
    total: money(raw.total),
    itemCount: count(raw.itemCount),
    stores: arr(raw.stores)
      .filter(isObject)
      .map(s => ({ name: str(s.name, 'Store'), logoUrl: strOrNull(s.logoUrl), brandColor: color(s.brandColor, BRAND_FALLBACK.brand) })),
    thumbnails: arr(raw.thumbnails).map(t => str(t)).filter(Boolean),
    orders,
  };
};

const RETURN_STATUSES: readonly ReturnStatus[] = ['requested', 'approved', 'rejected', 'received', 'refunded'];
const RETURN_REASONS: readonly ReturnReason[] = ['size_issue', 'damaged', 'wrong_item', 'not_as_described', 'changed_mind'];

export const returnSerializer = fromResponse((raw: unknown): ReturnRequest | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const refund = isObject(raw.refund) && str(raw.refund.reference)
    ? { amount: money(raw.refund.amount), reference: str(raw.refund.reference), recordedAt: iso(raw.refund.recordedAt) }
    : null;
  return {
    id,
    orderId: str(raw.orderId),
    orderCode: str(raw.orderCode),
    storeName: str(raw.storeName),
    status: oneOf(raw.status, RETURN_STATUSES, 'requested'),
    reason: oneOf(raw.reason, RETURN_REASONS, 'changed_mind'),
    details: str(raw.details),
    photos: arr(raw.photos).map(p => str(p)).filter(Boolean),
    items: arr(raw.items)
      .filter(isObject)
      .map(i => ({
        orderItemId: str(i.orderItemId),
        name: str(i.name, 'Item'),
        variantLabel: str(i.variantLabel),
        imageUrl: strOrNull(i.imageUrl),
        quantity: Math.max(1, count(i.quantity)),
        unitPrice: money(i.unitPrice),
      })),
    storeNote: strOrNull(raw.storeNote),
    refund,
    createdAt: iso(raw.createdAt),
    customerName: str(raw.customerName, 'Customer'),
  };
});

/** A page of orderGroupSummarys, as the API answers it. */
export const orderGroupSummaryPageSerializer = fromResponse(raw => paged(raw, orderGroupSummarySerializer));

/** A page of returns, as the API answers it. */
export const returnPageSerializer = fromResponse(raw => paged(raw, returnSerializer));
