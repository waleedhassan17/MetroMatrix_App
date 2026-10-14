// ═══════════════════════════════════════════════════════
// MetroMatrix — Verify email
// ═══════════════════════════════════════════════════════
// Shows the address, takes the 6-digit code (auto-submits when complete),
// reports attempts left and the lock after the fifth miss, and counts down
// to the next resend from the server's retryAfter. A metromatrix://
// verify-email?code=… link fills and submits the code.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useCountdown } from '@hooks/useCountdown';
import { useSignOut } from '@hooks/useSignOut';
import { OTP_LENGTH } from '@models/authModel';
import { haptics } from '@utils/haptics';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, InlineNotice, OtpInput, ScreenShell, TextLink } from '@custom/index';
import type { RootStackParamList } from '@/types';
import { selectUser } from '../authSlice';
import {
  resendCodeAsync,
  selectEmailVerification,
  setCode,
  startCooldownIfIdle,
  verifyEmailAsync,
} from './emailVerificationSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerification'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    resend: { alignItems: 'center', gap: space.s4 },
  });

const EmailVerificationScreen: React.FC<Props> = ({ route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const state = useAppSelector(selectEmailVerification);
  const secondsLeft = useCountdown(state.resendAvailableAt);
  const { signOutNow, signingOut } = useSignOut();
  const linkCode = route.params?.code;

  useEffect(() => {
    dispatch(startCooldownIfIdle());
  }, [dispatch]);

  const verify = useCallback(
    async (code: string) => {
      if (code.length !== OTP_LENGTH || state.status === 'loading' || state.locked) return;
      const result = await dispatch(verifyEmailAsync(code));
      if (verifyEmailAsync.rejected.match(result)) haptics.warning();
      else haptics.success();
    },
    [dispatch, state.status, state.locked],
  );

  // Deep link: fill and submit once.
  useEffect(() => {
    if (linkCode && /^\d{6}$/.test(linkCode)) {
      dispatch(setCode(linkCode));
      void verify(linkCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  const resend = async () => {
    const result = await dispatch(resendCodeAsync());
    if (resendCodeAsync.fulfilled.match(result)) {
      Toast.show({ type: 'success', text1: 'New code sent', text2: `Check ${user?.email ?? 'your inbox'}.` });
    }
  };

  const attemptsMessage =
    state.locked
      ? 'Too many tries. Request a new code to continue.'
      : state.attemptsLeft !== null
        ? `${state.attemptsLeft} ${state.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
        : null;

  return (
    <ScreenShell
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${user?.email ?? 'your email'}.`}
      footer={
        <Button
          label="Verify email"
          onPress={() => verify(state.code)}
          loading={state.status === 'loading'}
          disabled={state.code.length !== OTP_LENGTH || state.locked}
          fullWidth
          size="lg"
        />
      }>
      {state.error.message && state.error.code !== 'OTP_LOCKED' ? (
        <InlineNotice
          tone={state.error.code === 'NETWORK_ERROR' ? 'warning' : 'error'}
          message={state.error.message}
        />
      ) : null}
      <Card>
        <OtpInput
          value={state.code}
          onChange={code => dispatch(setCode(code))}
          onComplete={verify}
          error={state.status === 'failed' && !!state.error.message}
          disabled={state.locked || state.status === 'loading'}
        />
        {attemptsMessage ? (
          <AppText variant="small" tone={state.locked ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
            {attemptsMessage}
          </AppText>
        ) : null}
      </Card>
      <View style={styles.resend}>
        {secondsLeft > 0 ? (
          <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
            Resend code in {secondsLeft}s
          </AppText>
        ) : (
          <Button
            label="Resend code"
            variant="ghost"
            onPress={resend}
            loading={state.resendStatus === 'loading'}
          />
        )}
      </View>
      <TextLink lead="Wrong email?" label={signingOut ? 'Signing out' : 'Sign out'} onPress={() => void signOutNow()} />
    </ScreenShell>
  );
};

export default EmailVerificationScreen;
