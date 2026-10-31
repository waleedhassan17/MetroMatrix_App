// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop: the server rules
// ═══════════════════════════════════════════════════════
// What the Shopping API computes, so the app trusts the server for prices,
// totals, stock and state as it does against the backend: the bag's lines,
// coupon rules, delivery cities, the COD limit, return windows, stock
// movements and notifications. shopWire.ts turns the rows into the real
// API's answers.

import type { MockDb, MockUser } from '../mockDb';
import type {
  MockCartLine,
  MockCategory,
  MockCoupon,
  MockGroup,
  MockOrder,
  MockProduct,
  MockShop,
  MockStore,
  MockVariant,
} from './shopTypes';
import type { MovementReason, NotificationType, OrderStatus, PaymentMethod } from '../../../../models/shopping';

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

// ─── Coupons ──────────────────────────────────────────
export const couponStatus = (c: MockCoupon, now = Date.now()) => {
  if (!c.isActive) return 'inactive';
  if (Date.parse(c.startsAt) > now) return 'scheduled';
  if (c.endsAt && Date.parse(c.endsAt) < now) return 'expired';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'used_up';
  return 'active';
};

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

// ─── Stock ────────────────────────────────────────────
export const moveStock = (
  shop: MockShop,
  variant: MockVariant,
  delta: number,
  reason: MovementReason,
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

const FINISHED: OrderStatus[] = ['delivered', 'returned', 'cancelled'];

export const groupSegment = (shop: MockShop, g: MockGroup): 'active' | 'completed' | 'cancelled' => {
  const orders = g.orderIds.map(id => shop.orders.find(o => o.id === id)!).filter(Boolean);
  if (orders.every(o => o.status === 'cancelled')) return 'cancelled';
  if (orders.every(o => FINISHED.includes(o.status))) return 'completed';
  return 'active';
};

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

export { returnableQty, openReturnFor, firstName, userById, rupees, shippingFor };
