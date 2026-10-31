// Real MetroMatrix-API Shopping responses (captured end to end on a local
// backend's seed:shopping demo by scripts/capture-shop-fixtures.js: the
// catalogue, the bag, checkout, the orders a customer and a store move, a
// transfer, returns and reviews) through the customer's Shopping serializers.

import real from './fixtures/shop/real.json';
import {
  categoryListSerializer,
  productDetailSerializer,
  productReviewsSerializer,
  reviewSerializer,
  shopHomeSerializer,
  storeDetailSerializer,
  storeSummaryPageSerializer,
  suggestionListSerializer,
  wishlistIdsSerializer,
} from '../shopping/catalogSerializer';
import { availableCouponListSerializer, cartSerializer, checkoutPreviewSerializer } from '../shopping/cartSerializer';
import {
  orderGroupSerializer,
  orderGroupSummaryPageSerializer,
  returnPageSerializer,
  returnSerializer,
  storeOrderResponseSerializer,
} from '../shopping/orderSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const body = (k: string) => R[k].body;
const error = (k: string) => R[k].body.error;

describe('the catalogue', () => {
  it('reads the home: banners with their targets, categories, featured stores and new arrivals', () => {
    const h = shopHomeSerializer(body('home'))!;
    expect(h.banners).toHaveLength(3);
    expect(h.banners[0]).toMatchObject({ headline: 'The Eid edit is here', subhead: 'Lawn, silk and khussas from Lahore Loom', target: { kind: 'collection' } });
    expect(h.categories.map(c => c.name)).toContain('Women');
    expect(h.featuredStores.map(s => s.name)).toContain('Lahore Loom');
    expect(h.newThisWeek).toHaveLength(3);
  });

  it('reads the category tree with each child under its parent', () => {
    const tree = categoryListSerializer(body('categories'))!;
    const women = tree.find(c => c.slug === 'women')!;
    expect(women.parentId).toBeNull();
    expect(women.children.find(c => c.name === 'Kurtas & tunics')).toMatchObject({ parentId: women.id });
  });

  it('reads a page of stores with their ratings', () => {
    const page = storeSummaryPageSerializer(body('stores'))!;
    expect(page.items[0]).toMatchObject({ name: 'Haath Kaari', city: 'Multan', rating: 5, ratingCount: 2, isFeatured: true, isPaused: false, productCount: 18 });
  });

  it('reads a store page: its policies, collections and no public phone', () => {
    const s = storeDetailSerializer(body('store'))!;
    expect(s).toMatchObject({ slug: 'lahore-loom', name: 'Lahore Loom', city: 'Lahore', brandColor: '#7F1D1D', phone: null, whatsapp: null });
    expect(s.about).toMatch(/^A family workshop in Gulberg/);
    expect(s.policies).toEqual({
      shippingFee: 200,
      freeShippingOver: 5000,
      nationwide: true,
      deliveryCities: [],
      dispatchMinDays: 1,
      dispatchMaxDays: 3,
      returnWindowDays: 7,
      codEnabled: true,
      codLimit: 15000,
      paymentMethods: ['cod', 'transfer'],
    });
    expect(s.collections.map(c => [c.name, c.productCount])).toEqual([
      ['Eid edit', 5],
      ['Winter khaddar', 3],
    ]);
  });

  it('reads a product with its sizes, low stock, store policies, related products and reviews', () => {
    const p = productDetailSerializer(body('product'), body('related'), body('reviews'))!;
    expect(p).toMatchObject({ name: 'Silk festive kurta', price: 7500, compareAtPrice: 8900, storeName: 'Lahore Loom', inStock: true, lowStock: true, wishlisted: false });
    expect(p.option1).toEqual({ name: 'Size', values: ['S', 'M', 'L'], swatches: {} });
    expect(p.option2).toBeNull();
    expect(p.variants.map(v => v.option1)).toEqual(['S', 'M', 'L']);
    expect(p.variants[0]).toMatchObject({ price: 7500, compareAtPrice: 8900, lowStock: true });
    expect(p.store.policies).toMatchObject({ shippingFee: 200, freeShippingOver: 5000, returnWindowDays: 7 });
    expect(p.related.map(r => r.name)).toContain('Cotton straight kurta');
    expect(p.reviewSummary).toEqual({ average: 0, count: 0, counts: [0, 0, 0, 0, 0], withPhotos: 0 });
  });

  it('reads search suggestions and the saved list', () => {
    expect(suggestionListSerializer(body('suggest'))![0]).toEqual({
      kind: 'product',
      id: expect.any(String),
      label: 'Silk festive kurta',
      query: 'Silk festive kurta',
    });
    expect(wishlistIdsSerializer(body('wishlist'))).toEqual([body('product').data.id]);
  });

  it('reads a written review in the app’s words', () => {
    expect(reviewSerializer(body('review'))).toMatchObject({ rating: 5, body: 'Lovely fabric, true to size.', authorName: 'Ayesha K.', verified: true, reply: null });
    expect(productReviewsSerializer(body('reviews'))!.items).toEqual([]);
  });

  it('keeps the error codes the screens branch on', () => {
    expect([R.reviewsMissingErr.status, error('reviewsMissingErr').code]).toEqual([404, 'NOT_FOUND']);
    expect([R.reportAgainErr.status, error('reportAgainErr').code]).toEqual([409, 'CONFLICT']);
    expect([R.checkoutNoKeyErr.status, error('checkoutNoKeyErr').code]).toEqual([400, 'IDEMPOTENCY_KEY_REQUIRED']);
    expect([R.reviewAgainErr.status, error('reviewAgainErr').code]).toEqual([409, 'REVIEW_EXISTS']);
  });
});

describe('the bag and checkout', () => {
  it('reads an empty bag', () => {
    expect(cartSerializer(body('cartEmpty'))).toEqual({ groups: [], itemCount: 0, itemsTotal: 0, shippingTotal: 0, total: 0, blocking: false });
  });

  it('reads a bag over two stores, each with its own shipping', () => {
    const c = cartSerializer(body('cart'));
    expect(c.groups.map(g => [g.store.name, g.subtotal, g.shippingFee, g.toFreeShipping])).toEqual([
      ['Lahore Loom', 15000, 0, 0],
      ['Taaza Mandi Online (demo)', 420, 120, 2080],
    ]);
    expect(c.groups[0].lines[0]).toMatchObject({ name: 'Silk festive kurta', variantLabel: 'S', unitPrice: 7500, quantity: 2, lineTotal: 15000, available: 3, warnings: [] });
    expect(c).toMatchObject({ itemCount: 3, itemsTotal: 15420, shippingTotal: 120, total: 15540, blocking: false });
  });

  it('caps a line at what the store has', () => {
    const line = cartSerializer(body('cartAddCapped')).groups[0].lines[0];
    expect([line.quantity, line.available]).toEqual([3, 3]);
  });

  it('reads a plan that can be placed, and one a store cannot deliver', () => {
    const near = checkoutPreviewSerializer(body('preview'));
    expect(near).toMatchObject({ itemsTotal: 15420, shippingTotal: 120, discountTotal: 0, total: 15540, canPlace: true });
    expect(near.stores.map(s => s.paymentOptions.every(o => o.available))).toEqual([true, true]);

    const far = checkoutPreviewSerializer(body('previewFar'));
    expect(far.canPlace).toBe(false);
    expect(far.stores[0].error).toBeNull();
    expect(far.stores[1].error).toEqual({ code: 'CITY_NOT_SERVED', message: "Taaza Mandi Online (demo) doesn't deliver to Gilgit." });
  });

  it('reads the store’s coupons in plain words', () => {
    expect(availableCouponListSerializer(body('couponsAvailable'))).toEqual([
      { code: 'LOOM10', label: '10% off, up to Rs 800', minOrder: null, endsAt: expect.any(String), shortBy: 0 },
      { code: 'EID500', label: 'Rs 500 off', minOrder: 4000, endsAt: expect.any(String), shortBy: 0 },
    ]);
  });

  it('reads a placed order group, each store order with the group’s code', () => {
    const g = orderGroupSerializer(body('checkout'))!;
    expect(g).toMatchObject({ itemsTotal: 15000, shippingTotal: 0, discountTotal: 0, total: 15000 });
    expect(g.address).toMatchObject({ label: 'home', fullName: 'Ayesha Khan', city: 'Lahore', area: 'Gulberg III' });
    expect(g.orders).toHaveLength(1);
    expect(g.orders[0]).toMatchObject({
      code: `${g.code}-1`,
      groupCode: g.code,
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
      note: 'Ring the bell',
      canCancel: true,
      canRequestCancel: false,
    });
  });

  it('reads a transfer order with where to pay', () => {
    const o = orderGroupSerializer(body('checkoutTransfer'))!.orders[0];
    expect(o.paymentStatus).toBe('awaiting_transfer');
    expect(o.paymentInstructions).toMatchObject({ amount: o.total, accountTitle: expect.any(String), accountNumber: expect.any(String), payBy: expect.any(String) });
  });
});

describe('orders, returns and refunds', () => {
  const statusOf = (k: string) => {
    const o = storeOrderResponseSerializer(body(k))!;
    return [o.status, o.paymentStatus];
  };

  it('reads the orders list by group', () => {
    const page = orderGroupSummaryPageSerializer(body('orders'))!;
    expect(page.total).toBe(2);
    expect(page.items[1]).toMatchObject({ total: 15000, itemCount: 2, stores: [{ name: 'Lahore Loom' }], orders: [{ status: 'placed', paymentStatus: 'cod_pending', paymentMethod: 'cod' }] });
  });

  it('reads every step of the customer’s and the store’s moves in the app’s words', () => {
    expect(statusOf('storeOrder')).toEqual(['placed', 'cod_pending']);
    expect(statusOf('customerCancel')).toEqual(['cancelled', 'void']);
    expect(statusOf('requestCancel')).toEqual(['cancellation_requested', 'cod_pending']);
    expect(statusOf('partnerCancel')).toEqual(['cancelled', 'void']);
    expect(statusOf('storeOrderDelivered')).toEqual(['delivered', 'cash_collected']);
  });

  it('reads a transfer from proof to refund', () => {
    expect(statusOf('paymentProof')).toEqual(['placed', 'proof_submitted']);
    const rejected = storeOrderResponseSerializer(body('partnerPaymentReject'))!;
    expect(rejected.paymentStatus).toBe('proof_rejected');
    expect(rejected.paymentProof?.rejectionReason).toBe('No transfer with that reference yet.');
    expect(statusOf('paymentProofAgain')).toEqual(['placed', 'proof_submitted']);
    expect(statusOf('partnerPaymentConfirm')).toEqual(['placed', 'paid']);
    expect(statusOf('partnerCancelPaid')).toEqual(['cancelled', 'refund_due']);
    expect(statusOf('partnerRefund')).toEqual(['cancelled', 'refunded']);
  });

  it('reads a return request and the returns list', () => {
    const r = returnSerializer(body('returnRequest'))!;
    expect(r).toMatchObject({ storeName: 'Lahore Loom', status: 'requested', reason: 'size_issue', details: 'Too tight across the shoulders.', refund: null });
    expect(r.items).toEqual([
      { id: expect.any(String), orderItemId: expect.any(String), name: 'Silk festive kurta', variantLabel: 'S', imageUrl: expect.any(String), quantity: 1, unitPrice: 7500 },
    ]);
    expect(returnPageSerializer(body('returns'))!.items[0].id).toBe(r.id);
  });
});
