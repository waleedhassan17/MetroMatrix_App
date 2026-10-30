// ═══════════════════════════════════════════════════════
// MetroMatrix — Verify Your Email (the FYP's link flow)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useCountdown } from '@hooks/useCountdown';
import { useSignOut } from '@hooks/useSignOut';
import { haptics } from '@utils/haptics';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, InlineNotice, IonIcon, type IonName } from '@custom/index';
import { AuthHeader, AuthScreen } from '@components/auth/AuthChrome';
import { selectUser } from '../authSlice';
import { checkVerifiedAsync, resendAsync, selectEmailVerification, startCooldownIfIdle } from './emailVerificationSlice';
import { useVerificationPolling } from './useVerificationPolling';
import { ERROR_CODES } from '@networks/network/errorCodes';

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailBox: {
      alignItems: 'center',
      gap: space.s4,
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
    },
    auto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s8 },
    card: {
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.md,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    step: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    center: { alignItems: 'center' },
  });

const Steps: React.FC<{ title: string; items: { icon: IonName; text: string }[] }> = ({ title, items }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={styles.card}>
      <AppText variant="title">{title}</AppText>
      {items.map(item => (
        <View key={item.text} style={styles.step}>
          <IonIcon name={item.icon} size="md" color={service.accent} />
          <AppText variant="body" tone="muted" style={{ flex: 1 }}>
            {item.text}
          </AppText>
        </View>
      ))}
    </View>
  );
};

const EmailVerificationScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const user = useAppSelector(selectUser);
  const s = useAppSelector(selectEmailVerification);
  const secondsLeft = useCountdown(s.resendAvailableAt);
  const { signOutNow, signingOut } = useSignOut();

  useEffect(() => {
    dispatch(startCooldownIfIdle());
  }, [dispatch]);

  useVerificationPolling(s.failures, s.autoSignIn);

  const check = async () => {
    const r = await dispatch(checkVerifiedAsync({ silent: false }));
    if (checkVerifiedAsync.fulfilled.match(r) && r.payload) haptics.success();
    else haptics.warning();
  };

  const resend = async () => {
    const r = await dispatch(resendAsync());
    if (resendAsync.fulfilled.match(r) && !r.payload.alreadyVerified) {
      Toast.show({ type: 'success', text1: 'Email sent', text2: `We sent a new link to ${user?.email ?? 'your inbox'}.` });
    }
  };

  return (
    <AuthScreen>
      <View style={[styles.hero, { backgroundColor: service.accentSoft }]}>
        <IonIcon name="mail-unread-outline" size="xl" color={service.accent} />
      </View>
      <AuthHeader hideLogo title="Check your inbox" subtitle="We've sent a verification link to your email address." />

      <View style={styles.emailBox}>
        <AppText variant="small" tone="muted">
          Email sent to:
        </AppText>
        <AppText variant="bodyStrong">{user?.email ?? ''}</AppText>
      </View>

      {s.autoSignIn ? (
        <View style={styles.auto} accessibilityLiveRegion="polite">
          <IonIcon name="checkmark-circle" size="md" color={service.accent} />
          <AppText variant="bodyStrong" tone="accentDeep">
            Email verified — signing you in automatically...
          </AppText>
        </View>
      ) : null}

      {s.error.message ? (
        <InlineNotice tone={s.error.code === ERROR_CODES.NOT_VERIFIED ? 'info' : 'error'} message={s.error.message} />
      ) : null}

      <Button
        label={s.autoSignIn ? 'Email Verified' : 'I Verified My Email'}
        onPress={check}
        loading={s.status === 'loading'}
        disabled={s.autoSignIn}
        fullWidth
      />
      <View style={styles.center}>
        {secondsLeft > 0 ? (
          <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
            Resend email in {secondsLeft}s
          </AppText>
        ) : (
          <Button label="Resend Email" variant="ghost" onPress={resend} loading={s.resendStatus === 'loading'} />
        )}
      </View>

      <Steps
        title="How to verify:"
        items={[
          { icon: 'mail-outline', text: 'Check your email inbox (and spam folder)' },
          { icon: 'link-outline', text: 'Click the verification link in the email' },
          { icon: 'checkmark-done-outline', text: 'Come back here — we sign you in automatically' },
        ]}
      />
      <Steps
        title="Didn't receive the email?"
        items={[
          { icon: 'folder-open-outline', text: 'Check your spam/junk folder' },
          { icon: 'at-outline', text: 'Make sure the email address above is correct' },
          { icon: 'time-outline', text: 'Wait a few minutes, then tap "Resend Email"' },
        ]}
      />
      <View style={styles.center}>
        <Button
          label="Use a different account"
          variant="ghost"
          size="sm"
          disabled={signingOut}
          onPress={() => void signOutNow({ landing: 'SignIn' })}
        />
        <Button label={signingOut ? 'Signing out...' : 'Sign out'} variant="ghost" size="sm" onPress={() => void signOutNow()} />
      </View>
    </AuthScreen>
  );
};

export default EmailVerificationScreen;
