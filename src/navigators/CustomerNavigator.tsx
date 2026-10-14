// MetroMatrix — CustomerNavigator: the customer app, accented by the
// customer's current service (preferences.lastService).

import React from 'react';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectLastService } from '../store/preferencesSlice';
import { ServiceScope } from '../theme';
import { CUSTOMER_TAB_ROUTES } from '../navigations-maps/Customer';
import { RouteTabs } from './RouteTabs';

const CustomerNavigator: React.FC = () => {
  const service = useAppSelector(selectLastService);
  return (
    <ServiceScope service={service}>
      <RouteTabs id="CustomerTabs" routes={CUSTOMER_TAB_ROUTES} />
    </ServiceScope>
  );
};

export default CustomerNavigator;
