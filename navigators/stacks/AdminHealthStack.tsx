// MetroMatrix — AdminHealthStack: dumb mapper over navigations-maps/AdminHealth.tsx.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminHealthStackParamList } from '../../models';
import { ADMIN_HEALTH_ROUTES } from '../../navigations-maps/AdminHealth';

const Stack = createNativeStackNavigator<AdminHealthStackParamList>();

const AdminHealthStack: React.FC = () => (
  <Stack.Navigator id="AdminHealthStack" screenOptions={{ headerShown: false }}>
    {ADMIN_HEALTH_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof AdminHealthStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams}
      />
    ))}
  </Stack.Navigator>
);

export default AdminHealthStack;
