// MetroMatrix — the Food rider's app: a stack over Deliveries · Cash · Profile
// (navigations-maps/Rider.ts).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import type { RiderStackParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { RIDER_STACK_ROUTES, RIDER_TABS } from '../navigations-maps/Rider';
import { RouteTabs } from './RouteTabs';

const Stack = createNativeStackNavigator<RiderStackParamList>();

const RiderTabs: React.FC = () => <RouteTabs id="RiderTabs" routes={RIDER_TABS} />;

const RiderNavigator: React.FC = () => (
  <ServiceScope service="food">
    <Stack.Navigator id="RiderStack" initialRouteName={ROUTES.RIDER_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.RIDER_TABS} component={RiderTabs} />
      {RIDER_STACK_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof RiderStackParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </ServiceScope>
);

export default RiderNavigator;
