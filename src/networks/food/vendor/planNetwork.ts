// MetroMatrix — Food vendor: the plan (always the free Community plan) and
// what it allows. docs/API_FOOD.md §4.3 Plan.

import { api } from '../../network/apiHelpers';
import { vendorPlanSerializer } from '../../../serializers/food/vendorSerializer';
import { request } from '../../shopping/http';

export const getVendorPlan = () => request(() => api.get('/food/vendor/plan'), vendorPlanSerializer);
