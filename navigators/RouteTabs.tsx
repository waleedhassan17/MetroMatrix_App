// ═══════════════════════════════════════════════════════
// MetroMatrix — RouteTabs: a bottom-tab navigator from an ITabRoute[]
// ═══════════════════════════════════════════════════════
// Dumb mapper shared by the customer, partner and admin apps. Each tab is an
// Ionicons pair — outline at rest, filled when selected — and the selected
// one sits in a soft pill of the enclosing ServiceScope's accent with a
// bolder label, so the current tab reads at a glance. Labels use AppText, so
// they honour the 130% dynamic-type cap.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { IonIcon } from '../Custom-Components/Icon';
import { AppText } from '../Custom-Components/AppText';
import type { ITabRoute } from '../navigations-maps/types';

const Tab = createBottomTabNavigator();

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    pill: {
      width: space.s56,
      height: size.chevronWell,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    item: { paddingTop: space.s8 },
  });

export const RouteTabs: React.FC<{ id: string; routes: ITabRoute[] }> = ({ id, routes }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size, space } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, space.s8);

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
          height: size.tabBar + bottom,
          paddingBottom: bottom,
        },
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: colors.canvas },
      }}>
      {routes.map(route => (
        <Tab.Screen
          key={route.title}
          name={route.title}
          component={route.component}
          options={{
            tabBarLabel: ({ focused, color }) => (
              <AppText variant={focused ? 'chip' : 'caption'} style={{ color }} numberOfLines={1}>
                {route.label}
              </AppText>
            ),
            tabBarAccessibilityLabel: route.label,
            tabBarIcon: ({ focused }) => (
              <View style={[styles.pill, focused && { backgroundColor: service.accentSoft }]}>
                <IonIcon
                  name={focused ? route.iconActive : route.icon}
                  size="lg"
                  color={focused ? service.accent : colors.inkMuted}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default RouteTabs;
