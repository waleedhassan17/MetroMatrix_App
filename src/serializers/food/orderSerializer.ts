// ═══════════════════════════════════════════════════════
// MetroMatrix — Food ordering serializers
// ═══════════════════════════════════════════════════════
// The bag, the preview, an order (customer and vendor views), tracking, the
// vendor's board cards and promotions → the app's shapes (types/food.ts).
// docs/API_FOOD.md §2 (Cart, Preview, CustomerOrder, BoardCard, Tracking,
// Slots), §3 and §4.2–4.3.

import type {
  BoardCard,
  EtaRange,
  FoodCart,
  FoodCartLine,
  FoodCartVendor,
  FoodFulfilment,
  FoodIssue,
  FoodOrder,
  FoodOrderRider,
  FoodOrderStatus,
  FoodOrderSummary,
  FoodPaymentMethod,
  FoodPaymentStatus,
  FoodPreview,
  FoodPromotion,
  FoodScheduled,
  FoodSlots,
  FoodTotals,
  FoodTracking,
  FoodTransferAccount,
  VendorFoodOrder,
  PromotionKind,
  PromotionState,
} from '../../types/food';
import type { Paged } from '../../types/payments';
import { arr, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';

export const FOOD_ORDER_STATUSES: readonly FoodOrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'picked_up', 'rejected', 'auto_rejected', 'cancelled'];
export const FOOD_PAYMENT_STATUSES: readonly FoodPaymentStatus[] = ['cod_pending', 'unpaid', 'awaiting_transfer', 'proof_submitted', 'paid', 'void', 'refund_due', 'refunded'];
export const FOOD_PAYMENT_METHODS: readonly FoodPaymentMethod[] = ['cod', 'transfer', 'pay_at_pickup', 'tiffin_plan'];
const FULFILMENTS: readonly FoodFulfilment[] = ['delivery', 'pickup'];
const PROMOTION_KINDS: readonly PromotionKind[] = ['percent_off_order', 'percent_off_items', 'flat_off', 'free_delivery'];
const PROMOTION_STATES: readonly PromotionState[] = ['live', 'scheduled', 'ended', 'inactive'];

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
const intOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const isoOrNull = (v: unknown): string | null => {
  const s = strOrNull(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null;
};
const money = (v: unknown) => Math.max(0, Math.round(num(v)));
const point = (v: unknown) => (isObject(v) && numOrNull(v.lat) !== null && numOrNull(v.lng) !== null ? { lat: Number(v.lat), lng: Number(v.lng) } : null);

export const foodIssueSerializer = (raw: unknown): FoodIssue | null =>
  isObject(raw) && str(raw.code) ? { code: str(raw.code), message: str(raw.message), details: isObject(raw.details) ? raw.details : null } : null;
const issues = (raw: unknown) => compact(arr(raw).map(foodIssueSerializer));

const etaSerializer = (raw: unknown): EtaRange => {
  const r = isObject(raw) ? raw : {};
  const min = money(r.min);
  const max = Math.max(min, money(r.max));
  return { min, max, label: str(r.label, `${min}–${max} min`) };
};

/** `{at, label, slotId}` (a bare time is taken too). */
const scheduledSerializer = (raw: unknown): FoodScheduled | null => {
  if (typeof raw === 'string') {
    const at = isoOrNull(raw);
    return at ? { at, label: '', slotId: null } : null;
  }
  if (!isObject(raw)) return null;
  const at = isoOrNull(raw.at);
  return at ? { at, label: str(raw.label), slotId: strOrNull(raw.slotId) } : null;
};

const cartVendorSerializer = (raw: unknown): FoodCartVendor | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const o = isObject(raw.openState) ? raw.openState : {};
  return {
    id: str(raw.id),
    name: str(raw.name),
    slug: str(raw.slug),
    logoUrl: strOrNull(raw.logoUrl),
    openState: { open: bool(o.open), paused: bool(o.paused), label: str(o.label) },
    acceptsDelivery: raw.acceptsDelivery !== false,
    acceptsPickup: bool(raw.acceptsPickup),
    preorderOnly: bool(raw.preorderOnly),
  };
};

const cartLineSerializer = (raw: unknown): FoodCartLine | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const v = isObject(raw.variant) && str(raw.variant.id) ? { id: str(raw.variant.id), name: str(raw.variant.name) } : null;
  return {
    id: str(raw.id),
    itemId: str(raw.itemId),
    name: str(raw.name),
    photoUrl: strOrNull(raw.photoUrl),
    variant: v,
    options: compact(arr(raw.options).map(o => (isObject(o) ? { id: str(o.id), name: str(o.name), group: str(o.group), priceDelta: money(o.priceDelta) } : null))),
    quantity: Math.max(1, Math.round(num(raw.quantity, 1))),
    unitPrice: money(raw.unitPrice),
    lineTotal: money(raw.lineTotal),
    notes: strOrNull(raw.notes),
    priceChanged: bool(raw.priceChanged),
    error: foodIssueSerializer(raw.error),
  };
};

export const foodCartSerializer = (raw: unknown): FoodCart | null => {
  if (!isObject(raw)) return null;
  const lines = compact(arr(raw.lines).map(cartLineSerializer));
  return {
    empty: raw.empty !== undefined ? bool(raw.empty) : !lines.length,
    vendor: cartVendorSerializer(raw.vendor),
    fulfilment: raw.fulfilment ? oneOf(raw.fulfilment, FULFILMENTS, 'delivery') : null,
    scheduledFor: scheduledSerializer(raw.scheduledFor),
    lines,
    itemCount: Math.max(0, Math.round(num(raw.itemCount, lines.reduce((n, l) => n + l.quantity, 0)))),
    subtotal: money(raw.subtotal),
    warnings: issues(raw.warnings),
    issues: issues(raw.issues),
  };
};

export const EMPTY_FOOD_CART: FoodCart = { empty: true, vendor: null, fulfilment: null, scheduledFor: null, lines: [], itemCount: 0, subtotal: 0, warnings: [], issues: [] };

export const foodSlotsSerializer = (raw: unknown): FoodSlots => {
  const r = isObject(raw) ? raw : {};
  return {
    timezone: str(r.timezone, 'Asia/Karachi'),
    preorderOnly: bool(r.preorderOnly),
    usesSlots: bool(r.usesSlots),
    slots: compact(
      arr(r.slots).map(x => {
        if (!isObject(x) || !str(x.slotId)) return null;
        const startsAt = isoOrNull(x.startsAt);
        const cutoffAt = isoOrNull(x.cutoffAt);
        if (!startsAt || !cutoffAt) return null;
        const remaining = Math.max(0, Math.round(num(x.remaining)));
        return { slotId: str(x.slotId), startsAt, cutoffAt, label: str(x.label), maxOrders: Math.max(0, Math.round(num(x.maxOrders))), remaining, full: x.full === undefined ? remaining === 0 : bool(x.full) };
      }),
    ),
  };
};

const totalsSerializer = (raw: unknown): FoodTotals => {
  const t = isObject(raw) ? raw : {};
  return { subtotal: money(t.subtotal), discount: money(t.discount), deliveryFee: money(t.deliveryFee), total: money(t.total) };
};

const accountSerializer = (raw: unknown): FoodTransferAccount | null =>
  isObject(raw) && str(raw.accountNumber ?? raw.number)
    ? { kind: str(raw.kind, 'bank'), title: str(raw.accountTitle ?? raw.title), number: str(raw.accountNumber ?? raw.number), bankName: strOrNull(raw.bankName) }
    : null;

export const foodPreviewSerializer = (raw: unknown): FoodPreview | null => {
  if (!isObject(raw)) return null;
  const p = isObject(raw.payment) ? raw.payment : {};
  const av = isObject(p.available) ? p.available : {};
  const deal = isObject(raw.deal) && str(raw.deal.id) ? raw.deal : null;
  return {
    ok: bool(raw.ok),
    issues: issues(raw.issues),
    warnings: issues(raw.warnings),
    vendor: cartVendorSerializer(raw.vendor),
    fulfilment: oneOf(raw.fulfilment, FULFILMENTS, 'delivery'),
    scheduledFor: scheduledSerializer(raw.scheduledFor),
    lines: compact(arr(raw.lines).map(cartLineSerializer)),
    totals: totalsSerializer(raw.totals),
    deal: deal ? { id: str(deal.id), title: str(deal.title), kind: str(deal.kind), code: strOrNull(deal.code), discount: money(deal.discount) } : null,
    minOrder: money(raw.minOrder),
    shortfall: money(raw.shortfall),
    freeDeliveryOver: intOrNull(raw.freeDeliveryOver),
    distanceKm: numOrNull(raw.distanceKm),
    eta: isObject(raw.eta) ? etaSerializer(raw.eta) : null,
    payment: {
      method: p.method ? oneOf(p.method, FOOD_PAYMENT_METHODS, 'cod') : null,
      available: { cod: bool(av.cod), transfer: bool(av.transfer), pay_at_pickup: bool(av.pay_at_pickup), tiffin_plan: false },
      codLimit: money(p.codLimit),
      accounts: compact(arr(p.accounts).map(accountSerializer)),
    },
  };
};

const riderSerializer = (raw: unknown): FoodOrderRider | null =>
  isObject(raw) && str(raw.name)
    ? {
        name: str(raw.name),
        phone: strOrNull(raw.phone),
        vehicle: strOrNull(raw.vehicle),
        step: str(raw.step, 'assigned'),
        locationLive: bool(raw.locationLive),
        lastPosition: point(raw.lastGeo),
        at: isoOrNull(raw.at),
      }
    : null;

export const foodOrderSummarySerializer = (raw: unknown): FoodOrderSummary | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  return {
    id: str(raw.id),
    code: str(raw.code),
    status: oneOf(raw.status, FOOD_ORDER_STATUSES, 'placed'),
    statusLabel: str(raw.statusLabel),
    fulfilment: oneOf(raw.fulfilment, FULFILMENTS, 'delivery'),
    vendor: { id: str(v.id), name: str(v.name), slug: str(v.slug), logoUrl: strOrNull(v.logoUrl) },
    itemCount: Math.max(0, Math.round(num(raw.itemCount))),
    total: money(raw.total),
    placedAt: isoOrNull(raw.placedAt) ?? new Date(0).toISOString(),
    scheduledFor: isoOrNull(raw.scheduledFor),
  };
};

const pageOf = <T>(raw: unknown, row: (x: unknown) => T | null): Paged<T> => {
  const r = isObject(raw) ? raw : {};
  return {
    items: compact(arr(r.items).map(row)),
    total: Math.max(0, Math.round(num(r.total))),
    page: Math.max(1, Math.round(num(r.page, 1))),
    pageSize: Math.max(1, Math.round(num(r.pageSize, 20))),
  };
};

export const foodOrdersPageSerializer = (raw: unknown) => pageOf(raw, foodOrderSummarySerializer);

const TIMESTAMPS = ['acceptedAt', 'preparingAt', 'readyAt', 'pickedUpAt', 'deliveredAt', 'cancelledAt'] as const;

const ORIGINS = ['app', 'link', 'qr', 'tiffin', 'catering'] as const;

/** Kitchen Intelligence's additions to an order (absent from the released API: the app's defaults). TODO(API_KITCHEN). */
const kitchenExtras = (raw: Record<string, unknown>): Pick<FoodOrder, 'packedPhotoUrl' | 'origin'> => {
  const o = isObject(raw.origin) ? raw.origin : {};
  return { packedPhotoUrl: strOrNull(raw.packedPhotoUrl), origin: { kind: oneOf(o.kind, ORIGINS, 'app'), ref: strOrNull(o.ref) } };
};

export const foodOrderSerializer = (raw: unknown): FoodOrder | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const v = isObject(raw.vendor) ? raw.vendor : {};
  const loc = isObject(v.location) ? v.location : {};
  const pay = isObject(raw.payment) ? raw.payment : {};
  const a = isObject(raw.address) ? raw.address : null;
  const eta = isObject(raw.eta) ? raw.eta : {};
  const ts = isObject(raw.timestamps) ? raw.timestamps : {};
  const deal = isObject(raw.deal) && str(raw.deal.id) ? raw.deal : null;
  return {
    id: str(raw.id),
    code: str(raw.code),
    status: oneOf(raw.status, FOOD_ORDER_STATUSES, 'placed'),
    statusLabel: str(raw.statusLabel),
    fulfilment: oneOf(raw.fulfilment, FULFILMENTS, 'delivery'),
    scheduledFor: isoOrNull(raw.scheduledFor),
    placedAt: isoOrNull(raw.placedAt) ?? new Date(0).toISOString(),
    acceptBy: isoOrNull(raw.acceptBy),
    vendor: {
      id: str(v.id),
      name: str(v.name),
      slug: str(v.slug),
      logoUrl: strOrNull(v.logoUrl),
      phone: strOrNull(v.phone),
      location: { addressLine: strOrNull(loc.addressLine), area: strOrNull(loc.area), city: strOrNull(loc.city), lat: numOrNull(loc.lat), lng: numOrNull(loc.lng) },
    },
    items: compact(
      arr(raw.items).map(i =>
        isObject(i)
          ? {
              id: str(i.id),
              itemId: str(i.itemId),
              name: str(i.name),
              variant: strOrNull(i.variant),
              options: compact(arr(i.options).map(o => (isObject(o) ? { name: str(o.name), group: str(o.group), priceDelta: money(o.priceDelta) } : null))),
              quantity: Math.max(1, Math.round(num(i.quantity, 1))),
              unitPrice: money(i.unitPrice),
              lineTotal: money(i.lineTotal),
              notes: strOrNull(i.notes),
            }
          : null,
      ),
    ),
    totals: totalsSerializer(raw.totals),
    deal: deal ? { id: str(deal.id), code: strOrNull(deal.code), kind: str(deal.kind), title: str(deal.title) } : null,
    payment: {
      method: oneOf(pay.method, FOOD_PAYMENT_METHODS, 'cod'),
      status: oneOf(pay.status, FOOD_PAYMENT_STATUSES, 'cod_pending'),
      payBy: isoOrNull(pay.payBy),
      accounts: Array.isArray(pay.accounts) ? compact(pay.accounts.map(accountSerializer)) : null,
      reference: strOrNull(pay.reference),
      proofUrl: strOrNull(pay.proofUrl),
      rejectedReason: strOrNull(pay.rejectedReason),
      instructions: strOrNull(pay.instructions),
    },
    address: a
      ? {
          label: strOrNull(a.label),
          fullName: strOrNull(a.fullName),
          phone: strOrNull(a.phone),
          line1: strOrNull(a.line1),
          area: strOrNull(a.area),
          city: strOrNull(a.city),
          landmark: strOrNull(a.landmark),
          building: strOrNull(a.building),
          floor: strOrNull(a.floor),
          riderInstructions: strOrNull(a.riderInstructions),
          lat: numOrNull(a.lat),
          lng: numOrNull(a.lng),
        }
      : null,
    distanceKm: numOrNull(raw.distanceKm),
    cutlery: bool(raw.cutlery),
    note: strOrNull(raw.note),
    eta: { minutes: intOrNull(eta.minutes), promisedAt: isoOrNull(eta.promisedAt) },
    rider: riderSerializer(raw.rider),
    handedToExternal: bool(raw.handedToExternal),
    codCollected: intOrNull(raw.codCollected),
    cancelledBy: strOrNull(raw.cancelledBy),
    cancelReason: strOrNull(raw.cancelReason),
    timestamps: Object.fromEntries(TIMESTAMPS.map(k => [k, isoOrNull(ts[k])])) as FoodOrder['timestamps'],
    events: compact(
      arr(raw.events).map(e =>
        isObject(e) && isoOrNull(e.at)
          ? { kind: str(e.kind), from: strOrNull(e.from), to: strOrNull(e.to), actorRole: strOrNull(e.actorRole), note: strOrNull(e.note), at: isoOrNull(e.at)! }
          : null,
      ),
    ),
    canCancel: bool(raw.canCancel),
    canReview: bool(raw.canReview),
    canReorder: bool(raw.canReorder),
    ...kitchenExtras(raw),
  };
};

/** The kitchen's view: the order, the customer's contact, the moves it can make now. */
export const vendorFoodOrderSerializer = (raw: unknown): VendorFoodOrder | null => {
  const base = foodOrderSerializer(raw);
  if (!base || !isObject(raw)) return null;
  const c = isObject(raw.customer) ? raw.customer : {};
  const a = isObject(raw.actions) ? raw.actions : {};
  return {
    ...base,
    customer: { name: str(c.name, 'Customer'), phone: strOrNull(c.phone) },
    actions: {
      status: arr(a.status).filter((x): x is FoodOrderStatus => FOOD_ORDER_STATUSES.includes(x as FoodOrderStatus)),
      payment: arr(a.payment).filter((x): x is FoodPaymentStatus => FOOD_PAYMENT_STATUSES.includes(x as FoodPaymentStatus)),
    },
  };
};

export const foodTrackingSerializer = (raw: unknown): FoodTracking | null => {
  if (!isObject(raw) || !str(raw.code)) return null;
  const eta = isObject(raw.eta) ? raw.eta : {};
  const b = isObject(raw.branch) ? raw.branch : {};
  return {
    code: str(raw.code),
    status: oneOf(raw.status, FOOD_ORDER_STATUSES, 'placed'),
    statusLabel: str(raw.statusLabel),
    fulfilment: oneOf(raw.fulfilment, FULFILMENTS, 'delivery'),
    eta: { promisedAt: isoOrNull(eta.promisedAt), minutesLeft: intOrNull(eta.minutesLeft) },
    branch: { name: str(b.name), phone: strOrNull(b.phone), lat: numOrNull(b.lat), lng: numOrNull(b.lng) },
    drop: point(raw.drop),
    rider: riderSerializer(raw.rider),
    handedToExternal: bool(raw.handedToExternal),
    updatedAt: isoOrNull(raw.updatedAt),
  };
};

export const boardCardSerializer = (raw: unknown): BoardCard | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const pay = isObject(raw.payment) ? raw.payment : {};
  return {
    id: str(raw.id),
    code: str(raw.code),
    status: oneOf(raw.status, FOOD_ORDER_STATUSES, 'placed'),
    statusLabel: str(raw.statusLabel),
    fulfilment: oneOf(raw.fulfilment, FULFILMENTS, 'delivery'),
    scheduledFor: isoOrNull(raw.scheduledFor),
    placedAt: isoOrNull(raw.placedAt) ?? new Date(0).toISOString(),
    acceptBy: isoOrNull(raw.acceptBy),
    promisedAt: isoOrNull(raw.promisedAt),
    total: money(raw.total),
    payment: { method: oneOf(pay.method, FOOD_PAYMENT_METHODS, 'cod'), status: oneOf(pay.status, FOOD_PAYMENT_STATUSES, 'cod_pending') },
    itemCount: Math.max(0, Math.round(num(raw.itemCount))),
    itemsSummary: str(raw.itemsSummary),
    customerName: strOrNull(raw.customerName),
    riderId: strOrNull(raw.riderId),
    handedToExternal: bool(raw.handedToExternal),
    ...kitchenExtras(raw),
  };
};

export const boardPageSerializer = (raw: unknown) => pageOf(raw, boardCardSerializer);

export const foodPromotionSerializer = (raw: unknown): FoodPromotion | null => {
  if (!isObject(raw) || !str(raw.id)) return null;
  const days = arr(raw.weekdays).map(d => Math.round(num(d, -1))).filter(d => d >= 0 && d <= 6);
  return {
    id: str(raw.id),
    title: str(raw.title),
    kind: oneOf(raw.kind, PROMOTION_KINDS, 'percent_off_order'),
    value: Math.max(0, num(raw.value)),
    itemIds: arr(raw.itemIds).map(x => str(x)).filter(Boolean),
    minOrder: money(raw.minOrder),
    maxDiscount: intOrNull(raw.maxDiscount),
    code: strOrNull(raw.code),
    startsAt: isoOrNull(raw.startsAt) ?? new Date(0).toISOString(),
    endsAt: isoOrNull(raw.endsAt),
    weekdays: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    timeFrom: strOrNull(raw.timeFrom)?.slice(0, 5) ?? null,
    timeTo: strOrNull(raw.timeTo)?.slice(0, 5) ?? null,
    usageLimit: intOrNull(raw.usageLimit),
    perUserLimit: intOrNull(raw.perUserLimit),
    usedCount: Math.max(0, Math.round(num(raw.usedCount))),
    firstOrderOnly: bool(raw.firstOrderOnly),
    isActive: raw.isActive !== false,
    state: oneOf(raw.state, PROMOTION_STATES, 'live'),
    label: str(raw.label, str(raw.title)),
  };
};

export const foodPromotionsSerializer = (raw: unknown): FoodPromotion[] =>
  compact(arr(isObject(raw) ? raw.items : raw).map(foodPromotionSerializer));

/** A reorder: the bag again, and how many dishes were dropped or repriced. */
export const reorderSerializer = fromResponse(raw => {
      const r = isObject(raw) ? raw : {};
      const cart = foodCartSerializer(r.cart);
      return cart ? { cart, dropped: Array.isArray(r.dropped) ? r.dropped.length : 0, priceChanges: Array.isArray(r.priceChanges) ? r.priceChanges.length : 0 } : null;
    });
