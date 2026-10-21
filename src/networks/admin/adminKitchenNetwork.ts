// MetroMatrix — the staff console: Kitchen Intelligence (/admin/kitchen).
// docs/API_KITCHEN_ASSUMED.md §4.8 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { ack, clean, request } from '../shopping/http';
import { hygieneQueueSerializer, hygieneSerializer } from '../../serializers/kitchen/reachSerializer';
import {
  adminDemandSerializer,
  aiUsageReportSerializer,
  aliasSerializer,
  aliasesSerializer,
  calendarEventSerializer,
  calendarEventsSerializer,
  growthLookupSerializer,
  ingredientKeysSerializer,
  nutritionFoodImportSerializer,
  nutritionFoodSerializer,
  priceImportSerializer,
  referencePricesSerializer,
  signatureDishSerializer,
  signatureListSerializer,
  staffNutritionFoodsSerializer,
} from '../../serializers/kitchen/adminKitchenSerializer';
import type { AliasLanguage, CalendarEventInput, NutritionFoodInput, SignatureStatus } from '../../types/kitchenAdmin';

const enc = encodeURIComponent;

// ── Hygiene ──
export const listHygieneQueue = (status: 'pending' | 'verified' | 'rejected' = 'pending') => request(() => api.get('/admin/kitchen/hygiene', { params: { status } }), hygieneQueueSerializer);

export const verifyHygiene = (businessId: string, note?: string) => request(() => api.post(`/admin/kitchen/hygiene/${enc(businessId)}/verify`, clean({ note })), hygieneSerializer);

export const rejectHygiene = (businessId: string, note: string) => request(() => api.post(`/admin/kitchen/hygiene/${enc(businessId)}/reject`, { note: note.trim() }), hygieneSerializer);

// ── The assistant ──
export const getAiUsageReport = (range: { from?: string; to?: string } = {}) => request(() => api.get('/admin/kitchen/ai/usage', { params: clean(range) }), aiUsageReportSerializer);

export const setAiEnabled = (enabled: boolean) => request(() => api.patch('/admin/kitchen/ai/settings', { enabled }), ack);

/** A kitchen's (business id) or customer's monthly limit; null puts back the plan's. */
export const setAiQuota = (ownerId: string, limit: number | null) => request(() => api.put(`/admin/kitchen/ai/quotas/${enc(ownerId)}`, { limit }), ack);

// ── The city price list ──
export const getReferencePrices = (q: { city?: string; q?: string } = {}) => request(() => api.get('/admin/kitchen/reference-prices', { params: clean(q) }), referencePricesSerializer);

/** A dry run checks every row and imports nothing; an import is all or nothing (422 CSV_HAS_ERRORS). */
export const importReferencePrices = (csv: string, dryRun: boolean) =>
  request(() => api.post('/admin/kitchen/reference-prices', { csv }, { params: dryRun ? { dryRun: 'true' } : {} }), priceImportSerializer);

// ── Nutrition foods ──
export const listNutritionFoods = (q: { q?: string; page?: number; pageSize?: number } = {}) => request(() => api.get('/admin/kitchen/nutrition-foods', { params: clean(q) }), staffNutritionFoodsSerializer);

export const createNutritionFood = (input: NutritionFoodInput & { key: string }) => request(() => api.post('/admin/kitchen/nutrition-foods', input), nutritionFoodSerializer);

export const updateNutritionFood = (id: string, input: Partial<NutritionFoodInput>) => request(() => api.patch(`/admin/kitchen/nutrition-foods/${enc(id)}`, input), nutritionFoodSerializer);

export const importNutritionFoods = (csv: string, dryRun: boolean) =>
  request(() => api.post('/admin/kitchen/nutrition-foods/import', { csv }, { params: dryRun ? { dryRun: 'true' } : {} }), nutritionFoodImportSerializer);

// ── Aliases ──
export const listAliases = (q?: string) => request(() => api.get('/admin/kitchen/aliases', { params: clean({ q }) }), aliasesSerializer);

export const listIngredientKeys = (q?: string) => request(() => api.get('/admin/kitchen/ingredient-keys', { params: clean({ q }) }), ingredientKeysSerializer);

export const createAlias = (input: { word: string; language: AliasLanguage; key: string }) => request(() => api.post('/admin/kitchen/aliases', { ...input, word: input.word.trim() }), aliasSerializer);

export const deleteAlias = (id: string) => request(() => api.delete(`/admin/kitchen/aliases/${enc(id)}`), ack);

// ── Calendar events ──
export const listCalendarEvents = () => request(() => api.get('/admin/kitchen/calendar-events'), calendarEventsSerializer);

export const createCalendarEvent = (input: CalendarEventInput) => request(() => api.post('/admin/kitchen/calendar-events', { ...input, name: input.name.trim() }), calendarEventSerializer);

export const updateCalendarEvent = (id: string, input: Partial<CalendarEventInput>) => request(() => api.patch(`/admin/kitchen/calendar-events/${enc(id)}`, input), calendarEventSerializer);

export const deleteCalendarEvent = (id: string) => request(() => api.delete(`/admin/kitchen/calendar-events/${enc(id)}`), ack);

// ── Signature dishes ──
export const listSignatures = (status: SignatureStatus) => request(() => api.get('/admin/kitchen/signatures', { params: { status } }), signatureListSerializer);

export const approveSignature = (itemId: string, note?: string) => request(() => api.post(`/admin/kitchen/signatures/${enc(itemId)}/approve`, clean({ note })), signatureDishSerializer);

export const removeSignature = (itemId: string, note: string) => request(() => api.post(`/admin/kitchen/signatures/${enc(itemId)}/remove`, { note: note.trim() }), signatureDishSerializer);

// ── The platform's demand map, a code looked up ──
export const getPlatformDemand = (q: { city?: string; cuisine?: string | null; hour?: number | null } = {}) =>
  request(() => api.get('/admin/kitchen/demand', { params: clean({ city: q.city, cuisine: q.cuisine, hour: q.hour === null || q.hour === undefined ? undefined : String(q.hour) }) }), adminDemandSerializer);

export const lookupGrowthCode = (code: string) => request(() => api.get('/admin/kitchen/lookup', { params: { code: code.trim().toUpperCase() } }), growthLookupSerializer);
