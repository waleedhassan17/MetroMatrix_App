// ═══════════════════════════════════════════════════════
// MetroMatrix — Service Provider Sign In, the FYP layout
// ═══════════════════════════════════════════════════════
// Shows the type picked on Provider Selection as a badge; an existing
// provider can sign in without picking one.

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors, validateSignIn } from '@models/authModel';
import { SUBTYPE_SERVICE, providerTypeLabel } from '@models/businessModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button } from '@custom/index';
import { AuthHeader, AuthScreen, AuthTabs, ProviderBadge } from '@components/auth/AuthChrome';
import { SignInFields } from '@components/auth/AuthFields';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import type { RootStackParamList } from '@/types';
import { selectProviderSubType } from '../../ProviderSelection/providerSelectionSlice';
import { selectProviderSignIn, setEmail, setPassword, signInAsync, touch, touchAll } from './providerSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSignIn'>;

const ProviderSignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectProviderSignIn);
  const subType = useAppSelector(selectProviderSubType);
  const prefill = route.params?.email;

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  const errors = validateSignIn({ email: form.email, password: form.password });
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';
  const complete = !!form.email.trim() && !!form.password;

  const submit = async () => {
    if (!complete || loading) return;
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
    <AuthScreen onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProviderSelection'))}>
      <AuthHeader
        title="Welcome Back"
        badge={subType ? <ProviderBadge label={providerTypeLabel(subType)} service={SUBTYPE_SERVICE[subType]} /> : undefined}
        subtitle={subType ? 'Sign in to continue your registration' : 'Sign in to continue to your account'}
      />
      <AuthTabs value="signin" onChange={() => navigation.navigate('ProviderSignUp')} disabled={loading} />
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={() => navigation.navigate('SignIn', { email: form.email.trim() })}
      />
      <SignInFields
        email={form.email}
        password={form.password}
        errors={shown}
        onChangeEmail={v => dispatch(setEmail(v))}
        onChangePassword={v => dispatch(setPassword(v))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        onForgotPassword={() =>
          navigation.navigate('ForgotPassword', { email: form.email.trim() || undefined, userType: 'provider' })
        }
        disabled={loading}
      />
      <Button label={loading ? 'Signing in...' : 'Sign In'} onPress={submit} disabled={!complete || loading} fullWidth />
    </AuthScreen>
  );
};

export default ProviderSignInScreen;
