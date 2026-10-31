// The App ↔ API contract for Shopping, addresses and notifications. Every
// network function runs against a capturing axios adapter, and each request
// must be an operation in docs/openapi.json (method and path template), its
// body and query only the fields the backend's DTO declares, with the
// required ones present. Bodies and queries come from the DTO classes, not
// the OpenAPI schemas: Swagger merges Shopping DTOs that share a class name
// (the cart's, a review's, a refund's …), and leaves some query fields out.

// First: the API URL network.ts reads when it loads (a real base URL, so no CONFIG_ERROR).
import '../../__fixtures__/testApiUrl';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import spec from '../../docs/openapi.json';
import { MainAxiosInstance } from '../network/network';
import { setTokens } from '../../utils/storage_utils/storageUtils';
import * as cart from '../shopping/cart';
import * as catalog from '../shopping/catalog';
import * as checkout from '../shopping/checkout';
import * as orders from '../shopping/orders';
import * as returns from '../shopping/returns';
import * as reviews from '../shopping/reviews';
import * as wishlist from '../shopping/wishlist';
import * as coupons from '../shopping/partner/coupons';
import * as insights from '../shopping/partner/insights';
import * as inventory from '../shopping/partner/inventory';
import * as partnerOrders from '../shopping/partner/partnerOrders';
import * as partnerReturns from '../shopping/partner/partnerReturns';
import * as partnerReviews from '../shopping/partner/partnerReviews';
import * as products from '../shopping/partner/products';
import * as store from '../shopping/partner/store';
import * as adminShop from '../admin/adminShop';
import * as addresses from '../addresses/addresses';
import * as notifications from '../notifications/notifications';
import type { AddressInput, CheckoutInput, CouponInput, PartnerProductInput, StoreSettings } from '../../models/shopping';

const openapi = spec as unknown as { paths: Record<string, Record<string, unknown>> };

interface Captured {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, unknown>;
}

let sent: Captured[] = [];

const capture = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const raw = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  sent.push({
    method: (config.method ?? 'get').toUpperCase(),
    path: new URL(`${config.baseURL}${config.url}`).pathname,
    query: { ...(config.params ?? {}) },
    body: raw ?? undefined,
    headers: { ...(config.headers ?? {}) },
  });
  return Promise.resolve({ data: { success: true, data: {} }, status: 200, statusText: 'OK', headers: {}, config });
};

beforeAll(() => {
  MainAxiosInstance.defaults.adapter = capture as never;
});

beforeEach(async () => {
  sent = [];
  await setTokens('access-1', 'refresh-1');
});

const run = async (call: () => Promise<unknown>): Promise<Captured[]> => {
  await call().catch(() => undefined);
  return sent;
};

const templates = Object.keys(openapi.paths).map(template => ({
  template,
  pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
}));
const templateFor = (method: string, path: string) =>
  templates.find(t => t.pattern.test(path) && openapi.paths[t.template][method.toLowerCase()])?.template.replace('/api/v1', '') ?? null;

// ─── The backend's DTOs (MetroMatrix-API src/modules) ──
const PAGE = ['page', 'pageSize'];
const REASON = { body: ['reason'], required: ['reason'] };
const ADDRESS = ['label', 'fullName', 'phone', 'city', 'area', 'line1', 'landmark', 'lat', 'lng', 'isDefault'];
const CHECKOUT = { body: ['addressId', 'stores'], required: ['addressId', 'stores'] };
const PRODUCT = ['name', 'description', 'categoryId', 'collectionId', 'basePrice', 'salePrice', 'tags', 'images', 'variants', 'status', 'packQty', 'packUnit'];
const COUPON = ['type', 'value', 'minOrder', 'maxDiscount', 'startsAt', 'endsAt', 'usageLimit', 'perUserLimit'];
const BANNER = ['imageUrl', 'title', 'subtitle', 'targetType', 'targetId', 'startsAt', 'endsAt', 'sort', 'isActive'];
const ACCOUNT = ['kind', 'accountTitle', 'accountNumber', 'bankName', 'isActive'];

type Dto = { body?: string[]; required?: string[]; query?: string[]; array?: string[] };
const DTO: Record<string, Dto> = {
  'GET /shop/stores': { query: [...PAGE, 'q', 'categoryId', 'city', 'featured'] },
  'GET /shop/products': { query: [...PAGE, 'q', 'storeId', 'categoryId', 'collectionId', 'minPrice', 'maxPrice', 'inStock', 'minRating', 'onSale', 'sort'] },
  'GET /shop/products/suggest': { query: ['q'] },
  'GET /shop/products/{id}/reviews': { query: [...PAGE, 'rating', 'withPhotos'] },
  'POST /shop/products/{id}/report': { body: ['reason', 'details'], required: ['reason'] },
  'GET /shop/wishlist': { query: PAGE },
  'POST /shop/cart/items': { body: ['variantId', 'quantity'], required: ['variantId', 'quantity'] },
  'PATCH /shop/cart/items/{id}': { body: ['quantity'], required: ['quantity'] },
  'POST /shop/cart/preview': CHECKOUT,
  'POST /shop/checkout': CHECKOUT,
  'GET /shop/orders': { query: [...PAGE, 'status'] },
  'POST /shop/store-orders/{id}/cancel': REASON,
  'POST /shop/store-orders/{id}/request-cancel': REASON,
  'POST /shop/store-orders/{id}/payment-proof': { body: ['paymentRef', 'proofUrl'], required: ['paymentRef'] },
  'POST /shop/store-orders/{id}/returns': { body: ['items', 'reason', 'details', 'photos'], required: ['items', 'reason'] },
  'GET /shop/returns': { query: PAGE },
  'POST /shop/order-items/{id}/review': { body: ['rating', 'text', 'photos'], required: ['rating'] },
  'PATCH /shop/partner/store': { body: ['tagline', 'about', 'logoUrl', 'coverUrl', 'brandColor', 'socials', 'phone'] },
  'PATCH /shop/partner/store/settings': {
    body: ['returnWindowDays', 'codEnabled', 'codLimit', 'shippingFlatFee', 'freeShippingOver', 'deliveryCities', 'dispatchDaysMin', 'dispatchDaysMax', 'isPaused', 'pauseMessage'],
  },
  'POST /shop/partner/store/payment-accounts': { body: ACCOUNT, required: ['kind', 'accountTitle', 'accountNumber'] },
  'PATCH /shop/partner/store/payment-accounts/{id}': { body: ACCOUNT },
  'GET /shop/partner/insights': { query: ['range'] },
  'GET /shop/partner/orders': { query: [...PAGE, 'status', 'paymentStatus', 'q'] },
  'PATCH /shop/partner/orders/{id}/note': { body: ['note'], required: ['note'] },
  'POST /shop/partner/orders/{id}/ship': { body: ['courierName', 'trackingRef', 'riderName', 'riderPhone'], required: ['courierName'] },
  'POST /shop/partner/orders/{id}/cancel': REASON,
  'POST /shop/partner/orders/{id}/payment/reject': REASON,
  'POST /shop/partner/orders/{id}/refund': { body: ['amount', 'refundRef'], required: ['amount', 'refundRef'] },
  'GET /shop/partner/products': { query: [...PAGE, 'status', 'q', 'collectionId', 'lowStock'] },
  'POST /shop/partner/products': { body: PRODUCT, required: ['name', 'description', 'categoryId', 'basePrice'] },
  'PATCH /shop/partner/products/{id}': { body: PRODUCT },
  'POST /shop/partner/collections': { body: ['name'], required: ['name'] },
  'PATCH /shop/partner/collections/{id}': { body: ['name'] },
  'PATCH /shop/partner/collections/reorder': { body: ['ids'], required: ['ids'] },
  'GET /shop/partner/inventory': { query: [...PAGE, 'lowStock', 'q'] },
  'PATCH /shop/partner/inventory/{variantId}': { body: ['delta', 'setTo'] },
  'POST /shop/partner/inventory/bulk': { array: ['variantId', 'setTo'] },
  'GET /shop/partner/inventory/{variantId}/movements': { query: PAGE },
  'GET /shop/partner/coupons': { query: [...PAGE, 'state'] },
  'POST /shop/partner/coupons': { body: ['code', ...COUPON], required: ['code', 'type', 'value', 'endsAt'] },
  'PATCH /shop/partner/coupons/{id}': { body: [...COUPON, 'isActive'] },
  'GET /shop/partner/returns': { query: [...PAGE, 'status'] },
  'POST /shop/partner/returns/{id}/approve': { body: ['note'] },
  'POST /shop/partner/returns/{id}/reject': { body: ['note'], required: ['note'] },
  'POST /shop/partner/returns/{id}/receive': { body: ['items'] },
  'POST /shop/partner/returns/{id}/refund': { body: ['amount', 'refundRef'], required: ['amount', 'refundRef'] },
  'GET /shop/partner/reviews': { query: [...PAGE, 'rating', 'unreplied'] },
  'POST /shop/partner/reviews/{id}/reply': { body: ['text'], required: ['text'] },
  'POST /admin/shop/categories': { body: ['name', 'slug', 'parentId', 'icon', 'sort'], required: ['name'] },
  'PUT /admin/shop/categories/order': { body: ['parentId', 'ids'], required: ['ids'] },
  'GET /admin/shop/stores': { query: [...PAGE, 'q', 'status'] },
  'PATCH /admin/shop/categories/{id}': { body: ['name', 'slug', 'parentId', 'icon', 'sort', 'isActive'] },
  'POST /admin/shop/banners': { body: BANNER, required: ['imageUrl', 'title', 'targetType'] },
  'PATCH /admin/shop/banners/{id}': { body: BANNER },
  'GET /admin/shop/reports': { query: [...PAGE, 'status'] },
  'POST /admin/shop/reports/{id}/dismiss': { body: ['note'] },
  'POST /admin/shop/products/{id}/remove': REASON,
  'GET /admin/shop/orders': { query: [...PAGE, 'code', 'storeId', 'status'] },
  'POST /addresses': { body: ADDRESS, required: ['fullName', 'phone', 'city', 'area', 'line1'] },
  'PATCH /addresses/{id}': { body: ADDRESS },
  'GET /notifications': { query: [...PAGE, 'unread'] },
};

const keys = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v as object) : []);

/** Problems with one captured request (empty = it matches the contract). */
const problems = (req: Captured): string[] => {
  const template = templateFor(req.method, req.path);
  if (!template) return [`${req.method} ${req.path} is not in openapi.json`];
  const op = `${req.method} ${template}`;
  const dto = DTO[op] ?? {};
  const out: string[] = [];
  for (const k of keys(req.query)) if (!(dto.query ?? []).includes(k)) out.push(`${op}: query "${k}" is not in the DTO`);
  if (dto.array) {
    if (!Array.isArray(req.body)) return [...out, `${op}: the body is an array`];
    for (const row of req.body) for (const k of keys(row)) if (!dto.array.includes(k)) out.push(`${op}: "${k}" is not in the row DTO`);
    return out;
  }
  for (const k of keys(req.body)) if (!(dto.body ?? []).includes(k)) out.push(`${op}: "${k}" is not in the DTO`);
  for (const k of dto.required ?? []) if (!keys(req.body).includes(k)) out.push(`${op}: required "${k}" is missing`);
  return out;
};

// ─── Inputs ─────────────────────────────────────────
const CHECKOUT_INPUT: CheckoutInput = { addressId: 'a1', stores: [{ storeId: 's1', paymentMethod: 'cod', couponCode: 'EID10', note: 'Ring twice' }] };
const SETTINGS: StoreSettings = {
  shippingFee: 200,
  freeShippingOver: 5000,
  nationwide: false,
  deliveryCities: ['Lahore'],
  dispatchMinDays: 1,
  dispatchMaxDays: 3,
  returnWindowDays: 7,
  codEnabled: true,
  codLimit: null,
  isPaused: true,
  pauseMessage: 'Back on Monday',
};
const PRODUCT_INPUT: PartnerProductInput = {
  name: 'Lawn kurta',
  description: 'Cotton lawn.',
  categoryId: 'c1',
  collectionId: null,
  price: 2500,
  salePrice: 2200,
  status: 'active',
  images: [{ url: 'https://img/1.png', publicId: 'p/1' }],
  option1: { name: 'Size', values: ['S'] },
  option2: { name: 'Colour', values: ['Rust'], swatches: { Rust: '#B7410E' } },
  variants: [{ id: 'v1', option1: 'S', option2: 'Rust', sku: 'LK-S', stock: 4, priceDelta: 0 }],
};
const COUPON_INPUT: CouponInput = {
  code: 'EID10',
  type: 'percent',
  value: 10,
  minOrder: 1000,
  maxDiscount: 500,
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-11-15T00:00:00.000Z',
  usageLimit: 50,
  perCustomerLimit: 1,
  isActive: true,
};
const ADDRESS_INPUT: AddressInput = { label: 'home', fullName: 'Ayesha Khan', phone: '+923000000000', city: 'Lahore', area: 'Gulberg', line1: 'House 12', landmark: null, lat: null, lng: null };

const CASES: [string, () => Promise<unknown>, string[]][] = [
  ['fetchShopHome', () => catalog.fetchShopHome(), ['GET /shop/home']],
  ['fetchCategories', () => catalog.fetchCategories(), ['GET /shop/categories']],
  ['fetchStores', () => catalog.fetchStores({ q: 'loom', city: 'Lahore', categoryId: 'c1', featured: true }, 2), ['GET /shop/stores']],
  ['fetchStore', () => catalog.fetchStore('lahore-loom'), ['GET /shop/stores/{slug}']],
  ['fetchProducts', () => catalog.fetchProducts({ q: 'kurta', storeId: 's1', categoryId: 'c1', collectionId: 'col1', sort: 'trending', minPrice: 1000, maxPrice: 5000, minRating: 4, inStock: true, onSale: true }, 1), ['GET /shop/products']],
  ['suggestProducts', () => catalog.suggestProducts('kur'), ['GET /shop/products/suggest']],
  ['fetchProduct', () => catalog.fetchProduct('p1'), ['GET /shop/products/{id}']],
  ['fetchRelatedProducts', () => catalog.fetchRelatedProducts('p1'), ['GET /shop/products/{id}/related']],
  ['fetchReviews', () => catalog.fetchReviews('p1', { rating: 5, withPhotos: true }, 1), ['GET /shop/products/{id}/reviews']],
  ['reportProduct', () => catalog.reportProduct('p1', { reason: 'Counterfeit or copy', details: 'A branded watch.' }), ['POST /shop/products/{id}/report']],
  ['fetchWishlist', () => wishlist.fetchWishlist(1), ['GET /shop/wishlist']],
  ['fetchWishlistIds', () => wishlist.fetchWishlistIds(), ['GET /shop/wishlist']],
  ['saveProduct', () => wishlist.saveProduct('p1'), ['POST /shop/wishlist/{productId}']],
  ['unsaveProduct', () => wishlist.unsaveProduct('p1'), ['DELETE /shop/wishlist/{productId}']],
  ['fetchCart', () => cart.fetchCart(), ['GET /shop/cart']],
  ['addToCart', () => cart.addToCart('v1', 2), ['POST /shop/cart/items']],
  ['updateCartLine', () => cart.updateCartLine('l1', 3), ['PATCH /shop/cart/items/{id}']],
  ['removeCartLine', () => cart.removeCartLine('l1'), ['DELETE /shop/cart/items/{id}']],
  ['clearCart', () => cart.clearCart(), ['DELETE /shop/cart']],
  ['previewCheckout', () => checkout.previewCheckout(CHECKOUT_INPUT), ['POST /shop/cart/preview']],
  ['fetchAvailableCoupons', () => checkout.fetchAvailableCoupons('s1'), ['GET /shop/stores/{id}/coupons/available']],
  ['placeOrder', () => checkout.placeOrder(CHECKOUT_INPUT, 'key-1'), ['POST /shop/checkout']],
  ['fetchOrders', () => orders.fetchOrders('active', 1), ['GET /shop/orders']],
  ['fetchOrderGroup', () => orders.fetchOrderGroup('MM-24A7Q2'), ['GET /shop/orders/{groupCode}']],
  ['fetchStoreOrder', () => orders.fetchStoreOrder('so1'), ['GET /shop/store-orders/{id}']],
  ['cancelOrder', () => orders.cancelOrder('so1', 'Ordered the wrong size.'), ['POST /shop/store-orders/{id}/cancel']],
  ['requestCancellation', () => orders.requestCancellation('so1', 'Found it cheaper.'), ['POST /shop/store-orders/{id}/request-cancel']],
  ['confirmReceived', () => orders.confirmReceived('so1'), ['POST /shop/store-orders/{id}/received']],
  ['submitPaymentProof', () => orders.submitPaymentProof('so1', { transactionId: 'TXN 1', imageUrl: 'https://img/p.png' }), ['POST /shop/store-orders/{id}/payment-proof']],
  ['requestReturn', () => returns.requestReturn('so1', { reason: 'size_issue', details: 'Tight.', photos: [], items: [{ orderItemId: 'oi1', quantity: 1 }] }), ['POST /shop/store-orders/{id}/returns']],
  ['fetchReturns', () => returns.fetchReturns(1), ['GET /shop/returns']],
  ['fetchReturn', () => returns.fetchReturn('r1'), ['GET /shop/returns/{id}']],
  ['writeReview', () => reviews.writeReview('oi1', { rating: 5, title: 'Lovely', body: 'True to size.', photos: [] }), ['POST /shop/order-items/{id}/review']],

  ['fetchDashboard', () => store.fetchDashboard(), ['GET /shop/partner/dashboard']],
  ['fetchStoreProfile', () => store.fetchStoreProfile(), ['GET /shop/partner/store']],
  [
    'updateStoreProfile',
    () =>
      store.updateStoreProfile({
        tagline: 'Hand-finished lawn',
        about: 'Since 2009.',
        logoUrl: null,
        coverUrl: null,
        brandColor: '#7F1D1D',
        onBrandColor: '#FFFFFF',
        socials: { instagram: '@loom', facebook: null, tiktok: null, website: null },
        phone: '+923000000000',
        whatsapp: '+923000000000',
      }),
    ['PATCH /shop/partner/store'],
  ],
  ['fetchStoreSettings', () => store.fetchStoreSettings(), ['GET /shop/partner/store/settings']],
  ['updateStoreSettings', () => store.updateStoreSettings(SETTINGS), ['PATCH /shop/partner/store/settings']],
  ['pauseStore', () => store.pauseStore('Back on Monday'), ['PATCH /shop/partner/store/settings']],
  ['resumeStore', () => store.resumeStore(), ['PATCH /shop/partner/store/settings']],
  ['fetchPaymentAccounts', () => store.fetchPaymentAccounts(), ['GET /shop/partner/store/payment-accounts']],
  ['createPaymentAccount', () => store.createPaymentAccount({ kind: 'bank', title: 'Lahore Loom', number: 'PK00TEST0000000000000000', bankName: 'Meezan', isActive: true }), ['POST /shop/partner/store/payment-accounts']],
  ['updatePaymentAccount', () => store.updatePaymentAccount('pa1', { kind: 'jazzcash', title: 'Lahore Loom', number: '03001234567', bankName: null, isActive: false }), ['PATCH /shop/partner/store/payment-accounts/{id}']],
  ['deletePaymentAccount', () => store.deletePaymentAccount('pa1'), ['DELETE /shop/partner/store/payment-accounts/{id}']],
  ['fetchInsights', () => insights.fetchInsights('30d'), ['GET /shop/partner/insights']],
  ['fetchPartnerOrders (a tab)', () => partnerOrders.fetchPartnerOrders({ segment: 'completed', q: 'MM-24' }, 1), ['GET /shop/partner/orders']],
  ['fetchPartnerOrders (refunds)', () => partnerOrders.fetchPartnerOrders({ paymentStatus: 'refund_due' }, 1), ['GET /shop/partner/orders']],
  ['fetchPartnerOrder', () => partnerOrders.fetchPartnerOrder('so1'), ['GET /shop/partner/orders/{id}']],
  ['saveInternalNote', () => partnerOrders.saveInternalNote('so1', 'Packed by Ali; fragile.'), ['PATCH /shop/partner/orders/{id}/note']],
  ['saveInternalNote (cleared)', () => partnerOrders.saveInternalNote('so1', '  '), ['PATCH /shop/partner/orders/{id}/note']],
  ['confirmOrder', () => partnerOrders.confirmOrder('so1'), ['POST /shop/partner/orders/{id}/confirm']],
  ['packOrder', () => partnerOrders.packOrder('so1'), ['POST /shop/partner/orders/{id}/pack']],
  ['shipOrder (courier)', () => partnerOrders.shipOrder('so1', { courier: 'tcs', trackingRef: 'TCS-1' }), ['POST /shop/partner/orders/{id}/ship']],
  ['shipOrder (own rider)', () => partnerOrders.shipOrder('so1', { courier: 'own_rider', riderName: 'Ali', riderPhone: '+923000000000' }), ['POST /shop/partner/orders/{id}/ship']],
  ['deliverOrder', () => partnerOrders.deliverOrder('so1'), ['POST /shop/partner/orders/{id}/deliver']],
  ['cancelPartnerOrder', () => partnerOrders.cancelPartnerOrder('so1', 'Sold out in this size.'), ['POST /shop/partner/orders/{id}/cancel']],
  ['approveCancellation', () => partnerOrders.approveCancellation('so1'), ['POST /shop/partner/orders/{id}/cancel']],
  ['confirmPayment', () => partnerOrders.confirmPayment('so1'), ['POST /shop/partner/orders/{id}/payment/confirm']],
  ['rejectPayment', () => partnerOrders.rejectPayment('so1', 'No transfer yet.'), ['POST /shop/partner/orders/{id}/payment/reject']],
  ['markCashCollected', () => partnerOrders.markCashCollected('so1'), ['POST /shop/partner/orders/{id}/cash-collected']],
  ['recordOrderRefund', () => partnerOrders.recordOrderRefund('so1', { amount: 2500, reference: 'IBFT-1' }), ['POST /shop/partner/orders/{id}/refund']],
  ['fetchPartnerProducts', () => products.fetchPartnerProducts({ status: 'active', q: 'kurta', lowStock: true }, 1), ['GET /shop/partner/products']],
  ['fetchPartnerProduct', () => products.fetchPartnerProduct('p1'), ['GET /shop/partner/products/{id}']],
  ['createPartnerProduct', () => products.createPartnerProduct(PRODUCT_INPUT), ['POST /shop/partner/products']],
  ['updatePartnerProduct', () => products.updatePartnerProduct('p1', PRODUCT_INPUT), ['PATCH /shop/partner/products/{id}']],
  ['setPartnerProductStatus', () => products.setPartnerProductStatus('p1', 'archived'), ['PATCH /shop/partner/products/{id}']],
  ['fetchCollections', () => products.fetchCollections(), ['GET /shop/partner/collections']],
  ['createCollection', () => products.createCollection('Eid edit'), ['POST /shop/partner/collections']],
  ['renameCollection', () => products.renameCollection('col1', 'Eid edit 2'), ['PATCH /shop/partner/collections/{id}']],
  ['deleteCollection', () => products.deleteCollection('col1'), ['DELETE /shop/partner/collections/{id}']],
  ['reorderCollections', () => products.reorderCollections(['col2', 'col1']), ['PATCH /shop/partner/collections/reorder']],
  ['fetchInventory', () => inventory.fetchInventory({ q: 'kurta', lowStock: true }, 1), ['GET /shop/partner/inventory']],
  ['setStock', () => inventory.setStock('v1', 7), ['PATCH /shop/partner/inventory/{variantId}']],
  ['bulkSetStock', () => inventory.bulkSetStock(['v1', 'v2'], 0), ['POST /shop/partner/inventory/bulk']],
  ['fetchMovements', () => inventory.fetchMovements('v1'), ['GET /shop/partner/inventory/{variantId}/movements']],
  ['fetchCoupons', () => coupons.fetchCoupons(), ['GET /shop/partner/coupons']],
  ['createCoupon', () => coupons.createCoupon(COUPON_INPUT), ['POST /shop/partner/coupons']],
  ['updateCoupon', () => coupons.updateCoupon('cp1', COUPON_INPUT), ['PATCH /shop/partner/coupons/{id}']],
  ['deactivateCoupon', () => coupons.deactivateCoupon('cp1'), ['POST /shop/partner/coupons/{id}/deactivate']],
  ['fetchPartnerReturns', () => partnerReturns.fetchPartnerReturns('requested', 1), ['GET /shop/partner/returns']],
  ['fetchPartnerReturn', () => partnerReturns.fetchPartnerReturn('r1'), ['GET /shop/partner/returns/{id}']],
  ['approveReturn', () => partnerReturns.approveReturn('r1', 'Send it back with the tag on.'), ['POST /shop/partner/returns/{id}/approve']],
  ['rejectReturn', () => partnerReturns.rejectReturn('r1', 'Worn and washed.'), ['POST /shop/partner/returns/{id}/reject']],
  ['receiveReturn', () => partnerReturns.receiveReturn('r1', { ri1: true }), ['POST /shop/partner/returns/{id}/receive']],
  ['recordRefund', () => partnerReturns.recordRefund('r1', { amount: 2500, reference: 'IBFT-2' }), ['POST /shop/partner/returns/{id}/refund']],
  ['fetchPartnerReviews', () => partnerReviews.fetchPartnerReviews({ rating: 5, unreplied: true }, 1), ['GET /shop/partner/reviews']],
  ['replyToReview', () => partnerReviews.replyToReview('rv1', 'Thank you!'), ['POST /shop/partner/reviews/{id}/reply']],

  ['fetchShopOverview', () => adminShop.fetchShopOverview(), ['GET /admin/shop/overview']],
  ['fetchAdminCategories', () => adminShop.fetchAdminCategories(), ['GET /admin/shop/categories']],
  ['reorderCategories', () => adminShop.reorderCategories(null, ['c2', 'c1']), ['PUT /admin/shop/categories/order']],
  ['fetchAdminStores', () => adminShop.fetchAdminStores('loom', 1), ['GET /admin/shop/stores']],
  ['createCategory', () => adminShop.createCategory({ name: 'Bags', icon: 'bag-outline', parentId: null }), ['POST /admin/shop/categories']],
  ['updateCategory', () => adminShop.updateCategory('c1', { sort: 2 }), ['PATCH /admin/shop/categories/{id}']],
  ['deleteCategory', () => adminShop.deleteCategory('c1'), ['DELETE /admin/shop/categories/{id}']],
  ['fetchAdminBanners', () => adminShop.fetchAdminBanners(), ['GET /admin/shop/banners']],
  [
    'createBanner',
    () =>
      adminShop.createBanner({
        imageUrl: 'https://img/b.png',
        headline: 'Winter sale',
        subhead: null,
        target: { kind: 'store', id: 's1', slug: 'lahore-loom' },
        startsAt: '2026-11-01T00:00:00.000Z',
        endsAt: null,
        position: 0,
        isActive: true,
      }),
    ['POST /admin/shop/banners'],
  ],
  [
    'updateBanner',
    () =>
      adminShop.updateBanner('b1', {
        imageUrl: 'https://img/b.png',
        headline: 'Winter sale',
        subhead: 'Lawn and khaddar',
        target: { kind: 'none' },
        startsAt: '2026-11-01T00:00:00.000Z',
        endsAt: '2026-11-30T00:00:00.000Z',
        position: 1,
        isActive: false,
      }),
    ['PATCH /admin/shop/banners/{id}'],
  ],
  ['deleteBanner', () => adminShop.deleteBanner('b1'), ['DELETE /admin/shop/banners/{id}']],
  ['fetchReports', () => adminShop.fetchReports('removed', 1), ['GET /admin/shop/reports']],
  ['dismissReport', () => adminShop.dismissReport('rp1'), ['POST /admin/shop/reports/{id}/dismiss']],
  ['removeProduct', () => adminShop.removeProduct('p1', 'Counterfeit goods are not allowed.'), ['POST /admin/shop/products/{id}/remove']],
  ['fetchAdminOrders', () => adminShop.fetchAdminOrders({ code: 'MM-24A7Q2' }, 1), ['GET /admin/shop/orders']],
  ['fetchAdminOrder', () => adminShop.fetchAdminOrder('so1'), ['GET /admin/shop/orders/{id}']],
  ['setStoreFeatured (on)', () => adminShop.setStoreFeatured('s1', true), ['POST /admin/shop/stores/{id}/feature']],
  ['setStoreFeatured (off)', () => adminShop.setStoreFeatured('s1', false), ['POST /admin/shop/stores/{id}/unfeature']],

  ['fetchAddresses', () => addresses.fetchAddresses(), ['GET /addresses']],
  ['createAddress', () => addresses.createAddress(ADDRESS_INPUT), ['POST /addresses']],
  ['updateAddress', () => addresses.updateAddress('a1', ADDRESS_INPUT), ['PATCH /addresses/{id}']],
  ['deleteAddress', () => addresses.deleteAddress('a1'), ['DELETE /addresses/{id}']],
  ['setDefaultAddress', () => addresses.setDefaultAddress('a1'), ['POST /addresses/{id}/default']],
  ['fetchNotifications', () => notifications.fetchNotifications(1), ['GET /notifications']],
  ['fetchUnreadCount', () => notifications.fetchUnreadCount(), ['GET /notifications/unread-count']],
  ['markNotificationRead', () => notifications.markNotificationRead('n1'), ['POST /notifications/{id}/read']],
  ['markAllNotificationsRead', () => notifications.markAllNotificationsRead(), ['POST /notifications/read-all']],
];

/** Documented operations the app doesn't call, and why. */
const NOT_CALLED: Record<string, string> = {
  'GET /addresses/{id}': 'the address book reads the list',
  'GET /shop/partner/coupons/{id}': 'the coupon form opens from the list it has',
  'POST /shop/partner/products/{id}/duplicate': 'the store app has no duplicate action',
  'DELETE /shop/partner/products/{id}': 'products are archived, not deleted',
  'POST /shop/partner/orders/{id}/reject': 'a new order is cancelled with a reason instead',
  'POST /admin/shop/products/{id}/restore': 'the console has no restore action',
  'POST /admin/shop/reviews/{id}/hide': 'the console has no Shopping review moderation',
  'POST /admin/shop/reviews/{id}/unhide': 'the console has no Shopping review moderation',
};

describe('App ↔ API contract, Shopping (docs/openapi.json + the backend DTOs)', () => {
  it.each(CASES)('%s', async (_name, call, expected) => {
    const reqs = await run(call);
    expect(reqs.map(r => `${r.method} ${templateFor(r.method, r.path) ?? r.path}`)).toEqual(expected);
    expect(reqs.flatMap(problems)).toEqual([]);
  });

  it('places an order with an Idempotency-Key', async () => {
    const [req] = await run(() => checkout.placeOrder(CHECKOUT_INPUT, 'key-9'));
    expect(req.headers['Idempotency-Key']).toBe('key-9');
  });

  it('calls every documented Shopping, address and notification operation, or says why not', async () => {
    const called = new Set<string>();
    for (const [, call] of CASES) {
      sent = [];
      for (const r of await run(call)) called.add(`${r.method} ${templateFor(r.method, r.path)}`);
    }
    const documented = Object.entries(openapi.paths)
      .filter(([p]) => /^\/api\/v1\/(shop|admin\/shop|addresses|notifications)(\/|$)/.test(p))
      .flatMap(([p, ops]) => Object.keys(ops).map(m => `${m.toUpperCase()} ${p.replace('/api/v1', '')}`));
    expect(documented.filter(op => !called.has(op) && !NOT_CALLED[op])).toEqual([]);
    expect(Object.keys(NOT_CALLED).filter(op => called.has(op))).toEqual([]);
  });
});
