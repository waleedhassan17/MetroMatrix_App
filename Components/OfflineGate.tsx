// MetroMatrix — shown when a stored session could not be checked at cold
// start: "You're offline" only when the device reports no connection; a
// timeout, an unreachable API or a failing one (5xx, 429) is "We can't reach
// MetroMatrix". The tokens are kept; Retry re-runs the bootstrap.

import React from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useReduxHooks';
import { EmptyState, ScreenShell } from '../Custom-Components';
import { bootstrapSession, selectAppStatus, selectDownReason } from './appContainerSlice';

export const OfflineGate: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAppStatus);
  const reason = useAppSelector(selectDownReason);
  const server = reason === 'server';
  return (
    <ScreenShell scroll={false}>
      <EmptyState
        icon={server ? 'cloud-off' : 'wifi-off'}
        title={server ? "We can't reach MetroMatrix" : "You're offline"}
        body={
          server
            ? "MetroMatrix isn't answering right now. You're still signed in — try again in a moment."
            : 'Connect to the internet to pick up where you left off.'
        }
        action={{
          label: status === 'loading' ? 'Checking' : 'Try again',
          onPress: () => dispatch(bootstrapSession()),
        }}
      />
    </ScreenShell>
  );
};

export default OfflineGate;
