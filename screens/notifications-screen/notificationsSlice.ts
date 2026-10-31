// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications slice (the unread count, for bells)
// ═══════════════════════════════════════════════════════
// The list itself pages from the server (usePagedList); this holds the
// count the home bell and the store's Today show, and marks things read.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from '../../networks/notifications/notifications';
import { toRejectedValue } from '../../networks/network/network';
import { unreadCountSerializer } from '../../serializers/notificationSerializer';

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
          return await fetchUnreadCount();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = unreadCountSerializer(action.payload);
          state.unread = payload;
        },
      },
    ),
    markReadAsync: create.asyncThunk(
      async (target: { ids: string[] } | { all: true }, { rejectWithValue }) => {
        try {
          if ('all' in target) await markAllNotificationsRead();
          else await Promise.all(target.ids.map(id => markNotificationRead(id)));
          return await fetchUnreadCount();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.unread = 'all' in action.meta.arg ? 0 : Math.max(0, state.unread - action.meta.arg.ids.length);
        },
        fulfilled: (state, action) => {
          const payload = unreadCountSerializer(action.payload);
          state.unread = payload;
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
