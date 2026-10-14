// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home (placeholder)
// ═══════════════════════════════════════════════════════
// The service switcher is real: it sets preferences.lastService, which
// re-scopes the whole customer app's accent (CustomerNavigator wraps its
// tabs in <ServiceScope>), and is remembered across launches. The service
// content itself arrives in the next chunk. Stateless beyond `preferences`.

import React from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { selectLastService, setLastService } from '@store/preferencesSlice';
import { EmptyState, ScreenShell, SegmentTabs, type IconName } from '@custom/index';
import { selectUser } from '../../Auth/authSlice';

type Service = 'shopping' | 'healthcare' | 'food';

const SERVICES: { key: Service; label: string }[] = [
  { key: 'shopping', label: 'Shopping' },
  { key: 'healthcare', label: 'Health' },
  { key: 'food', label: 'Food' },
];

const EMPTY: Record<Service, { icon: IconName; title: string; body: string }> = {
  shopping: { icon: 'shopping-bag', title: 'Shops are on their way', body: 'Coming in the next update.' },
  healthcare: { icon: 'heart', title: 'Doctors are on their way', body: 'Coming in the next update.' },
  food: { icon: 'coffee', title: 'Kitchens are on their way', body: 'Coming in the next update.' },
};

const CustomerHomeScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const service = useAppSelector(selectLastService);
  const user = useAppSelector(selectUser);
  const firstName = user?.name.split(' ')[0];

  return (
    <ScreenShell eyebrow="MetroMatrix" title={firstName ? `Hello, ${firstName}` : 'Hello'} subtitle="What do you need today?">
      <SegmentTabs
        options={SERVICES}
        value={service}
        onChange={s => dispatch(setLastService(s))}
        accessibilityLabel="Service"
      />
      <EmptyState {...EMPTY[service]} />
    </ScreenShell>
  );
};

export default CustomerHomeScreen;
