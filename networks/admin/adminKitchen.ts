// ═══════════════════════════════════════════════════════
// MetroMatrix — Staff Kitchen Network (docs/API_KITCHEN.md §13, §21, §23, §25, §36; docs/AI.md)
// ═══════════════════════════════════════════════════════
// The console's Kitchen tools: hygiene checks, the assistant (use, the
// platform switch; a vendor's limits are its plan, adminFood), PBS city
// prices, nutrition foods, the words voice understands, the calendar,
// signature claims, the city demand map and the code lookup. Every write is
// audited by the API.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { AliasLanguage, CalendarEventInput, NutritionFoodInput } from '../../models/kitchenAdmin';

const enc = encodeURIComponent;

// ── Hygiene (/admin/food/hygiene) ──
/** `self_declared` is the queue, oldest first. */
export const fetchHygieneQueue = async (status: 'self_declared' | 'verified' = 'self_declared'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/food/hygiene', params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** After a visit or a video call. */
export const verifyHygiene = async (brandId: string, method: 'visit' | 'video_call', note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/food/hygiene/${enc(brandId)}/verify`, data: clean({ method, note: note?.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const revokeHygiene = async (brandId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/food/hygiene/${enc(brandId)}/revoke`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The assistant (/admin/ai) ──
export const fetchAiUsageReport = async (days = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/ai/usage', params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The switches as running (never a key). */
export const fetchAiSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/ai/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAiPrompts = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/ai/prompts' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The platform's AI switch (`ai.enabled`): a settings change, confirmed with an authenticator code. */
export const setAiEnabled = async (enabled: boolean, totpCode: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/admin/settings', data: { values: { 'ai.enabled': enabled }, totpCode } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── PBS city prices (/admin/kitchen) ──
export const fetchReferenceItems = async (q = ''): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/reference-items', params: clean({ q: q.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `week_ending,city,item,unit,price`; a dry run checks every line and writes nothing. */
export const importReferencePrices = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/reference-prices/import', data: { csv, ...(dryRun ? { dryRun: true } : {}) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Nutrition foods (/admin/nutrition/foods) ──
export const fetchNutritionFoods = async (q: { q?: string; page?: number; pageSize?: number } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/nutrition/foods', params: clean({ q: q.q?.trim(), ...pageParams(q.page ?? 1, q.pageSize ?? 30) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The form → the API's values (per 100 g; a new food without a group is a mixed dish). */
const foodBody = (input: Partial<NutritionFoodInput>, isNew: boolean) => ({
  ...clean({ key: input.key?.trim(), name: input.name?.trim(), nameUr: input.nameUr?.trim() || undefined, foodGroup: input.group?.trim() || (isNew ? 'Mixed dishes' : undefined) }),
  ...(input.kcal !== undefined ? { kcal: input.kcal } : {}),
  ...(input.protein !== undefined ? { proteinG: input.protein } : {}),
  ...(input.carbs !== undefined ? { carbsG: input.carbs } : {}),
  ...(input.fat !== undefined ? { fatG: input.fat } : {}),
  ...(isNew ? { fibreG: 0, sodiumMg: 0 } : {}),
});

/** Values per 100 g; `409 CONFLICT` on a key already taken. */
export const createNutritionFood = async (input: NutritionFoodInput & { key: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/nutrition/foods', data: foodBody(input, true) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** An edited USDA row becomes `source: staff` (its USDA id is kept). */
export const updateNutritionFood = async (id: string, input: Partial<NutritionFoodInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/admin/nutrition/foods/${enc(id)}`, data: foodBody(input, false) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Back on the list kitchens and the assistant match against. */
export const activateNutritionFood = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/nutrition/foods/${enc(id)}/activate` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Off the list (kept, not deleted). */
export const deactivateNutritionFood = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/admin/nutrition/foods/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `key,name,name_ur,food_group,kcal,protein_g,carbs_g,fat_g,fibre_g,sodium_mg,piece_grams`; a dry run writes nothing. */
export const importNutritionFoods = async (csv: string, dryRun: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/nutrition/foods/import', data: { csv, ...(dryRun ? { dryRun: true } : {}) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The words voice, receipts, nutrition and the pantry understand (/admin/kitchen/aliases) ──
/** The canonical names (the keys an alias points at) come with them. */
export const fetchAliases = async (q?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/kitchen/aliases', params: clean({ q: q?.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409` when the word already means something. */
export const createAlias = async (input: { word: string; language: AliasLanguage; key: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/kitchen/aliases', data: { alias: input.word.trim(), canonical: input.key.trim(), lang: input.language } });
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

// ── The calendar (/admin/food/calendar-events): Ramadan, Eid, holidays for the forecast ──
export const fetchCalendarEvents = async (q: { kind?: string; from?: string; city?: string; page?: number } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/food/calendar-events', params: clean({ ...q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** At most 45 days; no city is everywhere. */
export const createCalendarEvent = async (input: CalendarEventInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/admin/food/calendar-events', data: clean({ kind: input.kind, name: input.name.trim(), startsOn: input.startsOn, endsOn: input.endsOn, city: input.city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCalendarEvent = async (id: string, input: Partial<CalendarEventInput>): Promise<unknown> => {
  try {
    const data = { ...clean({ kind: input.kind, name: input.name?.trim(), startsOn: input.startsOn, endsOn: input.endsOn }), ...(input.city !== undefined ? { city: input.city } : {}) };
    const response = await API.PATCH({ URL: `/admin/food/calendar-events/${enc(id)}`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteCalendarEvent = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/admin/food/calendar-events/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Signature claims (/admin/food/signatures): live as soon as a kitchen claims one ──
export const fetchSignatures = async (status: 'claimed' | 'removed'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/food/signatures', params: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** By the claim's recipe card; the kitchen is told and may claim it again. */
export const removeSignature = async (recipeCardId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/food/signatures/${enc(recipeCardId)}/remove`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The city demand map (/admin/food/demand-map) ──
export const fetchPlatformDemand = async (q: { city?: string; cuisineId?: string | null; hour?: number | null; week?: string | null } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/food/demand-map', params: clean({ city: q.city, cuisineId: q.cuisineId, hour: q.hour ?? undefined, week: q.week }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchDemandCities = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/food/demand-map/cities' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Lookup (/admin/food/lookup): a CT- request, an FC- order, or a tiffin subscription id ──
export const lookupGrowthCode = async (code: string): Promise<unknown> => {
  try {
    const c = code.trim();
    // A code is written in capitals; a subscription id is a lower-case uuid.
    const response = await API.GET({ URL: '/admin/food/lookup', params: { code: /^[a-z]{2}-/i.test(c) ? c.toUpperCase() : c.toLowerCase() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
