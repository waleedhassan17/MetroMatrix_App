// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Network (customer discovery)
// ═══════════════════════════════════════════════════════
// TODO(API_FOOD): assumed contract — docs/API_CONTRACT_ASSUMED.md "Food".

import { api, unwrap, toAuthError } from '../network/apiHelpers';
import { foodHomeSerializer } from '../../serializers/foodSerializer';
import type { FoodHome } from '../../types/food';

/** Promotions, cuisines and kitchens delivering to the customer's city. */
export const getFoodHome = async (city: string | null): Promise<FoodHome> => {
  try {
    const response = await api.get('/food/home', { params: city ? { city } : undefined });
    return foodHomeSerializer(unwrap(response));
  } catch (e) {
    throw toAuthError(e);
  }
};
