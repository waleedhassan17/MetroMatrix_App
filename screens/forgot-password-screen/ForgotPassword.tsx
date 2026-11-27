// ═══════════════════════════════════════════════════════
// MetroMatrix — Forgot Password (the FYP's first reset screen)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useCountdown } from '../../hooks/useCountdown';
import { validateEmail } from '../../models/authModel';
import { haptics } from '../../utils/haptics/haptics';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { Button, InlineNotice, IonIcon, TextField } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../Components/auth/AuthChrome';
import { authErrorMessage } from '../../Components/auth/authErrorMessage';
import type { RootStackParamList } from '../../models';
import { requestCodeAsync, selectForgotPassword, setEmail, touch } from './forgotPasswordSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

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

const ForgotPassword: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectForgotPassword);
  const prefill = route.params?.email;
  const userType = route.params?.userType ?? 'user';

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  const error = validateEmail(s.email);
  const loading = s.status === 'loading';
  const secondsLeft = useCountdown(s.resendAvailableAt);
  // Back works even when this screen was opened from a link or a web reload.
  const { back } = useBack({ name: 'SignIn' });

  const submit = async () => {
    dispatch(touch());
    if (error || loading) {
      haptics.warning();
      return;
    }
    const email = s.email.trim();
    // A code just went to this address: go on to it instead of asking again (the API allows 3 an hour).
    if (secondsLeft > 0 && s.sentTo === email.toLowerCase()) {
      navigation.navigate('ResetPasswordOTP', { email, userType });
      return;
    }
    const r = await dispatch(requestCodeAsync(email));
    if (requestCodeAsync.fulfilled.match(r)) {
      navigation.navigate('ResetPasswordOTP', { email, userType });
    } else haptics.warning();
  };

  return (
    <AuthScreen onBack={back}>
      <View style={[styles.hero, { backgroundColor: colors.surfaceSunk }]}>
        <IonIcon name="lock-closed-outline" size="xl" color={colors.inkMuted} />
      </View>
      <AuthHeader
        hideLogo
        title="Forgot Password?"
        subtitle="Enter your email address and we'll send you a 6-digit code to reset your password."
      />
      {s.error.message ? <InlineNotice message={authErrorMessage(s.error)} /> : null}
      <TextField
        label="Email"
        mode="email"
        icon="mail-outline"
        value={s.email}
        onChangeText={v => dispatch(setEmail(v))}
        onBlur={() => dispatch(touch())}
        error={s.touched ? error : undefined}
        placeholder="Enter your email address"
        returnKeyType="send"
        onSubmitEditing={submit}
        editable={!loading}
      />
      <Button
        label={loading ? 'Sending...' : 'Send Code'}
        onPress={submit}
        disabled={!s.email.trim() || loading}
        fullWidth
      />
      <Button label="Back to Sign In" variant="ghost" onPress={back} />
    </AuthScreen>
  );
};

export default ForgotPassword;
