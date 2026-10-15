// ═══════════════════════════════════════════════════════
// MetroMatrix — Enter Verification Code (reset step 2)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useCountdown } from '@hooks/useCountdown';
import { OTP_LENGTH } from '@models/authModel';
import { USE_MOCK_API } from '@/config/env';
import { haptics } from '@utils/haptics';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, InlineNotice, IonIcon, OtpInput } from '@custom/index';
import { AuthHeader, AuthScreen } from '@components/auth/AuthChrome';
import type { RootStackParamList } from '@/types';
import { requestCodeAsync, selectForgotPassword } from '../ForgotPassword/forgotPasswordSlice';
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

const ResetPasswordOTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const { email, userType } = route.params;
  const s = useAppSelector(selectResetPasswordOtp);
  const forgot = useAppSelector(selectForgotPassword);
  const secondsLeft = useCountdown(forgot.resendAvailableAt);
  const locked = s.attemptsLeft === 0;
  const loading = s.status === 'loading';

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
    const r = await dispatch(requestCodeAsync(email));
    if (requestCodeAsync.fulfilled.match(r)) {
      dispatch(resetOtp());
      Toast.show({ type: 'success', text1: 'Code sent', text2: `A new code is on its way to ${email}.` });
    }
  };

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <View style={[styles.hero, { backgroundColor: service.accentSoft }]}>
        <IonIcon name="keypad-outline" size="xl" color={service.accent} />
      </View>
      <AuthHeader hideLogo title="Enter Verification Code" subtitle="We sent a 6-digit code to" />
      <View style={styles.emailBox}>
        <AppText variant="bodyStrong">{email}</AppText>
      </View>

      {s.error.message ? (
        <InlineNotice
          message={
            locked
              ? 'Too many attempts. Request a new code to try again.'
              : s.attemptsLeft
                ? `${s.error.message} ${s.attemptsLeft} attempt${s.attemptsLeft === 1 ? '' : 's'} left.`
                : s.error.message
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
            Resend code in {secondsLeft}s
          </AppText>
        ) : (
          <Button label="Resend Code" variant="ghost" size="sm" onPress={resend} loading={forgot.status === 'loading'} />
        )}
      </View>
      {USE_MOCK_API ? (
        <AppText variant="caption" tone="muted" align="center">
          Demo mode: the code is 123456.
        </AppText>
      ) : null}
    </AuthScreen>
  );
};

export default ResetPasswordOTPScreen;
