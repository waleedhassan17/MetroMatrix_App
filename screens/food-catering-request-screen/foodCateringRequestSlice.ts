// MetroMatrix — Food Court: one dawat request (the customer's view). Its
// quotes, accepting the latest, cancelling; read again on focus.

import { createAppSlice } from '../../store/createAppSlice';
import { acceptQuote, cancelMyCatering, fetchMyCateringRequests } from '../../networks/foodGrowth/catering';
import { myCateringId } from '../shared/growthReads';
import { toRejectedValue } from '../../networks/network/network';
import type { CateringRequest } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringRequestByCodeSerializer, cateringRequestSerializer } from '../../serializers/kitchen/growthSerializer';

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
          // The customer's list holds each request whole.
          return await fetchMyCateringRequests();
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
          const payload = cateringRequestByCodeSerializer(action.payload, action.meta.arg);
          state.status = payload ? 'succeeded' : 'failed';
          if (payload) state.byCode[payload.code] = payload;
          else state.error = { ...NO_ERROR, code: 'NOT_FOUND', message: 'This request isn’t one of yours.' };
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your request didn't load.");
        },
      },
    ),
    myCateringActAsync: create.asyncThunk(
      async ({ code, act }: { code: string; act: { kind: 'accept'; version: number } | { kind: 'cancel'; reason: string } }, { dispatch, getState, rejectWithValue }) => {
        try {
          const id = (getState() as { foodCateringRequest: FoodCateringRequestSliceState }).foodCateringRequest.byCode[code.toUpperCase()]?.id ?? (await myCateringId(code));
          return act.kind === 'accept' ? await acceptQuote(id, act.version) : await cancelMyCatering(id, act.reason);
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
          const payload = cateringRequestSerializer(action.payload);
          state.acting = false;
          if (payload) state.byCode[payload.code] = payload;
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
