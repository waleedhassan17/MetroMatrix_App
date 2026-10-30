// ═══════════════════════════════════════════════════════
// MetroMatrix — Sign Up (users), the FYP layout
// ═══════════════════════════════════════════════════════

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors, validateSignUp } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { Button } from '@custom/index';
import { AuthHeader, AuthScreen, AuthTabs } from '@components/auth/AuthChrome';
import { SignUpFields, SocialSignIn, TermsLine } from '@components/auth/AuthFields';
import { AuthErrorNotice } from '@components/auth/AuthErrorNotice';
import { SignupsPausedNotice, useSignupsOpen } from '@components/platform/SignupsPausedNotice';
import type { RootStackParamList } from '@/types';
import { googleSignUpAsync, selectSignUp, setField, showError, signUpAsync, touch, touchAll } from './signUpSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectSignUp);

  const errors = validateSignUp(form.values);
  const shown = visibleErrors(errors, form.touched);
  const loading = form.status === 'loading';
  const busy = loading || form.googleStatus === 'loading';
  const open = useSignupsOpen('customer');
  // The mobile is optional (the API's SignupDto).
  const complete = (['name', 'email', 'password'] as const).every(f => form.values[f].trim().length > 0) && open;

  const submit = async () => {
    if (!complete || busy) return;
    if (hasErrors(errors)) {
      dispatch(touchAll());
      haptics.warning();
      return;
    }
    const r = await dispatch(signUpAsync(form.values));
    if (signUpAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  return (
    <AuthScreen onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('RoleSelection'))}>
      <AuthHeader title="Get Started" subtitle="Create your account to get started" />
      <AuthTabs value="signup" onChange={() => navigation.navigate('SignIn')} disabled={busy} />
      <SignupsPausedNotice role="customer" />
      <AuthErrorNotice
        error={form.error}
        onGoToPortal={portal =>
          portal === 'partner'
            ? navigation.navigate('ProviderSignIn', { email: form.values.email.trim() })
            : navigation.navigate('SignIn', { email: form.values.email.trim() })
        }
        onSignInInstead={() => navigation.navigate('SignIn', { email: form.values.email.trim() })}
      />
      <SignUpFields
        values={form.values}
        errors={shown}
        onChange={(field, value) => dispatch(setField({ field, value }))}
        onBlur={field => dispatch(touch(field))}
        onSubmit={submit}
        disabled={busy}
      />
      <Button label={loading ? 'Creating Account...' : 'Create Account'} onPress={submit} disabled={!complete || busy} fullWidth />
      <TermsLine />
      <SocialSignIn
        busy={form.googleStatus === 'loading'}
        disabled={loading}
        onIdToken={token => dispatch(googleSignUpAsync(token))}
        onError={message => dispatch(showError(message))}
      />
    </AuthScreen>
  );
};

export default SignUpScreen;
