// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth's reads, composed
// ═══════════════════════════════════════════════════════
// People read a dawat by its code (CT-…) and the API names it by id: the
// list finds the id. The kitchen's own read of one request adds the
// receipt's link, which its list leaves out. Answers stay raw: the slices'
// fulfilled reducers serialize them.

import { required } from '../../networks/network/network';
import { fetchCateringRequest, fetchCateringRequests, fetchMyCateringRequests } from '../../networks/foodGrowth/catering';
import { cateringRequestByCodeSerializer } from '../../serializers/kitchen/growthSerializer';

/** The kitchen's request with this code, read whole. */
export const fetchKitchenCateringByCode = async (code: string): Promise<unknown> =>
  fetchCateringRequest(required(cateringRequestByCodeSerializer(await fetchCateringRequests(), code)).id);

/** The id of the kitchen's request with this code. */
export const kitchenCateringId = async (code: string): Promise<string> => required(cateringRequestByCodeSerializer(await fetchCateringRequests(), code)).id;

/** The id of the customer's request with this code. */
export const myCateringId = async (code: string): Promise<string> => required(cateringRequestByCodeSerializer(await fetchMyCateringRequests(), code)).id;
