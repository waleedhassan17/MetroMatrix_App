// ═══════════════════════════════════════════════════════
// MetroMatrix — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate. Owns: session
// bootstrap (fetch-me), the renderNavigator() role switch, the navigation
// container, deep linking, the status bar, the native-splash release, and
// toast notifications.

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import type { RootStackParamList } from '../../types';

import BaseNavigator from '../../navigators/BaseNavigator';

import { bootstrapSession, selectIsAppReady } from './appContainerSlice';
import { signOut } from '../../screens/Auth/authSlice';
import { resetAllState } from '../../store/resetAllState';
import { setSessionExpiredHandler, setBusinessStatusStaleHandler } from '../../utils/authEvents';

// ─── Deep linking ─────────────────────────────────────
// metromatrix://verify-email   → Email verification (P3)
// metromatrix://reset-password → Forgot-password OTP step (P3)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['metromatrix://'],
};

export const AppContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAppReady = useAppSelector(selectIsAppReady);

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
  // has already cleared the stored tokens; this handler resets the store so
  // the navigator switches back to Welcome instead of leaving the user on
  // authenticated screens whose every request fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(resetAllState());
      dispatch(signOut());
      Toast.show({
        type: 'info',
        text1: 'Session expired',
        text2: 'Please sign in again.',
      });
    });
    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  // ─── Business-status-stale bridge: a partner request 403'd with
  // BUSINESS_SUSPENDED. Re-run the session bootstrap — /auth/me returns the
  // fresh business status and BaseNavigator swaps to the Suspended gate.
  // Debounced: a screen firing several requests at once must trigger only
  // one refresh.
  const statusRefreshAt = useRef(0);
  useEffect(() => {
    setBusinessStatusStaleHandler(() => {
      const now = Date.now();
      if (now - statusRefreshAt.current < 5000) return;
      statusRefreshAt.current = now;
      dispatch(bootstrapSession());
    });
    return () => setBusinessStatusStaleHandler(null);
  }, [dispatch]);

  // ─── Which top-level navigator mounts. Every gated state — unauthenticated,
  // TOTP pending, email unverified, partner setup / pending / rejected /
  // suspended — is a branch inside BaseNavigator. Customer, approved-partner
  // and admin navigators arrive with their phases (P3–P5). Keys make a swap
  // remount, so back-navigation cannot cross from one app into another.
  const renderNavigator = () => <BaseNavigator key="base-unauthenticated" />;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" translucent />
      <View style={styles.container}>
        {isAppReady ? (
          <NavigationContainer linking={linking}>{renderNavigator()}</NavigationContainer>
        ) : null}
      </View>
      <Toast />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default AppContainer;
