// ═══════════════════════════════════════════════════════
// MetroMatrix — Status-bar glyphs that match the header under them
// ═══════════════════════════════════════════════════════
// White screens want dark clock and battery glyphs; a gradient page header
// (Shopping, Health) wants light ones. A screen asks for light while it is
// focused; when no light screen is focused any more, the glyphs go back to
// dark. The check waits a tick so a gradient screen replacing another one
// doesn't flash dark in between.

import { useContext, useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

const lightScreens = new Set<number>();
let nextId = 1;

const settle = () =>
  setTimeout(() => {
    StatusBar.setBarStyle(lightScreens.size ? 'light-content' : 'dark-content', true);
  }, 0);

export function useBarStyle(light: boolean) {
  const navigation = useContext(NavigationContext);
  const [me] = useState(() => nextId++);

  useEffect(() => {
    if (Platform.OS === 'web' || !light) return undefined;
    const on = () => {
      lightScreens.add(me);
      settle();
    };
    const off = () => {
      lightScreens.delete(me);
      settle();
    };
    if (!navigation || navigation.isFocused()) on();
    const unsubs = navigation ? [navigation.addListener('focus', on), navigation.addListener('blur', off)] : [];
    return () => {
      unsubs.forEach(u => u());
      off();
    };
  }, [navigation, light, me]);
}
