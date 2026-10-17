// MetroMatrix — the rider's app: who they are and whom they deliver for.
// TODO(API_FOOD): GET /food/rider/me; duty, deliveries, location and cash
// arrive with the API's rider phase.

import { api } from '../../network/apiHelpers';
import { riderHomeSerializer } from '../../../serializers/food/riderSerializer';
import { request } from '../../shopping/http';

export const getRiderHome = () => request(() => api.get('/food/rider/me'), riderHomeSerializer);
