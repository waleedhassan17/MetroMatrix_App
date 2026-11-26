// ═══════════════════════════════════════════════════════
// MetroMatrix — Availability (locations, weekly hours, the patient view)
// ═══════════════════════════════════════════════════════
// Locations (a clinic, or video) with their fee and slot length; each one's
// week as time ranges, checked inline (and by the server) against the
// doctor's other locations; and the next days exactly as patients see them.
// The server's word on a location field lands under that field; a video
// location whose "pay before" couldn't be switched on is still saved (and
// the sheet stays on it); unsaved hours are known (`hoursDirty`).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { deleteLocation, fetchDoctorPaymentAccounts, fetchPreview } from '../../networks/health/doctor/practice';
import { errorCopy, fieldErrors, toRejectedValue } from '../../networks/network/network';
import { doctorPaymentAccountListSerializer, overlapsFrom, previewSerializer } from '../../serializers/health/doctorSerializer';
import {
  DEFAULT_RANGE,
  copyToDays,
  copyToWeekdays,
  locationFieldKey,
  normaliseWeek,
  sameWeek,
  type DoctorLocationForm,
} from '../../models/health/availabilityModel';
import type { AvailabilityPreview, DoctorLocation, DoctorLocationInput, HoursOverlap, WeekDayHours } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { createLocation, listLocations, saveHours, updateLocation } from '../shared/practiceReads';

export type AvailabilityTab = 'locations' | 'hours' | 'preview';

/** How many days the Preview tab shows (the API's most). */
export const PREVIEW_DAYS = 14;

export const blankLocation = (kind: 'video' | 'clinic' = 'clinic'): DoctorLocationForm => ({
  kind,
  name: kind === 'video' ? 'Video consultation' : '',
  area: '',
  city: '',
  address: null,
  lat: null,
  lng: null,
  phone: null,
  fee: 1500,
  slotMinutes: 15,
  instructions: null,
  requiresPrepay: false,
});

export interface AvailabilitySliceState {
  tab: AvailabilityTab;
  locations: DoctorLocation[];
  status: FormStatus;
  sheet: {
    open: boolean;
    id: string | null;
    form: DoctorLocationForm;
    touched: boolean;
    /** The server's word on a field, by the form's own key ("address"). */
    serverErrors: Record<string, string>;
    /** The map pin is being set (the map shows in the sheet). */
    pinning: boolean;
  };
  /** The doctor has an active payment account (needed before "pay before the call"). */
  hasPaymentAccount: boolean;
  /** Saved, but its "pay before" was refused: say so in the sheet, with a way to fix it. */
  prepayRefused: boolean;
  /** The location whose week is being edited, and the unsaved week. */
  hoursFor: string | null;
  draft: WeekDayHours[];
  serverOverlaps: HoursOverlap[];
  touchedHours: boolean;
  preview: AvailabilityPreview | null;
  previewStatus: FormStatus;
  busy: 'location' | 'delete' | 'hours' | null;
  error: ServerError;
}

const initialState: AvailabilitySliceState = {
  tab: 'locations',
  locations: [],
  status: 'idle',
  sheet: { open: false, id: null, form: blankLocation(), touched: false, serverErrors: {}, pinning: false },
  hasPaymentAccount: false,
  prepayRefused: false,
  hoursFor: null,
  draft: [],
  serverOverlaps: [],
  touchedHours: false,
  preview: null,
  previewStatus: 'idle',
  busy: null,
  error: NO_ERROR,
};

const startHours = (state: AvailabilitySliceState, id: string | null) => {
  const loc = state.locations.find(l => l.id === id) ?? state.locations[0];
  state.hoursFor = loc?.id ?? null;
  state.draft = normaliseWeek(loc?.hours ?? []);
  state.serverOverlaps = [];
  state.touchedHours = false;
};

export const availabilitySlice = createAppSlice({
  name: 'availability',
  initialState,
  reducers: create => ({
    setAvailabilityTab: create.reducer((state, action: PayloadAction<AvailabilityTab>) => {
      state.tab = action.payload;
      state.error = NO_ERROR;
      if (action.payload === 'hours' && !state.hoursFor) startHours(state, null);
    }),
    openLocationSheet: create.reducer((state, action: PayloadAction<{ location: DoctorLocation | null; kind?: 'video' | 'clinic' }>) => {
      const l = action.payload.location;
      state.sheet = {
        open: true,
        id: l?.id ?? null,
        touched: false,
        serverErrors: {},
        pinning: false,
        form: l
          ? {
              kind: l.kind,
              name: l.name,
              area: l.area,
              city: l.city,
              address: l.address,
              lat: l.lat,
              lng: l.lng,
              phone: l.phone,
              fee: l.fee,
              slotMinutes: l.slotMinutes,
              instructions: l.instructions,
              requiresPrepay: l.requiresPrepay,
            }
          : blankLocation(action.payload.kind),
      };
      state.error = NO_ERROR;
      state.prepayRefused = false;
    }),
    closeLocationSheet: create.reducer(state => {
      state.sheet.open = false;
      state.prepayRefused = false;
    }),
    editLocation: create.reducer((state, action: PayloadAction<Partial<DoctorLocationForm>>) => {
      state.sheet.form = { ...state.sheet.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.sheet.serverErrors[k];
    }),
    setPinning: create.reducer((state, action: PayloadAction<boolean>) => {
      state.sheet.pinning = action.payload;
    }),
    touchLocation: create.reducer(state => {
      state.sheet.touched = true;
    }),
    chooseHoursFor: create.reducer((state, action: PayloadAction<string>) => startHours(state, action.payload)),
    setDayOpen: create.reducer((state, action: PayloadAction<{ day: number; open: boolean }>) => {
      const d = state.draft.find(x => x.day === action.payload.day);
      if (d) d.ranges = action.payload.open ? [{ ...DEFAULT_RANGE }] : [];
      state.serverOverlaps = [];
    }),
    addRange: create.reducer((state, action: PayloadAction<number>) => {
      const d = state.draft.find(x => x.day === action.payload);
      if (d) d.ranges.push(d.ranges.length ? { from: '09:00', to: '12:00' } : { ...DEFAULT_RANGE });
    }),
    removeRange: create.reducer((state, action: PayloadAction<{ day: number; index: number }>) => {
      const d = state.draft.find(x => x.day === action.payload.day);
      if (d) d.ranges.splice(action.payload.index, 1);
      state.serverOverlaps = [];
    }),
    setRange: create.reducer((state, action: PayloadAction<{ day: number; index: number; field: 'from' | 'to'; value: string }>) => {
      const d = state.draft.find(x => x.day === action.payload.day);
      if (d?.ranges[action.payload.index]) d.ranges[action.payload.index][action.payload.field] = action.payload.value;
      state.serverOverlaps = [];
    }),
    copyDay: create.reducer((state, action: PayloadAction<number>) => {
      state.draft = copyToWeekdays(state.draft, action.payload);
      state.serverOverlaps = [];
    }),
    /** "Copy to…": one day's ranges onto the days the doctor ticked. */
    copyDayTo: create.reducer((state, action: PayloadAction<{ from: number; to: number[] }>) => {
      state.draft = copyToDays(state.draft, action.payload.from, action.payload.to);
      state.serverOverlaps = [];
    }),
    /** Throw the unsaved week away (back to the saved one). */
    resetHours: create.reducer(state => startHours(state, state.hoursFor)),
    touchHours: create.reducer(state => {
      state.touchedHours = true;
    }),

    loadLocationsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [locations, accounts] = await Promise.all([listLocations(), fetchDoctorPaymentAccounts()]);
          return { locations, accounts };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.locations = action.payload.locations;
          state.hasPaymentAccount = (doctorPaymentAccountListSerializer(action.payload.accounts) ?? []).some(a => a.isActive);
          if (!state.hoursFor || !action.payload.locations.some(l => l.id === state.hoursFor)) startHours(state, null);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your locations didn't load.");
        },
      },
    ),
    saveLocationAsync: create.asyncThunk(
      async ({ id, input }: { id: string | null; input: DoctorLocationInput }, { rejectWithValue }) => {
        try {
          return id ? await updateLocation(id, input) : await createLocation(input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'location';
          state.error = NO_ERROR;
          state.sheet.serverErrors = {};
          state.prepayRefused = false;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          const { location, prepayError } = action.payload;
          const added = !state.locations.some(l => l.id === location.id);
          const i = state.locations.findIndex(l => l.id === location.id);
          if (i >= 0) state.locations[i] = location;
          else state.locations.push(location);
          if (prepayError) {
            // Saved: the sheet stays on it (a retry edits it, never adds a second one).
            state.sheet.id = location.id;
            state.sheet.form.requiresPrepay = false;
            state.prepayRefused = true;
            return;
          }
          state.sheet.open = false;
          // A new location's next step is its hours.
          if (added) {
            startHours(state, location.id);
            state.tab = 'hours';
          } else if (!state.hoursFor) startHours(state, location.id);
          state.preview = null;
          state.previewStatus = 'idle';
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "The location wasn't saved.");
          const fields = Object.fromEntries(Object.entries(fieldErrors(error.details)).map(([k, m]) => [locationFieldKey(k), m]));
          state.sheet.serverErrors = fields;
          state.error = { ...error, message: Object.keys(fields).length ? 'Check the highlighted fields.' : (errorCopy(error.code, error.details) ?? error.message) };
        },
      },
    ),
    deleteLocationAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deleteLocation(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'delete';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.sheet.open = false;
          state.locations = state.locations.filter(l => l.id !== action.payload);
          if (state.hoursFor === action.payload) startHours(state, null);
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "The location wasn't removed.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),
    saveHoursAsync: create.asyncThunk(
      async ({ id, hours }: { id: string; hours: WeekDayHours[] }, { rejectWithValue }) => {
        try {
          return await saveHours(id, hours);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'hours';
          state.error = NO_ERROR;
          state.serverOverlaps = [];
        },
        fulfilled: (state, action) => {
          state.busy = null;
          const i = state.locations.findIndex(l => l.id === action.payload.id);
          if (i >= 0) state.locations[i] = action.payload;
          state.draft = normaliseWeek(action.payload.hours);
          state.touchedHours = false;
          state.preview = null;
          state.previewStatus = 'idle';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "The hours weren't saved.");
          state.serverOverlaps = overlapsFrom(state.error.details);
        },
      },
    ),
    loadPreviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchPreview(PREVIEW_DAYS);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.previewStatus = 'loading';
        },
        fulfilled: (state, action) => {
          const payload = previewSerializer(action.payload);
          state.previewStatus = 'succeeded';
          state.preview = payload;
        },
        rejected: state => {
          // Shown on the Preview tab with "Try again"; it never retries by itself.
          state.previewStatus = 'failed';
        },
      },
    ),
  }),
  selectors: {
    selectAvailability: state => state,
    /** The week being edited differs from its location's saved hours. */
    selectHoursDirty: state => {
      const loc = state.locations.find(l => l.id === state.hoursFor);
      return !!loc && !sameWeek(state.draft, loc.hours);
    },
  },
});

export const {
  setAvailabilityTab,
  openLocationSheet,
  closeLocationSheet,
  editLocation,
  setPinning,
  touchLocation,
  chooseHoursFor,
  setDayOpen,
  addRange,
  removeRange,
  setRange,
  copyDay,
  copyDayTo,
  resetHours,
  touchHours,
  loadLocationsAsync,
  saveLocationAsync,
  deleteLocationAsync,
  saveHoursAsync,
  loadPreviewAsync,
} = availabilitySlice.actions;
export const { selectAvailability, selectHoursDirty } = availabilitySlice.selectors;
