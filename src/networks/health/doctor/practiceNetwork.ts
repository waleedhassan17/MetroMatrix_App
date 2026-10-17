// MetroMatrix — Practice: locations, weekly hours, the patient-view preview,
// time off and payment accounts.
// MetroMatrix-API docs/API_HEALTH.md §4.3. A location's hours are their own
// route (`…/schedule`), and the video prepay rule is the doctor's (profile),
// so the location list is read from all three.

import { api, toAuthError, unwrap } from '../../network/apiHelpers';
import {
  doctorLocationSerializer,
  doctorLocationsSerializer,
  previewSerializer,
  timeOffListSerializer,
  timeOffSerializer,
} from '../../../serializers/health/doctorSerializer';
import { paymentAccountSerializer } from '../../../serializers/shopping/partnerSerializer';
import { compact } from '../../../serializers/shopping/common';
import { arr, bool, isObject, str } from '../../../serializers/serializerUtils';
import { scheduleBody } from '../../../models/health/availabilityModel';
import { PKT, addDays, zonedToIso } from '../../../utils/healthTime';
import type { DoctorLocation, DoctorLocationInput, TimeOffInput, WeekDayHours } from '../../../types/health';
import type { PaymentAccountInput } from '../../../types/payments';
import { ack, request, requestAll } from '../../shopping/http';

const enc = encodeURIComponent;
const loc = (id: string) => `/health/doctor/locations/${enc(id)}`;

const locationBody = (input: Partial<DoctorLocationInput>) => ({
  kind: input.kind,
  name: input.name ?? (input.kind === 'video' ? 'Video consultation' : undefined),
  addressLine: input.address ?? undefined,
  area: input.area || undefined,
  city: input.city || undefined,
  lat: input.lat ?? undefined,
  lng: input.lng ?? undefined,
  phone: input.phone ?? undefined,
  fee: input.fee,
  slotMinutes: input.slotMinutes,
  instructions: input.instructions ?? undefined,
});

/** Prepay is the doctor's rule for video; set it when a video location asks for it (needs a payment account). */
const syncPrepay = async (input: Partial<DoctorLocationInput>) => {
  if (input.kind === 'video' && input.requiresPrepay !== undefined)
    await api.patch('/health/doctor/profile', { videoPrepayRequired: input.requiresPrepay });
};

const videoPrepay = async () => {
  const profile = unwrap(await api.get('/health/doctor/profile'));
  return isObject(profile) && bool(profile.videoPrepayRequired);
};

export const listLocations = async (): Promise<DoctorLocation[]> => {
  try {
    const [locs, prepay] = await Promise.all([api.get('/health/doctor/locations').then(unwrap), videoPrepay()]);
    const active = arr(locs).filter(l => isObject(l) && l.isActive !== false) as Record<string, unknown>[];
    const schedules = Object.fromEntries(
      await Promise.all(active.map(async l => [str(l.id), unwrap(await api.get(`${loc(str(l.id))}/schedule`))] as const)),
    );
    return doctorLocationsSerializer({ locations: active, schedules, videoPrepay: prepay });
  } catch (e) {
    throw toAuthError(e);
  }
};

export const createLocation = (input: DoctorLocationInput) =>
  request(
    async () => {
      const res = await api.post('/health/doctor/locations', locationBody(input));
      await syncPrepay(input);
      return res;
    },
    raw => doctorLocationSerializer(raw, undefined, !!input.requiresPrepay),
  );

export const updateLocation = (id: string, input: Partial<DoctorLocationInput>) =>
  request(
    async () => {
      const res = await api.patch(loc(id), locationBody(input));
      await syncPrepay(input);
      return res;
    },
    raw => doctorLocationSerializer(raw, undefined, !!input.requiresPrepay),
  );

export const deleteLocation = (id: string) => request(() => api.delete(loc(id)), ack);

/**
 * Replaces the week. A clash with another location answers 409
 * SCHEDULE_OVERLAP with details.conflict (overlapsFrom()).
 */
export const saveHours = (id: string, hours: WeekDayHours[]) =>
  requestAll(
    {
      schedule: () => api.put(`${loc(id)}/schedule`, scheduleBody(hours)),
      locations: () => api.get('/health/doctor/locations'),
    },
    ({ schedule, locations }) => doctorLocationSerializer(arr(locations).find(l => isObject(l) && str(l.id) === id), schedule),
  );

/** The next `days` days exactly as patients will see them (works before publishing). */
export const getPreview = (days = 7) =>
  request(() => api.get('/health/doctor/availability/preview', { params: { days } }), previewSerializer);

export const listTimeOff = () =>
  requestAll({ timeOff: () => api.get('/health/doctor/time-off'), locations: () => api.get('/health/doctor/locations') }, timeOffListSerializer);

/**
 * Whole days in the location's zone (Pakistan time for all of them). Over
 * booked visits this answers 409 TIME_OFF_CONFLICTS with details.appointments
 * (conflictsFrom()) unless `cancelConflicts` — then those visits are cancelled
 * and their patients told.
 */
export const addTimeOff = async (input: TimeOffInput, cancelConflicts = false) => {
  try {
    const locations = arr(unwrap(await api.get('/health/doctor/locations')));
    const place = locations.find(l => isObject(l) && str(l.id) === input.locationId);
    const tz = (isObject(place) && str(place.timezone)) || PKT;
    const created = unwrap(
      await api.post('/health/doctor/time-off', {
        startsAt: zonedToIso(input.from, '00:00', tz),
        endsAt: zonedToIso(addDays(input.to, 1), '00:00', tz),
        locationId: input.locationId ?? undefined,
        reason: input.reason ?? undefined,
        cancelAffected: cancelConflicts || undefined,
      }),
    );
    const value = timeOffSerializer(created, compact(locations.map(l => (isObject(l) ? { id: str(l.id), name: str(l.name), kind: 'clinic' as const, timezone: str(l.timezone) || PKT } : null))));
    if (!value) throw new Error('bad time off');
    return value;
  } catch (e) {
    throw toAuthError(e);
  }
};

export const removeTimeOff = (id: string) => request(() => api.delete(`/health/doctor/time-off/${enc(id)}`), ack);

// The doctor's own accounts patients pay into: `{ kind, accountTitle, accountNumber, bankName }`.
const accountIn = (raw: unknown) => (isObject(raw) ? paymentAccountSerializer({ ...raw, title: raw.accountTitle, number: raw.accountNumber }) : null);
const accountOut = (input: Partial<PaymentAccountInput>) => ({
  kind: input.kind,
  accountTitle: input.title,
  accountNumber: input.number,
  bankName: input.bankName ?? undefined,
  isActive: input.isActive,
});

export const listDoctorPaymentAccounts = () =>
  request(() => api.get('/health/doctor/payment-accounts'), raw => compact(arr(raw).map(accountIn)));
export const createDoctorPaymentAccount = (input: PaymentAccountInput) =>
  request(() => api.post('/health/doctor/payment-accounts', accountOut(input)), accountIn);
export const updateDoctorPaymentAccount = (id: string, input: Partial<PaymentAccountInput>) =>
  request(() => api.patch(`/health/doctor/payment-accounts/${enc(id)}`, accountOut(input)), accountIn);
export const deleteDoctorPaymentAccount = (id: string) =>
  request(() => api.delete(`/health/doctor/payment-accounts/${enc(id)}`), ack);
