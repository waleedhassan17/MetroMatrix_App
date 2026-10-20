// MetroMatrix — Kitchen: what each dish holds, worked out from its recipe card
// and the nutrition foods its ingredients map to (or estimated from its name).
// docs/API_KITCHEN_ASSUMED.md §4.7 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { dishNutritionSerializer, nutritionFoodsSerializer, vendorNutritionSerializer } from '../../serializers/kitchen/assistantSerializer';
import { updateIngredient } from './stockNetwork';

export const getVendorNutrition = () => request(() => api.get('/food/vendor/nutrition'), vendorNutritionSerializer);

/** Hidden: customers don't see this dish's numbers. */
export const setNutritionHidden = (itemId: string, hidden: boolean) => request(() => api.patch(`/food/vendor/nutrition/${encodeURIComponent(itemId)}`, { hidden }), dishNutritionSerializer);

export const searchNutritionFoods = (q: string) => request(() => api.get('/food/vendor/kitchen/nutrition-foods', { params: { q: q.trim() } }), nutritionFoodsSerializer);

/** The ordinary ingredient edit. */
export const mapIngredientNutrition = (ingredientId: string, nutritionFoodId: string | null) => updateIngredient(ingredientId, { nutritionFoodId });
