// MetroMatrix — Kitchen: a new Bachat Box. Typed, or started from the
// end-of-day suggestion; an optional photo; saved only when the form
// passes the API's own rules (at least 20% off, a 30-minute window today).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createBox, fetchBoxSuggestion } from '../../networks/kitchen/surplus';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyBoxForm, formFromSuggestion, type BoxForm } from '../../models/kitchen/surplusModel';
import type { LocalFile, SurplusBoxInput } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { surplusSuggestionResponseSerializer, surplusBoxSerializer } from '../../serializers/kitchen/surplusSerializer';

export interface BoxFormSliceState {
  form: BoxForm;
  /** Where the form came from: the suggestion's reason ("portions_left"), or typed. */
  basis: string | null;
  errors: ValidationErrors;
  suggesting: FormStatus;
  uploading: boolean;
  saving: boolean;
  error: ServerError;
}

const initialState: BoxFormSliceState = {
  form: emptyBoxForm(0),
  basis: null,
  errors: {},
  suggesting: 'idle',
  uploading: false,
  saving: false,
  error: NO_ERROR,
};

export const boxFormSlice = createAppSlice({
  name: 'boxForm',
  initialState,
  reducers: create => ({
    startBoxForm: create.reducer((_state, action: PayloadAction<number>) => ({ ...initialState, form: emptyBoxForm(action.payload) })),
    editBoxForm: create.reducer((state, action: PayloadAction<Partial<BoxForm>>) => {
      state.form = { ...state.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.errors[k];
    }),
    setBoxErrors: create.reducer((state, action: PayloadAction<ValidationErrors>) => {
      state.errors = action.payload;
    }),

    suggestBoxAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (required(surplusSuggestionResponseSerializer(await fetchBoxSuggestion()))).suggestion;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.suggesting = 'loading';
        },
        fulfilled: (state, action) => {
          state.suggesting = 'succeeded';
          if (action.payload) {
            state.form = formFromSuggestion(action.payload);
            state.basis = action.payload.basis;
          }
        },
        rejected: state => {
          // The suggestion is a help, not a step: the empty form stays.
          state.suggesting = 'failed';
        },
      },
    ),

    uploadBoxPhotoAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          return await uploadImage(file, 'food_surplus');
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.uploading = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = false;
          state.form.photoUrl = action.payload.url;
        },
        rejected: (state, action) => {
          state.uploading = false;
          state.error = readRejection(action, "The photo didn't upload.");
        },
      },
    ),

    createBoxAsync: create.asyncThunk(
      async (input: SurplusBoxInput, { rejectWithValue }) => {
        try {
          return required(surplusBoxSerializer(await createBox(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The Bachat Box didn't go up.");
        },
      },
    ),
  }),
  selectors: {
    selectBoxForm: state => state,
  },
});

export const { startBoxForm, editBoxForm, setBoxErrors, suggestBoxAsync, uploadBoxPhotoAsync, createBoxAsync } = boxFormSlice.actions;
export const { selectBoxForm } = boxFormSlice.selectors;
