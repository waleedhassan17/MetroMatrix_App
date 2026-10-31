// ═══════════════════════════════════════════════════════
// MetroMatrix — ServiceTabs: a service app's bottom tabs from an ITabRoute[]
// ═══════════════════════════════════════════════════════
// Dumb mapper for the customer's service apps (Health, Shopping, Food
// Court). The bar is ServiceTabBar, in the look the enclosing ServiceScope's
// theme names (the FYP's per-module bars). Back from any tab goes to the
// first one, then out of the service.

import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../theme';
import { ServiceTabBar } from '../Custom-Components/ServiceTabBar';
import type { ITabRoute } from '../navigations-maps/types';

const Tab = createBottomTabNavigator();

const noBadge = () => 0;

/** The bar for one tab set; `routes` never changes, so the badge hooks run in a fixed order. */
const makeBar = (routes: ITabRoute[]) => {
  const Bar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
    const badges = routes.map(r => (r.useBadge ?? noBadge)());
    return (
      <ServiceTabBar
        items={routes.map((r, i) => ({ key: r.title, label: r.label, icon: r.icon, iconActive: r.iconActive, badge: badges[i] }))}
        activeIndex={state.index}
        onPress={i => {
          const route = state.routes[i];
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (state.index !== i && !event.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
          }
        }}
        onLongPress={i => navigation.emit({ type: 'tabLongPress', target: state.routes[i].key })}
      />
    );
  };
  return Bar;
};

export const ServiceTabs: React.FC<{ id: string; routes: ITabRoute[] }> = ({ id, routes }) => {
  const { colors } = useTheme();
  const Bar = React.useMemo(() => makeBar(routes), [routes]);
  return (
    <Tab.Navigator
      id={id as never}
      backBehavior="firstRoute"
      tabBar={props => <Bar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}>
      {routes.map(route => (
        <Tab.Screen key={route.title} name={route.title} component={route.component} initialParams={route.initialParams} options={{ tabBarAccessibilityLabel: route.label }} />
      ))}
    </Tab.Navigator>
  );
};

export default ServiceTabs;
