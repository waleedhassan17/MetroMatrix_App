// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop: views (wire JSON) and server rules
// ═══════════════════════════════════════════════════════
// Everything a real Shopping API would compute lives here, so the app can
// trust the server for prices, totals, stock and state — exactly as it will
// against the backend: Bag warnings, the checkout preview, coupon rules,
// delivery cities, the COD limit, order and return state machines, stock
// movements, notifications and insights.

import type { MockDb, MockUser } from '../mockDb';
import type {
  MockAddress,
  MockCartLine,
  MockCategory,
  MockCoupon,
  MockGroup,
  MockOrder,
  MockProduct,
  MockReturn,
  MockReview,
  MockShop,
  MockStore,
  MockVariant,
} from './shopTypes';
import type { NotificationType, OrderStatus, PartnerOrderAction, PaymentMethod } from '../../../../types/shopping';

const DAY = 24 * 60 * 60 * 1000;
export const isoNow = () => new Date().toISOString();

export class ShopError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const nextId = (shop: MockShop, prefix: string) => `${prefix}_${(shop.seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const rupees = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

// ─── Lookups ──────────────────────────────────────────
export const storeById = (shop: MockShop, id: string) => shop.stores.find(s => s.id === id) ?? null;
export const storeOfOwner = (shop: MockShop, userId: string) => shop.stores.find(s => s.ownerId === userId) ?? null;
export const productById = (shop: MockShop, id: string) => shop.products.find(p => p.id === id) ?? null;

export const findVariant = (shop: MockShop, variantId: string): { product: MockProduct; variant: MockVariant } | null => {
  for (const product of shop.products) {
    const variant = product.variants.find(v => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
};

export const isListed = (p: MockProduct) => p.status === 'active' && !p.removed;

export const unitPrice = (p: MockProduct, v: MockVariant | null) => (p.salePrice ?? p.price) + (v?.priceDelta ?? 0);
export const compareAt = (p: MockProduct, v: MockVariant | null) => (p.salePrice ? p.price + (v?.priceDelta ?? 0) : null);
export const variantLabel = (v: Pick<MockVariant, 'option1' | 'option2'>) => [v.option1, v.option2].filter(Boolean).join(' / ');
export const totalStock = (p: MockProduct) => p.variants.reduce((s, v) => s + v.stock, 0);
export const LOW_STOCK = 3;

const firstName = (u: MockUser | undefined) => (u?.name ?? 'Customer').split(' ')[0];
const userById = (db: MockDb, id: string) => db.users.find(u => u.id === id);

// ─── Search (typo tolerant) ───────────────────────────
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
const singular = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

/** Does one query token match one word? Prefixes, plurals and small typos ("kurtta" → kurta). */
const tokenMatches = (token: string, word: string) => {
  const t = singular(token);
  const w = singular(word);
  if (w.startsWith(t) || (t.length >= 4 && t.startsWith(w))) return true;
  const tolerance = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0;
  return tolerance > 0 && levenshtein(t, w) <= tolerance;
};

export const productHaystack = (shop: MockShop, p: MockProduct): string[] => {
  const cat = shop.categories.find(c => c.id === p.categoryId);
  const parent = cat?.parentId ? shop.categories.find(c => c.id === cat.parentId) : null;
  const store = storeById(shop, p.storeId);
  const col = shop.collections.find(c => c.id === p.collectionId);
  return words([p.name, cat?.name, parent?.name, store?.name, col?.name, p.option2?.values.join(' ')].filter(Boolean).join(' '));
};

export const matchesQuery = (haystack: string[], q: string) => {
  const tokens = words(q);
  return tokens.every(t => haystack.some(w => tokenMatches(t, w)));
};

// ─── Ratings ──────────────────────────────────────────
export const reviewsOf = (shop: MockShop, productId: string) => shop.reviews.filter(r => r.productId === productId);

const ratingOf = (rs: MockReview[]) => {
  if (!rs.length) return { rating: 0, ratingCount: 0 };
  return { rating: Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10, ratingCount: rs.length };
};

const storeRating = (shop: MockShop, storeId: string) => ratingOf(shop.reviews.filter(r => r.storeId === storeId));

// ─── Catalogue views ──────────────────────────────────
export const categoryTree = (shop: MockShop) => {
  const listed = shop.products.filter(isListed);
  const countIn = (c: MockCategory): number => {
    const childIds = shop.categories.filter(x => x.parentId === c.id).map(x => x.id);
    return listed.filter(p => p.categoryId === c.id || childIds.includes(p.categoryId ?? '')).length;
  };
  const view = (c: MockCategory): Record<string, unknown> => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    parentId: c.parentId,
    productCount: countIn(c),
    children: shop.categories
      .filter(x => x.parentId === c.id)
      .sort((a, b) => a.position - b.position)
      .map(view),
  });
  return shop.categories
    .filter(c => !c.parentId)
    .sort((a, b) => a.position - b.position)
    .map(view);
};

export const categoryAndChildren = (shop: MockShop, id: string) => [id, ...shop.categories.filter(c => c.parentId === id).map(c => c.id)];

/** The store's category names, most products first (the brand card's chips). */
const storeCategories = (shop: MockShop, storeId: string) => {
  const counts = new Map<string, number>();
  for (const p of shop.products) {
    if (p.storeId !== storeId || !isListed(p) || !p.categoryId) continue;
    counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => shop.categories.find(c => c.id === id)?.name)
    .filter((n): n is string => !!n)
    .slice(0, 8);
};

export const storeSummaryView = (shop: MockShop, s: MockStore) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  tagline: s.tagline,
  about: s.about,
  categories: storeCategories(shop, s.id),
  logoUrl: s.logoUrl,
  coverUrl: s.coverUrl,
  brandColor: s.brandColor,
  onBrandColor: s.onBrandColor,
  city: s.city,
  ...storeRating(shop, s.id),
  freeShippingOver: s.settings.freeShippingOver,
  isFeatured: s.isFeatured,
  isPaused: s.isPaused,
  productCount: shop.products.filter(p => p.storeId === s.id && isListed(p)).length,
});

export const storeDetailView = (shop: MockShop, s: MockStore) => ({
  ...storeSummaryView(shop, s),
  about: s.about,
  socials: s.socials,
  phone: s.phone,
  whatsapp: s.whatsapp,
  pauseMessage: s.isPaused ? s.pauseMessage : null,
  policies: {
    ...s.settings,
    paymentMethods: [
      ...(s.settings.codEnabled ? (['cod'] as const) : []),
      ...(s.paymentAccounts.some(a => a.isActive) ? (['transfer'] as const) : []),
    ],
  },
  collections: shop.collections
    .filter(c => c.storeId === s.id)
    .map(c => ({ ...c, productCount: shop.products.filter(p => p.collectionId === c.id && isListed(p)).length })),
});

export const storeRefView = (s: MockStore) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  logoUrl: s.logoUrl,
  brandColor: s.brandColor,
  onBrandColor: s.onBrandColor,
  phone: s.phone,
  whatsapp: s.whatsapp,
});

const minVariantPrice = (p: MockProduct) =>
  p.variants.length ? Math.min(...p.variants.map(v => unitPrice(p, v))) : unitPrice(p, null);

export const productSummaryView = (shop: MockShop, p: MockProduct) => {
  const store = storeById(shop, p.storeId);
  const price = minVariantPrice(p);
  return {
    id: p.id,
    storeId: p.storeId,
    storeSlug: store?.slug ?? '',
    storeName: store?.name ?? '',
    name: p.name,
    imageUrl: p.images[0]?.url ?? null,
    price,
    compareAtPrice: p.salePrice ? p.price + (price - (p.salePrice ?? p.price)) : null,
    ...ratingOf(reviewsOf(shop, p.id)),
    inStock: totalStock(p) > 0,
    isNew: Date.now() - Date.parse(p.createdAt) < 7 * DAY,
  };
};

export const reviewView = (r: MockReview) => ({
  id: r.id,
  productId: r.productId,
  rating: r.rating,
  title: r.title,
  body: r.body,
  photos: r.photos,
  authorName: r.authorName,
  verified: true,
  createdAt: r.createdAt,
  reply: r.reply
    ? { body: r.reply.body, createdAt: r.reply.createdAt, editableUntil: new Date(Date.parse(r.reply.createdAt) + DAY).toISOString() }
    : null,
});

export const reviewSummaryView = (rs: MockReview[]) => {
  const counts = [0, 0, 0, 0, 0];
  for (const r of rs) counts[r.rating - 1]++;
  return { ...ratingOf(rs), average: ratingOf(rs).rating, count: rs.length, counts, withPhotos: rs.filter(r => r.photos.length).length };
};

export const productDetailView = (shop: MockShop, p: MockProduct, userId: string | null) => {
  const store = storeById(shop, p.storeId)!;
  const rs = reviewsOf(shop, p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = totalStock(p);
  return {
    ...productSummaryView(shop, p),
    description: p.description,
    images: p.images.map(i => i.url),
    categoryId: p.categoryId,
    collectionId: p.collectionId,
    option1: p.option1 ? { ...p.option1, swatches: {} } : null,
    option2: p.option2,
    variants: p.variants.map(v => ({
      id: v.id,
      option1: v.option1,
      option2: v.option2,
      sku: v.sku,
      stock: v.stock,
      price: unitPrice(p, v),
      compareAtPrice: compareAt(p, v),
    })),
    lowStock: total > 0 && total <= LOW_STOCK * 2,
    store: storeDetailView(shop, store),
    reviewSummary: reviewSummaryView(rs),
    topReviews: rs.slice(0, 3).map(reviewView),
    related: shop.products
      .filter(x => x.id !== p.id && isListed(x) && (x.categoryId === p.categoryId || x.collectionId === p.collectionId))
      .sort((a, b) => b.trending - a.trending)
      .slice(0, 8)
      .map(x => productSummaryView(shop, x)),
    wishlisted: userId ? (shop.wishlist[userId] ?? []).includes(p.id) : false,
  };
};

// ─── Bag ──────────────────────────────────────────────
type Warning = {
  code: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STORE_PAUSED';
  message: string;
  lineId: string | null;
  previousPrice: number | null;
  currentPrice: number | null;
  available: number | null;
};

interface LineState {
  line: MockCartLine;
  product: MockProduct | null;
  variant: MockVariant | null;
  price: number;
  warnings: Warning[];
}

export const lineState = (shop: MockShop, line: MockCartLine): LineState => {
  const found = findVariant(shop, line.variantId);
  const product = found?.product ?? null;
  const variant = found?.variant ?? null;
  const warnings: Warning[] = [];
  if (!product || !variant || !isListed(product) || variant.stock === 0) {
    warnings.push({
      code: 'OUT_OF_STOCK',
      message: product && isListed(product) ? 'Sold out. Remove it to continue.' : 'No longer available. Remove it to continue.',
      lineId: line.id,
      previousPrice: null,
      currentPrice: null,
      available: 0,
    });
  } else if (line.quantity > variant.stock) {
    warnings.push({
      code: 'LOW_STOCK',
      message: `Only ${variant.stock} left. Lower the quantity to continue.`,
      lineId: line.id,
      previousPrice: null,
      currentPrice: null,
      available: variant.stock,
    });
  }
  const price = product && variant ? unitPrice(product, variant) : line.priceSeen;
  if (product && variant && price !== line.priceSeen) {
    warnings.push({
      code: 'PRICE_CHANGED',
      message: `The price changed from ${rupees(line.priceSeen)} to ${rupees(price)}.`,
      lineId: line.id,
      previousPrice: line.priceSeen,
      currentPrice: price,
      available: null,
    });
  }
  return { line, product, variant, price, warnings };
};

const lineView = (s: LineState) => ({
  id: s.line.id,
  productId: s.line.productId,
  variantId: s.line.variantId,
  name: s.product?.name ?? 'Unavailable item',
  variantLabel: s.variant ? variantLabel(s.variant) : '',
  imageUrl: s.product?.images[0]?.url ?? null,
  unitPrice: s.price,
  quantity: s.line.quantity,
  lineTotal: s.price * s.line.quantity,
  available: s.variant?.stock ?? 0,
  warnings: s.warnings,
});

const shippingFor = (store: MockStore, itemsTotal: number) =>
  store.settings.freeShippingOver !== null && itemsTotal >= store.settings.freeShippingOver ? 0 : store.settings.shippingFee;

/** The bag's lines grouped by store, oldest store first. */
export const bagGroups = (shop: MockShop, userId: string) => {
  const lines = shop.cart.filter(l => l.userId === userId).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const byStore = new Map<string, LineState[]>();
  for (const line of lines) {
    const s = lineState(shop, line);
    const storeId = s.product?.storeId ?? findVariant(shop, line.variantId)?.product.storeId ?? 'unknown';
    byStore.set(storeId, [...(byStore.get(storeId) ?? []), s]);
  }
  return [...byStore.entries()]
    .map(([storeId, states]) => ({ store: storeById(shop, storeId), states }))
    .filter((g): g is { store: MockStore; states: LineState[] } => !!g.store);
};

export const cartView = (shop: MockShop, userId: string) => {
  const groups = bagGroups(shop, userId).map(({ store, states }) => {
    const subtotal = states.reduce((s, x) => s + x.price * x.line.quantity, 0);
    const warnings: Warning[] = store.isPaused
      ? [{ code: 'STORE_PAUSED', message: store.pauseMessage || `${store.name} is taking a short break.`, lineId: null, previousPrice: null, currentPrice: null, available: null }]
      : [];
    return {
      store: storeRefView(store),
      isPaused: store.isPaused,
      lines: states.map(lineView),
      subtotal,
      shippingFee: shippingFor(store, subtotal),
      freeShippingOver: store.settings.freeShippingOver,
      toFreeShipping: store.settings.freeShippingOver !== null ? Math.max(0, store.settings.freeShippingOver - subtotal) : null,
      warnings,
      blocking: warnings.length > 0 || states.some(s => s.warnings.length > 0),
    };
  });
  const itemsTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = groups.reduce((s, g) => s + g.shippingFee, 0);
  return {
    groups,
    itemCount: groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.quantity, 0), 0),
    itemsTotal,
    shippingTotal,
    total: itemsTotal + shippingTotal,
    blocking: groups.some(g => g.blocking),
  };
};

// ─── Coupons ──────────────────────────────────────────
export const couponStatus = (c: MockCoupon, now = Date.now()) => {
  if (!c.isActive) return 'inactive';
  if (Date.parse(c.startsAt) > now) return 'scheduled';
  if (c.endsAt && Date.parse(c.endsAt) < now) return 'expired';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'used_up';
  return 'active';
};

export const couponView = (c: MockCoupon) => ({
  id: c.id,
  code: c.code,
  type: c.type,
  value: c.value,
  minOrder: c.minOrder,
  maxDiscount: c.maxDiscount,
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  usageLimit: c.usageLimit,
  perCustomerLimit: c.perCustomerLimit,
  usedCount: c.usedCount,
  isActive: c.isActive,
  status: couponStatus(c),
});

export const couponDiscount = (c: MockCoupon, itemsTotal: number) => {
  const raw = c.type === 'percent' ? Math.floor((itemsTotal * c.value) / 100) : c.value;
  return Math.min(itemsTotal, c.maxDiscount !== null ? Math.min(raw, c.maxDiscount) : raw);
};

/** The coupon, or the specific reason it can't be used here. */
export const evaluateCoupon = (
  shop: MockShop,
  storeId: string,
  userId: string,
  code: string,
  itemsTotal: number,
): { coupon: MockCoupon; discount: number } | { error: { code: string; message: string } } => {
  const c = shop.coupons.find(x => x.storeId === storeId && x.code === code.trim().toUpperCase());
  if (!c) return { error: { code: 'COUPON_NOT_FOUND', message: `${code.toUpperCase()} isn't a code for this store.` } };
  const status = couponStatus(c);
  if (status === 'inactive') return { error: { code: 'COUPON_INACTIVE', message: 'This code is switched off.' } };
  if (status === 'scheduled') return { error: { code: 'COUPON_NOT_STARTED', message: 'This code isn’t active yet.' } };
  if (status === 'expired') return { error: { code: 'COUPON_EXPIRED', message: 'This code has expired.' } };
  if (status === 'used_up') return { error: { code: 'COUPON_USED_UP', message: 'This code has reached its usage limit.' } };
  if (c.perCustomerLimit !== null && (c.usedBy[userId] ?? 0) >= c.perCustomerLimit) {
    return { error: { code: 'COUPON_ALREADY_USED', message: 'You have already used this code.' } };
  }
  if (c.minOrder !== null && itemsTotal < c.minOrder) {
    return { error: { code: 'COUPON_MIN_ORDER', message: `Add ${rupees(c.minOrder - itemsTotal)} more from this store to use it.` } };
  }
  return { coupon: c, discount: couponDiscount(c, itemsTotal) };
};

// ─── Checkout preview ─────────────────────────────────
export interface StoreChoice {
  storeId: string;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  note: string | null;
}

export const delivers = (store: MockStore, city: string) =>
  store.settings.nationwide || store.settings.deliveryCities.some(c => c.toLowerCase() === city.toLowerCase());

export const previewFor = (db: MockDb, userId: string, address: MockAddress, choices: StoreChoice[]) => {
  const shop = db.shop;
  const stores = bagGroups(shop, userId).map(({ store, states }) => {
    const choice = choices.find(c => c.storeId === store.id);
    const itemsTotal = states.reduce((s, x) => s + x.price * x.line.quantity, 0);
    let discount = 0;
    let couponError: { code: string; message: string } | null = null;
    let coupon: MockCoupon | null = null;
    if (choice?.couponCode?.trim()) {
      const r = evaluateCoupon(shop, store.id, userId, choice.couponCode, itemsTotal);
      if ('error' in r) couponError = r.error;
      else {
        discount = r.discount;
        coupon = r.coupon;
      }
    }
    const shippingFee = shippingFor(store, itemsTotal - discount);
    const total = itemsTotal - discount + shippingFee;
    const hasAccount = store.paymentAccounts.some(a => a.isActive);
    const codOk = store.settings.codEnabled && (store.settings.codLimit === null || total <= store.settings.codLimit);
    const paymentOptions = [
      {
        method: 'cod' as const,
        available: codOk,
        reason: !store.settings.codEnabled
          ? 'This store doesn’t take cash on delivery.'
          : codOk
            ? null
            : `Cash on delivery up to ${rupees(store.settings.codLimit ?? 0)}.`,
      },
      { method: 'transfer' as const, available: hasAccount, reason: hasAccount ? null : 'This store takes cash on delivery only.' },
    ];
    const wanted = choice?.paymentMethod ?? (codOk ? 'cod' : 'transfer');
    const paymentMethod: PaymentMethod = paymentOptions.find(o => o.method === wanted)?.available
      ? wanted
      : (paymentOptions.find(o => o.available)?.method ?? wanted);

    let error: { code: string; message: string } | null = null;
    if (store.isPaused) error = { code: 'STORE_PAUSED', message: store.pauseMessage || `${store.name} is paused right now.` };
    else if (states.some(s => s.warnings.length)) {
      error = { code: 'BAG_NEEDS_ATTENTION', message: 'Some items changed. Review your bag first.' };
    } else if (!delivers(store, address.city)) {
      error = { code: 'CITY_NOT_SERVED', message: `${store.name} doesn’t deliver to ${address.city} yet.` };
    } else if (!paymentOptions.some(o => o.available)) {
      error = { code: 'NO_PAYMENT_METHOD', message: 'This store can’t take payment for this order.' };
    }
    return {
      raw: { store, states, coupon, choice, total, discount, shippingFee, itemsTotal, paymentMethod, error, couponError },
      view: {
        store: storeRefView(store),
        lineCount: states.length,
        lines: states.map(lineView),
        itemsTotal,
        shippingFee,
        discount,
        total,
        couponCode: choice?.couponCode?.trim().toUpperCase() || null,
        couponError,
        paymentOptions,
        paymentMethod,
        error,
        dispatchMinDays: store.settings.dispatchMinDays,
        dispatchMaxDays: store.settings.dispatchMaxDays,
      },
    };
  });
  const views = stores.map(s => s.view);
  return {
    stores,
    view: {
      stores: views,
      itemsTotal: views.reduce((s, x) => s + x.itemsTotal, 0),
      shippingTotal: views.reduce((s, x) => s + x.shippingFee, 0),
      discountTotal: views.reduce((s, x) => s + x.discount, 0),
      total: views.reduce((s, x) => s + x.total, 0),
      canPlace: views.length > 0 && views.every(v => !v.error && !v.couponError),
    },
  };
};

// ─── Stock ────────────────────────────────────────────
export const moveStock = (
  shop: MockShop,
  variant: MockVariant,
  delta: number,
  reason: 'initial' | 'manual' | 'bulk' | 'order' | 'cancel' | 'return_restock',
  note: string | null = null,
) => {
  variant.stock = Math.max(0, variant.stock + delta);
  if (delta !== 0) {
    shop.movements.push({ id: nextId(shop, 'mv'), variantId: variant.id, delta, stockAfter: variant.stock, reason, note, createdAt: isoNow() });
  }
};

const restockOrder = (shop: MockShop, order: MockOrder) => {
  for (const item of order.items) {
    const found = findVariant(shop, item.variantId);
    if (found) moveStock(shop, found.variant, item.quantity - item.returnedQty, 'cancel', order.code);
  }
};

// ─── Notifications ────────────────────────────────────
export const notify = (
  shop: MockShop,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data: { groupCode?: string | null; orderId?: string | null; returnId?: string | null; productId?: string | null } = {},
) => {
  shop.notifications.push({
    id: nextId(shop, 'n'),
    userId,
    type,
    title,
    body,
    data: { groupCode: data.groupCode ?? null, orderId: data.orderId ?? null, returnId: data.returnId ?? null, productId: data.productId ?? null },
    isRead: false,
    createdAt: isoNow(),
  });
};

// ─── Orders ───────────────────────────────────────────
export const MAIN_PATH: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

/** Where an order stands on the main path (a cancellation request keeps the step it was on). */
export const progressStatus = (o: MockOrder): OrderStatus => {
  if (o.status !== 'cancellation_requested') return o.status;
  for (let i = MAIN_PATH.length - 1; i >= 0; i--) if (o.events.some(e => e.type === MAIN_PATH[i])) return MAIN_PATH[i];
  return 'placed';
};

export const addEvent = (o: MockOrder, type: MockOrder['events'][number]['type'], note: string | null = null) => {
  o.events.push({ type, note, createdAt: isoNow() });
};

const openReturnFor = (shop: MockShop, orderId: string) =>
  shop.returns.find(r => r.orderId === orderId && (r.status === 'requested' || r.status === 'approved' || r.status === 'received'));

const returnableQty = (shop: MockShop, order: MockOrder, itemId: string) => {
  const item = order.items.find(i => i.id === itemId);
  if (!item) return 0;
  const pending = shop.returns
    .filter(r => r.orderId === order.id && r.status !== 'rejected' && r.status !== 'refunded')
    .reduce((s, r) => s + r.items.filter(i => i.orderItemId === itemId).reduce((m, i) => m + i.quantity, 0), 0);
  return Math.max(0, item.quantity - item.returnedQty - pending);
};

export const returnWindowEnd = (shop: MockShop, o: MockOrder) => {
  const store = storeById(shop, o.storeId);
  if (!o.deliveredAt || !store || store.settings.returnWindowDays <= 0) return null;
  return new Date(Date.parse(o.deliveredAt) + store.settings.returnWindowDays * DAY).toISOString();
};

const instructionsFor = (shop: MockShop, o: MockOrder) => {
  if (o.paymentMethod !== 'transfer') return null;
  const store = storeById(shop, o.storeId);
  const account = store?.paymentAccounts.find(a => a.id === o.paymentAccountId) ?? store?.paymentAccounts.find(a => a.isActive);
  if (!account) return null;
  return {
    kind: account.kind,
    accountTitle: account.title,
    accountNumber: account.number,
    bankName: account.bankName,
    amount: o.total,
    payBy: o.payBy ?? new Date(Date.parse(o.createdAt) + DAY).toISOString(),
  };
};

const COURIER_NAMES: Record<string, string> = {
  tcs: 'TCS',
  leopards: 'Leopards',
  mnp: 'M&P',
  postex: 'PostEx',
  trax: 'Trax',
  own_rider: 'Own rider',
  other: 'Courier',
};

export const orderView = (shop: MockShop, o: MockOrder) => {
  const store = storeById(shop, o.storeId)!;
  const windowEnd = returnWindowEnd(shop, o);
  const withinWindow = windowEnd !== null && Date.parse(windowEnd) > Date.now();
  const returnable = o.items.some(i => returnableQty(shop, o, i.id) > 0);
  return {
    id: o.id,
    code: o.code,
    groupCode: o.groupCode,
    store: storeRefView(store),
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    items: o.items.map(i => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      variantLabel: i.variantLabel,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
      reviewed: i.reviewed,
      returnableQuantity: o.status === 'delivered' && withinWindow ? returnableQty(shop, o, i.id) : 0,
    })),
    itemsTotal: o.itemsTotal,
    shippingFee: o.shippingFee,
    discount: o.discount,
    total: o.total,
    couponCode: o.couponCode,
    note: o.note,
    shipment: o.shipment ? { ...o.shipment, courierName: COURIER_NAMES[o.shipment.courier] } : null,
    events: o.events,
    paymentInstructions: instructionsFor(shop, o),
    paymentProof: o.paymentProof,
    returnWindowEndsAt: windowEnd,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    deliveredAt: o.deliveredAt,
    canCancel: o.status === 'placed',
    canRequestCancel: o.status === 'confirmed' || o.status === 'packed',
    canConfirmReceived: o.status === 'shipped',
    canReturn: o.status === 'delivered' && withinWindow && returnable && !openReturnFor(shop, o.id),
    canReview: o.status === 'delivered' && o.items.some(i => !i.reviewed),
  };
};

export const groupView = (shop: MockShop, g: MockGroup) => {
  const orders = g.orderIds.map(id => shop.orders.find(o => o.id === id)).filter((o): o is MockOrder => !!o);
  return {
    code: g.code,
    createdAt: g.createdAt,
    address: g.address,
    orders: orders.map(o => orderView(shop, o)),
    itemsTotal: orders.reduce((s, o) => s + o.itemsTotal, 0),
    shippingTotal: orders.reduce((s, o) => s + o.shippingFee, 0),
    discountTotal: orders.reduce((s, o) => s + o.discount, 0),
    total: orders.reduce((s, o) => s + o.total, 0),
  };
};

const FINISHED: OrderStatus[] = ['delivered', 'returned', 'cancelled'];

export const groupSegment = (shop: MockShop, g: MockGroup): 'active' | 'completed' | 'cancelled' => {
  const orders = g.orderIds.map(id => shop.orders.find(o => o.id === id)!).filter(Boolean);
  if (orders.every(o => o.status === 'cancelled')) return 'cancelled';
  if (orders.every(o => FINISHED.includes(o.status))) return 'completed';
  return 'active';
};

export const groupSummaryView = (shop: MockShop, g: MockGroup) => {
  const orders = g.orderIds.map(id => shop.orders.find(o => o.id === id)!).filter(Boolean);
  return {
    code: g.code,
    createdAt: g.createdAt,
    total: orders.reduce((s, o) => s + o.total, 0),
    itemCount: orders.reduce((s, o) => s + o.items.reduce((m, i) => m + i.quantity, 0), 0),
    stores: orders.map(o => {
      const s = storeById(shop, o.storeId)!;
      return { name: s.name, logoUrl: s.logoUrl, brandColor: s.brandColor };
    }),
    thumbnails: orders.flatMap(o => o.items.map(i => i.imageUrl).filter(Boolean)).slice(0, 4),
    orders: orders.map(o => ({ status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod })),
  };
};

/** What the store can do next with this order. */
export const allowedActions = (o: MockOrder): PartnerOrderAction[] => {
  const out: PartnerOrderAction[] = [];
  const step = progressStatus(o);
  if (o.status === 'cancellation_requested') out.push('approve_cancellation');
  if (o.paymentMethod === 'transfer' && o.paymentStatus === 'proof_submitted' && o.status !== 'cancelled') {
    out.push('confirm_payment', 'reject_payment');
  }
  if (o.status !== 'cancelled' && o.status !== 'returned') {
    if (step === 'placed') out.push('confirm');
    if (step === 'confirmed') out.push('pack');
    if (step === 'packed') out.push('ship');
    if (step === 'shipped' && o.status === 'shipped') out.push('deliver');
    if (['placed', 'confirmed', 'packed'].includes(step)) out.push('cancel');
  }
  if (o.status === 'delivered' && o.paymentMethod === 'cod' && o.paymentStatus === 'cod_pending') out.push('cash_collected');
  return out;
};

export const shipBlockedReason = (o: MockOrder) =>
  o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid' ? 'Confirm the customer’s transfer before shipping.' : null;

export const partnerOrderView = (db: MockDb, o: MockOrder) => {
  const shop = db.shop;
  const g = shop.groups.find(x => x.code === o.groupCode);
  const customer = userById(db, o.userId);
  return {
    ...orderView(shop, o),
    customer: { name: customer?.name ?? 'Customer', phone: g?.address.phone ?? customer?.phone ?? '' },
    address: g?.address ?? null,
    internalNote: o.internalNote,
    allowedActions: allowedActions(o),
    shipBlockedReason: progressStatus(o) === 'packed' ? shipBlockedReason(o) : null,
  };
};

export const partnerOrderRow = (db: MockDb, o: MockOrder) => ({
  id: o.id,
  code: o.code,
  customerFirstName: firstName(userById(db, o.userId)),
  itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
  total: o.total,
  status: o.status,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  createdAt: o.createdAt,
});

/** Cancel an order (customer or store): status, stock back, coupon use returned. */
export const cancelOrder = (shop: MockShop, o: MockOrder, reason: string) => {
  o.status = 'cancelled';
  o.cancelReason = reason;
  addEvent(o, 'cancelled', reason);
  restockOrder(shop, o);
  if (o.couponCode) {
    const c = shop.coupons.find(x => x.storeId === o.storeId && x.code === o.couponCode);
    if (c) {
      c.usedCount = Math.max(0, c.usedCount - 1);
      c.usedBy[o.userId] = Math.max(0, (c.usedBy[o.userId] ?? 1) - 1);
    }
  }
};

export const returnView = (db: MockDb, r: MockReturn) => {
  const shop = db.shop;
  const order = shop.orders.find(o => o.id === r.orderId);
  const store = storeById(shop, r.storeId);
  return {
    id: r.id,
    orderId: r.orderId,
    orderCode: order?.code ?? '',
    storeName: store?.name ?? '',
    status: r.status,
    reason: r.reason,
    details: r.details,
    photos: r.photos,
    items: r.items.map(ri => {
      const item = order?.items.find(i => i.id === ri.orderItemId);
      return {
        orderItemId: ri.orderItemId,
        name: item?.name ?? 'Item',
        variantLabel: item?.variantLabel ?? '',
        imageUrl: item?.imageUrl ?? null,
        quantity: ri.quantity,
        unitPrice: item?.unitPrice ?? 0,
      };
    }),
    storeNote: r.storeNote,
    refund: r.refund,
    createdAt: r.createdAt,
    customerName: userById(db, r.userId)?.name ?? 'Customer',
  };
};

export { returnableQty, openReturnFor, firstName, userById, rupees, shippingFor };
