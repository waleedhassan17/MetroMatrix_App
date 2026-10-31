// ═══════════════════════════════════════════════════════
// MetroMatrix — Service Provider Sign Up, the FYP layout
// ═══════════════════════════════════════════════════════
// Registration needs the type from Provider Selection; without one the
// screen sends the provider back to choose.

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { hasErrors, validateSignUp } from '../../../models/authModel';
import { SUBTYPE_SERVICE, providerTypeLabel } from '../../../models/businessModel';
import { visibleErrors } from '../../../utils/formErrors';
import { haptics } from '../../../utils/haptics';
import { Button, InlineNotice } from '../../../Custom-Components/index';
import { AuthHeader, AuthScreen, AuthTabs, ProviderBadge } from '../../../Components/auth/AuthChrome';
import { SignUpFields, TermsLine } from '../../../Components/auth/AuthFields';
import { AuthErrorNotice } from '../../../Components/auth/AuthErrorNotice';
import { SignupsPausedNotice, useSignupsOpen } from '../../../Components/platform/SignupsPausedNotice';
import type { RootStackParamList } from '../../../types';
import { selectProviderSubType } from '../../ProviderSelection/providerSelectionSlice';
import { selectProviderSignUp, setField, signUpAsync, touch, touchAll } from './providerSignUpSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSignUp'>;

const ProviderSignUpScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectProviderSignUp);
  const subType = useAppSelector(selectProviderSubType);

  const errors = validateSignUp(form.values);
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';
  const open = useSignupsOpen('partner');
  // The mobile is optional here (the API's SignupDto); Personal Info asks for it.
  const complete = (['name', 'email', 'password'] as const).every(f => form.values[f].trim().length > 0) && open && !!subType;

  const submit = async () => {
    if (!complete || loading || !subType) return;
    if (hasErrors(errors)) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
    const r = await dispatch(signUpAsync({ values: form.values, subType }));
    if (signUpAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  return (
    <AuthScreen onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProviderSelection'))}>
      <AuthHeader
        title="Get Started"
        badge={subType ? <ProviderBadge label={providerTypeLabel(subType)} service={SUBTYPE_SERVICE[subType]} /> : undefined}
        subtitle="Create your provider account to get started"
      />
      <AuthTabs value="signup" onChange={() => navigation.navigate('ProviderSignIn')} disabled={loading} />
      {!subType ? (
        <InlineNotice
          tone="info"
          message="Choose the service you provide first."
          action={{ label: 'Choose your service', onPress: () => navigation.navigate('ProviderSelection') }}
        />
      ) : null}
      <SignupsPausedNotice role="partner" />
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={() => navigation.navigate('ProviderSignIn', { email: form.values.email.trim() })}
        onSignInInstead={() => navigation.navigate('ProviderSignIn', { email: form.values.email.trim() })}
      />
      <SignUpFields
        values={form.values}
        errors={shown}
        onChange={(field, value) => dispatch(setField({ field, value }))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        disabled={loading}
      />
      <Button label={loading ? 'Creating Account...' : 'Create Account'} onPress={submit} disabled={!complete || loading} fullWidth />
      <TermsLine />
    </AuthScreen>
  );
};

export default ProviderSignUpScreen;
