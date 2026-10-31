// MetroMatrix — Food Court: one dawat request (the customer's view). Its
// quotes, accepting the latest, cancelling; read again on focus.

import { createAppSlice } from '../../store/createAppSlice';
import { acceptQuote, cancelMyCatering, fetchMyCateringRequest } from '../../networks/foodGrowth/catering';
import { toRejectedValue, required } from '../../networks/network/network';
import type { CateringRequest } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringRequestSerializer } from '../../serializers/kitchen/growthSerializer';

export interface FoodCateringRequestSliceState {
  byCode: Record<string, CateringRequest>;
  status: FormStatus;
  error: ServerError;
  acting: boolean;
  actionError: ServerError;
}

const initialState: FoodCateringRequestSliceState = { byCode: {}, status: 'idle', error: NO_ERROR, acting: false, actionError: NO_ERROR };

export const foodCateringRequestSlice = createAppSlice({
  name: 'foodCateringRequest',
  initialState,
  reducers: create => ({
    loadMyCateringRequestAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(cateringRequestSerializer(await fetchMyCateringRequest(code)));
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
          if (action.payload) state.byCode[action.payload.code] = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your request didn't load.");
        },
      },
    ),
    myCateringActAsync: create.asyncThunk(
      async ({ code, act }: { code: string; act: { kind: 'accept'; version: number } | { kind: 'cancel' } }, { dispatch, rejectWithValue }) => {
        try {
          return act.kind === 'accept' ? required(cateringRequestSerializer(await acceptQuote(code, act.version))) : required(cateringRequestSerializer(await cancelMyCatering(code)));
        } catch (e) {
          // A newer quote, or an expired one: read the request again so the screen shows it.
          void dispatch(loadMyCateringRequestAsync(code));
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.acting = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = false;
          if (action.payload) state.byCode[action.payload.code] = action.payload;
        },
        rejected: (state, action) => {
          state.acting = false;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodCateringUi: state => state,
    selectMyCateringRequest: (state, code: string): CateringRequest | null => state.byCode[code.toUpperCase()] ?? null,
  },
});

export const { loadMyCateringRequestAsync, myCateringActAsync } = foodCateringRequestSlice.actions;
export const { selectFoodCateringUi, selectMyCateringRequest } = foodCateringRequestSlice.selectors;
