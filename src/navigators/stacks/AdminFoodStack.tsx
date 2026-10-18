// MetroMatrix — AdminFoodStack: dumb mapper over navigations-maps/AdminFood.ts.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdminFoodStackParamList } from '../../types';
import { ADMIN_FOOD_ROUTES } from '../../navigations-maps/AdminFood';

const Stack = createNativeStackNavigator<AdminFoodStackParamList>();

const AdminFoodStack: React.FC = () => (
  <Stack.Navigator id="AdminFoodStack" screenOptions={{ headerShown: false }}>
    {ADMIN_FOOD_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof AdminFoodStackParamList}
        component={route.component}
        options={route.options}
        initialParams={route.initialParams}
      />
    ))}
  </Stack.Navigator>
);

export default AdminFoodStack;
