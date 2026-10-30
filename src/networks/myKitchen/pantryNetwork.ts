// MetroMatrix — My Kitchen: the customer's pantry.
// docs/API_KITCHEN_ASSUMED.md §2.15, §4.7 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { groceryOrdersSerializer, pantryItemSerializer, pantryItemsSerializer, pantryListSerializer, pantryRemindersSerializer, pantryStatsSerializer, pantryRemovedSerializer, pantryUsedUpSerializer } from '../../serializers/myKitchen/myKitchenSerializer';
import type { PantryLineInput, PantryReminders, PantrySegment } from '../../types/myKitchen';
import type { StandardUnit } from '../../utils/units';

const enc = encodeURIComponent;

export const listPantry = (segment: PantrySegment) => request(() => api.get('/my-kitchen/pantry', { params: { segment } }), pantryListSerializer);

export const addToPantry = (lines: PantryLineInput[], source: 'manual' | 'voice' = 'manual') =>
  request(() => api.post('/my-kitchen/pantry', { source, lines }), pantryItemsSerializer);

export const updatePantryItem = (id: string, patch: { qty?: number; unit?: StandardUnit; expiresOn?: string | null }) =>
  request(() => api.patch(`/my-kitchen/pantry/${enc(id)}`, patch), pantryItemSerializer);

/** Thrown away. */
export const removePantryItem = (id: string) => request(() => api.delete(`/my-kitchen/pantry/${enc(id)}`), pantryRemovedSerializer);

/** All of it, or some (`qty`, `unit`). */
export const markPantryUsed = (id: string, some?: { qty: number; unit: StandardUnit }) =>
  request(() => api.post(`/my-kitchen/pantry/${enc(id)}/use`, some ?? {}), pantryUsedUpSerializer);

export const listGroceryOrders = () => request(() => api.get('/my-kitchen/pantry/shopping-orders'), groceryOrdersSerializer);

export const addFromShoppingOrder = (orderId: string, lineIds: string[]) =>
  request(() => api.post('/my-kitchen/pantry/from-shopping-order', { orderId, lineIds }), pantryItemsSerializer);

export const getPantryReminders = () => request(() => api.get('/my-kitchen/pantry/reminders'), pantryRemindersSerializer);

export const savePantryReminders = (r: Partial<PantryReminders>) => request(() => api.put('/my-kitchen/pantry/reminders', r), pantryRemindersSerializer);

export const getPantryStats = (month?: string) => request(() => api.get('/my-kitchen/stats', { params: month ? { month } : undefined }), pantryStatsSerializer);
