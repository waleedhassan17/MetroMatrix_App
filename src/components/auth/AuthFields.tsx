// ═══════════════════════════════════════════════════════
// MetroMatrix — FYP sign-in / sign-up fields (presentational)
// ═══════════════════════════════════════════════════════
// The User and Service Provider screens show the same fields with different
// copy. Pure UI: each screen owns its slice and wires values in. Keyboard:
// "next" moves down the form; the last field submits.

import React, { useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText, Button, Divider, PasswordStrength, TextField } from '../../Custom-Components';
import { GoogleSignInButton } from './GoogleSignInButton';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    form: { gap: space.s16 },
    forgot: { alignSelf: 'flex-end', marginTop: -space.s4 },
    social: { gap: space.s16 },
  });

// ─── Sign in ──────────────────────────────────────────
export const SignInFields: React.FC<{
  email: string;
  password: string;
  errors: { email?: string; password?: string };
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;
  onBlur: (field: 'email' | 'password') => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  disabled?: boolean;
}> = ({ email, password, errors, onChangeEmail, onChangePassword, onBlur, onSubmit, onForgotPassword, disabled }) => {
  const styles = useStyles(makeStyles);
  const passwordRef = useRef<TextInput>(null);
  return (
    <View style={styles.form}>
      <TextField
        label="Email"
        mode="email"
        icon="mail-outline"
        value={email}
        onChangeText={onChangeEmail}
        onBlur={() => onBlur('email')}
        error={errors.email}
        placeholder="Enter your email address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        mode="password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={onChangePassword}
        onBlur={() => onBlur('password')}
        error={errors.password}
        placeholder="Enter your password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!disabled}
      />
      <View style={styles.forgot}>
        <Button label="Forgot Password?" variant="ghost" size="sm" onPress={onForgotPassword} />
      </View>
    </View>
  );
};

// ─── Sign up (the FYP's four fields) ──────────────────
/** Riders: the username their vendor gave them. No "Forgot password": their vendor resets it. */
export const RiderSignInFields: React.FC<{
  username: string;
  password: string;
  errors: { username?: string; password?: string };
  onChangeUsername: (v: string) => void;
  onChangePassword: (v: string) => void;
  onBlur: (field: 'username' | 'password') => void;
  onSubmit: () => void;
  disabled?: boolean;
}> = ({ username, password, errors, onChangeUsername, onChangePassword, onBlur, onSubmit, disabled }) => {
  const styles = useStyles(makeStyles);
  const passwordRef = useRef<TextInput>(null);
  return (
    <View style={styles.form}>
      <TextField
        label="Username"
        icon="person-outline"
        value={username}
        onChangeText={onChangeUsername}
        onBlur={() => onBlur('username')}
        error={errors.username}
        placeholder="e.g. karachi-biryani.imran"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        mode="password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={onChangePassword}
        onBlur={() => onBlur('password')}
        error={errors.password}
        placeholder="Enter your password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!disabled}
      />
    </View>
  );
};

export type SignUpField = 'name' | 'phone' | 'email' | 'password';

export const SignUpFields: React.FC<{
  values: Record<SignUpField, string>;
  errors: Partial<Record<SignUpField, string>>;
  onChange: (field: SignUpField, value: string) => void;
  onBlur: (field: SignUpField) => void;
  onSubmit: () => void;
  disabled?: boolean;
}> = ({ values, errors, onChange, onBlur, onSubmit, disabled }) => {
  const styles = useStyles(makeStyles);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  return (
    <View style={styles.form}>
      <TextField
        label="Full Name"
        icon="person-outline"
        value={values.name}
        onChangeText={v => onChange('name', v)}
        onBlur={() => onBlur('name')}
        error={errors.name}
        placeholder="Enter your full name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={phoneRef}
        label="Phone Number"
        mode="phone"
        icon="call-outline"
        value={values.phone}
        onChangeText={v => onChange('phone', v)}
        onBlur={() => onBlur('phone')}
        error={errors.phone}
        placeholder="300 1234567"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={emailRef}
        label="Email"
        mode="email"
        icon="mail-outline"
        value={values.email}
        onChangeText={v => onChange('email', v)}
        onBlur={() => onBlur('email')}
        error={errors.email}
        placeholder="Enter your email address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!disabled}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        mode="password"
        icon="lock-closed-outline"
        value={values.password}
        onChangeText={v => onChange('password', v)}
        onBlur={() => onBlur('password')}
        error={errors.password}
        placeholder="Enter your password"
        helper="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!disabled}
      />
      <PasswordStrength password={values.password} />
    </View>
  );
};

// ─── "or continue with" + Google ──────────────────────
export const SocialSignIn: React.FC<{
  onIdToken: (token: string) => void;
  onError: (message: string) => void;
  busy?: boolean;
  disabled?: boolean;
}> = props => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.social}>
      <Divider label="or continue with" />
      <GoogleSignInButton {...props} />
    </View>
  );
};

/** The passive consent line under "Create Account". */
export const TermsLine: React.FC = () => (
  <AppText variant="caption" tone="muted" align="center">
    By creating an account you agree to our Terms of Service and Privacy Policy.
  </AppText>
);
