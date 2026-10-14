// MetroMatrix — the approved healthcare partner's app.
import React from 'react';
import { ServiceScope } from '../theme';
import { DOCTOR_PARTNER_TAB_ROUTES } from '../navigations-maps/Partner';
import { RouteTabs } from './RouteTabs';

const DoctorPartnerNavigator: React.FC = () => (
  <ServiceScope service="healthcare">
    <RouteTabs id="DoctorPartnerTabs" routes={DOCTOR_PARTNER_TAB_ROUTES} />
  </ServiceScope>
);

export default DoctorPartnerNavigator;
