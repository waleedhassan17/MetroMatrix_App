// MetroMatrix — the approved doctor's app: a stack whose first screen is the
// four tabs (or Practice setup until the doctor is listed), with every tool
// pushed over them (navigations-maps/DoctorPartner.ts).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { ServicePausedGate } from '../components/platform/ServicePausedGate';
import type { DoctorPartnerStackParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { DOCTOR_PARTNER_STACK_ROUTES, DOCTOR_PARTNER_TABS } from '../navigations-maps/DoctorPartner';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectBusiness } from '../screens/Auth/authSlice';
import { RouteTabs } from './RouteTabs';
import { doctorRootRoute } from './sessionGate';

const Stack = createNativeStackNavigator<DoctorPartnerStackParamList>();

const DoctorTabs: React.FC = () => <RouteTabs id="DoctorPartnerTabs" routes={DOCTOR_PARTNER_TABS} />;

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
