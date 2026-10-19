// MetroMatrix — Kitchen: waste, its summary, donations.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, pageParams, request } from '../shopping/http';
import { donationSerializer, donationsSerializer, wastePageSerializer, wasteSerializer, wasteSummarySerializer } from '../../serializers/kitchen/wasteSerializer';
import type { WasteLineInput } from '../../types/kitchen';

export const logWaste = (lines: WasteLineInput[], note?: string) => request(() => api.post('/food/vendor/kitchen/waste', clean({ lines, note })), wasteSerializer);

export const listWaste = (page: number, pageSize: number) => request(() => api.get('/food/vendor/kitchen/waste', { params: pageParams(page, pageSize) }), wastePageSerializer);

export const getWasteSummary = (range: '7d' | '30d') => request(() => api.get('/food/vendor/kitchen/waste/summary', { params: { range } }), wasteSummarySerializer);

export const listDonations = () => request(() => api.get('/food/vendor/kitchen/donations'), donationsSerializer);

export const logDonation = (input: { meals: number; to: string; note?: string }) => request(() => api.post('/food/vendor/kitchen/donations', clean(input)), donationSerializer);
