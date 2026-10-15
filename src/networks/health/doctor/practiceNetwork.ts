// MetroMatrix — Practice: locations, weekly hours, the patient-view preview,
// time off and payment accounts.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import {
  doctorLocationSerializer,
  doctorLocationsSerializer,
  previewSerializer,
  timeOffListSerializer,
  timeOffSerializer,
} from '../../../serializers/health/doctorSerializer';
import { paymentAccountSerializer } from '../../../serializers/shopping/partnerSerializer';
import { compact } from '../../../serializers/shopping/common';
import { arr } from '../../../serializers/serializerUtils';
import type { DoctorLocationInput, TimeOffInput, WeekDayHours } from '../../../types/health';
import type { PaymentAccountInput } from '../../../types/payments';
import { ack, request } from '../../shopping/http';

const loc = (id: string) => `/healthcare/doctor/locations/${encodeURIComponent(id)}`;

export const listLocations = () => request(() => api.get('/healthcare/doctor/locations'), doctorLocationsSerializer);
export const createLocation = (input: DoctorLocationInput) =>
  request(() => api.post('/healthcare/doctor/locations', input), doctorLocationSerializer);
export const updateLocation = (id: string, input: Partial<DoctorLocationInput>) =>
  request(() => api.patch(loc(id), input), doctorLocationSerializer);
export const deleteLocation = (id: string) => request(() => api.delete(loc(id)), ack);

/** Replaces the week. A clash with another location answers VALIDATION_FAILED + details.overlaps (overlapsFrom()). */
export const saveHours = (id: string, hours: WeekDayHours[]) =>
  request(() => api.put(`${loc(id)}/hours`, { hours }), doctorLocationSerializer);

/** The next `days` days exactly as patients will see them. */
export const getPreview = (days = 7) => request(() => api.get('/healthcare/doctor/availability/preview', { params: { days } }), previewSerializer);

export const listTimeOff = () => request(() => api.get('/healthcare/doctor/time-off'), timeOffListSerializer);

/**
 * Over booked visits this answers 409 TIME_OFF_CONFLICT with
 * details.appointments (conflictsFrom()) unless `cancelConflicts` — then those
 * visits are cancelled and their patients told.
 */
export const addTimeOff = (input: TimeOffInput, cancelConflicts = false) =>
  request(() => api.post('/healthcare/doctor/time-off', { ...input, cancelConflicts }), timeOffSerializer);
export const removeTimeOff = (id: string) => request(() => api.delete(`/healthcare/doctor/time-off/${encodeURIComponent(id)}`), ack);

// The doctor's own accounts patients pay into (same shape as a store's).
export const listDoctorPaymentAccounts = () =>
  request(() => api.get('/healthcare/doctor/payment-accounts'), raw => compact(arr(raw).map(paymentAccountSerializer)));
export const createDoctorPaymentAccount = (input: PaymentAccountInput) =>
  request(() => api.post('/healthcare/doctor/payment-accounts', input), paymentAccountSerializer);
export const updateDoctorPaymentAccount = (id: string, input: Partial<PaymentAccountInput>) =>
  request(() => api.patch(`/healthcare/doctor/payment-accounts/${encodeURIComponent(id)}`, input), paymentAccountSerializer);
export const deleteDoctorPaymentAccount = (id: string) =>
  request(() => api.delete(`/healthcare/doctor/payment-accounts/${encodeURIComponent(id)}`), ack);
