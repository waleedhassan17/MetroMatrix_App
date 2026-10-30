// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Packing Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The board's packing photo and spoken announcement.
// docs/API_KITCHEN_ASSUMED.md §4.5, docs/VOICE_ASSUMED.md §5 (TODO(API_KITCHEN)).

import { api, toApiError } from '../network/apiHelpers';

const enc = encodeURIComponent;

/** After the photo is uploaded (media purpose food_packing). */
export const attachPackingPhotoAPI = async (orderId: string, imageUrl: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/orders/${enc(orderId)}/packing-photo`, { imageUrl });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAnnouncementAPI = async (orderId: string, language: 'ur' | 'en'): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/orders/${enc(orderId)}/announcement`, { params: { language } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
