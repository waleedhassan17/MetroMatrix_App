// ═══════════════════════════════════════════════════════
// MetroMatrix — Rider Sign In
// ═══════════════════════════════════════════════════════
// For riders a Food Court vendor added: the username and password the vendor
// shared (shown to the vendor once). No sign-up and no "forgot password" —
// the vendor resets a rider's password from their Riders screen.

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { hasErrors, validateRiderSignIn } from '../../models/authModel';
import { visibleErrors } from '../../utils/form-errors/formErrors';
import { haptics } from '../../utils/haptics/haptics';
import { Button, InlineNotice } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen, ProviderBadge } from '../../Components/auth/AuthChrome';
import { RiderSignInFields } from '../../Components/auth/AuthFields';
import { AuthErrorNotice } from '../../Components/auth/AuthErrorNotice';
import type { RootStackParamList } from '../../models';
import { riderSignInAsync, selectRiderSignIn, setPassword, setUsername, touch, touchAll } from './riderSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'RiderSignIn'>;

const RiderSignIn: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
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
      <InlineNotice tone="info" title="Forgot your password?" message="Ask your vendor to reset it from their Riders screen in MetroMatrix." />
    </AuthScreen>
  );
};

export default RiderSignIn;
