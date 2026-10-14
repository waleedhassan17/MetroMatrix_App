// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner (business) sign in
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors, validateSignIn } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button, ScreenShell, TextLink } from '@custom/index';
import { SignInForm } from '@components/auth/AuthForms';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import type { RootStackParamList } from '@/types';
import { selectPartnerSignIn, setEmail, setPassword, submitSignInAsync, touch } from './partnerSignInSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerSignIn'>;

const PartnerSignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectPartnerSignIn);
  const prefill = route.params?.email;

  useEffect(() => {
    if (prefill) dispatch(setEmail(prefill));
  }, [prefill, dispatch]);

  const errors = validateSignIn({ email: form.email, password: form.password });
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';

  const submit = async () => {
    if (hasErrors(errors) || loading) return;
    const result = await dispatch(submitSignInAsync({ email: form.email.trim(), password: form.password }));
    if (submitSignInAsync.rejected.match(result)) haptics.warning();
    else haptics.success();
  };

  return (
    <ScreenShell
      eyebrow="For business"
      title="Sign in to your business"
      subtitle="Manage your store, practice or kitchen."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <Button label="Sign in" onPress={submit} loading={loading} disabled={hasErrors(errors)} fullWidth size="lg" />
      }>
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={portal =>
          portal === 'customer'
            ? navigation.navigate('CustomerSignIn', { email: form.email.trim() })
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
          navigation.navigate('ForgotPassword', { email: form.email.trim() || undefined, portal: 'partner' })
        }
        disabled={loading}
      />
      <TextLink lead="New to MetroMatrix?" label="Register your business" onPress={() => navigation.navigate('PartnerSignUp')} />
    </ScreenShell>
  );
};

export default PartnerSignInScreen;
