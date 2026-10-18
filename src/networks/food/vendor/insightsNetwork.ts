// MetroMatrix — Food vendor: the kitchen's numbers (recorded sales, never earnings).
// TODO(API_FOOD): GET /food/vendor/insights?range=today|7d|30d.

import { api } from '../../network/apiHelpers';
import { foodInsightsSerializer } from '../../../serializers/food/reviewSerializer';
import type { FoodInsightsRange } from '../../../types/food';
import { request } from '../../shopping/http';

export const getFoodInsights = (range: FoodInsightsRange) => request(() => api.get('/food/vendor/insights', { params: { range } }), foodInsightsSerializer);
