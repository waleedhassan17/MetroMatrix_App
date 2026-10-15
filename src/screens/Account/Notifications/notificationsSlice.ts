// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications slice (the unread count, for bells)
// ═══════════════════════════════════════════════════════
// The list itself pages from the server (usePagedList); this holds the
// count the home bell and the store's Today show, and marks things read.

import { createAppSlice } from '@store/createAppSlice';
import { getUnreadCount, markNotificationsRead } from '@networks/notifications/notificationsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';

export interface NotificationsSliceState {
  unread: number;
}

const initialState: NotificationsSliceState = { unread: 0 };

export const notificationsSlice = createAppSlice({
  name: 'notifications',
  initialState,
  reducers: create => ({
    loadUnreadCountAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getUnreadCount();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.unread = action.payload;
        },
      },
    ),
    markReadAsync: create.asyncThunk(
      async (target: { ids: string[] } | { all: true }, { rejectWithValue }) => {
        try {
          await markNotificationsRead(target);
          return await getUnreadCount();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.unread = 'all' in action.meta.arg ? 0 : Math.max(0, state.unread - action.meta.arg.ids.length);
        },
        fulfilled: (state, action) => {
          state.unread = action.payload;
        },
      },
    ),
  }),
  selectors: {
    selectUnreadCount: state => state.unread,
  },
});

export const { loadUnreadCountAsync, markReadAsync } = notificationsSlice.actions;
export const { selectUnreadCount } = notificationsSlice.selectors;
