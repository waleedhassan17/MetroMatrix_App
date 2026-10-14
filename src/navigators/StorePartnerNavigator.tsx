// MetroMatrix — the approved shopping partner's app.
import React from 'react';
import { ServiceScope } from '../theme';
import { STORE_PARTNER_TAB_ROUTES } from '../navigations-maps/Partner';
import { RouteTabs } from './RouteTabs';

const StorePartnerNavigator: React.FC = () => (
  <ServiceScope service="shopping">
    <RouteTabs id="StorePartnerTabs" routes={STORE_PARTNER_TAB_ROUTES} />
  </ServiceScope>
);

export default StorePartnerNavigator;
