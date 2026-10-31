// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Experiments Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Menu insights, and testing one change to a dish.
// docs/API_KITCHEN_ASSUMED.md §2.13, §3.12 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';
import type { ExperimentInput } from '../../types/kitchen';

const enc = encodeURIComponent;

export const getMenuInsightsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/menu-insights');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getExperimentsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/experiments');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 EXPERIMENT_RUNNING`, `409 EXPERIMENT_LIMIT { max }`, `422 EXPERIMENT_NOT_SUPPORTED`. */
export const startExperimentAPI = async (input: ExperimentInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/experiments', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getExperimentAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/experiments/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type ExperimentDecision = { kind: 'keep' } | { kind: 'adjust'; price: number } | { kind: 'drop' } | { kind: 'stop' };

export const decideExperimentAPI = async (id: string, d: ExperimentDecision): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/experiments/${enc(id)}/${d.kind}`, d.kind === 'adjust' ? { price: d.price } : undefined);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
