// MetroMatrix — the customer's Smart Shopping app (the FYP's): a stack whose
// first screen is the Shopping tabs, with every Shopping page pushed over them
// (navigations-maps/ShoppingCustomer.ts). Shopping orange throughout.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { CustomerServiceGate } from '../components/platform/ServicePausedGate';
import type { ShopAppParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { SHOP_APP_ROUTES, SHOP_TABS } from '../navigations-maps/ShoppingCustomer';
import { ServiceTabs } from './ServiceTabs';

const Stack = createNativeStackNavigator<ShopAppParamList>();

const ShopTabs: React.FC = () => <ServiceTabs id="ShopTabs" routes={SHOP_TABS} />;

const ShopAppNavigator: React.FC = () => (
  <ServiceScope service="shopping">
      <CustomerServiceGate service="shopping">
    <Stack.Navigator id="ShopStack" initialRouteName={ROUTES.SHOP_TABS as 'ShopTabs'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.SHOP_TABS as 'ShopTabs'} component={ShopTabs} />
      {SHOP_APP_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof ShopAppParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </CustomerServiceGate>
    </ServiceScope>
);

export default ShopAppNavigator;
