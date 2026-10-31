// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Kitchen Intelligence (/admin/kitchen).
// docs/API_KITCHEN_ASSUMED.md §4.8 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean } from '../network/apiHelpers';
import type { AliasLanguage, CalendarEventInput, NutritionFoodInput, SignatureStatus } from '../../types/kitchenAdmin';

const enc = encodeURIComponent;

// ── Hygiene ──
export const getHygieneQueueAPI = async (status: 'pending' | 'verified' | 'rejected' = 'pending'): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/hygiene', { params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const verifyHygieneAPI = async (businessId: string, note?: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/kitchen/hygiene/${enc(businessId)}/verify`, clean({ note }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectHygieneAPI = async (businessId: string, note: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/kitchen/hygiene/${enc(businessId)}/reject`, { note: note.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The assistant ──
export const getAiUsageReportAPI = async (range: { from?: string; to?: string } = {}): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/ai/usage', { params: clean(range) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setAiEnabledAPI = async (enabled: boolean): Promise<unknown> => {
  try {
    const response = await api.patch('/admin/kitchen/ai/settings', { enabled });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A kitchen's (business id) or customer's monthly limit; null puts back the plan's. */
export const setAiQuotaAPI = async (ownerId: string, limit: number | null): Promise<unknown> => {
  try {
    const response = await api.put(`/admin/kitchen/ai/quotas/${enc(ownerId)}`, { limit });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The city price list ──
export const getReferencePricesAPI = async (q: { city?: string; q?: string } = {}): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/reference-prices', { params: clean(q) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A dry run checks every row and imports nothing; an import is all or nothing (422 CSV_HAS_ERRORS). */
export const importReferencePricesAPI = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await api.post('/admin/kitchen/reference-prices', { csv }, { params: dryRun ? { dryRun: 'true' } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Nutrition foods ──
export const getNutritionFoodsAPI = async (q: { q?: string; page?: number; pageSize?: number } = {}): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/nutrition-foods', { params: clean(q) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createNutritionFoodAPI = async (input: NutritionFoodInput & { key: string }): Promise<unknown> => {
  try {
    const response = await api.post('/admin/kitchen/nutrition-foods', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateNutritionFoodAPI = async (id: string, input: Partial<NutritionFoodInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/admin/kitchen/nutrition-foods/${enc(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const importNutritionFoodsAPI = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await api.post('/admin/kitchen/nutrition-foods/import', { csv }, { params: dryRun ? { dryRun: 'true' } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Aliases ──
export const getAliasesAPI = async (q?: string): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/aliases', { params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getIngredientKeysAPI = async (q?: string): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/ingredient-keys', { params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createAliasAPI = async (input: { word: string; language: AliasLanguage; key: string }): Promise<unknown> => {
  try {
    const response = await api.post('/admin/kitchen/aliases', { ...input, word: input.word.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteAliasAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/admin/kitchen/aliases/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Calendar events ──
export const getCalendarEventsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/calendar-events');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createCalendarEventAPI = async (input: CalendarEventInput): Promise<unknown> => {
  try {
    const response = await api.post('/admin/kitchen/calendar-events', { ...input, name: input.name.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCalendarEventAPI = async (id: string, input: Partial<CalendarEventInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/admin/kitchen/calendar-events/${enc(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteCalendarEventAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/admin/kitchen/calendar-events/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Signature dishes ──
export const getSignaturesAPI = async (status: SignatureStatus): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/signatures', { params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const approveSignatureAPI = async (itemId: string, note?: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/kitchen/signatures/${enc(itemId)}/approve`, clean({ note }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeSignatureAPI = async (itemId: string, note: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/kitchen/signatures/${enc(itemId)}/remove`, { note: note.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The platform's demand map, a code looked up ──
export const getPlatformDemandAPI = async (q: { city?: string; cuisine?: string | null; hour?: number | null } = {}): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/demand', { params: clean({ city: q.city, cuisine: q.cuisine, hour: q.hour === null || q.hour === undefined ? undefined : String(q.hour) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupGrowthCodeAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get('/admin/kitchen/lookup', { params: { code: code.trim().toUpperCase() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
