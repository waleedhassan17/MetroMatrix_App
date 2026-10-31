// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop routes
// ═══════════════════════════════════════════════════════
// Registered on the mock server's router. Customer routes under /shop speak
// the real API (its paths, rules and error codes; shapes from shopWire,
// pinned by mockShopParity). The store partner's under /partner/shop and
// staff under /admin/shop still follow API_SHOPPING_ASSUMED. Plus the core
// /addresses and /notifications.

import type { MockBusiness, MockDb, MockUser } from '../mockDb';
import type { MockAddress, MockOrder, MockProduct, MockStore, MockVariant } from './shopTypes';
import {
  ShopError,
  addEvent,
  allowedActions,
  cancelOrder,
  categoryAndChildren,
  categoryTree,
  couponView,
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
  partnerOrderRow,
  partnerOrderView,
  productById,
  productHaystack,
  progressStatus,
  returnableQty,
  returnView,
  returnWindowEnd,
  reviewView,
  rupees,
  shipBlockedReason,
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
  groupRowWire,
  groupWire,
  planFor,
  planWire,
  productCard,
  productPage,
  returnWire,
  reviewSummary,
  reviewWire,
  storeCard,
  storeOrderWire,
  storePage,
} from './shopWire';
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

  // ══ Store partner ═══════════════════════════════════
  route('GET', '/partner/shop/summary', ctx => {
    const { store } = myStore(ctx);
    const shop = ctx.db.shop;
    const orders = shop.orders.filter(o => o.storeId === store.id);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ctx.now - (6 - i) * DAY);
      return d.toISOString().slice(0, 10);
    });
    const sales7d = days.map(date => ({
      date,
      amount: orders.filter(o => o.deliveredAt?.slice(0, 10) === date && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
    }));
    return {
      storeName: store.name,
      storeSlug: store.slug,
      isPaused: store.isPaused,
      pauseMessage: store.pauseMessage,
      counts: {
        newOrders: orders.filter(o => o.status === 'placed' || o.status === 'cancellation_requested').length,
        toShip: orders.filter(o => o.status === 'packed' || o.status === 'confirmed').length,
        paymentsToConfirm: orders.filter(o => o.paymentStatus === 'proof_submitted' && o.status !== 'cancelled').length,
        returnsOpen: shop.returns.filter(r => r.storeId === store.id && ['requested', 'approved', 'received'].includes(r.status)).length,
        lowStock: shop.products
          .filter(p => p.storeId === store.id && p.status === 'active')
          .reduce((n, p) => n + p.variants.filter(v => v.stock > 0 && v.stock <= LOW_STOCK).length, 0),
      },
      sales7d,
      recordedSales7d: sales7d.reduce((s, d) => s + d.amount, 0),
    };
  });

  // Store profile & settings
  const profileView = (s: MockStore) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    about: s.about,
    logoUrl: s.logoUrl,
    coverUrl: s.coverUrl,
    brandColor: s.brandColor,
    onBrandColor: s.onBrandColor,
    socials: s.socials,
    phone: s.phone,
    whatsapp: s.whatsapp,
  });
  const settingsView = (s: MockStore) => ({ ...s.settings, isPaused: s.isPaused, pauseMessage: s.pauseMessage });

  const contrast = (a: string, b: string) => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  route('GET', '/partner/shop/store', ctx => profileView(myStore(ctx).store));
  route('PATCH', '/partner/shop/store', ctx => {
    const { store } = myStore(ctx);
    const b = ctx.body;
    const brand = String(b.brandColor ?? store.brandColor).toUpperCase();
    const onBrand = String(b.onBrandColor ?? store.onBrandColor).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(brand) || !/^#[0-9A-F]{6}$/.test(onBrand)) throw bad('Use hex colours.', { brandColor: 'Use a colour like #7A1F3D' });
    if (contrast(brand, onBrand) < 4.5) {
      throw new ShopError(400, 'BRAND_CONTRAST_LOW', 'Text on this colour is hard to read. Pick a darker or lighter shade.', { ratio: Math.round(contrast(brand, onBrand) * 10) / 10 });
    }
    Object.assign(store, {
      tagline: String(b.tagline ?? store.tagline).slice(0, 80),
      about: String(b.about ?? store.about).slice(0, 1200),
      logoUrl: b.logoUrl === undefined ? store.logoUrl : b.logoUrl,
      coverUrl: b.coverUrl === undefined ? store.coverUrl : b.coverUrl,
      brandColor: brand,
      onBrandColor: onBrand,
      socials: { ...store.socials, ...(b.socials ?? {}) },
      phone: b.phone === undefined ? store.phone : b.phone,
      whatsapp: b.whatsapp === undefined ? store.whatsapp : b.whatsapp,
    });
    return profileView(store);
  });
  route('GET', '/partner/shop/store/settings', ctx => settingsView(myStore(ctx).store));
  route('PATCH', '/partner/shop/store/settings', ctx => {
    const { store } = myStore(ctx);
    const b = ctx.body;
    const s = store.settings;
    const next = {
      shippingFee: Math.max(0, int(b.shippingFee, s.shippingFee)),
      freeShippingOver: b.freeShippingOver === null ? null : int(b.freeShippingOver, s.freeShippingOver ?? 0) || null,
      nationwide: b.nationwide === undefined ? s.nationwide : bool(b.nationwide),
      deliveryCities: Array.isArray(b.deliveryCities) ? b.deliveryCities.map(String) : s.deliveryCities,
      dispatchMinDays: Math.max(0, int(b.dispatchMinDays, s.dispatchMinDays)),
      dispatchMaxDays: Math.max(0, int(b.dispatchMaxDays, s.dispatchMaxDays)),
      returnWindowDays: Math.min(30, Math.max(0, int(b.returnWindowDays, s.returnWindowDays))),
      codEnabled: b.codEnabled === undefined ? s.codEnabled : bool(b.codEnabled),
      codLimit: b.codLimit === null ? null : int(b.codLimit, s.codLimit ?? 0) || null,
    };
    if (!next.nationwide && !next.deliveryCities.length) throw bad('Choose at least one city.', { deliveryCities: 'Choose a city, or deliver nationwide' });
    if (next.dispatchMaxDays < next.dispatchMinDays) throw bad('Check the dispatch days.', { dispatch: 'The longest must be at least the shortest' });
    if (!next.codEnabled && !store.paymentAccounts.some(a => a.isActive)) {
      throw new ShopError(422, 'PAYMENT_ACCOUNT_REQUIRED', 'Add a payment account before turning cash on delivery off.');
    }
    store.settings = next;
    if (b.isPaused !== undefined) {
      store.isPaused = bool(b.isPaused);
      store.pauseMessage = store.isPaused ? String(b.pauseMessage ?? store.pauseMessage ?? '').trim() || null : null;
    }
    return settingsView(store);
  });
  route('POST', '/partner/shop/store/pause', ctx => {
    const { store } = myStore(ctx);
    const message = String(ctx.body.message ?? '').trim();
    if (!message) throw bad('Tell customers when you will be back.', { message: 'Required' });
    store.isPaused = true;
    store.pauseMessage = message;
    return settingsView(store);
  });
  route('POST', '/partner/shop/store/resume', ctx => {
    const { store } = myStore(ctx);
    store.isPaused = false;
    store.pauseMessage = null;
    return settingsView(store);
  });

  // Payment accounts
  const readAccount = (b: Record<string, any>) => {
    const kind = ['raast', 'jazzcash', 'easypaisa', 'bank'].includes(b.kind) ? b.kind : 'bank';
    const number = kind === 'bank' ? String(b.number ?? '').toUpperCase().replace(/\s+/g, '') : String(b.number ?? '').replace(/\D/g, '');
    const fields: Record<string, string> = {};
    if (String(b.title ?? '').trim().length < 3) fields.title = 'Enter the account title';
    if (kind === 'bank' ? !/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(number) : !/^03\d{9}$/.test(number)) fields.number = 'Check the number';
    if (kind === 'bank' && !String(b.bankName ?? '').trim()) fields.bankName = 'Enter the bank name';
    if (Object.keys(fields).length) throw bad('Check the account details.', fields);
    return { kind, title: String(b.title).trim(), number, bankName: kind === 'bank' ? String(b.bankName).trim() : null, isActive: b.isActive === undefined ? true : bool(b.isActive) };
  };
  route('GET', '/partner/shop/payment-accounts', ctx => myStore(ctx).store.paymentAccounts);
  route('POST', '/partner/shop/payment-accounts', ctx => {
    const { store } = myStore(ctx);
    const account = { id: nextId(ctx.db.shop, 'pa'), ...readAccount(ctx.body) };
    store.paymentAccounts.push(account);
    ctx.setStatus(201);
    return account;
  });
  route('PATCH', '/partner/shop/payment-accounts/:id', ctx => {
    const { store } = myStore(ctx);
    const a = store.paymentAccounts.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!a) throw notFound('Account');
    const next = readAccount({ ...a, ...ctx.body });
    if (!next.isActive && !store.settings.codEnabled && store.paymentAccounts.filter(x => x.isActive && x.id !== a.id).length === 0) {
      throw new ShopError(422, 'PAYMENT_ACCOUNT_REQUIRED', 'Keep one account active while cash on delivery is off.');
    }
    Object.assign(a, next);
    return a;
  });
  route('DELETE', '/partner/shop/payment-accounts/:id', ctx => {
    const { store } = myStore(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    if (!store.settings.codEnabled && store.paymentAccounts.filter(x => x.isActive && x.id !== id).length === 0) {
      throw new ShopError(422, 'PAYMENT_ACCOUNT_REQUIRED', 'Keep one account active while cash on delivery is off.');
    }
    store.paymentAccounts = store.paymentAccounts.filter(x => x.id !== id);
    return { removed: true };
  });

  // Partner orders
  const segmentOf = (o: MockOrder) => {
    switch (o.status) {
      case 'placed':
      case 'cancellation_requested':
        return 'new';
      case 'confirmed':
        return 'to_pack';
      case 'packed':
        return 'to_ship';
      case 'shipped':
        return 'shipped';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'done';
    }
  };

  route('GET', '/partner/shop/orders', ctx => {
    const { store } = myStore(ctx);
    const db = ctx.db;
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const mine = db.shop.orders.filter(o => o.storeId === store.id);
    const counts: Record<string, number> = { new: 0, to_pack: 0, to_ship: 0, shipped: 0, done: 0, cancelled: 0 };
    for (const o of mine) counts[segmentOf(o)]++;
    // `payment=proof_submitted`: every order with a transfer to check, whatever its segment.
    const payment = ctx.query.payment ? String(ctx.query.payment) : null;
    const rows = mine
      .filter(o => (payment ? o.paymentStatus === payment && o.status !== 'cancelled' : segmentOf(o) === String(ctx.query.segment ?? 'new')))
      .filter(o => !q || o.code.toLowerCase().includes(q) || (db.users.find(u => u.id === o.userId)?.name ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(o => partnerOrderRow(db, o));
    return { ...paginate(rows, ctx.query), segmentCounts: counts };
  });

  const storeOrder = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const o = ctx.db.shop.orders.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!o) throw notFound('Order');
    return { store, order: o };
  };

  const requireAction = (o: MockOrder, action: string) => {
    if (!allowedActions(o).includes(action as never)) {
      throw new ShopError(409, 'INVALID_TRANSITION', 'This order can’t do that right now.', { from: o.status, to: action });
    }
  };

  route('GET', '/partner/shop/orders/:id', ctx => partnerOrderView(ctx.db, storeOrder(ctx).order));
  route('PATCH', '/partner/shop/orders/:id', ctx => {
    const { order } = storeOrder(ctx);
    order.internalNote = String(ctx.body.internalNote ?? '').slice(0, 500) || null;
    return partnerOrderView(ctx.db, order);
  });

  const customerUpdate = (ctx: ShopCtx, o: MockOrder, title: string, body: string, type: 'order_update' | 'payment_update' = 'order_update') =>
    notify(ctx.db.shop, o.userId, type, title, body, { groupCode: o.groupCode, orderId: o.id });

  route('POST', '/partner/shop/orders/:id/confirm', ctx => {
    const { store, order } = storeOrder(ctx);
    requireAction(order, 'confirm');
    order.status = 'confirmed';
    addEvent(order, 'confirmed');
    customerUpdate(ctx, order, `${store.name} confirmed your order`, `${order.code} is being prepared.`);
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/pack', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'pack');
    order.status = 'packed';
    addEvent(order, 'packed');
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/ship', ctx => {
    const { store, order } = storeOrder(ctx);
    requireAction(order, 'ship');
    const blocked = shipBlockedReason(order);
    if (blocked) throw new ShopError(409, 'PAYMENT_NOT_CONFIRMED', blocked);
    const courier = ['tcs', 'leopards', 'mnp', 'postex', 'trax', 'own_rider', 'other'].includes(ctx.body.courier) ? ctx.body.courier : null;
    const trackingRef = String(ctx.body.trackingRef ?? '').trim();
    const fields: Record<string, string> = {};
    if (!courier) fields.courier = 'Choose a courier';
    if (trackingRef.length < 4) fields.trackingRef = 'Enter the tracking reference';
    if (Object.keys(fields).length) throw bad('Add the courier details.', fields);
    order.status = 'shipped';
    order.shipment = { courier, trackingRef };
    addEvent(order, 'shipped', `${courier} · ${trackingRef}`);
    customerUpdate(ctx, order, `Your ${store.name} order shipped`, `${trackingRef}`);
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/deliver', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'deliver');
    order.status = 'delivered';
    order.deliveredAt = isoNow();
    addEvent(order, 'delivered');
    customerUpdate(ctx, order, `Delivered: ${order.code}`, 'How was it? You can review your items now.');
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/cancel', ctx => {
    const { store, order } = storeOrder(ctx);
    requireAction(order, 'cancel');
    const reason = String(ctx.body.reason ?? '').trim();
    if (reason.length < 5) throw bad('Tell the customer why.', { reason: 'At least 5 characters' });
    cancelOrder(ctx.db.shop, order, reason);
    customerUpdate(ctx, order, `${store.name} cancelled ${order.code}`, reason);
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/approve-cancellation', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'approve_cancellation');
    cancelOrder(ctx.db.shop, order, order.events.filter(e => e.type === 'cancellation_requested').pop()?.note || 'Cancelled on request');
    customerUpdate(ctx, order, `Cancelled: ${order.code}`, 'The store approved your cancellation.');
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/payment/confirm', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'confirm_payment');
    order.paymentStatus = 'paid';
    addEvent(order, 'payment_confirmed');
    customerUpdate(ctx, order, `Payment confirmed for ${order.code}`, `${rupees(order.total)} received.`, 'payment_update');
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/payment/reject', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'reject_payment');
    const reason = String(ctx.body.reason ?? '').trim();
    if (reason.length < 5) throw bad('Tell the customer what is wrong.', { reason: 'At least 5 characters' });
    order.paymentStatus = 'proof_rejected';
    if (order.paymentProof) order.paymentProof.rejectionReason = reason;
    order.payBy = new Date(Date.now() + 24 * HOUR).toISOString();
    addEvent(order, 'payment_rejected', reason);
    customerUpdate(ctx, order, `Payment not received for ${order.code}`, reason, 'payment_update');
    return partnerOrderView(ctx.db, order);
  });
  route('POST', '/partner/shop/orders/:id/cash-collected', ctx => {
    const { order } = storeOrder(ctx);
    requireAction(order, 'cash_collected');
    order.paymentStatus = 'cash_collected';
    addEvent(order, 'cash_collected');
    return partnerOrderView(ctx.db, order);
  });

  // Partner products
  const productRow = (p: MockProduct) => ({
    id: p.id,
    name: p.name,
    status: p.removed ? 'archived' : p.status,
    price: p.price,
    salePrice: p.salePrice,
    imageUrl: p.images[0]?.url ?? null,
    totalStock: totalStock(p),
    variantCount: p.variants.length,
    lowStock: p.variants.some(v => v.stock <= LOW_STOCK),
    updatedAt: p.updatedAt,
  });
  const productFull = (p: MockProduct) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    collectionId: p.collectionId,
    price: p.price,
    salePrice: p.salePrice,
    status: p.status,
    images: p.images,
    option1: p.option1,
    option2: p.option2,
    variants: p.variants,
    updatedAt: p.updatedAt,
  });

  const myProduct = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const p = ctx.db.shop.products.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!p) throw notFound('Product');
    return { store, product: p };
  };

  const publishProblems = (p: Pick<MockProduct, 'name' | 'price' | 'categoryId' | 'images' | 'variants'>) => {
    const fields: Record<string, string> = {};
    if (!p.name.trim()) fields.name = 'Give the product a name';
    if (!p.price) fields.price = 'Add a price before publishing';
    if (!p.categoryId) fields.categoryId = 'Choose a category before publishing';
    if (!p.images.length) fields.images = 'Add at least one photo before publishing';
    if (!p.variants.some(v => v.stock > 0)) fields.variants = 'At least one variant must be in stock to publish';
    return fields;
  };

  const applyProduct = (ctx: ShopCtx, store: MockStore, p: MockProduct, b: Record<string, any>) => {
    const shop = ctx.db.shop;
    const price = Math.max(0, int(b.price, p.price));
    const salePrice = b.salePrice === null || b.salePrice === undefined || b.salePrice === '' ? null : int(b.salePrice);
    if (salePrice !== null && price && salePrice >= price) throw bad('The sale price must be below the price.', { salePrice: 'Must be below the price' });
    if (b.collectionId && !shop.collections.some(c => c.id === b.collectionId && c.storeId === store.id)) {
      throw bad('Choose one of your collections.', { collectionId: 'Unknown collection' });
    }
    const incoming: any[] = Array.isArray(b.variants) && b.variants.length ? b.variants : [{ option1: null, option2: null, sku: '', stock: 0, priceDelta: 0 }];
    const skus = incoming.map(v => String(v.sku ?? '').toUpperCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw bad('Each variant needs its own SKU.', { variants: 'Duplicate SKU' });
    const kept: MockVariant[] = incoming.map((v, i) => {
      const existing = p.variants.find(x => x.id === v.id) ?? p.variants.find(x => x.option1 === (v.option1 ?? null) && x.option2 === (v.option2 ?? null));
      const stock = Math.max(0, int(v.stock));
      const variant: MockVariant = existing ?? { id: `${p.id}_v${Date.now().toString(36)}${i}`, option1: v.option1 ?? null, option2: v.option2 ?? null, sku: '', stock: 0, priceDelta: 0 };
      variant.sku = String(v.sku ?? '').toUpperCase() || `${p.id.toUpperCase()}-${i + 1}`;
      variant.priceDelta = int(v.priceDelta);
      variant.option1 = v.option1 ?? null;
      variant.option2 = v.option2 ?? null;
      if (stock !== variant.stock) moveStock(shop, variant, stock - variant.stock, existing ? 'manual' : 'initial', 'Product form');
      return variant;
    });
    Object.assign(p, {
      name: String(b.name ?? p.name).trim().slice(0, 80),
      description: String(b.description ?? p.description).slice(0, 4000),
      categoryId: b.categoryId === undefined ? p.categoryId : b.categoryId,
      collectionId: b.collectionId === undefined ? p.collectionId : b.collectionId,
      price,
      salePrice,
      images: Array.isArray(b.images) ? b.images.slice(0, 8).map((i: any) => ({ url: String(i.url), publicId: String(i.publicId ?? '') })) : p.images,
      option1: b.option1 === undefined ? p.option1 : b.option1,
      option2: b.option2 === undefined ? p.option2 : b.option2,
      variants: kept,
      updatedAt: isoNow(),
    });
    const status = b.status ?? p.status;
    if (status === 'active') {
      const problems = publishProblems(p);
      if (Object.keys(problems).length) {
        throw new ShopError(422, 'PUBLISH_BLOCKED', 'Finish the highlighted parts to publish.', { fields: Object.fromEntries(Object.entries(problems).map(([k, v]) => [k, [v]])) });
      }
    }
    p.status = status;
  };

  route('GET', '/partner/shop/products', ctx => {
    const { store } = myStore(ctx);
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const status = String(ctx.query.status ?? 'active');
    const rows = ctx.db.shop.products
      .filter(p => p.storeId === store.id && (status === 'archived' ? p.status === 'archived' || p.removed : p.status === status && !p.removed))
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.variants.some(v => v.sku.toLowerCase().includes(q)))
      .filter(p => !bool(ctx.query.lowStock) || p.variants.some(v => v.stock <= LOW_STOCK))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(productRow);
    return paginate(rows, ctx.query);
  });
  route('GET', '/partner/shop/products/:id', ctx => productFull(myProduct(ctx).product));
  route('POST', '/partner/shop/products', ctx => {
    const { store } = myStore(ctx);
    const shop = ctx.db.shop;
    const p: MockProduct = {
      id: nextId(shop, 'p'),
      storeId: store.id,
      name: '',
      description: '',
      categoryId: null,
      collectionId: null,
      price: 0,
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
    if (!String(ctx.body.name ?? '').trim()) throw bad('Give the product a name.', { name: 'Required' });
    shop.products.push(p);
    applyProduct(ctx, store, p, ctx.body);
    ctx.setStatus(201);
    return productFull(p);
  });
  route('PATCH', '/partner/shop/products/:id', ctx => {
    const { store, product } = myProduct(ctx);
    applyProduct(ctx, store, product, ctx.body);
    return productFull(product);
  });
  route('POST', '/partner/shop/products/:id/status', ctx => {
    const { product } = myProduct(ctx);
    const status = ['draft', 'active', 'archived'].includes(ctx.body.status) ? ctx.body.status : product.status;
    if (status === 'active') {
      const problems = publishProblems(product);
      if (Object.keys(problems).length) {
        throw new ShopError(422, 'PUBLISH_BLOCKED', Object.values(problems)[0], { fields: Object.fromEntries(Object.entries(problems).map(([k, v]) => [k, [v]])) });
      }
    }
    product.status = status;
    product.updatedAt = isoNow();
    return productFull(product);
  });

  // Inventory
  const inventoryRow = (p: MockProduct, v: MockVariant) => ({
    variantId: v.id,
    productId: p.id,
    productName: p.name,
    variantLabel: variantLabel(v) || 'Default',
    sku: v.sku,
    stock: v.stock,
    lowStock: v.stock <= LOW_STOCK,
    imageUrl: p.images[0]?.url ?? null,
  });
  const myVariant = (ctx: ShopCtx, id: string) => {
    const { store } = myStore(ctx);
    const found = findVariant(ctx.db.shop, id);
    if (!found || found.product.storeId !== store.id) throw notFound('Variant');
    return found;
  };

  route('GET', '/partner/shop/inventory', ctx => {
    const { store } = myStore(ctx);
    const q = String(ctx.query.q ?? '').trim().toLowerCase();
    const rows = ctx.db.shop.products
      .filter(p => p.storeId === store.id && p.status !== 'archived')
      .flatMap(p => p.variants.map(v => ({ p, v })))
      .filter(({ p, v }) => !q || p.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
      .filter(({ v }) => !bool(ctx.query.lowStock) || v.stock <= LOW_STOCK)
      .sort((a, b) => a.v.stock - b.v.stock || a.p.name.localeCompare(b.p.name))
      .map(({ p, v }) => inventoryRow(p, v));
    return paginate(rows, ctx.query);
  });
  route('PATCH', '/partner/shop/inventory/:variantId', ctx => {
    const { product, variant } = myVariant(ctx, decodeURIComponent(ctx.params[0]));
    const stock = int(ctx.body.stock, variant.stock);
    if (stock < 0) throw bad('Stock can’t be negative.', { stock: 'At least 0' });
    moveStock(ctx.db.shop, variant, stock - variant.stock, 'manual', ctx.body.note ? String(ctx.body.note) : null);
    return inventoryRow(product, variant);
  });
  route('POST', '/partner/shop/inventory/bulk', ctx => {
    const ids: string[] = Array.isArray(ctx.body.variantIds) ? ctx.body.variantIds : [];
    const stock = int(ctx.body.stock);
    if (stock < 0) throw bad('Stock can’t be negative.', { stock: 'At least 0' });
    return ids.map(id => {
      const { product, variant } = myVariant(ctx, id);
      moveStock(ctx.db.shop, variant, stock - variant.stock, 'bulk', `Set to ${stock}`);
      return inventoryRow(product, variant);
    });
  });
  route('GET', '/partner/shop/inventory/:variantId/movements', ctx => {
    const { product, variant } = myVariant(ctx, decodeURIComponent(ctx.params[0]));
    const moves = ctx.db.shop.movements.filter(m => m.variantId === variant.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (moves.length) return moves;
    // Nothing recorded yet: the opening stock is the only "movement".
    return [{ id: `mv_open_${variant.id}`, delta: variant.stock, stockAfter: variant.stock, reason: 'initial', note: null, createdAt: product.createdAt }];
  });

  // Collections
  const collectionsOf = (ctx: ShopCtx, storeId: string) =>
    ctx.db.shop.collections
      .filter(c => c.storeId === storeId)
      .sort((a, b) => a.position - b.position)
      .map(c => ({ ...c, productCount: ctx.db.shop.products.filter(p => p.collectionId === c.id && !p.removed).length }));

  route('GET', '/partner/shop/collections', ctx => collectionsOf(ctx, myStore(ctx).store.id));
  route('POST', '/partner/shop/collections', ctx => {
    const { store } = myStore(ctx);
    const name = String(ctx.body.name ?? '').trim();
    if (name.length < 2) throw bad('Name the collection.', { name: 'At least 2 characters' });
    const position = ctx.db.shop.collections.filter(c => c.storeId === store.id).length;
    const c = { id: nextId(ctx.db.shop, 'col'), storeId: store.id, name, slug: slugify(name), position };
    ctx.db.shop.collections.push(c);
    ctx.setStatus(201);
    return { ...c, productCount: 0 };
  });
  route('PATCH', '/partner/shop/collections/:id', ctx => {
    const { store } = myStore(ctx);
    const c = ctx.db.shop.collections.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!c) throw notFound('Collection');
    const name = String(ctx.body.name ?? '').trim();
    if (name.length < 2) throw bad('Name the collection.', { name: 'At least 2 characters' });
    c.name = name;
    return collectionsOf(ctx, store.id).find(x => x.id === c.id);
  });
  route('DELETE', '/partner/shop/collections/:id', ctx => {
    const { store } = myStore(ctx);
    const id = decodeURIComponent(ctx.params[0]);
    const count = ctx.db.shop.products.filter(p => p.collectionId === id && !p.removed && p.status !== 'archived').length;
    if (count) throw new ShopError(409, 'COLLECTION_NOT_EMPTY', `Move its ${count} product(s) to another collection first.`, { productCount: count });
    ctx.db.shop.collections = ctx.db.shop.collections.filter(c => !(c.id === id && c.storeId === store.id));
    return { removed: true };
  });
  route('POST', '/partner/shop/collections/reorder', ctx => {
    const { store } = myStore(ctx);
    const ids: string[] = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
    ids.forEach((id, i) => {
      const c = ctx.db.shop.collections.find(x => x.id === id && x.storeId === store.id);
      if (c) c.position = i;
    });
    return collectionsOf(ctx, store.id);
  });

  // Coupons
  const readCoupon = (b: Record<string, any>) => {
    const code = String(b.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const type = b.type === 'percent' ? 'percent' : 'fixed';
    const value = int(b.value);
    const fields: Record<string, string> = {};
    if (code.length < 4 || code.length > 16) fields.code = 'Use 4 to 16 letters or digits';
    if (value <= 0 || (type === 'percent' && value > 90)) fields.value = type === 'percent' ? 'Between 1 and 90' : 'Enter an amount';
    if (b.endsAt && b.startsAt && Date.parse(b.endsAt) < Date.parse(b.startsAt)) fields.endsAt = 'Ends before it starts';
    if (Object.keys(fields).length) throw bad('Check the coupon.', fields);
    return {
      code,
      type,
      value,
      minOrder: num(b.minOrder) || null,
      maxDiscount: type === 'percent' ? num(b.maxDiscount) || null : null,
      startsAt: b.startsAt ? String(b.startsAt) : isoNow(),
      endsAt: b.endsAt ? String(b.endsAt) : null,
      usageLimit: num(b.usageLimit) || null,
      perCustomerLimit: num(b.perCustomerLimit) || null,
      isActive: b.isActive === undefined ? true : bool(b.isActive),
    } as const;
  };
  route('GET', '/partner/shop/coupons', ctx => {
    const { store } = myStore(ctx);
    return ctx.db.shop.coupons.filter(c => c.storeId === store.id).map(couponView);
  });
  route('POST', '/partner/shop/coupons', ctx => {
    const { store } = myStore(ctx);
    const input = readCoupon(ctx.body);
    if (ctx.db.shop.coupons.some(c => c.storeId === store.id && c.code === input.code)) {
      throw new ShopError(409, 'COUPON_CODE_TAKEN', 'You already have a coupon with this code.');
    }
    const c = { id: nextId(ctx.db.shop, 'cp'), storeId: store.id, ...input, usedCount: 0, usedBy: {} };
    ctx.db.shop.coupons.push(c);
    ctx.setStatus(201);
    return couponView(c);
  });
  route('PATCH', '/partner/shop/coupons/:id', ctx => {
    const { store } = myStore(ctx);
    const c = ctx.db.shop.coupons.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!c) throw notFound('Coupon');
    const input = readCoupon({ ...c, ...ctx.body });
    if (ctx.db.shop.coupons.some(x => x.storeId === store.id && x.code === input.code && x.id !== c.id)) {
      throw new ShopError(409, 'COUPON_CODE_TAKEN', 'You already have a coupon with this code.');
    }
    Object.assign(c, input);
    return couponView(c);
  });
  route('DELETE', '/partner/shop/coupons/:id', ctx => {
    const { store } = myStore(ctx);
    ctx.db.shop.coupons = ctx.db.shop.coupons.filter(c => !(c.id === decodeURIComponent(ctx.params[0]) && c.storeId === store.id));
    return { removed: true };
  });

  // Returns (partner)
  route('GET', '/partner/shop/returns', ctx => {
    const { store } = myStore(ctx);
    const status = ctx.query.status ? String(ctx.query.status) : null;
    const rows = ctx.db.shop.returns
      .filter(r => r.storeId === store.id)
      .filter(r => !status || (status === 'open' ? ['requested', 'approved', 'received'].includes(r.status) : r.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => returnView(ctx.db, r));
    return paginate(rows, ctx.query);
  });
  const storeReturn = (ctx: ShopCtx) => {
    const { store } = myStore(ctx);
    const r = ctx.db.shop.returns.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!r) throw notFound('Return');
    return { store, ret: r, order: ctx.db.shop.orders.find(o => o.id === r.orderId)! };
  };
  const returnStep = (r: { status: string }, from: string, to: string) => {
    if (r.status !== from) throw new ShopError(409, 'INVALID_TRANSITION', 'This return can’t do that right now.', { from: r.status, to });
  };
  route('GET', '/partner/shop/returns/:id', ctx => returnView(ctx.db, storeReturn(ctx).ret));
  route('POST', '/partner/shop/returns/:id/approve', ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'requested', 'approved');
    ret.status = 'approved';
    ret.storeNote = ctx.body.note ? String(ctx.body.note) : null;
    notify(ctx.db.shop, ret.userId, 'return_update', `Return approved for ${order.code}`, ret.storeNote ?? 'Send the items back as the store instructs.', { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnView(ctx.db, ret);
  });
  route('POST', '/partner/shop/returns/:id/reject', ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'requested', 'rejected');
    const note = String(ctx.body.note ?? '').trim();
    if (note.length < 5) throw bad('Tell the customer why.', { note: 'At least 5 characters' });
    ret.status = 'rejected';
    ret.storeNote = note;
    notify(ctx.db.shop, ret.userId, 'return_update', `Return declined for ${order.code}`, note, { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnView(ctx.db, ret);
  });
  route('POST', '/partner/shop/returns/:id/receive', ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'approved', 'received');
    const restock: Record<string, boolean> = ctx.body.restock ?? {};
    for (const ri of ret.items) {
      const item = order.items.find(i => i.id === ri.orderItemId);
      const found = item ? findVariant(ctx.db.shop, item.variantId) : null;
      if (found && restock[ri.orderItemId]) moveStock(ctx.db.shop, found.variant, ri.quantity, 'return_restock', order.code);
    }
    ret.status = 'received';
    return returnView(ctx.db, ret);
  });
  route('POST', '/partner/shop/returns/:id/refund', ctx => {
    const { ret, order } = storeReturn(ctx);
    returnStep(ret, 'received', 'refunded');
    const max = ret.items.reduce((s, ri) => s + (order.items.find(i => i.id === ri.orderItemId)?.unitPrice ?? 0) * ri.quantity, 0);
    const amount = int(ctx.body.amount);
    const reference = String(ctx.body.reference ?? '').trim();
    const fields: Record<string, string> = {};
    if (amount <= 0 || amount > max) fields.amount = `Between Rs 1 and ${rupees(max)}`;
    if (reference.length < 4) fields.reference = 'Enter the refund reference';
    if (Object.keys(fields).length) throw bad('Check the refund.', fields);
    ret.refund = { amount, reference, recordedAt: isoNow() };
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
    notify(ctx.db.shop, ret.userId, 'return_update', `Refund recorded for ${order.code}`, `${rupees(amount)} · ${reference}`, { groupCode: order.groupCode, orderId: order.id, returnId: ret.id });
    return returnView(ctx.db, ret);
  });

  // Reviews (partner)
  const partnerReview = (ctx: ShopCtx, r: (typeof ctx.db.shop.reviews)[number]) => {
    const p = productById(ctx.db.shop, r.productId);
    return { ...reviewView(r), productName: p?.name ?? 'Product', productImage: p?.images[0]?.url ?? null };
  };
  route('GET', '/partner/shop/reviews', ctx => {
    const { store } = myStore(ctx);
    const rating = num(ctx.query.rating);
    const rows = ctx.db.shop.reviews
      .filter(r => r.storeId === store.id)
      .filter(r => rating === null || r.rating === rating)
      .filter(r => !bool(ctx.query.unreplied) || !r.reply)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => partnerReview(ctx, r));
    return paginate(rows, ctx.query);
  });
  route('PUT', '/partner/shop/reviews/:id/reply', ctx => {
    const { store } = myStore(ctx);
    const r = ctx.db.shop.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.storeId === store.id);
    if (!r) throw notFound('Review');
    const body = String(ctx.body.body ?? '').trim();
    if (body.length < 2) throw bad('Write a reply.', { body: 'Required' });
    if (r.reply && Date.parse(r.reply.createdAt) + DAY < ctx.now) {
      throw new ShopError(409, 'REPLY_LOCKED', 'Replies can be edited for 24 hours after posting.');
    }
    r.reply = { body: body.slice(0, 600), createdAt: r.reply?.createdAt ?? isoNow() };
    notify(ctx.db.shop, r.userId, 'review_reply', `${store.name} replied to your review`, body.slice(0, 80), { productId: r.productId });
    return partnerReview(ctx, r);
  });

  // Insights
  route('GET', '/partner/shop/insights', ctx => {
    const { store } = myStore(ctx);
    const range = ['7d', '30d', '90d'].includes(ctx.query.range) ? ctx.query.range : '7d';
    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
    const since = ctx.now - days * DAY;
    const all = ctx.db.shop.orders.filter(o => o.storeId === store.id);
    const delivered = all.filter(o => o.deliveredAt && Date.parse(o.deliveredAt) >= since && (o.status === 'delivered' || o.status === 'returned'));
    const dates = Array.from({ length: days }, (_, i) => new Date(ctx.now - (days - 1 - i) * DAY).toISOString().slice(0, 10));
    const byProduct = new Map<string, { productId: string; name: string; imageUrl: string | null; units: number; amount: number }>();
    for (const o of delivered) {
      for (const i of o.items) {
        const row = byProduct.get(i.productId) ?? { productId: i.productId, name: i.name, imageUrl: i.imageUrl, units: 0, amount: 0 };
        row.units += i.quantity;
        row.amount += i.unitPrice * i.quantity;
        byProduct.set(i.productId, row);
      }
    }
    const customers = new Map<string, number>();
    for (const o of delivered) customers.set(o.userId, (customers.get(o.userId) ?? 0) + 1);
    const created = all.filter(o => Date.parse(o.createdAt) >= since && o.status !== 'cancelled');
    return {
      range,
      orders: dates.map(date => ({ date, count: delivered.filter(o => o.deliveredAt!.slice(0, 10) === date).length })),
      sales: dates.map(date => ({ date, amount: delivered.filter(o => o.deliveredAt!.slice(0, 10) === date).reduce((s, o) => s + o.total, 0) })),
      recordedSales: delivered.reduce((s, o) => s + o.total, 0),
      orderCount: delivered.length,
      topProducts: [...byProduct.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
      repeatCustomerPct: customers.size ? Math.round(([...customers.values()].filter(n => n > 1).length / customers.size) * 100) : 0,
      deliveredRatePct: created.length ? Math.round((created.filter(o => o.status === 'delivered' || o.status === 'returned').length / created.length) * 100) : 0,
    };
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
