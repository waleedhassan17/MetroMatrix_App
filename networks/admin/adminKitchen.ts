// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Kitchen Intelligence (/admin/kitchen).
// docs/API_KITCHEN_ASSUMED.md §4.8 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean } from '../network/network';
import type { AliasLanguage, CalendarEventInput, NutritionFoodInput, SignatureStatus } from '../../models/kitchenAdmin';

const enc = encodeURIComponent;

// ── Hygiene ──
export const fetchHygieneQueue = async (status: 'pending' | 'verified' | 'rejected' = 'pending'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/hygiene', params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const verifyHygiene = async (businessId: string, note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/kitchen/hygiene/${enc(businessId)}/verify`, data: clean({ note }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectHygiene = async (businessId: string, note: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/kitchen/hygiene/${enc(businessId)}/reject`, data: { note: note.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The assistant ──
export const fetchAiUsageReport = async (range: { from?: string; to?: string } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/ai/usage', params: clean(range) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setAiEnabled = async (enabled: boolean): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/admin/kitchen/ai/settings', data: { enabled } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A kitchen's (business id) or customer's monthly limit; null puts back the plan's. */
export const setAiQuota = async (ownerId: string, limit: number | null): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/admin/kitchen/ai/quotas/${enc(ownerId)}`, data: { limit } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The city price list ──
export const fetchReferencePrices = async (q: { city?: string; q?: string } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/reference-prices', params: clean(q) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A dry run checks every row and imports nothing; an import is all or nothing (422 CSV_HAS_ERRORS). */
export const importReferencePrices = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/reference-prices', data: { csv }, params: dryRun ? { dryRun: 'true' } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Nutrition foods ──
export const fetchNutritionFoods = async (q: { q?: string; page?: number; pageSize?: number } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/nutrition-foods', params: clean(q) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createNutritionFood = async (input: NutritionFoodInput & { key: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/nutrition-foods', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateNutritionFood = async (id: string, input: Partial<NutritionFoodInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/admin/kitchen/nutrition-foods/${enc(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const importNutritionFoods = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/nutrition-foods/import', data: { csv }, params: dryRun ? { dryRun: 'true' } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Aliases ──
export const fetchAliases = async (q?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/aliases', params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchIngredientKeys = async (q?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/ingredient-keys', params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createAlias = async (input: { word: string; language: AliasLanguage; key: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/aliases', data: { ...input, word: input.word.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteAlias = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/admin/kitchen/aliases/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Calendar events ──
export const fetchCalendarEvents = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/calendar-events' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createCalendarEvent = async (input: CalendarEventInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/calendar-events', data: { ...input, name: input.name.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCalendarEvent = async (id: string, input: Partial<CalendarEventInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/admin/kitchen/calendar-events/${enc(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteCalendarEvent = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/admin/kitchen/calendar-events/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Signature dishes ──
export const fetchSignatures = async (status: SignatureStatus): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/signatures', params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const approveSignature = async (itemId: string, note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/kitchen/signatures/${enc(itemId)}/approve`, data: clean({ note }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeSignature = async (itemId: string, note: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/kitchen/signatures/${enc(itemId)}/remove`, data: { note: note.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The platform's demand map, a code looked up ──
export const fetchPlatformDemand = async (q: { city?: string; cuisine?: string | null; hour?: number | null } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/demand', params: clean({ city: q.city, cuisine: q.cuisine, hour: q.hour === null || q.hour === undefined ? undefined : String(q.hour) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupGrowthCode = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/lookup', params: { code: code.trim().toUpperCase() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
