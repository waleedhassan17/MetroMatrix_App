// MetroMatrix — the approved store partner's app: a stack whose first screen
// is the four tabs, with every tool pushed over them (navigations-maps/StorePartner.ts).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import type { StorePartnerStackParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { STORE_PARTNER_STACK_ROUTES, STORE_PARTNER_TABS } from '../navigations-maps/StorePartner';
import { RouteTabs } from './RouteTabs';

const Stack = createNativeStackNavigator<StorePartnerStackParamList>();

const StoreTabs: React.FC = () => <RouteTabs id="StorePartnerTabs" routes={STORE_PARTNER_TABS} />;

const StorePartnerNavigator: React.FC = () => (
  <ServiceScope service="shopping">
    <Stack.Navigator id="StorePartnerStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.STORE_TABS} component={StoreTabs} />
      {STORE_PARTNER_STACK_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof StorePartnerStackParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </ServiceScope>
);

export default StorePartnerNavigator;
