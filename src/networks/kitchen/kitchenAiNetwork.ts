// MetroMatrix — Kitchen: the vendor's assistant (usage; drafts — receipt
// scan now, descriptions, specials, combos and photo checks in 5C).
// docs/AI_ASSUMED.md (TODO(API_AI): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { aiUsageSerializer, receiptDraftSerializer } from '../../serializers/kitchen/insightSerializer';

export const getAiUsage = () => request(() => api.get('/food/vendor/ai/usage'), aiUsageSerializer);

/** After the receipt photo is uploaded (media purpose kitchen_receipt). A draft: nothing is saved. */
export const scanReceipt = (imageUrl: string) => request(() => api.post('/food/vendor/ai/receipt-scan', { imageUrl }), receiptDraftSerializer);
