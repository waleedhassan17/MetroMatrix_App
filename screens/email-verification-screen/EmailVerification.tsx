// ═══════════════════════════════════════════════════════
// MetroMatrix — Verify Your Email (the FYP's link flow, decluttered)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useCountdown } from '../../hooks/useCountdown';
import { useSignOut } from '../../hooks/useSignOut';
import { haptics } from '../../utils/haptics/haptics';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, InlineNotice, IonIcon, LiveDot, TextAction, type IonName } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../Components/auth/AuthChrome';
import { selectUser } from '../../store/authSlice';
import { checkVerifiedAsync, markManualCheck, nextResendKey, resendAsync, selectEmailVerification } from './emailVerificationSlice';
import { useVerificationPolling } from './useVerificationPolling';
import { ERROR_CODES } from '../../networks/network/network';

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sentTo: { alignItems: 'center', gap: space.s4 },
    status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s8 },
    actions: { gap: space.s8 },
    // As tall as the Resend button, so the page doesn't jump when it appears.
    resend: { alignItems: 'center', justifyContent: 'center', minHeight: size.control.md },
    tips: {
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      ...elevation.none,
    },
    tip: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s4, flexWrap: 'wrap' },
  });

/** 51 → "0:51", 75 → "1:15". */
export const clockOf = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const TIPS: { icon: IonName; text: string }[] = [
  { icon: 'folder-open-outline', text: 'Check your spam or promotions folder.' },
  { icon: 'time-outline', text: 'Still nothing after a few minutes? Resend it.' },
];

/**
 * "Check your inbox", decluttered on 2026-11-25 (the owner found the FYP's
 * two cards of six tips messy): the address once, a live line saying the
 * screen is watching for the link, one action, Resend, and one short card
 * for when the email doesn't come. The screen still moves on by itself
 * (useVerificationPolling); the button is the same check, on demand.
 */
const EmailVerification: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const user = useAppSelector(selectUser);
  const s = useAppSelector(selectEmailVerification);
  const secondsLeft = useCountdown(s.resendAvailableAt);
  const { signOutNow, signingOut } = useSignOut();

  useVerificationPolling(s.failures, s.autoSignIn);

  const check = async () => {
    // A quiet check is already on the wire: it reports to the person instead.
    if (s.inFlight) {
      dispatch(markManualCheck());
      return;
    }
    const r = await dispatch(checkVerifiedAsync({ silent: false }));
    if (checkVerifiedAsync.fulfilled.match(r) && r.payload) haptics.success();
    else haptics.warning();
  };

  const resend = async () => {
    const r = await dispatch(resendAsync({ key: nextResendKey(s) }));
    if (resendAsync.fulfilled.match(r) && !r.payload.alreadyVerified) {
      Toast.show({ type: 'success', text1: 'Email sent', text2: `We sent a new link to ${user?.email ?? 'your inbox'}.` });
    }
  };

  const differentAccount = () => void signOutNow({ landing: user?.role === 'partner' ? 'ProviderSignIn' : 'SignIn' });

  return (
    <AuthScreen>
      <View style={[styles.hero, { backgroundColor: colors.surfaceSunk }]}>
        <IonIcon name="mail-unread-outline" size="xl" color={colors.inkMuted} />
      </View>
      <AuthHeader hideLogo title="Check your inbox" />

      <View style={styles.sentTo}>
        <AppText variant="body" tone="muted" align="center">
          We sent a verification link to
        </AppText>
        <AppText variant="bodyStrong" align="center" selectable>
          {user?.email ?? ''}
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          Tap the link in the email to verify your account.
        </AppText>
      </View>

      {s.autoSignIn ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <IonIcon name="checkmark-circle" size="md" color={service.accent} />
          <AppText variant="bodyStrong" tone="accentDeep">
            Email verified. Signing you in...
          </AppText>
        </View>
      ) : (
        <View style={styles.status}>
          <LiveDot color={service.accent} />
          <AppText variant="small" tone="muted">
            Waiting for you to tap the link
          </AppText>
        </View>
      )}

      {s.error.message ? (
        <InlineNotice tone={s.error.code === ERROR_CODES.NOT_VERIFIED ? 'info' : 'error'} message={s.error.message} />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={s.autoSignIn ? 'Email verified' : "I've verified my email"}
          onPress={check}
          loading={s.status === 'loading'}
          disabled={s.autoSignIn}
          fullWidth
        />
        {s.autoSignIn ? null : (
          <View style={styles.resend}>
            {secondsLeft > 0 ? (
              // Not a live region: it would read out every second.
              <AppText variant="small" tone="muted">
                Resend email in {clockOf(secondsLeft)}
              </AppText>
            ) : (
              <Button label="Resend email" variant="ghost" onPress={resend} loading={s.resendStatus === 'loading'} />
            )}
          </View>
        )}
      </View>

      {s.autoSignIn ? null : (
        <View style={styles.tips}>
          <AppText variant="title">Didn&apos;t get the email?</AppText>
          {TIPS.map(tip => (
            <View key={tip.text} style={styles.tip}>
              <IonIcon name={tip.icon} size="md" color={colors.inkMuted} />
              <AppText variant="body" tone="muted" style={styles.grow}>
                {tip.text}
              </AppText>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <AppText variant="small" tone="muted">
          Wrong email?
        </AppText>
        <TextAction
          label={signingOut ? 'Signing out...' : 'Use a different account'}
          onPress={differentAccount}
          disabled={signingOut}
        />
      </View>
    </AuthScreen>
  );
};

export default EmailVerification;
