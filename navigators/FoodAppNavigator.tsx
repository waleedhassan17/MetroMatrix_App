// MetroMatrix — the customer's Food Court app: a stack whose first screen is
// the Food Court tabs (navigations-maps/FoodCustomer.ts), with browsing and
// a vendor's page pushed over them. Food pink throughout.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { CustomerServiceGate } from '../Components/platform/ServicePausedGate';
import type { FoodAppParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { FOOD_STACK_ROUTES, FOOD_TABS } from '../navigations-maps/FoodCustomer';
import { ServiceTabs } from './ServiceTabs';

const Stack = createNativeStackNavigator<FoodAppParamList>();

const FoodTabs: React.FC = () => <ServiceTabs id="FoodTabs" routes={FOOD_TABS} />;

const FoodAppNavigator: React.FC = () => (
  <ServiceScope service="food">
      <CustomerServiceGate service="food">
    <Stack.Navigator id="FoodStack" initialRouteName={ROUTES.FOOD_TABS as 'FoodTabs'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.FOOD_TABS as 'FoodTabs'} component={FoodTabs} />
      {FOOD_STACK_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof FoodAppParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </CustomerServiceGate>
    </ServiceScope>
);

export default FoodAppNavigator;
