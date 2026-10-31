// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Story Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The kitchen's story, and its hygiene checklist.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';

const enc = encodeURIComponent;

export const getStoryAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/story');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveStoryAPI = async (input: { text: string; cookName: string; photoUrls: string[]; videoUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/story', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getHygieneAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/hygiene');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setHygieneItemAPI = async (key: string, input: { done: boolean; evidenceUrl?: string | null }): Promise<unknown> => {
  try {
    const response = await api.put(`/food/vendor/hygiene/items/${enc(key)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `422 HYGIENE_INCOMPLETE { missing }` until every item is ticked. */
export const requestHygieneVerificationAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/hygiene/request-verification');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
