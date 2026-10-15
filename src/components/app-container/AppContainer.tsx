// ═══════════════════════════════════════════════════════
// MetroMatrix — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate/ThemeProvider.
// Owns: session bootstrap (fetch-me), the renderNavigator() role switch, the
// navigation container + deep linking, the status bar, the native-splash
// release, the push pre-prompt, and toast notifications.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import * as NativeSplash from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { navigationTheme, useStyles, useTheme, type Theme } from '../../theme';
import { toastConfig } from '../../Custom-Components/toastConfig';

import BaseNavigator from '../../navigators/BaseNavigator';
import CustomerNavigator from '../../navigators/CustomerNavigator';
import StorePartnerNavigator from '../../navigators/StorePartnerNavigator';
import DoctorPartnerNavigator from '../../navigators/DoctorPartnerNavigator';
import KitchenPartnerNavigator from '../../navigators/KitchenPartnerNavigator';
import AdminNavigator from '../../navigators/AdminNavigator';
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
import { SplashScreen } from '../../screens/Onboarding/Splash/SplashScreen';
import { resetAllState } from '../../store/resetAllState';
import { setSessionExpiredHandler, setBusinessStatusStaleHandler } from '../../utils/authEvents';

// ─── Deep linking ─────────────────────────────────────
// metromatrix://verify-success?token=…        → VerifySuccess (the email link)
// metromatrix://reset-password?email=…        → ResetPasswordOTP
// The same config gives the web build readable paths. Each root navigator
// owns different routes; a path only resolves while its navigator is mounted.
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['metromatrix://'],
  config: {
    screens: {
      // No screen claims '/': the gate's first route (Onboarding on a fresh
      // install, Role Selection after) must win, as it does on native.
      Onboarding: 'intro',
      RoleSelection: 'get-started',
      ProviderSelection: 'provider/choose-service',
      SignIn: 'sign-in',
      SignUp: 'sign-up',
      ProviderSignIn: 'provider/sign-in',
      ProviderSignUp: 'provider/sign-up',
      ForgotPassword: 'forgot-password',
      ResetPasswordOTP: 'reset-password',
      ResetPassword: 'reset-password/new',
      EmailVerification: 'verify-email',
      VerifySuccess: 'verify-success',
      CompleteProfile: 'complete-profile',
      PersonalInfo: 'provider/personal-info',
      ProviderApprovalPending: 'provider/pending',
      Rejected: 'provider/changes-needed',
      Suspended: 'provider/paused',
      AdminTotp: 'staff/verify',
      AdminTwoFactorEnrol: 'staff/authenticator',
      DesignGallery: 'dev/gallery',
      // /home (a partner's home too), /home/food, /home/services/healthcare
      HomeTab: {
        path: 'home',
        screens: { CustomerHome: '', FoodHome: 'food', ServicePreview: 'services/:service' },
      },
      OrdersTab: {
        path: 'orders',
        screens: { Orders: '' },
      },
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
  // Role Selection. Sets isAppReady when done.
  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  // ─── Splash: the native splash is held from App.tsx until the JS splash
  // has painted the same mark in the same place, then released — native → JS
  // reads as one moment. The JS splash plays every launch and stays up until
  // BOTH its animation and bootstrapSession are done, so it can never lift
  // onto a stale route; then it fades out over the right navigator.
  const [splashPlayed, setSplashPlayed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const releaseNativeSplash = useCallback(() => {
    void NativeSplash.hideAsync().catch(() => {
      /* already hidden (fast refresh) */
    });
  }, []);
  const onSplashPlayed = useCallback(() => setSplashPlayed(true), []);

  useEffect(() => {
    if (!splashPlayed || !isAppReady) return;
    const fade = Animated.timing(splashOpacity, {
      toValue: 0,
      duration: theme.motion.sheet.duration,
      useNativeDriver: true,
    });
    fade.start(() => setSplashGone(true));
    return () => fade.stop();
  }, [splashPlayed, isAppReady, splashOpacity, theme.motion.sheet.duration]);

  // ─── Session-expired bridge: when the axios 401-refresh flow gives up it
  // has already cleared the stored tokens; this resets the store so the
  // navigator switches back to Role Selection instead of leaving the user on
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
      case 'admin':
        return <AdminNavigator key="admin" />;
      default:
        return <BaseNavigator key={`base-${gate}`} />;
    }
  };

  const offline = networkIsDown && !auth.isAuthenticated;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
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
      <PushPrePrompt active={splashGone && isGateCleared(gate)} />
      {splashGone ? null : (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
          pointerEvents={splashPlayed && isAppReady ? 'none' : 'auto'}
          onLayout={releaseNativeSplash}>
          <SplashScreen onDone={onSplashPlayed} />
        </Animated.View>
      )}
      <Toast config={toastConfig} topOffset={theme.space.s56} />
    </View>
  );
};

// The root paints canvas so no blank frame shows behind a navigator swap.
const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
  });

export default AppContainer;
