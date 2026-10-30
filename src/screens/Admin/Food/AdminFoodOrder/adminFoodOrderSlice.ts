// MetroMatrix — Admin Food order slice: one order with every event, by id.

import { createAppSlice } from '@store/createAppSlice';
import { getAdminFoodOrderAPI } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminFoodOrder } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';
import { adminFoodOrderSerializer } from '@serializers/food/adminFoodSerializer';

export interface AdminFoodOrderEntry {
  order: AdminFoodOrder | null;
  status: FormStatus;
  error: ServerError;
}

export interface AdminFoodOrderSliceState {
  byId: Record<string, AdminFoodOrderEntry>;
}

const EMPTY: AdminFoodOrderEntry = { order: null, status: 'idle', error: NO_ERROR };
const initialState: AdminFoodOrderSliceState = { byId: {} };

export const adminFoodOrderSlice = createAppSlice({
  name: 'adminFoodOrder',
  initialState,
  reducers: create => ({
    loadAdminFoodOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(adminFoodOrderSerializer(await getAdminFoodOrderAPI(id)));
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
          state.byId[action.meta.arg] = {
            order: action.payload,
            status: 'succeeded',
            error: NO_ERROR,
          };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't load this order.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminFoodOrderEntry: (state, id: string) => state.byId[id] ?? EMPTY,
  },
});

export const { loadAdminFoodOrderAsync } = adminFoodOrderSlice.actions;
export const { selectAdminFoodOrderEntry } = adminFoodOrderSlice.selectors;
