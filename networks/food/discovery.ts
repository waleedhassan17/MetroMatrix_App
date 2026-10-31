// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Discovery Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// What a customer can order from where they
// are. Signed in or not (the home adds "order again" when signed in).
// docs/API_FOOD.md §4.1: /food/{home,vendors,vendors/:slug,items/:id,search}.

import { API, toApiError } from '../network/network';
import type { VendorListQuery } from '../../models/food';

const point = (lat: number, lng: number) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

export const fetchFoodHome = async (lat: number, lng: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/home', params: point(lat, lng) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Vendors that deliver to the point (or, with `pickup`, that can be collected from), open ones first. */
export const fetchVendors = async (q: VendorListQuery, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendors', params: {
          ...point(q.lat, q.lng),
          ...(q.q ? { q: q.q } : null),
          ...(q.cuisine ? { cuisine: q.cuisine } : null),
          ...(q.sort ? { sort: q.sort } : null),
          ...(q.freeDelivery ? { freeDelivery: 'true' } : null),
          ...(q.offers ? { offers: 'true' } : null),
          ...(q.minRating ? { minRating: q.minRating } : null),
          ...(q.pickup ? { pickup: 'true' } : null),
          ...(q.homeKitchen ? { homeKitchen: 'true' } : null),
          ...(q.openNow ? { openNow: 'true' } : null),
          ...(q.priceLevel ? { priceLevel: q.priceLevel } : null),
          page,
          pageSize,
        } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A vendor's page; with a point it carries the delivery fee, ETA and zone for it. */
export const fetchVendorPage = async (slug: string, at: { lat: number; lng: number } | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendors/${encodeURIComponent(slug)}`, params: at ? point(at.lat, at.lng) : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchItemSheet = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/items/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `nutrition`: only dishes under 600 kcal or high in protein (Kitchen Intelligence, TODO(API_KITCHEN)). */
export const searchFood = async (q: string, lat: number, lng: number, nutrition?: 'under_600' | 'high_protein' | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/search', params: { q, ...point(lat, lng), ...(nutrition ? { nutrition } : null) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
