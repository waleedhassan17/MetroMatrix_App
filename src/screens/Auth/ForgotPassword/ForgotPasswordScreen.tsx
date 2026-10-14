// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset password (email → code → new password)
// ═══════════════════════════════════════════════════════
// One screen, three steps from its slice. Ends back on sign-in with a
// success toast (QA 11). A metromatrix://reset-password?email=…&code=…
// link opens straight on the code step.

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useCountdown } from '@hooks/useCountdown';
import { OTP_LENGTH, hasErrors, validateEmail, validateNewPassword } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { useStyles, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  InlineNotice,
  OtpInput,
  PasswordStrength,
  ScreenShell,
  TextField,
} from '@custom/index';
import type { RootStackParamList } from '@/types';
import {
  prefillFromLink,
  requestCodeAsync,
  resetForgotPassword,
  resetPasswordAsync,
  selectForgotPassword,
  setCode,
  setConfirmPassword,
  setEmail,
  setPassword,
  stepBack,
  touch,
  verifyCodeAsync,
} from './forgotPasswordSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const COPY = {
  email: { title: 'Reset your password', subtitle: "Enter your account email and we'll send a 6-digit code." },
  otp: { title: 'Enter the code', subtitle: '' },
  reset: { title: 'Choose a new password', subtitle: 'At least 8 characters, with a letter and a number.' },
  done: { title: 'Password updated', subtitle: '' },
} as const;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    center: { alignItems: 'center', gap: space.s4 },
  });

const ForgotPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectForgotPassword);
  const secondsLeft = useCountdown(s.resendAvailableAt);
  const confirmRef = useRef<TextInput>(null);
  const portal = route.params?.portal ?? 'customer';
  const loading = s.status === 'loading';

  // Prefill from the sign-in form or a reset link; forget everything on leave.
  useEffect(() => {
    dispatch(prefillFromLink({ email: route.params?.email, code: route.params?.code }));
    return () => {
      dispatch(resetForgotPassword());
    };
  }, [dispatch, route.params?.email, route.params?.code]);

  // Finished: back to the sign-in this flow started from, with the email.
  useEffect(() => {
    if (s.step !== 'done') return;
    haptics.success();
    Toast.show({ type: 'success', text1: 'Password updated', text2: 'Sign in with your new password.' });
    navigation.popTo(portal === 'partner' ? 'PartnerSignIn' : 'CustomerSignIn', { email: s.email.trim() });
  }, [s.step, s.email, portal, navigation]);

  const emailError = validateEmail(s.email);
  const passwordErrors = validateNewPassword({ password: s.password, confirmPassword: s.confirmPassword });
  const shownPassword = visibleErrors(passwordErrors, s.touched);

  const requestCode = async () => {
    if (emailError || loading) return;
    const r = await dispatch(requestCodeAsync(s.email.trim()));
    if (requestCodeAsync.rejected.match(r)) haptics.warning();
  };
  const verifyCode = async (code = s.code) => {
    if (code.length !== OTP_LENGTH || loading) return;
    const r = await dispatch(verifyCodeAsync({ email: s.email.trim(), code }));
    if (verifyCodeAsync.rejected.match(r)) haptics.warning();
  };
  const resetPassword = async () => {
    if (hasErrors(passwordErrors) || loading) return;
    const r = await dispatch(resetPasswordAsync({ resetToken: s.resetToken, password: s.password }));
    if (resetPasswordAsync.rejected.match(r)) haptics.warning();
  };

  const step = s.step === 'done' ? 'reset' : s.step;
  const back = () => (step === 'email' ? navigation.goBack() : dispatch(stepBack()));

  const footer =
    step === 'email' ? (
      <Button label="Send code" onPress={requestCode} loading={loading} disabled={!!emailError} fullWidth size="lg" />
    ) : step === 'otp' ? (
      <Button
        label="Continue"
        onPress={() => verifyCode()}
        loading={loading}
        disabled={s.code.length !== OTP_LENGTH || s.attemptsLeft === 0}
        fullWidth
        size="lg"
      />
    ) : (
      <Button
        label="Update password"
        onPress={resetPassword}
        loading={loading}
        disabled={hasErrors(passwordErrors)}
        fullWidth
        size="lg"
      />
    );

  return (
    <ScreenShell
      eyebrow={`Step ${step === 'email' ? 1 : step === 'otp' ? 2 : 3} of 3`}
      title={COPY[step].title}
      subtitle={step === 'otp' ? `We sent a code to ${s.email.trim()}.` : COPY[step].subtitle}
      onBack={back}
      footer={footer}>
      {s.error.message ? (
        <InlineNotice
          tone={s.error.code === 'NETWORK_ERROR' ? 'warning' : 'error'}
          title={s.error.code === 'NETWORK_ERROR' ? "You're offline" : undefined}
          message={s.error.code === 'NETWORK_ERROR' ? 'Check your connection, then try again.' : s.error.message}
        />
      ) : null}

      {step === 'email' ? (
        <Card>
          <TextField
            label="Email"
            mode="email"
            value={s.email}
            onChangeText={v => dispatch(setEmail(v))}
            onBlur={() => dispatch(touch('email'))}
            error={s.touched.email ? emailError : undefined}
            placeholder="you@example.com"
            returnKeyType="send"
            onSubmitEditing={requestCode}
            autoFocus
          />
        </Card>
      ) : null}

      {step === 'otp' ? (
        <>
          <Card>
            <OtpInput
              value={s.code}
              onChange={v => dispatch(setCode(v))}
              onComplete={verifyCode}
              error={!!s.error.message}
              disabled={loading || s.attemptsLeft === 0}
            />
            {s.attemptsLeft !== null ? (
              <AppText variant="small" tone={s.attemptsLeft === 0 ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
                {s.attemptsLeft === 0
                  ? 'Too many tries. Request a new code.'
                  : `${s.attemptsLeft} ${s.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`}
              </AppText>
            ) : null}
          </Card>
          <View style={styles.center}>
            {secondsLeft > 0 ? (
              <AppText variant="small" tone="muted">
                Resend code in {secondsLeft}s
              </AppText>
            ) : (
              <Button label="Resend code" variant="ghost" onPress={requestCode} loading={loading} />
            )}
          </View>
        </>
      ) : null}

      {step === 'reset' ? (
        <Card>
          <TextField
            label="New password"
            mode="password"
            value={s.password}
            onChangeText={v => dispatch(setPassword(v))}
            onBlur={() => dispatch(touch('password'))}
            error={shownPassword.password}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            submitBehavior="submit"
            autoFocus
          />
          <PasswordStrength password={s.password} />
          <TextField
            ref={confirmRef}
            label="Confirm new password"
            mode="password"
            value={s.confirmPassword}
            onChangeText={v => dispatch(setConfirmPassword(v))}
            onBlur={() => dispatch(touch('confirmPassword'))}
            error={shownPassword.confirmPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={resetPassword}
          />
        </Card>
      ) : null}
    </ScreenShell>
  );
};

export default ForgotPasswordScreen;
