// MetroMatrix — Food vendor: the go-live checklist and going live.
// TODO(API_FOOD): GET /food/vendor/setup, POST /food/vendor/go-live (422
// PROFILE_INCOMPLETE with details.missing, or FOOD_SAFETY_CHECK_REQUIRED for
// home kitchens until MetroMatrix's food-safety check).

import { api } from '../../network/apiHelpers';
import { vendorSetupSerializer } from '../../../serializers/food/vendorSerializer';
import { ack, request } from '../../shopping/http';

export const getVendorSetup = () => request(() => api.get('/food/vendor/setup'), vendorSetupSerializer);

export const goLive = () => request(() => api.post('/food/vendor/go-live'), ack);
