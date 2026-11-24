// MetroMatrix — shown when a stored session could not be checked at cold
// start: "You're offline" only when the device reports no connection; a
// timeout, an unreachable API or a failing one (5xx, 429) is "We can't reach
// MetroMatrix". The tokens are kept; Retry re-runs the bootstrap.

import React from 'react';
import { View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks/useReduxHooks';
import { useSignOut } from '../hooks/useSignOut';
import { Button, EmptyState, ScreenShell } from '../Custom-Components';
import { bootstrapSession, selectAppStatus, selectDownReason } from './appContainerSlice';

export const OfflineGate: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAppStatus);
  const reason = useAppSelector(selectDownReason);
  const server = reason === 'server';
  const checking = status === 'loading';
  const { signOutNow, signingOut } = useSignOut();
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
          label: checking ? 'Checking...' : 'Try again',
          onPress: () => {
            if (!checking) dispatch(bootstrapSession());
          },
        }}
      />
      {/* Never a dead end: whatever keeps failing, the person can leave this account. */}
      <View style={{ alignItems: 'center' }}>
        <Button
          label={signingOut ? 'Signing out...' : 'Sign out'}
          variant="ghost"
          size="sm"
          disabled={signingOut || checking}
          onPress={() => void signOutNow()}
        />
      </View>
    </ScreenShell>
  );
};

export default OfflineGate;
