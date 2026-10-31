// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Promotions Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Deals (automatic, or with a code). One per order:
// the best for the customer. docs/API_FOOD.md §4.3 Promotions.

import { api, toApiError } from '../../network/apiHelpers';
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

export const getPromotionsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/promotions', { params: { pageSize: 50 } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const getPromotionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/promotions/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPromotionAPI = async (p: PromotionInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/promotions', body(p));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePromotionAPI = async (id: string, p: PromotionInput): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/promotions/${enc(id)}`, body(p));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deactivatePromotionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/promotions/${enc(id)}/deactivate`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
/** Unused promotions go; used ones are switched off instead. */
export const deletePromotionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/promotions/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
