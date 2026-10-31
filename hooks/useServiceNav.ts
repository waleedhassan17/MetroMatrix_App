// ═══════════════════════════════════════════════════════
// MetroMatrix — Moving between the home and the service apps
// ═══════════════════════════════════════════════════════
// The customer app is the FYP's: a root stack (CustomerStack) with the
// three-card home and the account pages, and one app per service — Health,
// Shopping, Food Court — each a stack over its own bottom tabs. These helpers
// address the root stack by id, so they work from any depth: a tab, a
// pushed detail, a sheet.
//
//   const { openHealth, openShopTab, leaveService } = useServiceNav();
//   openHealth('AppointmentDetail', { code });   // pushed over Health's tabs
//   openShopTab('BagTab');                        // Shopping, on its Bag tab
//   leaveService();                               // back to the three cards

import { useMemo } from 'react';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { ROUTES } from '../navigations-maps/Base';
import type { FoodTabParamList, HealthTabParamList, ShopTabParamList } from '../models';

type Nav = NavigationProp<ParamListBase>;
type Go = (name: string, params?: object) => void;

export const CUSTOMER_STACK_ID = 'CustomerStack';

/** The customer root stack, or the nearest navigator outside the customer app. */
export const rootOf = (navigation: Nav): { navigate: Go } =>
  (navigation.getParent(CUSTOMER_STACK_ID) ?? navigation) as unknown as { navigate: Go };

/** `HealthApp` → that service app's screen; `initial: false` keeps its tabs underneath. */
const into = (app: string, screen?: string, params?: object) =>
  screen ? [app, { screen, params, initial: false }] as const : [app, undefined] as const;

export const serviceTargets = {
  home: () => [ROUTES.CUSTOMER_HOME, undefined] as const,
  health: (screen?: string, params?: object) => into(ROUTES.HEALTH_APP, screen, params),
  shop: (screen?: string, params?: object) => into(ROUTES.SHOP_APP, screen, params),
  food: (screen?: string, params?: object) => into(ROUTES.FOOD_APP, screen, params),
  healthTab: (tab: keyof HealthTabParamList, params?: object) =>
    [ROUTES.HEALTH_APP, { screen: ROUTES.HEALTH_TABS, params: { screen: tab, params } }] as const,
  shopTab: (tab: keyof ShopTabParamList, params?: object) =>
    [ROUTES.SHOP_APP, { screen: ROUTES.SHOP_TABS, params: { screen: tab, params } }] as const,
  foodTab: (tab: keyof FoodTabParamList, params?: object) =>
    [ROUTES.FOOD_APP, { screen: ROUTES.FOOD_TABS, params: { screen: tab, params } }] as const,
};

/** A service app's tab root (it hides the back control a pushed copy of the same screen shows). */
export const useIsTabRoot = () => !!(useRoute().params as { asTab?: boolean } | undefined)?.asTab;

export function useServiceNav() {
  const navigation = useNavigation<Nav>();
  return useMemo(() => {
    const go = (target: readonly [string, object | undefined]) => rootOf(navigation).navigate(target[0], target[1]);
    return {
      /**
       * Back to the three service cards (a service's Home tab chevron). After a
       * deep link the home may not be under the service, so it becomes the
       * only screen rather than one pushed on top.
       */
      leaveService: () => {
        const root = navigation.getParent(CUSTOMER_STACK_ID);
        if (!root) return;
        if (root.getState()?.routes.some(r => r.name === ROUTES.CUSTOMER_HOME)) root.navigate(ROUTES.CUSTOMER_HOME);
        else root.reset({ index: 0, routes: [{ name: ROUTES.CUSTOMER_HOME }] });
      },
      openHealth: (screen?: string, params?: object) => go(serviceTargets.health(screen, params)),
      openShop: (screen?: string, params?: object) => go(serviceTargets.shop(screen, params)),
      openFood: (screen?: string, params?: object) => go(serviceTargets.food(screen, params)),
      openHealthTab: (tab: keyof HealthTabParamList, params?: object) => go(serviceTargets.healthTab(tab, params)),
      openShopTab: (tab: keyof ShopTabParamList, params?: object) => go(serviceTargets.shopTab(tab, params)),
      openFoodTab: (tab: keyof FoodTabParamList, params?: object) => go(serviceTargets.foodTab(tab, params)),
      /** A page on the customer root stack (Profile, Orders, Addresses…). */
      openRoot: (name: string, params?: object) => rootOf(navigation).navigate(name, params),
    };
  }, [navigation]);
}
