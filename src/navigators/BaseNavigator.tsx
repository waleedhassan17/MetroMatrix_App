// ═══════════════════════════════════════════════════════
// MetroMatrix — BaseNavigator (auth / onboarding / status gates)
// ═══════════════════════════════════════════════════════
// Dumb mapper over the route arrays in navigations-maps/Auth.ts. Which
// top-level navigator mounts — this one, the customer app, a partner app or
// the admin console — is decided by AppContainer.renderNavigator(); this
// navigator only handles the session-gate branches for users who are not
// (yet) inside an app: sign-in, TOTP, email verification, partner setup,
// approval, rejection, suspension, onboarding.
//
// P0: only the unauthenticated branch exists. The gate ladder (P2) is, in
// this order — and the order matters, each step is commented where it lands:
//   1. not authenticated      → onboarding (if unseen) + unauthenticated
//   2. pending TOTP           → admin TOTP
//   3. email not verified     → verify
//   4. partner, no/draft biz  → partner setup
//   5. pending_approval       → pending
//   6. rejected               → rejected
//   7. suspended              → suspended

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import type { IRoute } from '../navigations-maps/types';
import { UNAUTHENTICATED_ROUTES } from '../navigations-maps/Auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BaseNavigator: React.FC = () => {
  const routes: IRoute[] = UNAUTHENTICATED_ROUTES;

  return (
    <Stack.Navigator
      id="BaseNavigator"
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}>
      {routes.map(route => (
        <Stack.Screen
          key={route.title}
          name={route.title as keyof RootStackParamList}
          component={route.component}
          options={route.options}
          initialParams={route.initialParams as never}
        />
      ))}
    </Stack.Navigator>
  );
};

export default BaseNavigator;
