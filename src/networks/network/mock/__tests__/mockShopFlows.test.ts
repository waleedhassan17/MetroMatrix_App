// The dummy shop API, driven through the REAL shopping networks — the server
// rules QA relies on: idempotent checkout, stock, delivery cities, coupons,
// payment before shipping, one review per item, returns and moderation.

import { getAddressesAPI } from '../../../addresses/addressesNetwork';
import { getReportsAPI, removeReportedProductAPI } from '../../../admin/adminShopNetwork';
import { acknowledgeCartAPI, addToCartAPI, getCartAPI } from '../../../shopping/cartNetwork';
import { getProductAPI } from '../../../shopping/catalogNetwork';
import { placeOrderAPI, previewCheckoutAPI } from '../../../shopping/checkoutNetwork';
import { cancelOrderAPI, getOrderGroupAPI, submitPaymentProofAPI } from '../../../shopping/ordersNetwork';
import { requestReturnAPI } from '../../../shopping/returnsNetwork';
import { writeReviewAPI } from '../../../shopping/reviewsNetwork';
import {
  confirmOrderAPI,
  confirmPaymentAPI,
  deliverOrderAPI,
  packOrderAPI,
  shipOrderAPI,
} from '../../../shopping/partner/partnerOrdersNetwork';
import { approveReturnAPI, receiveReturnAPI, recordRefundAPI } from '../../../shopping/partner/partnerReturnsNetwork';
import { createPartnerProductAPI, getPartnerProductsAPI } from '../../../shopping/partner/productsNetwork';
import { pauseStoreAPI } from '../../../shopping/partner/storeNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import type { CheckoutInput, ProductDetail } from '../../../../types/shopping';
import { getDb, resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';
import { addressListSerializer } from '../../../../serializers/addressSerializer';
import { productDetailSerializer, reviewSerializer } from '../../../../serializers/shopping/catalogSerializer';
import { cartSerializer, checkoutPreviewSerializer } from '../../../../serializers/shopping/cartSerializer';
import { orderGroupSerializer, returnSerializer } from '../../../../serializers/shopping/orderSerializer';
import { partnerOrderDetailSerializer, partnerProductRowPageSerializer, partnerProductSerializer } from '../../../../serializers/shopping/partnerSerializer';
import { productReportPageSerializer } from '../../../../serializers/shopping/adminShopSerializer';

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

const signIn = async (email: string, _portal: 'customer' | 'partner' = 'customer') => {
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
  const kurta = inStock(required(productDetailSerializer(await getProductAPI('p_l1'))));
  const phones = inStock(required(productDetailSerializer(await getProductAPI('p_v1'))));
  await addToCartAPI(kurta.id, 1);
  await addToCartAPI(phones.id, 1);
  const home = (required(addressListSerializer(await getAddressesAPI()))).find(a => a.city === 'Lahore')!;
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

    const bag = required(cartSerializer(await getCartAPI()));
    expect(bag.groups.map(g => g.store.id)).toEqual(['s_lawn', 's_volt']);
    expect(bag.blocking).toBe(false);

    const preview = required(checkoutPreviewSerializer(await previewCheckoutAPI(input)));
    expect(preview.canPlace).toBe(true);
    expect(preview.total).toBe(preview.stores.reduce((s, x) => s + x.total, 0));

    const group = required(orderGroupSerializer(await placeOrderAPI(input, 'key-1')));
    expect(group.orders).toHaveLength(2);
    expect(group.orders.map(o => o.paymentStatus).sort()).toEqual(['awaiting_transfer', 'cod_pending']);
    expect([await stockOf(kurta.id), await stockOf(phones.id)]).toEqual([before[0] - 1, before[1] - 1]);
    expect((required(cartSerializer(await getCartAPI()))).groups).toHaveLength(0);

    // The same key again: the same order back, nothing placed twice.
    const db = await getDb();
    const orders = db.shop.orders.length;
    const replay = required(orderGroupSerializer(await placeOrderAPI(input, 'key-1')));
    expect(replay.code).toBe(group.code);
    expect(db.shop.orders.length).toBe(orders);
  });

  it('refuses sold-out options and reports lines that sold out before checkout', async () => {
    const bag = required(productDetailSerializer(await getProductAPI('p_b7')));
    expect((await failure(addToCartAPI(bag.variants[0].id, 1).then(raw => required(cartSerializer(raw))))).code).toBe('OUT_OF_STOCK');

    const { kurta, input } = await fillBag();
    const db = await getDb();
    db.shop.products.flatMap(p => p.variants).find(v => v.id === kurta.id)!.stock = 0;
    const err = await failure(placeOrderAPI(input, 'key-2').then(raw => required(orderGroupSerializer(raw))));
    expect(err.code).toBe('OUT_OF_STOCK');
    expect(err.details.lineIds).toHaveLength(1);
  });

  it('flags a price change until the customer acknowledges it', async () => {
    const { input } = await fillBag();
    const db = await getDb();
    db.shop.products.find(p => p.id === 'p_l1')!.salePrice = 6990;
    const bag = required(cartSerializer(await getCartAPI()));
    expect(bag.blocking).toBe(true);
    expect(bag.groups[0].lines[0].warnings[0]).toMatchObject({ code: 'PRICE_CHANGED', previousPrice: 7190, currentPrice: 6990 });
    expect((required(checkoutPreviewSerializer(await previewCheckoutAPI(input)))).stores[0].error?.code).toBe('BAG_NEEDS_ATTENTION');

    const cleared = required(cartSerializer(await acknowledgeCartAPI([])));
    expect(cleared.blocking).toBe(false);
  });

  it('blocks stores that do not deliver to the address city', async () => {
    const { input } = await fillBag();
    const quetta = (required(addressListSerializer(await getAddressesAPI()))).find(a => a.city === 'Quetta')!;
    const preview = required(checkoutPreviewSerializer(await previewCheckoutAPI({ ...input, addressId: quetta.id })));
    const volt = preview.stores.find(s => s.store.id === 's_volt')!;
    expect(volt.error?.code).toBe('CITY_NOT_SERVED');
    // Lawn & Loom delivers nationwide.
    expect(preview.stores.find(s => s.store.id === 's_lawn')!.error).toBeNull();
    expect(preview.canPlace).toBe(false);
    expect((await failure(placeOrderAPI({ ...input, addressId: quetta.id }, 'key-3').then(raw => required(orderGroupSerializer(raw))))).code).toBe('CHECKOUT_BLOCKED');
  });

  it('enforces a coupon usage limit across customers', async () => {
    const urban = (required(productDetailSerializer(await getProductAPI('p_u1')))).variants.filter(v => v.stock > 0);
    await addToCartAPI(urban[0].id, 1);
    const address = (required(addressListSerializer(await getAddressesAPI()))).find(a => a.city === 'Lahore')!;
    const input: CheckoutInput = {
      addressId: address.id,
      stores: [{ storeId: 's_urban', paymentMethod: 'cod', couponCode: 'urban300', note: null }],
    };
    const preview = required(checkoutPreviewSerializer(await previewCheckoutAPI(input)));
    expect(preview.stores[0]).toMatchObject({ discount: 300, couponCode: 'URBAN300', couponError: null });
    await placeOrderAPI(input, 'key-4');

    await signIn('hamza@metromatrix.app');
    await addToCartAPI(urban[1].id, 1);
    const hamza = (required(addressListSerializer(await getAddressesAPI())))[0];
    const theirs = required(checkoutPreviewSerializer(await previewCheckoutAPI({ ...input, addressId: hamza.id })));
    expect(theirs.stores[0].couponError?.code).toBe('COUPON_USED_UP');
  });

  it('puts the stock back when the customer cancels', async () => {
    const { kurta, input } = await fillBag();
    const before = await stockOf(kurta.id);
    const group = required(orderGroupSerializer(await placeOrderAPI(input, 'key-5')));
    const lawn = group.orders.find(o => o.store.id === 's_lawn')!;
    expect(lawn.canCancel).toBe(true);
    const after = required(orderGroupSerializer(await cancelOrderAPI(lawn.id, 'Ordered the wrong size')));
    expect(after.orders.find(o => o.id === lawn.id)!.status).toBe('cancelled');
    expect(await stockOf(kurta.id)).toBe(before);
  });
});

describe('store partner: payment before shipping, then delivery and review', () => {
  it('walks a transfer order from placed to reviewed', async () => {
    const { input } = await fillBag();
    const group = required(orderGroupSerializer(await placeOrderAPI(input, 'key-6')));
    const order = group.orders.find(o => o.store.id === 's_volt')!;

    await signIn('volt@metromatrix.app', 'partner');
    await confirmOrderAPI(order.id);
    await packOrderAPI(order.id);
    const blocked = await failure(shipOrderAPI(order.id, { courier: 'tcs', trackingRef: 'TCS123456' }).then(raw => required(partnerOrderDetailSerializer(raw))));
    expect(blocked.code).toBe('PAYMENT_NOT_CONFIRMED');

    await signIn('customer@metromatrix.app');
    const sent = required(orderGroupSerializer(await submitPaymentProofAPI(order.id, { transactionId: 'rx-99887766', imageUrl: null })));
    expect(sent.orders.find(o => o.id === order.id)!.paymentStatus).toBe('proof_submitted');

    await signIn('volt@metromatrix.app', 'partner');
    await confirmPaymentAPI(order.id);
    expect((await failure(shipOrderAPI(order.id, { courier: 'tcs', trackingRef: '' }).then(raw => required(partnerOrderDetailSerializer(raw))))).code).toBe('VALIDATION_FAILED');
    const shipped = required(partnerOrderDetailSerializer(await shipOrderAPI(order.id, { courier: 'tcs', trackingRef: 'TCS123456' })));
    expect(shipped.status).toBe('shipped');
    await deliverOrderAPI(order.id);

    await signIn('customer@metromatrix.app');
    const delivered = (required(orderGroupSerializer(await getOrderGroupAPI(group.code)))).orders.find(o => o.id === order.id)!;
    expect(delivered).toMatchObject({ status: 'delivered', canReview: true, canReturn: true });
    const item = delivered.items[0];
    await writeReviewAPI(order.id, item.id, { rating: 5, title: null, body: 'Great sound and battery.', photos: [] });
    expect((await failure(writeReviewAPI(order.id, item.id, { rating: 4, title: null, body: 'Again, again.', photos: [] }).then(raw => required(reviewSerializer(raw))))).code).toBe(
      'ALREADY_REVIEWED',
    );
  });

  it('restocks returned items and closes the order once refunded', async () => {
    const { kurta, input } = await fillBag();
    const group = required(orderGroupSerializer(await placeOrderAPI(input, 'key-7')));
    const order = group.orders.find(o => o.store.id === 's_lawn')!;
    await signIn('store@metromatrix.app', 'partner');
    await confirmOrderAPI(order.id);
    await packOrderAPI(order.id);
    await shipOrderAPI(order.id, { courier: 'leopards', trackingRef: 'LP-77881' });
    await deliverOrderAPI(order.id);
    const afterSale = await stockOf(kurta.id);

    await signIn('customer@metromatrix.app');
    const item = (required(orderGroupSerializer(await getOrderGroupAPI(group.code)))).orders.find(o => o.id === order.id)!.items[0];
    const ret = required(returnSerializer(await requestReturnAPI(order.id, {
      reason: 'size_issue',
      details: 'The medium runs small on me.',
      photos: [],
      items: [{ orderItemId: item.id, quantity: 1 }],
    })));
    expect(ret.status).toBe('requested');

    await signIn('store@metromatrix.app', 'partner');
    await approveReturnAPI(ret.id, null);
    await receiveReturnAPI(ret.id, { [item.id]: true });
    expect(await stockOf(kurta.id)).toBe(afterSale + 1);
    const refunded = required(returnSerializer(await recordRefundAPI(ret.id, { amount: item.unitPrice, reference: 'IBFT-5521' })));
    expect(refunded.status).toBe('refunded');

    await signIn('customer@metromatrix.app');
    expect((required(orderGroupSerializer(await getOrderGroupAPI(group.code)))).orders.find(o => o.id === order.id)!.status).toBe('returned');
  });

  it('a paused store takes no new items', async () => {
    await signIn('store@metromatrix.app', 'partner');
    await pauseStoreAPI('Back on Monday');
    await signIn('customer@metromatrix.app');
    const kurta = inStock(required(productDetailSerializer(await getProductAPI('p_l1'))));
    expect((await failure(addToCartAPI(kurta.id, 1).then(raw => required(cartSerializer(raw))))).code).toBe('STORE_PAUSED');
  });

  it('a failed publish leaves nothing behind', async () => {
    await signIn('store@metromatrix.app', 'partner');
    const drafts = (required(partnerProductRowPageSerializer(await getPartnerProductsAPI({ status: 'draft' }, 1)))).total;
    const err = await failure(
      createPartnerProductAPI({
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
      }).then(raw => required(partnerProductSerializer(raw))),
    );
    expect(err.code).toBe('PUBLISH_BLOCKED');
    expect(Object.keys(err.details.fields)).toEqual(expect.arrayContaining(['categoryId', 'images', 'variants']));
    expect((required(partnerProductRowPageSerializer(await getPartnerProductsAPI({ status: 'draft' }, 1)))).total).toBe(drafts);
  });
});

describe('admin: moderation', () => {
  it('removing a reported product takes it off the shop', async () => {
    await signInAdmin();
    const open = required(productReportPageSerializer(await getReportsAPI('open', 1)));
    expect(open.items[0].productId).toBe('p_v18');
    await removeReportedProductAPI(open.items[0].id, 'Listing shows a counterfeit branded watch.');
    expect((required(productReportPageSerializer(await getReportsAPI('open', 1)))).total).toBe(0);

    await signIn('customer@metromatrix.app');
    expect((await failure(getProductAPI('p_v18').then(raw => required(productDetailSerializer(raw))))).code).toBe('NOT_FOUND');
  });
});
