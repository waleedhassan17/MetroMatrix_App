// ═══════════════════════════════════════════════════════
// MetroMatrix — Enter Verification Code (reset step 2)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useCountdown } from '../../hooks/useCountdown';
import { OTP_LENGTH } from '../../models/authModel';
import { haptics } from '../../utils/haptics/haptics';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, InlineNotice, IonIcon, OtpInput } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../Components/auth/AuthChrome';
import { authErrorMessage } from '../../Components/auth/authErrorMessage';
import type { RootStackParamList } from '../../models';
import { requestCodeAsync, selectForgotPassword } from '../forgot-password-screen/forgotPasswordSlice';
import { resetOtp, selectResetPasswordOtp, setCode, verifyCodeAsync } from './resetPasswordOtpSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPasswordOTP'>;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailBox: { alignItems: 'center', gap: space.s4, padding: space.s16, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    center: { alignItems: 'center', gap: space.s4 },
  });

/** "45s", or "14 min" for a long throttle wait. */
const waitLabel = (seconds: number) => (seconds < 90 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`);

const ResetPasswordOTP: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  // Opened without an address (a bare link, a web bookmark): start at the email step instead of crashing.
  const email = route.params?.email ?? '';
  const userType = route.params?.userType ?? 'user';
  const s = useAppSelector(selectResetPasswordOtp);
  const forgot = useAppSelector(selectForgotPassword);
  const secondsLeft = useCountdown(forgot.resendAvailableAt);
  const { back } = useBack({ name: 'ForgotPassword', params: { email, userType } });
  // Expired or locked: this code is done; only a new one helps.
  const locked = s.needsNewCode || s.attemptsLeft === 0;
  const loading = s.status === 'loading';
  const sending = forgot.status === 'loading';

  useEffect(() => {
    if (!email) navigation.replace('ForgotPassword', { userType });
  }, [email, userType, navigation]);

  useEffect(() => {
    dispatch(resetOtp());
  }, [email, dispatch]);

  const verify = async (code: string) => {
    if (code.length !== OTP_LENGTH || loading || locked) return;
    const r = await dispatch(verifyCodeAsync({ email, code }));
    if (verifyCodeAsync.fulfilled.match(r)) {
      haptics.success();
      navigation.navigate('ResetPassword', { email, userType });
    } else haptics.warning();
  };

  const resend = async () => {
    if (sending) return;
    const r = await dispatch(requestCodeAsync(email));
    if (requestCodeAsync.fulfilled.match(r)) {
      dispatch(resetOtp());
      Toast.show({ type: 'success', text1: 'Code sent', text2: `A new code is on its way to ${email}.` });
    }
  };

  if (!email) return null;

  const wrongEmail = () => navigation.popTo('ForgotPassword', { email, userType });

  return (
    <AuthScreen onBack={back}>
      <View style={[styles.hero, { backgroundColor: colors.surfaceSunk }]}>
        <IonIcon name="keypad-outline" size="xl" color={colors.inkMuted} />
      </View>
      {/* As the FYP does: never says whether an account exists for the address. */}
      <AuthHeader hideLogo title="Enter Verification Code" subtitle="If an account exists for this email, a 6-digit code is on its way to" />
      <View style={styles.emailBox}>
        <AppText variant="bodyStrong">{email}</AppText>
        <Button label="Wrong email?" variant="ghost" size="sm" onPress={wrongEmail} />
      </View>

      {s.error.message || forgot.error.message ? (
        <InlineNotice
          message={
            forgot.error.message && !s.error.message
              ? authErrorMessage(forgot.error)
              : !locked && s.attemptsLeft
                ? `${authErrorMessage(s.error)} ${s.attemptsLeft} attempt${s.attemptsLeft === 1 ? '' : 's'} left.`
                : authErrorMessage(s.error)
          }
          action={
            locked && secondsLeft <= 0
              ? { label: sending ? 'Sending...' : 'Send a new code', onPress: () => void resend() }
              : undefined
          }
        />
      ) : null}

      <OtpInput
        value={s.code}
        onChange={v => dispatch(setCode(v))}
        onComplete={verify}
        error={s.status === 'failed'}
        disabled={loading || locked}
        autoFocus
        accessibilityLabel="Verification code"
      />
      <Button
        label={loading ? 'Verifying...' : 'Verify Code'}
        onPress={() => verify(s.code)}
        disabled={s.code.length !== OTP_LENGTH || loading || locked}
        fullWidth
      />
      <View style={styles.center}>
        <AppText variant="small" tone="muted">
          {"Didn't receive the code?"}
        </AppText>
        {secondsLeft > 0 ? (
          <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
            Resend code in {waitLabel(secondsLeft)}
          </AppText>
        ) : (
          <Button label="Resend Code" variant="ghost" size="sm" onPress={resend} loading={sending} />
        )}
      </View>
    </AuthScreen>
  );
};

export default ResetPasswordOTP;
