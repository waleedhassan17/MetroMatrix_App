// ═══════════════════════════════════════════════════════
// MetroMatrix — Availability (locations, weekly hours, the patient view)
// ═══════════════════════════════════════════════════════
// Locations (a clinic, or video) with their fee and slot length; each one's
// week as time ranges, checked inline (and by the server) against the
// doctor's other locations; and the next days exactly as patients see them.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { deleteLocationAPI, getPreviewAPI } from '../../networks/health/doctor/practiceNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { overlapsFrom, previewSerializer } from '../../serializers/health/doctorSerializer';
import { DEFAULT_RANGE, copyToWeekdays, normaliseWeek } from '../../models/health/availabilityModel';
import type { AvailabilityPreview, DoctorLocation, DoctorLocationInput, HoursOverlap, WeekDayHours } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { createLocation, listLocations, saveHours, updateLocation } from '../shared/practiceReads';

export type AvailabilityTab = 'locations' | 'hours' | 'preview';

export const blankLocation = (kind: 'video' | 'clinic' = 'clinic'): DoctorLocationInput => ({
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
  sheet: { open: boolean; id: string | null; form: DoctorLocationInput; touched: boolean };
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
  sheet: { open: false, id: null, form: blankLocation(), touched: false },
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
    }),
    closeLocationSheet: create.reducer(state => {
      state.sheet.open = false;
    }),
    editLocation: create.reducer((state, action: PayloadAction<Partial<DoctorLocationInput>>) => {
      state.sheet.form = { ...state.sheet.form, ...action.payload };
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
    touchHours: create.reducer(state => {
      state.touchedHours = true;
    }),

    loadLocationsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await listLocations();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.locations = action.payload;
          if (!state.hoursFor || !action.payload.some(l => l.id === state.hoursFor)) startHours(state, null);
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
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.sheet.open = false;
          const i = state.locations.findIndex(l => l.id === action.payload.id);
          if (i >= 0) state.locations[i] = action.payload;
          else state.locations.push(action.payload);
          if (!state.hoursFor) startHours(state, action.payload.id);
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "The location wasn't saved.");
        },
      },
    ),
    deleteLocationAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deleteLocationAPI(id);
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
          state.error = readRejection(action, "The location wasn't removed.");
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
          state.preview = null;
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
          return required(previewSerializer(await getPreviewAPI(7)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.previewStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.previewStatus = 'succeeded';
          state.preview = action.payload;
        },
        rejected: (state, action) => {
          state.previewStatus = 'failed';
          state.error = readRejection(action, "The preview didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectAvailability: state => state,
  },
});

export const {
  setAvailabilityTab,
  openLocationSheet,
  closeLocationSheet,
  editLocation,
  touchLocation,
  chooseHoursFor,
  setDayOpen,
  addRange,
  removeRange,
  setRange,
  copyDay,
  touchHours,
  loadLocationsAsync,
  saveLocationAsync,
  deleteLocationAsync,
  saveHoursAsync,
  loadPreviewAsync,
} = availabilitySlice.actions;
export const { selectAvailability } = availabilitySlice.selectors;
