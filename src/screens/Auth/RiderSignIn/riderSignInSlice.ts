// ═══════════════════════════════════════════════════════
// MetroMatrix — Rider sign-in slice
// ═══════════════════════════════════════════════════════
// Riders have no sign-up: their vendor creates the account (Food Court →
// Riders) and hands over a username and a password, shown once. They sign in
// on the partner portal with that username (MetroMatrix-API API_AUTH.md).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { riderSignInAndOpen } from '../shared/authThunks';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';

type Field = 'username' | 'password';

export interface RiderSignInSliceState {
  username: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
}

const initialState: RiderSignInSliceState = { username: '', password: '', touched: {}, status: 'idle', error: NO_ERROR };

export const riderSignInSlice = createAppSlice({
  name: 'riderSignIn',
  initialState,
  reducers: create => ({
    setUsername: create.reducer((state, action: PayloadAction<string>) => {
      state.username = action.payload;
      state.error = NO_ERROR;
    }),
    setPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.password = action.payload;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<Field>) => {
      state.touched[action.payload] = true;
    }),
    touchAll: create.reducer(state => {
      state.touched = { username: true, password: true };
    }),

    riderSignInAsync: create.asyncThunk(
      async ({ username, password }: { username: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          return await riderSignInAndOpen(dispatch, username, password);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'idle';
          state.password = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'Sign in failed. Try again.');
        },
      },
    ),
  }),
  selectors: {
    selectRiderSignIn: state => state,
  },
});

export const { setUsername, setPassword, touch, touchAll, riderSignInAsync } = riderSignInSlice.actions;
export const { selectRiderSignIn } = riderSignInSlice.selectors;
