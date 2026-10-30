// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Food Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_FOOD.md §4.5. Every write is audited by the API.
// Orders are read-only here (disputes); food approvals stay in the Chunk 1
// queue (/admin/businesses).

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import type { AdminCuisineInput, AdminFoodBannerInput, AdminFoodOrderQuery, AdminFoodReviewQuery, AdminFoodVendorQuery, PlanOverrides } from '../../types/food';

const A = '/admin/food';
const enc = encodeURIComponent;

export const getFoodOverviewAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/overview`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodVendorsAPI = async (query: AdminFoodVendorQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/vendors`, { params: clean({ ...query, q: query.q?.trim(), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodVendorAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/vendors/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setVendorFeaturedAPI = async (id: string, featured: boolean): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/vendors/${enc(id)}/${featured ? 'feature' : 'unfeature'}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The business suspension: hidden at once; the owner and customers with an active order are told. */
export const setVendorSuspendedAPI = async (id: string, suspended: boolean, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/vendors/${enc(id)}/${suspended ? 'suspend' : 'reinstate'}`, { reason: reason.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminVendorPlanAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/vendors/${enc(id)}/plan`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Takes effect at once; riders beyond a lowered limit are locked out (one mid-delivery keeps the seat). null: back to the plan as it is. */
export const setVendorPlanOverridesAPI = async (id: string, overrides: PlanOverrides | null): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/vendors/${enc(id)}/plan`, { overrides });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Home kitchens: required before they can go live. */
export const recordFoodSafetyCheckAPI = async (branchId: string, outcome: 'passed' | 'failed', note: string): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/branches/${enc(branchId)}/food-safety-check`, { outcome, note: note.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodOrdersAPI = async (query: AdminFoodOrderQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/orders`, { params: clean({ ...query, code: query.code?.trim().toUpperCase(), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodOrderAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/orders/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodReviewsAPI = async (query: AdminFoodReviewQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/reviews`, {
        params: clean({ vendorId: query.vendorId, hidden: query.hidden === undefined ? undefined : String(query.hidden), maxRating: query.maxRating, ...pageParams(page, pageSize) }),
      });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Hidden reviews leave every rating and list. */
export const setFoodReviewHiddenAPI = async (id: string, hidden: boolean, reason: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, hidden ? { reason: reason?.trim() } : {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminCuisinesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/cuisines`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createCuisineAPI = async (input: AdminCuisineInput): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/cuisines`, { name: input.name.trim(), slug: input.slug, icon: input.icon || input.slug, sort: input.sort });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCuisineAPI = async (id: string, input: Partial<AdminCuisineInput> & { isActive?: boolean }): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/cuisines/${enc(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only a cuisine no vendor uses (409 CONFLICT otherwise: turn it off instead). */
export const deleteCuisineAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${A}/cuisines/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminFoodBannersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/banners`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const bannerBody = (b: Partial<AdminFoodBannerInput>) => ({
  ...b,
  ...(b.targetType === 'search' ? { targetId: null } : b.targetType ? { targetQuery: null } : null),
});

export const createFoodBannerAPI = async (input: AdminFoodBannerInput): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/banners`, bannerBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFoodBannerAPI = async (id: string, input: Partial<AdminFoodBannerInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/banners/${enc(id)}`, bannerBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteFoodBannerAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${A}/banners/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
