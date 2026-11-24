// ═══════════════════════════════════════════════════════
// MetroMatrix — Service Provider Sign In, the FYP layout
// ═══════════════════════════════════════════════════════
// Shows the type picked on Provider Selection as a badge; an existing
// provider can sign in without picking one.

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useCountdown } from '../../hooks/useCountdown';
import { hasErrors, validateSignIn } from '../../models/authModel';
import { SUBTYPE_SERVICE, providerTypeLabel } from '../../models/businessModel';
import { visibleErrors } from '../../utils/form-errors/formErrors';
import { haptics } from '../../utils/haptics/haptics';
import { Button } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen, AuthTabs, ProviderBadge } from '../../Components/auth/AuthChrome';
import { SignInFields } from '../../Components/auth/AuthFields';
import { AuthErrorNotice } from '../../Components/auth/AuthErrorNotice';
import type { RootStackParamList } from '../../models';
import { selectProviderSubType } from '../provider-selection-screen/providerSelectionSlice';
import { selectProviderSignIn, setEmail, setPassword, signInAsync, touch, touchAll } from './providerSignInSlice';
import { NO_ERROR } from '../shared/formStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSignIn'>;

const ProviderSignIn: React.FC<Props> = ({ navigation, route }) => {
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
  // RATE_LIMITED: the button waits it out (pressing sooner only adds to the count).
  const lockLeft = useCountdown(form.lockedUntil);
  // The rate-limit notice goes when its wait is over (its text doesn't count down).
  const shownError = form.error.code === 'RATE_LIMITED' && form.lockedUntil && lockLeft === 0 ? NO_ERROR : form.error;
  const complete = !!form.email.trim() && !!form.password;

  const submit = async () => {
    if (loading || lockLeft > 0) return;
    // The keyboard's go key on an unfinished form shows what's missing.
    if (!complete) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
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
      <AuthTabs value="signin" onChange={() => navigation.replace('ProviderSignUp')} disabled={loading} />
      <AuthErrorNotice
        error={shownError}
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
      <Button
        label={loading ? 'Signing in...' : lockLeft > 0 ? `Try again in ${lockLeft}s` : 'Sign In'}
        onPress={submit}
        disabled={!complete || loading || lockLeft > 0}
        fullWidth
      />
    </AuthScreen>
  );
};

export default ProviderSignIn;
