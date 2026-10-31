// MetroMatrix — AdminNavigator: the admin console (neutral accent). Every
// staff page wears the gradient page header in emerald, as the customer
// shell's own pages do (PageHeaderScope).

import React from 'react';
import { PageHeaderScope, ServiceScope } from '../theme';
import { ADMIN_TAB_ROUTES } from '../navigations-maps/Admin';
import { RouteTabs } from './RouteTabs';

const AdminNavigator: React.FC = () => (
  <ServiceScope service="neutral">
    <PageHeaderScope>
      <RouteTabs id="AdminTabs" routes={ADMIN_TAB_ROUTES} />
    </PageHeaderScope>
  </ServiceScope>
);

export default AdminNavigator;
