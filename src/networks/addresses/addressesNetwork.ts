// MetroMatrix — Delivery addresses network (core: Shopping now, Food later).
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { addressSerializer } from '../../serializers/addressSerializer';
import { compact } from '../../serializers/shopping/common';
import { arr } from '../../serializers/serializerUtils';
import type { AddressInput } from '../../types/shopping';
import { ack, request } from '../shopping/http';

export const listAddresses = () => request(() => api.get('/addresses'), raw => compact(arr(raw).map(addressSerializer)));
export const createAddress = (input: AddressInput) => request(() => api.post('/addresses', input), addressSerializer);
export const updateAddress = (id: string, input: AddressInput) =>
  request(() => api.patch(`/addresses/${encodeURIComponent(id)}`, input), addressSerializer);
export const deleteAddress = (id: string) => request(() => api.delete(`/addresses/${encodeURIComponent(id)}`), ack);
export const setDefaultAddress = (id: string) =>
  request(() => api.post(`/addresses/${encodeURIComponent(id)}/default`), addressSerializer);
