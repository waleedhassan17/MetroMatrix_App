// MetroMatrix — Verify Success: where the email's verification link lands
// (metromatrix://verify-email?token=… or ?verified=1). Deep links need a
// development or store build: Expo Go doesn't own the metromatrix:// scheme.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { Button, InlineNotice, IonIcon, SkeletonLines } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../Components/auth/AuthChrome';
import type { RootStackParamList } from '../../models';
import { selectIsAuthenticated } from '../../store/authSlice';
import { continueAsync, selectVerifySuccess, verifyLinkAsync } from './verifySuccessSlice';

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

const VerifySuccess: React.FC<Props> = ({ navigation, route }) => {
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
  const checking = ok && s.outcome === 'unconfirmed';
  const needsContinue = ok && (s.outcome === 'unreadable' || s.outcome === 'unconfirmed');
  const signInRoute = s.role === 'partner' ? 'ProviderSignIn' : 'SignIn';

  const title = failed
    ? s.retryable
      ? "We couldn't reach MetroMatrix"
      : "We couldn't verify that link"
    : checking
      ? 'Checking your email'
      : ok
        ? 'Email verified'
        : 'Verifying your email';
  const subtitle = failed
    ? s.retryable
      ? 'Your link is still good. Try again in a moment.'
      : 'Open the app and tap Resend on the verification screen for a new link.'
    : checking
      ? 'The link is still being registered. Tap Continue in a moment.'
      : ok && s.outcome === 'unreadable'
        ? "We couldn't load your account just now. Tap Continue."
        : ok && s.signedIn
          ? 'Taking you to the next step...'
          : ok
            ? 'Email verified, sign in to continue.'
            : 'One moment.';

  return (
    <AuthScreen>
      <View style={[styles.hero, { backgroundColor: failed ? colors.dangerSoft : service.accentSoft }]}>
        <IonIcon
          name={failed ? 'close-circle-outline' : checking ? 'time-outline' : 'checkmark-circle-outline'}
          size="xl"
          color={failed ? colors.danger : service.accent}
        />
      </View>
      <AuthHeader hideLogo title={title} subtitle={subtitle} />
      {s.status === 'loading' ? <SkeletonLines lines={2} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {failed && s.retryable ? (
        <Button label="Try again" onPress={() => dispatch(verifyLinkAsync({ token, verified }))} fullWidth />
      ) : null}
      {needsContinue ? (
        <Button label="Continue" onPress={() => dispatch(continueAsync())} loading={s.continuing} fullWidth />
      ) : null}
      {/* Signed in, the gate replaces this screen; signed out, it leads to the right sign-in. */}
      {(ok && !s.signedIn) || (failed && !isAuthenticated && !s.retryable) ? (
        <Button label="Continue to Sign In" onPress={() => navigation.navigate(signInRoute)} fullWidth />
      ) : null}
      {failed && isAuthenticated ? (
        <Button
          label="Back to verification"
          variant={s.retryable ? 'secondary' : 'primary'}
          onPress={() => navigation.navigate('EmailVerification')}
          fullWidth
        />
      ) : null}
    </AuthScreen>
  );
};

export default VerifySuccess;
