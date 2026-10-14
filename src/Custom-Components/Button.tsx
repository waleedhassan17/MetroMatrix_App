// ═══════════════════════════════════════════════════════
// Button — primary / secondary / ghost / destructive × sm / md / lg
// ═══════════════════════════════════════════════════════
// Loading keeps the button's width: the label stays laid out (invisible) and
// the spinner sits over it, so the CTA never jumps. Primary presses tap a
// light haptic. Press feedback is a 180 ms ease-out scale.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';
import { haptics } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: IconName;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const makeStyles = ({ size, radius, space }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      paddingHorizontal: space.s20,
    },
    sm: { minHeight: size.control.sm, paddingHorizontal: space.s12, borderRadius: radius.sm },
    md: { minHeight: size.control.md },
    lg: { minHeight: size.control.lg, paddingHorizontal: space.s24 },
    fullWidth: { alignSelf: 'stretch' },
    content: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    hidden: { opacity: 0 },
    spinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  });

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion, opacity, size: sizes } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette = {
    primary: { bg: service.accent, fg: service.onAccent, border: service.accent },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong },
    ghost: { bg: 'transparent', fg: service.accentDeep, border: 'transparent' },
    destructive: { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
  }[variant];

  const inactive = disabled || loading;

  const press = (to: number) => {
    scale.set(withTiming(to, { duration: motion.press.duration, easing: Easing.out(Easing.quad) }));
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={() => {
        if (inactive) return;
        if (variant === 'primary') haptics.press();
        onPress();
      }}
      onPressIn={() => !inactive && press(motion.press.scale)}
      onPressOut={() => press(1)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.root,
        styles[size],
        fullWidth && styles.fullWidth,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' ? sizes.border : 0,
        },
        disabled && !loading && { opacity: opacity.disabled },
        animated,
      ]}>
      <View style={[styles.content, loading && styles.hidden]}>
        {leftIcon ? <Icon name={leftIcon} size="md" color={palette.fg} /> : null}
        <AppText variant={size === 'sm' ? 'small' : 'bodyStrong'} style={{ color: palette.fg }} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {loading ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={palette.fg} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
};

export default Button;
