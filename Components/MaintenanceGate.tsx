// MetroMatrix — shown while the platform is in maintenance (GET /config, or a
// 503 MAINTENANCE from any request). Nothing else works server-side, so the
// app says so plainly; Try again re-reads /config.

import React from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useReduxHooks';
import { EmptyState, ScreenShell } from '../Custom-Components';
import { loadPlatformConfig, selectMaintenance, selectPlatformStatus } from '../store/platformConfigSlice';

export const MAINTENANCE_FALLBACK = 'MetroMatrix is down for maintenance. Please try again shortly.';

export const MaintenanceGate: React.FC = () => {
  const dispatch = useAppDispatch();
  const maintenance = useAppSelector(selectMaintenance);
  const status = useAppSelector(selectPlatformStatus);
  return (
    <ScreenShell scroll={false}>
      <EmptyState
        icon="tool"
        title="We'll be right back"
        body={maintenance.message || MAINTENANCE_FALLBACK}
        action={{
          label: status === 'loading' ? 'Checking' : 'Try again',
          onPress: () => dispatch(loadPlatformConfig()),
        }}
      />
    </ScreenShell>
  );
};

export default MaintenanceGate;
