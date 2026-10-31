// MetroMatrix — Conditions A–Z, filtered by name or the word patients use.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchConditions } from '../../networks/health/discovery';
import { toRejectedValue, required } from '../../networks/network/network';
import type { Condition } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { conditionsSerializer } from '../../serializers/health/discoverySerializer';

export interface ConditionListSliceState {
  items: Condition[];
  query: string;
  status: FormStatus;
  error: ServerError;
}

const initialState: ConditionListSliceState = { items: [], query: '', status: 'idle', error: NO_ERROR };

export const conditionListSlice = createAppSlice({
  name: 'conditionList',
  initialState,
  reducers: create => ({
    setConditionQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    loadConditionsAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return await fetchConditions(q || undefined);
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
          const payload = conditionsSerializer(action.payload);
          if (action.meta.arg !== state.query.trim()) return;
          state.items = payload;
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Conditions didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectConditionList: state => state,
  },
});

export const { setConditionQuery, loadConditionsAsync } = conditionListSlice.actions;
export const { selectConditionList } = conditionListSlice.selectors;
