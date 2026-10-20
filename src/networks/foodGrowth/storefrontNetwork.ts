// MetroMatrix — Food Court: the kitchen's own link and QR, and the orders they brought.
// docs/API_KITCHEN_ASSUMED.md §2.12 (TODO(API_KITCHEN): an assumed contract). The public page
// itself is the ordinary vendor page (`GET /food/vendors/:slug`).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { storefrontSerializer } from '../../serializers/kitchen/reachSerializer';

export const getStorefront = () => request(() => api.get('/food/vendor/storefront'), storefrontSerializer);
