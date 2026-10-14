// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner home (placeholder per service)
// ═══════════════════════════════════════════════════════
// The approved partner's landing: their business name in the service's
// accent (the partner navigator wraps the app in <ServiceScope>). Store,
// practice and kitchen tools arrive in the next chunk. Stateless.

import React from 'react';
import { useAppSelector } from '@hooks/useReduxHooks';
import { SERVICE_LABELS, SUBTYPE_LABELS } from '@models/businessModel';
import { AppText, Card, EmptyState, ScreenShell, StatusPill, type IconName } from '@custom/index';
import type { ServiceType } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';

const ICON: Record<ServiceType, IconName> = { shopping: 'shopping-bag', healthcare: 'heart', food: 'coffee' };
const NEXT: Record<ServiceType, string> = {
  shopping: 'Your catalogue and orders arrive in the next update.',
  healthcare: 'Your schedule and appointments arrive in the next update.',
  food: 'Your menu and orders arrive in the next update.',
};

const PartnerHomeScreen: React.FC = () => {
  const business = useAppSelector(selectBusiness);
  if (!business) return null;
  return (
    <ScreenShell
      eyebrow={`${SERVICE_LABELS[business.serviceType].title} · ${SUBTYPE_LABELS[business.subType].title}`}
      title="Your business">
      <Card>
        <AppText variant="display">{business.name}</AppText>
        <AppText variant="body" tone="muted">
          {[business.address, business.city].filter(Boolean).join(', ')}
        </AppText>
        <StatusPill label="Live" tone="success" />
      </Card>
      <EmptyState icon={ICON[business.serviceType]} title="Getting things ready" body={NEXT[business.serviceType]} />
    </ScreenShell>
  );
};

export default PartnerHomeScreen;
