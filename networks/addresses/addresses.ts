// ═══════════════════════════════════════════════════════
// MetroMatrix — Addresses Network (Production API)
// ═══════════════════════════════════════════════════════
// Shopping now, Food later).
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../network/network';
import type { AddressInput } from '../../models/shopping';

export const fetchAddresses = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/addresses' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createAddress = async (input: AddressInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/addresses', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateAddress = async (id: string, input: AddressInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/addresses/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteAddress = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/addresses/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setDefaultAddress = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/addresses/${encodeURIComponent(id)}/default` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
