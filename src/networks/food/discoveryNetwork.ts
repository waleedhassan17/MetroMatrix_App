// MetroMatrix — Food discovery: what a customer can order from where they
// are. Signed in or not (the home adds "order again" when signed in).
// docs/API_FOOD.md §4.1: /food/{home,vendors,vendors/:slug,items/:id,search}.

import { api } from '../network/apiHelpers';
import {
  foodHomeSerializer,
  foodSearchSerializer,
  itemSheetSerializer,
  vendorCardsPageSerializer,
  vendorPageSerializer,
} from '../../serializers/food/discoverySerializer';
import type { VendorListQuery } from '../../types/food';
import { request } from '../shopping/http';

const point = (lat: number, lng: number) => ({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

export const getFoodHome = (lat: number, lng: number) => request(() => api.get('/food/home', { params: point(lat, lng) }), foodHomeSerializer);

/** Vendors that deliver to the point (or, with `pickup`, that can be collected from), open ones first. */
export const listVendors = (q: VendorListQuery, page: number, pageSize: number) =>
  request(
    () =>
      api.get('/food/vendors', {
        params: {
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
        },
      }),
    vendorCardsPageSerializer,
  );

/** A vendor's page; with a point it carries the delivery fee, ETA and zone for it. */
export const getVendorPage = (slug: string, at: { lat: number; lng: number } | null) =>
  request(() => api.get(`/food/vendors/${encodeURIComponent(slug)}`, { params: at ? point(at.lat, at.lng) : undefined }), vendorPageSerializer);

export const getItemSheet = (id: string) => request(() => api.get(`/food/items/${encodeURIComponent(id)}`), itemSheetSerializer);

export const searchFood = (q: string, lat: number, lng: number) => request(() => api.get('/food/search', { params: { q, ...point(lat, lng) } }), foodSearchSerializer);
