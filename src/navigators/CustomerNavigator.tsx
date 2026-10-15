// MetroMatrix — CustomerNavigator: the customer app. The shell (launcher,
// tab bar, profile) wears MetroMatrix's own emerald, as in the FYP; each
// service screen scopes its own accent (Food pink, Health blue, Shopping
// orange).

import React from 'react';
import { ServiceScope } from '../theme';
import { CUSTOMER_TAB_ROUTES } from '../navigations-maps/Customer';
import { RouteTabs } from './RouteTabs';

const CustomerNavigator: React.FC = () => (
  <ServiceScope service="neutral">
    <RouteTabs id="CustomerTabs" routes={CUSTOMER_TAB_ROUTES} />
  </ServiceScope>
);

export default CustomerNavigator;
