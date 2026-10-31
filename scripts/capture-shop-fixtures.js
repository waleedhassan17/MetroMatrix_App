// Captures real Shopping responses (MetroMatrix-API docs/API_SHOPPING.md) from
// a local backend seeded with `npm run seed:shopping`, as the app's fixture:
//   BACKEND=~/MetroMatix-NestJS API=http://localhost:3000/api/v1 MAIL_LOG=<the API's console log> \
//     node scripts/capture-shop-fixtures.js serializers/__tests__/fixtures/shop/real.json
// The API must run with MAIL_HOST= (console mail): the new customer's
// verification link is read from MAIL_LOG.
//
// The run changes that (local) database: it signs up a customer, places and
// moves orders at Lahore Loom (one COD order all the way to a refunded
// return, one transfer order through proof, rejection, confirmation and a
// refund, two cancellations), and adds and removes a payment account, a
// collection, a product and a coupon there (delete the shop.capture.* customers
// to clear them). It leaves the demo store as it found it: the product it buys
// is restocked for the run and its counts put back at the end (even when the
// run fails), the store's colours go back after the contrast check, and the
// store replies only to the run's own review. Staff routes (/admin/shop) are
// not captured: they need a staff sign-in with an authenticator.
//
// Credentials come from the backend's git-ignored .env (SEED_DEMO_PASSWORD)
// and are never printed. The output is scrubbed (tokens, passwords, emails,
// account numbers) and lists are cut to 3 rows.
const fs = require('fs');
const path = require('path');

const BACKEND = process.env.BACKEND;
const BASE = process.env.API || 'http://localhost:3000/api/v1';
const MAIL_LOG = process.env.MAIL_LOG;
const OUT = process.argv[2];
if (!BACKEND || !OUT || !MAIL_LOG) {
  console.error('Usage: BACKEND=<backend repo> MAIL_LOG=<api console log> [API=<base url>] node scripts/capture-shop-fixtures.js <out.json>');
  process.exit(2);
}
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(BACKEND, '.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const DEMO = env.SEED_DEMO_PASSWORD;
const out = {};
/** Changes to the demo store itself, undone at the end of the run. */
const undo = [];
const putBack = async () => {
  for (const f of undo.splice(0).reverse()) await f();
};
let keyN = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = () => `capture-${Date.now()}-${keyN++}`;

async function call(method, p, { token, body, idem } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idem) headers['Idempotency-Key'] = idem;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 429) {
      await sleep(15000);
      continue;
    }
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  throw new Error(`${method} ${p}: rate limited`);
}
/** Keep a response; an unexpected failure is reported (names ending in Err are meant to fail). */
const save = (name, r) => {
  out[name] = r;
  if (r.status >= 400 && !/Err$/.test(name)) console.log('unexpected', name, r.status, JSON.stringify(r.body).slice(0, 300));
  return r.body && r.body.data;
};
const get = async (name, p, token) => save(name, await call('GET', p, { token }));
const post = async (name, p, token, body, idem) => save(name, await call('POST', p, { token, body, idem }));
const patch = async (name, p, token, body) => save(name, await call('PATCH', p, { token, body }));
const del = async (name, p, token) => save(name, await call('DELETE', p, { token }));

const signin = async body => {
  const r = await call('POST', '/auth/signin', { body });
  if (r.status !== 200) throw new Error(`signin ${body.portal}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data.tokens.accessToken;
};
const linkToken = async to => {
  for (let i = 0; i < 40; i++) {
    const blocks = fs.readFileSync(MAIL_LOG, 'utf8').split('[DEV EMAIL]').filter(b => b.includes(`To: ${to}`));
    const m = blocks.length && /verify-email\?token=([A-Za-z0-9_-]+)/.exec(blocks[blocks.length - 1]);
    if (m) return m[1];
    await sleep(250);
  }
  throw new Error(`no verification mail for ${to}`);
};

async function customerToken() {
  const email = `shop.capture.${Date.now()}@example.com`;
  const password = 'Metro2026Shop';
  const r = await call('POST', '/auth/signup', { body: { email, password, displayName: 'Ayesha Khan', role: 'customer' } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`signup: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  await call('POST', '/auth/verify-email', { body: { token: await linkToken(email) } });
  const token = await signin({ email, password, portal: 'customer' });
  await call('PATCH', '/users/me/profile', { token, body: { dateOfBirth: '1998-02-14', gender: 'female', streetAddress: '7 Canal View, Johar Town', city: 'Lahore', postalCode: '54000' } });
  return token;
}

/** Placeholders for what must not leave the machine. */
const scrub = v => {
  if (Array.isArray(v)) return v.map(scrub);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (/^(accessToken|refreshToken|password)$/.test(k)) o[k] = '<redacted>';
    else if (k === 'email' && typeof x === 'string') o[k] = 'someone@example.com';
    else if (k === 'accountNumber' && typeof x === 'string') o[k] = x.startsWith('PK') ? 'PK00TEST0000000000000000' : '+920000000000';
    else if ((k === 'phone' || k === 'riderPhone') && typeof x === 'string') o[k] = '+923000000000';
    else o[k] = scrub(x);
  }
  return o;
};
/** Lists keep three rows: enough for every shape, small enough to read. */
const trim = v => {
  if (Array.isArray(v)) return v.slice(0, 3).map(trim);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)]));
};

(async () => {
  const partner = await signin({ email: 'demo.fashion@metromatrix.test', password: DEMO, portal: 'partner' });
  const customer = await customerToken();

  // ── Catalogue, signed out and in ──
  await get('home', '/shop/home');
  await get('homeSignedIn', '/shop/home', customer);
  await get('categories', '/shop/categories');
  await get('stores', '/shop/stores?page=1&pageSize=3');
  await get('storesFeatured', '/shop/stores?featured=true');
  await get('storesInCity', '/shop/stores?city=Lahore&pageSize=3');
  const store = await get('store', '/shop/stores/lahore-loom');
  const products = await get('products', `/shop/products?storeId=${store.id}&page=1&pageSize=3`, customer);
  await get('productsSearch', '/shop/products?q=kurta&pageSize=3');
  await get('productsSorted', '/shop/products?sort=price_asc&inStock=true&pageSize=3');
  await get('suggest', '/shop/products/suggest?q=kur');
  const productId = products.items[0].id;
  // Earlier runs may have sold this product out: the store sets each size to 3 (the low-stock line, and just
  // enough for the orders below: A takes 2, then C and D 1 each, C cancelled first), and its counts go back at
  // the end.
  const found = (await call('GET', `/shop/partner/products/${productId}`, { token: partner })).body.data.variants;
  const setStock = async (id, setTo) => {
    const r = await call('PATCH', `/shop/partner/inventory/${id}`, { token: partner, body: { setTo } });
    if (r.status !== 200) throw new Error(`stock of ${id}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  };
  undo.push(async () => {
    for (const v of found) await setStock(v.id, v.stock);
  });
  for (const v of found) await setStock(v.id, 3);
  const product = await get('product', `/shop/products/${productId}`, customer);
  await get('productSignedOut', `/shop/products/${productId}`);
  await get('related', `/shop/products/${productId}/related`);
  await get('reviews', `/shop/products/${productId}/reviews?page=1&pageSize=3`);
  await get('reviewsMissingErr', '/shop/products/00000000-0000-0000-0000-000000000000/reviews');

  // ── Saved ──
  await post('wishlistAdd', `/shop/wishlist/${productId}`, customer);
  await get('wishlist', '/shop/wishlist?page=1&pageSize=3', customer);
  await del('wishlistRemove', `/shop/wishlist/${productId}`, customer);
  await post('report', `/shop/products/${productId}/report`, customer, { reason: 'misleading', details: 'The photo shows a different colour.' });
  await post('reportAgainErr', `/shop/products/${productId}/report`, customer, { reason: 'misleading' });

  // ── Addresses ──
  const home = await post('address', '/addresses', customer, { label: 'home', fullName: 'Ayesha Khan', phone: '+923000000000', city: 'Lahore', area: 'Gulberg III', line1: 'House 12, Street 4' });
  const far = await post('addressFar', '/addresses', customer, { label: 'other', fullName: 'Ayesha Khan', phone: '+923000000000', city: 'Gilgit', area: 'Jutial', line1: 'House 4, Street 1' });

  // ── Bag ──
  const variants = product.variants.filter(v => v.inStock);
  const v1 = variants[0].id;
  const v2 = (variants[1] || variants[0]).id;
  await get('cartEmpty', '/shop/cart', customer);
  const other = (await call('GET', '/shop/products?pageSize=40', { token: customer })).body.data.items.find(p => p.store.id !== store.id);
  const otherDetail = other && (await call('GET', `/shop/products/${other.id}`, { token: customer })).body.data;
  await post('cartAdd', '/shop/cart/items', customer, { variantId: v1, quantity: 2 });
  if (otherDetail) await post('cartAddOtherStore', '/shop/cart/items', customer, { variantId: otherDetail.variants.find(v => v.inStock).id, quantity: 1 });
  const cart = await post('cartAddCapped', '/shop/cart/items', customer, { variantId: v1, quantity: 20 });
  const line = cart.stores.find(s => s.store.id === store.id).items[0];
  await patch('cartUpdate', `/shop/cart/items/${line.id}`, customer, { quantity: 2 });
  const full = await get('cart', '/shop/cart', customer);
  const plan = s => ({ addressId: home.id, stores: full.stores.map(g => ({ storeId: g.store.id, paymentMethod: s })) });
  await post('preview', '/shop/cart/preview', customer, plan('cod'));
  await post('previewFar', '/shop/cart/preview', customer, { ...plan('cod'), addressId: far.id });
  await get('couponsAvailable', `/shop/stores/${store.id}/coupons/available`, customer);
  const otherLine = full.stores.find(s => s.store.id !== store.id);
  if (otherLine) await del('cartRemove', `/shop/cart/items/${otherLine.items[0].id}`, customer);
  await post('checkoutNoKeyErr', '/shop/checkout', customer, { addressId: home.id, stores: [{ storeId: store.id, paymentMethod: 'cod' }] });

  // A: COD, all the way to a refunded return.
  const groupA = await post('checkout', '/shop/checkout', customer, { addressId: home.id, stores: [{ storeId: store.id, paymentMethod: 'cod', note: 'Ring the bell' }] }, key());
  const a1 = groupA.storeOrders[0];
  // B: transfer.
  await call('POST', '/shop/cart/items', { token: customer, body: { variantId: v2, quantity: 1 } });
  const groupB = await post('checkoutTransfer', '/shop/checkout', customer, { addressId: home.id, stores: [{ storeId: store.id, paymentMethod: 'transfer' }] }, key());
  const b1 = groupB.storeOrders[0];
  // C: cancelled by the customer while placed.
  await call('POST', '/shop/cart/items', { token: customer, body: { variantId: v1, quantity: 1 } });
  const groupC = await post('checkoutC', '/shop/checkout', customer, { addressId: home.id, stores: [{ storeId: store.id, paymentMethod: 'cod' }] }, key());
  await post('customerCancel', `/shop/store-orders/${groupC.storeOrders[0].id}/cancel`, customer, { reason: 'Ordered the wrong size.' });
  // D: the customer asks after confirmation; the store cancels.
  await call('POST', '/shop/cart/items', { token: customer, body: { variantId: v1, quantity: 1 } });
  const groupD = await post('checkoutD', '/shop/checkout', customer, { addressId: home.id, stores: [{ storeId: store.id, paymentMethod: 'cod' }] }, key());
  const d1 = groupD.storeOrders[0];
  await post('partnerConfirmD', `/shop/partner/orders/${d1.id}/confirm`, partner);
  await post('requestCancel', `/shop/store-orders/${d1.id}/request-cancel`, customer, { reason: 'I no longer need it.' });
  await post('partnerCancel', `/shop/partner/orders/${d1.id}/cancel`, partner, { reason: 'Cancelled at the customer’s request.' });

  await get('orders', '/shop/orders?status=active&page=1&pageSize=3', customer);
  await get('ordersCancelled', '/shop/orders?status=cancelled&pageSize=3', customer);
  await get('orderGroup', `/shop/orders/${groupA.code}`, customer);
  await get('storeOrder', `/shop/store-orders/${a1.id}`, customer);

  // ── The store's side of A ──
  await get('partnerOrders', '/shop/partner/orders?status=placed&page=1&pageSize=3', partner);
  await get('partnerOrdersProof', '/shop/partner/orders?paymentStatus=awaiting_transfer&pageSize=3', partner);
  await get('partnerOrder', `/shop/partner/orders/${a1.id}`, partner);
  await patch('partnerNote', `/shop/partner/orders/${a1.id}/note`, partner, { note: 'Packed by the capture run.' });
  await post('partnerConfirm', `/shop/partner/orders/${a1.id}/confirm`, partner);
  await post('partnerPack', `/shop/partner/orders/${a1.id}/pack`, partner);
  await post('partnerShip', `/shop/partner/orders/${a1.id}/ship`, partner, { courierName: 'TCS', trackingRef: 'TCS-77120934' });
  await post('partnerDeliver', `/shop/partner/orders/${a1.id}/deliver`, partner);
  await post('partnerCashCollected', `/shop/partner/orders/${a1.id}/cash-collected`, partner);
  const delivered = await get('storeOrderDelivered', `/shop/store-orders/${a1.id}`, customer);
  const item = delivered.items[0];
  const mine = await post('review', `/shop/order-items/${item.id}/review`, customer, { rating: 5, text: 'Lovely fabric, true to size.' });
  await post('reviewAgainErr', `/shop/order-items/${item.id}/review`, customer, { rating: 4 });
  const ret = await post('returnRequest', `/shop/store-orders/${a1.id}/returns`, customer, { items: [{ orderItemId: item.id, quantity: 1 }], reason: 'size_issue', details: 'Too tight across the shoulders.' });
  await get('returns', '/shop/returns?page=1&pageSize=3', customer);
  await get('return', `/shop/returns/${ret.id}`, customer);
  await get('partnerReturns', '/shop/partner/returns?status=requested&pageSize=3', partner);
  await get('partnerReturn', `/shop/partner/returns/${ret.id}`, partner);
  await post('returnApprove', `/shop/partner/returns/${ret.id}/approve`, partner, { note: 'Send it back with the tag on.' });
  const approved = out.returnApprove.body.data;
  await post('returnReceive', `/shop/partner/returns/${ret.id}/receive`, partner, { items: approved.items.map(i => ({ returnItemId: i.id, restock: true })) });
  await post('returnRefund', `/shop/partner/returns/${ret.id}/refund`, partner, { amount: approved.value, refundRef: 'RAAST-551023' });

  // ── B: transfer, proof rejected then confirmed, then cancelled and refunded ──
  await post('paymentProof', `/shop/store-orders/${b1.id}/payment-proof`, customer, { paymentRef: 'TXN 8812 3341' });
  await post('partnerPaymentReject', `/shop/partner/orders/${b1.id}/payment/reject`, partner, { reason: 'No transfer with that reference yet.' });
  await post('paymentProofAgain', `/shop/store-orders/${b1.id}/payment-proof`, customer, { paymentRef: 'TXN 8812 3342' });
  await post('partnerPaymentConfirm', `/shop/partner/orders/${b1.id}/payment/confirm`, partner);
  await post('partnerCancelPaid', `/shop/partner/orders/${b1.id}/cancel`, partner, { reason: 'This colour is out of stock.' });
  await post('partnerRefund', `/shop/partner/orders/${b1.id}/refund`, partner, { amount: groupB.storeOrders[0].total, refundRef: 'RAAST-551099' });

  // ── The store's own pages ──
  await get('dashboard', '/shop/partner/dashboard', partner);
  await get('insights', '/shop/partner/insights?range=30d', partner);
  const profile = await get('storeProfile', '/shop/partner/store', partner);
  await patch('storeProfileUpdate', '/shop/partner/store', partner, { tagline: profile.tagline });
  // A phone customers may call: set, then cleared again (the demo store shows none).
  await patch('storeProfilePhone', '/shop/partner/store', partner, { phone: '0300 0000000' });
  await patch('storeProfilePhoneCleared', '/shop/partner/store', partner, { phone: null });
  await patch('storeProfileContrastErr', '/shop/partner/store', partner, { brandColor: '#9CA3AF' });
  // The store's own colours again.
  const colours = await call('PATCH', '/shop/partner/store', { token: partner, body: { brandColor: profile.brandColor, onBrandColor: profile.onBrandColor } });
  if (colours.status !== 200) throw new Error(`colours: ${colours.status} ${JSON.stringify(colours.body).slice(0, 200)}`);
  const settings = await get('storeSettings', '/shop/partner/store/settings', partner);
  await patch('storeSettingsUpdate', '/shop/partner/store/settings', partner, { returnWindowDays: settings.returnWindowDays });
  await get('paymentAccounts', '/shop/partner/store/payment-accounts', partner);
  const acc = await post('paymentAccountCreate', '/shop/partner/store/payment-accounts', partner, { kind: 'jazzcash', accountTitle: 'Lahore Loom', accountNumber: '+923001234567' });
  if (acc) {
    await patch('paymentAccountUpdate', `/shop/partner/store/payment-accounts/${acc.id}`, partner, { isActive: false });
    await del('paymentAccountDelete', `/shop/partner/store/payment-accounts/${acc.id}`, partner);
  }
  const collections = await get('collections', '/shop/partner/collections', partner);
  const col = await post('collectionCreate', '/shop/partner/collections', partner, { name: 'Capture edit' });
  if (col) {
    await patch('collectionRename', `/shop/partner/collections/${col.id}`, partner, { name: 'Capture edit 2' });
    await patch('collectionReorder', '/shop/partner/collections/reorder', partner, { ids: [col.id, ...collections.map(c => c.id)] });
    await del('collectionDelete', `/shop/partner/collections/${col.id}`, partner);
  }
  await get('partnerProducts', '/shop/partner/products?status=active&page=1&pageSize=3', partner);
  const partnerProduct = await get('partnerProduct', `/shop/partner/products/${productId}`, partner);
  const draft = await post('productCreate', '/shop/partner/products', partner, {
    name: 'Capture test kurta',
    description: 'A plain cotton kurta for the capture run.',
    categoryId: partnerProduct.categoryId,
    basePrice: 2500,
    status: 'draft',
    variants: [{ option1: 'S', stock: 3 }, { option1: 'M', stock: 5 }],
  });
  await post('productPublishErr', '/shop/partner/products', partner, { name: 'No photo', description: 'Fails to publish.', categoryId: partnerProduct.categoryId, basePrice: 2500, status: 'active' });
  if (draft) {
    await patch('productUpdate', `/shop/partner/products/${draft.id}`, partner, { salePrice: 2200, variants: draft.variants.map(v => ({ id: v.id, option1: v.option1, stock: v.stock + 1 })) });
    const copy = await post('productDuplicate', `/shop/partner/products/${draft.id}/duplicate`, partner);
    if (copy) await del('productDeleteCopy', `/shop/partner/products/${copy.id}`, partner);
    await del('productDelete', `/shop/partner/products/${draft.id}`, partner);
  }
  const inventory = await get('inventory', '/shop/partner/inventory?page=1&pageSize=3', partner);
  const inv = inventory.items[0];
  await patch('inventorySet', `/shop/partner/inventory/${inv.variantId}`, partner, { setTo: inv.stock });
  await patch('inventoryDelta', `/shop/partner/inventory/${inv.variantId}`, partner, { delta: 0 });
  await save('inventoryBulk', await call('POST', '/shop/partner/inventory/bulk', { token: partner, body: [{ variantId: inv.variantId, setTo: inv.stock }] }));
  await get('movements', `/shop/partner/inventory/${inv.variantId}/movements?page=1&pageSize=3`, partner);
  await get('coupons', '/shop/partner/coupons?page=1&pageSize=3', partner);
  const coupon = await post('couponCreate', '/shop/partner/coupons', partner, {
    code: `CAP${Date.now().toString(36).slice(-5).toUpperCase()}`,
    type: 'percent',
    value: 10,
    minOrder: 1000,
    maxDiscount: 500,
    endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    usageLimit: 50,
  });
  if (coupon) {
    await get('coupon', `/shop/partner/coupons/${coupon.id}`, partner);
    await patch('couponUpdate', `/shop/partner/coupons/${coupon.id}`, partner, { value: 15 });
    await post('couponDeactivate', `/shop/partner/coupons/${coupon.id}/deactivate`, partner);
  }
  await get('partnerReviews', '/shop/partner/reviews?unreplied=true&page=1&pageSize=3', partner);
  // On the run's own review: a reply can't be taken back.
  if (mine) await post('reviewReply', `/shop/partner/reviews/${mine.id}/reply`, partner, { text: 'Thank you for shopping with us!' });
  await putBack();

  const doc = scrub(trim(out));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${Object.keys(out).length} responses → ${OUT}`);
})().catch(async e => {
  console.error(e);
  await putBack().catch(err => console.error('putting the demo store back failed:', err));
  process.exit(1);
});
