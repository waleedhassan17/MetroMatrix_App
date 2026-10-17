// MetroMatrix — Food vendor: the vendor's own riders. A new rider's username
// and password come back once; after that only a reset issues a password.
// TODO(API_FOOD): /food/vendor/riders (+ /:id, /:id/status,
// /:id/reset-password, /:id/credential).

import { api } from '../../network/apiHelpers';
import { createdRiderSerializer, foodRiderSerializer, foodRidersSerializer, riderCredentialSerializer } from '../../../serializers/food/riderSerializer';
import type { RiderInput, RiderStatus } from '../../../types/food';
import { request } from '../../shopping/http';

const enc = encodeURIComponent;
const body = (input: Partial<RiderInput>) => ({
  ...(input.fullName !== undefined ? { fullName: input.fullName } : null),
  ...(input.phone ? { phone: input.phone } : null),
  ...(input.vehicle ? { vehicle: input.vehicle } : null),
});

export const listRiders = () => request(() => api.get('/food/vendor/riders'), foodRidersSerializer);

/** Counts against the plan (409 PLAN_LIMIT_REACHED). */
export const createRider = (input: RiderInput) => request(() => api.post('/food/vendor/riders', body(input)), createdRiderSerializer);

export const getRider = (id: string) => request(() => api.get(`/food/vendor/riders/${enc(id)}`), foodRiderSerializer);

export const updateRider = (id: string, input: Partial<RiderInput>) =>
  request(() => api.patch(`/food/vendor/riders/${enc(id)}`, body(input)), foodRiderSerializer);

/** active · inactive (signs them out) · on_leave. Activating needs a free seat. */
export const setRiderStatus = (id: string, status: Extract<RiderStatus, 'active' | 'inactive' | 'on_leave'>) =>
  request(() => api.patch(`/food/vendor/riders/${enc(id)}/status`, { status }), foodRiderSerializer);

/** A new password, shown once; the rider is signed out everywhere. */
export const resetRiderPassword = (id: string) => request(() => api.post(`/food/vendor/riders/${enc(id)}/reset-password`), riderCredentialSerializer);
