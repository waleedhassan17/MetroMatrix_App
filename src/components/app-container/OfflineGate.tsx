// MetroMatrix — shown when a stored session could not be checked because the
// device is offline at cold start. The tokens are kept; Retry re-runs the
// bootstrap.

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { EmptyState, ScreenShell } from '../../Custom-Components';
import { bootstrapSession, selectAppStatus } from './appContainerSlice';

export const OfflineGate: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAppStatus);
  return (
    <ScreenShell scroll={false}>
      <EmptyState
        icon="wifi-off"
        title="You're offline"
        body="Connect to the internet to pick up where you left off."
        action={{
          label: status === 'loading' ? 'Checking' : 'Try again',
          onPress: () => dispatch(bootstrapSession()),
        }}
      />
    </ScreenShell>
  );
};

export default OfflineGate;
