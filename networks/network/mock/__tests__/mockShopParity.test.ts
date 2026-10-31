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
  return shapeDiff(r.body.data ?? { error: r.body.error?.code }, mock.data ?? { error: mock.error?.code }).map(d => `${name}${d}`);
};

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
