// MetroMatrix — Verify Success: where the email's verification link lands
// (metromatrix://verify-email?token=… or ?verified=1). Deep links need a
// development or store build: Expo Go doesn't own the metromatrix:// scheme.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, InlineNotice, IonIcon, SkeletonLines } from '@custom/index';
import { AuthHeader, AuthScreen } from '@components/auth/AuthChrome';
import type { RootStackParamList } from '@/types';
import { selectIsAuthenticated } from '../authSlice';
import { selectVerifySuccess, verifyLinkAsync } from './verifySuccessSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifySuccess'>;

const makeStyles = ({ size, radius }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const VerifySuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const s = useAppSelector(selectVerifySuccess);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const token = route.params?.token;
  const verified = route.params?.verified === '1' || route.params?.verified === true;

  useEffect(() => {
    dispatch(verifyLinkAsync({ token, verified }));
  }, [token, verified, dispatch]);

  const ok = s.status === 'succeeded';
  const failed = s.status === 'failed';

  return (
    <AuthScreen>
      <View style={[styles.hero, { backgroundColor: failed ? colors.dangerSoft : service.accentSoft }]}>
        <IonIcon name={failed ? 'close-circle-outline' : 'checkmark-circle-outline'} size="xl" color={failed ? colors.danger : service.accent} />
      </View>
      <AuthHeader
        hideLogo
        title={failed ? "We couldn't verify that link" : ok ? 'Email verified' : 'Verifying your email'}
        subtitle={
          failed
            ? 'Open the app and tap Resend on the verification screen for a new link.'
            : ok && s.signedIn
              ? 'Taking you to the next step...'
              : ok
                ? 'Email verified, sign in to continue.'
                : 'One moment.'
        }
      />
      {s.status === 'loading' ? <SkeletonLines lines={2} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {/* Signed in, the gate replaces this screen; signed out, it leads to Sign In. */}
      {(ok && !s.signedIn) || (failed && !isAuthenticated) ? (
        <Button label="Continue to Sign In" onPress={() => navigation.navigate('SignIn')} fullWidth />
      ) : null}
      {failed && isAuthenticated ? (
        <Button label="Back to verification" onPress={() => navigation.navigate('EmailVerification')} fullWidth />
      ) : null}
      {ok && s.signedIn ? (
        <AppText variant="small" tone="muted" align="center">
          If nothing happens, close and reopen the app.
        </AppText>
      ) : null}
    </AuthScreen>
  );
};

export default VerifySuccessScreen;
