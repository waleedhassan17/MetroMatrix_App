// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Experiments Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Menu insights, and testing one change to a dish.
// docs/API_KITCHEN_ASSUMED.md §2.13, §3.12 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { ExperimentInput } from '../../models/kitchen';

const enc = encodeURIComponent;

export const fetchMenuInsights = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/menu-insights' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchExperiments = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/experiments' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 EXPERIMENT_RUNNING`, `409 EXPERIMENT_LIMIT { max }`, `422 EXPERIMENT_NOT_SUPPORTED`. */
export const startExperiment = async (input: ExperimentInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/experiments', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchExperiment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/experiments/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type ExperimentDecision = { kind: 'keep' } | { kind: 'adjust'; price: number } | { kind: 'drop' } | { kind: 'stop' };

export const decideExperiment = async (id: string, d: ExperimentDecision): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/experiments/${enc(id)}/${d.kind}`, data: d.kind === 'adjust' ? { price: d.price } : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
