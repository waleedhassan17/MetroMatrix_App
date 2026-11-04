// MetroMatrix — the approved Food vendor's app (restaurant, home or cloud
// kitchen): a stack whose first screen is the tabs (or Kitchen setup until the
// kitchen is live), with every tool pushed over them (navigations-maps/FoodVendor.tsx).
// The tabs are Food's own bar (ServiceTabs, with the new orders counted on
// Orders), and the board stays live on every tab (VendorBoardHost).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import { ServicePausedGate } from '../Components/platform/ServicePausedGate';
import type { FoodVendorStackParamList } from '../models';
import { ROUTES } from '../navigations-maps/Base';
import { FOOD_VENDOR_HOME_TABS, FOOD_VENDOR_STACK_ROUTES, FOOD_VENDOR_TABS } from '../navigations-maps/FoodVendor';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectBusiness } from '../store/authSlice';
import { ServiceTabs } from './ServiceTabs';
import { VendorBoardHost } from '../Components/food/VendorBoardHost';
import { foodVendorRootRoute } from './sessionGate';

const Stack = createNativeStackNavigator<FoodVendorStackParamList>();

const VendorTabs: React.FC = () => {
  const homeKitchen = useAppSelector(selectBusiness)?.subType === 'home_kitchen';
  return (
    <>
      <VendorBoardHost />
      <ServiceTabs id="FoodVendorTabs" routes={homeKitchen ? FOOD_VENDOR_HOME_TABS : FOOD_VENDOR_TABS} />
    </>
  );
};

const KitchenPartnerNavigator: React.FC = () => {
  const business = useAppSelector(selectBusiness);
  return (
    <ServiceScope service="food">
      <ServicePausedGate service="food">
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
    </ServicePausedGate>
    </ServiceScope>
  );
};

export default KitchenPartnerNavigator;
