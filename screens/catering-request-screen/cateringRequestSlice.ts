// MetroMatrix — Kitchen growth: one catering request (the kitchen's view).
// Its quotes, declining it, and the advance: confirmed when it is in the
// kitchen's account, or the receipt sent back with a reason.

import { createAppSlice } from '../../store/createAppSlice';
import { confirmAdvance, declineCatering, fetchCateringRequest, rejectAdvance } from '../../networks/foodGrowth/catering';
import { toRejectedValue, required } from '../../networks/network/network';
import type { CateringRequest } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringRequestSerializer } from '../../serializers/kitchen/growthSerializer';

export type CateringAct = { kind: 'decline'; reason: string } | { kind: 'confirm-advance' } | { kind: 'reject-advance'; reason: string };

export interface CateringRequestSliceState {
  byCode: Record<string, CateringRequest>;
  status: FormStatus;
  error: ServerError;
  acting: boolean;
  actionError: ServerError;
}

const initialState: CateringRequestSliceState = { byCode: {}, status: 'idle', error: NO_ERROR, acting: false, actionError: NO_ERROR };

export const cateringRequestSlice = createAppSlice({
  name: 'cateringRequest',
  initialState,
  reducers: create => ({
    loadCateringRequestAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(cateringRequestSerializer(await fetchCateringRequest(code)));
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
          state.error = readRejection(action, "This request didn't load.");
        },
      },
    ),
    cateringActAsync: create.asyncThunk(
      async ({ code, act }: { code: string; act: CateringAct }, { rejectWithValue }) => {
        try {
          return act.kind === 'decline' ? required(cateringRequestSerializer(await declineCatering(code, act.reason))) : act.kind === 'confirm-advance' ? required(cateringRequestSerializer(await confirmAdvance(code))) : required(cateringRequestSerializer(await rejectAdvance(code, act.reason)));
        } catch (e) {
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
    selectCateringRequestUi: state => state,
    selectCateringRequest: (state, code: string): CateringRequest | null => state.byCode[code.toUpperCase()] ?? null,
  },
});

export const { loadCateringRequestAsync, cateringActAsync } = cateringRequestSlice.actions;
export const { selectCateringRequestUi, selectCateringRequest } = cateringRequestSlice.selectors;
