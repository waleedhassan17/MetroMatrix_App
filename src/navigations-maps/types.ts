// ═══════════════════════════════════════════════════════
// MetroMatrix — Navigation map types
// ═══════════════════════════════════════════════════════
// Every navigator is described by a plain array of entries in
// navigations-maps/<Name>.ts; the navigator itself is a dumb mapper.

import type React from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { IconName } from '../Custom-Components/Icon';

export interface IRoute {
  /** Route name — must never change (deep links + navigate() strings). */
  title: string;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
  /** Screens that need initialParams. */
  initialParams?: Record<string, unknown>;
}

/** A bottom tab: its route, label and Feather glyph. */
export interface ITabRoute {
  title: string;
  component: React.ComponentType<any>;
  label: string;
  icon: IconName;
}
