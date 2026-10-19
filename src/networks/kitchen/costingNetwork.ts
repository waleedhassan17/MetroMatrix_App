// MetroMatrix — Kitchen: the settings costs and the board read (target food
// cost, selling a dish out by stock, the packing photo rule).
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { kitchenSettingsSerializer } from '../../serializers/kitchen/recipeSerializer';
import { boardHintsSerializer } from '../../serializers/kitchen/insightSerializer';
import type { KitchenSettings } from '../../types/kitchen';

export const getKitchenSettings = () => request(() => api.get('/food/vendor/kitchen/settings'), kitchenSettingsSerializer);

export const updateKitchenSettings = (patch: Partial<KitchenSettings>) => request(() => api.patch('/food/vendor/kitchen/settings', patch), kitchenSettingsSerializer);

/** The board's kitchen side: dishes low on stock or sold out by it, and the usual prep time now. */
export const getBoardHints = () => request(() => api.get('/food/vendor/kitchen/board'), boardHintsSerializer);
