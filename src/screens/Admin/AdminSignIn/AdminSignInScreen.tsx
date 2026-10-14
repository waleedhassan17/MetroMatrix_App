// ═══════════════════════════════════════════════════════
// MetroMatrix — Staff sign in (and its TOTP step)
// ═══════════════════════════════════════════════════════
// Registered twice: as AdminSignIn (email + password, unauthenticated
// branch) and as AdminTotp (the code step, TOTP branch). Same screen and
// slice; the route decides which step shows.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { OTP_LENGTH, hasErrors, validateSignIn } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { useStyles, type Theme } from '@theme/index';
import { Button, Card, InlineNotice, OtpInput, ScreenShell, TextField } from '@custom/index';
import { SignInForm } from '@components/auth/AuthForms';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import type { RootStackParamList } from '@/types';
import { selectPendingTotp, setPendingTotp } from '../../Auth/authSlice';
import {
  resetTotp,
  selectAdminSignIn,
  setCode,
  setEmail,
  setPassword,
  setRecoveryCode,
  signInAsync,
  toggleRecovery,
  touch,
  verifyTotpAsync,
} from './adminSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminSignIn' | 'AdminTotp'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    center: { alignItems: 'center', gap: space.s8 },
  });

const AdminSignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminSignIn);
  const pendingTotp = useAppSelector(selectPendingTotp);
  const totpStep = route.name === 'AdminTotp';
  const prefill = route.name === 'AdminSignIn' ? route.params?.email : undefined;

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  // ─── Step 1: email + password ──────────────────────
  const errors = validateSignIn({ email: s.email, password: s.password });
  const shown = visibleErrors(errors, s.touched);

  const signIn = async () => {
    if (hasErrors(errors) || s.status === 'loading') return;
    const r = await dispatch(signInAsync({ email: s.email.trim(), password: s.password }));
    if (signInAsync.rejected.match(r)) haptics.warning();
  };

  // ─── Step 2: TOTP or recovery code ─────────────────
  const verify = async (code = s.code) => {
    if (!pendingTotp || s.totpStatus === 'loading') return;
    if (!s.useRecovery && code.length !== OTP_LENGTH) return;
    if (s.useRecovery && s.recoveryCode.trim().length < 6) return;
    const r = await dispatch(
      verifyTotpAsync(
        s.useRecovery
          ? { challengeToken: pendingTotp.challengeToken, recoveryCode: s.recoveryCode }
          : { challengeToken: pendingTotp.challengeToken, code },
      ),
    );
    if (verifyTotpAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  const cancelTotp = () => {
    dispatch(resetTotp());
    dispatch(setPendingTotp(null));
  };

  if (totpStep) {
    const ready = s.useRecovery ? s.recoveryCode.trim().length >= 6 : s.code.length === OTP_LENGTH;
    return (
      <ScreenShell
        eyebrow="Staff"
        title={s.useRecovery ? 'Use a recovery code' : 'Two-step verification'}
        subtitle={
          s.useRecovery
            ? 'Enter one of the recovery codes you saved when you set up your authenticator.'
            : `Enter the 6-digit code from your authenticator app for ${pendingTotp?.email ?? 'your account'}.`
        }
        onBack={cancelTotp}
        footer={
          <Button
            label="Verify"
            onPress={() => verify()}
            loading={s.totpStatus === 'loading'}
            disabled={!ready}
            fullWidth
            size="lg"
          />
        }>
        {s.totpError.message ? <InlineNotice message={s.totpError.message} /> : null}
        <Card>
          {s.useRecovery ? (
            <TextField
              label="Recovery code"
              value={s.recoveryCode}
              onChangeText={v => dispatch(setRecoveryCode(v))}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABCD-EFGH"
              returnKeyType="go"
              onSubmitEditing={() => verify()}
              autoFocus
            />
          ) : (
            <OtpInput
              value={s.code}
              onChange={v => dispatch(setCode(v))}
              onComplete={verify}
              error={!!s.totpError.message}
              disabled={s.totpStatus === 'loading'}
              accessibilityLabel="Authenticator code"
            />
          )}
        </Card>
        <View style={styles.center}>
          <Button
            label={s.useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
            variant="ghost"
            onPress={() => dispatch(toggleRecovery())}
          />
          <Button label="Cancel sign-in" variant="ghost" size="sm" onPress={cancelTotp} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="MetroMatrix team"
      title="Staff sign in"
      subtitle="For approvals and support. Two-step verification is required."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <Button
          label="Continue"
          onPress={signIn}
          loading={s.status === 'loading'}
          disabled={hasErrors(errors)}
          fullWidth
          size="lg"
        />
      }>
      <AuthErrorNotice
        error={s.error}
        onGoToPortal={portal =>
          navigation.navigate(portal === 'partner' ? 'PartnerSignIn' : 'CustomerSignIn', { email: s.email.trim() })
        }
      />
      <SignInForm
        email={s.email}
        password={s.password}
        errors={shown}
        onChangeEmail={v => dispatch(setEmail(v))}
        onChangePassword={v => dispatch(setPassword(v))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={signIn}
        disabled={s.status === 'loading'}
      />
    </ScreenShell>
  );
};

export default AdminSignInScreen;
