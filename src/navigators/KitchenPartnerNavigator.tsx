// MetroMatrix — the approved Food vendor's app (restaurant, home or cloud
// kitchen): a stack whose first screen is the tabs (or Kitchen setup until the
// kitchen is live), with every tool pushed over them (navigations-maps/FoodVendor.ts).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import type { FoodVendorStackParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { FOOD_VENDOR_STACK_ROUTES, FOOD_VENDOR_TABS } from '../navigations-maps/FoodVendor';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectBusiness } from '../screens/Auth/authSlice';
import { RouteTabs } from './RouteTabs';
import { foodVendorRootRoute } from './sessionGate';

const Stack = createNativeStackNavigator<FoodVendorStackParamList>();

const VendorTabs: React.FC = () => <RouteTabs id="FoodVendorTabs" routes={FOOD_VENDOR_TABS} />;

const KitchenPartnerNavigator: React.FC = () => {
  const business = useAppSelector(selectBusiness);
  return (
    <ServiceScope service="food">
      <Stack.Navigator id="FoodVendorStack" initialRouteName={foodVendorRootRoute(business)} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTES.VENDOR_TABS} component={VendorTabs} />
        {FOOD_VENDOR_STACK_ROUTES.map(route => (
          <Stack.Screen
            key={route.title}
            name={route.title as keyof FoodVendorStackParamList}
            component={route.component}
            options={route.options}
            initialParams={route.initialParams}
          />
        ))}
      </Stack.Navigator>
    </ServiceScope>
  );
};

export default KitchenPartnerNavigator;
