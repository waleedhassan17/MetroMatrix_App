// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor profile slice
// ═══════════════════════════════════════════════════════
// Profiles by doctor id, and one booking view per open profile (profiles
// stack: a similar doctor opens over this one): which location is chosen,
// its next two weeks, the chosen day's slots and the chosen time.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { fetchDays, fetchSlots } from '../../networks/health/availability';
import { toRejectedValue } from '../../networks/network/network';
import type { DayAvailability, DoctorProfile, SlotDay } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { confirmBookingAsync } from '../book-appointment-sheet/bookAppointmentSlice';
import { daysSerializer, slotDayOnSerializer, slotDaySerializer, slotsMetaSerializer } from '../../serializers/health/discoverySerializer';
import { getDoctor } from '../shared/healthReads';

export interface DoctorEntry {
  profile: DoctorProfile | null;
  status: FormStatus;
  error: ServerError;
}

export interface ProfileView {
  doctorId: string;
  locationId: string | null;
  days: DayAvailability[];
  date: string | null;
  day: SlotDay | null;
  loading: boolean;
  selected: string | null;
  aboutOpen: boolean;
  error: ServerError;
  /** The doctor is taking new bookings (a paused one shows no times). */
  accepting: boolean;
  /** How many days ahead patients may book (null from a server that doesn't say). */
  windowDays: number | null;
  loadingMore: boolean;
  /** The days as read (each answer as it came), so tapping another of them needs no request. */
  raw: unknown[];
}

export interface DoctorProfileSliceState {
  doctors: Record<string, DoctorEntry>;
  views: Record<string, ProfileView>;
}

const EMPTY: DoctorEntry = { profile: null, status: 'idle', error: NO_ERROR };
const initialState: DoctorProfileSliceState = { doctors: {}, views: {} };

const newView = (doctorId: string): ProfileView => ({
  raw: [],
  doctorId,
  locationId: null,
  days: [],
  date: null,
  day: null,
  loading: false,
  selected: null,
  aboutOpen: false,
  error: NO_ERROR,
  accepting: true,
  windowDays: null,
  loadingMore: false,
});

export const doctorProfileSlice = createAppSlice({
  name: 'doctorProfile',
  initialState,
  reducers: create => ({
    openProfileView: create.reducer((state, action: PayloadAction<{ key: string; doctorId: string }>) => {
      if (!state.views[action.payload.key]) state.views[action.payload.key] = newView(action.payload.doctorId);
    }),
    closeProfileView: create.reducer((state, action: PayloadAction<string>) => {
      delete state.views[action.payload];
    }),
    pickSlot: create.reducer((state, action: PayloadAction<{ key: string; startAt: string | null }>) => {
      const v = state.views[action.payload.key];
      if (v) v.selected = action.payload.startAt;
    }),
    /** A day already read: its times from what's loaded, no request. */
    showProfileDay: create.reducer((state, action: PayloadAction<{ key: string; date: string }>) => {
      const v = state.views[action.payload.key];
      if (!v) return;
      const from = v.raw.find(r => daysSerializer(r).some(d => d.date === action.payload.date));
      if (!from) return;
      v.date = action.payload.date;
      v.day = slotDayOnSerializer(from, action.payload.date);
      v.selected = null;
      v.error = NO_ERROR;
    }),
    toggleAbout: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (v) v.aboutOpen = !v.aboutOpen;
    }),

    loadDoctorAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getDoctor(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.doctors[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.doctors[action.meta.arg] = { profile: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.doctors[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "This doctor's profile didn't load.");
        },
      },
    ),

    /** Choose how to be seen: the location's next two weeks, then its first day with time (or `date`). */
    chooseLocationAsync: create.asyncThunk(
      async ({ doctorId, locationId, date }: { key: string; doctorId: string; locationId: string; date?: string }, { rejectWithValue }) => {
        try {
          // One request: the fortnight's answer holds every day's slots.
          return { days: await fetchDays(doctorId, locationId, null, 14), date: date ?? null };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v) return;
          v.locationId = action.meta.arg.locationId;
          v.loading = true;
          v.selected = null;
          v.days = [];
          v.day = null;
          v.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v || v.locationId !== action.meta.arg.locationId) return;
          const days = daysSerializer(action.payload.days);
          const meta = slotsMetaSerializer(action.payload.days);
          v.accepting = meta?.accepting ?? true;
          v.windowDays = meta?.windowDays ?? null;
          // The asked-for day, else the first with room, else the first.
          const want = action.payload.date;
          const pick = (want && days.find(d => d.date === want)?.date) || days.find(d => d.slotCount > 0)?.date || days[0]?.date || null;
          const day = pick ? slotDayOnSerializer(action.payload.days, pick) : null;
          v.loading = false;
          v.days = days;
          v.day = day;
          v.date = day?.date ?? null;
          v.raw = [action.payload.days];
        },
        rejected: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v) return;
          v.loading = false;
          v.error = readRejection(action, "The doctor's times didn't load.");
        },
      },
    ),

    /** The next days of the doctor's booking window (past the first fortnight). */
    moreDaysAsync: create.asyncThunk(
      async ({ doctorId, locationId, from, days }: { key: string; doctorId: string; locationId: string; from: string; days: number }, { rejectWithValue }) => {
        try {
          return await fetchDays(doctorId, locationId, from, days);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (v) v.loadingMore = true;
        },
        fulfilled: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v || v.locationId !== action.meta.arg.locationId) return;
          v.loadingMore = false;
          const more = daysSerializer(action.payload).filter(d => !v.days.some(x => x.date === d.date));
          v.days = [...v.days, ...more];
          v.raw = [...v.raw, action.payload];
        },
        rejected: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v) return;
          v.loadingMore = false;
          v.error = readRejection(action, "The later days didn't load.");
        },
      },
    ),
    chooseDayAsync: create.asyncThunk(
      async ({ doctorId, locationId, date }: { key: string; doctorId: string; locationId: string; date: string }, { rejectWithValue }) => {
        try {
          return await fetchSlots(doctorId, locationId, date);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v) return;
          v.date = action.meta.arg.date;
          v.loading = true;
          v.selected = null;
          v.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = slotDaySerializer(action.payload);
          const v = state.views[action.meta.arg.key];
          if (!v || v.date !== action.meta.arg.date) return;
          v.loading = false;
          v.day = payload;
        },
        rejected: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (!v) return;
          v.loading = false;
          v.error = readRejection(action, "That day's times didn't load.");
        },
      },
    ),
  }),
  extraReducers: builder => {
    // Booked: the time is no longer chosen (or free) on any open grid for that location.
    builder.addCase(confirmBookingAsync.fulfilled, (state, action) => {
      const { locationId, startAt } = action.meta.arg.input;
      for (const v of Object.values(state.views)) {
        if (v.locationId !== locationId) continue;
        if (v.selected === startAt) v.selected = null;
        if (v.day) v.day.slots = v.day.slots.filter(s => s.startAt !== startAt);
      }
    });
    // Someone took the time first: it leaves every open grid for that location.
    builder.addCase(confirmBookingAsync.rejected, (state, action) => {
      if (readRejection(action, '').code !== 'SLOT_TAKEN') return;
      const { locationId, startAt } = action.meta.arg.input;
      for (const v of Object.values(state.views)) {
        if (v.locationId !== locationId || !v.day) continue;
        v.day.slots = v.day.slots.filter(s => s.startAt !== startAt);
        if (v.selected === startAt) v.selected = null;
      }
    });
  },
  selectors: {
    selectDoctorEntry: (state, id: string): DoctorEntry => state.doctors[id] ?? EMPTY,
    selectProfileView: (state, key: string): ProfileView | null => state.views[key] ?? null,
  },
});

export const { openProfileView, closeProfileView, pickSlot, showProfileDay, toggleAbout, loadDoctorAsync, chooseLocationAsync, chooseDayAsync, moreDaysAsync } =
  doctorProfileSlice.actions;
export const { selectDoctorEntry, selectProfileView } = doctorProfileSlice.selectors;
