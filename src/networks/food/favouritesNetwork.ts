// MetroMatrix — Food Court: the customer's saved kitchens.
// docs/API_FOOD.md §4.2: GET /food/favourites, POST/DELETE /food/favourites/:vendorId.

import { api } from '../network/apiHelpers';
import { foodFavouritesSerializer, unfavouritedSerializer } from '../../serializers/food/favouriteSerializer';
import { isObject } from '../../serializers/serializerUtils';
import { request } from '../shopping/http';

const enc = encodeURIComponent;
const saved = (raw: unknown) => (isObject(raw) ? raw.favourite === true : null);

export const listFavourites = () => request(() => api.get('/food/favourites'), foodFavouritesSerializer);
export const addFavourite = (vendorId: string) => request(() => api.post(`/food/favourites/${enc(vendorId)}`), saved);
export const removeFavourite = (vendorId: string) => request(() => api.delete(`/food/favourites/${enc(vendorId)}`), unfavouritedSerializer);
