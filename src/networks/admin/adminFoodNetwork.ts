// MetroMatrix — Admin Food console.
// MetroMatrix-API docs/API_FOOD.md §4.5. Every write is audited by the API.
// Orders are read-only here (disputes); food approvals stay in the Chunk 1
// queue (/admin/businesses).

import { api } from '../network/apiHelpers';
import {
  adminCuisineSerializer,
  adminCuisinesSerializer,
  adminFeaturedSerializer,
  adminFoodBannerSerializer,
  adminFoodBannersSerializer,
  adminFoodOrderSerializer,
  adminFoodOrdersPageSerializer,
  adminFoodOverviewSerializer,
  adminFoodReviewsPageSerializer,
  adminFoodVendorSerializer,
  adminFoodVendorsPageSerializer,
  adminHiddenSerializer,
  adminSuspensionSerializer,
} from '../../serializers/food/adminFoodSerializer';
import { vendorPlanSerializer } from '../../serializers/food/vendorSerializer';
import { isObject, str } from '../../serializers/serializerUtils';
import type { AdminCuisineInput, AdminFoodBannerInput, AdminFoodOrderQuery, AdminFoodReviewQuery, AdminFoodVendorQuery, PlanOverrides } from '../../types/food';
import { ack, clean, pageParams, request } from '../shopping/http';

const A = '/admin/food';
const enc = encodeURIComponent;

export const getFoodOverview = () => request(() => api.get(`${A}/overview`), adminFoodOverviewSerializer);

export const listAdminFoodVendors = (query: AdminFoodVendorQuery, page: number, pageSize: number) =>
  request(() => api.get(`${A}/vendors`, { params: clean({ ...query, q: query.q?.trim(), ...pageParams(page, pageSize) }) }), adminFoodVendorsPageSerializer);

export const getAdminFoodVendor = (id: string) => request(() => api.get(`${A}/vendors/${enc(id)}`), adminFoodVendorSerializer);

export const setVendorFeatured = (id: string, featured: boolean) =>
  request(() => api.post(`${A}/vendors/${enc(id)}/${featured ? 'feature' : 'unfeature'}`), adminFeaturedSerializer);

/** The business suspension: hidden at once; the owner and customers with an active order are told. */
export const setVendorSuspended = (id: string, suspended: boolean, reason: string) =>
  request(() => api.post(`${A}/vendors/${enc(id)}/${suspended ? 'suspend' : 'reinstate'}`, { reason: reason.trim() }), adminSuspensionSerializer);

export const getAdminVendorPlan = (id: string) => request(() => api.get(`${A}/vendors/${enc(id)}/plan`), vendorPlanSerializer);

/** Takes effect at once; riders beyond a lowered limit are locked out (one mid-delivery keeps the seat). null: back to the plan as it is. */
export const setVendorPlanOverrides = (id: string, overrides: PlanOverrides | null) =>
  request(() => api.patch(`${A}/vendors/${enc(id)}/plan`, { overrides }), vendorPlanSerializer);

/** Home kitchens: required before they can go live. */
export const recordFoodSafetyCheck = (branchId: string, outcome: 'passed' | 'failed', note: string) =>
  request(() => api.post(`${A}/branches/${enc(branchId)}/food-safety-check`, { outcome, note: note.trim() }), raw => (isObject(raw) && str(raw.outcome) ? str(raw.outcome) : null));

export const listAdminFoodOrders = (query: AdminFoodOrderQuery, page: number, pageSize: number) =>
  request(() => api.get(`${A}/orders`, { params: clean({ ...query, code: query.code?.trim().toUpperCase(), ...pageParams(page, pageSize) }) }), adminFoodOrdersPageSerializer);

export const getAdminFoodOrder = (id: string) => request(() => api.get(`${A}/orders/${enc(id)}`), adminFoodOrderSerializer);

export const listAdminFoodReviews = (query: AdminFoodReviewQuery, page: number, pageSize: number) =>
  request(
    () =>
      api.get(`${A}/reviews`, {
        params: clean({ vendorId: query.vendorId, hidden: query.hidden === undefined ? undefined : String(query.hidden), maxRating: query.maxRating, ...pageParams(page, pageSize) }),
      }),
    adminFoodReviewsPageSerializer,
  );

/** Hidden reviews leave every rating and list. */
export const setFoodReviewHidden = (id: string, hidden: boolean, reason: string | null) =>
  request(() => api.post(`${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, hidden ? { reason: reason?.trim() } : {}), adminHiddenSerializer);

export const listAdminCuisines = () => request(() => api.get(`${A}/cuisines`), adminCuisinesSerializer);

export const createCuisine = (input: AdminCuisineInput) =>
  request(() => api.post(`${A}/cuisines`, { name: input.name.trim(), slug: input.slug, icon: input.icon || input.slug, sort: input.sort }), adminCuisineSerializer);

export const updateCuisine = (id: string, input: Partial<AdminCuisineInput> & { isActive?: boolean }) =>
  request(() => api.patch(`${A}/cuisines/${enc(id)}`, input), adminCuisineSerializer);

/** Only a cuisine no vendor uses (409 CONFLICT otherwise: turn it off instead). */
export const deleteCuisine = (id: string) => request(() => api.delete(`${A}/cuisines/${enc(id)}`), ack);

export const listAdminFoodBanners = () => request(() => api.get(`${A}/banners`), adminFoodBannersSerializer);

const bannerBody = (b: Partial<AdminFoodBannerInput>) => ({
  ...b,
  ...(b.targetType === 'search' ? { targetId: null } : b.targetType ? { targetQuery: null } : null),
});

export const createFoodBanner = (input: AdminFoodBannerInput) => request(() => api.post(`${A}/banners`, bannerBody(input)), adminFoodBannerSerializer);

export const updateFoodBanner = (id: string, input: Partial<AdminFoodBannerInput>) =>
  request(() => api.patch(`${A}/banners/${enc(id)}`, bannerBody(input)), adminFoodBannerSerializer);

export const deleteFoodBanner = (id: string) => request(() => api.delete(`${A}/banners/${enc(id)}`), ack);
