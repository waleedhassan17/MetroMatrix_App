// ═══════════════════════════════════════════════════════
// MetroMatrix — Back that always goes somewhere
// ═══════════════════════════════════════════════════════
// A screen opened from a link (a web address, a push tap, a deep link) is
// the only screen in its stack, so a plain goBack() does nothing — and on
// Android the hardware back closes the app. useBack goes back when there is
// history in this stack; otherwise it REPLACES this screen with its natural
// parent (a product's reviews → the product, an order step → the order, a
// store tool → More), or the stack's first screen when the parent isn't in
// this stack. It also answers Android's hardware back in that case.
//
//   const { back, canGoBack } = useBack({ name: 'Orders' });
//   <ScreenShell onBack={canGoBack ? back : undefined} … />

import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';

export interface BackTarget {
  name: string;
  params?: object;
}

type Nav = NavigationProp<ParamListBase>;

/** Where back leads when this stack has no history: the parent, else the stack's first screen. */
const fallbackFor = (navigation: Nav, current: string, fallback?: BackTarget): BackTarget | null => {
  const names = navigation.getState()?.routeNames ?? [];
  const target = fallback && names.includes(fallback.name) ? fallback : names[0] ? { name: names[0] } : null;
  return target && target.name !== current ? target : null;
};

/** Is there a screen under this one in its own stack? */
const hasHistory = (navigation: Nav, routeKey: string) => {
  const routes = navigation.getState()?.routes ?? [];
  return routes.findIndex(r => r.key === routeKey) > 0;
};

export function useBack(fallback?: BackTarget) {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const key = JSON.stringify(fallback ?? null);

  const back = useCallback(() => {
    if (hasHistory(navigation, route.key)) {
      navigation.goBack();
      return;
    }
    const target = fallbackFor(navigation, route.name, fallback);
    if (target) navigation.dispatch(StackActions.replace(target.name, target.params));
    else if (navigation.canGoBack()) navigation.goBack();
    // The fallback is compared by value (`key`), not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, route.key, route.name, key]);

  // Whether a back control makes sense here (a tab's first screen has none).
  // What is under a screen doesn't change while it is shown, so this is read
  // once per render.
  const canGoBack = hasHistory(navigation, route.key) || !!fallbackFor(navigation, route.name, fallback);

  // Android: with no history here, the hardware back goes to the parent too.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (hasHistory(navigation, route.key)) return false;
        const target = fallbackFor(navigation, route.name, fallback);
        if (!target) return false;
        navigation.dispatch(StackActions.replace(target.name, target.params));
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation, route.key, route.name, key]),
  );

  return { back, canGoBack };
}
