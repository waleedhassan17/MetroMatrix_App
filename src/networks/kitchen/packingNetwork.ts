// MetroMatrix — Kitchen: the board's packing photo and spoken announcement.
// docs/API_KITCHEN_ASSUMED.md §4.5, docs/VOICE_ASSUMED.md §5 (TODO(API_KITCHEN)).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { announcementSerializer, packingResultSerializer } from '../../serializers/kitchen/insightSerializer';

const enc = encodeURIComponent;

/** After the photo is uploaded (media purpose food_packing). */
export const attachPackingPhoto = (orderId: string, imageUrl: string) =>
  request(() => api.post(`/food/vendor/orders/${enc(orderId)}/packing-photo`, { imageUrl }), packingResultSerializer);

export const getAnnouncement = (orderId: string, language: 'ur' | 'en') =>
  request(() => api.get(`/food/vendor/orders/${enc(orderId)}/announcement`, { params: { language } }), announcementSerializer);
