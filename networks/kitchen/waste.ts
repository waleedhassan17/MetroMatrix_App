// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Waste Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Waste, its summary, donations.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean, pageParams } from '../network/network';
import type { WasteLineInput } from '../../models/kitchen';

export const logWaste = async (lines: WasteLineInput[], note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/waste', data: clean({ lines, note }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchWaste = async (page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/waste', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchWasteSummary = async (range: '7d' | '30d'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/waste/summary', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchDonations = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/donations' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const logDonation = async (input: { meals: number; to: string; note?: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/donations', data: clean(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
