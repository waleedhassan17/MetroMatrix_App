// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer sign up
// ═══════════════════════════════════════════════════════

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors, validateSignUp } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button, Divider, ScreenShell, TextLink } from '@custom/index';
import { SignUpForm } from '@components/auth/AuthForms';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import { GoogleSignInButton } from '@components/auth/GoogleSignInButton';
import type { RootStackParamList } from '@/types';
import {
  googleSignUpAsync,
  selectCustomerSignUp,
  setAcceptedTerms,
  setField,
  showError,
  signUpAsync,
  touch,
} from './customerSignUpSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSignUp'>;

const CustomerSignUpScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectCustomerSignUp);

  const errors = validateSignUp(form.values);
  const shown = visibleErrors(errors, form.touched);
  const busy = form.status === 'loading' || form.googleStatus === 'loading';

  const submit = async () => {
    if (hasErrors(errors) || busy) return;
    const { name, email, phone, password } = form.values;
    const result = await dispatch(signUpAsync({ name, email, phone, password }));
    if (signUpAsync.rejected.match(result)) haptics.warning();
    else haptics.success();
  };

  return (
    <ScreenShell
      title="Create your account"
      subtitle="One account for shopping, doctors and food."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <Button
          label="Create account"
          onPress={submit}
          loading={form.status === 'loading'}
          disabled={hasErrors(errors) || form.googleStatus === 'loading'}
          fullWidth
          size="lg"
        />
      }>
      <AuthErrorNotice
        error={form.error}
        fallbackTitle="Couldn't create your account"
        onGoToPortal={portal =>
          navigation.navigate(portal === 'partner' ? 'PartnerSignIn' : 'CustomerSignIn', {
            email: form.values.email.trim(),
          })
        }
      />
      <GoogleSignInButton
        busy={form.googleStatus === 'loading'}
        disabled={form.status === 'loading'}
        onIdToken={token => dispatch(googleSignUpAsync(token))}
        onError={message => dispatch(showError(message))}
      />
      <Divider label="or use email" />
      <SignUpForm
        values={form.values}
        errors={shown}
        acceptedTerms={form.acceptedTerms}
        phoneRequired={false}
        showPartnerTerms={false}
        onChange={(field, value) => dispatch(setField({ field, value }))}
        onBlur={field => dispatch(touch(field))}
        onToggleTerms={v => dispatch(setAcceptedTerms(v))}
        onSubmit={submit}
        disabled={busy}
      />
      <TextLink lead="Already have an account?" label="Sign in" onPress={() => navigation.navigate('CustomerSignIn')} />
    </ScreenShell>
  );
};

export default CustomerSignUpScreen;
