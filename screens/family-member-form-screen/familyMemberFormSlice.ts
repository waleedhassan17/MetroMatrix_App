// MetroMatrix — Add or edit a family member.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { addFamilyMember, updateFamilyMember } from '../../networks/health/family';
import { toRejectedValue } from '../../networks/network/network';
import { emptyFamilyMember } from '../../models/health/familyMemberModel';
import type { FamilyMember, FamilyMemberInput } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { familyMemberSerializer } from '../../serializers/health/recordsSerializer';

export interface FamilyMemberFormSliceState {
  id: string | null;
  form: FamilyMemberInput;
  touched: boolean;
  status: FormStatus;
  error: ServerError;
  /** The member just saved. */
  saved: ReturnType<typeof familyMemberSerializer>;
}

const initialState: FamilyMemberFormSliceState = { id: null, form: emptyFamilyMember(), touched: false, status: 'idle', error: NO_ERROR ,
  saved: null,
};

export const familyMemberFormSlice = createAppSlice({
  name: 'familyMemberForm',
  initialState,
  reducers: create => ({
    startFamilyForm: create.reducer((_state, action: PayloadAction<FamilyMember | null>) => {
      const m = action.payload;
      return {
        ...initialState,
        id: m?.id ?? null,
        form: m ? { name: m.name, relation: m.relation, gender: m.gender, dateOfBirth: m.dateOfBirth, phone: m.phone } : emptyFamilyMember(),
      };
    }),
    setFamilyField: create.reducer((state, action: PayloadAction<Partial<FamilyMemberInput>>) => {
      state.form = { ...state.form, ...action.payload };
    }),
    touchFamilyForm: create.reducer(state => {
      state.touched = true;
    }),
    saveFamilyMemberAsync: create.asyncThunk(
      async ({ id, form }: { id: string | null; form: FamilyMemberInput }, { rejectWithValue }) => {
        try {
          const body = { ...form, name: form.name.trim(), phone: form.phone || null };
          return id ? await updateFamilyMember(id, body) : await addFamilyMember(body);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = familyMemberSerializer(action.payload);
          state.status = 'succeeded';
          state.saved = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save them. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectFamilyForm: state => state,
  },
});

export const { startFamilyForm, setFamilyField, touchFamilyForm, saveFamilyMemberAsync } = familyMemberFormSlice.actions;
export const { selectFamilyForm } = familyMemberFormSlice.selectors;
