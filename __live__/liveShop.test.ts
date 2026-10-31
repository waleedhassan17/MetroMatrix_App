// ═══════════════════════════════════════════════════════
// Live Shopping run against a real MetroMatrix API
// ═══════════════════════════════════════════════════════
// Skipped unless LIVE_API_URL is set:
//   LIVE_API_URL=http://localhost:3000/api/v1 LIVE_MAIL_LOG=<the API's console log> \
//   LIVE_BACKEND=<the API's checkout, for its .env> npx jest __live__/liveShop
// The API runs with the console mail transport (MAIL_HOST empty) on its
// seed:shopping demo; the store signs in as demo.fashion@metromatrix.test with
// the seed's SEED_DEMO_PASSWORD, read from the API's own .env (never printed).
// Everything goes through the App's own networks and serializers: a new
// customer's first order from browsing to a refunded return, a transfer from
// proof to refund, and the store's tools.

// First: point network.ts at the live API before it loads.
import './liveApiUrl';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MainAxiosInstance, RefreshAxiosInstance, required, type ApiError } from '../networks/network/network';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../utils/storage_utils/storageUtils';
import { authLogin } from '../networks/authcalls/signin';
import { authSignup } from '../networks/authcalls/signup';
import { verifyEmail } from '../networks/authcalls/verifyEmail';
import * as users from '../networks/users/users';
import * as addresses from '../networks/addresses/addresses';
import * as cart from '../networks/shopping/cart';
import * as catalog from '../networks/shopping/catalog';
import * as checkout from '../networks/shopping/checkout';
import * as orders from '../networks/shopping/orders';
import * as returns from '../networks/shopping/returns';
import * as reviews from '../networks/shopping/reviews';
import * as wishlist from '../networks/shopping/wishlist';
import * as coupons from '../networks/shopping/partner/coupons';
import * as insights from '../networks/shopping/partner/insights';
import * as inventory from '../networks/shopping/partner/inventory';
import * as partnerOrders from '../networks/shopping/partner/partnerOrders';
import * as partnerReturns from '../networks/shopping/partner/partnerReturns';
import * as partnerReviews from '../networks/shopping/partner/partnerReviews';
import * as products from '../networks/shopping/partner/products';
import * as store from '../networks/shopping/partner/store';
import { addressSerializer } from '../serializers/addressSerializer';
import {
  categoryListSerializer,
  collectionListSerializer,
  collectionSerializer,
  productDetailSerializer,
  productSummaryPageSerializer,
  reviewSerializer,
  shopHomeSerializer,
  storeDetailSerializer,
  storeSummaryPageSerializer,
  suggestionListSerializer,
  wishlistIdsSerializer,
} from '../serializers/shopping/catalogSerializer';
import { availableCouponListSerializer, cartSerializer, checkoutPreviewSerializer } from '../serializers/shopping/cartSerializer';
import { orderGroupSerializer, orderGroupSummaryPageSerializer, returnPageSerializer, returnSerializer, storeOrderResponseSerializer } from '../serializers/shopping/orderSerializer';
import {
  couponSerializer,
  insightsSerializer,
  inventoryRowPageSerializer,
  movementListSerializer,
  partnerOrderDetailSerializer,
  partnerOrderPageSerializer,
  partnerProductSerializer,
  partnerReviewPageSerializer,
  partnerReviewSerializer,
  partnerSummarySerializer,
  pauseStateSerializer,
  paymentAccountListSerializer,
  stockLevelListSerializer,
  stockLevelResponseSerializer,
  storeProfileSerializer,
  storeSettingsSerializer,
} from '../serializers/shopping/partnerSerializer';
import type { CheckoutInput, PartnerOrderDetail, ProductDetail } from '../models/shopping';

const LIVE = process.env.LIVE_API_URL;
const MAIL_LOG = process.env.LIVE_MAIL_LOG ?? '';
const live = LIVE ? describe : describe.skip;

jest.setTimeout(300_000);

// ─── Helpers ─────────────────────────────────────────
const run = Date.now().toString(36);
const EMAIL = `live.${run}.shopper@example.com`;
const PASSWORD = 'Metro2026Live';
const STORE_EMAIL = 'demo.fashion@metromatrix.test';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** A fresh Pakistani mobile per run (no real person's number). */
const mobile = () => `+9230${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

/** The seed's demo password from the API's own .env (never printed). */
const demoPassword = () => {
  const env = readFileSync(join(process.env.LIVE_BACKEND ?? '', '.env'), 'utf8');
  const line = env.split('\n').find(l => l.startsWith('SEED_DEMO_PASSWORD='));
  if (!line) throw new Error('SEED_DEMO_PASSWORD is not in the API’s .env');
  return line.slice('SEED_DEMO_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
};

interface Session {
  access: string;
  refresh: string;
}
/** Make `s` the stored session, as one device would hold it. */
const hold = async (s: Session) => setTokens(s.access, s.refresh);
const stored = async (): Promise<Session> => ({ access: (await getAccessToken())!, refresh: (await getRefreshToken())! });

/** Sign-in is limited per IP: on RATE_LIMITED wait as long as the API says, up to 3 times. */
const signin = async (...args: Parameters<typeof authLogin>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await authLogin(...args);
    } catch (e) {
      const err = e as ApiError;
      if (err.code !== 'RATE_LIMITED' || attempt > 3) throw e;
      await sleep((Number(err.details?.retryAfter) || 60) * 1000 + 1000);
    }
  }
};

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const linkToken = async (to: string): Promise<string> => {
  for (let i = 0; i < 40; i++) {
    const blocks = readFileSync(MAIL_LOG, 'utf8').split('[DEV EMAIL]').filter(b => b.includes(`To: ${to}`));
    for (const b of blocks.reverse()) {
      const m = b.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }
    await sleep(250);
  }
  throw new Error(`no email to ${to}`);
};

const inStock = (p: ProductDetail) => {
  const v = p.variants.find(x => x.stock > 0);
  if (!v) throw new Error(`${p.name} has nothing in stock`);
  return v;
};

// ─── The run ─────────────────────────────────────────
live('live Shopping run against the local API', () => {
  const sessions: Record<'customer' | 'store', Session> = { customer: { access: '', refresh: '' }, store: { access: '', refresh: '' } };
  let addressId = '';
  let product: ProductDetail;
  let cod: PartnerOrderDetail;
  let groupCode = '';
  let storeId = '';
  /** The store's private note on the cash order: only the store ever sees it. */
  const NOTE = 'Gift wrap: the customer asked twice.';
  /** The demo stock this run buys from, as it found it: put back at the end. */
  const found = new Map<string, number>();

  const asCustomer = () => hold(sessions.customer);
  const asStore = () => hold(sessions.store);
  const storeView = async (raw: Promise<unknown>) => required(partnerOrderDetailSerializer(await raw));

  beforeAll(() => {
    // Node's own fetch does the network (jest has no XHR).
    MainAxiosInstance.defaults.adapter = 'fetch';
    RefreshAxiosInstance.defaults.adapter = 'fetch';
  });
  beforeEach(() => clearTokens());
  afterAll(async () => {
    if (!found.size) return;
    await asStore();
    for (const [variantId, stock] of found) await inventory.setStock(variantId, stock);
  });

  it('1. a new customer signs up, verifies, completes the profile and adds an address', async () => {
    await authSignup({ name: 'Live Shopper', email: EMAIL, phone: mobile(), password: PASSWORD, portal: 'customer' });
    sessions.customer = await stored();
    await verifyEmail(await linkToken(EMAIL));
    await asCustomer();
    await users.completeProfile({ dateOfBirth: '1998-02-14', gender: 'female', streetAddress: '7 Canal View', city: 'Lahore', postalCode: '54000' });
    const address = required(addressSerializer(await addresses.createAddress({ label: 'home', fullName: 'Live Shopper', phone: mobile(), city: 'Lahore', area: 'Gulberg III', line1: 'House 12, Street 4', landmark: null, lat: null, lng: null })));
    expect(address).toMatchObject({ label: 'home', city: 'Lahore' });
    addressId = address.id;
    sessions.customer = await stored();

    await signin({ email: STORE_EMAIL, password: demoPassword(), portal: 'partner' });
    sessions.store = await stored();
  });

  it('2. browses the shop: the home, a store, its products, a product page, suggestions and the saved list', async () => {
    await asCustomer();
    const home = shopHomeSerializer(await catalog.fetchShopHome());
    expect(home.banners.length).toBeGreaterThan(0);
    expect(categoryListSerializer(await catalog.fetchCategories()).length).toBeGreaterThan(0);
    const loom = required(storeSummaryPageSerializer(await catalog.fetchStores({ q: 'Lahore Loom' }, 1))).items.find(s => s.slug === 'lahore-loom')!;
    storeId = loom.id;
    const page = required(storeDetailSerializer(await catalog.fetchStore(loom.slug)));
    expect(page.policies.paymentMethods).toEqual(expect.arrayContaining(['cod', 'transfer']));
    const list = required(productSummaryPageSerializer(await catalog.fetchProducts({ storeId, inStock: true, sort: 'trending' }, 1)));
    expect(list.items.length).toBeGreaterThan(0);
    const id = list.items[0].id;
    const [raw, related, top] = await Promise.all([catalog.fetchProduct(id), catalog.fetchRelatedProducts(id), catalog.fetchReviews(id, {}, 1, 3)]);
    product = required(productDetailSerializer(raw, related, top));
    expect(product.store.name).toBe('Lahore Loom');
    expect(suggestionListSerializer(await catalog.suggestProducts('kurta')).length).toBeGreaterThan(0);
    await wishlist.saveProduct(id);
    expect(wishlistIdsSerializer(await wishlist.fetchWishlistIds())).toContain(id);
    await wishlist.unsaveProduct(id);
    expect(wishlistIdsSerializer(await wishlist.fetchWishlistIds())).not.toContain(id);
  });

  it('3. fills the bag, previews, and places a cash order', async () => {
    await asStore();
    for (const x of required(partnerProductSerializer(await products.fetchPartnerProduct(product.id))).variants) if (x.id) found.set(x.id, x.stock);
    await asCustomer();
    const v = inStock(product);
    const bag = cartSerializer(await cart.addToCart(v.id, 1));
    const line = bag.groups.flatMap(g => g.lines).find(l => l.variantId === v.id)!;
    expect(line.quantity).toBe(1);
    // The store is drawn in its own colours in the bag, the plan and the order.
    const colours = { brandColor: product.store.brandColor, onBrandColor: product.store.onBrandColor };
    expect(bag.groups.find(g => g.store.id === storeId)!.store).toMatchObject(colours);
    // The product page says only in stock or low; the bag line says how many it can hold.
    const want = Math.min(2, line.available);
    expect(cartSerializer(await cart.updateCartLine(line.id, want)).groups.flatMap(g => g.lines).find(l => l.id === line.id)!.quantity).toBe(want);
    const input: CheckoutInput = { addressId, stores: [{ storeId, paymentMethod: 'cod', couponCode: null, note: 'Ring the bell' }] };
    const plan = checkoutPreviewSerializer(await checkout.previewCheckout(input));
    expect(plan.canPlace).toBe(true);
    expect(plan.stores[0].store).toMatchObject(colours);
    availableCouponListSerializer(await checkout.fetchAvailableCoupons(storeId));
    const group = required(orderGroupSerializer(await checkout.placeOrder(input, `live-${run}-cod`)));
    expect(group.orders[0]).toMatchObject({ status: 'placed', paymentStatus: 'cod_pending', note: 'Ring the bell', canCancel: true, store: colours });
    groupCode = group.code;
    expect(required(orderGroupSummaryPageSerializer(await orders.fetchOrders('active', 1))).items.map(g => g.code)).toContain(groupCode);
    expect(required(orderGroupSerializer(await orders.fetchOrderGroup(groupCode))).orders).toHaveLength(1);
    expect(required(storeOrderResponseSerializer(await orders.fetchStoreOrder(group.orders[0].id))).groupCode).toBe(groupCode);
  });

  it('4. the store sees it on Today, then confirms, packs, ships with its own rider, delivers and takes the cash', async () => {
    await asStore();
    const [dashboard, profile, settings, week] = await Promise.all([store.fetchDashboard(), store.fetchStoreProfile(), store.fetchStoreSettings(), insights.fetchInsights('7d')]);
    const today = partnerSummarySerializer({ dashboard, store: profile, settings, insights: week });
    expect(today.storeName).toBe('Lahore Loom');
    expect(today.counts.newOrders).toBeGreaterThan(0);
    expect(today.sales7d).toHaveLength(7);
    const fresh = required(partnerOrderPageSerializer(await partnerOrders.fetchPartnerOrders({ segment: 'new', q: groupCode }, 1))).items;
    expect(fresh).toHaveLength(1);
    const id = fresh[0].id;
    expect((await storeView(partnerOrders.fetchPartnerOrder(id))).allowedActions).toEqual(['confirm', 'cancel']);
    expect((await storeView(partnerOrders.saveInternalNote(id, NOTE))).internalNote).toBe(NOTE);
    expect((await storeView(partnerOrders.confirmOrder(id))).allowedActions).toEqual(['pack', 'cancel']);
    expect((await storeView(partnerOrders.packOrder(id))).allowedActions).toEqual(['ship', 'cancel']);
    const shipped = await storeView(partnerOrders.shipOrder(id, { courier: 'own_rider', riderName: 'Ali Raza', riderPhone: mobile() }));
    expect(shipped.shipment).toMatchObject({ courier: 'own_rider', courierName: 'Own rider' });
    expect(shipped.allowedActions).toEqual(['deliver']);
    expect((await storeView(partnerOrders.deliverOrder(id))).allowedActions).toEqual(['cash_collected']);
    cod = await storeView(partnerOrders.markCashCollected(id));
    expect([cod.status, cod.paymentStatus, cod.allowedActions, cod.internalNote]).toEqual(['delivered', 'cash_collected', [], NOTE]);
  });

  it('5. the customer reviews the item and returns one; the store approves, restocks, refunds and replies', async () => {
    await asCustomer();
    const raw = await orders.fetchStoreOrder(cod.id);
    expect(JSON.stringify(raw)).not.toContain(NOTE);
    const order = required(storeOrderResponseSerializer(raw));
    expect([order.status, order.canReview, order.canReturn]).toEqual(['delivered', true, true]);
    const item = order.items[0];
    expect(reviewSerializer(await reviews.writeReview(item.id, { rating: 5, title: null, body: 'Lovely fabric, true to size.', photos: [] }))).toMatchObject({ rating: 5 });
    const ret = required(returnSerializer(await returns.requestReturn(cod.id, { reason: 'size_issue', details: 'Too tight across the shoulders.', photos: [], items: [{ orderItemId: item.id, quantity: 1 }] })));
    expect(ret.status).toBe('requested');
    expect(required(returnPageSerializer(await returns.fetchReturns(1))).items.map(r => r.id)).toContain(ret.id);

    await asStore();
    expect((await storeView(partnerOrders.saveInternalNote(cod.id, ''))).internalNote).toBeNull();
    expect(required(returnPageSerializer(await partnerReturns.fetchPartnerReturns('requested', 1))).items.map(r => r.id)).toContain(ret.id);
    const approved = required(returnSerializer(await partnerReturns.approveReturn(ret.id, 'Send it back with the tag on.')));
    expect(approved.status).toBe('approved');
    const received = required(returnSerializer(await partnerReturns.receiveReturn(ret.id, { [approved.items[0].id]: true })));
    expect(received.status).toBe('received');
    const refunded = required(returnSerializer(await partnerReturns.recordRefund(ret.id, { amount: approved.items[0].unitPrice, reference: `RAAST-${run}` })));
    expect(refunded).toMatchObject({ status: 'refunded', refund: { amount: approved.items[0].unitPrice } });

    const fives = required(partnerReviewPageSerializer(await partnerReviews.fetchPartnerReviews({ rating: 5, unreplied: true }, 1))).items;
    expect(fives.every(r => r.rating === 5 && !r.reply)).toBe(true);
    const mine = fives.find(r => r.body === 'Lovely fabric, true to size.')!;
    const replied = required(partnerReviewSerializer(await partnerReviews.replyToReview(mine.id, 'Thank you for shopping with us!')));
    expect(replied.reply).toMatchObject({ body: 'Thank you for shopping with us!' });
  });

  it('6. a transfer: proof sent, confirmed, the order cancelled, the refund recorded', async () => {
    await asCustomer();
    const v = inStock(required(productDetailSerializer(await catalog.fetchProduct(product.id))));
    await cart.addToCart(v.id, 1);
    const input: CheckoutInput = { addressId, stores: [{ storeId, paymentMethod: 'transfer', couponCode: null, note: null }] };
    const placed = required(orderGroupSerializer(await checkout.placeOrder(input, `live-${run}-transfer`))).orders[0];
    expect(placed.paymentStatus).toBe('awaiting_transfer');
    expect(placed.paymentInstructions).not.toBeNull();
    expect(required(storeOrderResponseSerializer(await orders.submitPaymentProof(placed.id, { transactionId: `TXN ${run}`, imageUrl: null }))).paymentStatus).toBe('proof_submitted');

    await asStore();
    const held = await storeView(partnerOrders.fetchPartnerOrder(placed.id));
    expect(held.allowedActions).toEqual(['confirm', 'cancel', 'confirm_payment', 'reject_payment']);
    expect((await storeView(partnerOrders.confirmPayment(placed.id))).paymentStatus).toBe('paid');
    const cancelled = await storeView(partnerOrders.cancelPartnerOrder(placed.id, 'This colour is out of stock.'));
    expect([cancelled.status, cancelled.paymentStatus, cancelled.allowedActions]).toEqual(['cancelled', 'refund_due', ['refund']]);
    expect(required(partnerOrderPageSerializer(await partnerOrders.fetchPartnerOrders({ paymentStatus: 'refund_due' }, 1))).items.map(o => o.id)).toContain(placed.id);
    const done = await storeView(partnerOrders.recordOrderRefund(placed.id, { amount: placed.total, reference: `RAAST-${run}-2` }));
    expect([done.paymentStatus, done.allowedActions]).toEqual(['refunded', []]);
  });

  it('7. the store’s tools: settings and pause, profile, accounts, collections, coupons, products, stock, insights', async () => {
    await asStore();
    const settings = storeSettingsSerializer(await store.fetchStoreSettings());
    expect(storeSettingsSerializer(await store.updateStoreSettings(settings))).toEqual(settings);
    expect(pauseStateSerializer(await store.pauseStore('Back on Monday'))).toEqual({ isPaused: true, pauseMessage: 'Back on Monday' });
    expect(pauseStateSerializer(await store.resumeStore())).toEqual({ isPaused: false, pauseMessage: null });
    const profile = required(storeProfileSerializer(await store.fetchStoreProfile()));
    const input = { tagline: profile.tagline, about: profile.about, logoUrl: profile.logoUrl, coverUrl: profile.coverUrl, brandColor: profile.brandColor, onBrandColor: profile.onBrandColor, socials: profile.socials, phone: profile.phone, whatsapp: profile.whatsapp };
    expect(required(storeProfileSerializer(await store.updateStoreProfile(input, profile)))).toMatchObject({ tagline: profile.tagline, brandColor: profile.brandColor });
    // A phone customers may call: on the storefront once the store adds one, then back as it was (the demo has none).
    const phone = mobile();
    expect(required(storeProfileSerializer(await store.updateStoreProfile({ ...input, phone }, profile))).phone).toBe(phone);
    await asCustomer();
    expect(required(storeDetailSerializer(await catalog.fetchStore('lahore-loom'))).phone).toBe(phone);
    await asStore();
    expect(required(storeProfileSerializer(await store.updateStoreProfile(input, profile))).phone).toBe(profile.phone);
    expect(paymentAccountListSerializer(await store.fetchPaymentAccounts()).length).toBeGreaterThan(0);

    const col = required(collectionSerializer(await products.createCollection(`Live ${run}`)));
    expect(required(collectionSerializer(await products.renameCollection(col.id, `Live ${run} 2`))).name).toBe(`Live ${run} 2`);
    const all = collectionListSerializer(await products.fetchCollections());
    expect(collectionListSerializer(await products.reorderCollections([col.id, ...all.filter(c => c.id !== col.id).map(c => c.id)]))[0].id).toBe(col.id);
    await products.deleteCollection(col.id);

    const coupon = required(couponSerializer(await coupons.createCoupon({ code: `LV${run.slice(-6).toUpperCase()}`, type: 'percent', value: 10, minOrder: 1000, maxDiscount: 500, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), usageLimit: 50, perCustomerLimit: 1, isActive: true })));
    expect(coupon.status).toBe('active');
    expect(required(couponSerializer(await coupons.deactivateCoupon(coupon.id))).status).toBe('inactive');

    const draft = required(partnerProductSerializer(await products.createPartnerProduct({ name: `Live kurta ${run}`, description: 'A plain cotton kurta.', categoryId: product.categoryId, collectionId: null, price: 2500, salePrice: null, status: 'draft', images: [], option1: { name: 'Size', values: ['S', 'M'] }, option2: null, variants: [{ id: null, option1: 'S', option2: null, sku: '', stock: 3, priceDelta: 0 }, { id: null, option1: 'M', option2: null, sku: '', stock: 0, priceDelta: 0 }] })));
    expect(draft).toMatchObject({ status: 'draft', price: 2500, option1: { name: 'Size', values: ['S', 'M'] } });
    const blocked = await failure(products.setPartnerProductStatus(draft.id, 'active'));
    expect([blocked.status, blocked.code]).toEqual([400, 'VALIDATION_FAILED']);
    expect(required(partnerProductSerializer(await products.setPartnerProductStatus(draft.id, 'archived'))).status).toBe('archived');

    const rows = required(inventoryRowPageSerializer(await inventory.fetchInventory({}, 1, 3))).items;
    const row = rows[0];
    expect(required(stockLevelResponseSerializer(await inventory.setStock(row.variantId, row.stock))).stock).toBe(row.stock);
    expect(stockLevelListSerializer(await inventory.bulkSetStock([row.variantId], row.stock))).toHaveLength(1);
    expect(Array.isArray(movementListSerializer(await inventory.fetchMovements(row.variantId)))).toBe(true);
    expect(insightsSerializer(await insights.fetchInsights('30d')).range).toBe('30d');
  });
});
