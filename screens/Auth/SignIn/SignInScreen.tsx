// ═══════════════════════════════════════════════════════
// MetroMatrix — Sign In (users and staff), the FYP layout
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { hasErrors, validateSignIn } from '../../../models/authModel';
import { visibleErrors } from '../../../utils/formErrors';
import { haptics } from '../../../utils/haptics';
import { Button } from '../../../Custom-Components/index';
import { AuthHeader, AuthScreen, AuthTabs } from '../../../Components/auth/AuthChrome';
import { SignInFields, SocialSignIn } from '../../../Components/auth/AuthFields';
import { AuthErrorNotice } from '../../../Components/auth/AuthErrorNotice';
import type { RootStackParamList } from '../../../types';
import { googleSignInAsync, selectSignIn, setEmail, setPassword, showError, signInAsync, touch, touchAll } from './signInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const SignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectSignIn);
  const prefill = route.params?.email;

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  const errors = validateSignIn({ email: form.email, password: form.password });
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';
  const busy = loading || form.googleStatus === 'loading';
  // The FYP's rule: the button turns green once both fields have something in them.
  const complete = !!form.email.trim() && !!form.password;

  const submit = async () => {
    if (!complete || busy) return;
    if (hasErrors(errors)) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
    const r = await dispatch(signInAsync({ email: form.email.trim(), password: form.password }));
    if (signInAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  return (
    <AuthScreen onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('RoleSelection'))}>
      <AuthHeader title="Welcome Back" subtitle="Sign in to continue to your account" />
      <AuthTabs value="signin" onChange={() => navigation.navigate('SignUp')} disabled={busy} />
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={portal =>
          portal === 'partner' ? navigation.navigate('ProviderSignIn', { email: form.email.trim() }) : undefined
        }
      />
      <SignInFields
        email={form.email}
        password={form.password}
        errors={shown}
        onChangeEmail={v => dispatch(setEmail(v))}
        onChangePassword={v => dispatch(setPassword(v))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        onForgotPassword={() => navigation.navigate('ForgotPassword', { email: form.email.trim() || undefined, userType: 'user' })}
        disabled={busy}
      />
      <Button label={loading ? 'Signing in...' : 'Sign In'} onPress={submit} disabled={!complete || busy} fullWidth />
      <SocialSignIn
        busy={form.googleStatus === 'loading'}
        disabled={loading}
        onIdToken={token => dispatch(googleSignInAsync(token))}
        onError={message => dispatch(showError(message))}
      />
    </AuthScreen>
  );
};

export default SignInScreen;
