// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Products Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// Products (a status is a field; publishing needs a photo), duplicate,
// delete, and the store's collections.

import { API, toApiError, clean, pageParams } from '../../network/network';
import type { PartnerProductInput, PartnerProductStatus } from '../../../models/shopping';

const BASE = '/shop/partner';

/**
 * The API keeps a base price and an optional sale price. Variants carry their
 * option values (option 1 is the size, option 2 the colour with its swatch).
 */
const productBody = (input: PartnerProductInput) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  collectionId: input.collectionId,
  basePrice: input.price,
  salePrice: input.salePrice,
  images: input.images.map(i => ({ url: i.url, publicId: i.publicId })),
  variants: input.variants.map(v => ({
    ...(v.id ? { id: v.id } : {}),
    option1: v.option1,
    option2: v.option2,
    colorHex: (v.option2 && input.option2?.swatches[v.option2]) || null,
    sku: v.sku.trim() || null,
    priceDelta: v.priceDelta,
    stock: v.stock,
  })),
  status: input.status,
});

export const fetchPartnerProducts = async (query: { status: PartnerProductStatus; q?: string; lowStock?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/products`, params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPartnerProduct = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/products/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPartnerProduct = async (input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/products`, data: productBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePartnerProduct = async (id: string, input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/products/${encodeURIComponent(id)}`, data: productBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setPartnerProductStatus = async (id: string, status: PartnerProductStatus): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/products/${encodeURIComponent(id)}`, data: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCollections = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/collections` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCollection = async (name: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/collections`, data: { name } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const renameCollection = async (id: string, name: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/collections/${encodeURIComponent(id)}`, data: { name } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCollection = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/collections/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const reorderCollections = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/collections/reorder`, data: { ids } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
