// MetroMatrix — Food Court: menu insights, and testing one change to a dish.
// docs/API_KITCHEN_ASSUMED.md §2.13, §3.12 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { experimentSerializer, experimentsSerializer, menuInsightsSerializer } from '../../serializers/kitchen/reachSerializer';
import type { ExperimentInput } from '../../types/kitchen';

const enc = encodeURIComponent;

export const getMenuInsights = () => request(() => api.get('/food/vendor/menu-insights'), menuInsightsSerializer);

export const listExperiments = () => request(() => api.get('/food/vendor/experiments'), experimentsSerializer);

/** `409 EXPERIMENT_RUNNING`, `409 EXPERIMENT_LIMIT { max }`, `422 EXPERIMENT_NOT_SUPPORTED`. */
export const startExperiment = (input: ExperimentInput) => request(() => api.post('/food/vendor/experiments', input), experimentSerializer);

export const getExperiment = (id: string) => request(() => api.get(`/food/vendor/experiments/${enc(id)}`), experimentSerializer);

export type ExperimentDecision = { kind: 'keep' } | { kind: 'adjust'; price: number } | { kind: 'drop' } | { kind: 'stop' };

export const decideExperiment = (id: string, d: ExperimentDecision) =>
  request(() => api.post(`/food/vendor/experiments/${enc(id)}/${d.kind}`, d.kind === 'adjust' ? { price: d.price } : undefined), experimentSerializer);
