// ═══════════════════════════════════════════════════════
// MetroMatrix — Addresses Network (Production API)
// ═══════════════════════════════════════════════════════
// Shopping now, Food later).
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../network/apiHelpers';
import type { AddressInput } from '../../models/shopping';

export const getAddressesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/addresses');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createAddressAPI = async (input: AddressInput): Promise<unknown> => {
  try {
    const response = await api.post('/addresses', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateAddressAPI = async (id: string, input: AddressInput): Promise<unknown> => {
  try {
    const response = await api.patch(`/addresses/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteAddressAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/addresses/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setDefaultAddressAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/addresses/${encodeURIComponent(id)}/default`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
