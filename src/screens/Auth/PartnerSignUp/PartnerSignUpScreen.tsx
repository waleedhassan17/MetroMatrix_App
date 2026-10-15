// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner sign up
// ═══════════════════════════════════════════════════════

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors, validateSignUp } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button, ScreenShell, TextLink } from '@custom/index';
import { SignUpForm } from '@components/auth/AuthForms';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import type { RootStackParamList } from '@/types';
import {
  selectPartnerSignUp,
  setAcceptedPartnerTerms,
  setAcceptedTerms,
  setField,
  signUpAsync,
  touch,
} from './partnerSignUpSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerSignUp'>;

const PartnerSignUpScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectPartnerSignUp);

  const errors = validateSignUp(form.values);
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';

  const submit = async () => {
    if (hasErrors(errors) || loading) return;
    const { name, email, phone, password } = form.values;
    const result = await dispatch(signUpAsync({ name, email, phone, password }));
    if (signUpAsync.rejected.match(result)) haptics.warning();
    else haptics.success();
  };

  return (
    <ScreenShell
      eyebrow="For business"
      title="Register your business"
      subtitle="Start with your own details. Your business comes next."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <Button
          label="Create account"
          onPress={submit}
          loading={loading}
          disabled={hasErrors(errors)}
          fullWidth
          size="lg"
        />
      }>
      <AuthErrorNotice
        error={form.error}
        fallbackTitle="Couldn't create your account"
        onGoToPortal={portal =>
          navigation.navigate(portal === 'customer' ? 'CustomerSignIn' : 'PartnerSignIn', {
            email: form.values.email.trim(),
          })
        }
      />
      <SignUpForm
        values={form.values}
        errors={shown}
        acceptedTerms={form.acceptedTerms}
        acceptedPartnerTerms={form.acceptedPartnerTerms}
        phoneRequired
        showPartnerTerms
        onChange={(field, value) => dispatch(setField({ field, value }))}
        onBlur={field => dispatch(touch(field))}
        onToggleTerms={v => dispatch(setAcceptedTerms(v))}
        onTogglePartnerTerms={v => dispatch(setAcceptedPartnerTerms(v))}
        onSubmit={submit}
        disabled={loading}
      />
      <TextLink lead="Already registered?" label="Sign in" onPress={() => navigation.navigate('PartnerSignIn')} />
    </ScreenShell>
  );
};

export default PartnerSignUpScreen;
