// ═══════════════════════════════════════════════════════
// MetroMatrix — Family members (the people a patient books for)
// ═══════════════════════════════════════════════════════
// Owned by Family members; read by the booking sheet's "Who is it for",
// Health records' person filter and the symptom checker.

import { createAppSlice } from '../../store/createAppSlice';
import { getFamilyAPI, removeFamilyMemberAPI } from '../../networks/health/familyNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { FamilyMember } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { saveFamilyMemberAsync } from '../family-member-form-screen/familyMemberFormSlice';
import { familySerializer } from '../../serializers/health/recordsSerializer';

export interface FamilySliceState {
  members: FamilyMember[];
  status: FormStatus;
  error: ServerError;
  removing: string | null;
}

const initialState: FamilySliceState = { members: [], status: 'idle', error: NO_ERROR, removing: null };

export const familySlice = createAppSlice({
  name: 'family',
  initialState,
  reducers: create => ({
    loadFamilyAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(familySerializer(await getFamilyAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          if (state.status !== 'succeeded') state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.members = action.payload;
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your family members didn't load.");
        },
      },
    ),
    removeFamilyMemberAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await removeFamilyMemberAPI(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.removing = action.meta.arg;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.removing = null;
          state.members = state.members.filter(m => m.id !== action.payload);
        },
        rejected: (state, action) => {
          state.removing = null;
          state.error = readRejection(action, "They weren't removed. Try again.");
        },
      },
    ),
  }),
  extraReducers: builder => {
    builder.addCase(saveFamilyMemberAsync.fulfilled, (state, action) => {
      const i = state.members.findIndex(m => m.id === action.payload.id);
      if (i >= 0) state.members[i] = action.payload;
      else state.members.push(action.payload);
    });
  },
  selectors: {
    selectFamily: state => state,
  },
});

export const { loadFamilyAsync, removeFamilyMemberAsync } = familySlice.actions;
export const { selectFamily } = familySlice.selectors;
