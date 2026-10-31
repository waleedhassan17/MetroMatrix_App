// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Purchases Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Purchases, suppliers, the price watch.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import type { PurchaseInput } from '../../models/kitchen';

const enc = encodeURIComponent;

export const getPurchasesAPI = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/purchases', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPurchaseAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/kitchen/purchases/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createPurchaseAPI = async (input: PurchaseInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/purchases', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getSuppliersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/suppliers');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createSupplierAPI = async (input: { name: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/suppliers', clean(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateSupplierAPI = async (id: string, patch: { name?: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/kitchen/suppliers/${enc(id)}`, patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteSupplierAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/kitchen/suppliers/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPriceWatchAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/price-watch');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

