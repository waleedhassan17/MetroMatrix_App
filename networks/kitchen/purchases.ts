// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Purchases Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Purchases, suppliers, the price watch.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean, pageParams } from '../network/network';
import type { PurchaseInput } from '../../models/kitchen';

const enc = encodeURIComponent;

export const fetchPurchases = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/purchases', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPurchase = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/purchases/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createPurchase = async (input: PurchaseInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/purchases', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchSuppliers = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/suppliers' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createSupplier = async (input: { name: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/suppliers', data: clean(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateSupplier = async (id: string, patch: { name?: string; phone?: string | null; note?: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/suppliers/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteSupplier = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/suppliers/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPriceWatch = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/price-watch' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

