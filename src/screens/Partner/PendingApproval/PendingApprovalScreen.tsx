// ═══════════════════════════════════════════════════════
// MetroMatrix — Under review
// ═══════════════════════════════════════════════════════
// Submitted → Under review → Approved. Polls every 30 s while this screen
// is focused (and only then), plus pull to refresh.

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { SUBTYPE_LABELS } from '@models/businessModel';
import { ServiceScope } from '@theme/index';
import { AppText, Button, Card, InlineNotice, ScreenShell, StatusTimeline } from '@custom/index';
import { selectBusiness } from '../../Auth/authSlice';
import { checkStatusAsync, selectPendingApproval } from './pendingApprovalSlice';

export const POLL_INTERVAL_MS = 30_000;

const PendingApprovalScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectPendingApproval);
  const { confirmSignOut } = useSignOut();

  useFocusEffect(
    useCallback(() => {
      dispatch(checkStatusAsync({ manual: false }));
      const id = setInterval(() => dispatch(checkStatusAsync({ manual: false })), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [dispatch]),
  );

  if (!business) return null;
  const submitted = business.submittedAt ? dayjs(business.submittedAt).format('D MMM, h:mm a') : undefined;

  return (
    <ServiceScope service={business.serviceType}>
      <ScreenShell
        eyebrow={SUBTYPE_LABELS[business.subType].title}
        title="Under review"
        subtitle="We'll let you know as soon as it's done. Usually within one working day."
        refreshing={s.refreshing}
        onRefresh={() => dispatch(checkStatusAsync({ manual: true }))}
        footer={<Button label="Sign out" variant="secondary" onPress={confirmSignOut} fullWidth />}>
        {s.error.message ? <InlineNotice tone="warning" message={s.error.message} /> : null}
        <Card>
          <AppText variant="display">{business.name}</AppText>
          <StatusTimeline
            steps={[
              { label: 'Submitted', description: submitted, state: 'done' },
              { label: 'Under review', description: 'Our team is checking your documents.', state: 'current' },
              { label: 'Approved', description: 'Your business goes live.', state: 'upcoming' },
            ]}
          />
        </Card>
        <AppText variant="small" tone="muted" align="center" accessibilityLiveRegion="polite">
          {s.lastCheckedAt ? `Last checked ${dayjs(s.lastCheckedAt).format('h:mm a')}. Pull down to check now.` : 'Checking…'}
        </AppText>
      </ScreenShell>
    </ServiceScope>
  );
};

export default PendingApprovalScreen;
