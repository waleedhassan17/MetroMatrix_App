// MetroMatrix — AdminNavigator: the admin console (neutral accent).

import React from 'react';
import { ServiceScope } from '../theme';
import { ADMIN_TAB_ROUTES } from '../navigations-maps/Admin';
import { RouteTabs } from './RouteTabs';

const AdminNavigator: React.FC = () => (
  <ServiceScope service="neutral">
    <RouteTabs id="AdminTabs" routes={ADMIN_TAB_ROUTES} />
  </ServiceScope>
);

export default AdminNavigator;
