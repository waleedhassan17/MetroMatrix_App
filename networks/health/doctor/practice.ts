// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Practice Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Locations, weekly hours, the patient-view preview,
// time off and payment accounts.
// MetroMatrix-API docs/API_HEALTH.md §4.3. A location's hours are their own
// route (`…/schedule`), and the video prepay rule is the doctor's (profile),
// so the slices read the location list from all three
// (screens/shared/practiceReads.ts).

import { API, toApiError } from '../../network/network';
import { scheduleBody } from '../../../models/health/availabilityModel';
import { addDays, zonedToIso } from '../../../utils/health-time/healthTime';
import type { DayHours, DoctorLocationInput, TimeOffInput, WeekDayHours } from '../../../models/health';
import type { PaymentAccountInput } from '../../../models/payments';

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
  bufferMinutes: input.bufferMinutes,
  instructions: input.instructions ?? undefined,
});

/** Every location (active or not), without its hours. */
export const fetchDoctorLocations = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/locations' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One location's weekly hours. */
export const fetchLocationSchedule = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${loc(id)}/schedule` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createLocation = async (input: DoctorLocationInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/doctor/locations', data: locationBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateLocation = async (id: string, input: Partial<DoctorLocationInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: loc(id), data: locationBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteLocation = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: loc(id) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Replaces the week. A clash with another location answers 409
 * SCHEDULE_OVERLAP with details.conflict (overlapsFrom()).
 */
/** `?dryRun=true`: the server checks and answers without saving. */
const dryRunParams = (dryRun: boolean) => (dryRun ? { dryRun: 'true' } : undefined);

export const saveHours = async (id: string, hours: WeekDayHours[], dryRun = false): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${loc(id)}/schedule`, data: scheduleBody(hours), params: dryRunParams(dryRun) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A location's own hours for some dates (default today … 60 days on). */
export const fetchDayHours = async (id: string, from?: string, to?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${loc(id)}/overrides`, params: { from, to } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A day's own hours as the API takes them (23:59, the app's end of day, is the API's 24:00). */
const dayHoursBody = (input: DayHours) => ({
  closed: input.closed || undefined,
  ranges: input.closed ? undefined : input.ranges.map(r => ({ start: r.from, end: r.to === '23:59' ? '24:00' : r.to })),
  note: input.note ?? undefined,
});

/** One date's own hours (`closed`, or ranges replacing its weekly hours); `dryRun` reports without saving. */
export const saveDayHours = async (id: string, input: DayHours, dryRun = false): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${loc(id)}/overrides/${enc(input.date)}`, data: dayHoursBody(input), params: dryRunParams(dryRun) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeDayHours = async (id: string, date: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${loc(id)}/overrides/${enc(date)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Your own free slots at a location (no notice, bookings on or paused, the long window). */
export const fetchOwnSlots = async (id: string, from: string | null, days = 14): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${loc(id)}/slots`, params: { from: from ?? undefined, days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The next `days` days exactly as patients will see them (works before publishing). */
export const fetchPreview = async (days = 7): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/availability/preview', params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchTimeOff = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/time-off' });
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
export const addTimeOff = async (input: TimeOffInput, timezone: string, cancelConflicts = false): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/doctor/time-off', data: {
      // Some hours of one day, or whole days (midnight to midnight).
      startsAt: zonedToIso(input.from, input.hours ? input.hours.from : '00:00', timezone),
      endsAt: input.hours
        ? input.hours.to === '23:59'
          ? zonedToIso(addDays(input.from, 1), '00:00', timezone)
          : zonedToIso(input.from, input.hours.to, timezone)
        : zonedToIso(addDays(input.to, 1), '00:00', timezone),
      locationId: input.locationId ?? undefined,
      reason: input.reason ?? undefined,
      cancelAffected: cancelConflicts || undefined,
    } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeTimeOff = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/health/doctor/time-off/${enc(id)}` });
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
/** An account's kind and number can't change once saved (UpdateDoctorPaymentAccountDto: title, bank, on/off). */
const accountChangeOut = (input: Partial<PaymentAccountInput>) => ({
  accountTitle: input.title,
  bankName: input.bankName ?? undefined,
  isActive: input.isActive,
});

export const fetchDoctorPaymentAccounts = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/payment-accounts' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createDoctorPaymentAccount = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/doctor/payment-accounts', data: accountOut(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateDoctorPaymentAccount = async (id: string, input: Partial<PaymentAccountInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/health/doctor/payment-accounts/${enc(id)}`, data: accountChangeOut(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteDoctorPaymentAccount = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/health/doctor/payment-accounts/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
