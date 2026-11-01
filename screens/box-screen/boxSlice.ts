// MetroMatrix — Kitchen: one Bachat Box. Its reservations and the
// counter's moves (collect, no-show, confirm or reject a transfer), more or
// fewer boxes, and ending it early. Every move reads the box again.

import { createAppSlice } from '../../store/createAppSlice';
import { cancelBox, collectReservation, confirmBoxPayment, fetchBoxReservations, fetchBoxes, markNoShow, rejectBoxPayment, updateBox } from '../../networks/kitchen/surplus';
import { toRejectedValue } from '../../networks/network/network';
import type { SurplusBoxDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { surplusBoxDetailSerializer } from '../../serializers/kitchen/surplusSerializer';

/** Reservation moves name the reservation (`id`); collecting also checks the code the customer shows. */
export type BoxAct =
  | { kind: 'collect'; id: string; code: string }
  | { kind: 'no-show'; id: string }
  | { kind: 'confirm-payment'; id: string }
  | { kind: 'reject-payment'; id: string; reason: string }
  | { kind: 'quantity'; quantity: number }
  /** `taken`: boxes already reserved or collected. With none, the box comes down; else it closes at that. */
  | { kind: 'end'; taken: number };

export interface BoxSliceState {
  box: SurplusBoxDetail | null;
  status: FormStatus;
  error: ServerError;
  /** The reservation id (or 'box') a move is in flight for. */
  acting: string | null;
  actionError: ServerError;
}

const initialState: BoxSliceState = { box: null, status: 'idle', error: NO_ERROR, acting: null, actionError: NO_ERROR };

const run = (id: string, a: BoxAct): Promise<unknown> => {
  switch (a.kind) {
    case 'collect':
      return collectReservation(a.id, a.code);
    case 'no-show':
      return markNoShow(a.id);
    case 'confirm-payment':
      return confirmBoxPayment(a.id);
    case 'reject-payment':
      return rejectBoxPayment(a.id, a.reason);
    case 'quantity':
      return updateBox(id, { quantity: a.quantity });
    case 'end':
      return a.taken > 0 ? updateBox(id, { quantity: a.taken }) : cancelBox(id);
  }
};

/** The box (from the kitchen's list; there is no single read) and its reservations. */
const readBox = async (id: string) => {
  const [boxes, reservations] = await Promise.all([fetchBoxes(), fetchBoxReservations(id)]);
  return { boxes, reservations };
};

export const boxSlice = createAppSlice({
  name: 'kitchenBox',
  initialState,
  reducers: create => ({
    loadBoxAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await readBox(id);
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
          const payload = surplusBoxDetailSerializer(action.payload, action.meta.arg);
          state.status = payload ? 'succeeded' : 'failed';
          state.box = payload;
          if (!payload) state.error = { ...NO_ERROR, code: 'NOT_FOUND', message: 'This Bachat Box isn’t one of yours any more.' };
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
          return await readBox(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const a = action.meta.arg.act;
          state.acting = 'id' in a ? a.id : 'box';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = surplusBoxDetailSerializer(action.payload, action.meta.arg.id);
          state.acting = null;
          if (payload) state.box = payload;
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
