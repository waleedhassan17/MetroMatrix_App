// ═══════════════════════════════════════════════════════
// MetroMatrix — Account paused (business suspended)
// ═══════════════════════════════════════════════════════
// Reached when /auth/me reports a suspended business — including mid-session,
// via the 403 BUSINESS_SUSPENDED bridge (QA 22). No slice: "Check again"
// re-reads the session (refreshSession), and the gate moves on if staff
// reinstated the business; otherwise it says so.

import React, { useState } from 'react';
import { Linking } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useSignOut } from '../../hooks/useSignOut';
import { SUPPORT_EMAIL } from '../../config/env';
import { Button, Card, EmptyState, InlineNotice, ListRow, ScreenShell } from '../../Custom-Components/index';
import { refreshSession } from '../../Components/appContainerSlice';
import { selectBusiness } from '../../store/authSlice';

const Suspended: React.FC = () => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'still' | 'failed' | null>(null);

  const checkAgain = async () => {
    setChecking(true);
    setResult(null);
    const r = await dispatch(refreshSession());
    setChecking(false);
    // Reinstated: the gate replaces this screen. Otherwise say what happened.
    setResult(refreshSession.fulfilled.match(r) && r.payload ? 'still' : 'failed');
  };

  return (
    <ScreenShell
      title="Account paused"
      footer={<Button label="Sign out" variant="secondary" onPress={confirmSignOut} fullWidth />}>
      <EmptyState
        icon="pause-circle-outline"
        title={business?.name ?? 'Your business'}
        body="Customers can't see your business while it's paused."
      />
      <InlineNotice
        tone="warning"
        title="Reason"
        message={business?.suspensionReason ?? 'Our team paused this account. Contact support to find out why.'}
      />
      <Card padded="horizontal">
        <ListRow
          title="Contact support"
          subtitle={SUPPORT_EMAIL}
          leftIcon="mail-outline"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Paused%20account`)}
        />
      </Card>
      {result ? (
        <InlineNotice
          tone={result === 'still' ? 'info' : 'warning'}
          message={
            result === 'still'
              ? 'Still paused. We will open your business as soon as our team reinstates it.'
              : "We can't reach MetroMatrix right now. Please try again in a moment."
          }
        />
      ) : null}
      <Button label={checking ? 'Checking...' : 'Check again'} variant="ghost" loading={checking} disabled={checking} onPress={() => void checkAgain()} />
    </ScreenShell>
  );
};

export default Suspended;
