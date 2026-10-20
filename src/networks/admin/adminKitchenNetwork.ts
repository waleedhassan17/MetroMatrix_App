// MetroMatrix — the staff console: Kitchen Intelligence (/admin/kitchen).
// docs/API_KITCHEN_ASSUMED.md §4.8 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { hygieneQueueSerializer, hygieneSerializer } from '../../serializers/kitchen/reachSerializer';

const enc = encodeURIComponent;

export const listHygieneQueue = (status: 'pending' | 'verified' | 'rejected' = 'pending') => request(() => api.get('/admin/kitchen/hygiene', { params: { status } }), hygieneQueueSerializer);

export const verifyHygiene = (businessId: string, note?: string) => request(() => api.post(`/admin/kitchen/hygiene/${enc(businessId)}/verify`, clean({ note })), hygieneSerializer);

export const rejectHygiene = (businessId: string, note: string) => request(() => api.post(`/admin/kitchen/hygiene/${enc(businessId)}/reject`, { note: note.trim() }), hygieneSerializer);
