// MetroMatrix — The doctor's day: queue, calendar, an appointment and its actions.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { calendarSerializer, doctorAppointmentSerializer, todaySerializer } from '../../../serializers/health/doctorSerializer';
import { clean, request } from '../../shopping/http';

const path = (id: string) => `/healthcare/doctor/appointments/${encodeURIComponent(id)}`;

export const getToday = (date: string | null, locationId: string | null) =>
  request(() => api.get('/healthcare/doctor/today', { params: clean({ date, locationId }) }), todaySerializer);

export const getCalendar = (from: string, to: string) =>
  request(() => api.get('/healthcare/doctor/calendar', { params: { from, to } }), calendarSerializer);

export const getDoctorAppointment = (id: string) => request(() => api.get(path(id)), doctorAppointmentSerializer);

export type DoctorAction = 'check-in' | 'start' | 'no-show';

/** Each action answers with the whole appointment, so the screen redraws from it. */
export const actOnAppointment = (id: string, action: DoctorAction) =>
  request(() => api.post(`${path(id)}/${action}`, {}), doctorAppointmentSerializer);

export const completeAppointment = (id: string, paymentCollected: boolean) =>
  request(() => api.post(`${path(id)}/complete`, { paymentCollected }), doctorAppointmentSerializer);

export const cancelByDoctor = (id: string, reason: string) =>
  request(() => api.post(`${path(id)}/cancel`, { reason }), doctorAppointmentSerializer);

export const confirmPayment = (id: string) => request(() => api.post(`${path(id)}/payment/confirm`, {}), doctorAppointmentSerializer);

export const rejectPayment = (id: string, reason: string) =>
  request(() => api.post(`${path(id)}/payment/reject`, { reason }), doctorAppointmentSerializer);

export const saveNotes = (id: string, notes: { text: string; attachments: string[] }) =>
  request(() => api.put(`${path(id)}/notes`, notes), doctorAppointmentSerializer);
