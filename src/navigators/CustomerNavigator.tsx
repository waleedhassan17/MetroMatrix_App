// MetroMatrix — CustomerNavigator: the customer app, the FYP's way. A root
// stack (CustomerStack) whose first screen is the three-card home — no bottom
// bar; its side menu opens orders, profile and the rest — and one app per
// service (Health, Shopping, Food Court), each a stack over its own tabs in
// its own colour. The home and the account pages wear MetroMatrix's emerald.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServiceScope } from '../theme';
import type { CustomerStackParamList } from '../types';
import { ROUTES } from '../navigations-maps/Base';
import { CUSTOMER_ROUTES } from '../navigations-maps/Customer';
import { CUSTOMER_STACK_ID } from '../hooks/useServiceNav';

const Stack = createNativeStackNavigator<CustomerStackParamList>();

const CustomerNavigator: React.FC = () => (
  <ServiceScope service="neutral">
    <Stack.Navigator id={CUSTOMER_STACK_ID as never} initialRouteName={ROUTES.CUSTOMER_HOME as 'CustomerHome'} screenOptions={{ headerShown: false }}>
      {CUSTOMER_ROUTES.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof CustomerStackParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams}
        />
      ))}
    </Stack.Navigator>
  </ServiceScope>
);

export default CustomerNavigator;
