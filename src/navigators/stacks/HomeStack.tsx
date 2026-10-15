// MetroMatrix — HomeStack: dumb mapper over navigations-maps/Home.ts.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types';
import { HOME_ROUTES } from '../../navigations-maps/Home';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeStack: React.FC = () => (
  <Stack.Navigator id="HomeStack" screenOptions={{ headerShown: false }}>
    {HOME_ROUTES.map(route => (
      <Stack.Screen
        key={route.title}
        name={route.title as keyof HomeStackParamList}
        component={route.component}
        options={route.options}
      />
    ))}
  </Stack.Navigator>
);

export default HomeStack;
