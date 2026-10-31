// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Food vendor slice
// ═══════════════════════════════════════════════════════
// One vendor, kept by id, and the staff moves on it: feature, suspend or
// reinstate (with a reason the owner sees), the home kitchen's food-safety
// check, and plan overrides. Every move reads the vendor again: REST is the
// truth.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  fetchAdminFoodVendor,
  recordFoodSafetyCheck,
  setVendorFeatured,
  setVendorPlanOverrides,
  setVendorSuspended,
} from '../../networks/admin/adminFood';
import { toRejectedValue, required } from '../../networks/network/network';
import type { AdminFoodVendor, PlanOverrides } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { adminFoodVendorSerializer, adminFeaturedSerializer } from '../../serializers/food/adminFoodSerializer';

export type AdminVendorSheet = 'suspend' | 'reinstate' | 'safety' | 'plan';

export interface AdminFoodVendorEntry {
  vendor: AdminFoodVendor | null;
  status: FormStatus;
  error: ServerError;
}

export interface AdminFoodVendorSliceState {
  byId: Record<string, AdminFoodVendorEntry>;
  /**
   * Featured, by vendor id: from the list row that opened it, then from each
   * feature / unfeature answer. TODO(API_FOOD): GET /admin/food/vendors/:id
   * doesn't send isFeatured.
   */
  featured: Record<string, boolean>;
  sheet: AdminVendorSheet | null;
  reason: string;
  safetyOutcome: 'passed' | 'failed';
  note: string;
  /** Plan form: limits as typed ('' keeps the plan's own), entitlements on or off. */
  limits: Record<string, string>;
  entitlements: Record<string, boolean>;
  touched: boolean;
  /** The move in flight: the toggle and the sheets wait on their own. */
  busy: Move['kind'] | null;
  error: ServerError;
}

const EMPTY: AdminFoodVendorEntry = { vendor: null, status: 'idle', error: NO_ERROR };
const initialState: AdminFoodVendorSliceState = {
  byId: {},
  featured: {},
  sheet: null,
  reason: '',
  safetyOutcome: 'passed',
  note: '',
  limits: {},
  entitlements: {},
  touched: false,
  busy: null,
  error: NO_ERROR,
};

type Move =
  | { kind: 'feature'; featured: boolean }
  | { kind: 'suspend'; suspend: boolean; reason: string }
  | { kind: 'safety'; branchId: string; outcome: 'passed' | 'failed'; note: string }
  | { kind: 'plan'; overrides: PlanOverrides | null };

export const adminFoodVendorSlice = createAppSlice({
  name: 'adminFoodVendor',
  initialState,
  reducers: create => ({
    seedFeatured: create.reducer(
      (state, action: PayloadAction<{ id: string; featured: boolean }>) => {
        state.featured[action.payload.id] ??= action.payload.featured;
      },
    ),
    openVendorSheet: create.reducer(
      (
        state,
        action: PayloadAction<{ sheet: AdminVendorSheet | null; vendor?: AdminFoodVendor }>,
      ) => {
        state.sheet = action.payload.sheet;
        state.reason = '';
        state.note = '';
        state.safetyOutcome = 'passed';
        state.touched = false;
        state.error = NO_ERROR;
        const plan = action.payload.vendor?.plan;
        if (action.payload.sheet === 'plan' && plan) {
          state.limits = Object.fromEntries(
            Object.entries(plan.overrides.limits ?? {}).map(([k, v]) => [k, String(v)]),
          );
          state.entitlements = { ...plan.entitlements };
        }
      },
    ),
    setVendorReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload.slice(0, 500);
    }),
    setSafetyOutcome: create.reducer((state, action: PayloadAction<'passed' | 'failed'>) => {
      state.safetyOutcome = action.payload;
    }),
    setSafetyNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 1000);
    }),
    setPlanLimit: create.reducer((state, action: PayloadAction<{ key: string; value: string }>) => {
      state.limits[action.payload.key] = action.payload.value.replace(/[^0-9]/g, '').slice(0, 5);
    }),
    setPlanEntitlement: create.reducer(
      (state, action: PayloadAction<{ key: string; on: boolean }>) => {
        state.entitlements[action.payload.key] = action.payload.on;
      },
    ),
    touchVendorSheet: create.reducer(state => {
      state.touched = true;
    }),

    loadAdminFoodVendorAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchAdminFoodVendor(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = adminFoodVendorSerializer(action.payload);
          state.byId[action.meta.arg] = {
            vendor: payload,
            status: 'succeeded',
            error: NO_ERROR,
          };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't load this vendor.");
        },
      },
    ),

    moveVendorAsync: create.asyncThunk(
      async ({ id, move }: { id: string; move: Move }, { rejectWithValue }) => {
        try {
          let featured: boolean | undefined;
          if (move.kind === 'feature')
            featured = (required(adminFeaturedSerializer(await setVendorFeatured(id, move.featured)))).isFeatured;
          else if (move.kind === 'suspend') await setVendorSuspended(id, move.suspend, move.reason);
          else if (move.kind === 'safety')
            await recordFoodSafetyCheck(move.branchId, move.outcome, move.note);
          else await setVendorPlanOverrides(id, move.overrides);
          return { vendor: required(adminFoodVendorSerializer(await fetchAdminFoodVendor(id))), featured };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.move.kind;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          // Only the sheet that made this move closes (a toggle never closes one).
          if (action.meta.arg.move.kind !== 'feature') state.sheet = null;
          state.byId[action.meta.arg.id] = {
            vendor: action.payload.vendor,
            status: 'succeeded',
            error: NO_ERROR,
          };
          if (action.payload.featured !== undefined)
            state.featured[action.meta.arg.id] = action.payload.featured;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminFoodVendorUi: state => state,
    selectAdminFoodVendorEntry: (state, id: string) => state.byId[id] ?? EMPTY,
  },
});

export const {
  seedFeatured,
  openVendorSheet,
  setVendorReason,
  setSafetyOutcome,
  setSafetyNote,
  setPlanLimit,
  setPlanEntitlement,
  touchVendorSheet,
  loadAdminFoodVendorAsync,
  moveVendorAsync,
} = adminFoodVendorSlice.actions;
export const { selectAdminFoodVendorUi, selectAdminFoodVendorEntry } =
  adminFoodVendorSlice.selectors;
