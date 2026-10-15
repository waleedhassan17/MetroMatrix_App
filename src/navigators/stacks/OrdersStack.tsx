// MetroMatrix — OrdersStack: dumb mapper over navigations-maps/CustomerOrders.ts.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../types';
import { ORDERS_ROUTES } from '../../navigations-maps/CustomerOrders';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

const OrdersStack: React.FC = () => (
  <Stack.Navigator id="OrdersStack" screenOptions={{ headerShown: false }}>
    {ORDERS_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof OrdersStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams}
      />
    ))}
  </Stack.Navigator>
);

export default OrdersStack;
