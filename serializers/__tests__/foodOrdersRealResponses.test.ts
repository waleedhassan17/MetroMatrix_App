// Real MetroMatrix-API ordering responses (captured end to end on a local
// backend: the bag, deals, preview, checkout, the kitchen's moves, a
// transfer, cancels and the customer's lists) through the Food ordering
// serializers.

import real from './fixtures/food/orders.json';
import {
  boardPageSerializer,
  foodCartSerializer,
  foodIssueSerializer,
  foodOrderSerializer,
  foodOrdersPageSerializer,
  foodPreviewSerializer,
  foodPromotionSerializer,
  foodPromotionsSerializer,
  foodTrackingSerializer,
  vendorFoodOrderSerializer,
} from '../food/orderSerializer';
import { liveRidersSerializer, riderCashSerializer, riderOrderSerializer, riderOrdersPageSerializer, riderSuggestionsSerializer } from '../food/riderSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

describe('the bag', () => {
  it('reads an empty bag', () => {
    expect(foodCartSerializer(data('cartEmpty'))).toEqual({
      empty: true,
      vendor: null,
      fulfilment: null,
      scheduledFor: null,
      lines: [],
      itemCount: 0,
      subtotal: 0,
      warnings: [],
      issues: [],
    });
  });

  it('reads a line with its size, add-ons, note and price', () => {
    const c = foodCartSerializer(data('cart'))!;
    expect(c.vendor).toMatchObject({ slug: 'karachi-biryani-house-demo', acceptsDelivery: true, acceptsPickup: true, preorderOnly: false });
    expect(c.vendor!.openState.open).toBe(true);
    expect(c.lines[0]).toMatchObject({ name: 'Chicken Biryani', variant: { name: 'Single' }, quantity: 2, unitPrice: 730, lineTotal: 1460, notes: 'Less spicy please', priceChanged: false, error: null });
    expect(c.lines[0].options[0]).toMatchObject({ name: 'Kachumber salad', group: 'Add raita or salad', priceDelta: 80 });
    expect(c.itemCount).toBe(2);
    expect(c.subtotal).toBe(1460);
  });

  it('names the other vendor when the bag holds their dishes', () => {
    expect(R.cartOtherVendorErr.status).toBe(409);
    const e = error('cartOtherVendorErr');
    expect(e.code).toBe('CART_OTHER_VENDOR');
    expect(e.details.currentVendor.name).toBe('Karachi Biryani House (demo)');
    expect(e.details.itemCount).toBe(2);
  });

  it('names the size a dish needs', () => {
    expect(foodIssueSerializer(error('cartAddErr'))).toMatchObject({ code: 'OPTION_REQUIRED', message: 'Choose a size for Chicken Biryani.', details: { group: 'Size' } });
  });

  it('takes a scheduled time as the API sends it', () => {
    const c = foodCartSerializer({ ...data('cart'), scheduledFor: { at: '2026-10-18T19:00:00.000+05:00', label: 'Sun 18 Oct · 7:00 PM', slotId: 'slot-1' } })!;
    expect(c.scheduledFor).toEqual({ at: '2026-10-18T14:00:00.000Z', label: 'Sun 18 Oct · 7:00 PM', slotId: 'slot-1' });
  });
});

describe('the preview', () => {
  it('has the totals checkout charges: subtotal, the deal, the delivery fee and nothing else', () => {
    const p = foodPreviewSerializer(data('preview'))!;
    expect(p.ok).toBe(true);
    expect(p.totals).toEqual({ subtotal: 2190, discount: 219, deliveryFee: 99, total: 2070 });
    expect(p.totals.total).toBe(p.totals.subtotal - p.totals.discount + p.totals.deliveryFee);
    expect(p.deal).toMatchObject({ title: '10% off biryani nights', kind: 'percent_off_order', code: null, discount: 219 });
    expect(p.eta).toEqual({ min: 27, max: 37, label: '27–37 min' });
    expect(p.minOrder).toBe(500);
    expect(p.freeDeliveryOver).toBe(2500);
    expect(p.distanceKm).toBe(0.7);
    // `tiffin_plan` pays tiffin days only (Kitchen Intelligence): checkout never offers it.
    expect(p.payment.available).toEqual({ cod: true, transfer: true, pay_at_pickup: false, tiffin_plan: false });
    expect(p.payment.codLimit).toBe(5000);
  });

  it('lists the vendor’s own account for a transfer', () => {
    const p = foodPreviewSerializer(data('previewTransfer'))!;
    expect(p.payment.method).toBe('transfer');
    expect(p.payment.accounts[0]).toEqual({ kind: 'jazzcash', title: 'Imran Qureshi', number: '+923001110001', bankName: null });
  });

  it('says what to fix, first problem first', () => {
    const bad = foodPreviewSerializer(data('previewBadCode'))!;
    expect(bad.ok).toBe(false);
    expect(bad.issues[0]).toMatchObject({ code: 'PROMO_INVALID', details: { code: 'NOPE' } });
    const pickup = foodPreviewSerializer(data('previewPickup'))!;
    expect(pickup.issues.map(i => i.code)).toEqual(['ADDRESS_LOCATION_REQUIRED', 'PAYMENT_METHOD_UNAVAILABLE']);
  });

  it('has no ETA for a scheduled bag', () => {
    expect(foodPreviewSerializer({ ...data('preview'), eta: null })!.eta).toBeNull();
  });
});

describe('checkout and the order', () => {
  it('needs an Idempotency-Key', () => {
    expect(R.checkoutErr.status).toBe(400);
    expect(error('checkoutErr').code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('reads the placed order: lines, money, payment, address, timeline', () => {
    const o = foodOrderSerializer(data('checkout'))!;
    expect(o.code).toMatch(/^FC-[A-Z0-9]{6}$/);
    expect(o.status).toBe('placed');
    expect(o.acceptBy).not.toBeNull();
    expect(o.vendor.location.lat).toBeCloseTo(31.51, 1);
    expect(o.items[0]).toMatchObject({ name: 'Chicken Biryani', variant: 'Single', quantity: 3, unitPrice: 730, lineTotal: 2190 });
    expect(o.totals.total).toBe(2070);
    expect(o.deal).toMatchObject({ title: '10% off biryani nights' });
    expect(o.payment).toMatchObject({ method: 'cod', status: 'cod_pending', accounts: null });
    expect(o.payment.instructions).toBe('Pay Rs 2,070 in cash when your order arrives.');
    expect(o.address).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(o.eta.minutes).toBe(37);
    expect(o.events.map(e => e.to)).toEqual(['placed']);
    expect(o).toMatchObject({ canCancel: true, canReorder: false });
  });

  it('replays the same order for the same key', () => {
    expect(foodOrderSerializer(data('checkoutReplay'))!.code).toBe(foodOrderSerializer(data('checkout'))!.code);
  });

  it('reads a transfer: the accounts, the time to pay by, then the receipt', () => {
    const t = foodOrderSerializer(data('checkoutTransfer'))!;
    expect(t.payment).toMatchObject({ method: 'transfer', status: 'awaiting_transfer' });
    expect(t.payment.payBy).not.toBeNull();
    expect(t.payment.accounts![0].number).toBe('+923001110001');
    const sent = foodOrderSerializer(data('paymentProof'))!;
    expect(sent.payment).toMatchObject({ status: 'proof_submitted', reference: 'TRX-778812' });
    expect(foodOrderSerializer(data('paymentConfirm'))!.payment.status).toBe('paid');
    expect(error('preparingUnpaidErr')).toMatchObject({ code: 'PAYMENT_NOT_CONFIRMED', details: { paymentStatus: 'proof_submitted' } });
  });

  it('reads ends: cancelled by the vendor, by the customer, declined', () => {
    expect(foodOrderSerializer(data('cancelByVendor'))).toMatchObject({ status: 'cancelled', cancelledBy: 'vendor' });
    expect(foodOrderSerializer(data('cancelByVendor'))!.payment.status).toBe('refund_due');
    expect(foodOrderSerializer(data('customerCancel'))).toMatchObject({ status: 'cancelled', cancelledBy: 'customer', cancelReason: 'Ordered by mistake' });
    const r = foodOrderSerializer(data('reject'))!;
    // The kitchen's view: reorder is the customer's.
    expect(r).toMatchObject({ status: 'rejected', cancelReason: 'too_busy', canReorder: false });
    expect(r.payment.status).toBe('void');
  });

  it('reads the customer’s lists', () => {
    const active = foodOrdersPageSerializer(data('ordersActive'));
    expect(active.items[0]).toMatchObject({ status: 'placed', itemCount: 3, total: 2070 });
    expect(active.items[0].vendor.slug).toBe('karachi-biryani-house-demo');
    expect(foodOrdersPageSerializer(data('ordersPast')).items[0].status).toBe('rejected');
  });

  it('reads tracking: the two ends and the rider', () => {
    const t = foodTrackingSerializer(data('tracking'))!;
    expect(t.eta.minutesLeft).toBe(37);
    expect(t.branch.lat).not.toBeNull();
    expect(t.drop).not.toBeNull();
    expect(t.rider).toBeNull();
    const moving = foodTrackingSerializer(data('trackingOnTheWay'))!;
    expect(moving.rider).toMatchObject({ name: 'Ali Raza', step: 'picked_up', locationLive: true, lastPosition: { lat: 31.5125, lng: 74.343 } });
  });

  it('reads a reorder back into the bag', () => {
    const r = data('reorder');
    expect(foodCartSerializer(r.cart)!.lines.length).toBeGreaterThan(0);
    expect(r.dropped).toEqual([]);
  });
});

describe('the kitchen', () => {
  it('reads the board’s cards', () => {
    const b = boardPageSerializer(data('boardNew'));
    expect(b.items[0]).toMatchObject({ status: 'placed', itemsSummary: '3× Chicken Biryani', customerName: 'Demo Patient', riderId: null, payment: { method: 'cod', status: 'cod_pending' } });
    expect(b.items[0].acceptBy).not.toBeNull();
    expect(boardPageSerializer(data('boardDone')).items[0].status).toBe('rejected');
  });

  it('reads the kitchen’s view: the customer’s contact and the moves it can make', () => {
    const v = vendorFoodOrderSerializer(data('vendorOrder'))!;
    expect(v.customer).toEqual({ name: 'Demo Patient', phone: '+923001234567' });
    expect(v.actions).toEqual({ status: ['accepted', 'rejected'], payment: [] });
    expect(vendorFoodOrderSerializer(data('accept'))!.actions.status).toEqual(['preparing', 'cancelled']);
  });

  it('reads the accept with the new ETA', () => {
    const o = foodOrderSerializer(data('accept'))!;
    expect(o.status).toBe('accepted');
    expect(o.acceptBy).toBeNull();
    expect(error('acceptErr').details.fields).toHaveProperty('etaMinutes');
  });

  it('reads deals: automatic, with a code, and the label cards show', () => {
    const list = foodPromotionsSerializer(data('vendor.promotions'));
    expect(list.length).toBeGreaterThanOrEqual(2);
    const code = foodPromotionSerializer(data('vendor.promotionCode'))!;
    expect(code).toMatchObject({ kind: 'flat_off', value: 100, code: 'BZ61064', state: 'live', label: 'Rs 100 off over Rs 1,000' });
    const auto = foodPromotionSerializer(data('vendor.promotionPost'))!;
    expect(auto).toMatchObject({ kind: 'percent_off_order', value: 10, maxDiscount: 300, code: null, weekdays: [0, 1, 2, 3, 4, 5, 6] });
    expect(error('vendor.promotionErr').details.fields).toHaveProperty('title');
  });
});

describe('riders on orders', () => {
  it('reads a delivery as the rider sees it', () => {
    const d = riderOrderSerializer(data('riderOrder'))!;
    expect(d).toMatchObject({ code: 'FC-2E5MEX', status: 'ready', riderStep: 'assigned', nextSteps: ['accepted_by_rider', 'picked_up', 'declined'], itemCount: 3, cashToCollect: 2070, note: 'Gate 2' });
    expect(d.pickup).toMatchObject({ name: 'Karachi Biryani House (demo)', lat: 31.5102 });
    expect(d.drop).toMatchObject({ riderInstructions: 'Call on arrival', lat: 31.516 });
    expect(d.items[0]).toEqual({ name: 'Chicken Biryani', variant: 'Single', options: ['Kachumber salad'], quantity: 3 });
    expect(riderOrdersPageSerializer(data('riderOrders')).items[0].code).toBe('FC-2E5MEX');
    const delivered = riderOrderSerializer(data('riderDelivered'))!;
    expect(delivered).toMatchObject({ status: 'delivered', nextSteps: [], cashToCollect: 0, codCollected: 2070 });
  });

  it('reads the cash a rider holds, the kitchen’s live riders and suggestions', () => {
    const cash = riderCashSerializer(data('riderCash'))!;
    expect(cash.balance).toBe(5210);
    expect(cash.entries[0]).toMatchObject({ kind: 'cod_collected', amount: 2070, orderCode: 'FC-2E5MEX' });
    expect(cash.entries[1]).toMatchObject({ kind: 'handover', amount: -500, note: 'Evening handover' });
    expect(riderCashSerializer(data('handover'))!.balance).toBe(4710);
    expect(liveRidersSerializer(data('ridersLive'))[0]).toMatchObject({ fullName: 'Ali Raza', onDuty: true, locationLive: false, location: null, activeOrders: [] });
    expect(riderSuggestionsSerializer(data('ridersSuggest'))[0]).toMatchObject({ fullName: 'Ali Raza', activeOrders: 0, distanceKm: null });
    expect(vendorFoodOrderSerializer(data('assign'))!.rider).toMatchObject({ name: 'Ali Raza', step: 'assigned', locationLive: false, lastPosition: null });
  });
});
