// ═══════════════════════════════════════════════════════
// MetroMatrix — the live connection's state
// ═══════════════════════════════════════════════════════
// Fed by the one realtime client (services/realtime/socketClient.ts) through
// AppContainer. Live screens read it to say "Reconnecting…" and to fall back
// to polling while the connection has been down longer than
// motion.socketGrace. Account-scoped: a sign-out resets it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { RealtimeStatus } from '../services/realtime/socketClient';

export interface RealtimeSliceState {
  status: RealtimeStatus;
  /** When the connection last went down (ISO); null while connected or idle. */
  downSince: string | null;
  /** Reconnects since the session began — each one triggered a REST resync. */
  reconnects: number;
}

const initialState: RealtimeSliceState = { status: 'idle', downSince: null, reconnects: 0 };

export const realtimeSlice = createAppSlice({
  name: 'realtime',
  initialState,
  reducers: create => ({
    setRealtimeStatus: create.reducer((state, action: PayloadAction<{ status: RealtimeStatus; at: string }>) => {
      const { status, at } = action.payload;
      if (status === 'connected' && state.downSince) state.reconnects += 1;
      if (status === 'reconnecting' && !state.downSince) state.downSince = at;
      if (status === 'connected' || status === 'idle') state.downSince = null;
      state.status = status;
    }),
  }),
  selectors: {
    selectRealtimeStatus: state => state.status,
    selectRealtimeDownSince: state => state.downSince,
    selectRealtimeReconnects: state => state.reconnects,
  },
});

export const { setRealtimeStatus } = realtimeSlice.actions;
export const { selectRealtimeStatus, selectRealtimeDownSince, selectRealtimeReconnects } = realtimeSlice.selectors;
