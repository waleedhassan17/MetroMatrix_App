// MetroMatrix — The doctor's day: queue, calendar, an appointment and its actions.
// MetroMatrix-API docs/API_HEALTH.md §4.3. Doctor routes take the appointment
// CODE, which is what the doctor side calls an appointment's id. An action
// answers with the appointment's core; the screen redraws from the whole of
// it (notes and prescription too), so each action reads it back.

import type { AxiosResponse } from 'axios';
import { AuthError, api, toAuthError, unwrap } from '../../network/apiHelpers';
import { calendarSerializer, doctorAppointmentSerializer, todaySerializer } from '../../../serializers/health/doctorSerializer';
import { healthRecordSerializer } from '../../../serializers/health/recordsSerializer';
import { mimeFromUrl, publicIdFromCloudinaryUrl } from '../../../serializers/health/healthCommon';
import { arr, isObject, str } from '../../../serializers/serializerUtils';
import { ack, request, requestAll } from '../../shopping/http';

const enc = encodeURIComponent;
const path = (id: string) => `/health/doctor/appointments/${enc(id)}`;
const locations = () => api.get('/health/doctor/locations');

/** Only one location's patients, when the doctor picked one. */
const forLocation = (today: unknown, locationId: string | null) => {
  if (!locationId || !isObject(today)) return today;
  return { ...today, queue: arr(today.queue).filter(q => isObject(q) && isObject(q.location) && str(q.location.id) === locationId) };
};

/** Today's queue (another day: that day's appointments). */
export const getToday = async (date: string | null, locationId: string | null) => {
  try {
    const [today, locs] = await Promise.all([
      date
        ? api
            .get('/health/doctor/appointments', { params: { date, pageSize: 100 } })
            .then(unwrap)
            .then(page => ({ date, counts: {}, queue: arr(isObject(page) ? page.items : []) }))
        : api.get('/health/doctor/today').then(unwrap),
      api.get('/health/doctor/locations').then(unwrap),
    ]);
    const value = todaySerializer({ today: forLocation(today, locationId), locations: locs });
    if (!value) throw new AuthError('The server sent something unexpected. Try again.', 'BAD_RESPONSE');
    return value;
  } catch (e) {
    throw toAuthError(e);
  }
};

/** The range's appointments (first 100), time off and locations. */
export const getCalendar = (from: string, to: string) =>
  requestAll(
    {
      appointments: () => api.get('/health/doctor/appointments', { params: { from, to, pageSize: 100 } }),
      timeOff: () => api.get('/health/doctor/time-off'),
      locations,
    },
    calendarSerializer,
  );

/** The appointment with its history and shared records, its private notes and its prescription. */
export const getDoctorAppointment = (id: string) =>
  requestAll(
    { appointment: () => api.get(path(id)), notes: () => api.get(`${path(id)}/notes`), prescription: () => api.get(`${path(id)}/prescription`) },
    doctorAppointmentSerializer,
  );

/** Do something, then read the appointment back whole. */
const thenRead = (id: string, call: () => Promise<AxiosResponse>) => request(call, ack).then(() => getDoctorAppointment(id));

export type DoctorAction = 'check-in' | 'start' | 'no-show';

export const actOnAppointment = (id: string, action: DoctorAction) => thenRead(id, () => api.post(`${path(id)}/${action}`, {}));

export const completeAppointment = (id: string, paymentCollected: boolean) =>
  thenRead(id, () => api.post(`${path(id)}/complete`, { paymentCollected }));

export const cancelByDoctor = (id: string, reason: string) => thenRead(id, () => api.post(`${path(id)}/cancel`, { reason }));

export const confirmPayment = (id: string) => thenRead(id, () => api.post(`${path(id)}/payment/confirm`, {}));

export const rejectPayment = (id: string, reason: string) => thenRead(id, () => api.post(`${path(id)}/payment/reject`, { reason }));

/** Private notes; files are `medical_note` uploads (the API checks each one's public id). */
export const saveNotes = (id: string, notes: { text: string; attachments: string[] }) =>
  thenRead(id, () =>
    api.put(`${path(id)}/notes`, {
      text: notes.text,
      files: notes.attachments.map(url => ({ url, publicId: publicIdFromCloudinaryUrl(url), mime: mimeFromUrl(url) })),
    }),
  );

/**
 * A record the patient shared with this visit, with short-lived links to its
 * files (only while it is attached; the read is audited).
 */
export const openSharedRecord = (id: string, recordId: string) =>
  request(() => api.get(`${path(id)}/records/${enc(recordId)}`), healthRecordSerializer);
