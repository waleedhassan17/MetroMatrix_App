// MetroMatrix — Orders, order groups and returns serializers, from the real
// API's StoreOrder, OrderGroup and ReturnRequest (docs/API_SHOPPING.md §2–§3).
// The app's own words for a few states: a cancel request on a confirmed or
// packed order reads `cancellation_requested`, a delivered order whose items
// all came back reads `returned`, and the API's `completed` (the return
// window closed) reads as delivered.

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
} from '../../models/shopping';
import { arr, bool, isObject, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { color, compact, count, iso, isoOrNull, money, storeRefSerializer, BRAND_FALLBACK, paged } from './common';
import { COURIERS, courierName } from '../../models/shopping/orderStatusModel';

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
  'refund_due',
  'refunded',
  'void',
];
const API_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'] as const;
const API_PAYMENT_STATUSES = ['cod_pending', 'awaiting_transfer', 'proof_submitted', 'paid', 'void', 'refund_due', 'refunded'] as const;
const METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];
const ACCOUNT_KINDS: readonly PaymentAccountKind[] = ['raast', 'jazzcash', 'easypaisa', 'bank'];

/** The order's status in the app's words. */
export const orderStatusOf = (raw: Record<string, unknown>): OrderStatus => {
  const status = oneOf(raw.status, API_STATUSES, 'placed');
  const items = arr(raw.items).filter(isObject);
  const allBack = items.length > 0 && items.every(i => count(i.returnedQty) >= Math.max(1, count(i.quantity)));
  if ((status === 'delivered' || status === 'completed') && allBack) return 'returned';
  if (status === 'completed') return 'delivered';
  const asked = isoOrNull(raw.cancelRequestedAt) !== null || bool(raw.cancelRequested);
  if (asked && (status === 'confirmed' || status === 'packed')) return 'cancellation_requested';
  return status;
};

/** The payment's status in the app's words (cash taken is "cash_collected", a refused proof "proof_rejected"). */
export const paymentStatusOf = (method: PaymentMethod, status: unknown, rejectedReason: unknown): PaymentStatus => {
  const s = oneOf(status, API_PAYMENT_STATUSES, method === 'cod' ? 'cod_pending' : 'awaiting_transfer');
  if (s === 'paid' && method === 'cod') return 'cash_collected';
  if (s === 'awaiting_transfer' && str(rejectedReason)) return 'proof_rejected';
  return s;
};

/** Timeline entries: status moves, payment moves and notes, oldest first. */
const eventSerializer = (raw: unknown, method: PaymentMethod): OrderEvent | null => {
  if (!isObject(raw)) return null;
  const kind = str(raw.kind);
  const to = str(raw.to);
  const from = str(raw.from);
  let type: OrderEventType | null = null;
  if (kind === 'status') type = to === 'completed' ? null : oneOf(to, ORDER_STATUSES, null);
  else if (kind === 'payment') {
    if (to === 'proof_submitted') type = 'payment_proof_submitted';
    else if (to === 'paid') type = method === 'cod' ? 'cash_collected' : 'payment_confirmed';
    else if (to === 'awaiting_transfer' && from === 'proof_submitted') type = 'payment_rejected';
    else if (to === 'refunded') type = 'refunded';
  } else if (kind === 'note' && /cancel/i.test(str(raw.note)) && str(raw.actorRole) === 'customer') type = 'cancellation_requested';
  return type ? { type, note: strOrNull(raw.note), createdAt: iso(raw.at) } : null;
};

/** `shipping: { courierName, trackingRef, riderName, riderPhone }` — "self" is the store's own rider. */
const shipmentSerializer = (raw: unknown): Shipment | null => {
  if (!isObject(raw)) return null;
  const name = str(raw.courierName);
  if (!name) return null;
  if (name.toLowerCase() === 'self') {
    const rider = [str(raw.riderName), str(raw.riderPhone)].filter(Boolean).join(' · ');
    return { courier: 'own_rider', courierName: courierName('own_rider'), trackingRef: str(raw.trackingRef, rider) };
  }
  const known = COURIERS.find(c => c.name.toLowerCase() === name.toLowerCase() || c.key === name.toLowerCase());
  const courier: CourierKey = known?.key ?? 'other';
  return { courier, courierName: known?.name ?? name, trackingRef: str(raw.trackingRef) };
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
    name: str(raw.productName, 'Item'),
    variantLabel: str(raw.variantLabel),
    imageUrl: strOrNull(raw.imageUrl),
    unitPrice,
    quantity,
    lineTotal: money(raw.lineTotal, unitPrice * quantity),
    reviewed: bool(raw.reviewed),
    returnableQuantity: Math.max(0, quantity - count(raw.returnedQty)),
  };
};

/** A transfer order's instructions: the store's first account (as it was at checkout), the total and the deadline. */
export const instructionsSerializer = (payment: unknown, total: number): PaymentInstructions | null => {
  if (!isObject(payment)) return null;
  const account = arr(payment.accounts).find(isObject);
  if (!account || !str(account.accountNumber)) return null;
  return {
    kind: oneOf(account.kind, ACCOUNT_KINDS, 'bank'),
    accountTitle: str(account.accountTitle),
    accountNumber: str(account.accountNumber),
    bankName: strOrNull(account.bankName),
    amount: total,
    payBy: iso(payment.payBy),
  };
};

/** What the customer said they sent (`paymentRef`, `proofUrl`) and why the store refused it, if it did. */
export const proofSerializer = (payment: unknown, events: unknown): PaymentProof | null => {
  if (!isObject(payment) || !str(payment.paymentRef)) return null;
  const submitted = arr(events)
    .filter(isObject)
    .filter(e => str(e.kind) === 'payment' && str(e.to) === 'proof_submitted')
    .map(e => iso(e.at))
    .pop();
  return {
    transactionId: str(payment.paymentRef),
    imageUrl: strOrNull(payment.proofUrl),
    submittedAt: submitted ?? iso(payment.paidAt),
    rejectionReason: strOrNull(payment.rejectedReason),
  };
};

/** A StoreOrder (customer view), or the store's PartnerStoreOrder. */
export const storeOrderSerializer = (raw: unknown, groupCode = ''): StoreOrder | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const store = storeRefSerializer(raw.store) ?? storeRefSerializer({ id: 'store', name: 'Store' })!;
  const method = oneOf(raw.paymentMethod, METHODS, 'cod');
  const payment = isObject(raw.payment) ? raw.payment : {};
  const can = isObject(raw.can) ? raw.can : {};
  const items = compact(arr(raw.items).map(orderItemSerializer));
  const total = money(raw.total);
  return {
    id,
    code: str(raw.code, id),
    groupCode: str(raw.groupCode, groupCode),
    store,
    status: orderStatusOf(raw),
    paymentMethod: method,
    paymentStatus: paymentStatusOf(method, raw.paymentStatus ?? payment.status, payment.rejectedReason),
    items,
    itemsTotal: money(raw.subtotal),
    shippingFee: money(raw.shippingFee),
    discount: money(raw.discount),
    total,
    couponCode: strOrNull(raw.couponCode),
    note: strOrNull(raw.customerNote),
    shipment: shipmentSerializer(raw.shipping),
    events: compact(arr(raw.events).map(e => eventSerializer(e, method))).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    paymentInstructions: method === 'transfer' ? instructionsSerializer(payment, total) : null,
    paymentProof: proofSerializer(payment, raw.events),
    returnWindowEndsAt: isoOrNull(raw.returnDeadline),
    cancelReason: strOrNull(raw.cancelReason),
    createdAt: iso(raw.placedAt),
    deliveredAt: isoOrNull(raw.deliveredAt),
    canCancel: bool(can.cancel),
    canRequestCancel: bool(can.requestCancel),
    canConfirmReceived: bool(can.markReceived),
    canReturn: bool(can.requestReturn),
    canReview: arr(raw.items).some(i => isObject(i) && bool(i.canReview)),
  };
};

/** GET /shop/store-orders/:id (and every customer order action): one StoreOrder with its `groupCode`. */
export const storeOrderResponseSerializer = fromResponse((raw: unknown) => storeOrderSerializer(raw));

/** The checkout answer and GET /shop/orders/:groupCode: the OrderGroup with its store orders. */
export const orderGroupSerializer = fromResponse((raw: unknown): OrderGroup | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  const a = isObject(raw.address) ? raw.address : null;
  const orders = compact(arr(raw.storeOrders).map(o => storeOrderSerializer(o, code)));
  if (!code || !a || !orders.length) return null;
  return {
    code,
    createdAt: iso(raw.placedAt),
    // The order keeps a snapshot of the address (it has no id of its own).
    address: {
      id: '',
      label: oneOf(a.label, ['home', 'work', 'other'] as const, 'other'),
      fullName: str(a.fullName),
      phone: str(a.phone),
      city: str(a.city),
      area: str(a.area),
      line1: str(a.line1),
      landmark: strOrNull(a.landmark),
      lat: typeof a.lat === 'number' ? a.lat : null,
      lng: typeof a.lng === 'number' ? a.lng : null,
      isDefault: false,
    },
    orders,
    itemsTotal: money(raw.itemsTotal),
    shippingTotal: money(raw.shippingTotal),
    discountTotal: money(raw.discountTotal),
    total: money(raw.grandTotal),
  };
});

/** A row of GET /shop/orders: the group, with each store order's status. */
export const orderGroupSummarySerializer = (raw: unknown): OrderGroupSummary | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  if (!code) return null;
  const rows = arr(raw.storeOrders).filter(isObject);
  const orders = rows.map(o => {
    const method = oneOf(o.paymentMethod, METHODS, 'cod');
    return { status: orderStatusOf(o), paymentStatus: paymentStatusOf(method, o.paymentStatus, null), paymentMethod: method };
  });
  if (!orders.length) return null;
  return {
    code,
    createdAt: iso(raw.placedAt),
    total: money(raw.grandTotal),
    itemCount: rows.reduce((n, o) => n + count(o.itemCount), 0),
    stores: rows.map(o => {
      const s = isObject(o.store) ? o.store : {};
      return { name: str(s.name, 'Store'), logoUrl: strOrNull(s.logoUrl), brandColor: color(s.brandColor, BRAND_FALLBACK.brand) };
    }),
    thumbnails: rows.map(o => str(o.coverImageUrl)).filter(Boolean),
    orders,
  };
};

const RETURN_STATUSES: readonly ReturnStatus[] = ['requested', 'approved', 'rejected', 'received', 'refunded'];
const RETURN_REASONS: readonly ReturnReason[] = ['size_issue', 'damaged', 'wrong_item', 'not_as_described', 'other'];

/** A ReturnRequest; `customerName` comes in the store's view only. */
export const returnSerializer = fromResponse((raw: unknown): ReturnRequest | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const store = isObject(raw.store) ? raw.store : {};
  const refundAmount = raw.refundAmount === null || raw.refundAmount === undefined ? null : money(raw.refundAmount);
  return {
    id,
    orderId: str(raw.storeOrderId),
    orderCode: str(raw.storeOrderCode),
    storeName: str(store.name),
    status: oneOf(raw.status, RETURN_STATUSES, 'requested'),
    reason: oneOf(raw.reason, RETURN_REASONS, 'other'),
    details: str(raw.details),
    photos: arr(raw.photos).map(p => str(p)).filter(Boolean),
    items: arr(raw.items)
      .filter(isObject)
      .map(i => ({
        id: str(i.id),
        orderItemId: str(i.orderItemId),
        name: str(i.productName, 'Item'),
        variantLabel: str(i.variantLabel),
        imageUrl: strOrNull(i.imageUrl),
        quantity: Math.max(1, count(i.quantity)),
        unitPrice: money(i.unitPrice),
      })),
    storeNote: strOrNull(raw.storeNote),
    refund: refundAmount !== null ? { amount: refundAmount, reference: str(raw.refundRef), recordedAt: iso(raw.refundedAt) } : null,
    createdAt: iso(raw.createdAt),
    customerName: str(raw.customerName, 'Customer'),
  };
});

/** A page of GET /shop/orders. */
export const orderGroupSummaryPageSerializer = fromResponse(raw => paged(raw, orderGroupSummarySerializer));

/** A page of returns, as the API answers it. */
export const returnPageSerializer = fromResponse(raw => paged(raw, returnSerializer));
