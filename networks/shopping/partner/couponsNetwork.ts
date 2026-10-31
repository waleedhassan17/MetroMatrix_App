// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Coupons Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Coupons.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../../network/apiHelpers';
import type { CouponInput } from '../../../models/shopping';

const BASE = '/partner/shop/coupons';

export const getCouponsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(BASE);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCouponAPI = async (input: CouponInput): Promise<unknown> => {
  try {
    const response = await api.post(BASE, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateCouponAPI = async (id: string, input: CouponInput): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCouponAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${BASE}/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
