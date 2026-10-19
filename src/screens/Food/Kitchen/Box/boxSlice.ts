// MetroMatrix — Kitchen: one Bachat Box. Its reservations and the
// counter's moves (collect, no-show, confirm or reject a transfer), more or
// fewer boxes, and ending it early. Every move reads the box again.

import { createAppSlice } from '@store/createAppSlice';
import { collectReservation, confirmBoxPayment, endBox, getBox, markNoShow, rejectBoxPayment, updateBox } from '@networks/kitchen/surplusNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { SurplusBoxDetail } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export type BoxAct =
  | { kind: 'collect'; code: string }
  | { kind: 'no-show'; code: string }
  | { kind: 'confirm-payment'; code: string }
  | { kind: 'reject-payment'; code: string; reason: string }
  | { kind: 'quantity'; quantity: number }
  | { kind: 'end' };

export interface BoxSliceState {
  box: SurplusBoxDetail | null;
  status: FormStatus;
  error: ServerError;
  /** The reservation code (or 'box') a move is in flight for. */
  acting: string | null;
  actionError: ServerError;
}

const initialState: BoxSliceState = { box: null, status: 'idle', error: NO_ERROR, acting: null, actionError: NO_ERROR };

const run = (id: string, a: BoxAct) => {
  switch (a.kind) {
    case 'collect':
      return collectReservation(a.code);
    case 'no-show':
      return markNoShow(a.code);
    case 'confirm-payment':
      return confirmBoxPayment(a.code);
    case 'reject-payment':
      return rejectBoxPayment(a.code, a.reason);
    case 'quantity':
      return updateBox(id, { quantity: a.quantity });
    case 'end':
      return endBox(id);
  }
};

export const boxSlice = createAppSlice({
  name: 'kitchenBox',
  initialState,
  reducers: create => ({
    loadBoxAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getBox(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.box?.id !== action.meta.arg) state.box = null;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.box = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This Bachat Box didn't load.");
        },
      },
    ),
    boxActAsync: create.asyncThunk(
      async ({ id, act }: { id: string; act: BoxAct }, { rejectWithValue }) => {
        try {
          await run(id, act);
          return await getBox(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const a = action.meta.arg.act;
          state.acting = 'code' in a ? a.code : 'box';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          state.box = action.payload;
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectKitchenBox: state => state,
  },
});

export const { loadBoxAsync, boxActAsync } = boxSlice.actions;
export const { selectKitchenBox } = boxSlice.selectors;
