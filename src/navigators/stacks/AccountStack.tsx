// MetroMatrix — AccountStack: dumb mapper over navigations-maps/Account.ts.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AccountStackParamList } from '../../types';
import { ACCOUNT_ROUTES } from '../../navigations-maps/Account';

const Stack = createNativeStackNavigator<AccountStackParamList>();

const AccountStack: React.FC = () => (
  <Stack.Navigator id="AccountStack" screenOptions={{ headerShown: false }}>
    {ACCOUNT_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof AccountStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams}
      />
    ))}
  </Stack.Navigator>
);

export default AccountStack;
