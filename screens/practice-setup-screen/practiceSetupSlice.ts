// ═══════════════════════════════════════════════════════
// MetroMatrix — Practice setup (the doctor's checklist, then Publish)
// ═══════════════════════════════════════════════════════
// The server says what's done; Publish lists the doctor for patients and
// answers with the business (isListed), which the session takes on.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchCompleteness } from '../../networks/health/doctor/profile';
import { toRejectedValue, required } from '../../networks/network/network';
import type { Completeness } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { setBusiness } from '../../store/authSlice';
import { completenessSerializer } from '../../serializers/health/doctorSerializer';
import { publishProfile } from '../shared/practiceReads';

export interface PracticeSetupSliceState {
  completeness: Completeness | null;
  status: FormStatus;
  publishing: boolean;
  error: ServerError;
}

const initialState: PracticeSetupSliceState = { completeness: null, status: 'idle', publishing: false, error: NO_ERROR };

export const practiceSetupSlice = createAppSlice({
  name: 'practiceSetup',
  initialState,
  reducers: create => ({
    loadCompletenessAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(completenessSerializer(await fetchCompleteness()));
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
          state.completeness = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your checklist didn't load.");
        },
      },
    ),
    publishAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          const business = await publishProfile();
          dispatch(setBusiness(business));
          return business;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.publishing = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.publishing = false;
          if (state.completeness) state.completeness = { ...state.completeness, isListed: true, canPublish: false };
        },
        rejected: (state, action) => {
          state.publishing = false;
          state.error = readRejection(action, "You weren't listed yet. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectPracticeSetup: state => state,
  },
});

export const { loadCompletenessAsync, publishAsync } = practiceSetupSlice.actions;
export const { selectPracticeSetup } = practiceSetupSlice.selectors;
