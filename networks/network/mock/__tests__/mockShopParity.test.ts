// The dummy Shopping API answers in the real API's shapes: for each response
// captured from MetroMatrix-API on its `seed:shopping` demo
// (serializers/__tests__/fixtures/shop/real.json, scripts/capture-shop-fixtures.js),
// the dummy's answer to the same request has the same keys, at every level,
// with lists compared by their first row (when both have one). A key only one
// side has fails here.
import realCapture from '../../../../serializers/__tests__/fixtures/shop/real.json';
import { MainAxiosInstance } from '../../network';
import { clearTokens } from '../../../../utils/storage_utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { signInAs, installDummyApi } from '../testing';

installDummyApi();

type Body = { success: boolean; data?: unknown; error?: { code: string; details?: unknown } };
const real = realCapture as unknown as Record<string, { status: number; body: Body }>;

const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const call = async (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown, headers?: Record<string, string>): Promise<Body> => {
  try {
    const res =
      method === 'get' || method === 'delete'
        ? await MainAxiosInstance[method](url, { headers })
        : await MainAxiosInstance[method](url, body, { headers });
    return res.data as Body;
  } catch (e) {
    return ((e as { response?: { data?: Body } }).response?.data ?? { success: false }) as Body;
  }
};

/** Objects whose keys are data, not shape: each side may hold any of these keys and no others. */
const MAPS: Record<string, string[]> = {
  // The store's links, a jsonb of only the ones it set (StoreSocials).
  '.socials': ['instagram', 'facebook', 'tiktok', 'website', 'whatsapp'],
};

/** Every key path one side has and the other doesn't. */
const shapeDiff = (a: unknown, b: unknown, path = ''): string[] => {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return [`${path || '.'}: array on one side only`];
    return a.length && b.length ? shapeDiff(a[0], b[0], `${path}[]`) : [];
  }
  const objA = a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
  const objB = b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  if (!objA || !objB) return [];
  const allowed = MAPS[path];
  if (allowed) return [...Object.keys(objA), ...Object.keys(objB)].filter(k => !allowed.includes(k)).map(k => `${path}.${k}: not an API key`);
  const out: string[] = [];
  for (const k of new Set([...Object.keys(objA), ...Object.keys(objB)])) {
    if (!(k in objA)) out.push(`${path}.${k}: dummy only`);
    else if (!(k in objB)) out.push(`${path}.${k}: real only`);
    else out.push(...shapeDiff(objA[k], objB[k], `${path}.${k}`));
  }
  return out;
};

const compare = (name: string, mock: Body) => {
  const r = real[name];
  if (!r) throw new Error(`${name} was not captured`);
  if (r.body.success !== mock.success) return [`${name}: real ${r.body.success ? 'succeeded' : r.body.error?.code}, dummy ${mock.success ? 'succeeded' : mock.error?.code}`];
  if (!r.body.success && r.body.error?.code !== mock.error?.code) return [`${name}: real ${r.body.error?.code}, dummy ${mock.error?.code}`];
  return shapeDiff(r.body.data ?? { error: r.body.error?.code }, mock.data ?? { error: mock.error?.code }).map(d => `${name}${d}`);
};

const idOf = (b: Body) => (b.data as { id: string }).id;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
});

describe('the dummy Shopping API speaks the real API (customer side)', () => {
  it('answers the catalogue, the bag, checkout, orders, returns and reviews in the captured shapes', async () => {
    const out: string[] = [];
    await clearTokens();
    out.push(...compare('home', await call('get', '/shop/home')));
    out.push(...compare('categories', await call('get', '/shop/categories')));
    out.push(...compare('stores', await call('get', '/shop/stores?page=1&pageSize=3')));
    out.push(...compare('store', await call('get', '/shop/stores/s_lawn')));
    out.push(...compare('productSignedOut', await call('get', '/shop/products/p_l1')));
    out.push(...compare('related', await call('get', '/shop/products/p_l1/related')));
    out.push(...compare('suggest', await call('get', '/shop/products/suggest?q=kurta')));

    await signInAs('customer@metromatrix.app');
    out.push(...compare('homeSignedIn', await call('get', '/shop/home')));
    out.push(...compare('products', await call('get', '/shop/products?storeId=s_lawn&page=1&pageSize=3')));
    out.push(...compare('product', await call('get', '/shop/products/p_l1')));
    out.push(...compare('reviews', await call('get', '/shop/products/p_l1/reviews?page=1&pageSize=3')));
    out.push(...compare('wishlistAdd', await call('post', '/shop/wishlist/p_l1')));
    out.push(...compare('wishlist', await call('get', '/shop/wishlist?page=1&pageSize=3')));
    out.push(...compare('wishlistRemove', await call('delete', '/shop/wishlist/p_l1')));
    out.push(...compare('report', await call('post', '/shop/products/p_l2/report', { reason: 'misleading' })));
    out.push(...compare('reportAgainErr', await call('post', '/shop/products/p_l2/report', { reason: 'misleading' })));

    const db = await getDb();
    const home = db.shop.addresses.find(a => a.userId === 'u_customer' && a.city === 'Lahore')!;
    const variant = db.shop.products.find(p => p.id === 'p_l1')!.variants.find(v => v.stock > 3)!;
    out.push(...compare('cartAdd', await call('post', '/shop/cart/items', { variantId: variant.id, quantity: 1 })));
    out.push(...compare('cart', await call('get', '/shop/cart')));
    out.push(...compare('preview', await call('post', '/shop/cart/preview', { addressId: home.id, stores: [{ storeId: 's_lawn', paymentMethod: 'cod' }] })));
    out.push(...compare('couponsAvailable', await call('get', '/shop/stores/s_lawn/coupons/available')));
    out.push(...compare('checkoutNoKeyErr', await call('post', '/shop/checkout', { addressId: home.id, stores: [{ storeId: 's_lawn', paymentMethod: 'cod' }] })));
    const checkout = await call('post', '/shop/checkout', { addressId: home.id, stores: [{ storeId: 's_lawn', paymentMethod: 'cod' }] }, { 'Idempotency-Key': 'parity-1' });
    out.push(...compare('checkout', checkout));
    const group = checkout.data as { code: string; storeOrders: { id: string }[] };
    out.push(...compare('orders', await call('get', '/shop/orders?status=active&page=1&pageSize=3')));
    out.push(...compare('orderGroup', await call('get', `/shop/orders/${group.code}`)));
    out.push(...compare('storeOrder', await call('get', `/shop/store-orders/${group.storeOrders[0].id}`)));
    out.push(...compare('customerCancel', await call('post', `/shop/store-orders/${group.storeOrders[0].id}/cancel`, { reason: 'Ordered the wrong size.' })));

    // A delivered seeded order: a review, then a return.
    const delivered = db.shop.orders.find(o => o.userId === 'u_customer' && o.status === 'delivered')!;
    const fresh = await getDb();
    const item = fresh.shop.orders.find(o => o.id === delivered.id)!.items.find(i => !i.reviewed)!;
    out.push(...compare('review', await call('post', `/shop/order-items/${item.id}/review`, { rating: 5, text: 'Lovely fabric, true to size.' })));
    out.push(...compare('reviewAgainErr', await call('post', `/shop/order-items/${item.id}/review`, { rating: 4 })));
    const ret = await call('post', `/shop/store-orders/${delivered.id}/returns`, { items: [{ orderItemId: item.id, quantity: 1 }], reason: 'size_issue', details: 'Too tight.' });
    out.push(...compare('returnRequest', ret));
    out.push(...compare('returns', await call('get', '/shop/returns?page=1&pageSize=3')));
    out.push(...compare('return', await call('get', `/shop/returns/${(ret.data as { id: string }).id}`)));
    expect(out).toEqual([]);
  });
});

describe('the dummy Shopping API speaks the real API (store partner)', () => {
  it('answers the store’s pages and moves in the captured shapes', async () => {
    const out: string[] = [];
    const db = await getDb();
    const home = db.shop.addresses.find(a => a.userId === 'u_customer' && a.city === 'Lahore')!;
    const variant = db.shop.products.find(p => p.id === 'p_l1')!.variants.find(v => v.stock > 3)!;

    // A cash order (A) and a transfer order with its proof (B) at the store, as the capture placed them.
    await signInAs('customer@metromatrix.app');
    const place = async (paymentMethod: 'cod' | 'transfer', key: string) => {
      await call('post', '/shop/cart/items', { variantId: variant.id, quantity: 1 });
      const r = await call('post', '/shop/checkout', { addressId: home.id, stores: [{ storeId: 's_lawn', paymentMethod }] }, { 'Idempotency-Key': key });
      return (r.data as { storeOrders: { id: string }[] }).storeOrders[0].id;
    };
    const a = await place('cod', 'parity-a');
    const b = await place('transfer', 'parity-b');
    await call('post', `/shop/store-orders/${b}/payment-proof`, { paymentRef: 'TXN 8812 3341' });

    await signInAs('store@metromatrix.app');
    out.push(...compare('dashboard', await call('get', '/shop/partner/dashboard')));
    out.push(...compare('insights', await call('get', '/shop/partner/insights?range=30d')));
    out.push(...compare('storeProfile', await call('get', '/shop/partner/store')));
    out.push(...compare('storeProfileUpdate', await call('patch', '/shop/partner/store', { tagline: 'Hand-finished lawn' })));
    out.push(...compare('storeSettings', await call('get', '/shop/partner/store/settings')));
    out.push(...compare('storeSettingsUpdate', await call('patch', '/shop/partner/store/settings', { returnWindowDays: 7 })));
    out.push(...compare('paymentAccounts', await call('get', '/shop/partner/store/payment-accounts')));
    const acc = await call('post', '/shop/partner/store/payment-accounts', { kind: 'jazzcash', accountTitle: 'Lawn and Loom', accountNumber: '03001234567' });
    out.push(...compare('paymentAccountCreate', acc));
    out.push(...compare('paymentAccountUpdate', await call('patch', `/shop/partner/store/payment-accounts/${idOf(acc)}`, { isActive: false })));
    out.push(...compare('paymentAccountDelete', await call('delete', `/shop/partner/store/payment-accounts/${idOf(acc)}`)));

    out.push(...compare('collections', await call('get', '/shop/partner/collections')));
    const col = await call('post', '/shop/partner/collections', { name: 'Parity edit' });
    out.push(...compare('collectionCreate', col));
    out.push(...compare('collectionRename', await call('patch', `/shop/partner/collections/${idOf(col)}`, { name: 'Parity edit 2' })));
    out.push(...compare('collectionReorder', await call('patch', '/shop/partner/collections/reorder', { ids: [idOf(col)] })));
    out.push(...compare('collectionDelete', await call('delete', `/shop/partner/collections/${idOf(col)}`)));

    out.push(...compare('partnerProducts', await call('get', '/shop/partner/products?status=active&page=1&pageSize=3')));
    out.push(...compare('partnerProduct', await call('get', '/shop/partner/products/p_l1')));
    const category = db.shop.categories.find(c => c.parentId)!.id;
    const draft = await call('post', '/shop/partner/products', {
      name: 'Parity kurta',
      description: 'A plain cotton kurta.',
      categoryId: category,
      basePrice: 2500,
      status: 'draft',
      variants: [{ option1: 'S', stock: 3 }, { option1: 'M', stock: 5 }],
    });
    out.push(...compare('productCreate', draft));
    out.push(...compare('productPublishErr', await call('post', '/shop/partner/products', { name: 'No photo', description: 'Fails to publish.', categoryId: category, basePrice: 2500, status: 'active' })));
    out.push(...compare('productUpdate', await call('patch', `/shop/partner/products/${idOf(draft)}`, { salePrice: 2200 })));
    const copy = await call('post', `/shop/partner/products/${idOf(draft)}/duplicate`);
    out.push(...compare('productDuplicate', copy));
    out.push(...compare('productDelete', await call('delete', `/shop/partner/products/${idOf(copy)}`)));

    const inventory = await call('get', '/shop/partner/inventory?page=1&pageSize=3');
    out.push(...compare('inventory', inventory));
    const row = (inventory.data as { items: { variantId: string; stock: number }[] }).items[0];
    out.push(...compare('inventorySet', await call('patch', `/shop/partner/inventory/${row.variantId}`, { setTo: row.stock + 1 })));
    out.push(...compare('inventoryDelta', await call('patch', `/shop/partner/inventory/${row.variantId}`, { delta: -1 })));
    out.push(...compare('inventoryBulk', await call('post', '/shop/partner/inventory/bulk', [{ variantId: row.variantId, setTo: row.stock }])));
    out.push(...compare('movements', await call('get', `/shop/partner/inventory/${row.variantId}/movements?page=1&pageSize=3`)));

    out.push(...compare('coupons', await call('get', '/shop/partner/coupons?page=1&pageSize=3')));
    const coupon = await call('post', '/shop/partner/coupons', { code: 'PARITY10', type: 'percent', value: 10, minOrder: 1000, maxDiscount: 500, endsAt: '2026-11-15T00:00:00.000Z', usageLimit: 50 });
    out.push(...compare('couponCreate', coupon));
    out.push(...compare('coupon', await call('get', `/shop/partner/coupons/${idOf(coupon)}`)));
    out.push(...compare('couponUpdate', await call('patch', `/shop/partner/coupons/${idOf(coupon)}`, { value: 15 })));
    out.push(...compare('couponDeactivate', await call('post', `/shop/partner/coupons/${idOf(coupon)}/deactivate`)));

    // A: cash, from placed to cash collected.
    out.push(...compare('partnerOrders', await call('get', '/shop/partner/orders?status=placed&page=1&pageSize=3')));
    out.push(...compare('partnerOrder', await call('get', `/shop/partner/orders/${a}`)));
    out.push(...compare('partnerConfirm', await call('post', `/shop/partner/orders/${a}/confirm`)));
    out.push(...compare('partnerPack', await call('post', `/shop/partner/orders/${a}/pack`)));
    out.push(...compare('partnerShip', await call('post', `/shop/partner/orders/${a}/ship`, { courierName: 'TCS', trackingRef: 'TCS-77120934' })));
    out.push(...compare('partnerDeliver', await call('post', `/shop/partner/orders/${a}/deliver`)));
    out.push(...compare('partnerCashCollected', await call('post', `/shop/partner/orders/${a}/cash-collected`)));

    // B: the proof refused, sent again, confirmed; then cancelled and the refund recorded.
    out.push(...compare('partnerPaymentReject', await call('post', `/shop/partner/orders/${b}/payment/reject`, { reason: 'No transfer with that reference yet.' })));
    await signInAs('customer@metromatrix.app');
    await call('post', `/shop/store-orders/${b}/payment-proof`, { paymentRef: 'TXN 8812 3342' });
    await signInAs('store@metromatrix.app');
    out.push(...compare('partnerPaymentConfirm', await call('post', `/shop/partner/orders/${b}/payment/confirm`)));
    out.push(...compare('partnerCancelPaid', await call('post', `/shop/partner/orders/${b}/cancel`, { reason: 'This colour is out of stock.' })));
    out.push(...compare('partnerRefund', await call('post', `/shop/partner/orders/${b}/refund`, { amount: 100, refundRef: 'RAAST-551099' })));

    // A return on A, from request to refund; a reply to the customer's review.
    await signInAs('customer@metromatrix.app');
    const item = (await getDb()).shop.orders.find(o => o.id === a)!.items[0];
    await call('post', `/shop/order-items/${item.id}/review`, { rating: 5, text: 'Lovely fabric, true to size.' });
    const ret = await call('post', `/shop/store-orders/${a}/returns`, { items: [{ orderItemId: item.id, quantity: 1 }], reason: 'size_issue', details: 'Too tight.' });
    await signInAs('store@metromatrix.app');
    out.push(...compare('partnerReturns', await call('get', '/shop/partner/returns?status=requested&pageSize=3')));
    out.push(...compare('partnerReturn', await call('get', `/shop/partner/returns/${idOf(ret)}`)));
    const approved = await call('post', `/shop/partner/returns/${idOf(ret)}/approve`, { note: 'Send it back with the tag on.' });
    out.push(...compare('returnApprove', approved));
    const lines = (approved.data as { items: { id: string }[]; value: number }).items;
    out.push(...compare('returnReceive', await call('post', `/shop/partner/returns/${idOf(ret)}/receive`, { items: lines.map(l => ({ returnItemId: l.id, restock: true })) })));
    out.push(...compare('returnRefund', await call('post', `/shop/partner/returns/${idOf(ret)}/refund`, { amount: (approved.data as { value: number }).value, refundRef: 'RAAST-551023' })));
    const reviews = await call('get', '/shop/partner/reviews?unreplied=true&page=1&pageSize=3');
    out.push(...compare('partnerReviews', reviews));
    out.push(...compare('reviewReply', await call('post', `/shop/partner/reviews/${(reviews.data as { items: { id: string }[] }).items[0].id}/reply`, { text: 'Thank you for shopping with us!' })));
    expect(out).toEqual([]);
  });
});

/**
 * The staff views' keys as the backend declares them (admin-shop.response.ts,
 * "checked against real responses from the e2e suites"). There is no capture:
 * staff sign in with a TOTP.
 */
const STAFF_CATEGORY = ['id', 'parentId', 'name', 'slug', 'icon', 'sort', 'isActive'];
const STAFF_KEYS: Record<string, string[]> = {
  category: STAFF_CATEGORY,
  categoryTree: [...STAFF_CATEGORY, 'children'],
  banner: ['id', 'imageUrl', 'title', 'subtitle', 'targetType', 'targetId', 'startsAt', 'endsAt', 'sort', 'isActive'],
  report: ['id', 'reason', 'details', 'status', 'createdAt', 'resolvedAt', 'resolutionNote', 'openReportsOnProduct', 'product', 'store'],
  orderRow: ['id', 'code', 'groupCode', 'status', 'paymentMethod', 'paymentStatus', 'total', 'store', 'customerName', 'city', 'cancelReason', 'cancelledBy', 'placedAt'],
  order: ['id', 'code', 'storeId', 'status', 'paymentMethod', 'paymentStatus', 'subtotal', 'discount', 'shippingFee', 'total', 'paymentRef', 'paymentProofUrl', 'cancelReason', 'cancelledBy', 'items', 'events', 'placedAt'],
  orderItem: ['id', 'productName', 'variantLabel', 'unitPrice', 'quantity', 'lineTotal', 'returnedQty'],
  dismiss: ['id', 'status'],
  remove: ['id', 'status', 'removedReason'],
  feature: ['id', 'isFeatured'],
  deleted: ['deleted'],
};

const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v).sort() : []);
const staff = (name: string, value: unknown) => {
  const want = [...STAFF_KEYS[name]].sort();
  const got = keysOf(value);
  return JSON.stringify(got) === JSON.stringify(want) ? [] : [`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`];
};

describe('the dummy Shopping API speaks the real API (staff)', () => {
  it('answers in the views admin-shop.response.ts declares', async () => {
    const out: string[] = [];
    await signInAs('admin@metromatrix.app');
    const tree = (await call('get', '/admin/shop/categories')).data as Record<string, unknown>[];
    out.push(...staff('categoryTree', tree[0]), ...staff('category', (tree[0].children as unknown[])[0]));
    const made = await call('post', '/admin/shop/categories', { name: 'Parity shelf', icon: 'pricetag-outline', parentId: null });
    out.push(...staff('category', made.data));
    out.push(...staff('category', (await call('patch', `/admin/shop/categories/${idOf(made)}`, { sort: 9 })).data));
    out.push(...staff('deleted', (await call('delete', `/admin/shop/categories/${idOf(made)}`)).data));

    const banners = (await call('get', '/admin/shop/banners')).data as unknown[];
    out.push(...staff('banner', banners[0]));
    const banner = await call('post', '/admin/shop/banners', { imageUrl: 'https://img/b.png', title: 'Winter sale', targetType: 'store', targetId: 's_lawn' });
    out.push(...staff('banner', banner.data));
    expect(banner.data).toMatchObject({ targetType: 'store', targetId: 's_lawn' });
    out.push(...staff('banner', (await call('patch', `/admin/shop/banners/${idOf(banner)}`, { isActive: false })).data));
    out.push(...staff('deleted', (await call('delete', `/admin/shop/banners/${idOf(banner)}`)).data));

    const reports = (await call('get', '/admin/shop/reports?status=open')).data as { items: Record<string, unknown>[] };
    out.push(...staff('report', reports.items[0]));
    out.push(...staff('remove', (await call('post', `/admin/shop/products/${(reports.items[0].product as { id: string }).id}/remove`, { reason: 'Counterfeit goods are not allowed.' })).data));

    const orders = (await call('get', '/admin/shop/orders?page=1&pageSize=3')).data as { items: Record<string, unknown>[] };
    out.push(...staff('orderRow', orders.items[0]));
    const order = (await call('get', `/admin/shop/orders/${orders.items[0].id}`)).data as { items: unknown[] };
    out.push(...staff('order', order), ...staff('orderItem', order.items[0]));

    out.push(...staff('feature', (await call('post', '/admin/shop/stores/s_lawn/feature')).data));
    out.push(...staff('feature', (await call('post', '/admin/shop/stores/s_lawn/unfeature')).data));
    expect(out).toEqual([]);
  });
});
