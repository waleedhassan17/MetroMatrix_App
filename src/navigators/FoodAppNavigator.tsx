// MetroMatrix — the customer's Food Court app: a stack whose first screen is
// the Food Court tabs (navigations-maps/FoodCustomer.ts); menus and ordering
// push over them when they ship. Food pink throughout.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import type { FoodAppParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { FOOD_TABS } from '../navigations-maps/FoodCustomer';
import { ServiceTabs } from './ServiceTabs';

const Stack = createNativeStackNavigator<FoodAppParamList>();

const FoodTabs: React.FC = () => <ServiceTabs id="FoodTabs" routes={FOOD_TABS} />;

const FoodAppNavigator: React.FC = () => (
  <ServiceScope service="food">
    <Stack.Navigator id="FoodStack" initialRouteName={ROUTES.FOOD_TABS as 'FoodTabs'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.FOOD_TABS as 'FoodTabs'} component={FoodTabs} />
    </Stack.Navigator>
  </ServiceScope>
);

export default FoodAppNavigator;
