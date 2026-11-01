// ═══════════════════════════════════════════════════════
// MetroMatrix — Menu Insights and Experiments Network (docs/API_KITCHEN.md §26)
// ═══════════════════════════════════════════════════════
// The menu-engineering matrix, and dishes on trial. A trial measures a dish
// over its days; the change being tried (a price, a photo) is an ordinary
// menu edit, made first.

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;
const BASE = '/food/vendor/kitchen/experiments';

/** Stars, plowhorses, puzzles and dogs over the last 30 days; dishes without a recipe apart. */
export const fetchMenuInsights = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/menu-engineering' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchExperiments = async (status?: 'planned' | 'running' | 'completed' | 'cancelled'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One running experiment per dish (409 CONFLICT for a second). */
export const startExperiment = async (input: { itemId: string; days: number; startsOn?: string; notes?: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: BASE, data: clean({ itemId: input.itemId, days: input.days, startsOn: input.startsOn, notes: input.notes?.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** With its result (live while running). */
export const fetchExperiment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Its notes (what changed, and the kitchen's decision once made) or a new end day. */
export const updateExperiment = async (id: string, patch: { notes?: string; endsOn?: string }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** End early: the result through yesterday is kept. */
export const endExperiment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/${enc(id)}/end` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelExperiment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
