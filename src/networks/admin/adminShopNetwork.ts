// MetroMatrix — Admin (Shopping): overview, categories, banners, reports,
// order lookup, featured stores.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import {
  adminBannerSerializer,
  orderLookupSerializer,
  productReportSerializer,
  shopOverviewSerializer,
} from '../../serializers/shopping/adminShopSerializer';
import { categorySerializer, storeSummarySerializer } from '../../serializers/shopping/catalogSerializer';
import { compact, paged } from '../../serializers/shopping/common';
import { arr } from '../../serializers/serializerUtils';
import type { AdminBannerInput, ReportStatus } from '../../types/shopping';
import { ack, clean, pageParams, request } from '../shopping/http';

const BASE = '/admin/shop';

export const getShopOverview = () => request(() => api.get(`${BASE}/overview`), shopOverviewSerializer);

export const listAdminCategories = () =>
  request(() => api.get(`${BASE}/categories`), raw => compact(arr(raw).map(categorySerializer)));
export const createCategory = (input: { name: string; icon: string; parentId: string | null }) =>
  request(() => api.post(`${BASE}/categories`, input), categorySerializer);
export const updateCategory = (id: string, input: { name: string; icon: string }) =>
  request(() => api.patch(`${BASE}/categories/${encodeURIComponent(id)}`, input), categorySerializer);
export const deleteCategory = (id: string) =>
  request(() => api.delete(`${BASE}/categories/${encodeURIComponent(id)}`), ack);
export const reorderCategories = (parentId: string | null, ids: string[]) =>
  request(() => api.post(`${BASE}/categories/reorder`, { parentId, ids }), raw => compact(arr(raw).map(categorySerializer)));

export const listAdminBanners = () =>
  request(() => api.get(`${BASE}/banners`), raw => compact(arr(raw).map(adminBannerSerializer)));
export const createBanner = (input: AdminBannerInput) => request(() => api.post(`${BASE}/banners`, input), adminBannerSerializer);
export const updateBanner = (id: string, input: AdminBannerInput) =>
  request(() => api.patch(`${BASE}/banners/${encodeURIComponent(id)}`, input), adminBannerSerializer);
export const deleteBanner = (id: string) => request(() => api.delete(`${BASE}/banners/${encodeURIComponent(id)}`), ack);

export const listReports = (status: ReportStatus, page: number, pageSize = 20) =>
  request(() => api.get(`${BASE}/reports`, { params: clean({ status, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, productReportSerializer),
  );
export const dismissReport = (id: string) =>
  request(() => api.post(`${BASE}/reports/${encodeURIComponent(id)}/dismiss`), productReportSerializer);
export const removeReportedProduct = (id: string, reason: string) =>
  request(() => api.post(`${BASE}/reports/${encodeURIComponent(id)}/remove`, { reason }), productReportSerializer);

export const lookupOrder = (groupCode: string) =>
  request(() => api.get(`${BASE}/orders/${encodeURIComponent(groupCode.trim().toUpperCase())}`), orderLookupSerializer);

export const listAdminStores = (q: string, page: number, pageSize = 20) =>
  request(() => api.get(`${BASE}/stores`, { params: clean({ q, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, storeSummarySerializer),
  );
export const setStoreFeatured = (storeId: string, featured: boolean) =>
  request(() => api.post(`${BASE}/stores/${encodeURIComponent(storeId)}/featured`, { featured }), storeSummarySerializer);
