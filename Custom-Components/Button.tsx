// ═══════════════════════════════════════════════════════
// Button — the FYP's pill buttons
// ═══════════════════════════════════════════════════════
// primary      accent fill, white label; GREY fill while disabled (the FYP's
//              "button turns green when the form is complete")
// secondary    white, hairline border, ink label
// ghost        no ground, accent-deep label (links: "Forgot Password?")
// destructive  danger fill
// Sizes: sm 36 · md 50 (the FYP's auth buttons) · lg 56.
// Loading keeps the width: the label stays laid out (invisible) under the
// spinner. Primary presses tap a light haptic.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';
import { haptics } from '../utils/haptics/haptics';
import { AppText } from './AppText';
import { useOnGradient } from './headerInk';
import { IonIcon, type IonName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Ionicons glyph before the label. */
  leftIcon?: IonName;
  /** Ionicons glyph after the label (the FYP's "Continue to Registration →"). */
  rightIon?: IonName;
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
      borderRadius: radius.pill,
      paddingHorizontal: space.s24,
    },
    sm: { minHeight: size.control.sm, paddingHorizontal: space.s16 },
    md: { minHeight: size.control.md },
    lg: { minHeight: size.control.lg },
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
  rightIon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion, opacity, size: sizes } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  // On the gradient page header a primary button turns white with accent text.
  const onGradient = useOnGradient();
  const inactive = disabled || loading;
  const greyed = disabled && !loading;

  const palette = {
    primary: greyed
      ? onGradient
        ? { bg: colors.onScrimTint, fg: colors.onScrimSoft, border: colors.onScrimLine }
        : { bg: colors.disabled, fg: colors.onBrand, border: colors.disabled }
      : onGradient
        ? { bg: colors.surface, fg: service.accentDeep, border: colors.surface }
        : { bg: service.accent, fg: service.onAccent, border: service.accent },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
    ghost: { bg: 'transparent', fg: service.accentDeep, border: 'transparent' },
    destructive: greyed
      ? { bg: colors.disabled, fg: colors.onDanger, border: colors.disabled }
      : { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
  }[variant];

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
      aria-disabled={inactive}
      aria-busy={loading}
      style={[
        styles.root,
        styles[size],
        fullWidth && styles.fullWidth,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' ? sizes.border : 0,
        },
        greyed && (variant === 'secondary' || variant === 'ghost') && { opacity: opacity.disabled },
        animated,
      ]}>
      <View style={[styles.content, loading && styles.hidden]}>
        {leftIcon ? <IonIcon name={leftIcon} size="md" color={palette.fg} /> : null}
        <AppText
          variant={size === 'sm' ? 'small' : 'button'}
          style={{ color: palette.fg }}
          numberOfLines={1}>
          {label}
        </AppText>
        {rightIon ? <IonIcon name={rightIon} size="md" color={palette.fg} /> : null}
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
