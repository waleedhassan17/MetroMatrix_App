// ═══════════════════════════════════════════════════════
// MetroMatrix — BaseNavigator (auth / onboarding / status gates)
// ═══════════════════════════════════════════════════════
// Dumb mapper over the route arrays in navigations-maps/Auth.ts. Which
// top-level navigator mounts — this one, the customer app, a partner app or
// the admin console — is decided by AppContainer.renderNavigator(); this
// navigator only shows the gate branch resolveGate() picks:
//
//   1. not authenticated      → onboarding (if unseen) + unauthenticated
//   2. pending TOTP           → admin TOTP (or first-time enrolment)
//   3. email not verified     → verify
//   4. partner, no/draft biz  → partner setup (resumes where it left off)
//   5. pending_approval       → pending
//   6. rejected               → rejected + setup routes (edit and resubmit)
//   7. suspended              → suspended
//
// ORDER MATTERS and lives in ONE place — navigators/sessionGate.ts — with a
// unit test; this file only maps the answer to routes.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../hooks/useReduxHooks';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../types';
import type { IRoute } from '../navigations-maps/types';
import {
  ADMIN_TOTP_ROUTES,
  EMAIL_VERIFY_ROUTES,
  ONBOARDING_ROUTE,
  PARTNER_SETUP_ROUTES,
  PENDING_ROUTES,
  REJECTED_ROUTES,
  SUSPENDED_ROUTES,
  UNAUTHENTICATED_ROUTES,
} from '../navigations-maps/Auth';
import { partnerSetupInitialRoute, resolveGate, type Gate } from './sessionGate';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BaseNavigator: React.FC = () => {
  const auth = useAppSelector(state => state.auth);
  const { colors } = useTheme();
  const gate: Gate = resolveGate(auth);

  const unauthenticated = [...(!auth.hasSeenOnboarding ? [ONBOARDING_ROUTE] : []), ...UNAUTHENTICATED_ROUTES];

  const BRANCHES: Partial<Record<Gate, IRoute[]>> = {
    totp: ADMIN_TOTP_ROUTES,
    verify: EMAIL_VERIFY_ROUTES,
    partnerSetup: PARTNER_SETUP_ROUTES,
    pending: PENDING_ROUTES,
    rejected: REJECTED_ROUTES,
    suspended: SUSPENDED_ROUTES,
  };
  const routes: IRoute[] = BRANCHES[gate] ?? unauthenticated;

  // Partner setup resumes where it was left (QA 15); a first-time admin
  // enrols an authenticator before the code step; every other branch starts
  // on its first route.
  const initialRouteName = (
    gate === 'partnerSetup'
      ? partnerSetupInitialRoute(auth.business)
      : gate === 'totp' && auth.pendingTotp && !auth.pendingTotp.enrolled
        ? 'TotpEnrol'
        : routes[0].title
  ) as keyof RootStackParamList;

  return (
    <Stack.Navigator
      id="BaseNavigator"
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
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
