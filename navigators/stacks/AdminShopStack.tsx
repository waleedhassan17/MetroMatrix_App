// MetroMatrix — AdminShopStack: dumb mapper over navigations-maps/AdminShopping.tsx.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminShopStackParamList } from '../../models';
import { ADMIN_SHOP_ROUTES } from '../../navigations-maps/AdminShopping';

const Stack = createNativeStackNavigator<AdminShopStackParamList>();

const AdminShopStack: React.FC = () => (
  <Stack.Navigator id="AdminShopStack" screenOptions={{ headerShown: false }}>
    {ADMIN_SHOP_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof AdminShopStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams}
      />
    ))}
  </Stack.Navigator>
);

export default AdminShopStack;
