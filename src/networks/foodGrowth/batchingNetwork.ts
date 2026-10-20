// MetroMatrix — Food Court: orders that could ride with this one.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { batchSuggestionsSerializer } from '../../serializers/kitchen/reachSerializer';

export const getBatchSuggestions = (orderId: string) => request(() => api.get(`/food/vendor/orders/${encodeURIComponent(orderId)}/batch-suggestions`), batchSuggestionsSerializer);
