// ═══════════════════════════════════════════════════════
// MetroMatrix — Rider Sign In
// ═══════════════════════════════════════════════════════
// For riders a Food Court vendor added: the username and password the vendor
// shared (shown to the vendor once). No sign-up and no "forgot password" —
// the vendor resets a rider's password from their Riders screen.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { hasErrors, validateRiderSignIn } from '../../../models/authModel';
import { visibleErrors } from '../../../utils/formErrors';
import { haptics } from '../../../utils/haptics';
import { AppText, Button, IonIcon } from '../../../Custom-Components/index';
import { useStyles, useTheme, type Theme } from '../../../theme/index';
import { AuthHeader, AuthScreen, ProviderBadge } from '../../../Components/auth/AuthChrome';
import { RiderSignInFields } from '../../../Components/auth/AuthFields';
import { AuthErrorNotice } from '../../../Components/auth/AuthErrorNotice';
import type { RootStackParamList } from '../../../types';
import { riderSignInAsync, selectRiderSignIn, setPassword, setUsername, touch, touchAll } from './riderSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'RiderSignIn'>;

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    note: {
      flexDirection: 'row',
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    noteText: { flex: 1 },
  });

const RiderSignInScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const form = useAppSelector(selectRiderSignIn);

  const errors = validateRiderSignIn({ username: form.username, password: form.password });
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';
  const complete = !!form.username.trim() && !!form.password;

  const submit = async () => {
    if (!complete || loading) return;
    if (hasErrors(errors)) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
    const r = await dispatch(riderSignInAsync({ username: form.username.trim(), password: form.password }));
    if (riderSignInAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  return (
    <AuthScreen onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('RoleSelection'))}>
      <AuthHeader
        title="Welcome Back"
        badge={<ProviderBadge label="Food Court rider" service="food" />}
        subtitle="Sign in with the username your vendor gave you"
      />
      <AuthErrorNotice error={form.error} onGoToPortal={() => navigation.navigate('SignIn', { email: '' })} />
      <RiderSignInFields
        username={form.username}
        password={form.password}
        errors={shown}
        onChangeUsername={v => dispatch(setUsername(v))}
        onChangePassword={v => dispatch(setPassword(v))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        disabled={loading}
      />
      <Button label={loading ? 'Signing in...' : 'Sign In'} onPress={submit} disabled={!complete || loading} fullWidth />
      <View style={styles.note}>
        <IonIcon name="information-circle-outline" size="md" color={colors.inkMuted} />
        <AppText variant="small" tone="muted" style={styles.noteText}>
          Forgot your password? Ask your vendor to reset it from their Riders screen in MetroMatrix.
        </AppText>
      </View>
    </AuthScreen>
  );
};

export default RiderSignInScreen;
