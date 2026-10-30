// The dummy Food ordering API, driven through the REAL networks: one vendor
// per bag (a new bag on request), lines that merge, the best deal and a
// typed code, totals with no fee but delivery, checkout that can't place an
// order twice, today's portions (the last one goes to one customer, and
// comes back on a cancel), pre-order times, the kitchen's moves, a transfer
// that must be confirmed before cooking, and the minute jobs (unanswered
// orders declined, unpaid transfers cancelled).

import { addToFoodCart, clearFoodCart, getFoodCart, previewFoodCart, removeFoodCartLine, setFoodCartMode, updateFoodCartLine } from '../../../food/cartNetwork';
import { cancelFoodOrder, getFoodOrder, listFoodOrders, placeFoodOrder, reorderFood, submitFoodPaymentProof } from '../../../food/ordersNetwork';
import { acceptOrder, confirmPayment, getVendorOrder, handedExternal, listBoard, markDelivered, markReady, rejectOrder, startPreparing } from '../../../food/vendor/ordersNetwork';
import { createPromotion, deactivatePromotion, deletePromotion, listPromotions } from '../../../food/vendor/promotionsNetwork';
import { getVendorPage } from '../../../food/discoveryNetwork';
import { AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import type { FoodCheckoutInput } from '../../../../types/food';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan: Biryani Bazaar is open until 3:30.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const MINUTE = 60_000;

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

const asCustomer = async () => {
  await clearTokens();
  await signInAs('customer@metromatrix.app');
};
const asVendor = async (email = 'restaurant@metromatrix.app') => {
  await clearTokens();
  await signInAs(email);
};

const biryani = (quantity = 2, notes: string | null = null) => ({
  vendorId: 'fb_resto',
  itemId: 'mi_chicken_biryani',
  variantId: 'mi_chicken_biryani_v1',
  optionIds: ['og_spice_1'],
  quantity,
  notes,
});
const checkout = (over: Partial<FoodCheckoutInput> = {}): FoodCheckoutInput => ({
  addressId: 'ad_customer_home',
  paymentMethod: 'cod',
  promoCode: null,
  cutlery: false,
  note: null,
  building: null,
  floor: null,
  riderInstructions: null,
  ...over,
});
let keyN = 0;
const key = () => `test-key-${++keyN}`;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await asCustomer();
});

describe('the bag', () => {
  it('holds one vendor at a time, and starts a new bag only when asked', async () => {
    await addToFoodCart(biryani());
    const burger = { vendorId: 'fb_cloud', itemId: 'mi_classic_smash', variantId: 'mi_classic_smash_v1', optionIds: [], quantity: 1, notes: null };
    const e = await failure(addToFoodCart(burger));
    expect(e.code).toBe('CART_OTHER_VENDOR');
    expect(e.details).toMatchObject({ currentVendor: { id: 'fb_resto', name: 'Biryani Bazaar' }, itemCount: 2 });
    const fresh = await addToFoodCart(burger, true);
    expect(fresh.vendor!.id).toBe('fb_cloud');
    expect(fresh.lines).toHaveLength(1);
  });

  it('merges the same choice into one line, keeps a different note apart', async () => {
    await addToFoodCart(biryani(1));
    let cart = await addToFoodCart(biryani(2));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
    cart = await addToFoodCart(biryani(1, 'No onions'));
    expect(cart.lines).toHaveLength(2);
    expect(cart.itemCount).toBe(4);
  });

  it('checks the size and add-ons when a dish goes in', async () => {
    const e = await failure(addToFoodCart({ ...biryani(), optionIds: [] }));
    expect(e.code).toBe('OPTION_REQUIRED');
    expect(e.details).toMatchObject({ group: 'Spice level' });
    const tooMany = await failure(addToFoodCart({ ...biryani(), optionIds: ['og_spice_1', 'og_spice_2'] }));
    expect(tooMany.code).toBe('OPTION_LIMIT');
  });

  it('changes and removes lines; the last one empties the bag', async () => {
    const cart = await addToFoodCart(biryani());
    const line = cart.lines[0].id;
    expect((await updateFoodCartLine(line, { quantity: 5 })).subtotal).toBe(5 * 650);
    expect((await removeFoodCartLine(line)).empty).toBe(true);
    expect((await getFoodCart()).empty).toBe(true);
  });

  it('switches to pickup, and refuses a time that isn’t far enough ahead', async () => {
    await addToFoodCart(biryani());
    expect((await setFoodCartMode({ fulfilment: 'pickup' })).fulfilment).toBe('pickup');
    const e = await failure(setFoodCartMode({ scheduledFor: new Date(T0 + 10 * MINUTE).toISOString() }));
    expect(e.code).toBe('SLOT_INVALID');
    expect((await getFoodCart()).scheduledFor).toBeNull();
    const later = await setFoodCartMode({ scheduledFor: new Date(T0 + 4 * 60 * MINUTE).toISOString() });
    expect(later.scheduledFor).toMatchObject({ at: new Date(T0 + 4 * 60 * MINUTE).toISOString(), label: 'Thu 15 Oct · 7:00 PM', slotId: null });
    expect((await previewFoodCart({ paymentMethod: 'pay_at_pickup' })).eta).toBeNull();
  });
});

describe('the preview', () => {
  it('charges the subtotal, less the best deal, plus the delivery fee — nothing else', async () => {
    await addToFoodCart(biryani(3));
    const p = await previewFoodCart(checkout());
    expect(p.ok).toBe(true);
    expect(p.totals.subtotal).toBe(1950);
    expect(p.deal).toMatchObject({ id: 'pr_resto_10', discount: 195 });
    expect(p.totals.total).toBe(p.totals.subtotal - p.totals.discount + p.totals.deliveryFee);
    expect(Object.keys(p.totals).sort()).toEqual(['deliveryFee', 'discount', 'subtotal', 'total']);
  });

  it('takes a typed code only when it beats the automatic deal', async () => {
    await addToFoodCart(biryani(3));
    const p = await previewFoodCart(checkout({ promoCode: 'bazaar150' }));
    // 10% of Rs 1,950 is 195, more than Rs 150 off: the customer gets the better one.
    expect(p.deal!.id).toBe('pr_resto_10');
    const bad = await previewFoodCart(checkout({ promoCode: 'NOPE' }));
    expect(bad.ok).toBe(false);
    expect(bad.issues[0]).toMatchObject({ code: 'PROMO_INVALID', details: { code: 'NOPE' } });
  });

  it('says how much more is needed for the minimum order', async () => {
    await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_naan', variantId: null, optionIds: [], quantity: 1, notes: null });
    const p = await previewFoodCart(checkout());
    const short = p.issues.find(i => i.code === 'BELOW_MIN_ORDER')!;
    expect(short.details).toMatchObject({ shortfall: p.shortfall });
    expect(p.shortfall).toBeGreaterThan(0);
  });

  it('keeps cash on delivery under the vendor’s limit', async () => {
    await addToFoodCart({ ...biryani(1), variantId: 'mi_chicken_biryani_v3', quantity: 4 });
    const p = await previewFoodCart(checkout());
    expect(p.issues.map(i => i.code)).toContain('COD_LIMIT_EXCEEDED');
    expect((await previewFoodCart(checkout({ paymentMethod: 'transfer' }))).ok).toBe(true);
  });
});

describe('checkout', () => {
  it('places the order once per key, and empties the bag', async () => {
    await addToFoodCart(biryani(3));
    const k = key();
    const first = await placeFoodOrder(checkout(), k);
    expect(first.status).toBe('placed');
    expect(first.code).toMatch(/^FC-[A-Z0-9]{6}$/);
    const again = await placeFoodOrder(checkout(), k);
    expect(again.code).toBe(first.code);
    expect((await getDb()).food.orders.filter(o => o.userId === 'u_customer')).toHaveLength(1);
    expect((await getFoodCart()).empty).toBe(true);
    expect((await listFoodOrders('active', 1, 20)).items.map(o => o.code)).toEqual([first.code]);
  });

  it('refuses with the first problem and lists them all', async () => {
    await addToFoodCart({ vendorId: 'fb_resto', itemId: 'mi_naan', variantId: null, optionIds: [], quantity: 1, notes: null });
    const e = await failure(placeFoodOrder(checkout({ promoCode: 'NOPE' }), key()));
    expect(e.code).toBe('BELOW_MIN_ORDER');
    expect((e.details as { issues: { code: string }[] }).issues.map(i => i.code)).toEqual(['BELOW_MIN_ORDER', 'PROMO_INVALID']);
    expect((await getFoodCart()).empty).toBe(false);
  });

  it('gives the last portions to one customer, and takes them back on a cancel', async () => {
    // Nani ki Handi has 6 qorma left today.
    const qorma = { vendorId: 'fb_nani', itemId: 'mi_nani_qorma', variantId: null, optionIds: [], quantity: 6, notes: null };
    expect((await failure(addToFoodCart({ ...qorma, quantity: 7 }))).code).toBe('PORTIONS_SOLD_OUT');
    await addToFoodCart(qorma);
    const left = async () => (await getDb()).food.items.find(i => i.id === 'mi_nani_qorma')!.override!.remainingToday;
    const o = await placeFoodOrder(checkout(), key());
    expect(await left()).toBe(0);
    const e = await failure(addToFoodCart({ ...qorma, quantity: 1 }));
    expect(e.code).toBe('PORTIONS_SOLD_OUT');
    await cancelFoodOrder(o.code, 'Ordered by mistake');
    expect(await left()).toBe(6);
  });

  it('counts a deal’s use, and gives it back on a cancel', async () => {
    await addToFoodCart(biryani(3));
    const used = async () => (await getDb()).food.promotions.find(p => p.id === 'pr_resto_10')!.usedCount;
    const before = await used();
    const o = await placeFoodOrder(checkout(), key());
    expect(await used()).toBe(before + 1);
    const cancelled = await cancelFoodOrder(o.code, null);
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'Cancelled by the customer', cancelledBy: 'customer' });
    expect(cancelled.payment.status).toBe('void');
    expect(await used()).toBe(before);
  });
});

describe('the order’s life', () => {
  const placed = async (paymentMethod: FoodCheckoutInput['paymentMethod'] = 'cod') => {
    await addToFoodCart(biryani(3));
    return placeFoodOrder(checkout({ paymentMethod }), key());
  };

  it('goes from new to delivered on the kitchen’s board, cash settled at the door', async () => {
    const o = await placed();
    await asVendor();
    expect((await listBoard('new')).items.map(c => c.code)).toEqual([o.code]);
    expect((await acceptOrder(o.id, 25)).status).toBe('accepted');
    await startPreparing(o.id);
    await markReady(o.id);
    expect((await handedExternal(o.id)).handedToExternal).toBe(true);
    const done = await markDelivered(o.id, null);
    expect(done).toMatchObject({ status: 'delivered', codCollected: o.totals.total });
    expect(done.payment.status).toBe('paid');
    expect((await listBoard('done')).items[0].code).toBe(o.code);
  });

  it('won’t let the customer cancel once the kitchen accepted', async () => {
    const o = await placed();
    await asVendor();
    await acceptOrder(o.id, 20);
    await asCustomer();
    const e = await failure(cancelFoodOrder(o.code, null));
    expect(e.code).toBe('INVALID_TRANSITION');
    expect(e.message).toBe('The restaurant has already accepted this order — call them to cancel.');
  });

  it('waits for a transfer to be confirmed before cooking', async () => {
    const o = await placed('transfer');
    expect(o.payment).toMatchObject({ status: 'awaiting_transfer' });
    expect(Date.parse(o.payment.payBy!) - T0).toBe(10 * MINUTE);
    await submitFoodPaymentProof(o.code, { paymentRef: 'TRX-1234', proofUrl: null });
    await asVendor();
    await acceptOrder(o.id, 30);
    expect((await failure(startPreparing(o.id))).code).toBe('PAYMENT_NOT_CONFIRMED');
    expect((await confirmPayment(o.id)).payment.status).toBe('paid');
    expect((await startPreparing(o.id)).status).toBe('preparing');
  });

  it('declines an order nobody answered in time', async () => {
    const o = await placed();
    jest.setSystemTime(T0 + 6 * MINUTE);
    const late = await getFoodOrder(o.code);
    expect(late).toMatchObject({ status: 'auto_rejected', cancelledBy: 'system', cancelReason: 'The restaurant didn’t respond in time.', canReorder: true });
    await asVendor();
    expect((await failure(acceptOrder(o.id, 20))).code).toBe('INVALID_TRANSITION');
  });

  it('cancels a transfer that wasn’t paid in time', async () => {
    const o = await placed('transfer');
    await asVendor();
    await acceptOrder(o.id, 30);
    jest.setSystemTime(T0 + 11 * MINUTE);
    const v = await getVendorOrder(o.id);
    expect(v).toMatchObject({ status: 'cancelled', cancelReason: 'The transfer wasn’t received in time.' });
    expect(v.payment.status).toBe('void');
  });

  it('a decline gives the reason; reorder fills the bag again', async () => {
    const o = await placed();
    await asVendor();
    expect((await rejectOrder(o.id, 'too_busy')).cancelReason).toBe('too_busy');
    await asCustomer();
    expect((await listFoodOrders('past', 1, 20)).items[0].status).toBe('rejected');
    const r = (await reorderFood(o.code))!;
    expect(r.cart.lines[0]).toMatchObject({ itemId: 'mi_chicken_biryani', quantity: 3 });
    expect(r.dropped).toBe(0);
    await clearFoodCart();
  });
});

describe('the vendor’s deals', () => {
  beforeEach(() => asVendor());

  it('creates an automatic deal that shows on the vendor’s page', async () => {
    const p = await createPromotion({
      title: 'Free delivery today',
      kind: 'free_delivery',
      value: 0,
      itemIds: [],
      firstOrderOnly: false,
      minOrder: 0,
      maxDiscount: null,
      code: null,
      endsAt: null,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timeFrom: null,
      timeTo: null,
      usageLimit: null,
      perUserLimit: null,
    });
    expect(p).toMatchObject({ state: 'live', label: 'Free delivery' });
    const page = await getVendorPage('biryani-bazaar', null);
    expect(page.deals.map(d => d.title)).toContain('Free delivery today');
  });

  it('refuses a clashing code, and deletes only an unused deal', async () => {
    const input = {
      title: 'Code deal',
      kind: 'flat_off' as const,
      value: 100,
      itemIds: [],
      firstOrderOnly: false,
      minOrder: 0,
      maxDiscount: null,
      code: 'BAZAAR150',
      endsAt: null,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timeFrom: null,
      timeTo: null,
      usageLimit: null,
      perUserLimit: null,
    };
    expect((await failure(createPromotion(input))).code).toBe('CONFLICT');
    const fresh = await createPromotion({ ...input, code: 'NEW100' });
    expect(await deletePromotion(fresh.id)).toBe(true);
    expect((await failure(deletePromotion('pr_resto_10'))).code).toBe('CONFLICT');
    expect((await deactivatePromotion('pr_resto_10')).state).toBe('inactive');
    expect((await listPromotions()).find(p => p.id === 'pr_resto_10')!.isActive).toBe(false);
  });
});
