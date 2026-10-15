// ═══════════════════════════════════════════════════════
// MetroMatrix — ThemeProvider / ServiceScope / useTheme / useStyles
// ═══════════════════════════════════════════════════════
// Light only (like the FYP app). The root provider starts every tree on the
// `neutral` (brand emerald) accent; <ServiceScope service="food"> re-themes a
// subtree's ACCENT only. A stack can never leak its service's colour into
// another, because the accent is scoped by the tree, not set globally.
//
//   const makeStyles = ({ colors, space, type }: Theme) => StyleSheet.create({ … });
//   const styles = useStyles(makeStyles);   // memoised on the active theme
//
// Define `makeStyles` at module scope so its identity is stable.

import React, { createContext, useContext, useMemo } from 'react';
import { getTheme, type Theme } from './theme';
import type { ServiceName } from './services';

const ThemeContext = createContext<Theme>(getTheme('neutral'));

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeContext.Provider value={getTheme('neutral')}>{children}</ThemeContext.Provider>
);

export const ServiceScope: React.FC<{ service: ServiceName; children: React.ReactNode }> = ({
  service,
  children,
}) => <ThemeContext.Provider value={getTheme(service)}>{children}</ThemeContext.Provider>;

/** A whole Theme for a subtree — StoreBrandScope's store colours. */
export const ThemeScope: React.FC<{ theme: Theme; children: React.ReactNode }> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

export const useTheme = (): Theme => useContext(ThemeContext);

export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
