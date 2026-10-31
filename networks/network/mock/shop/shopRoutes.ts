// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop routes
// ═══════════════════════════════════════════════════════
// Registered on the mock server's router. Customer routes under /shop speak
// the real API (its paths, rules and error codes; shapes from shopWire,
// pinned by mockShopParity). The store partner's under /partner/shop and
// staff under /admin/shop still follow API_SHOPPING_ASSUMED. Plus the core
// /addresses and /notifications.

import type { MockBusiness, MockDb, MockUser } from '../mockDb';
import type { MockAddress, MockCoupon, MockOrder, MockProduct, MockStore, MockVariant } from './shopTypes';
import {
  ShopError,
  addEvent,
  cancelOrder,
  categoryAndChildren,
  categoryTree,
  delivers,
  evaluateCoupon,
  findVariant,
  firstName,
  groupSegment,
  groupView,
  isListed,
  isoNow,
  LOW_STOCK,
  matchesQuery,
  moveStock,
  nextId,
  notify,
  openReturnFor,
  productById,
  productHaystack,
  progressStatus,
  returnableQty,
  returnWindowEnd,
  rupees,
  storeById,
  storeOfOwner,
  storeSummaryView,
  totalStock,
  unitPrice,
  variantLabel,
  type StoreChoice,
} from './shopLogic';
import {
  LINE_MAX,
  apiPaymentStatus,
  apiStatus,
  availableCouponsWire,
  cartWire,
  categoryTree as categoryTreeWire,
  couponWire,
  dashboardWire,
  groupRowWire,
  groupWire,
  insightsWire,
  inventoryRowWire,
  movementWire,
  partnerCollectionWire,
  partnerOrderRowWire,
  partnerProductRowWire,
  partnerProductWire,
  paymentAccountWire,
  planFor,
  planWire,
  productCard,
  productPage,
  returnItemId,
  returnWire,
  reviewSummary,
  reviewWire,
  storeCard,
  storeOrderWire,
  storePage,
  storeProfileWire,
  storeSettingsWire,
} from './shopWire';
import { COURIERS } from '../../../../models/shopping/orderStatusModel';
import type { ReturnReason } from '../../../../models/shopping';

export interface ShopCtx {
  db: MockDb;
  body: Record<string, any>;
  query: Record<string, any>;
  params: string[];
  token: string | null;
  now: number;
  headers: Record<string, string>;
  setStatus: (status: number) => void;
}

export interface ShopKit {
  route: (method: string, pattern: string, handler: (ctx: ShopCtx) => unknown) => void;
  requireUser: (ctx: ShopCtx) => MockUser;
  /** The token's user if there is one, else null (public catalogue routes). */
  optionalUser: (ctx: ShopCtx) => MockUser | null;
  requirePartnerBusiness: (ctx: ShopCtx) => { user: MockUser; business: MockBusiness | null };
  requireAdmin: (ctx: ShopCtx) => MockUser;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const bad = (message: string, fields: Record<string, string>) =>
  new ShopError(400, 'VALIDATION_FAILED', message, { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])) });

const notFound = (what: string) => new ShopError(404, 'NOT_FOUND', `${what} not found.`);

const page = (q: Record<string, any>) => {
  const p = Math.max(1, Math.floor(Number(q.page) || 1));
  const size = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)));
  return { page: p, pageSize: size };
};

const paginate = <T>(rows: T[], q: Record<string, any>) => {
  const { page: p, pageSize } = page(q);
  return { items: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize };
};

const bool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const num = (v: unknown): number | null => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v: unknown, fallback = 0) => {
  const n = num(v);
  return n === null ? fallback : Math.round(n);
};

const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(16).slice(2, 7)}`;

/** A newly approved store owner gets their storefront on first visit. */
const ensureStore = (db: MockDb, user: MockUser, business: MockBusiness | null): MockStore => {
  const shop = db.shop;
  const existing = storeOfOwner(shop, user.id);
  if (existing) return existing;
  if (!business || business.serviceType !== 'shopping') throw new ShopError(403, 'FORBIDDEN', 'Only store partners can do this.');
  if (business.status !== 'approved') {
    throw new ShopError(403, 'BUSINESS_NOT_APPROVED', 'Your store opens once MetroMatrix approves it.', { status: business.status });
  }
  const store: MockStore = {
    id: nextId(shop, 's'),
    slug: slugify(business.name),
    ownerId: user.id,
    name: business.name,
    tagline: '',
    about: business.details?.briefDescription ?? '',
    logoUrl: null,
    coverUrl: null,
    brandColor: '#C25100',
    onBrandColor: '#FFFFFF',
    city: business.city,
    socials: { instagram: null, facebook: null, tiktok: null, website: null },
    phone: business.phone,
    whatsapp: business.phone,
    isFeatured: false,
    isPaused: false,
    pauseMessage: null,
    settings: {
      shippingFee: 250,
      freeShippingOver: null,
      nationwide: false,
      deliveryCities: [business.city],
      dispatchMinDays: 1,
      dispatchMaxDays: 3,
      returnWindowDays: 7,
      codEnabled: true,
      codLimit: 15000,
    },
    paymentAccounts: [],
    createdAt: isoNow(),
  };
  shop.stores.push(store);
  return store;
};

export function registerShopRoutes(kit: ShopKit) {
  const { requireUser, optionalUser, requirePartnerBusiness, requireAdmin } = kit;
  // Writes are all-or-nothing, like a database transaction: a request that
  // fails part-way leaves the shop exactly as it was.
  const route: ShopKit['route'] = (method, pattern, handler) =>
    kit.route(method, pattern, method === 'GET' ? handler : ctx => {
      const before = JSON.stringify(ctx.db.shop);
      try {
        return handler(ctx);
      } catch (e) {
        ctx.db.shop = JSON.parse(before);
        throw e;
      }
    });

  const myStore = (ctx: ShopCtx) => {
    const { user, business } = requirePartnerBusiness(ctx);
    return { user, store: ensureStore(ctx.db, user, business) };
  };

  // ══ Catalogue (public) ══════════════════════════════
  // ─── Catalogue (public; a token personalises `isWishlisted`) ───
  route('GET', '/shop/home', ctx => {
    const { db, now } = ctx;
    const shop = db.shop;
    const userId = optionalUser(ctx)?.id ?? null;
    const listed = shop.products.filter(isListed);
    const targetOf = (b: (typeof shop.banners)[number]) => {
      const t = b.target as { kind: string; slug?: string; id?: string };
      if (t.kind === 'store') return { targetType: 'store', targetId: shop.stores.find(s => s.slug === t.slug || s.id === t.slug)?.id ?? null };
      if (t.kind === 'none') return { targetType: 'none', targetId: null };
      return { targetType: t.kind, targetId: t.id ?? null };
    };
    return {
      banners: shop.banners
        .filter(b => b.isActive && Date.parse(b.startsAt) <= now && (!b.endsAt || Date.parse(b.endsAt) > now))
        .sort((a, b) => a.position - b.position)
        .map(b => ({ id: b.id, imageUrl: b.imageUrl, title: b.headline, subtitle: b.subhead, ...targetOf(b) })),
      featuredStores: shop.stores
        .filter(s => s.isFeatured && !s.isPaused)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => storeCard(shop, s)),
      newArrivals: [...listed]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map(p => productCard(shop, p, userId)),
      trending: [...listed]
        .sort((a, b) => b.trending - a.trending)
        .slice(0, 10)
        .map(p => productCard(shop, p, userId)),
      categories: categoryTreeWire(shop),
    };
  });

  route('GET', '/shop/categories', ({ db }) => categoryTreeWire(db.shop));

  route('GET', '/shop/stores', ({ db, query }) => {
    const shop = db.shop;
    const q = String(query.q ?? '').trim();
    const city = String(query.city ?? '').trim().toLowerCase();
    const categoryIds = query.categoryId ? categoryAndChildren(shop, String(query.categoryId)) : null;
    const rows = shop.stores
      .filter(s => !s.isPaused)
      .filter(s => !q || matchesQuery([...s.name.toLowerCase().split(/\W+/), ...s.tagline.toLowerCase().split(/\W+/)], q))
      .filter(s => !city || delivers(s, city))
      .filter(s => !bool(query.featured) || s.isFeatured)
      .filter(s => !categoryIds || shop.products.some(p => p.storeId === s.id && isListed(p) && categoryIds.includes(p.categoryId ?? '')))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
      .map(s => storeCard(shop, s));
    return paginate(rows, query);
  });

  route('GET', '/shop/stores/:slug', ({ db, params }) => {
    const slug = decodeURIComponent(params[0]);
    const store = db.shop.stores.find(s => s.slug === slug || s.id === slug);
    if (!store || store.isPaused) throw notFound('Store');
    return storePage(db.shop, store);
  });

  const sortProducts = (rows: MockProduct[], sort: string, q: string, shop: MockDb['shop']) => {
    const price = (p: MockProduct) => unitPrice(p, null);
    const rating = (p: MockProduct) => {
      const rs = shop.reviews.filter(r => r.productId === p.id);
      return rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
    };
    switch (sort) {
      case 'price_asc':
        return rows.sort((a, b) => price(a) - price(b));
      case 'price_desc':
        return rows.sort((a, b) => price(b) - price(a));
      case 'newest':
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'rating':
        return rows.sort((a, b) => rating(b) - rating(a));
      case 'popular':
        return rows.sort((a, b) => b.trending - a.trending);
      default:
        return rows.sort((a, b) => {
          const hit = (p: MockProduct) => (q && p.name.toLowerCase().includes(q.toLowerCase()) ? 1 : 0);
          return hit(b) - hit(a) || b.trending - a.trending;
        });
    }
  };

  route('GET', '/shop/products', ctx => {
    const { db, query } = ctx;
    const shop = db.shop;
    const userId = optionalUser(ctx)?.id ?? null;
    const q = String(query.q ?? '').trim();
    const categoryIds = query.categoryId ? categoryAndChildren(shop, String(query.categoryId)) : null;
    const minPrice = num(query.minPrice);
    const maxPrice = num(query.maxPrice);
    const minRating = num(query.minRating);
    const rows = shop.products.filter(p => {
      if (!isListed(p)) return false;
      if (storeById(shop, p.storeId)?.isPaused) return false;
      if (query.storeId && p.storeId !== query.storeId) return false;
      if (categoryIds && !categoryIds.includes(p.categoryId ?? '')) return false;
      if (query.collectionId && p.collectionId !== query.collectionId) return false;
      const price = unitPrice(p, null);
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      if (bool(query.inStock) && totalStock(p) === 0) return false;
      if (bool(query.onSale) && !p.salePrice) return false;
      if (minRating !== null) {
        const rs = shop.reviews.filter(r => r.productId === p.id);
        const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
        if (avg < minRating) return false;
      }
      if (q && !matchesQuery(productHaystack(shop, p), q)) return false;
      return true;
    });
    return paginate(sortProducts(rows, String(query.sort ?? 'relevance'), q, shop).map(p => productCard(shop, p, userId)), query);
  });

  route('GET', '/shop/products/suggest', ({ db, query }) => {
    const shop = db.shop;
    const q = String(query.q ?? '').trim();
    if (!q) throw bad('Type something to search for.', { q: 'Required' });
    return {
      products: shop.products
        .filter(p => isListed(p) && matchesQuery(productHaystack(shop, p), q))
        .sort((a, b) => b.trending - a.trending)
        .slice(0, 5)
        .map(p => productCard(shop, p)),
      stores: shop.stores
        .filter(s => !s.isPaused && matchesQuery(s.name.toLowerCase().split(/\W+/), q))
        .slice(0, 3)
        .map(s => storeCard(shop, s)),
    };
  });

  const visibleProduct = (shop: MockDb['shop'], id: string) => {
    const p = productById(shop, id);
    if (!p || !isListed(p) || storeById(shop, p.storeId)?.isPaused) throw notFound('Product');
    return p;
  };

  route('GET', '/shop/products/:id', ctx => productPage(ctx.db.shop, visibleProduct(ctx.db.shop, decodeURIComponent(ctx.params[0])), optionalUser(ctx)?.id ?? null));

  route('GET', '/shop/products/:id/related', ctx => {
    const shop = ctx.db.shop;
    const p = visibleProduct(shop, decodeURIComponent(ctx.params[0]));
    return shop.products
      .filter(x => x.id !== p.id && isListed(x) && x.categoryId === p.categoryId)
      .sort((a, b) => Number(a.storeId === p.storeId) - Number(b.storeId === p.storeId) || b.trending - a.trending)
      .slice(0, 10)
      .map(x => productCard(shop, x));
  });

  route('GET', '/shop/products/:id/reviews', ({ db, params, query }) => {
    const p = visibleProduct(db.shop, decodeURIComponent(params[0]));
    const all = db.shop.reviews.filter(r => r.productId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rating = num(query.rating);
    const rows = all.filter(r => (rating === null || r.rating === rating) && (!bool(query.withPhotos) || r.photos.length > 0));
    return { ...paginate(rows.map(r => reviewWire(db.shop, r)), query), summary: reviewSummary(all) };
  });

  const REPORT_REASONS = ['counterfeit', 'prohibited_item', 'misleading', 'offensive', 'wrong_category', 'other'];

  route('POST', '/shop/products/:id/report', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const id = decodeURIComponent(ctx.params[0]);
    visibleProduct(shop, id);
    const reason = String(ctx.body.reason ?? '');
    if (!REPORT_REASONS.includes(reason)) throw bad('Choose a reason.', { reason: 'Choose a reason' });
    if (shop.reports.some(r => r.productId === id && r.userId === user.id && r.status === 'open')) {
      throw new ShopError(409, 'CONFLICT', 'You have already reported this product.');
    }
    const report = { id: nextId(shop, 'rp'), productId: id, userId: user.id, reason, details: ctx.body.details ? String(ctx.body.details) : null, status: 'open' as const, createdAt: isoNow() };
    shop.reports.push(report);
    ctx.setStatus(201);
    return { id: report.id, status: report.status, reason: report.reason, createdAt: report.createdAt };
  });

  // ─── Saved ───
  const wishlist = (db: MockDb, userId: string) => (db.shop.wishlist[userId] ??= []);

  route('GET', '/shop/wishlist', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const ids = [...wishlist(ctx.db, user.id)].reverse();
    const rows = ids
      .map(id => productById(shop, id))
      .filter((p): p is MockProduct => !!p)
      .map(p => ({ ...productCard(shop, p, user.id), available: isListed(p) && !storeById(shop, p.storeId)?.isPaused, savedAt: p.updatedAt }));
    return paginate(rows, ctx.query);
  });
  route('POST', '/shop/wishlist/:productId', ctx => {
    const list = wishlist(ctx.db, requireUser(ctx).id);
    const id = decodeURIComponent(ctx.params[0]);
    visibleProduct(ctx.db.shop, id);
    if (!list.includes(id)) list.push(id);
    return { productId: id, isWishlisted: true };
  });
  route('DELETE', '/shop/wishlist/:productId', ctx => {
    const user = requireUser(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    ctx.db.shop.wishlist[user.id] = wishlist(ctx.db, user.id).filter(x => x !== id);
    return { productId: id, isWishlisted: false };
  });

  // ─── Bag (one bag across stores; lines 1–20; at most 50 lines) ───
  route('GET', '/shop/cart', ctx => cartWire(ctx.db.shop, requireUser(ctx).id));

  route('POST', '/shop/cart/items', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const found = findVariant(shop, String(ctx.body.variantId ?? ''));
    const quantity = int(ctx.body.quantity, 1);
    if (quantity < 1 || quantity > LINE_MAX) throw bad('Choose between 1 and 20.', { quantity: 'Between 1 and 20' });
    if (!found || !isListed(found.product)) throw new ShopError(404, 'NOT_FOUND', 'This item is no longer available.');
    const store = storeById(shop, found.product.storeId)!;
    if (store.isPaused) throw new ShopError(409, 'STORE_UNAVAILABLE', store.pauseMessage || `${store.name} is taking a short break.`);
    if (found.variant.stock === 0) throw new ShopError(409, 'OUT_OF_STOCK', 'This option is sold out.');
    const line = shop.cart.find(l => l.userId === user.id && l.variantId === found.variant.id);
    const requested = (line?.quantity ?? 0) + quantity;
    const cap = Math.min(LINE_MAX, found.variant.stock);
    const next = Math.min(requested, cap);
    const adjusted = next < requested ? { variantId: found.variant.id, requested, quantity: next, reason: found.variant.stock < LINE_MAX && found.variant.stock < requested ? 'stock' : 'max_per_line' } : null;
    if (line) {
      line.quantity = next;
      line.priceSeen = unitPrice(found.product, found.variant);
    } else {
      shop.cart.push({ id: nextId(shop, 'cl'), userId: user.id, productId: found.product.id, variantId: found.variant.id, quantity: next, priceSeen: unitPrice(found.product, found.variant), addedAt: isoNow() });
    }
    return cartWire(shop, user.id, adjusted);
  });

  route('PATCH', '/shop/cart/items/:id', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const line = shop.cart.find(l => l.id === decodeURIComponent(ctx.params[0]) && l.userId === user.id);
    if (!line) throw notFound('Bag item');
    const requested = int(ctx.body.quantity, line.quantity);
    if (requested < 1 || requested > LINE_MAX) throw bad('Choose between 1 and 20.', { quantity: 'Between 1 and 20' });
    const found = findVariant(shop, line.variantId);
    const cap = found ? Math.min(LINE_MAX, found.variant.stock) : requested;
    line.quantity = Math.max(1, Math.min(requested, cap));
    // Saving a line accepts its current price.
    if (found) line.priceSeen = unitPrice(found.product, found.variant);
    const adjusted = line.quantity < requested ? { variantId: line.variantId, requested, quantity: line.quantity, reason: 'stock' } : null;
    return cartWire(shop, user.id, adjusted);
  });

  route('DELETE', '/shop/cart/items/:id', ctx => {
    const user = requireUser(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    ctx.db.shop.cart = ctx.db.shop.cart.filter(l => !(l.id === id && l.userId === user.id));
    return cartWire(ctx.db.shop, user.id, null);
  });

  route('DELETE', '/shop/cart', ctx => {
    const user = requireUser(ctx);
    ctx.db.shop.cart = ctx.db.shop.cart.filter(l => l.userId !== user.id);
    return cartWire(ctx.db.shop, user.id, null);
  });

  // ─── Checkout ───
  const readChoices = (body: Record<string, any>): StoreChoice[] =>
    (Array.isArray(body.stores) ? body.stores : []).map((s: any) => ({
      storeId: String(s?.storeId ?? ''),
      paymentMethod: s?.paymentMethod === 'transfer' ? 'transfer' : 'cod',
      couponCode: s?.couponCode ? String(s.couponCode) : null,
      note: s?.note ? String(s.note).slice(0, 300) : null,
    }));

  const addressFor = (db: MockDb, userId: string, id: unknown): MockAddress => {
    const a = db.shop.addresses.find(x => x.id === id && x.userId === userId);
    if (!a) throw notFound('Address');
    return a;
  };

  route('POST', '/shop/cart/preview', ctx => {
    const user = requireUser(ctx);
    return planWire(planFor(ctx.db, user.id, addressFor(ctx.db, user.id, ctx.body.addressId).city, readChoices(ctx.body)));
  });

  route('GET', '/shop/stores/:id/coupons/available', ctx => availableCouponsWire(ctx.db.shop, decodeURIComponent(ctx.params[0]), requireUser(ctx).id));

  route('POST', '/shop/checkout', ctx => {
    const user = requireUser(ctx);
    const db = ctx.db;
    const shop = db.shop;
    const key = ctx.headers['idempotency-key'];
    if (!key) throw new ShopError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Checkout needs an Idempotency-Key.');
    const replayKey = `${user.id}|${key}`;
    if (shop.idempotency[replayKey]) {
      const stored = shop.idempotency[replayKey];
      ctx.setStatus(stored.status);
      return stored.payload;
    }
    const address = addressFor(db, user.id, ctx.body.addressId);
    const choices = readChoices(ctx.body);
    const plan = planFor(db, user.id, address.city, choices);
    if (!plan.length) throw new ShopError(400, 'CART_EMPTY', 'Your bag is empty.');
    const inCart = plan.map(p => p.raw.store.id);
    const named = choices.map(c => c.storeId);
    const missing = inCart.filter(id => !named.includes(id));
    const unexpected = named.filter(id => !inCart.includes(id));
    if (missing.length || unexpected.length) throw new ShopError(400, 'CHECKOUT_MISMATCH', 'Name every store in your bag once.', { missing, unexpected });
    const first = plan.flatMap(p => p.wire.issues.map(i => ({ ...i, storeId: p.raw.store.id })))[0];
    if (first) {
      const status = ['STORE_UNAVAILABLE', 'OUT_OF_STOCK'].includes(first.code) ? 409 : 400;
      throw new ShopError(status, first.code, first.message, { ...(first.details ?? {}), stores: plan.map(p => ({ storeId: p.raw.store.id, issues: p.wire.issues })) });
    }

    const groupCode = `MM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const createdAt = isoNow();
    const orderIds: string[] = [];
    plan.forEach(({ raw }, i) => {
      const { store, states, coupon, discount, shippingFee, subtotal, total, method, choice, accounts } = raw;
      const order: MockOrder = {
        id: nextId(shop, 'o'),
        code: `${groupCode}-${i + 1}`,
        groupCode,
        userId: user.id,
        storeId: store.id,
        status: 'placed',
        paymentMethod: method,
        paymentStatus: method === 'transfer' ? 'awaiting_transfer' : 'cod_pending',
        items: states.map(s => ({
          id: nextId(shop, 'oi'),
          productId: s.product!.id,
          variantId: s.variant!.id,
          name: s.product!.name,
          variantLabel: variantLabel(s.variant!),
          imageUrl: s.product!.images[0]?.url ?? null,
          unitPrice: s.price,
          quantity: s.line.quantity,
          returnedQty: 0,
          reviewed: false,
        })),
        itemsTotal: subtotal,
        shippingFee,
        discount,
        total,
        couponCode: coupon?.code ?? null,
        note: choice?.note ?? null,
        shipment: null,
        events: [{ type: 'placed', note: null, createdAt }],
        paymentAccountId: method === 'transfer' ? (accounts[0]?.id ?? null) : null,
        payBy: method === 'transfer' ? new Date(Date.now() + 24 * HOUR).toISOString() : null,
        paymentProof: null,
        cancelReason: null,
        internalNote: null,
        createdAt,
        deliveredAt: null,
      };
      for (const s of states) moveStock(shop, s.variant!, -s.line.quantity, 'order', order.code);
      if (coupon) {
        coupon.usedCount += 1;
        coupon.usedBy[user.id] = (coupon.usedBy[user.id] ?? 0) + 1;
      }
      shop.orders.push(order);
      orderIds.push(order.id);
      notify(shop, store.ownerId, 'new_order', `New order ${order.code}`,
        `${firstName(user)} ordered ${order.items.reduce((n, x) => n + x.quantity, 0)} item(s) · ${method === 'cod' ? 'Cash on delivery' : 'Transfer'}`,
        { groupCode, orderId: order.id });
    });
    shop.groups.push({ code: groupCode, userId: user.id, address: { ...address }, orderIds, createdAt });
    const placed = new Set(plan.flatMap(p => p.raw.states.map(x => x.line.id)));
    shop.cart = shop.cart.filter(l => !placed.has(l.id));
    notify(shop, user.id, 'order_placed', `Order ${groupCode} placed`, 'We’ll keep you posted as each store updates it.', { groupCode });

    const payload = groupWire(db, shop.groups[shop.groups.length - 1]);
    ctx.setStatus(201);
    shop.idempotency[replayKey] = { status: 201, payload };
    return payload;
  });

  // ─── Orders ───
  route('GET', '/shop/orders', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const segment = ctx.query.status ? String(ctx.query.status) : null;
    const rows = shop.groups
      .filter(g => g.userId === user.id && (!segment || groupSegment(shop, g) === segment))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(g => groupRowWire(ctx.db, g));
    return paginate(rows, ctx.query);
  });

  route('GET', '/shop/orders/:groupCode', ctx => {
    const user = requireUser(ctx);
    const g = ctx.db.shop.groups.find(x => x.code === decodeURIComponent(ctx.params[0]).toUpperCase() && x.userId === user.id);
    if (!g) throw notFound('Order');
    return groupWire(ctx.db, g);
  });

  const myOrder = (ctx: ShopCtx) => {
    const user = requireUser(ctx);
    const o = ctx.db.shop.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!o) throw notFound('Order');
    return { user, order: o };
  };

  const transition = (o: MockOrder, from: string[], to: string) => {
    if (!from.includes(o.status)) throw new ShopError(409, 'INVALID_TRANSITION', 'This order can’t do that any more.', { from: apiStatus(o), to, allowed: [] });
  };

  const reasonOf = (body: Record<string, any>) => {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) throw bad('Tell the store why (3 characters or more).', { reason: 'At least 3 characters' });
    return reason;
  };

  route('GET', '/shop/store-orders/:id', ctx => storeOrderWire(ctx.db, myOrder(ctx).order, 'customer'));

  route('POST', '/shop/store-orders/:id/cancel', ctx => {
    const { order } = myOrder(ctx);
    transition(order, ['placed'], 'cancelled');
    cancelOrder(ctx.db.shop, order, reasonOf(ctx.body));
    notify(ctx.db.shop, storeById(ctx.db.shop, order.storeId)!.ownerId, 'order_update', `${order.code} was cancelled`, 'The customer cancelled before you confirmed it.', { groupCode: order.groupCode, orderId: order.id });
    return storeOrderWire(ctx.db, order, 'customer');
  });

  route('POST', '/shop/store-orders/:id/request-cancel', ctx => {
    const { order } = myOrder(ctx);
    if (order.status === 'cancellation_requested') throw new ShopError(409, 'CONFLICT', 'You have already asked the store to cancel this order.');
    transition(order, ['confirmed', 'packed'], 'cancelled');
    const reason = reasonOf(ctx.body);
    order.status = 'cancellation_requested';
    addEvent(order, 'cancellation_requested', reason);
    notify(ctx.db.shop, storeById(ctx.db.shop, order.storeId)!.ownerId, 'order_update', `Cancellation requested on ${order.code}`, reason, { groupCode: order.groupCode, orderId: order.id });
    return storeOrderWire(ctx.db, order, 'customer');
  });

  route('POST', '/shop/store-orders/:id/received', ctx => {
    const { order } = myOrder(ctx);
    transition(order, ['shipped'], 'delivered');
    order.status = 'delivered';
    order.deliveredAt = isoNow();
    addEvent(order, 'delivered', 'Confirmed by the customer');
    return storeOrderWire(ctx.db, order, 'customer');
  });

  route('POST', '/shop/store-orders/:id/payment-proof', ctx => {
    const { order } = myOrder(ctx);
    if (order.paymentMethod !== 'transfer' || !['awaiting_transfer', 'proof_rejected'].includes(order.paymentStatus) || order.status === 'cancelled') {
      throw new ShopError(409, 'INVALID_TRANSITION', 'This order isn’t waiting for a payment.', { from: apiPaymentStatus(order), to: 'proof_submitted', allowed: [] });
    }
    const paymentRef = String(ctx.body.paymentRef ?? '').trim();
    if (paymentRef.length < 3) throw bad('Enter the transaction ID.', { paymentRef: 'Enter the transaction ID' });
    order.paymentProof = { transactionId: paymentRef, imageUrl: ctx.body.proofUrl ? String(ctx.body.proofUrl) : null, submittedAt: isoNow(), rejectionReason: null };
    order.paymentStatus = 'proof_submitted';
    addEvent(order, 'payment_proof_submitted', paymentRef);
    notify(ctx.db.shop, storeById(ctx.db.shop, order.storeId)!.ownerId, 'payment_proof', `Check a transfer for ${order.code}`, `${rupees(order.total)} · ${paymentRef}`, { groupCode: order.groupCode, orderId: order.id });
    return storeOrderWire(ctx.db, order, 'customer');
  });

  // ─── Returns and reviews ───
  const RETURN_REASONS = ['wrong_item', 'damaged', 'size_issue', 'not_as_described', 'other'];

  route('POST', '/shop/store-orders/:id/returns', ctx => {
    const { user, order } = myOrder(ctx);
    const shop = ctx.db.shop;
    if (order.status !== 'delivered') throw new ShopError(409, 'INVALID_TRANSITION', 'Only delivered orders can be returned.', { from: apiStatus(order), to: 'returned', allowed: [] });
    const end = returnWindowEnd(shop, order);
    if (!end || Date.parse(end) < ctx.now) {
      const store = storeById(shop, order.storeId)!;
      throw new ShopError(400, 'RETURN_WINDOW_CLOSED', 'The return window for this order has closed.', { deliveredAt: order.deliveredAt, returnWindowDays: store.settings.returnWindowDays, closedAt: end });
    }
    if (openReturnFor(shop, order.id)) throw new ShopError(409, 'RETURN_ALREADY_OPEN', 'You already have a return open for this order.');
    const reason = String(ctx.body.reason ?? '');
    if (!RETURN_REASONS.includes(reason)) throw bad('Choose a reason.', { reason: 'Choose a reason' });
    const items = (Array.isArray(ctx.body.items) ? ctx.body.items : [])
      .map((i: any) => ({ orderItemId: String(i?.orderItemId ?? ''), quantity: int(i?.quantity) }))
      .filter((i: { quantity: number }) => i.quantity > 0);
    if (!items.length) throw bad('Choose at least one item.', { items: 'Choose at least one item' });
    for (const i of items) {
      if (i.quantity > returnableQty(shop, order, i.orderItemId)) throw bad('That is more than you can still return.', { items: 'Too many' });
    }
    const r = {
      id: nextId(shop, 'rt'),
      orderId: order.id,
      userId: user.id,
      storeId: order.storeId,
      status: 'requested' as const,
      reason: reason as ReturnReason,
      details: String(ctx.body.details ?? '').trim(),
      photos: (Array.isArray(ctx.body.photos) ? ctx.body.photos : []).slice(0, 5).map(String),
      items,
      storeNote: null,
      refund: null,
      createdAt: isoNow(),
    };
    shop.returns.push(r);
    addEvent(order, 'return_requested', r.details || null);
    notify(shop, storeById(shop, order.storeId)!.ownerId, 'return_requested', `Return requested on ${order.code}`, `${items.length} item(s)`, { groupCode: order.groupCode, orderId: order.id, returnId: r.id });
    ctx.setStatus(201);
    return returnWire(ctx.db, r, 'customer');
  });

  route('GET', '/shop/returns', ctx => {
    const user = requireUser(ctx);
    const status = ctx.query.status ? String(ctx.query.status) : null;
    const rows = ctx.db.shop.returns
      .filter(r => r.userId === user.id && (!status || r.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => returnWire(ctx.db, r, 'customer'));
    return paginate(rows, ctx.query);
  });

  route('GET', '/shop/returns/:id', ctx => {
    const user = requireUser(ctx);
    const r = ctx.db.shop.returns.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!r) throw notFound('Return');
    return returnWire(ctx.db, r, 'customer');
  });

  route('POST', '/shop/order-items/:id/review', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const itemId = decodeURIComponent(ctx.params[0]);
    const order = shop.orders.find(o => o.userId === user.id && o.items.some(i => i.id === itemId));
    const item = order?.items.find(i => i.id === itemId);
    if (!order || !item) throw notFound('Item');
    if (order.status !== 'delivered' && order.status !== 'returned') throw new ShopError(403, 'REVIEW_NOT_ALLOWED', 'You can review it once it’s delivered.');
    if (item.reviewed) throw new ShopError(409, 'REVIEW_EXISTS', 'You have already reviewed this item.');
    const rating = int(ctx.body.rating);
    if (rating < 1 || rating > 5) throw bad('Choose a rating.', { rating: '1 to 5' });
    const review = {
      id: nextId(shop, 'r'),
      productId: item.productId,
      storeId: order.storeId,
      userId: user.id,
      authorName: `${firstName(user)} ${user.name.split(' ')[1]?.[0] ?? ''}.`.replace(' .', ''),
      orderItemId: item.id,
      rating,
      title: null,
      body: String(ctx.body.text ?? '').trim(),
      photos: (Array.isArray(ctx.body.photos) ? ctx.body.photos : []).slice(0, 5).map(String),
      createdAt: isoNow(),
      reply: null,
    };
    shop.reviews.push(review);
    item.reviewed = true;
    ctx.setStatus(201);
    return reviewWire(shop, review, true);
  });

  const readAddress = (body: Record<string, any>) => {
    const a = {
      label: ['home', 'work', 'other'].includes(body.label) ? body.label : 'home',
      fullName: String(body.fullName ?? '').trim(),
      phone: String(body.phone ?? '').trim(),
      city: String(body.city ?? '').trim(),
      area: String(body.area ?? '').trim(),
      line1: String(body.line1 ?? '').trim(),
      landmark: body.landmark ? String(body.landmark).trim() : null,
      lat: num(body.lat),
      lng: num(body.lng),
    };
    const fields: Record<string, string> = {};
    if (a.fullName.length < 2) fields.fullName = 'Enter a name';
    if (!/^\+923\d{9}$/.test(a.phone)) fields.phone = 'Enter a Pakistani mobile number';
    if (!a.city) fields.city = 'Choose a city';
    if (a.area.length < 2) fields.area = 'Enter the area';
    if (a.line1.length < 5) fields.line1 = 'Enter the street address';
    if (Object.keys(fields).length) throw bad('Check the address.', fields);
    return a;
  };

  route('GET', '/addresses', ctx => {
    const user = requireUser(ctx);
    return ctx.db.shop.addresses.filter(a => a.userId === user.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  });
  route('POST', '/addresses', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const mine = shop.addresses.filter(a => a.userId === user.id);
    const address: MockAddress = { id: nextId(shop, 'ad'), userId: user.id, ...readAddress(ctx.body), isDefault: !mine.length || bool(ctx.body.isDefault) };
    if (address.isDefault) mine.forEach(a => (a.isDefault = false));
    shop.addresses.push(address);
    ctx.setStatus(201);
    return address;
  });
  route('PATCH', '/addresses/:id', ctx => {
    const user = requireUser(ctx);
    const a = ctx.db.shop.addresses.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!a) throw notFound('Address');
    Object.assign(a, readAddress({ ...a, ...ctx.body }));
    if (bool(ctx.body.isDefault)) {
      ctx.db.shop.addresses.filter(x => x.userId === user.id).forEach(x => (x.isDefault = x.id === a.id));
    }
    return a;
  });
  route('DELETE', '/addresses/:id', ctx => {
    const user = requireUser(ctx);
    const shop = ctx.db.shop;
    const a = shop.addresses.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!a) throw notFound('Address');
    shop.addresses = shop.addresses.filter(x => x.id !== a.id);
    if (a.isDefault) {
      const next = shop.addresses.find(x => x.userId === user.id);
      if (next) next.isDefault = true;
    }
    return { removed: true };
  });
  route('POST', '/addresses/:id/default', ctx => {
    const user = requireUser(ctx);
    const mine = ctx.db.shop.addresses.filter(x => x.userId === user.id);
    const a = mine.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!a) throw notFound('Address');
    mine.forEach(x => (x.isDefault = x.id === a.id));
    return a;
  });

  // ══ Notifications (core) ════════════════════════════
  route('GET', '/notifications', ctx => {
    const user = requireUser(ctx);
    const rows = ctx.db.shop.notifications
      .filter(n => n.userId === user.id && (!bool(ctx.query.unread) || !n.isRead))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      // The API's row: `readAt` rather than a flag (API_SHOPPING.md §notifications).
      .map(({ userId: _owner, isRead, ...n }) => ({ ...n, readAt: isRead ? n.createdAt : null }));
    return paginate(rows, ctx.query);
  });
  route('GET', '/notifications/unread-count', ctx => {
    const user = requireUser(ctx);
    return { unread: ctx.db.shop.notifications.filter(n => n.userId === user.id && !n.isRead).length };
  });
  route('POST', '/notifications/read-all', ctx => {
    const user = requireUser(ctx);
    for (const n of ctx.db.shop.notifications) if (n.userId === user.id) n.isRead = true;
    return { read: true };
  });
  route('POST', '/notifications/:id/read', ctx => {
    const user = requireUser(ctx);
    const n = ctx.db.shop.notifications.find(x => x.id === ctx.params[0] && x.userId === user.id);
    if (n) n.isRead = true;
    return { read: true };
  });

  // ══ Store partner (/shop/partner) ═══════════════════
  // The real API's paths, bodies, rules and error codes; answers from shopWire.
  const P = '/shop/partner';

  /** 400 VALIDATION_FAILED unless `text` is `min`–`max` characters after trimming. */
  const textOf = (v: unknown, field: string, min: number, max: number, message: string) => {
    const t = String(v ?? '').trim();
    if (t.length < min || t.length > max) throw bad(message, { [field]: message });
    return t;
  };
  const invalidMove = (from: string, to: string, allowed: string[] = []) =>
    new ShopError(409, 'INVALID_TRANSITION', 'This order can’t do that right now.', { from, to, allowed });

  route('GET', `${P}/dashboard`, ctx => dashboardWire(ctx.db.shop, myStore(ctx).store, ctx.now));
  route('GET', `${P}/insights`, ctx => {
    const range = ['7d', '30d', '90d'].includes(ctx.query.range) ? ctx.query.range : '30d';
    return insightsWire(ctx.db.shop, myStore(ctx).store, range, ctx.now);
  });

  // Store profile & settings
  /** The server picks the text colour on the brand: white where it reads, else ink. */
  const onBrandFor = (brand: string) => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    return (1.05 / (lum(brand) + 0.05) >= 4.5 ? '#FFFFFF' : '#16151A');
  };
  const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'website'] as const;

  route('GET', `${P}/store`, ctx => storeProfileWire(ctx.db.shop, myStore(ctx).store));
  route('PATCH', `${P}/store`, ctx => {
    const { store } = myStore(ctx);
    const b = ctx.body;
    if (b.brandColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(String(b.brandColor))) throw bad('brandColor must be a #RRGGBB hex colour', { brandColor: 'brandColor must be a #RRGGBB hex colour' });
    if (b.tagline !== undefined) store.tagline = b.tagline === null ? '' : textOf(b.tagline, 'tagline', 0, 120, 'Keep the tagline under 120 characters.');
    if (b.about !== undefined) store.about = b.about === null ? '' : textOf(b.about, 'about', 0, 2000, 'Keep it under 2,000 characters.');
    if (b.logoUrl !== undefined) store.logoUrl = b.logoUrl;
    if (b.coverUrl !== undefined) store.coverUrl = b.coverUrl;
    if (b.brandColor !== undefined) {
      store.brandColor = String(b.brandColor).toUpperCase();
      store.onBrandColor = onBrandFor(store.brandColor);
    }
    if (b.socials !== undefined) {
      const given: Record<string, unknown> = b.socials ?? {};
      store.socials = Object.fromEntries(SOCIAL_KEYS.map(k => [k, given[k] ? String(given[k]) : null])) as MockStore['socials'];
      store.whatsapp = given.whatsapp ? String(given.whatsapp) : null;
    }
    return storeProfileWire(ctx.db.shop, store);
  });

  route('GET', `${P}/store/settings`, ctx => storeSettingsWire(myStore(ctx).store));
  route('PATCH', `${P}/store/settings`, ctx => {
    const { store } = myStore(ctx);
    const b = ctx.body;
    const s = store.settings;
    const next = { ...s };
    if (b.returnWindowDays !== undefined) next.returnWindowDays = Math.min(30, Math.max(0, int(b.returnWindowDays)));
    if (b.codEnabled !== undefined) next.codEnabled = bool(b.codEnabled);
    if (b.codLimit !== undefined) next.codLimit = int(b.codLimit) >= 1_000_000 ? null : Math.max(0, int(b.codLimit));
    if (b.shippingFlatFee !== undefined) next.shippingFee = Math.max(0, int(b.shippingFlatFee));
    if (b.freeShippingOver !== undefined) next.freeShippingOver = b.freeShippingOver === null ? null : Math.max(1, int(b.freeShippingOver));
    if (Array.isArray(b.deliveryCities)) {
      next.deliveryCities = [...new Set(b.deliveryCities.map((c: unknown) => String(c).trim()).filter((c: string) => c.length >= 2))] as string[];
      next.nationwide = next.deliveryCities.length === 0;
    }
    if (b.dispatchDaysMin !== undefined) next.dispatchMinDays = Math.max(0, int(b.dispatchDaysMin));
    if (b.dispatchDaysMax !== undefined) next.dispatchMaxDays = Math.max(0, int(b.dispatchDaysMax));
    if (next.dispatchMinDays > next.dispatchMaxDays) {
      throw bad('Dispatch days: the maximum cannot be below the minimum.', { dispatchDaysMax: 'Dispatch days: the maximum cannot be below the minimum.' });
    }
    store.settings = next;
    if (b.isPaused !== undefined) store.isPaused = bool(b.isPaused);
    if (b.pauseMessage !== undefined) store.pauseMessage = b.pauseMessage === null ? null : String(b.pauseMessage).slice(0, 200);
    return storeSettingsWire(store);
  });

  // Payment accounts
  const readAccount = (b: Record<string, any>) => {
    const kind = ['raast', 'jazzcash', 'easypaisa', 'bank'].includes(b.kind) ? b.kind : 'bank';
    const number = kind === 'bank' ? String(b.accountNumber ?? '').toUpperCase().replace(/\s+/g, '') : String(b.accountNumber ?? '').replace(/\D/g, '');
    const fields: Record<string, string> = {};
    if (String(b.accountTitle ?? '').trim().length < 3) fields.accountTitle = 'Enter the account title';
    if (kind === 'bank' ? !/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(number) : !/^03\d{9}$/.test(number)) fields.accountNumber = 'Check the number';
    if (kind === 'bank' && !String(b.bankName ?? '').trim()) fields.bankName = 'Enter the bank name';
    if (Object.keys(fields).length) throw bad('Check the account details.', fields);
    return { kind, title: String(b.accountTitle).trim(), number, bankName: kind === 'bank' ? String(b.bankName).trim() : null, isActive: b.isActive === undefined ? true : bool(b.isActive) };
  };
  const tooManyActive = (store: MockStore) => {
    if (store.paymentAccounts.filter(a => a.isActive).length > 4) {
      throw bad('A store can have at most 4 active payment accounts. Deactivate one first.', { isActive: 'At most 4 active accounts' });
    }
  };
  route('GET', `${P}/store/payment-accounts`, ctx => {
    const { store } = myStore(ctx);
    return store.paymentAccounts.map(a => paymentAccountWire(store, a));
  });
  route('POST', `${P}/store/payment-accounts`, ctx => {
    const { store } = myStore(ctx);
    const account = { id: nextId(ctx.db.shop, 'pa'), ...readAccount(ctx.body) };
    if (store.paymentAccounts.some(a => a.kind === account.kind && a.number === account.number)) throw new ShopError(409, 'CONFLICT', 'You have already added this account.');
    store.paymentAccounts.push(account);
    tooManyActive(store);
    ctx.setStatus(201);
    return paymentAccountWire(store, account);
  });
  route('PATCH', `${P}/store/payment-accounts/:id`, ctx => {
    const { store } = myStore(ctx);
    const a = store.paymentAccounts.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!a) throw notFound('Payment account');
    Object.assign(a, readAccount({ kind: a.kind, accountTitle: a.title, accountNumber: a.number, bankName: a.bankName, isActive: a.isActive, ...ctx.body }));
    tooManyActive(store);
    return paymentAccountWire(store, a);
  });
  route('DELETE', `${P}/store/payment-accounts/:id`, ctx => {
    const { store } = myStore(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    if (!store.paymentAccounts.some(x => x.id === id)) throw notFound('Payment account');
    store.paymentAccounts = store.paymentAccounts.filter(x => x.id !== id);
    return { removed: true };
  });

  // Orders
  route('GET', `${P}/orders`, ctx => {
    const { store } = myStore(ctx);
    const db = ctx.db;
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const status = ctx.query.status ? String(ctx.query.status) : null;
    const paymentStatus = ctx.query.paymentStatus ? String(ctx.query.paymentStatus) : null;
    const rows = db.shop.orders
      .filter(o => o.storeId === store.id)
      .filter(o => (!status || apiStatus(o) === status) && (!paymentStatus || apiPaymentStatus(o) === paymentStatus))
      .map(o => partnerOrderRowWire(db, o))
      .filter(r => !q || r.code.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q))
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    return paginate(rows, ctx.query);
  });

  const storeOrder = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const o = ctx.db.shop.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!o) throw notFound('Order');
    return { store, order: o };
  };
  /** The order moves `to` if the store may move it there now. */
  const storeMove = (o: MockOrder, to: string) => {
    const from = apiStatus(o);
    const allowed = ({ placed: ['confirmed', 'cancelled'], confirmed: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'] } as Record<string, string[]>)[from] ?? [];
    if (!allowed.includes(to)) throw invalidMove(from, to, allowed);
  };
  const customerUpdate = (ctx: ShopCtx, o: MockOrder, title: string, body: string, type: 'order_update' | 'payment_update' = 'order_update') =>
    notify(ctx.db.shop, o.userId, type, title, body, { groupCode: o.groupCode, orderId: o.id });
  const storeView = (ctx: ShopCtx, o: MockOrder) => storeOrderWire(ctx.db, o, 'store');

  route('GET', `${P}/orders/:id`, ctx => storeView(ctx, storeOrder(ctx).order));
  route('POST', `${P}/orders/:id/confirm`, ctx => {
    const { store, order } = storeOrder(ctx);
    storeMove(order, 'confirmed');
    order.status = 'confirmed';
    addEvent(order, 'confirmed');
    customerUpdate(ctx, order, `${store.name} confirmed your order`, `${order.code} is being prepared.`);
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/reject`, ctx => {
    const { order } = storeOrder(ctx);
    if (apiStatus(order) !== 'placed') throw new ShopError(409, 'INVALID_TRANSITION', 'Only a new order can be rejected; cancel it instead.', { from: apiStatus(order), to: 'cancelled', allowed: [] });
    const reason = textOf(ctx.body.reason, 'reason', 3, 500, 'reason must be 3 to 500 characters');
    cancelOrder(ctx.db.shop, order, reason);
    customerUpdate(ctx, order, `${order.code} declined`, reason);
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/pack`, ctx => {
    const { order } = storeOrder(ctx);
    storeMove(order, 'packed');
    order.status = 'packed';
    addEvent(order, 'packed');
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/ship`, ctx => {
    const { store, order } = storeOrder(ctx);
    storeMove(order, 'shipped');
    if (order.paymentMethod === 'transfer' && order.paymentStatus !== 'paid') {
      throw new ShopError(409, 'PAYMENT_NOT_CONFIRMED', 'Confirm the transfer has arrived before shipping.', { paymentStatus: apiPaymentStatus(order) });
    }
    const courierName = textOf(ctx.body.courierName, 'courierName', 2, 80, 'courierName must be 2 to 80 characters');
    const self = courierName.toLowerCase() === 'self';
    const riderName = String(ctx.body.riderName ?? '').trim();
    const riderPhone = String(ctx.body.riderPhone ?? '').trim();
    const trackingRef = String(ctx.body.trackingRef ?? '').trim();
    if (self ? !riderName || !riderPhone : trackingRef.length < 3) {
      const message = self ? 'Self-delivery needs the rider’s name and phone.' : 'Add the courier tracking number.';
      throw bad(message, self ? { riderName: message, riderPhone: message } : { trackingRef: message });
    }
    const known = COURIERS.find(c => c.name.toLowerCase() === courierName.toLowerCase());
    order.status = 'shipped';
    order.shipment = self ? { courier: 'own_rider', trackingRef: '', riderName, riderPhone } : { courier: known?.key ?? 'other', trackingRef };
    addEvent(order, 'shipped', self ? `with ${riderName} (${riderPhone})` : `${courierName} · ${trackingRef}`);
    customerUpdate(ctx, order, `Your ${store.name} order shipped`, self ? `With ${riderName}` : trackingRef);
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/deliver`, ctx => {
    const { order } = storeOrder(ctx);
    storeMove(order, 'delivered');
    order.status = 'delivered';
    order.deliveredAt = isoNow();
    addEvent(order, 'delivered');
    customerUpdate(ctx, order, `Delivered: ${order.code}`, 'How was it? You can review your items now.');
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/cancel`, ctx => {
    const { store, order } = storeOrder(ctx);
    storeMove(order, 'cancelled');
    const reason = textOf(ctx.body.reason, 'reason', 3, 500, 'reason must be 3 to 500 characters');
    cancelOrder(ctx.db.shop, order, reason);
    customerUpdate(ctx, order, `${store.name} cancelled ${order.code}`, reason);
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/payment/confirm`, ctx => {
    const { order } = storeOrder(ctx);
    const from = apiPaymentStatus(order);
    if (order.paymentMethod !== 'transfer' || order.status === 'cancelled' || !['awaiting_transfer', 'proof_submitted'].includes(from)) throw invalidMove(from, 'paid');
    order.paymentStatus = 'paid';
    addEvent(order, 'payment_confirmed');
    customerUpdate(ctx, order, `Payment confirmed for ${order.code}`, `${rupees(order.total)} received.`, 'payment_update');
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/payment/reject`, ctx => {
    const { order } = storeOrder(ctx);
    const from = apiPaymentStatus(order);
    if (from !== 'proof_submitted' || order.status === 'cancelled') throw invalidMove(from, 'awaiting_transfer');
    const reason = textOf(ctx.body.reason, 'reason', 3, 500, 'reason must be 3 to 500 characters');
    order.paymentStatus = 'proof_rejected';
    if (order.paymentProof) order.paymentProof.rejectionReason = reason;
    order.payBy = new Date(ctx.now + 24 * HOUR).toISOString();
    addEvent(order, 'payment_rejected', reason);
    customerUpdate(ctx, order, `Payment not received for ${order.code}`, reason, 'payment_update');
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/cash-collected`, ctx => {
    const { order } = storeOrder(ctx);
    const from = apiPaymentStatus(order);
    if (order.paymentMethod !== 'cod' || from !== 'cod_pending' || apiStatus(order) !== 'delivered') throw invalidMove(from, 'paid');
    order.paymentStatus = 'cash_collected';
    addEvent(order, 'cash_collected');
    return storeView(ctx, order);
  });
  route('POST', `${P}/orders/:id/refund`, ctx => {
    const { order } = storeOrder(ctx);
    const from = apiPaymentStatus(order);
    if (from !== 'refund_due') throw invalidMove(from, 'refunded');
    const amount = int(ctx.body.amount);
    const refundRef = String(ctx.body.refundRef ?? '').trim();
    const fields: Record<string, string> = {};
    if (amount < 1 || amount > order.total) fields.amount = `Between Rs 1 and ${rupees(order.total)}`;
    if (refundRef.length < 3) fields.refundRef = 'Enter the refund reference';
    if (Object.keys(fields).length) throw bad('Check the refund.', fields);
    order.paymentStatus = 'refunded';
    order.refund = { amount, reference: refundRef, recordedAt: isoNow() };
    addEvent(order, 'refunded', `${rupees(amount)} · ${refundRef}`);
    customerUpdate(ctx, order, `Refund sent for ${order.code}`, `${rupees(amount)} · ${refundRef}`, 'payment_update');
    return storeView(ctx, order);
  });

  // Products
  const myProduct = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const p = ctx.db.shop.products.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!p) throw notFound('Product');
    return { store, product: p };
  };

  /** What publishing needs, as the API words it. */
  const publishProblems = (p: Pick<MockProduct, 'name' | 'price' | 'categoryId' | 'images' | 'variants'>) => {
    const fields: Record<string, string> = {};
    if (!p.images.length) fields.images = 'Add at least one photo before publishing.';
    if (!p.categoryId) fields.categoryId = 'Choose a category before publishing.';
    if (!p.variants.some(v => v.stock > 0)) fields.variants = 'At least one variant must be in stock to publish.';
    return fields;
  };

  /** Applies a CreateProductDto / UpdateProductDto: option 1 is the size, option 2 the colour with its swatch. */
  const applyProduct = (ctx: ShopCtx, store: MockStore, p: MockProduct, b: Record<string, any>) => {
    const shop = ctx.db.shop;
    if (b.name !== undefined) p.name = textOf(b.name, 'name', 2, 120, 'name must be 2 to 120 characters');
    if (b.description !== undefined) p.description = String(b.description).slice(0, 5000);
    if (b.categoryId !== undefined) {
      if (!shop.categories.some(c => c.id === b.categoryId)) throw bad('Choose a category.', { categoryId: 'Unknown category' });
      p.categoryId = b.categoryId;
    }
    if (b.collectionId !== undefined) {
      if (b.collectionId && !shop.collections.some(c => c.id === b.collectionId && c.storeId === store.id)) throw notFound('Collection');
      p.collectionId = b.collectionId;
    }
    if (b.basePrice !== undefined) p.price = Math.max(1, int(b.basePrice));
    if (b.salePrice !== undefined) p.salePrice = b.salePrice === null ? null : int(b.salePrice);
    if (p.salePrice !== null && p.salePrice >= p.price) throw bad('The sale price must be below the price.', { salePrice: 'The sale price must be below the price.' });
    if (Array.isArray(b.images)) p.images = b.images.slice(0, 8).map((i: any) => ({ url: String(i.url), publicId: String(i.publicId ?? '') }));
    if (Array.isArray(b.variants) && b.variants.length) {
      const swatches: Record<string, string> = {};
      const kept: MockVariant[] = b.variants.map((v: any, i: number) => {
        const existing = p.variants.find(x => x.id === v.id) ?? p.variants.find(x => x.option1 === (v.option1 ?? null) && x.option2 === (v.option2 ?? null));
        const variant: MockVariant = existing ?? { id: `${p.id}_v${Date.now().toString(36)}${i}`, option1: null, option2: null, sku: '', stock: 0, priceDelta: 0 };
        variant.option1 = v.option1 ?? null;
        variant.option2 = v.option2 ?? null;
        variant.sku = String(v.sku ?? '').toUpperCase();
        variant.priceDelta = int(v.priceDelta);
        if (v.option2 && v.colorHex) swatches[v.option2] = String(v.colorHex);
        const stock = Math.max(0, int(v.stock, variant.stock));
        if (stock !== variant.stock) moveStock(shop, variant, stock - variant.stock, 'manual', null);
        return variant;
      });
      const sizes = [...new Set(kept.map(v => v.option1).filter((x): x is string => !!x))];
      const colours = [...new Set(kept.map(v => v.option2).filter((x): x is string => !!x))];
      p.variants = kept;
      p.option1 = sizes.length ? { name: 'Size', values: sizes } : null;
      p.option2 = colours.length ? { name: 'Colour', values: colours, swatches } : null;
    }
    if (!p.variants.length) p.variants = [{ id: `${p.id}_v0`, option1: null, option2: null, sku: '', stock: 0, priceDelta: 0 }];
    p.updatedAt = isoNow();
    const status = b.status ?? p.status;
    if (status === 'active') {
      const problems = publishProblems(p);
      const first = Object.values(problems)[0];
      if (first) throw bad(first, problems);
    }
    p.status = status;
  };

  route('GET', `${P}/products`, ctx => {
    const { store } = myStore(ctx);
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const status = ctx.query.status ? String(ctx.query.status) : null;
    const rows = ctx.db.shop.products
      .filter(p => p.storeId === store.id && (!status || (status === 'archived' ? p.status === 'archived' || p.removed : p.status === status && !p.removed)))
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .filter(p => !ctx.query.collectionId || p.collectionId === ctx.query.collectionId)
      .filter(p => ctx.query.lowStock !== 'true' || p.variants.some(v => v.stock <= LOW_STOCK))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(p => partnerProductRowWire(ctx.db.shop, p));
    return paginate(rows, ctx.query);
  });
  route('GET', `${P}/products/:id`, ctx => partnerProductWire(ctx.db.shop, myProduct(ctx).product));
  route('POST', `${P}/products`, ctx => {
    const { store } = myStore(ctx);
    const shop = ctx.db.shop;
    const b = ctx.body;
    const fields: Record<string, string> = {};
    if (String(b.name ?? '').trim().length < 2) fields.name = 'name must be 2 to 120 characters';
    if (!b.categoryId) fields.categoryId = 'categoryId must be a UUID';
    if (!(int(b.basePrice) >= 1)) fields.basePrice = 'basePrice must not be less than 1';
    if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
    const p: MockProduct = {
      id: nextId(shop, 'p'),
      storeId: store.id,
      name: '',
      description: '',
      categoryId: null,
      collectionId: null,
      price: 1,
      salePrice: null,
      status: 'draft',
      images: [],
      option1: null,
      option2: null,
      variants: [],
      removed: false,
      trending: 0,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    shop.products.push(p);
    applyProduct(ctx, store, p, { status: 'draft', ...b });
    ctx.setStatus(201);
    return partnerProductWire(shop, p);
  });
  route('PATCH', `${P}/products/:id`, ctx => {
    const { store, product } = myProduct(ctx);
    if (ctx.body.status !== undefined && !['draft', 'active', 'archived'].includes(ctx.body.status)) throw bad('status must be draft, active or archived', { status: 'Unknown status' });
    applyProduct(ctx, store, product, ctx.body);
    return partnerProductWire(ctx.db.shop, product);
  });
  route('POST', `${P}/products/:id/duplicate`, ctx => {
    const { product } = myProduct(ctx);
    const shop = ctx.db.shop;
    const id = nextId(shop, 'p');
    const copy: MockProduct = {
      ...JSON.parse(JSON.stringify(product)),
      id,
      name: `${product.name} (copy)`,
      status: 'draft',
      removed: false,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    copy.variants = copy.variants.map((v, i) => ({ ...v, id: `${id}_v${i}`, sku: '', stock: 0 }));
    shop.products.push(copy);
    ctx.setStatus(201);
    return partnerProductWire(shop, copy);
  });
  route('DELETE', `${P}/products/:id`, ctx => {
    const { product } = myProduct(ctx);
    const shop = ctx.db.shop;
    // A product someone ordered is archived (its orders keep pointing at it); otherwise it goes.
    if (shop.orders.some(o => o.items.some(i => i.productId === product.id))) {
      product.status = 'archived';
      product.updatedAt = isoNow();
      return { archived: true, deleted: false };
    }
    shop.products = shop.products.filter(p => p.id !== product.id);
    return { archived: false, deleted: true };
  });

  // Inventory
  const myVariant = (ctx: ShopCtx, id: string) => {
    const { store } = myStore(ctx);
    const found = findVariant(ctx.db.shop, id);
    if (!found || found.product.storeId !== store.id) throw notFound('Variant');
    return found;
  };
  route('GET', `${P}/inventory`, ctx => {
    const { store } = myStore(ctx);
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const rows = ctx.db.shop.products
      .filter(p => p.storeId === store.id && p.status !== 'archived')
      .flatMap(p => p.variants.map(v => ({ p, v })))
      .filter(({ p, v }) => !q || p.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
      .filter(({ v }) => ctx.query.lowStock !== 'true' || v.stock <= LOW_STOCK)
      .sort((a, b) => a.v.stock - b.v.stock || a.p.name.localeCompare(b.p.name))
      .map(({ p, v }) => inventoryRowWire(p, v));
    return paginate(rows, ctx.query);
  });
  route('PATCH', `${P}/inventory/:variantId`, ctx => {
    const { variant } = myVariant(ctx, decodeURIComponent(ctx.params[0]));
    const { delta, setTo } = ctx.body;
    if ((delta === undefined) === (setTo === undefined)) throw bad('Send exactly one of delta or setTo.', { setTo: 'Send exactly one of delta or setTo.' });
    const next = setTo !== undefined ? int(setTo) : variant.stock + int(delta);
    if (next < 0) throw bad('Stock can’t go below 0.', { delta: 'Stock can’t go below 0.' });
    moveStock(ctx.db.shop, variant, next - variant.stock, 'manual', null);
    return { variantId: variant.id, stock: variant.stock };
  });
  route('POST', `${P}/inventory/bulk`, ctx => {
    const rows: { variantId: string; setTo: number }[] = Array.isArray(ctx.body) ? ctx.body : [];
    if (rows.length < 1 || rows.length > 200) throw bad('Send 1 to 200 rows.', { rows: 'Send 1 to 200 rows.' });
    const items = rows.map(r => {
      const { variant } = myVariant(ctx, String(r.variantId));
      const setTo = int(r.setTo);
      if (setTo < 0) throw bad('Stock can’t go below 0.', { setTo: 'Stock can’t go below 0.' });
      moveStock(ctx.db.shop, variant, setTo - variant.stock, 'bulk', null);
      return { variantId: variant.id, stock: variant.stock };
    });
    return { updated: items.length, items };
  });
  route('GET', `${P}/inventory/:variantId/movements`, ctx => {
    const { variant } = myVariant(ctx, decodeURIComponent(ctx.params[0]));
    const moves = ctx.db.shop.movements.filter(m => m.variantId === variant.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(moves.map(movementWire), ctx.query);
  });

  // Collections
  const collectionsOf = (ctx: ShopCtx, storeId: string) =>
    ctx.db.shop.collections
      .filter(c => c.storeId === storeId)
      .sort((a, b) => a.position - b.position)
      .map(partnerCollectionWire);
  const uniqueName = (ctx: ShopCtx, storeId: string, name: string, id: string | null = null) => {
    if (ctx.db.shop.collections.some(c => c.storeId === storeId && c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new ShopError(409, 'CONFLICT', 'You already have a collection with this name.');
    }
  };

  route('GET', `${P}/collections`, ctx => collectionsOf(ctx, myStore(ctx).store.id));
  route('POST', `${P}/collections`, ctx => {
    const { store } = myStore(ctx);
    const name = textOf(ctx.body.name, 'name', 2, 60, 'name must be 2 to 60 characters');
    uniqueName(ctx, store.id, name);
    const position = ctx.db.shop.collections.filter(c => c.storeId === store.id).length;
    const c = { id: nextId(ctx.db.shop, 'col'), storeId: store.id, name, slug: slugify(name), position };
    ctx.db.shop.collections.push(c);
    ctx.setStatus(201);
    return partnerCollectionWire(c);
  });
  route('PATCH', `${P}/collections/reorder`, ctx => {
    const { store } = myStore(ctx);
    const ids: string[] = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
    const owned = ids.map(id => ctx.db.shop.collections.find(x => x.id === id && x.storeId === store.id));
    if (owned.some(c => !c)) throw notFound('Collection');
    owned.forEach((c, i) => (c!.position = i));
    return collectionsOf(ctx, store.id);
  });
  route('PATCH', `${P}/collections/:id`, ctx => {
    const { store } = myStore(ctx);
    const c = ctx.db.shop.collections.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!c) throw notFound('Collection');
    const name = textOf(ctx.body.name, 'name', 2, 60, 'name must be 2 to 60 characters');
    uniqueName(ctx, store.id, name, c.id);
    c.name = name;
    c.slug = slugify(name);
    return partnerCollectionWire(c);
  });
  route('DELETE', `${P}/collections/:id`, ctx => {
    const { store } = myStore(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    if (!ctx.db.shop.collections.some(c => c.id === id && c.storeId === store.id)) throw notFound('Collection');
    // Its products keep existing, out of any collection (the API's FK sets null).
    for (const p of ctx.db.shop.products) if (p.collectionId === id) p.collectionId = null;
    ctx.db.shop.collections = ctx.db.shop.collections.filter(c => c.id !== id);
    return { removed: true };
  });

  // Coupons
  const readCoupon = (b: Record<string, any>, current: MockCoupon | null) => {
    const fields: Record<string, string> = {};
    const type = b.type === undefined ? current?.type ?? 'fixed' : b.type === 'percent' ? 'percent' : 'fixed';
    const value = b.value === undefined ? current?.value ?? 0 : int(b.value);
    if (value < 1) fields.value = 'value must not be less than 1';
    const endsAt = b.endsAt === undefined ? current?.endsAt ?? null : b.endsAt;
    if (!endsAt) fields.endsAt = 'endsAt must be a valid ISO 8601 date string';
    const startsAt = b.startsAt === undefined ? current?.startsAt ?? isoNow() : String(b.startsAt);
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) fields.endsAt = 'The coupon must end after it starts.';
    const perUser = b.perUserLimit === undefined ? current?.perCustomerLimit ?? 1 : int(b.perUserLimit);
    if (perUser < 1 || perUser > 100) fields.perUserLimit = 'perUserLimit must be 1 to 100';
    if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
    return {
      type,
      value,
      minOrder: (b.minOrder === undefined ? current?.minOrder ?? 0 : int(b.minOrder)) || null,
      maxDiscount: type === 'percent' ? (b.maxDiscount === undefined ? current?.maxDiscount ?? null : b.maxDiscount === null ? null : int(b.maxDiscount)) : null,
      startsAt,
      endsAt: String(endsAt),
      usageLimit: b.usageLimit === undefined ? current?.usageLimit ?? null : b.usageLimit === null ? null : int(b.usageLimit),
      perCustomerLimit: perUser,
    } as const;
  };
  const myCoupon = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const c = ctx.db.shop.coupons.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!c) throw notFound('Coupon');
    return c;
  };
  route('GET', `${P}/coupons`, ctx => {
    const { store } = myStore(ctx);
    const state = ctx.query.state ? String(ctx.query.state) : null;
    const rows = ctx.db.shop.coupons
      .filter(c => c.storeId === store.id)
      .map(couponWire)
      .filter(c => !state || c.state === state)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, ctx.query);
  });
  route('POST', `${P}/coupons`, ctx => {
    const { store } = myStore(ctx);
    const code = String(ctx.body.code ?? '').trim();
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw bad('Codes are 3 to 20 capital letters, digits or dashes.', { code: 'Codes are 3 to 20 capital letters, digits or dashes.' });
    if (ctx.db.shop.coupons.some(c => c.storeId === store.id && c.code === code)) throw new ShopError(409, 'CONFLICT', 'You already have a coupon with this code.');
    const c: MockCoupon = { id: nextId(ctx.db.shop, 'cp'), storeId: store.id, code, ...readCoupon(ctx.body, null), isActive: true, usedCount: 0, usedBy: {} };
    ctx.db.shop.coupons.push(c);
    ctx.setStatus(201);
    return couponWire(c);
  });
  route('GET', `${P}/coupons/:id`, ctx => couponWire(myCoupon(ctx)));
  route('PATCH', `${P}/coupons/:id`, ctx => {
    const c = myCoupon(ctx);
    Object.assign(c, readCoupon(ctx.body, c));
    if (ctx.body.isActive !== undefined) c.isActive = bool(ctx.body.isActive);
    return couponWire(c);
  });
  route('POST', `${P}/coupons/:id/deactivate`, ctx => {
    const c = myCoupon(ctx);
    c.isActive = false;
    return couponWire(c);
  });

  // Returns
  route('GET', `${P}/returns`, ctx => {
    const { store } = myStore(ctx);
    const status = ctx.query.status ? String(ctx.query.status) : null;
    const rows = ctx.db.shop.returns
      .filter(r => r.storeId === store.id && (!status || r.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => returnWire(ctx.db, r, 'store'));
    return paginate(rows, ctx.query);
  });
  const storeReturn = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const r = ctx.db.shop.returns.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!r) throw notFound('Return');
    return { store, ret: r, order: ctx.db.shop.orders.find(o => o.id === r.orderId)! };
  };
  const returnStep = (r: { status: string }, from: string, to: string) => {
    if (r.status !== from) throw new ShopError(409, 'INVALID_TRANSITION', 'This return can’t do that right now.', { from: r.status, to, allowed: [] });
  };
  route('GET', `${P}/returns/:id`, ctx => returnWire(ctx.db, storeReturn(ctx).ret, 'store'));
  route('POST', `${P}/returns/:id/approve`, ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'requested', 'approved');
    ret.status = 'approved';
    ret.storeNote = ctx.body.note ? String(ctx.body.note).trim() : null;
    notify(ctx.db.shop, ret.userId, 'return_update', `Return approved for ${order.code}`, ret.storeNote ?? 'Send the items back as the store instructs.', { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnWire(ctx.db, ret, 'store');
  });
  route('POST', `${P}/returns/:id/reject`, ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'requested', 'rejected');
    const note = textOf(ctx.body.note, 'note', 3, 1000, 'Tell the customer why.');
    ret.status = 'rejected';
    ret.storeNote = note;
    notify(ctx.db.shop, ret.userId, 'return_update', `Return declined for ${order.code}`, note, { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnWire(ctx.db, ret, 'store');
  });
  route('POST', `${P}/returns/:id/receive`, ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'approved', 'received');
    const lines: { returnItemId: string; restock: boolean }[] = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    for (const ri of ret.items) {
      const back = lines.find(l => l.returnItemId === returnItemId(ret, ri.orderItemId))?.restock;
      const item = order.items.find(i => i.id === ri.orderItemId);
      const found = item ? findVariant(ctx.db.shop, item.variantId) : null;
      if (found && back) moveStock(ctx.db.shop, found.variant, ri.quantity, 'return_restock', order.code);
    }
    ret.status = 'received';
    return returnWire(ctx.db, ret, 'store');
  });
  route('POST', `${P}/returns/:id/refund`, ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'received', 'refunded');
    const max = ret.items.reduce((s, ri) => s + (order.items.find(i => i.id === ri.orderItemId)?.unitPrice ?? 0) * ri.quantity, 0);
    const amount = int(ctx.body.amount);
    const refundRef = String(ctx.body.refundRef ?? '').trim();
    const fields: Record<string, string> = {};
    if (amount < 1 || amount > max) fields.amount = `Between Rs 1 and ${rupees(max)}`;
    if (refundRef.length < 3) fields.refundRef = 'Enter the refund reference';
    if (Object.keys(fields).length) throw bad('Check the refund.', fields);
    ret.refund = { amount, reference: refundRef, recordedAt: isoNow() };
    ret.status = 'refunded';
    for (const ri of ret.items) {
      const item = order.items.find(i => i.id === ri.orderItemId);
      if (item) item.returnedQty += ri.quantity;
    }
    if (order.items.every(i => i.returnedQty >= i.quantity)) {
      order.status = 'returned';
      order.paymentStatus = 'refunded';
      addEvent(order, 'returned');
    }
    notify(ctx.db.shop, ret.userId, 'return_update', `Refund recorded for ${order.code}`, `${rupees(amount)} · ${refundRef}`, { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnWire(ctx.db, ret, 'store');
  });

  // Reviews
  route('GET', `${P}/reviews`, ctx => {
    const { store } = myStore(ctx);
    const rows = ctx.db.shop.reviews
      .filter(r => r.storeId === store.id)
      .filter(r => ctx.query.unreplied !== 'true' || !r.reply)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => reviewWire(ctx.db.shop, r, true));
    return paginate(rows, ctx.query);
  });
  route('POST', `${P}/reviews/:id/reply`, ctx => {
    const { store } = myStore(ctx);
    const r = ctx.db.shop.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!r) throw notFound('Review');
    const text = textOf(ctx.body.text, 'text', 2, 1000, 'text must be 2 to 1000 characters');
    if (r.reply && Date.parse(r.reply.createdAt) + DAY < ctx.now) throw new ShopError(409, 'CONFLICT', 'Replies can only be edited for 24 hours.', { repliedAt: r.reply.createdAt });
    r.reply = { body: text, createdAt: r.reply?.createdAt ?? isoNow() };
    notify(ctx.db.shop, r.userId, 'review_reply', `${store.name} replied to your review`, text.slice(0, 80), { productId: r.productId });
    return reviewWire(ctx.db.shop, r, true);
  });

  // ══ Admin (Shopping) ════════════════════════════════
  route('GET', '/admin/shop/overview', ctx => {
    requireAdmin(ctx);
    const shop = ctx.db.shop;
    const today = new Date(ctx.now).toISOString().slice(0, 10);
    return {
      stores: shop.stores.length,
      activeProducts: shop.products.filter(isListed).length,
      openReports: shop.reports.filter(r => r.status === 'open').length,
      ordersToday: shop.orders.filter(o => o.createdAt.slice(0, 10) === today).length,
    };
  });

  route('GET', '/admin/shop/categories', ctx => {
    requireAdmin(ctx);
    return categoryTree(ctx.db.shop);
  });
  route('POST', '/admin/shop/categories', ctx => {
    requireAdmin(ctx);
    const shop = ctx.db.shop;
    const name = String(ctx.body.name ?? '').trim();
    if (name.length < 2) throw bad('Name the category.', { name: 'At least 2 characters' });
    const parentId = ctx.body.parentId ? String(ctx.body.parentId) : null;
    if (parentId && !shop.categories.some(c => c.id === parentId && !c.parentId)) throw bad('Choose a top-level parent.', { parentId: 'Unknown parent' });
    const c = {
      id: nextId(shop, 'cat'),
      name,
      slug: slugify(name),
      icon: String(ctx.body.icon ?? 'pricetag-outline'),
      parentId,
      position: shop.categories.filter(x => x.parentId === parentId).length,
    };
    shop.categories.push(c);
    ctx.setStatus(201);
    return { ...c, productCount: 0, children: [] };
  });
  route('PATCH', '/admin/shop/categories/:id', ctx => {
    requireAdmin(ctx);
    const c = ctx.db.shop.categories.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw notFound('Category');
    if (ctx.body.name !== undefined) {
      const name = String(ctx.body.name).trim();
      if (name.length < 2) throw bad('Name the category.', { name: 'At least 2 characters' });
      c.name = name;
    }
    if (ctx.body.icon) c.icon = String(ctx.body.icon);
    return categoryTree(ctx.db.shop).flatMap((x: any) => [x, ...x.children]).find((x: any) => x.id === c.id);
  });
  route('DELETE', '/admin/shop/categories/:id', ctx => {
    requireAdmin(ctx);
    const shop = ctx.db.shop;
    const id = decodeURIComponent(ctx.params[0]);
    if (shop.categories.some(c => c.parentId === id)) throw new ShopError(409, 'CATEGORY_IN_USE', 'Remove its sub-categories first.');
    const used = shop.products.filter(p => p.categoryId === id).length;
    if (used) throw new ShopError(409, 'CATEGORY_IN_USE', `${used} product(s) use this category.`, { productCount: used });
    shop.categories = shop.categories.filter(c => c.id !== id);
    return { removed: true };
  });
  route('POST', '/admin/shop/categories/reorder', ctx => {
    requireAdmin(ctx);
    const ids: string[] = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
    ids.forEach((id, i) => {
      const c = ctx.db.shop.categories.find(x => x.id === id);
      if (c) c.position = i;
    });
    return categoryTree(ctx.db.shop);
  });

  const readBanner = (b: Record<string, any>) => {
    const fields: Record<string, string> = {};
    if (!String(b.imageUrl ?? '').trim()) fields.imageUrl = 'Add an image';
    if (String(b.headline ?? '').trim().length < 3) fields.headline = 'Write a headline';
    const t = b.target ?? {};
    if (!['store', 'category', 'product'].includes(t.kind) || !(t.slug || t.id)) fields.target = 'Choose where it leads';
    if (Object.keys(fields).length) throw bad('Check the banner.', fields);
    return {
      imageUrl: String(b.imageUrl),
      headline: String(b.headline).trim(),
      subhead: b.subhead ? String(b.subhead).trim() : null,
      target: t,
      startsAt: b.startsAt ? String(b.startsAt) : isoNow(),
      endsAt: b.endsAt ? String(b.endsAt) : null,
      position: int(b.position),
      isActive: b.isActive === undefined ? true : bool(b.isActive),
    };
  };
  route('GET', '/admin/shop/banners', ctx => {
    requireAdmin(ctx);
    return [...ctx.db.shop.banners].sort((a, b) => a.position - b.position);
  });
  route('POST', '/admin/shop/banners', ctx => {
    requireAdmin(ctx);
    const banner = { id: nextId(ctx.db.shop, 'bn'), ...readBanner(ctx.body) };
    ctx.db.shop.banners.push(banner);
    ctx.setStatus(201);
    return banner;
  });
  route('PATCH', '/admin/shop/banners/:id', ctx => {
    requireAdmin(ctx);
    const banner = ctx.db.shop.banners.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!banner) throw notFound('Banner');
    Object.assign(banner, readBanner({ ...banner, ...ctx.body }));
    return banner;
  });
  route('DELETE', '/admin/shop/banners/:id', ctx => {
    requireAdmin(ctx);
    ctx.db.shop.banners = ctx.db.shop.banners.filter(b => b.id !== decodeURIComponent(ctx.params[0]));
    return { removed: true };
  });

  const reportView = (ctx: ShopCtx, r: (typeof ctx.db.shop.reports)[number]) => {
    const p = productById(ctx.db.shop, r.productId);
    return {
      id: r.id,
      productId: r.productId,
      productName: p?.name ?? 'Product',
      productImage: p?.images[0]?.url ?? null,
      storeName: p ? storeById(ctx.db.shop, p.storeId)?.name ?? '' : '',
      reason: r.reason,
      details: r.details,
      reportCount: ctx.db.shop.reports.filter(x => x.productId === r.productId && x.status === 'open').length || 1,
      status: r.status,
      createdAt: r.createdAt,
    };
  };
  route('GET', '/admin/shop/reports', ctx => {
    requireAdmin(ctx);
    const status = String(ctx.query.status ?? 'open');
    const rows = ctx.db.shop.reports
      .filter(r => r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => reportView(ctx, r));
    return paginate(rows, ctx.query);
  });
  route('POST', '/admin/shop/reports/:id/dismiss', ctx => {
    requireAdmin(ctx);
    const r = ctx.db.shop.reports.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!r) throw notFound('Report');
    r.status = 'dismissed';
    return reportView(ctx, r);
  });
  route('POST', '/admin/shop/reports/:id/remove', ctx => {
    requireAdmin(ctx);
    const shop = ctx.db.shop;
    const r = shop.reports.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!r) throw notFound('Report');
    const reason = String(ctx.body.reason ?? '').trim();
    if (reason.length < 10) throw bad('Give the store a reason.', { reason: 'At least 10 characters' });
    const p = productById(shop, r.productId);
    if (p) {
      p.removed = true;
      const store = storeById(shop, p.storeId);
      if (store) notify(shop, store.ownerId, 'low_stock', `${p.name} was removed`, reason, { productId: p.id });
    }
    for (const x of shop.reports) if (x.productId === r.productId && x.status === 'open') x.status = 'removed';
    return reportView(ctx, r);
  });

  route('GET', '/admin/shop/orders/:groupCode', ctx => {
    requireAdmin(ctx);
    const g = ctx.db.shop.groups.find(x => x.code === decodeURIComponent(ctx.params[0]).toUpperCase());
    if (!g) throw notFound('Order');
    const customer = ctx.db.users.find(u => u.id === g.userId);
    return { group: groupView(ctx.db.shop, g), customer: { name: customer?.name ?? 'Customer', email: customer?.email ?? '' } };
  });

  route('GET', '/admin/shop/stores', ctx => {
    requireAdmin(ctx);
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const rows = ctx.db.shop.stores
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
      .map(s => storeSummaryView(ctx.db.shop, s));
    return paginate(rows, ctx.query);
  });
  route('POST', '/admin/shop/stores/:id/featured', ctx => {
    requireAdmin(ctx);
    const s = storeById(ctx.db.shop, decodeURIComponent(ctx.params[0]));
    if (!s) throw notFound('Store');
    s.isFeatured = bool(ctx.body.featured);
    return storeSummaryView(ctx.db.shop, s);
  });

  // Silence "unused" for helpers kept for clarity in this file.
  void delivers;
  void evaluateCoupon;
  void progressStatus;
}
