// ═══════════════════════════════════════════════════════
// MetroMatrix — The dummy Shopping API, in the real API's shapes
// ═══════════════════════════════════════════════════════
// Rows → what MetroMatrix-API answers (docs/API_SHOPPING.md §2): ProductCard,
// StoreCard, the store and product pages, Review, CartView, CheckoutPlan,
// StoreOrder (customer and store), OrderGroup and ReturnRequest. The dummy's
// own states read the way the real API reports them: a cancel request is the
// order's step plus `cancelRequestedAt`, "returned" is delivered, cash taken
// is `paid`, a refused proof is `awaiting_transfer` with a `rejectedReason`,
// and a cancelled order's payment is `void` or `refund_due`.
// serializers/__tests__/shopParity.test.ts keeps these keys and the real
// capture (serializers/__tests__/fixtures/shop/real.json) the same.

import type { MockDb } from '../mockDb';
import type { MockCoupon, MockGroup, MockOrder, MockProduct, MockReturn, MockReview, MockStore } from './shopTypes';
import type { StoreChoice } from './shopLogic';
import {
  LOW_STOCK,
  bagGroups,
  couponStatus,
  evaluateCoupon,
  delivers,
  isListed,
  lineState,
  openReturnFor,
  progressStatus,
  returnableQty,
  returnWindowEnd,
  reviewsOf,
  rupees,
  shippingFor,
  storeById,
  totalStock,
  unitPrice,
  variantLabel,
  userById,
} from './shopLogic';

type Shop = MockDb['shop'];

/** A line holds 1–20 (the real API's MAX_LINE_QUANTITY). */
export const LINE_MAX = 20;

const ratingOf = (rs: MockReview[]) =>
  rs.length ? { ratingAvg: Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10, ratingCount: rs.length } : { ratingAvg: 0, ratingCount: 0 };

const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const productSlug = (p: MockProduct) => `${kebab(p.name)}-${p.id.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase()}`;

// ─── Catalogue ────────────────────────────────────────
export const categoryTree = (shop: Shop) => {
  const node = (c: Shop['categories'][number]) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon });
  return shop.categories
    .filter(c => !c.parentId)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      ...node(c),
      children: shop.categories
        .filter(x => x.parentId === c.id)
        .sort((a, b) => a.position - b.position)
        .map(node),
    }));
};

export const storeCard = (shop: Shop, s: MockStore) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  city: s.city,
  tagline: s.tagline,
  logoUrl: s.logoUrl,
  coverUrl: s.coverUrl,
  brandColor: s.brandColor,
  onBrandColor: s.onBrandColor,
  ...ratingOf(shop.reviews.filter(r => r.storeId === s.id)),
  isFeatured: s.isFeatured,
  productCount: shop.products.filter(p => p.storeId === s.id && isListed(p)).length,
});

/** The store's links as the API keeps them (StoreSocials): only the ones it set. There is no public phone. */
const socialsOf = (s: MockStore) => Object.fromEntries(Object.entries({ ...s.socials, whatsapp: s.whatsapp }).filter(([, v]) => !!v));

const deliveryCities = (s: MockStore) => (s.settings.nationwide ? [] : s.settings.deliveryCities);

/** GET /shop/stores/:slug: never account numbers. */
export const storePage = (shop: Shop, s: MockStore) => ({
  ...storeCard(shop, s),
  about: s.about,
  socials: socialsOf(s),
  collections: shop.collections
    .filter(c => c.storeId === s.id)
    .sort((a, b) => a.position - b.position)
    .map(c => ({ id: c.id, name: c.name, slug: c.slug, productCount: shop.products.filter(p => p.collectionId === c.id && isListed(p)).length })),
  policies: {
    shippingFlatFee: s.settings.shippingFee,
    freeShippingOver: s.settings.freeShippingOver,
    returnWindowDays: s.settings.returnWindowDays,
    dispatchDaysMin: s.settings.dispatchMinDays,
    dispatchDaysMax: s.settings.dispatchMaxDays,
    deliveryCities: deliveryCities(s),
    paymentMethods: [...(s.settings.codEnabled ? ['cod'] : []), ...(s.paymentAccounts.some(a => a.isActive) ? ['transfer'] : [])],
    codLimit: s.settings.codLimit,
    transferVia: [...new Set(s.paymentAccounts.filter(a => a.isActive).map(a => a.kind))],
  },
});

const wishlisted = (shop: Shop, userId: string | null, productId: string) => (userId ? (shop.wishlist[userId] ?? []).includes(productId) : false);

/** A ProductCard; `isWishlisted` only for a signed-in caller. */
export const productCard = (shop: Shop, p: MockProduct, userId: string | null = null) => {
  const store = storeById(shop, p.storeId);
  const price = unitPrice(p, null);
  return {
    id: p.id,
    name: p.name,
    slug: productSlug(p),
    price,
    basePrice: p.price,
    salePrice: p.salePrice,
    onSale: p.salePrice !== null,
    coverUrl: p.images[0]?.url ?? null,
    ...ratingOf(reviewsOf(shop, p.id)),
    inStock: totalStock(p) > 0,
    store: { id: p.storeId, slug: store?.slug ?? '', name: store?.name ?? '' },
    ...(userId ? { isWishlisted: wishlisted(shop, userId, p.id) } : {}),
  };
};

const breakdownOf = (rs: MockReview[]) => {
  const b: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const r of rs) b[String(r.rating)]++;
  return b;
};

/** GET /shop/products/:id. */
export const productPage = (shop: Shop, p: MockProduct, userId: string | null) => {
  const store = storeById(shop, p.storeId)!;
  const distinct = (key: 'option1' | 'option2') => [...new Set(p.variants.map(v => v[key]).filter((x): x is string => !!x))];
  return {
    ...productCard(shop, p),
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      logoUrl: store.logoUrl,
      brandColor: store.brandColor,
      onBrandColor: store.onBrandColor,
      ...ratingOf(shop.reviews.filter(r => r.storeId === store.id)),
      returnWindowDays: store.settings.returnWindowDays,
      codEnabled: store.settings.codEnabled,
      shippingFlatFee: store.settings.shippingFee,
      freeShippingOver: store.settings.freeShippingOver,
      dispatchDaysMin: store.settings.dispatchMinDays,
      dispatchDaysMax: store.settings.dispatchMaxDays,
    },
    description: p.description,
    tags: [],
    categoryId: p.categoryId,
    collectionId: p.collectionId,
    pack: null,
    pricePer: null,
    images: p.images.map((i, k) => ({ id: `${p.id}-${k}`, url: i.url })),
    options: { option1: distinct('option1'), option2: distinct('option2') },
    variants: p.variants.map(v => ({
      id: v.id,
      option1: v.option1,
      option2: v.option2,
      label: variantLabel(v),
      colorHex: (v.option2 && p.option2?.swatches[v.option2]) || null,
      price: unitPrice(p, v),
      pack: null,
      pricePer: null,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK,
    })),
    ratingBreakdown: breakdownOf(reviewsOf(shop, p.id)),
    isWishlisted: wishlisted(shop, userId, p.id),
  };
};

/** A Review; the customer's and the store's views add the product, the line and `isHidden`. */
export const reviewWire = (shop: Shop, r: MockReview, full = false) => {
  const order = r.orderItemId ? shop.orders.find(o => o.items.some(i => i.id === r.orderItemId)) : undefined;
  const item = order?.items.find(i => i.id === r.orderItemId);
  return {
    id: r.id,
    productId: r.productId,
    ...(full ? { productName: shop.products.find(p => p.id === r.productId)?.name ?? '', orderItemId: r.orderItemId } : {}),
    rating: r.rating,
    text: [r.title, r.body].filter(Boolean).join('\n\n') || null,
    photos: r.photos,
    variantLabel: item?.variantLabel ?? null,
    author: { name: r.authorName, avatarUrl: null },
    storeReply: r.reply?.body ?? null,
    repliedAt: r.reply?.createdAt ?? null,
    ...(full ? { isHidden: false } : {}),
    createdAt: r.createdAt,
  };
};

export const reviewSummary = (rs: MockReview[]) => ({ ...ratingOf(rs), breakdown: breakdownOf(rs) });

// ─── Bag ──────────────────────────────────────────────
const lineWire = (s: ReturnType<typeof lineState>) => {
  const stock = s.variant && s.product && isListed(s.product) ? s.variant.stock : 0;
  const warnings = s.warnings.map(w =>
    w.code === 'PRICE_CHANGED'
      ? { code: 'PRICE_CHANGED', message: `Price changed from ${rupees(w.previousPrice ?? 0)} to ${rupees(w.currentPrice ?? 0)}.`, details: { was: w.previousPrice, now: w.currentPrice } }
      : w.code === 'LOW_STOCK'
        ? { code: 'LOW_STOCK', message: w.message, details: { available: w.available } }
        : { code: s.product && isListed(s.product) ? 'OUT_OF_STOCK' : 'PRODUCT_UNAVAILABLE', message: w.message },
  );
  return {
    id: s.line.id,
    variantId: s.line.variantId,
    productId: s.line.productId,
    productName: s.product?.name ?? 'Unavailable item',
    variantLabel: s.variant ? variantLabel(s.variant) : '',
    imageUrl: s.product?.images[0]?.url ?? null,
    unitPrice: s.price,
    priceAtAdd: s.line.priceSeen,
    quantity: s.line.quantity,
    lineTotal: s.price * s.line.quantity,
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= LOW_STOCK,
    maxQuantity: Math.min(LINE_MAX, stock),
    warnings,
  };
};

/** Lines that can be bought now count toward the totals. */
const buyable = (s: ReturnType<typeof lineState>) => !!s.variant && !!s.product && isListed(s.product) && s.variant.stock >= s.line.quantity;

/** CartView; `adjusted` is set on writes. */
export const cartWire = (shop: Shop, userId: string, adjusted: Record<string, unknown> | null | undefined = undefined) => {
  const stores = bagGroups(shop, userId).map(({ store, states }) => {
    const subtotal = states.filter(buyable).reduce((s, x) => s + x.price * x.line.quantity, 0);
    const shippingFee = subtotal ? shippingFor(store, subtotal) : 0;
    const over = store.settings.freeShippingOver;
    return {
      store: { id: store.id, slug: store.slug, name: store.name, logoUrl: store.logoUrl },
      isAvailable: !store.isPaused,
      warnings: store.isPaused ? [{ code: 'STORE_UNAVAILABLE', message: store.pauseMessage || `${store.name} is taking a short break.` }] : [],
      items: states.map(lineWire),
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      freeShippingOver: over,
      amountToFreeShipping: over === null ? 0 : Math.max(0, over - subtotal),
    };
  });
  const itemsTotal = stores.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = stores.reduce((s, g) => s + g.shippingFee, 0);
  return {
    stores,
    lineCount: stores.reduce((n, g) => n + g.items.length, 0),
    itemCount: stores.reduce((n, g) => n + g.items.reduce((m, l) => m + l.quantity, 0), 0),
    itemsTotal,
    shippingTotal,
    grandTotal: itemsTotal + shippingTotal,
    hasWarnings: stores.some(g => g.warnings.length > 0 || g.items.some(l => l.warnings.length > 0)),
    ...(adjusted !== undefined ? { adjusted } : {}),
  };
};

// ─── Checkout ─────────────────────────────────────────
const COUPON_ISSUE: Record<string, string> = {
  COUPON_NOT_FOUND: 'COUPON_INVALID',
  COUPON_INACTIVE: 'COUPON_INVALID',
  COUPON_NOT_STARTED: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_USED_UP: 'COUPON_LIMIT_REACHED',
  COUPON_ALREADY_USED: 'COUPON_LIMIT_REACHED',
  COUPON_MIN_ORDER: 'COUPON_MIN_ORDER',
};

type Issue = { code: string; message: string; details?: Record<string, unknown> };

/** The checkout code minus the writes: one entry per store in the bag, with its issues in the API's codes. */
export const planFor = (db: MockDb, userId: string, city: string, choices: StoreChoice[]) => {
  const shop = db.shop;
  return bagGroups(shop, userId).map(({ store, states }) => {
    const choice = choices.find(c => c.storeId === store.id);
    const method = choice?.paymentMethod ?? 'cod';
    const subtotal = states.reduce((s, x) => s + x.price * x.line.quantity, 0);
    const issues: Issue[] = [];
    let discount = 0;
    let coupon: MockCoupon | null = null;
    if (store.isPaused) issues.push({ code: 'STORE_UNAVAILABLE', message: store.pauseMessage || `${store.name} is paused right now.` });
    const short = states.filter(s => !s.variant || !s.product || !isListed(s.product) || s.line.quantity > s.variant.stock);
    if (short.length) {
      issues.push({
        code: 'OUT_OF_STOCK',
        message: 'Some items just sold out.',
        details: { lines: short.map(s => ({ variantId: s.line.variantId, productName: s.product?.name ?? '', variantLabel: s.variant ? variantLabel(s.variant) : '', requested: s.line.quantity, available: s.variant?.stock ?? 0 })) },
      });
    }
    if (!delivers(store, city)) {
      issues.push({ code: 'DELIVERY_UNAVAILABLE', message: `${store.name} doesn't deliver to ${city}.`, details: { storeId: store.id, city, deliveryCities: deliveryCities(store) } });
    }
    if (choice?.couponCode?.trim()) {
      const r = evaluateCoupon(shop, store.id, userId, choice.couponCode, subtotal);
      if ('error' in r) issues.push({ code: COUPON_ISSUE[r.error.code] ?? 'COUPON_INVALID', message: r.error.message });
      else {
        discount = r.discount;
        coupon = r.coupon;
      }
    }
    const shippingFee = shippingFor(store, subtotal - discount);
    const total = subtotal - discount + shippingFee;
    if (method === 'cod' && !store.settings.codEnabled) issues.push({ code: 'PAYMENT_METHOD_UNAVAILABLE', message: `${store.name} doesn't take cash on delivery.` });
    else if (method === 'cod' && store.settings.codLimit !== null && total > store.settings.codLimit) {
      issues.push({ code: 'COD_LIMIT_EXCEEDED', message: `Cash on delivery up to ${rupees(store.settings.codLimit)}.`, details: { codLimit: store.settings.codLimit, total } });
    }
    const accounts = store.paymentAccounts.filter(a => a.isActive);
    if (method === 'transfer' && !accounts.length) issues.push({ code: 'PAYMENT_METHOD_UNAVAILABLE', message: `${store.name} takes cash on delivery only.` });
    const changed = states.filter(s => s.warnings.some(w => w.code === 'PRICE_CHANGED'));
    return {
      raw: { store, states, coupon, choice, discount, shippingFee, subtotal, total, method, accounts },
      wire: {
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        paymentMethod: method,
        couponCode: coupon?.code ?? null,
        items: states.map(s => ({
          cartItemId: s.line.id,
          variantId: s.line.variantId,
          productId: s.line.productId,
          productName: s.product?.name ?? '',
          variantLabel: s.variant ? variantLabel(s.variant) : '',
          imageUrl: s.product?.images[0]?.url ?? null,
          unitPrice: s.price,
          quantity: s.line.quantity,
          lineTotal: s.price * s.line.quantity,
        })),
        subtotal,
        discount,
        shippingFee,
        total,
        transferVia: method === 'transfer' ? [...new Set(accounts.map(a => a.kind))] : [],
        issues,
        warnings: changed.length
          ? [{ code: 'PRICE_CHANGED', message: 'Some prices changed since you added them.', details: { lines: changed.map(s => ({ cartItemId: s.line.id, was: s.line.priceSeen, now: s.price })) } }]
          : [],
      },
    };
  });
};

export const planWire = (plan: ReturnType<typeof planFor>) => {
  const stores = plan.map(p => p.wire);
  return {
    ok: stores.length > 0 && stores.every(s => !s.issues.length),
    issues: stores.length ? [] : [{ code: 'CART_EMPTY', message: 'Your bag is empty.' }],
    stores,
    totals: {
      itemsTotal: stores.reduce((s, x) => s + x.subtotal, 0),
      discountTotal: stores.reduce((s, x) => s + x.discount, 0),
      shippingTotal: stores.reduce((s, x) => s + x.shippingFee, 0),
      grandTotal: stores.reduce((s, x) => s + x.total, 0),
    },
  };
};

// ─── Orders ───────────────────────────────────────────
const COURIER_NAMES: Record<string, string> = { tcs: 'TCS', leopards: 'Leopards', mnp: 'M&P', postex: 'PostEx', trax: 'Trax', own_rider: 'Own rider', other: 'Courier' };

const eventAt = (o: MockOrder, type: string) => o.events.filter(e => e.type === type).map(e => e.createdAt).pop() ?? null;

/** The order's status as the real API reports it. */
export const apiStatus = (o: MockOrder) => (o.status === 'cancellation_requested' ? progressStatus(o) : o.status === 'returned' ? 'delivered' : o.status);

/** The payment's status as the real API reports it. */
export const apiPaymentStatus = (o: MockOrder) => {
  const s = o.paymentStatus;
  if (o.status === 'cancelled') {
    if (s === 'refunded') return 'refunded';
    if (s === 'paid' || s === 'cash_collected' || s === 'proof_submitted') return 'refund_due';
    return 'void';
  }
  if (s === 'cash_collected') return 'paid';
  if (s === 'proof_rejected') return 'awaiting_transfer';
  return s;
};

const eventsWire = (o: MockOrder) => {
  let last: string | null = null;
  const out: { kind: string; from: string | null; to: string | null; actorRole: string; note: string | null; at: string }[] = [];
  for (const e of o.events) {
    const status = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(e.type) ? e.type : null;
    if (status) {
      out.push({ kind: 'status', from: last, to: status, actorRole: status === 'placed' ? 'customer' : 'store', note: e.note, at: e.createdAt });
      last = status;
    } else if (e.type === 'payment_proof_submitted') out.push({ kind: 'payment', from: 'awaiting_transfer', to: 'proof_submitted', actorRole: 'customer', note: e.note, at: e.createdAt });
    else if (e.type === 'payment_confirmed') out.push({ kind: 'payment', from: 'proof_submitted', to: 'paid', actorRole: 'store', note: e.note, at: e.createdAt });
    else if (e.type === 'payment_rejected') out.push({ kind: 'payment', from: 'proof_submitted', to: 'awaiting_transfer', actorRole: 'store', note: e.note, at: e.createdAt });
    else if (e.type === 'cash_collected') out.push({ kind: 'payment', from: 'cod_pending', to: 'paid', actorRole: 'store', note: e.note, at: e.createdAt });
    else if (e.type === 'cancellation_requested') out.push({ kind: 'note', from: null, to: null, actorRole: 'customer', note: `Cancel requested: ${e.note ?? ''}`.trim(), at: e.createdAt });
    else if (e.type === 'return_requested') out.push({ kind: 'note', from: null, to: null, actorRole: 'customer', note: `Return requested: ${e.note ?? ''}`.trim(), at: e.createdAt });
  }
  return out;
};

/**
 * A StoreOrder: `customer` for the customer's view (with `store`, `can`), `group` for that view as a row of its
 * group (no `groupCode`), `store` for the store's (with `customer`, `can.moveTo`).
 */
export const storeOrderWire = (db: MockDb, o: MockOrder, view: 'customer' | 'group' | 'store') => {
  const shop = db.shop;
  const store = storeById(shop, o.storeId)!;
  const status = apiStatus(o);
  const end = returnWindowEnd(shop, o);
  const withinWindow = end !== null && Date.parse(end) > Date.now();
  const account = o.paymentMethod === 'transfer' ? (store.paymentAccounts.find(a => a.id === o.paymentAccountId) ?? store.paymentAccounts.find(a => a.isActive)) : undefined;
  const cancelRequestedAt = eventAt(o, 'cancellation_requested');
  const delivered = status === 'delivered';
  const common = {
    id: o.id,
    code: o.code,
    status,
    paymentMethod: o.paymentMethod,
    paymentStatus: apiPaymentStatus(o),
    subtotal: o.itemsTotal,
    discount: o.discount,
    couponCode: o.couponCode,
    shippingFee: o.shippingFee,
    total: o.total,
    customerNote: o.note,
    items: o.items.map(i => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.name,
      variantLabel: i.variantLabel,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
      returnedQty: i.returnedQty,
      ...(view !== 'store' ? { reviewed: i.reviewed, canReview: delivered && !i.reviewed } : {}),
    })),
    payment: {
      method: o.paymentMethod,
      status: apiPaymentStatus(o),
      payBy: o.payBy,
      paidAt: o.paymentStatus === 'paid' || o.paymentStatus === 'cash_collected' ? (eventAt(o, 'payment_confirmed') ?? eventAt(o, 'cash_collected')) : null,
      paymentRef: o.paymentProof?.transactionId ?? null,
      proofUrl: o.paymentProof?.imageUrl ?? null,
      rejectedReason: o.paymentStatus === 'proof_rejected' ? (o.paymentProof?.rejectionReason ?? 'The store could not find your transfer.') : null,
      accounts: account ? [{ kind: account.kind, bankName: account.bankName, accountTitle: account.title, accountNumber: account.number }] : null,
      refundAmount: o.paymentStatus === 'refunded' ? o.total : null,
      refundRef: null,
      refundedAt: null,
    },
    shipping: {
      courierName: o.shipment ? COURIER_NAMES[o.shipment.courier] : null,
      trackingRef: o.shipment?.trackingRef ?? null,
      riderName: null,
      riderPhone: null,
    },
    cancelReason: o.cancelReason,
    cancelledBy: o.status === 'cancelled' ? 'store' : null,
    cancelRequestedAt: o.status === 'cancellation_requested' ? cancelRequestedAt : null,
    returnWindowDays: store.settings.returnWindowDays,
    returnDeadline: end,
    placedAt: o.createdAt,
    confirmedAt: eventAt(o, 'confirmed'),
    packedAt: eventAt(o, 'packed'),
    shippedAt: eventAt(o, 'shipped'),
    deliveredAt: o.deliveredAt,
    completedAt: null,
    cancelledAt: eventAt(o, 'cancelled'),
    events: eventsWire(o),
    ...(view === 'group' ? {} : { groupCode: o.groupCode }),
  };
  if (view !== 'store') {
    const transferOpen = o.paymentMethod === 'transfer' && (o.paymentStatus === 'awaiting_transfer' || o.paymentStatus === 'proof_rejected') && o.status !== 'cancelled';
    return {
      ...common,
      store: { id: store.id, slug: store.slug, name: store.name, logoUrl: store.logoUrl },
      can: {
        cancel: o.status === 'placed',
        requestCancel: o.status === 'confirmed' || o.status === 'packed',
        submitPaymentProof: transferOpen,
        markReceived: o.status === 'shipped',
        requestReturn: delivered && withinWindow && o.items.some(i => returnableQty(shop, o, i.id) > 0) && !openReturnFor(shop, o.id),
      },
    };
  }
  const g = shop.groups.find(x => x.code === o.groupCode);
  const customer = userById(db, o.userId);
  const moveTo: string[] = [];
  const step = apiStatus(o);
  if (o.status !== 'cancelled') {
    if (step === 'placed') moveTo.push('confirmed');
    if (step === 'confirmed') moveTo.push('packed');
    if (step === 'packed' && !(o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid')) moveTo.push('shipped');
    if (step === 'shipped') moveTo.push('delivered');
    if (['placed', 'confirmed', 'packed'].includes(step)) moveTo.push('cancelled');
  }
  return {
    ...common,
    customer: {
      name: g?.address.fullName ?? customer?.name ?? 'Customer',
      phone: g?.address.phone ?? customer?.phone ?? '',
      address: g ? { city: g.address.city, area: g.address.area, line1: g.address.line1, landmark: g.address.landmark, lat: g.address.lat, lng: g.address.lng } : null,
    },
    can: { moveTo },
  };
};

export const groupWire = (db: MockDb, g: MockGroup) => {
  const orders = g.orderIds.map(id => db.shop.orders.find(o => o.id === id)).filter((o): o is MockOrder => !!o);
  const a = g.address;
  return {
    id: g.code,
    code: g.code,
    placedAt: g.createdAt,
    address: { label: a.label, fullName: a.fullName, phone: a.phone, city: a.city, area: a.area, line1: a.line1, landmark: a.landmark, lat: a.lat, lng: a.lng },
    itemsTotal: orders.reduce((s, o) => s + o.itemsTotal, 0),
    discountTotal: orders.reduce((s, o) => s + o.discount, 0),
    shippingTotal: orders.reduce((s, o) => s + o.shippingFee, 0),
    grandTotal: orders.reduce((s, o) => s + o.total, 0),
    storeOrders: orders.map(o => storeOrderWire(db, o, 'group')),
  };
};

/** A row of GET /shop/orders. */
export const groupRowWire = (db: MockDb, g: MockGroup) => {
  const orders = g.orderIds.map(id => db.shop.orders.find(o => o.id === id)).filter((o): o is MockOrder => !!o);
  return {
    id: g.code,
    code: g.code,
    placedAt: g.createdAt,
    grandTotal: orders.reduce((s, o) => s + o.total, 0),
    storeOrders: orders.map(o => {
      const s = storeById(db.shop, o.storeId)!;
      return {
        id: o.id,
        code: o.code,
        store: { id: s.id, slug: s.slug, name: s.name, logoUrl: s.logoUrl },
        status: apiStatus(o),
        paymentMethod: o.paymentMethod,
        paymentStatus: apiPaymentStatus(o),
        total: o.total,
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
        coverImageUrl: o.items[0]?.imageUrl ?? null,
      };
    }),
  };
};

/** A return line's own id. */
export const returnItemId = (r: MockReturn, orderItemId: string) => `${r.id}:${orderItemId}`;

/** A ReturnRequest; the store's view adds `customerName`. */
export const returnWire = (db: MockDb, r: MockReturn, view: 'customer' | 'store') => {
  const shop = db.shop;
  const order = shop.orders.find(o => o.id === r.orderId);
  const store = storeById(shop, r.storeId);
  const items = r.items.map(ri => {
    const item = order?.items.find(i => i.id === ri.orderItemId);
    return {
      id: returnItemId(r, ri.orderItemId),
      orderItemId: ri.orderItemId,
      productName: item?.name ?? 'Item',
      variantLabel: item?.variantLabel ?? '',
      imageUrl: item?.imageUrl ?? null,
      unitPrice: item?.unitPrice ?? 0,
      quantity: ri.quantity,
      restocked: r.status === 'received' || r.status === 'refunded' ? true : null,
    };
  });
  return {
    id: r.id,
    storeOrderId: r.orderId,
    storeOrderCode: order?.code ?? '',
    store: { id: r.storeId, name: store?.name ?? '' },
    ...(view === 'store' ? { customerName: userById(db, r.userId)?.name ?? 'Customer' } : {}),
    status: r.status,
    reason: r.reason,
    details: r.details || null,
    photos: r.photos,
    storeNote: r.storeNote,
    items,
    value: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    refundAmount: r.refund?.amount ?? null,
    refundRef: r.refund?.reference ?? null,
    createdAt: r.createdAt,
    decidedAt: null,
    receivedAt: null,
    refundedAt: r.refund?.recordedAt ?? null,
  };
};

/** GET /shop/stores/:storeId/coupons/available. */
export const availableCouponsWire = (shop: Shop, storeId: string, userId: string) => {
  const group = bagGroups(shop, userId).find(g => g.store.id === storeId);
  const storeSubtotal = group ? group.states.reduce((s, x) => s + x.price * x.line.quantity, 0) : 0;
  return {
    storeSubtotal,
    items: shop.coupons
      .filter(c => c.storeId === storeId && couponStatus(c) === 'active')
      .filter(c => c.perCustomerLimit === null || (c.usedBy[userId] ?? 0) < c.perCustomerLimit)
      .map(c => {
        const shortBy = c.minOrder ? Math.max(0, c.minOrder - storeSubtotal) : 0;
        const r = evaluateCoupon(shop, storeId, userId, c.code, storeSubtotal);
        return {
          code: c.code,
          type: c.type,
          value: c.value,
          minOrder: c.minOrder ?? 0,
          maxDiscount: c.maxDiscount,
          endsAt: c.endsAt,
          eligible: shortBy === 0,
          shortBy,
          discount: 'error' in r ? 0 : r.discount,
        };
      }),
  };
};
