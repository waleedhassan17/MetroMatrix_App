// MetroMatrix — AdminStack: dumb mapper over ADMIN_STACK_ROUTES.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../types';
import { ADMIN_STACK_ROUTES } from '../../navigations-maps/Approvals';

const Stack = createNativeStackNavigator<AdminStackParamList>();

const AdminStack: React.FC = () => (
  <Stack.Navigator id="AdminStack" screenOptions={{ headerShown: false }}>
    {ADMIN_STACK_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof AdminStackParamList}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default AdminStack;
