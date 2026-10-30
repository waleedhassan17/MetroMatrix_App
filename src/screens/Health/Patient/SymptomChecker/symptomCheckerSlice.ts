// ═══════════════════════════════════════════════════════
// MetroMatrix — Symptom checker ("Not sure who to see?")
// ═══════════════════════════════════════════════════════
// What you feel in your own words, for you or a family member (their age and
// gender go with it), and the answer: a red flag (straight to Emergency), or
// up to three areas to discuss and the specialty to see — never a diagnosis.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { checkSymptomsAPI } from '@networks/health/symptomNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { Gender, SymptomResult } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { symptomResultSerializer } from '@serializers/health/recordsSerializer';

export interface SymptomCheckerSliceState {
  text: string;
  /** null = me. */
  memberId: string | null;
  result: SymptomResult | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: SymptomCheckerSliceState = { text: '', memberId: null, result: null, status: 'idle', error: NO_ERROR };

export const SYMPTOM_EXAMPLES = ['Fever and sore throat for 3 days', 'Pimples on my face for two months', 'Lower back pain after lifting', 'Child has a cough at night'];

export const symptomCheckerSlice = createAppSlice({
  name: 'symptomChecker',
  initialState,
  reducers: create => ({
    setSymptomText: create.reducer((state, action: PayloadAction<string>) => {
      state.text = action.payload;
    }),
    setSymptomFor: create.reducer((state, action: PayloadAction<string | null>) => {
      state.memberId = action.payload;
    }),
    checkSymptomsAsync: create.asyncThunk(
      async (input: { text: string; age: number | null; gender: Gender | null }, { rejectWithValue }) => {
        try {
          return required(symptomResultSerializer(await checkSymptomsAPI(input)));
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
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "That didn't go through. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectSymptomChecker: state => state,
  },
});

export const { setSymptomText, setSymptomFor, checkSymptomsAsync } = symptomCheckerSlice.actions;
export const { selectSymptomChecker } = symptomCheckerSlice.selectors;
