// MetroMatrix — Food vendor: the plan (always the free Community plan) and
// what it allows. TODO(API_FOOD): GET /food/vendor/plan.

import { api } from '../../network/apiHelpers';
import { vendorPlanSerializer } from '../../../serializers/food/vendorSerializer';
import { request } from '../../shopping/http';

export const getVendorPlan = () => request(() => api.get('/food/vendor/plan'), vendorPlanSerializer);
