// MetroMatrix — Store partner: insights (recorded from orders marked delivered).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { insightsSerializer } from '../../../serializers/shopping/partnerSerializer';
import type { InsightsRange } from '../../../types/shopping';
import { request } from '../http';

export const getInsights = (range: InsightsRange) =>
  request(() => api.get('/partner/shop/insights', { params: { range } }), insightsSerializer);
