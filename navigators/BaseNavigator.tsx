// ═══════════════════════════════════════════════════════
// MetroMatrix — BaseNavigator (auth / onboarding / status gates)
// ═══════════════════════════════════════════════════════
// Dumb mapper over the route arrays in navigations-maps/Auth.ts. Which
// top-level navigator mounts — this one, the customer app, a partner app or
// the admin console — is decided by AppContainer.renderNavigator(); this
// navigator only shows the gate branch resolveGate() picks:
//
//   1. not authenticated      → onboarding (if unseen) + Role Selection …
//   2. pending TOTP           → admin TOTP (or first-time enrolment)
//   3. email not verified     → Email Verification
//   4. user, profile pending  → Complete Profile
//   5. provider, no/draft app → Personal Info (resumes at the unfinished step)
//   6. pending_approval       → Provider Approval Pending
//   7. rejected               → Rejected + Personal Info (edit and resubmit)
//   8. suspended              → Suspended
//
// ORDER MATTERS and lives in ONE place — navigators/sessionGate.ts — with a
// unit test; this file only maps the answer to routes.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../hooks/useReduxHooks';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../types';
import type { IRoute } from '../navigations-maps/types';
import { gateRoutes } from '../navigations-maps/Auth';
import { gateInputOf, partnerSetupInitialRoute, resolveGate, totpInitialRoute, type Gate } from './sessionGate';
import { selectSkippedProfile } from '../store/preferencesSlice';
import { selectPendingPick } from '../screens/ProviderSelection/providerSelectionSlice';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BaseNavigator: React.FC = () => {
  const auth = useAppSelector(state => state.auth);
  const pendingPick = useAppSelector(selectPendingPick);
  const { colors } = useTheme();
  const skippedProfile = useAppSelector(selectSkippedProfile);
  const gate: Gate = resolveGate(gateInputOf(auth, skippedProfile));

  const routes: IRoute[] = gateRoutes(gate, auth.hasSeenOnboarding);

  // A first-time admin enrols an authenticator before the code step; a
  // provider whose service isn't known yet chooses it first; every other
  // branch starts on its first route (Personal Info resumes its own step).
  const initialRouteName = (
    gate === 'totp'
      ? totpInitialRoute(auth.pendingTotp)
      : gate === 'partnerSetup'
        ? partnerSetupInitialRoute(auth.business, pendingPick?.subType, auth.user)
        : gate === 'unauthenticated' && auth.signedOutLanding
          ? auth.signedOutLanding
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
