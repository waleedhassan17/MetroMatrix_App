// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Promotions Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Deals (automatic, or with a code). One per order:
// the best for the customer. docs/API_FOOD.md §4.3 Promotions.

import { API, toApiError } from '../../network/network';
import type { PromotionInput } from '../../../models/food';

const enc = encodeURIComponent;

const body = (p: PromotionInput) => ({
  title: p.title,
  kind: p.kind,
  ...(p.kind !== 'free_delivery' ? { value: p.value } : null),
  itemIds: p.kind === 'percent_off_items' ? p.itemIds : [],
  minOrder: p.minOrder,
  maxDiscount: p.maxDiscount,
  code: p.code,
  endsAt: p.endsAt,
  weekdays: p.weekdays,
  timeFrom: p.timeFrom,
  timeTo: p.timeTo,
  usageLimit: p.usageLimit,
  perUserLimit: p.perUserLimit,
  firstOrderOnly: p.firstOrderOnly,
});

export const fetchPromotions = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/promotions', params: { pageSize: 50 } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const fetchPromotion = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/promotions/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPromotion = async (p: PromotionInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/promotions', data: body(p) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePromotion = async (id: string, p: PromotionInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/promotions/${enc(id)}`, data: body(p) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deactivatePromotion = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/promotions/${enc(id)}/deactivate` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** Unused promotions go; used ones are switched off instead. */
export const deletePromotion = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/promotions/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
