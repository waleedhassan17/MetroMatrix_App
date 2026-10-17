// MetroMatrix — Food vendor: deals (automatic, or with a code). One per order:
// the best for the customer. TODO(API_FOOD): /food/vendor/promotions.

import { api } from '../../network/apiHelpers';
import { foodPromotionSerializer, foodPromotionsSerializer } from '../../../serializers/food/orderSerializer';
import type { PromotionInput } from '../../../types/food';
import { request } from '../../shopping/http';

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

export const listPromotions = () => request(() => api.get('/food/vendor/promotions', { params: { pageSize: 50 } }), foodPromotionsSerializer);
export const getPromotion = (id: string) => request(() => api.get(`/food/vendor/promotions/${enc(id)}`), foodPromotionSerializer);
export const createPromotion = (p: PromotionInput) => request(() => api.post('/food/vendor/promotions', body(p)), foodPromotionSerializer);
export const updatePromotion = (id: string, p: PromotionInput) => request(() => api.patch(`/food/vendor/promotions/${enc(id)}`, body(p)), foodPromotionSerializer);
export const deactivatePromotion = (id: string) => request(() => api.post(`/food/vendor/promotions/${enc(id)}/deactivate`), foodPromotionSerializer);
/** Unused promotions go; used ones are switched off instead. */
export const deletePromotion = (id: string) => request(() => api.delete(`/food/vendor/promotions/${enc(id)}`), () => true);
