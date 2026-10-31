// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Shop Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Overview, categories, banners, reports,
// order lookup, featured stores.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { AdminBannerInput, ReportStatus } from '../../models/shopping';

const BASE = '/admin/shop';

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
export const createCategory = async (input: { name: string; icon: string; parentId: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/categories`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateCategory = async (id: string, input: { name: string; icon: string }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/categories/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCategory = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/categories/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const reorderCategories = async (parentId: string | null, ids: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/categories/reorder`, data: { parentId, ids } });
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
    const response = await API.POST({ URL: `${BASE}/banners`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateBanner = async (id: string, input: AdminBannerInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/banners/${encodeURIComponent(id)}`, data: input });
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
    const response = await API.GET({ URL: `${BASE}/reports`, params: clean({ status, ...pageParams(page, pageSize) }) });
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
export const removeReportedProduct = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/reports/${encodeURIComponent(id)}/remove`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupOrder = async (groupCode: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/orders/${encodeURIComponent(groupCode.trim().toUpperCase())}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminStores = async (q: string, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/stores`, params: clean({ q, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setStoreFeatured = async (storeId: string, featured: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/stores/${encodeURIComponent(storeId)}/featured`, data: { featured } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
