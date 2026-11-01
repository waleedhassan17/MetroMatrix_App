// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Packing Network (docs/API_KITCHEN.md §11, docs/VOICE.md)
// ═══════════════════════════════════════════════════════
// The board's packing photo and spoken announcement.

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;

/** After the photo is uploaded (media purpose packing_proof); the order must be accepted to ready. */
export const attachPackingPhoto = async (orderId: string, imageUrl: string, publicId?: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/kitchen/orders/${enc(orderId)}/packing-proof`, data: clean({ photoUrl: imageUrl, publicId }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A template-built announcement (no model): Urdu script, Roman Urdu or English. */
export const fetchAnnouncement = async (orderId: string, language: 'ur' | 'roman' | 'en'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/ai/announce', params: { orderId, lang: language } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
