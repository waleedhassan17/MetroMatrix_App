// MetroMatrix — Food vendor: the order board and each order's moves.
// TODO(API_FOOD): /food/vendor/orders (+ /:id and its actions) as committed.

import { api } from '../../network/apiHelpers';
import { boardPageSerializer, vendorFoodOrderSerializer } from '../../../serializers/food/orderSerializer';
import { request } from '../../shopping/http';

const enc = encodeURIComponent;

/** new · active · done, or one status; `scheduled` for pre-orders. */
export const listBoard = (status: 'new' | 'active' | 'done', page = 1, pageSize = 50) =>
  request(() => api.get('/food/vendor/orders', { params: { status, page, pageSize } }), boardPageSerializer);

export const getVendorOrder = (id: string) => request(() => api.get(`/food/vendor/orders/${enc(id)}`), vendorFoodOrderSerializer);

const act = (id: string, action: string, body?: object) => request(() => api.post(`/food/vendor/orders/${enc(id)}/${action}`, body ?? {}), vendorFoodOrderSerializer);

/** placed → accepted, with the ETA in minutes (5–180). */
export const acceptOrder = (id: string, etaMinutes: number) => act(id, 'accept', { etaMinutes });
export const rejectOrder = (id: string, reason: string) => act(id, 'reject', { reason });
/** A transfer must be confirmed first (409 PAYMENT_NOT_CONFIRMED). */
export const startPreparing = (id: string) => act(id, 'preparing');
export const markReady = (id: string) => act(id, 'ready');
/** One of the vendor's own riders, active and on duty. */
export const assignRider = (id: string, riderId: string) => act(id, 'assign', { riderId });
/** Handed to someone who isn't on the app (a family member, a neighbour's bike). */
export const handedExternal = (id: string) => act(id, 'handed-external');
/** Pick-up: the customer collected it (pay at pickup is settled). */
export const markCollected = (id: string) => act(id, 'picked-up');
/** on_the_way → delivered; cash on delivery records what was taken. */
export const markDelivered = (id: string, codCollected: number | null) => act(id, 'delivered', codCollected === null ? {} : { codCollected });
export const cancelVendorOrder = (id: string, reason: string) => act(id, 'cancel', { reason });
export const confirmPayment = (id: string) => act(id, 'payment/confirm');
export const rejectPayment = (id: string, reason: string) => act(id, 'payment/reject', { reason });
