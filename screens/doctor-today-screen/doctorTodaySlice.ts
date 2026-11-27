// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the doctor's dashboard)
// ═══════════════════════════════════════════════════════
// The day's visits in queue order, filtered by location, and the queue moves:
// check in → start → complete ("Payment collected?" for pay-at-visit, then
// "Write the prescription now?"). A move calls its one endpoint and the queue
// reloads quietly: it never reads the visit's notes (each read of them is a
// patient-record audit), so a tap is two requests, not six.
//
// The dashboard around the queue (profile strength, the week's recorded fees
// and visits, the reviews, the next free time) is one parallel read on focus;
// only the queue polls. Every answer carries its request id: an older one (a
// location chip tapped twice, a slow poll) never overwrites a newer one.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  actOnAppointment,
  completeAppointment,
  fetchDoctorToday,
  type DoctorAction,
} from '../../networks/health/doctor/doctorAppointments';
import { fetchDoctorLocations, fetchOwnSlots } from '../../networks/health/doctor/practice';
import { fetchCompleteness } from '../../networks/health/doctor/profile';
import { fetchInsights } from '../../networks/health/doctor/doctorInsights';
import { fetchOwnReviewSummary } from '../../networks/health/doctor/doctorReviews';
import { errorCopy, toRejectedValue } from '../../networks/network/network';
import { completenessSerializer, doctorDaySerializer, insightsSerializer } from '../../serializers/health/doctorSerializer';
import { reviewSummarySerializer, slotsSerializer } from '../../serializers/health/discoverySerializer';
import { bodyOf } from '../../serializers/serializerUtils';
import type { Completeness, DoctorInsights, DoctorReviewSummary, TodaySummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

/** The queue's three views: who is here, who is still to come, who is done with. */
export type QueueTab = 'waiting' | 'upcoming' | 'done';

export interface TodayDashboard {
  completeness: Completeness | null;
  insights: DoctorInsights | null;
  reviews: DoctorReviewSummary | null;
  /** The next free time today at any location in use (ISO), or null when the day is full. */
  nextFree: string | null;
  loaded: boolean;
}

export interface DoctorTodaySliceState {
  today: TodaySummary | null;
  locationId: string | null;
  queueTab: QueueTab;
  /** The queue tab was picked by hand: the screen stops choosing it. */
  queueTabPicked: boolean;
  status: FormStatus;
  /** The latest load's request id. */
  requestId: string | null;
  busy: string | null;
  /** The completion sheet: which visit, which question, and which answer is on the wire. */
  complete: { id: string | null; step: 'payment' | 'prescription'; payAtVisit: boolean; answering: 'paid' | 'not_paid' | null };
  /** Loading the day failed (shown at the top, cleared by the next good read). */
  error: ServerError;
  /** A quiet refresh failed: the queue on screen may be out of date. */
  stale: boolean;
  /** A row's own move failed (shown on that row). */
  rowError: { id: string; message: string } | null;
  /** Completing failed while the sheet was open (shown in the sheet). */
  completeError: string | null;
  dashboard: TodayDashboard;
}

const initialState: DoctorTodaySliceState = {
  today: null,
  locationId: null,
  queueTab: 'waiting',
  queueTabPicked: false,
  status: 'idle',
  requestId: null,
  busy: null,
  complete: { id: null, step: 'payment', payAtVisit: false, answering: null },
  error: NO_ERROR,
  stale: false,
  rowError: null,
  completeError: null,
  dashboard: { completeness: null, insights: null, reviews: null, nextFree: null, loaded: false },
};

/** A part of the dashboard that failed reads as missing; the rest still shows. */
const settle = (p: Promise<unknown>): Promise<unknown> => p.catch(() => null);

export const doctorTodaySlice = createAppSlice({
  name: 'doctorToday',
  initialState,
  reducers: create => ({
    setTodayLocation: create.reducer((state, action: PayloadAction<string | null>) => {
      state.locationId = action.payload;
    }),
    setQueueTab: create.reducer((state, action: PayloadAction<QueueTab>) => {
      state.queueTab = action.payload;
      state.queueTabPicked = true;
    }),
    openComplete: create.reducer((state, action: PayloadAction<{ id: string; payAtVisit: boolean }>) => {
      state.complete = {
        id: action.payload.id,
        step: action.payload.payAtVisit ? 'payment' : 'prescription',
        payAtVisit: action.payload.payAtVisit,
        answering: null,
      };
      state.completeError = null;
    }),
    closeComplete: create.reducer(state => {
      state.complete.id = null;
    }),
    clearRowError: create.reducer(state => {
      state.rowError = null;
    }),
    loadTodayAsync: create.asyncThunk(
      async ({ locationId }: { locationId: string | null; quiet?: boolean }, { rejectWithValue }) => {
        try {
          const [day, locations] = await Promise.all([fetchDoctorToday(), fetchDoctorLocations()]);
          return { day, locations, locationId };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.requestId = action.meta.requestId;
          if (!action.meta.arg.quiet) state.status = 'loading';
        },
        fulfilled: (state, action) => {
          if (action.meta.requestId !== state.requestId) return;
          state.status = 'succeeded';
          state.error = NO_ERROR;
          state.stale = false;
          const { day, locations, locationId } = action.payload;
          const read = doctorDaySerializer({ day, locations }, null, locationId);
          if (!read) return;
          state.today = read;
          // A chip for a location that's gone: back to all of them.
          if (state.locationId && !read.locations.some(l => l.id === state.locationId)) state.locationId = null;
          // Until the doctor picks a tab, open the one with someone in it.
          if (!state.queueTabPicked) {
            const c = read.counts;
            state.queueTab = c.waiting + c.withDoctor > 0 ? 'waiting' : c.upcoming > 0 ? 'upcoming' : c.seen + c.missed > 0 ? 'done' : 'waiting';
          }
        },
        rejected: (state, action) => {
          if (action.meta.requestId !== state.requestId) return;
          state.status = 'failed';
          if (action.meta.arg.quiet) state.stale = true;
          else state.error = readRejection(action, "Today's queue didn't load.");
        },
      },
    ),
    /**
     * Profile strength, the last 7 days, the reviews and the next free time
     * today (only from a server with the doctor's own slots). Each part may
     * fail on its own.
     */
    loadDashboardAsync: create.asyncThunk(
      async ({ locationIds, slots }: { locationIds: string[]; slots: boolean }) => {
        const [completeness, insights, reviews, ...free] = await Promise.all([
          settle(fetchCompleteness()),
          settle(fetchInsights('7d')),
          settle(fetchOwnReviewSummary()),
          ...(slots ? locationIds.map(id => settle(fetchOwnSlots(id, null, 1))) : []),
        ]);
        return { completeness, insights, reviews, free };
      },
      {
        fulfilled: (state, action) => {
          const { completeness, insights, reviews, free } = action.payload;
          const now = Date.now();
          const next = free
            .flatMap(raw => (raw ? slotsSerializer(bodyOf(raw)) : []))
            .map(s => s.startAt)
            .filter(at => Date.parse(at) > now)
            .sort()[0];
          state.dashboard = {
            completeness: completeness ? completenessSerializer(completeness) : state.dashboard.completeness,
            insights: insights ? insightsSerializer(insights) : state.dashboard.insights,
            reviews: reviews ? reviewSummarySerializer(reviews) : state.dashboard.reviews,
            nextFree: next ?? null,
            loaded: true,
          };
        },
      },
    ),
    queueActionAsync: create.asyncThunk(
      async ({ id, action }: { id: string; action: DoctorAction }, { rejectWithValue }) => {
        try {
          return await actOnAppointment(id, action);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.rowError = null;
        },
        fulfilled: state => {
          state.busy = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "That didn't go through. Pull down to refresh, then try again.");
          state.rowError = { id: action.meta.arg.id, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),
    completeVisitAsync: create.asyncThunk(
      async ({ id, paymentCollected }: { id: string; paymentCollected: boolean }, { rejectWithValue }) => {
        try {
          return await completeAppointment(id, paymentCollected);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.rowError = null;
          if (state.complete.id === action.meta.arg.id) state.complete.answering = action.meta.arg.paymentCollected ? 'paid' : 'not_paid';
          state.completeError = null;
        },
        fulfilled: state => {
          state.busy = null;
          state.complete.answering = null;
          state.complete.step = 'prescription';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.complete.answering = null;
          const error = readRejection(action, "The visit wasn't completed. Try again.");
          const message = errorCopy(error.code, error.details) ?? error.message;
          // In the sheet when it's open (pay at the clinic); on the row otherwise.
          if (state.complete.id === action.meta.arg.id) state.completeError = message;
          else state.rowError = { id: action.meta.arg.id, message };
        },
      },
    ),
  }),
  selectors: {
    selectDoctorToday: state => state,
  },
});

export const {
  setTodayLocation,
  setQueueTab,
  openComplete,
  closeComplete,
  clearRowError,
  loadTodayAsync,
  loadDashboardAsync,
  queueActionAsync,
  completeVisitAsync,
} = doctorTodaySlice.actions;
export const { selectDoctorToday } = doctorTodaySlice.selectors;
