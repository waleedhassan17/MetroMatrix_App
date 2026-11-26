// MetroMatrix — the approved doctor's app: a stack whose first screen is the
// four tabs (or Practice setup until the doctor is first listed), with every
// tool pushed over them (navigations-maps/DoctorPartner.tsx). The tabs wear
// Health's own bar (ServiceTabs → ServiceTabBar's gradient pill), as the
// store's and the kitchen's apps wear theirs.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { ServicePausedGate } from '../Components/platform/ServicePausedGate';
import type { DoctorPartnerStackParamList } from '../models';
import { ROUTES } from '../navigations-maps/Base';
import { DOCTOR_PARTNER_STACK_ROUTES, DOCTOR_PARTNER_TABS } from '../navigations-maps/DoctorPartner';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectBusiness } from '../store/authSlice';
import { ServiceTabs } from './ServiceTabs';
import { doctorRootRoute } from './sessionGate';

const Stack = createNativeStackNavigator<DoctorPartnerStackParamList>();

const DoctorTabs: React.FC = () => <ServiceTabs id="DoctorPartnerTabs" routes={DOCTOR_PARTNER_TABS} />;

const DoctorPartnerNavigator: React.FC = () => {
  const business = useAppSelector(selectBusiness);
  return (
    <ServiceScope service="healthcare">
      <ServicePausedGate service="healthcare">
      <Stack.Navigator id="DoctorPartnerStack" initialRouteName={doctorRootRoute(business)} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTES.DOCTOR_TABS} component={DoctorTabs} />
        {DOCTOR_PARTNER_STACK_ROUTES.map(route => (
          <Stack.Screen
            key={route.title}
            name={route.title as keyof DoctorPartnerStackParamList}
            component={route.component}
            options={route.options}
            initialParams={route.initialParams}
          />
        ))}
      </Stack.Navigator>
    </ServicePausedGate>
    </ServiceScope>
  );
};

export default DoctorPartnerNavigator;
