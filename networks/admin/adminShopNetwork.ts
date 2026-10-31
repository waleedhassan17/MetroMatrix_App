// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Shop Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Overview, categories, banners, reports,
// order lookup, featured stores.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import type { AdminBannerInput, ReportStatus } from '../../types/shopping';

const BASE = '/admin/shop';

export const getShopOverviewAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/overview`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminCategoriesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/categories`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCategoryAPI = async (input: { name: string; icon: string; parentId: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/categories`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateCategoryAPI = async (id: string, input: { name: string; icon: string }): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/categories/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCategoryAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${BASE}/categories/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const reorderCategoriesAPI = async (parentId: string | null, ids: string[]): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/categories/reorder`, { parentId, ids });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminBannersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/banners`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createBannerAPI = async (input: AdminBannerInput): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/banners`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateBannerAPI = async (id: string, input: AdminBannerInput): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/banners/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteBannerAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${BASE}/banners/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getReportsAPI = async (status: ReportStatus, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/reports`, { params: clean({ status, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const dismissReportAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/reports/${encodeURIComponent(id)}/dismiss`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const removeReportedProductAPI = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/reports/${encodeURIComponent(id)}/remove`, { reason });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupOrderAPI = async (groupCode: string): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/orders/${encodeURIComponent(groupCode.trim().toUpperCase())}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminStoresAPI = async (q: string, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/stores`, { params: clean({ q, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setStoreFeaturedAPI = async (storeId: string, featured: boolean): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/stores/${encodeURIComponent(storeId)}/featured`, { featured });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
