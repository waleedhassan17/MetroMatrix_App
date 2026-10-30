// MetroMatrix — Kitchen growth: tiffin subscribers (one plan's, or all).
// Approve or decline a request, pause, resume or end a subscription, and
// confirm (or reject) a period's payment. Every move answers the
// subscription; the list and its counts are read again.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { confirmTiffinPaymentAPI, getMyTiffinPlanAPI, getPlanSubscribersAPI, getTiffinSubscriptionsAPI, moveSubscriberAPI, rejectTiffinPaymentAPI, type SubscriberMove } from '@networks/foodGrowth/tiffinNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { TiffinInbox, TiffinPlan } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { tiffinInboxSerializer, tiffinPlanSerializer, tiffinSubscriptionSerializer } from '@serializers/kitchen/growthSerializer';

export type SubscribersTab = 'pending' | 'active' | 'paused' | 'ended';

/** A subscriber move: its kind is the path, the rest the body. */
const moveSubscriber = async (code: string, { kind, ...body }: SubscriberMove) =>
  required(tiffinSubscriptionSerializer(await moveSubscriberAPI(code, kind, body)));

export type SubscriberAct = SubscriberMove | { kind: 'confirm-payment'; periodId: string } | { kind: 'reject-payment'; periodId: string; reason: string };

export interface TiffinSubscribersSliceState {
  planId: string | null;
  plan: TiffinPlan | null;
  inbox: TiffinInbox | null;
  tab: SubscribersTab;
  status: FormStatus;
  error: ServerError;
  /** The subscription a move is in flight for. */
  acting: string | null;
  actionError: ServerError;
}

const initialState: TiffinSubscribersSliceState = { planId: null, plan: null, inbox: null, tab: 'pending', status: 'idle', error: NO_ERROR, acting: null, actionError: NO_ERROR };

export const tiffinSubscribersSlice = createAppSlice({
  name: 'tiffinSubscribers',
  initialState,
  reducers: create => ({
    setSubscribersTab: create.reducer((state, action: PayloadAction<SubscribersTab>) => {
      state.tab = action.payload;
      state.actionError = NO_ERROR;
    }),
    loadSubscribersAsync: create.asyncThunk(
      async (planId: string | null, { rejectWithValue }) => {
        try {
          const [inbox, plan] = await Promise.all([planId ? getPlanSubscribersAPI(planId).then(raw => required(tiffinInboxSerializer(raw))) : getTiffinSubscriptionsAPI().then(raw => required(tiffinInboxSerializer(raw))), planId ? getMyTiffinPlanAPI(planId).then(raw => required(tiffinPlanSerializer(raw))) : Promise.resolve(null)]);
          return { inbox, plan };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.planId !== action.meta.arg) {
            state.inbox = null;
            state.plan = null;
          }
          state.planId = action.meta.arg;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.inbox = action.payload.inbox;
          state.plan = action.payload.plan;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Subscribers didn't load.");
        },
      },
    ),
    subscriberActAsync: create.asyncThunk(
      async ({ code, act }: { code: string; act: SubscriberAct }, { getState, dispatch, rejectWithValue }) => {
        try {
          const out =
            act.kind === 'confirm-payment' ? required(tiffinSubscriptionSerializer(await confirmTiffinPaymentAPI(act.periodId))) : act.kind === 'reject-payment' ? required(tiffinSubscriptionSerializer(await rejectTiffinPaymentAPI(act.periodId, act.reason))) : await moveSubscriber(code, act);
          void dispatch(loadSubscribersAsync((getState() as { tiffinSubscribers: TiffinSubscribersSliceState }).tiffinSubscribers.planId));
          return out;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg.code;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          if (state.inbox && action.payload) state.inbox.items = state.inbox.items.map(x => (x.code === action.payload!.code ? action.payload! : x));
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectTiffinSubscribers: state => state,
  },
});

export const { setSubscribersTab, loadSubscribersAsync, subscriberActAsync } = tiffinSubscribersSlice.actions;
export const { selectTiffinSubscribers } = tiffinSubscribersSlice.selectors;
