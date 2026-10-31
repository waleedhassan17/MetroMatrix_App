// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Coupons Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Coupons.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../../network/network';
import type { CouponInput } from '../../../models/shopping';

const BASE = '/partner/shop/coupons';

export const fetchCoupons = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCoupon = async (input: CouponInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: BASE, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateCoupon = async (id: string, input: CouponInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCoupon = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
