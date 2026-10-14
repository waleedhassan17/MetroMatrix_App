// ═══════════════════════════════════════════════════════
// MetroMatrix — RouteTabs: a bottom-tab navigator from an ITabRoute[]
// ═══════════════════════════════════════════════════════
// Dumb mapper shared by the customer, partner and admin apps. Tints follow
// the enclosing ServiceScope; labels use accentDeep (text contrast), icons
// the same so a tab reads as one unit.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme';
import { Icon } from '../Custom-Components/Icon';
import { AppText } from '../Custom-Components/AppText';
import type { ITabRoute } from '../navigations-maps/types';

const Tab = createBottomTabNavigator();

export const RouteTabs: React.FC<{ id: string; routes: ITabRoute[] }> = ({ id, routes }) => {
  const { colors, service, size } = useTheme();
  return (
    <Tab.Navigator
      id={id as never}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: service.accentDeep,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: size.hairline,
        },
        sceneStyle: { backgroundColor: colors.canvas },
      }}>
      {routes.map(route => (
        <Tab.Screen
          key={route.title}
          name={route.title}
          component={route.component}
          options={{
            // AppText, so tab labels honour the same 130% dynamic-type cap.
            tabBarLabel: ({ color }) => (
              <AppText variant="small" style={{ color }} numberOfLines={1}>
                {route.label}
              </AppText>
            ),
            tabBarAccessibilityLabel: route.label,
            tabBarIcon: ({ color }) => <Icon name={route.icon} size="lg" color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default RouteTabs;
