// MetroMatrix — Catalogue serializers (categories, stores, products, reviews, home).
// TODO(API_SHOPPING): field names per docs/API_SHOPPING_ASSUMED.md.

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
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { BRAND_FALLBACK, color, compact, count, iso, isoOrNull, money, moneyOrNull, paged } from './common';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const categorySerializer = fromResponse((raw: unknown): ShopCategory | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    slug: str(raw.slug, id),
    icon: str(raw.icon, 'shopping-outline'),
    parentId: strOrNull(raw.parentId),
    productCount: count(raw.productCount),
    children: compact(arr(raw.children).map(categorySerializer)),
  };
});

export const storeSummarySerializer = fromResponse((raw: unknown): StoreSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    slug: str(raw.slug, id),
    name,
    tagline: str(raw.tagline),
    about: str(raw.about),
    categories: arr(raw.categories).map(c => str(c)).filter(Boolean).slice(0, 8),
    logoUrl: strOrNull(raw.logoUrl),
    coverUrl: strOrNull(raw.coverUrl),
    brandColor: color(raw.brandColor, BRAND_FALLBACK.brand),
    onBrandColor: color(raw.onBrandColor, BRAND_FALLBACK.onBrand),
    city: str(raw.city),
    rating: clamp(num(raw.rating), 0, 5),
    ratingCount: count(raw.ratingCount),
    freeShippingOver: moneyOrNull(raw.freeShippingOver),
    isFeatured: bool(raw.isFeatured),
    isPaused: bool(raw.isPaused),
    productCount: count(raw.productCount),
  };
});

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cod', 'transfer'];

const policiesSerializer = (raw: unknown): StorePolicies => {
  const r = isObject(raw) ? raw : {};
  const min = count(r.dispatchMinDays);
  return {
    shippingFee: Math.max(0, money(r.shippingFee)),
    freeShippingOver: moneyOrNull(r.freeShippingOver),
    nationwide: bool(r.nationwide),
    deliveryCities: arr(r.deliveryCities).map(c => str(c)).filter(Boolean),
    dispatchMinDays: min,
    dispatchMaxDays: Math.max(min, count(r.dispatchMaxDays)),
    returnWindowDays: count(r.returnWindowDays),
    codEnabled: bool(r.codEnabled, true),
    codLimit: moneyOrNull(r.codLimit),
    paymentMethods: enumList(r.paymentMethods, PAYMENT_METHODS),
  };
};

export const collectionSerializer = fromResponse((raw: unknown): Collection | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return { id, name, slug: str(raw.slug, id), productCount: count(raw.productCount), position: Math.round(num(raw.position)) };
});

export const storeDetailSerializer = fromResponse((raw: unknown): StoreDetail | null => {
  const summary = storeSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const socials = isObject(raw.socials) ? raw.socials : {};
  return {
    ...summary,
    about: str(raw.about),
    socials: {
      instagram: strOrNull(socials.instagram),
      facebook: strOrNull(socials.facebook),
      tiktok: strOrNull(socials.tiktok),
      website: strOrNull(socials.website),
    },
    phone: strOrNull(raw.phone),
    whatsapp: strOrNull(raw.whatsapp),
    pauseMessage: strOrNull(raw.pauseMessage),
    policies: policiesSerializer(raw.policies),
    collections: compact(arr(raw.collections).map(collectionSerializer)).sort((a, b) => a.position - b.position),
  };
});

export const productSummarySerializer = (raw: unknown): ProductSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const price = Math.max(0, money(raw.price));
  const compareAt = moneyOrNull(raw.compareAtPrice);
  return {
    id,
    storeId: str(raw.storeId),
    storeSlug: str(raw.storeSlug),
    storeName: str(raw.storeName),
    name,
    imageUrl: strOrNull(raw.imageUrl),
    price,
    compareAtPrice: compareAt !== null && compareAt > price ? compareAt : null,
    rating: clamp(num(raw.rating), 0, 5),
    ratingCount: count(raw.ratingCount),
    inStock: bool(raw.inStock, true),
    isNew: bool(raw.isNew),
  };
};

const optionSerializer = (raw: unknown): ProductOption | null => {
  if (!isObject(raw)) return null;
  const name = str(raw.name);
  const values = arr(raw.values).map(v => str(v)).filter(Boolean);
  if (!name || !values.length) return null;
  const swatches: Record<string, string> = {};
  if (isObject(raw.swatches)) {
    for (const [k, v] of Object.entries(raw.swatches)) {
      const c = color(v, '');
      if (c) swatches[k] = c;
    }
  }
  return { name, values, swatches };
};

const variantSerializer = (raw: unknown): ProductVariant | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const price = Math.max(0, money(raw.price));
  const compareAt = moneyOrNull(raw.compareAtPrice);
  return {
    id,
    option1: strOrNull(raw.option1),
    option2: strOrNull(raw.option2),
    sku: str(raw.sku),
    stock: count(raw.stock),
    price,
    compareAtPrice: compareAt !== null && compareAt > price ? compareAt : null,
  };
};

export const reviewSerializer = fromResponse((raw: unknown): Review | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const reply = isObject(raw.reply) && str(raw.reply.body)
    ? { body: str(raw.reply.body), createdAt: iso(raw.reply.createdAt), editableUntil: iso(raw.reply.editableUntil) }
    : null;
  return {
    id,
    productId: str(raw.productId),
    rating: clamp(Math.round(num(raw.rating)), 1, 5),
    title: strOrNull(raw.title),
    body: str(raw.body),
    photos: arr(raw.photos).map(p => str(p)).filter(Boolean),
    authorName: str(raw.authorName, 'Customer'),
    verified: bool(raw.verified),
    createdAt: iso(raw.createdAt),
    reply,
  };
});

export const reviewSummarySerializer = (raw: unknown): ReviewSummary => {
  const r = isObject(raw) ? raw : {};
  const c = arr(r.counts).map(count);
  const counts: ReviewSummary['counts'] = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0, c[4] ?? 0];
  const total = counts.reduce((s, n) => s + n, 0);
  return {
    average: clamp(num(r.average), 0, 5),
    count: Math.max(count(r.count), total),
    counts,
    withPhotos: count(r.withPhotos),
  };
};

export const productDetailSerializer = fromResponse((raw: unknown): ProductDetail | null => {
  const summary = productSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const store = storeDetailSerializer(raw.store);
  if (!store) return null;
  const images = arr(raw.images).map(i => str(i)).filter(Boolean);
  const variants = compact(arr(raw.variants).map(variantSerializer));
  return {
    ...summary,
    imageUrl: summary.imageUrl ?? images[0] ?? null,
    description: str(raw.description),
    images: images.length ? images : summary.imageUrl ? [summary.imageUrl] : [],
    categoryId: str(raw.categoryId),
    collectionId: strOrNull(raw.collectionId),
    option1: optionSerializer(raw.option1),
    option2: optionSerializer(raw.option2),
    variants,
    inStock: variants.length ? variants.some(v => v.stock > 0) : summary.inStock,
    lowStock: bool(raw.lowStock),
    store,
    reviewSummary: reviewSummarySerializer(raw.reviewSummary),
    topReviews: compact(arr(raw.topReviews).map(reviewSerializer)),
    related: compact(arr(raw.related).map(productSummarySerializer)),
    wishlisted: bool(raw.wishlisted),
  };
});

const bannerTargetSerializer = (raw: unknown): BannerTarget | null => {
  if (!isObject(raw)) return null;
  const kind = oneOf(raw.kind, ['store', 'category', 'product'] as const, null);
  if (kind === 'store' && str(raw.slug)) return { kind, slug: str(raw.slug) };
  if (kind === 'category' && str(raw.id)) return { kind, id: str(raw.id), name: str(raw.name) };
  if (kind === 'product' && str(raw.id)) return { kind, id: str(raw.id) };
  return null;
};

export const bannerSerializer = (raw: unknown): Banner | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const imageUrl = str(raw.imageUrl);
  const target = bannerTargetSerializer(raw.target);
  if (!id || !imageUrl || !target) return null;
  return { id, imageUrl, headline: str(raw.headline), subhead: strOrNull(raw.subhead), target };
};

export const shopHomeSerializer = fromResponse((raw: unknown): ShopHome => {
  const r = isObject(raw) ? raw : {};
  return {
    banners: compact(arr(r.banners).map(bannerSerializer)),
    categories: compact(arr(r.categories).map(categorySerializer)),
    featuredStores: compact(arr(r.featuredStores).map(storeSummarySerializer)),
    newThisWeek: compact(arr(r.newThisWeek).map(productSummarySerializer)),
  };
});

export const suggestionSerializer = (raw: unknown): SearchSuggestion | null => {
  if (!isObject(raw)) return null;
  const label = str(raw.label);
  const kind = oneOf(raw.kind, ['product', 'store', 'category'] as const, 'product');
  if (!label) return null;
  return { kind, id: str(raw.id), label, query: str(raw.query, label) };
};

export { isoOrNull };

/** A page of productSummarys, as the API answers it. */
export const productSummaryPageSerializer = fromResponse(raw => paged(raw, productSummarySerializer));

/** A list of collections, as the API answers it. */
export const collectionListSerializer = fromResponse(raw => compact(arr(raw).map(collectionSerializer)));

/** A list of categorys, as the API answers it. */
export const categoryListSerializer = fromResponse(raw => compact(arr(raw).map(categorySerializer)));

/** A page of storeSummarys, as the API answers it. */
export const storeSummaryPageSerializer = fromResponse(raw => paged(raw, storeSummarySerializer));

/** A list of suggestions, as the API answers it. */
export const suggestionListSerializer = fromResponse(raw => compact(arr(raw).map(suggestionSerializer)));

/** GET /shop/wishlist/ids: every saved product id. */
export const wishlistIdsSerializer = fromResponse(raw => arr(raw).map(v => str(v)).filter(Boolean));

/** A page of a product's reviews, with the rating summary. */
export const productReviewsSerializer = fromResponse(raw => ({
      ...paged(raw, reviewSerializer),
      summary: reviewSummarySerializer(isObject(raw) ? raw.summary : null),
    }));
