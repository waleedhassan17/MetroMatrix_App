// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Coupons Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The store's coupons. A code is fixed once made, and a coupon is turned
// off rather than deleted (orders keep pointing at it).

import { API, toApiError, pageParams } from '../../network/network';
import type { CouponInput } from '../../../models/shopping';

const BASE = '/shop/partner/coupons';

const couponBody = (input: CouponInput) => ({
  type: input.type,
  value: input.value,
  minOrder: input.minOrder ?? 0,
  maxDiscount: input.type === 'percent' ? input.maxDiscount : null,
  startsAt: input.startsAt,
  ...(input.endsAt ? { endsAt: input.endsAt } : {}),
  usageLimit: input.usageLimit,
  perUserLimit: input.perCustomerLimit ?? 1,
});

/** Every coupon on one page: a store keeps a handful. */
export const fetchCoupons = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: pageParams(1, 100) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCoupon = async (input: CouponInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: BASE, data: { code: input.code, ...couponBody(input) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateCoupon = async (id: string, input: CouponInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${encodeURIComponent(id)}`, data: { ...couponBody(input), isActive: input.isActive } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deactivateCoupon = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/${encodeURIComponent(id)}/deactivate` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
