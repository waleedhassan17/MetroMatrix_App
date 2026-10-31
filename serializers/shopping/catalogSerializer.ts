// MetroMatrix — Catalogue serializers (categories, stores, products, reviews, home),
// from the real API's shapes (docs/API_SHOPPING.md §2, §5.2): ProductCard,
// StoreCard, the store page, the product page and a Review.

import type {
  Banner,
  BannerTarget,
  Collection,
  PaymentMethod,
  ProductDetail,
  ProductOption,
  ProductSummary,
  ProductVariant,
  Review,
  ReviewSummary,
  SearchSuggestion,
  ShopCategory,
  ShopHome,
  StoreDetail,
  StorePolicies,
  StoreSummary,
} from '../../models/shopping';
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull, fromResponse, bodyOf } from '../serializerUtils';
import { BRAND_FALLBACK, color, compact, count, iso, isoOrNull, money, moneyOrNull, paged } from './common';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** A line can hold up to 20; a variant the API flags "low" has 3 or fewer. */
export const LINE_MAX = 20;
export const LOW_STOCK = 3;

export const categorySerializer = fromResponse((raw: unknown, parentId: string | null = null): ShopCategory | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    slug: str(raw.slug, id),
    icon: str(raw.icon, 'shopping-outline'),
    parentId: strOrNull(raw.parentId) ?? parentId,
    productCount: count(raw.productCount),
    children: compact(arr(raw.children).map(c => categorySerializer(c, id))),
  };
});

/** A StoreCard (lists, featured stores) or the essentials a product or cart carries. */
export const storeSummarySerializer = fromResponse((raw: unknown): StoreSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const policies = isObject(raw.policies) ? raw.policies : {};
  return {
    id,
    slug: str(raw.slug, id),
    name,
    tagline: str(raw.tagline),
    about: str(raw.about),
    // The API's card doesn't list what a store sells.
    categories: [],
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    brandColor: color(raw.brandColor, BRAND_FALLBACK.brand),
    onBrandColor: color(raw.onBrandColor, BRAND_FALLBACK.onBrand),
    city: str(raw.city),
    rating: clamp(num(raw.ratingAvg), 0, 5),
    ratingCount: count(raw.ratingCount),
    freeShippingOver: moneyOrNull(raw.freeShippingOver ?? policies.freeShippingOver),
    isFeatured: bool(raw.isFeatured),
    // A paused store isn't visible to customers at all (404).
    isPaused: bool(raw.isPaused),
    productCount: count(raw.productCount),
  };
});

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];

/** `policies` on the store page, or the product page's store essentials. */
const policiesSerializer = (raw: unknown): StorePolicies => {
  const r = isObject(raw) ? raw : {};
  const min = count(r.dispatchDaysMin);
  const cities = arr(r.deliveryCities).map(c => str(c)).filter(Boolean);
  const methods = enumList(r.paymentMethods, PAYMENT_METHODS);
  const codEnabled = r.codEnabled === undefined ? methods.includes('cod') : bool(r.codEnabled);
  return {
    shippingFee: Math.max(0, money(r.shippingFlatFee)),
    freeShippingOver: moneyOrNull(r.freeShippingOver),
    // An empty list means nationwide (docs/API_SHOPPING.md §4).
    nationwide: cities.length === 0,
    deliveryCities: cities,
    dispatchMinDays: min,
    dispatchMaxDays: Math.max(min, count(r.dispatchDaysMax)),
    returnWindowDays: count(r.returnWindowDays),
    codEnabled,
    codLimit: moneyOrNull(r.codLimit),
    paymentMethods: methods.length ? methods : codEnabled ? ['cod'] : [],
  };
};

export const collectionSerializer = fromResponse((raw: unknown): Collection | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return { id, name, slug: str(raw.slug, id), productCount: count(raw.productCount), position: Math.round(num(raw.sort)) };
});

const socialsOf = (raw: unknown) => {
  const s = isObject(raw) ? raw : {};
  return {
    instagram: strOrNull(s.instagram),
    facebook: strOrNull(s.facebook),
    tiktok: strOrNull(s.tiktok),
    website: strOrNull(s.website),
  };
};

/** GET /shop/stores/:slug — a StoreCard with `about`, `socials`, `collections` and `policies`. */
export const storeDetailSerializer = fromResponse((raw: unknown): StoreDetail | null => {
  const summary = storeSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const socials = socialsOf(raw.socials);
  const s = isObject(raw.socials) ? raw.socials : {};
  return {
    ...summary,
    about: str(raw.about),
    socials,
    // The storefront has no public phone (StoreSocials has none): the store is reached on WhatsApp.
    phone: null,
    whatsapp: strOrNull(s.whatsapp),
    pauseMessage: strOrNull(raw.pauseMessage),
    // The store page nests them; the product page's store carries them flat.
    policies: policiesSerializer(isObject(raw.policies) ? raw.policies : raw),
    collections: compact(arr(raw.collections).map(collectionSerializer)).sort((a, b) => a.position - b.position),
  };
});

/** A ProductCard: `price` is what the customer pays; `basePrice` is struck through while `onSale`. */
export const productSummarySerializer = (raw: unknown): ProductSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const price = Math.max(0, money(raw.price));
  const base = moneyOrNull(raw.basePrice);
  const store = isObject(raw.store) ? raw.store : {};
  return {
    id,
    storeId: str(store.id),
    storeSlug: str(store.slug),
    storeName: str(store.name),
    name,
    imageUrl: strOrNull(raw.coverUrl),
    price,
    compareAtPrice: bool(raw.onSale) && base !== null && base > price ? base : null,
    rating: clamp(num(raw.ratingAvg), 0, 5),
    ratingCount: count(raw.ratingCount),
    inStock: bool(raw.inStock, true),
    // The API has no "new" flag on a card (newArrivals is its own rail).
    isNew: false,
  };
};

/** The API names no options: option1 is the size (or pack), option2 the colour. */
const optionOf = (name: string, values: unknown, variants: Record<string, unknown>[], key: 'option1' | 'option2'): ProductOption | null => {
  const list = arr(values).map(v => str(v)).filter(Boolean);
  if (!list.length) return null;
  const swatches: Record<string, string> = {};
  if (key === 'option2') {
    for (const v of variants) {
      const value = str(v.option2);
      const hex = color(v.colorHex, '');
      if (value && hex) swatches[value] = hex;
    }
  }
  return { name, values: list, swatches };
};

const variantSerializer = (raw: unknown, sale: { onSale: boolean; off: number }): ProductVariant | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const price = Math.max(0, money(raw.price));
  const inStock = bool(raw.inStock, true);
  return {
    id,
    option1: strOrNull(raw.option1),
    option2: strOrNull(raw.option2),
    sku: str(raw.sku),
    // Customers see flags, never numbers: a stand-in the picker can count on.
    stock: !inStock ? 0 : bool(raw.lowStock) ? LOW_STOCK : LINE_MAX,
    lowStock: inStock && bool(raw.lowStock),
    price,
    compareAtPrice: sale.onSale && sale.off > 0 ? price + sale.off : null,
  };
};

/** A Review: `text`, `author`, and the store's reply (editable for 24 h). */
export const reviewSerializer = fromResponse((raw: unknown): Review | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const author = isObject(raw.author) ? raw.author : {};
  const replied = str(raw.storeReply);
  const repliedAt = isoOrNull(raw.repliedAt);
  return {
    id,
    productId: str(raw.productId),
    rating: clamp(Math.round(num(raw.rating)), 1, 5),
    title: null,
    body: str(raw.text),
    photos: arr(raw.photos).map(p => str(p)).filter(Boolean),
    authorName: str(author.name, 'Customer'),
    // Every review comes from a delivered order line.
    verified: true,
    createdAt: iso(raw.createdAt),
    reply: replied
      ? { body: replied, createdAt: repliedAt ?? iso(raw.createdAt), editableUntil: new Date(Date.parse(repliedAt ?? iso(raw.createdAt)) + 24 * 3600_000).toISOString() }
      : null,
  };
});

/** `{ ratingAvg, ratingCount, breakdown: { "1": n, … "5": n } }`, or a product's `ratingBreakdown`. */
export const reviewSummarySerializer = (raw: unknown, breakdown?: unknown): ReviewSummary => {
  const r = isObject(raw) ? raw : {};
  const b = isObject(breakdown ?? r.breakdown) ? ((breakdown ?? r.breakdown) as Record<string, unknown>) : {};
  const counts: ReviewSummary['counts'] = [count(b['1']), count(b['2']), count(b['3']), count(b['4']), count(b['5'])];
  const total = counts.reduce((s, n) => s + n, 0);
  return {
    average: clamp(num(r.ratingAvg), 0, 5),
    count: Math.max(count(r.ratingCount), total),
    counts,
    withPhotos: 0,
  };
};

/**
 * GET /shop/products/:id. The page also shows the first reviews and related
 * products (their own routes); pass them in as raw answers when read together.
 */
export const productDetailSerializer = fromResponse((raw: unknown, related?: unknown, reviews?: unknown): ProductDetail | null => {
  const summary = productSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const store = storeDetailSerializer(raw.store);
  if (!store) return null;
  const images = arr(raw.images)
    .map(i => (isObject(i) ? str(i.url) : str(i)))
    .filter(Boolean);
  const base = money(raw.basePrice);
  const sale = { onSale: bool(raw.onSale), off: Math.max(0, base - summary.price) };
  const rawVariants = arr(raw.variants).filter(isObject);
  const variants = compact(rawVariants.map(v => variantSerializer(v, sale)));
  const options = isObject(raw.options) ? raw.options : {};
  const reviewPage = isObject(bodyOf(reviews)) ? (bodyOf(reviews) as Record<string, unknown>) : {};
  return {
    ...summary,
    imageUrl: summary.imageUrl ?? images[0] ?? null,
    description: str(raw.description),
    images: images.length ? images : summary.imageUrl ? [summary.imageUrl] : [],
    categoryId: str(raw.categoryId),
    collectionId: strOrNull(raw.collectionId),
    option1: optionOf('Size', options.option1, rawVariants, 'option1'),
    option2: optionOf('Colour', options.option2, rawVariants, 'option2'),
    variants,
    inStock: variants.length ? variants.some(v => v.stock > 0) : summary.inStock,
    lowStock: variants.some(v => v.lowStock),
    store,
    reviewSummary: reviewSummarySerializer({ ratingAvg: raw.ratingAvg, ratingCount: raw.ratingCount }, raw.ratingBreakdown),
    topReviews: compact(arr(reviewPage.items).map(reviewSerializer)).slice(0, 3),
    related: compact(arr(bodyOf(related)).map(productSummarySerializer)),
    wishlisted: bool(raw.isWishlisted),
  };
});

/** A banner points at a store, category, collection or product (`targetId`), or nowhere. */
const bannerTargetOf = (raw: Record<string, unknown>, home: { stores: StoreSummary[]; categories: ShopCategory[] }): BannerTarget => {
  const id = str(raw.targetId);
  const type = oneOf(raw.targetType, ['store', 'category', 'collection', 'product', 'none'] as const, 'none');
  const flat = home.categories.flatMap(c => [c, ...c.children]);
  if (type === 'store' && id) return { kind: 'store', slug: home.stores.find(s => s.id === id)?.slug ?? id };
  if (type === 'category' && id) return { kind: 'category', id, name: flat.find(c => c.id === id)?.name ?? '' };
  if (type === 'product' && id) return { kind: 'product', id };
  if (type === 'collection' && id) return { kind: 'collection', id };
  return { kind: 'none' };
};

export const bannerSerializer = (raw: unknown, home: { stores: StoreSummary[]; categories: ShopCategory[] } = { stores: [], categories: [] }): Banner | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const imageUrl = str(raw.imageUrl);
  if (!id || !imageUrl) return null;
  return { id, imageUrl, headline: str(raw.title), subhead: strOrNull(raw.subtitle), target: bannerTargetOf(raw, home) };
};

/** GET /shop/home: `{ banners, featuredStores, newArrivals, trending, categories }`. */
export const shopHomeSerializer = fromResponse((raw: unknown): ShopHome => {
  const r = isObject(raw) ? raw : {};
  const categories = compact(arr(r.categories).map(c => categorySerializer(c)));
  const featuredStores = compact(arr(r.featuredStores).map(storeSummarySerializer));
  return {
    banners: compact(arr(r.banners).map(b => bannerSerializer(b, { stores: featuredStores, categories }))),
    categories,
    featuredStores,
    newThisWeek: compact(arr(r.newArrivals).map(productSummarySerializer)),
  };
});

export { isoOrNull };

/** A page of ProductCards, as the API answers it. */
export const productSummaryPageSerializer = fromResponse(raw => paged(raw, productSummarySerializer));

/** GET /shop/products/:id/related: up to 10 ProductCards. */
export const relatedProductsSerializer = fromResponse(raw => compact(arr(raw).map(productSummarySerializer)));

/** A list of collections, as the API answers it. */
export const collectionListSerializer = fromResponse(raw => compact(arr(raw).map(collectionSerializer)));

/** GET /shop/categories: the tree, roots with their children. */
export const categoryListSerializer = fromResponse(raw => compact(arr(raw).map(c => categorySerializer(c))));

/** A page of StoreCards, as the API answers it. */
export const storeSummaryPageSerializer = fromResponse(raw => paged(raw, storeSummarySerializer));

/** GET /shop/products/suggest: `{ products, stores }` → stores first, then up to five products. */
export const suggestionListSerializer = fromResponse((raw): SearchSuggestion[] => {
  const r = isObject(raw) ? raw : {};
  const stores = arr(r.stores)
    .filter(isObject)
    .filter(s => str(s.name))
    .map(s => ({ kind: 'store' as const, id: str(s.slug, str(s.id)), label: str(s.name), query: str(s.slug, str(s.name)) }));
  const products = arr(r.products)
    .filter(isObject)
    .filter(p => str(p.id) && str(p.name))
    .map(p => ({ kind: 'product' as const, id: str(p.id), label: str(p.name), query: str(p.name) }));
  return [...stores, ...products.slice(0, 5)];
});

/** GET /shop/wishlist (one page of 100): every saved product id, for the hearts on cards. */
export const wishlistIdsSerializer = fromResponse(raw =>
  arr(isObject(raw) ? raw.items : raw)
    .map(v => (isObject(v) ? str(v.id) : str(v)))
    .filter(Boolean),
);

/** A page of a product's reviews, with the rating summary. */
export const productReviewsSerializer = fromResponse(raw => ({
  ...paged(raw, reviewSerializer),
  summary: reviewSummarySerializer(isObject(raw) ? raw.summary : null),
}));
