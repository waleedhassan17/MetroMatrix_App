// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Story Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The kitchen's story, and its hygiene checklist.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';

const enc = encodeURIComponent;

export const fetchStory = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/story' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveStory = async (input: { text: string; cookName: string; photoUrls: string[]; videoUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/story', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchHygiene = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/hygiene' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setHygieneItem = async (key: string, input: { done: boolean; evidenceUrl?: string | null }): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/hygiene/items/${enc(key)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `422 HYGIENE_INCOMPLETE { missing }` until every item is ticked. */
export const requestHygieneVerification = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/hygiene/request-verification' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
