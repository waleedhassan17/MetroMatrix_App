// MetroMatrix — the customer's Digital Health app (the FYP's): a stack whose
// first screen is the Health tabs, with every Health page pushed over them
// (navigations-maps/HealthPatient.ts). Health blue throughout.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { CustomerServiceGate } from '../components/platform/ServicePausedGate';
import type { HealthAppParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { HEALTH_APP_ROUTES, HEALTH_TABS } from '../navigations-maps/HealthPatient';
import { ServiceTabs } from './ServiceTabs';

const Stack = createNativeStackNavigator<HealthAppParamList>();

const HealthTabs: React.FC = () => <ServiceTabs id="HealthTabs" routes={HEALTH_TABS} />;

const HealthAppNavigator: React.FC = () => (
  <ServiceScope service="healthcare">
      <CustomerServiceGate service="healthcare">
    <Stack.Navigator id="HealthStack" initialRouteName={ROUTES.HEALTH_TABS as 'HealthTabs'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.HEALTH_TABS as 'HealthTabs'} component={HealthTabs} />
      {HEALTH_APP_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof HealthAppParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </CustomerServiceGate>
    </ServiceScope>
);

export default HealthAppNavigator;
