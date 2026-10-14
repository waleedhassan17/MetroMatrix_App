// ═══════════════════════════════════════════════════════
// GoogleButton — "Continue with Google", per Google's branding guidelines
// ═══════════════════════════════════════════════════════
// Pure UI: white (or Google's dark) surface, the four-colour G, the exact
// label. Token acquisition lives in components/auth/GoogleSignInButton.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useStyles, useTheme, GOOGLE_BUTTON, GOOGLE_G_PATHS, GOOGLE_LABEL, MAX_FONT_SCALE, type Theme } from '../theme';

export interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

const makeStyles = ({ radius, size, space }: Theme) =>
  StyleSheet.create({
    root: {
      minHeight: size.control.md,
      borderRadius: radius.pill,
      borderWidth: size.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s12,
      paddingHorizontal: space.s16,
    },
  });

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  label = 'Continue with Google',
}) => {
  const styles = useStyles(makeStyles);
  const { mode, size, opacity } = useTheme();
  const look = GOOGLE_BUTTON[mode];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: look.surface, borderColor: look.border },
        (pressed || disabled) && { opacity: disabled ? opacity.disabled : opacity.pressed },
      ]}>
      <View>
        {loading ? (
          <ActivityIndicator color={look.text} />
        ) : (
          <Svg width={size.icon.md} height={size.icon.md} viewBox="0 0 48 48">
            {GOOGLE_G_PATHS.map(p => (
              <Path key={p.fill} fill={p.fill} d={p.d} />
            ))}
          </Svg>
        )}
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[GOOGLE_LABEL, { color: look.text }]}>
        {label}
      </Text>
    </Pressable>
  );
};

export default GoogleButton;
