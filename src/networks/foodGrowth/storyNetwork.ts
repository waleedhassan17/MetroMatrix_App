// MetroMatrix — Food Court: the kitchen's story, and its hygiene checklist.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { hygieneSerializer, storySerializer } from '../../serializers/kitchen/reachSerializer';

const enc = encodeURIComponent;

export const getStory = () => request(() => api.get('/food/vendor/story'), storySerializer);

export const saveStory = (input: { text: string; cookName: string; photoUrls: string[]; videoUrl: string | null }) =>
  request(() => api.put('/food/vendor/story', input), storySerializer);

export const getHygiene = () => request(() => api.get('/food/vendor/hygiene'), hygieneSerializer);

export const setHygieneItem = (key: string, input: { done: boolean; evidenceUrl?: string | null }) =>
  request(() => api.put(`/food/vendor/hygiene/items/${enc(key)}`, input), hygieneSerializer);

/** `422 HYGIENE_INCOMPLETE { missing }` until every item is ticked. */
export const requestHygieneVerification = () => request(() => api.post('/food/vendor/hygiene/request-verification'), hygieneSerializer);
