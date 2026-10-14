// MetroMatrix — the approved food partner's app (restaurant, home or cloud kitchen).
import React from 'react';
import { ServiceScope } from '../theme';
import { KITCHEN_PARTNER_TAB_ROUTES } from '../navigations-maps/Partner';
import { RouteTabs } from './RouteTabs';

const KitchenPartnerNavigator: React.FC = () => (
  <ServiceScope service="food">
    <RouteTabs id="KitchenPartnerTabs" routes={KITCHEN_PARTNER_TAB_ROUTES} />
  </ServiceScope>
);

export default KitchenPartnerNavigator;
