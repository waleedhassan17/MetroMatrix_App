// ═══════════════════════════════════════════════════════
// MetroMatrix — Account paused (business suspended)
// ═══════════════════════════════════════════════════════
// Reached when /auth/me reports a suspended business — including mid-session,
// via the 403 BUSINESS_SUSPENDED bridge (QA 22). Stateless.

import React from 'react';
import { Linking } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { useSignOut } from '../../../hooks/useSignOut';
import { SUPPORT_EMAIL } from '../../../config/env';
import { Button, Card, EmptyState, InlineNotice, ListRow, ScreenShell } from '../../../Custom-Components/index';
import { refreshSession } from '../../../Components/app-container/appContainerSlice';
import { selectBusiness } from '../../Auth/authSlice';

const SuspendedScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();

  return (
    <ScreenShell
      title="Account paused"
      footer={<Button label="Sign out" variant="secondary" onPress={confirmSignOut} fullWidth />}>
      <EmptyState
        icon="pause-circle"
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
      <Button label="Check again" variant="ghost" onPress={() => dispatch(refreshSession())} />
    </ScreenShell>
  );
};

export default SuspendedScreen;
