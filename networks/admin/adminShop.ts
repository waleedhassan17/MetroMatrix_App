// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Shop Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The overview, categories (and their order), banners, reports (a removal
// is by product), the order lookup, the store list and featured stores.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { AdminBannerInput, ReportStatus } from '../../models/shopping';

const BASE = '/admin/shop';

/** A banner leads to a store, category, collection or product by its id, or nowhere. */
const bannerBody = (input: AdminBannerInput) => ({
  imageUrl: input.imageUrl,
  title: input.headline.trim(),
  subtitle: input.subhead?.trim() || null,
  targetType: input.target.kind,
  targetId: input.target.kind === 'none' ? null : input.target.kind === 'store' ? (input.target.id ?? null) : input.target.id,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  sort: input.position,
  isActive: input.isActive,
});

/** The app's "removed" is the API's "actioned". */
const REPORT_STATUS: Record<ReportStatus, string> = { open: 'open', dismissed: 'dismissed', removed: 'actioned' };

export const fetchShopOverview = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/overview` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminCategories = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/categories` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCategory = async (input: { name: string; icon: string; parentId: string | null; sort?: number }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/categories`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** A rename, an icon, a place in the order (`sort`), or switching it off. */
export const updateCategory = async (id: string, input: { name?: string; icon?: string; sort?: number; isActive?: boolean }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/categories/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** One set of siblings (the top level, or one parent's children) in a new order; the rest follow. */
export const reorderCategories = async (parentId: string | null, ids: string[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${BASE}/categories/order`, data: { parentId, ids } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only an unused leaf can go; anything in use is switched off instead. */
export const deleteCategory = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/categories/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminBanners = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/banners` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createBanner = async (input: AdminBannerInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/banners`, data: bannerBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateBanner = async (id: string, input: AdminBannerInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/banners/${encodeURIComponent(id)}`, data: bannerBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteBanner = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/banners/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReports = async (status: ReportStatus, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/reports`, params: clean({ status: REPORT_STATUS[status], ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const dismissReport = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/reports/${encodeURIComponent(id)}/dismiss` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** Hidden everywhere; its open reports are actioned and the store is told why. */
export const removeProduct = async (productId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/products/${encodeURIComponent(productId)}/remove`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** Store orders whose code starts with `code` (a group's code finds each of its store orders). */
export const fetchAdminOrders = async (query: { code?: string; status?: string }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/orders`, params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const fetchAdminOrder = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/orders/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every store for staff, paused and suspended too; featured first. */
export const fetchAdminStores = async (q: string, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/stores`, params: clean({ q: q || undefined, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setStoreFeatured = async (storeId: string, featured: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/stores/${encodeURIComponent(storeId)}/${featured ? 'feature' : 'unfeature'}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
