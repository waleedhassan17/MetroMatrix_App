// MetroMatrix — a service app while MetroMatrix has that service switched off
// (GET /config, or a 503 SERVICE_PAUSED from one of its requests). The
// service's screens would only fail, so the whole app shows this instead.
// Customers can go back to the other services; Try again re-reads /config.

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { EmptyState, ScreenShell } from '../../Custom-Components';
import { loadPlatformConfig, selectPlatformStatus, selectServicePaused } from '../../store/platformConfigSlice';
import type { PlatformService } from '../../types/platformConfig';
import { useServiceNav } from '../../hooks/useServiceNav';

export const SERVICE_LABEL: Record<PlatformService, string> = {
  shopping: 'Smart Shopping',
  healthcare: 'Digital Health',
  food: 'Food Court',
  kitchen: 'Kitchen',
};

export const ServicePausedScreen: React.FC<{ service: PlatformService; onLeave?: () => void }> = ({
  service,
  onLeave,
}) => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectPlatformStatus);
  return (
    <ScreenShell scroll={false}>
      <EmptyState
        icon="pause-circle"
        title={`${SERVICE_LABEL[service]} is paused`}
        body="MetroMatrix has paused this service for a short while. Nothing you saved is lost. Please check back soon."
        action={
          onLeave
            ? { label: 'Back to home', onPress: onLeave }
            : {
                label: status === 'loading' ? 'Checking' : 'Try again',
                onPress: () => dispatch(loadPlatformConfig()),
              }
        }
      />
    </ScreenShell>
  );
};

/** Renders the service app, or the paused screen while it is switched off. */
export const ServicePausedGate: React.FC<{
  service: PlatformService;
  onLeave?: () => void;
  children: React.ReactNode;
}> = ({ service, onLeave, children }) => {
  const paused = useAppSelector(state => selectServicePaused(state, service));
  return paused ? <ServicePausedScreen service={service} onLeave={onLeave} /> : <>{children}</>;
};

/** A customer's service app: paused, they go back to the three services. */
export const CustomerServiceGate: React.FC<{ service: PlatformService; children: React.ReactNode }> = ({
  service,
  children,
}) => {
  const { leaveService } = useServiceNav();
  return (
    <ServicePausedGate service={service} onLeave={leaveService}>
      {children}
    </ServicePausedGate>
  );
};

export default ServicePausedGate;
