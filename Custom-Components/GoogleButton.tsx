// ═══════════════════════════════════════════════════════
// GoogleButton — the FYP's social sign-in button
// ═══════════════════════════════════════════════════════
// White, hairline border, radius 8, 50 pt, the red Google logo and the word
// "Google" — exactly the FYP auth screens' button (Facebook removed). Pure
// UI: token acquisition lives in components/auth/GoogleSignInButton.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { GOOGLE_ICON, useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon } from './Icon';

export interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

const makeStyles = ({ colors, radius, size, space, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      minHeight: size.control.md,
      borderRadius: radius.sm,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s8,
      paddingHorizontal: space.s16,
      ...elevation.input,
    },
  });

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  label = 'Google',
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label === 'Google' ? 'Continue with Google' : label}
      aria-disabled={inactive}
      aria-busy={loading}
      style={({ pressed }) => [
        styles.root,
        (pressed || disabled) && { opacity: disabled ? opacity.disabled : opacity.pressed },
      ]}>
      {loading ? <ActivityIndicator color={colors.inkMuted} /> : <IonIcon name="logo-google" size="md" color={GOOGLE_ICON} />}
      <AppText variant="label">{loading ? 'Loading...' : label}</AppText>
    </Pressable>
  );
};

export default GoogleButton;
