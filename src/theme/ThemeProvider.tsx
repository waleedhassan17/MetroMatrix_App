// ═══════════════════════════════════════════════════════
// MetroMatrix — ThemeProvider / ServiceScope / useTheme / useStyles
// ═══════════════════════════════════════════════════════
// One provider at the app root resolves the colour MODE: the persisted
// `preferences.themeMode`, or the OS scheme when that is 'system'. It starts
// every tree on the `neutral` accent.
//
// <ServiceScope service="food"> re-themes a subtree's ACCENT only — mode and
// everything else are inherited. A stack can never leak its service's colour
// into another, because the accent is scoped by the tree, not set globally.
//
// Themed styles:
//
//   const makeStyles = ({ colors, space, type }: Theme) => StyleSheet.create({ … });
//   const styles = useStyles(makeStyles);   // memoised on the active theme
//
// Define `makeStyles` at module scope so its identity is stable.

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppSelector } from '../hooks/useReduxHooks';
import { selectThemeMode } from '../store/preferencesSlice';
import { getTheme, type Theme } from './theme';
import type { ServiceName } from './services';
import type { ColorMode } from './tokens';

const ThemeContext = createContext<Theme>(getTheme('light', 'neutral'));

/** The mode the app should render in right now. */
export const useResolvedMode = (): ColorMode => {
  const preference = useAppSelector(selectThemeMode);
  const system = useColorScheme();
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mode = useResolvedMode();
  return <ThemeContext.Provider value={getTheme(mode, 'neutral')}>{children}</ThemeContext.Provider>;
};

export const ServiceScope: React.FC<{ service: ServiceName; children: React.ReactNode }> = ({
  service,
  children,
}) => {
  const parent = useContext(ThemeContext);
  return (
    <ThemeContext.Provider value={getTheme(parent.mode, service)}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => useContext(ThemeContext);

export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
