// ═══════════════════════════════════════════════════════
// MetroMatrix — Shared auth forms (presentational)
// ═══════════════════════════════════════════════════════
// Customer and partner sign-in / sign-up show the same fields with different
// copy and rules. These components are pure UI: each screen owns its slice
// and wires values, errors and handlers in. Keyboard: "next" moves focus
// down the form; the last field submits.

import React, { useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText, Button, Card, Checkbox, PasswordStrength, TextField } from '../../Custom-Components';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    forgot: { alignItems: 'flex-end', marginTop: -space.s8 },
    terms: { gap: space.s4 },
  });

// ─── Sign in ──────────────────────────────────────────
export interface SignInFormProps {
  email: string;
  password: string;
  errors: { email?: string; password?: string };
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;
  onBlur: (field: 'email' | 'password') => void;
  onSubmit: () => void;
  onForgotPassword?: () => void;
  disabled?: boolean;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  email,
  password,
  errors,
  onChangeEmail,
  onChangePassword,
  onBlur,
  onSubmit,
  onForgotPassword,
  disabled,
}) => {
  const styles = useStyles(makeStyles);
  const passwordRef = useRef<TextInput>(null);
  return (
    <Card>
      <TextField
        label="Email"
        mode="email"
        value={email}
        onChangeText={onChangeEmail}
        onBlur={() => onBlur('email')}
        error={errors.email}
        placeholder="you@example.com"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        mode="password"
        value={password}
        onChangeText={onChangePassword}
        onBlur={() => onBlur('password')}
        error={errors.password}
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!disabled}
      />
      {onForgotPassword ? (
        <View style={styles.forgot}>
          <Button label="Forgot password?" variant="ghost" size="sm" onPress={onForgotPassword} />
        </View>
      ) : null}
    </Card>
  );
};

// ─── Sign up ──────────────────────────────────────────
export type SignUpField = 'name' | 'email' | 'phone' | 'password' | 'confirmPassword';

export interface SignUpFormProps {
  values: Record<SignUpField, string>;
  errors: Partial<Record<SignUpField | 'acceptedTerms' | 'acceptedPartnerTerms', string>>;
  acceptedTerms: boolean;
  acceptedPartnerTerms?: boolean;
  phoneRequired: boolean;
  showPartnerTerms: boolean;
  onChange: (field: SignUpField, value: string) => void;
  onBlur: (field: SignUpField) => void;
  onToggleTerms: (v: boolean) => void;
  onTogglePartnerTerms?: (v: boolean) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  values,
  errors,
  acceptedTerms,
  acceptedPartnerTerms,
  phoneRequired,
  showPartnerTerms,
  onChange,
  onBlur,
  onToggleTerms,
  onTogglePartnerTerms,
  onSubmit,
  disabled,
}) => {
  const styles = useStyles(makeStyles);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  return (
    <>
      <Card>
        <TextField
          label="Full name"
          value={values.name}
          onChangeText={v => onChange('name', v)}
          onBlur={() => onBlur('name')}
          error={errors.name}
          placeholder="Ayesha Khan"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
          editable={!disabled}
        />
        <TextField
          ref={emailRef}
          label="Email"
          mode="email"
          value={values.email}
          onChangeText={v => onChange('email', v)}
          onBlur={() => onBlur('email')}
          error={errors.email}
          placeholder="you@example.com"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
          submitBehavior="submit"
          editable={!disabled}
        />
        <TextField
          ref={phoneRef}
          label={phoneRequired ? 'Mobile number' : 'Mobile number (optional)'}
          mode="phone"
          value={values.phone}
          onChangeText={v => onChange('phone', v)}
          onBlur={() => onBlur('phone')}
          error={errors.phone}
          placeholder="312 3456789"
          helper={phoneRequired ? 'Customers and our team reach you here.' : 'For order and booking updates.'}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          editable={!disabled}
        />
      </Card>
      <Card>
        <TextField
          ref={passwordRef}
          label="Password"
          mode="password"
          value={values.password}
          onChangeText={v => onChange('password', v)}
          onBlur={() => onBlur('password')}
          error={errors.password}
          helper="At least 8 characters, with a letter and a number."
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
          editable={!disabled}
        />
        <PasswordStrength password={values.password} />
        <TextField
          ref={confirmRef}
          label="Confirm password"
          mode="password"
          value={values.confirmPassword}
          onChangeText={v => onChange('confirmPassword', v)}
          onBlur={() => onBlur('confirmPassword')}
          error={errors.confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={!disabled}
        />
      </Card>
      <View style={styles.terms}>
        <Checkbox
          checked={acceptedTerms}
          onToggle={onToggleTerms}
          accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
          label={<AppText variant="small">I agree to the Terms of Service and Privacy Policy.</AppText>}
          error={errors.acceptedTerms}
        />
        {showPartnerTerms && onTogglePartnerTerms ? (
          <Checkbox
            checked={!!acceptedPartnerTerms}
            onToggle={onTogglePartnerTerms}
            accessibilityLabel="I agree to the Partner Agreement"
            label={
              <AppText variant="small">
                I agree to the Partner Agreement, including zero-commission pricing and document verification.
              </AppText>
            }
            error={errors.acceptedPartnerTerms}
          />
        ) : null}
      </View>
    </>
  );
};
