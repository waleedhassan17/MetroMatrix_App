// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset Password (step 3): new + confirm, back to sign-in
// ═══════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { hasErrors, validateNewPassword } from '../../models/authModel';
import { visibleErrors } from '../../utils/form-errors/formErrors';
import { haptics } from '../../utils/haptics/haptics';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { Button, InlineNotice, IonIcon, PasswordStrength, TextField } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../Components/auth/AuthChrome';
import type { RootStackParamList } from '../../models';
import { resetForgotPassword } from '../forgot-password-screen/forgotPasswordSlice';
import { selectResetToken } from '../reset-password-otp-screen/resetPasswordOtpSlice';
import { resetPasswordAsync, resetResetPassword, selectResetPassword, setField, touch, touchAll } from './resetPasswordSlice';
import { ERROR_CODES } from '../../networks/network/apiHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: { gap: space.s16 },
  });

const ResetPassword: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const { email, userType } = route.params;
  const resetToken = useAppSelector(selectResetToken);
  const s = useAppSelector(selectResetPassword);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    dispatch(resetResetPassword());
  }, [resetToken, dispatch]);

  const errors = validateNewPassword({ password: s.password, confirmPassword: s.confirmPassword });
  const shown = visibleErrors(errors, s.touched);
  const loading = s.status === 'loading';
  // No token: a reload on web, or a spent / expired one (the API's
  // OTP_INVALID here) — get a new code.
  const tokenSpent = !resetToken || s.error.code === ERROR_CODES.OTP_INVALID;

  const submit = async () => {
    if (loading || tokenSpent) return;
    if (hasErrors(errors)) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
    const r = await dispatch(resetPasswordAsync({ resetToken, password: s.password }));
    if (resetPasswordAsync.fulfilled.match(r)) {
      haptics.success();
      dispatch(resetForgotPassword());
      Toast.show({ type: 'success', text1: 'Password changed, please sign in' });
      // A fresh stack: Back from sign-in must not return into the reset flow.
      const target = userType === 'provider' ? 'ProviderSignIn' : 'SignIn';
      navigation.reset({ index: 1, routes: [{ name: 'RoleSelection' }, { name: target, params: { email } }] });
    } else haptics.warning();
  };

  return (
    <AuthScreen onBack={() => navigation.goBack()}>
      <View style={[styles.hero, { backgroundColor: service.accentSoft }]}>
        <IonIcon name="shield-checkmark-outline" size="xl" color={service.accent} />
      </View>
      <AuthHeader hideLogo title="Reset Password" subtitle="Create a new password for your account." />
      {s.error.message || tokenSpent ? (
        <InlineNotice
          message={tokenSpent ? 'This reset session has expired. Request a new code.' : s.error.message}
          action={tokenSpent ? { label: 'Get a new code', onPress: () => navigation.navigate('ForgotPassword', { email, userType }) } : undefined}
        />
      ) : null}
      <View style={styles.form}>
        <TextField
          label="New Password"
          mode="password"
          icon="lock-closed-outline"
          value={s.password}
          onChangeText={v => dispatch(setField({ field: 'password', value: v }))}
          onBlur={() => dispatch(touch('password'))}
          error={shown.password}
          placeholder="Enter new password"
          helper="8–72 characters, with an upper-case letter, a lower-case letter and a number."
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
          editable={!loading}
        />
        <PasswordStrength password={s.password} />
        <TextField
          ref={confirmRef}
          label="Confirm Password"
          mode="password"
          icon="lock-closed-outline"
          value={s.confirmPassword}
          onChangeText={v => dispatch(setField({ field: 'confirmPassword', value: v }))}
          onBlur={() => dispatch(touch('confirmPassword'))}
          error={shown.confirmPassword}
          placeholder="Re-enter new password"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!loading}
        />
      </View>
      <Button
        label={loading ? 'Resetting...' : 'Reset Password'}
        onPress={submit}
        disabled={!s.password || !s.confirmPassword || loading || tokenSpent}
        fullWidth
      />
    </AuthScreen>
  );
};

export default ResetPassword;
