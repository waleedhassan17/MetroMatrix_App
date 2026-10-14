// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer sign in
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { validateSignIn, hasErrors } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button, Divider, ScreenShell, TextLink } from '@custom/index';
import { SignInForm } from '@components/auth/AuthForms';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import { GoogleSignInButton } from '@components/auth/GoogleSignInButton';
import type { RootStackParamList } from '@/types';
import {
  googleSignInAsync,
  selectCustomerSignIn,
  setEmail,
  setPassword,
  showError,
  submitSignInAsync,
  touch,
} from './customerSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSignIn'>;

const CustomerSignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectCustomerSignIn);
  const prefill = route.params?.email;

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  const errors = validateSignIn({ email: form.email, password: form.password });
  const shown = visibleErrors(errors, form.touched);
  const busy = form.status === 'loading' || form.googleStatus === 'loading';

  const submit = async () => {
    if (hasErrors(errors) || busy) return;
    const result = await dispatch(submitSignInAsync({ email: form.email.trim(), password: form.password }));
    if (submitSignInAsync.rejected.match(result)) haptics.warning();
    else haptics.success();
  };

  return (
    <ScreenShell
      title="Welcome back"
      subtitle="Sign in to shop, book and order near you."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <Button
          label="Sign in"
          onPress={submit}
          loading={form.status === 'loading'}
          disabled={hasErrors(errors) || form.googleStatus === 'loading'}
          fullWidth
          size="lg"
        />
      }>
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={portal =>
          portal === 'partner'
            ? navigation.navigate('PartnerSignIn', { email: form.email.trim() })
            : navigation.navigate('AdminSignIn', { email: form.email.trim() })
        }
      />
      <SignInForm
        email={form.email}
        password={form.password}
        errors={shown}
        onChangeEmail={v => dispatch(setEmail(v))}
        onChangePassword={v => dispatch(setPassword(v))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        onForgotPassword={() =>
          navigation.navigate('ForgotPassword', { email: form.email.trim() || undefined, portal: 'customer' })
        }
        disabled={busy}
      />
      <Divider label="or" />
      <GoogleSignInButton
        busy={form.googleStatus === 'loading'}
        disabled={form.status === 'loading'}
        onIdToken={token => dispatch(googleSignInAsync(token))}
        onError={message => dispatch(showError(message))}
      />
      <TextLink lead="New here?" label="Create account" onPress={() => navigation.navigate('CustomerSignUp')} />
    </ScreenShell>
  );
};

export default CustomerSignInScreen;
