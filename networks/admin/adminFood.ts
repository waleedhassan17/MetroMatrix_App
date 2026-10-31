// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Food Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_FOOD.md §4.5. Every write is audited by the API.
// Orders are read-only here (disputes); food approvals stay in the Chunk 1
// queue (/admin/businesses).

import { API, toApiError, clean, pageParams } from '../network/network';
import type { AdminCuisineInput, AdminFoodBannerInput, AdminFoodOrderQuery, AdminFoodReviewQuery, AdminFoodVendorQuery, PlanOverrides } from '../../models/food';

const A = '/admin/food';
const enc = encodeURIComponent;

export const fetchFoodOverview = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/overview` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodVendors = async (query: AdminFoodVendorQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/vendors`, params: clean({ ...query, q: query.q?.trim(), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodVendor = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/vendors/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setVendorFeatured = async (id: string, featured: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/vendors/${enc(id)}/${featured ? 'feature' : 'unfeature'}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The business suspension: hidden at once; the owner and customers with an active order are told. */
export const setVendorSuspended = async (id: string, suspended: boolean, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/vendors/${enc(id)}/${suspended ? 'suspend' : 'reinstate'}`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminVendorPlan = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/vendors/${enc(id)}/plan` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Takes effect at once; riders beyond a lowered limit are locked out (one mid-delivery keeps the seat). null: back to the plan as it is. */
export const setVendorPlanOverrides = async (id: string, overrides: PlanOverrides | null): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/vendors/${enc(id)}/plan`, data: { overrides } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Home kitchens: required before they can go live. */
export const recordFoodSafetyCheck = async (branchId: string, outcome: 'passed' | 'failed', note: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/branches/${enc(branchId)}/food-safety-check`, data: { outcome, note: note.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodOrders = async (query: AdminFoodOrderQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/orders`, params: clean({ ...query, code: query.code?.trim().toUpperCase(), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodOrder = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/orders/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodReviews = async (query: AdminFoodReviewQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/reviews`, params: clean({ vendorId: query.vendorId, hidden: query.hidden === undefined ? undefined : String(query.hidden), maxRating: query.maxRating, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Hidden reviews leave every rating and list. */
export const setFoodReviewHidden = async (id: string, hidden: boolean, reason: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, data: hidden ? { reason: reason?.trim() } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminCuisines = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/cuisines` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createCuisine = async (input: AdminCuisineInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/cuisines`, data: { name: input.name.trim(), slug: input.slug, icon: input.icon || input.slug, sort: input.sort } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCuisine = async (id: string, input: Partial<AdminCuisineInput> & { isActive?: boolean }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/cuisines/${enc(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only a cuisine no vendor uses (409 CONFLICT otherwise: turn it off instead). */
export const deleteCuisine = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${A}/cuisines/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminFoodBanners = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/banners` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const bannerBody = (b: Partial<AdminFoodBannerInput>) => ({
  ...b,
  ...(b.targetType === 'search' ? { targetId: null } : b.targetType ? { targetQuery: null } : null),
});

export const createFoodBanner = async (input: AdminFoodBannerInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/banners`, data: bannerBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFoodBanner = async (id: string, input: Partial<AdminFoodBannerInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/banners/${enc(id)}`, data: bannerBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteFoodBanner = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${A}/banners/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
