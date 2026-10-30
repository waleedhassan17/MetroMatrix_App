// The dummy shop API, driven through the REAL shopping networks — the server
// rules QA relies on: idempotent checkout, stock, delivery cities, coupons,
// payment before shipping, one review per item, returns and moderation.

import { listAddresses } from '../../../addresses/addressesNetwork';
import { listReports, removeReportedProduct } from '../../../admin/adminShopNetwork';
import { acknowledgeCart, addToCart, getCart } from '../../../shopping/cartNetwork';
import { getProduct } from '../../../shopping/catalogNetwork';
import { placeOrder, previewCheckout } from '../../../shopping/checkoutNetwork';
import { cancelOrder, getOrderGroup, submitPaymentProof } from '../../../shopping/ordersNetwork';
import { requestReturn } from '../../../shopping/returnsNetwork';
import { writeReview } from '../../../shopping/reviewsNetwork';
import {
  confirmOrder,
  confirmPayment,
  deliverOrder,
  packOrder,
  shipOrder,
} from '../../../shopping/partner/partnerOrdersNetwork';
import { approveReturn, receiveReturn, recordRefund } from '../../../shopping/partner/partnerReturnsNetwork';
import { createPartnerProduct, listPartnerProducts } from '../../../shopping/partner/productsNetwork';
import { pauseStore } from '../../../shopping/partner/storeNetwork';
import { ApiError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import type { CheckoutInput, ProductDetail } from '../../../../types/shopping';
import { getDb, resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const signIn = async (email: string, portal: 'customer' | 'partner' = 'customer') => {
  await clearTokens();
  await signInAs(email);
};

const signInAdmin = async () => {
  await clearTokens();
  await signInAs('admin@metromatrix.app');
};

const inStock = (p: ProductDetail) => {
  const v = p.variants.find(x => x.stock > 3);
  if (!v) throw new Error(`${p.id} has no variant in stock`);
  return v;
};

const stockOf = async (variantId: string) => {
  const db = await getDb();
  return db.shop.products.flatMap(p => p.variants).find(v => v.id === variantId)!.stock;
};

/** Fill the bag with one Lawn & Loom kurta and one pair of Volt headphones. */
const fillBag = async () => {
  const kurta = inStock(await getProduct('p_l1'));
  const phones = inStock(await getProduct('p_v1'));
  await addToCart(kurta.id, 1);
  await addToCart(phones.id, 1);
  const home = (await listAddresses()).find(a => a.city === 'Lahore')!;
  const input: CheckoutInput = {
    addressId: home.id,
    stores: [
      { storeId: 's_lawn', paymentMethod: 'cod', couponCode: null, note: null },
      { storeId: 's_volt', paymentMethod: 'transfer', couponCode: null, note: 'Ring twice' },
    ],
  };
  return { kurta, phones, input };
};

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
  await signIn('customer@metromatrix.app');
});

describe('bag → preview → checkout', () => {
  it('splits a two-store bag into one order per store and replays a retried checkout', async () => {
    const { kurta, phones, input } = await fillBag();
    const before = [await stockOf(kurta.id), await stockOf(phones.id)];

    const bag = await getCart();
    expect(bag.groups.map(g => g.store.id)).toEqual(['s_lawn', 's_volt']);
    expect(bag.blocking).toBe(false);

    const preview = await previewCheckout(input);
    expect(preview.canPlace).toBe(true);
    expect(preview.total).toBe(preview.stores.reduce((s, x) => s + x.total, 0));

    const group = await placeOrder(input, 'key-1');
    expect(group.orders).toHaveLength(2);
    expect(group.orders.map(o => o.paymentStatus).sort()).toEqual(['awaiting_transfer', 'cod_pending']);
    expect([await stockOf(kurta.id), await stockOf(phones.id)]).toEqual([before[0] - 1, before[1] - 1]);
    expect((await getCart()).groups).toHaveLength(0);

    // The same key again: the same order back, nothing placed twice.
    const db = await getDb();
    const orders = db.shop.orders.length;
    const replay = await placeOrder(input, 'key-1');
    expect(replay.code).toBe(group.code);
    expect(db.shop.orders.length).toBe(orders);
  });

  it('refuses sold-out options and reports lines that sold out before checkout', async () => {
    const bag = await getProduct('p_b7');
    expect((await failure(addToCart(bag.variants[0].id, 1))).code).toBe('OUT_OF_STOCK');

    const { kurta, input } = await fillBag();
    const db = await getDb();
    db.shop.products.flatMap(p => p.variants).find(v => v.id === kurta.id)!.stock = 0;
    const err = await failure(placeOrder(input, 'key-2'));
    expect(err.code).toBe('OUT_OF_STOCK');
    expect(err.details.lineIds).toHaveLength(1);
  });

  it('flags a price change until the customer acknowledges it', async () => {
    const { input } = await fillBag();
    const db = await getDb();
    db.shop.products.find(p => p.id === 'p_l1')!.salePrice = 6990;
    const bag = await getCart();
    expect(bag.blocking).toBe(true);
    expect(bag.groups[0].lines[0].warnings[0]).toMatchObject({ code: 'PRICE_CHANGED', previousPrice: 7190, currentPrice: 6990 });
    expect((await previewCheckout(input)).stores[0].error?.code).toBe('BAG_NEEDS_ATTENTION');

    const cleared = await acknowledgeCart([]);
    expect(cleared.blocking).toBe(false);
  });

  it('blocks stores that do not deliver to the address city', async () => {
    const { input } = await fillBag();
    const quetta = (await listAddresses()).find(a => a.city === 'Quetta')!;
    const preview = await previewCheckout({ ...input, addressId: quetta.id });
    const volt = preview.stores.find(s => s.store.id === 's_volt')!;
    expect(volt.error?.code).toBe('CITY_NOT_SERVED');
    // Lawn & Loom delivers nationwide.
    expect(preview.stores.find(s => s.store.id === 's_lawn')!.error).toBeNull();
    expect(preview.canPlace).toBe(false);
    expect((await failure(placeOrder({ ...input, addressId: quetta.id }, 'key-3'))).code).toBe('CHECKOUT_BLOCKED');
  });

  it('enforces a coupon usage limit across customers', async () => {
    const urban = (await getProduct('p_u1')).variants.filter(v => v.stock > 0);
    await addToCart(urban[0].id, 1);
    const address = (await listAddresses()).find(a => a.city === 'Lahore')!;
    const input: CheckoutInput = {
      addressId: address.id,
      stores: [{ storeId: 's_urban', paymentMethod: 'cod', couponCode: 'urban300', note: null }],
    };
    const preview = await previewCheckout(input);
    expect(preview.stores[0]).toMatchObject({ discount: 300, couponCode: 'URBAN300', couponError: null });
    await placeOrder(input, 'key-4');

    await signIn('hamza@metromatrix.app');
    await addToCart(urban[1].id, 1);
    const hamza = (await listAddresses())[0];
    const theirs = await previewCheckout({ ...input, addressId: hamza.id });
    expect(theirs.stores[0].couponError?.code).toBe('COUPON_USED_UP');
  });

  it('puts the stock back when the customer cancels', async () => {
    const { kurta, input } = await fillBag();
    const before = await stockOf(kurta.id);
    const group = await placeOrder(input, 'key-5');
    const lawn = group.orders.find(o => o.store.id === 's_lawn')!;
    expect(lawn.canCancel).toBe(true);
    const after = await cancelOrder(lawn.id, 'Ordered the wrong size');
    expect(after.orders.find(o => o.id === lawn.id)!.status).toBe('cancelled');
    expect(await stockOf(kurta.id)).toBe(before);
  });
});

describe('store partner: payment before shipping, then delivery and review', () => {
  it('walks a transfer order from placed to reviewed', async () => {
    const { input } = await fillBag();
    const group = await placeOrder(input, 'key-6');
    const order = group.orders.find(o => o.store.id === 's_volt')!;

    await signIn('volt@metromatrix.app', 'partner');
    await confirmOrder(order.id);
    await packOrder(order.id);
    const blocked = await failure(shipOrder(order.id, { courier: 'tcs', trackingRef: 'TCS123456' }));
    expect(blocked.code).toBe('PAYMENT_NOT_CONFIRMED');

    await signIn('customer@metromatrix.app');
    const sent = await submitPaymentProof(order.id, { transactionId: 'rx-99887766', imageUrl: null });
    expect(sent.orders.find(o => o.id === order.id)!.paymentStatus).toBe('proof_submitted');

    await signIn('volt@metromatrix.app', 'partner');
    await confirmPayment(order.id);
    expect((await failure(shipOrder(order.id, { courier: 'tcs', trackingRef: '' }))).code).toBe('VALIDATION_FAILED');
    const shipped = await shipOrder(order.id, { courier: 'tcs', trackingRef: 'TCS123456' });
    expect(shipped.status).toBe('shipped');
    await deliverOrder(order.id);

    await signIn('customer@metromatrix.app');
    const delivered = (await getOrderGroup(group.code)).orders.find(o => o.id === order.id)!;
    expect(delivered).toMatchObject({ status: 'delivered', canReview: true, canReturn: true });
    const item = delivered.items[0];
    await writeReview(order.id, item.id, { rating: 5, title: null, body: 'Great sound and battery.', photos: [] });
    expect((await failure(writeReview(order.id, item.id, { rating: 4, title: null, body: 'Again, again.', photos: [] }))).code).toBe(
      'ALREADY_REVIEWED',
    );
  });

  it('restocks returned items and closes the order once refunded', async () => {
    const { kurta, input } = await fillBag();
    const group = await placeOrder(input, 'key-7');
    const order = group.orders.find(o => o.store.id === 's_lawn')!;
    await signIn('store@metromatrix.app', 'partner');
    await confirmOrder(order.id);
    await packOrder(order.id);
    await shipOrder(order.id, { courier: 'leopards', trackingRef: 'LP-77881' });
    await deliverOrder(order.id);
    const afterSale = await stockOf(kurta.id);

    await signIn('customer@metromatrix.app');
    const item = (await getOrderGroup(group.code)).orders.find(o => o.id === order.id)!.items[0];
    const ret = await requestReturn(order.id, {
      reason: 'size_issue',
      details: 'The medium runs small on me.',
      photos: [],
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    expect(ret.status).toBe('requested');

    await signIn('store@metromatrix.app', 'partner');
    await approveReturn(ret.id, null);
    await receiveReturn(ret.id, { [item.id]: true });
    expect(await stockOf(kurta.id)).toBe(afterSale + 1);
    const refunded = await recordRefund(ret.id, { amount: item.unitPrice, reference: 'IBFT-5521' });
    expect(refunded.status).toBe('refunded');

    await signIn('customer@metromatrix.app');
    expect((await getOrderGroup(group.code)).orders.find(o => o.id === order.id)!.status).toBe('returned');
  });

  it('a paused store takes no new items', async () => {
    await signIn('store@metromatrix.app', 'partner');
    await pauseStore('Back on Monday');
    await signIn('customer@metromatrix.app');
    const kurta = inStock(await getProduct('p_l1'));
    expect((await failure(addToCart(kurta.id, 1))).code).toBe('STORE_PAUSED');
  });

  it('a failed publish leaves nothing behind', async () => {
    await signIn('store@metromatrix.app', 'partner');
    const drafts = (await listPartnerProducts({ status: 'draft' }, 1)).total;
    const err = await failure(
      createPartnerProduct({
        name: 'Teal silk dupatta',
        description: '',
        categoryId: null,
        collectionId: null,
        price: 2500,
        salePrice: null,
        status: 'active',
        images: [],
        option1: null,
        option2: null,
        variants: [{ id: null, option1: null, option2: null, sku: '', stock: 0, priceDelta: 0 }],
      }),
    );
    expect(err.code).toBe('PUBLISH_BLOCKED');
    expect(Object.keys(err.details.fields)).toEqual(expect.arrayContaining(['categoryId', 'images', 'variants']));
    expect((await listPartnerProducts({ status: 'draft' }, 1)).total).toBe(drafts);
  });
});

describe('admin: moderation', () => {
  it('removing a reported product takes it off the shop', async () => {
    await signInAdmin();
    const open = await listReports('open', 1);
    expect(open.items[0].productId).toBe('p_v18');
    await removeReportedProduct(open.items[0].id, 'Listing shows a counterfeit branded watch.');
    expect((await listReports('open', 1)).total).toBe(0);

    await signIn('customer@metromatrix.app');
    expect((await failure(getProduct('p_v18'))).code).toBe('NOT_FOUND');
  });
});
