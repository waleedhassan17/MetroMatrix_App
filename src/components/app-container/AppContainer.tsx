// ═══════════════════════════════════════════════════════
// MetroMatrix — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate/ThemeProvider.
// Owns: session bootstrap (fetch-me), the renderNavigator() role switch, the
// navigation container + deep linking, the status bar, the native-splash
// release, the push pre-prompt, and toast notifications.

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { navigationTheme, useStyles, useTheme, type Theme } from '../../theme';
import { toastConfig } from '../../Custom-Components/toastConfig';

import BaseNavigator from '../../navigators/BaseNavigator';
import CustomerNavigator from '../../navigators/CustomerNavigator';
import StorePartnerNavigator from '../../navigators/StorePartnerNavigator';
import DoctorPartnerNavigator from '../../navigators/DoctorPartnerNavigator';
import KitchenPartnerNavigator from '../../navigators/KitchenPartnerNavigator';
import { resolveGate, isGateCleared } from '../../navigators/sessionGate';

import {
  bootstrapSession,
  refreshSession,
  selectIsAppReady,
  selectNetworkIsDown,
} from './appContainerSlice';
import { OfflineGate } from './OfflineGate';
import { PushPrePrompt } from './PushPrePrompt';
import { signOut } from '../../screens/Auth/authSlice';
import { resetAllState } from '../../store/resetAllState';
import { setSessionExpiredHandler, setBusinessStatusStaleHandler } from '../../utils/authEvents';

// ─── Deep linking ─────────────────────────────────────
// metromatrix://verify-email?code=123456          → EmailVerification
// metromatrix://reset-password?email=…&code=…     → ForgotPassword (code step)
// The same config gives the web build readable paths. Each root navigator
// owns different routes; a path only resolves while its navigator is mounted.
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['metromatrix://'],
  config: {
    screens: {
      // No screen claims '/': the gate's first route (Onboarding on a fresh
      // install, Welcome after) must win, as it does on native.
      Onboarding: 'intro',
      Welcome: 'welcome',
      CustomerSignIn: 'sign-in',
      CustomerSignUp: 'sign-up',
      PartnerSignIn: 'business/sign-in',
      PartnerSignUp: 'business/sign-up',
      ForgotPassword: 'reset-password',
      AdminSignIn: 'staff/sign-in',
      AdminTotp: 'staff/verify',
      TotpEnrol: 'staff/authenticator',
      EmailVerification: 'verify-email',
      ServiceSelect: 'business/service',
      BusinessProfile: 'business/details',
      Documents: 'business/documents',
      ReviewSubmit: 'business/review',
      PendingApproval: 'business/pending',
      Rejected: 'business/changes-needed',
      Suspended: 'business/paused',
      DesignGallery: 'dev/gallery',
      HomeTab: 'home',
      OrdersTab: 'orders',
      ApprovalsTab: {
        screens: { ApprovalQueue: 'approvals', BusinessReview: 'approvals/:id' },
      },
      ProfileTab: {
        screens: { Profile: 'profile', ChangePassword: 'profile/password' },
      },
    },
  } as LinkingOptions<ReactNavigation.RootParamList>['config'],
};

export const AppContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAppReady = useAppSelector(selectIsAppReady);
  const networkIsDown = useAppSelector(selectNetworkIsDown);
  const auth = useAppSelector(state => state.auth);
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const gate = resolveGate(auth);

  // ─── Session restore on cold start: stored token → GET /auth/me refreshes
  // the user and the app opens on their view; missing/invalid token →
  // Welcome. Sets isAppReady when done.
  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  // ─── Native splash: held from App.tsx (fonts) until the session gate is
  // known, so the first frame the user sees is the right navigator — never a
  // spinner, never a flash of Welcome before their home screen.
  useEffect(() => {
    if (isAppReady) {
      void SplashScreen.hideAsync().catch(() => {
        /* already hidden (fast refresh) */
      });
    }
  }, [isAppReady]);

  // ─── Session-expired bridge: when the axios 401-refresh flow gives up it
  // has already cleared the stored tokens; this resets the store so the
  // navigator switches back to Welcome instead of leaving the user on
  // authenticated screens whose every request fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(resetAllState());
      dispatch(signOut());
      Toast.show({ type: 'info', text1: 'Session expired', text2: 'Please sign in again.' });
    });
    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  // ─── Business-status-stale bridge: a partner request 403'd with
  // BUSINESS_SUSPENDED. Re-read /auth/me — the fresh business status makes
  // the gate route to Suspended. Debounced: a screen firing several requests
  // at once must trigger one refresh.
  const statusRefreshAt = useRef(0);
  useEffect(() => {
    setBusinessStatusStaleHandler(() => {
      const now = Date.now();
      if (now - statusRefreshAt.current < 5000) return;
      statusRefreshAt.current = now;
      dispatch(refreshSession());
    });
    return () => setBusinessStatusStaleHandler(null);
  }, [dispatch]);

  // ─── Which top-level navigator mounts. Every gated state is a branch inside
  // BaseNavigator; a cleared gate mounts the role's app. Keys make a swap
  // remount, so back-navigation can never cross from one app into another.
  const renderNavigator = () => {
    switch (gate) {
      case 'customer':
        return <CustomerNavigator key="customer" />;
      case 'partner':
        // Approved partner: the app for the business's service.
        switch (auth.business?.serviceType) {
          case 'healthcare':
            return <DoctorPartnerNavigator key="partner-doctor" />;
          case 'food':
            return <KitchenPartnerNavigator key="partner-kitchen" />;
          default:
            return <StorePartnerNavigator key="partner-store" />;
        }
      default:
        return <BaseNavigator key={`base-${gate}`} />;
    }
  };

  const offline = networkIsDown && !auth.isAuthenticated;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.canvas}
        translucent
      />
      {!isAppReady ? null : offline ? (
        <OfflineGate />
      ) : (
        <NavigationContainer linking={linking} theme={navigationTheme(theme)}>
          {renderNavigator()}
        </NavigationContainer>
      )}
      <PushPrePrompt active={isAppReady && isGateCleared(gate)} />
      <Toast config={toastConfig} topOffset={theme.space.s56} />
    </View>
  );
};

// The root paints canvas so no white frame shows behind a navigator swap or
// a dark-mode transition.
const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
  });

export default AppContainer;
