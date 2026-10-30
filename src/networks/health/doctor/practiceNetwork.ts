// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Practice Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Locations, weekly hours, the patient-view preview,
// time off and payment accounts.
// MetroMatrix-API docs/API_HEALTH.md §4.3. A location's hours are their own
// route (`…/schedule`), and the video prepay rule is the doctor's (profile),
// so the slices read the location list from all three
// (screens/Health/Doctor/shared/practiceReads.ts).

import { api, toApiError } from '../../network/apiHelpers';
import { scheduleBody } from '../../../models/health/availabilityModel';
import { addDays, zonedToIso } from '../../../utils/healthTime';
import type { DoctorLocationInput, TimeOffInput, WeekDayHours } from '../../../types/health';
import type { PaymentAccountInput } from '../../../types/payments';

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

/** Every location (active or not), without its hours. */
export const getDoctorLocationsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/locations');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One location's weekly hours. */
export const getLocationScheduleAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${loc(id)}/schedule`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createLocationAPI = async (input: DoctorLocationInput): Promise<unknown> => {
  try {
    const response = await api.post('/health/doctor/locations', locationBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateLocationAPI = async (id: string, input: Partial<DoctorLocationInput>): Promise<unknown> => {
  try {
    const response = await api.patch(loc(id), locationBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteLocationAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(loc(id));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Replaces the week. A clash with another location answers 409
 * SCHEDULE_OVERLAP with details.conflict (overlapsFrom()).
 */
export const saveHoursAPI = async (id: string, hours: WeekDayHours[]): Promise<unknown> => {
  try {
    const response = await api.put(`${loc(id)}/schedule`, scheduleBody(hours));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The next `days` days exactly as patients will see them (works before publishing). */
export const getPreviewAPI = async (days = 7): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/availability/preview', { params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTimeOffAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/time-off');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Whole days in the location's zone (Pakistan time for all of them). Over
 * booked visits this answers 409 TIME_OFF_CONFLICTS with details.appointments
 * (conflictsFrom()) unless `cancelConflicts` — then those visits are cancelled
 * and their patients told. `timezone` is the location's (Pakistan time when none).
 */
export const addTimeOffAPI = async (input: TimeOffInput, timezone: string, cancelConflicts = false): Promise<unknown> => {
  try {
    const response = await api.post('/health/doctor/time-off', {
      startsAt: zonedToIso(input.from, '00:00', timezone),
      endsAt: zonedToIso(addDays(input.to, 1), '00:00', timezone),
      locationId: input.locationId ?? undefined,
      reason: input.reason ?? undefined,
      cancelAffected: cancelConflicts || undefined,
    });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeTimeOffAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/health/doctor/time-off/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// The doctor's own accounts patients pay into: `{ kind, accountTitle, accountNumber, bankName }`.
const accountOut = (input: Partial<PaymentAccountInput>) => ({
  kind: input.kind,
  accountTitle: input.title,
  accountNumber: input.number,
  bankName: input.bankName ?? undefined,
  isActive: input.isActive,
});

export const getDoctorPaymentAccountsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/payment-accounts');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createDoctorPaymentAccountAPI = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await api.post('/health/doctor/payment-accounts', accountOut(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateDoctorPaymentAccountAPI = async (id: string, input: Partial<PaymentAccountInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/health/doctor/payment-accounts/${enc(id)}`, accountOut(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteDoctorPaymentAccountAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/health/doctor/payment-accounts/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
