// MetroMatrix — Store partner: coupons.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { compact } from '../../../serializers/shopping/common';
import { couponSerializer } from '../../../serializers/shopping/partnerSerializer';
import { arr } from '../../../serializers/serializerUtils';
import type { CouponInput } from '../../../types/shopping';
import { ack, request } from '../http';

const BASE = '/partner/shop/coupons';

export const listCoupons = () => request(() => api.get(BASE), raw => compact(arr(raw).map(couponSerializer)));
export const createCoupon = (input: CouponInput) => request(() => api.post(BASE, input), couponSerializer);
export const updateCoupon = (id: string, input: CouponInput) =>
  request(() => api.patch(`${BASE}/${encodeURIComponent(id)}`, input), couponSerializer);
export const deleteCoupon = (id: string) => request(() => api.delete(`${BASE}/${encodeURIComponent(id)}`), ack);
