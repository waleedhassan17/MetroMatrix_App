// MetroMatrix — Food Court: what people nearby search for, and don't find.
// docs/API_KITCHEN_ASSUMED.md §2.12, §3.12 (TODO(API_KITCHEN): an assumed contract). Anonymous:
// cells with fewer than `minCount` searches are never sent.

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { demandMapSerializer } from '../../serializers/kitchen/reachSerializer';

export const getDemand = (filter: { cuisine?: string | null; hour?: number | null } = {}) =>
  request(() => api.get('/food/vendor/demand', { params: clean({ cuisine: filter.cuisine, hour: filter.hour ?? undefined }) }), demandMapSerializer);
