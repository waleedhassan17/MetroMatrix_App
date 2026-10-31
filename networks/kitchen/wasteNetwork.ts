// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Waste Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Waste, its summary, donations.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import type { WasteLineInput } from '../../models/kitchen';

export const logWasteAPI = async (lines: WasteLineInput[], note?: string): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/waste', clean({ lines, note }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getWasteAPI = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/waste', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getWasteSummaryAPI = async (range: '7d' | '30d'): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/waste/summary', { params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getDonationsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/donations');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const logDonationAPI = async (input: { meals: number; to: string; note?: string }): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/donations', clean(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
