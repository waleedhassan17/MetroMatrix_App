// Card — surface on canvas. `none` elevation is a hairline; `float` lifts it.

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';

export interface CardProps {
  children: React.ReactNode;
  elevation?: 'none' | 'float';
  /** true: 16 all round with a 16 gap; 'horizontal': list cards (rows bring their own height). */
  padded?: boolean | 'horizontal';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Draws the accent line — a selected or highlighted card. */
  selected?: boolean;
  /** Draws the danger line — a card that needs attention. */
  invalid?: boolean;
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
    padded: { padding: space.s16, gap: space.s16 },
    paddedX: { paddingHorizontal: space.s16 },
  });

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'none',
  padded = true,
  onPress,
  accessibilityLabel,
  style,
  selected,
  invalid,
}) => {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const frame = [
    styles.root,
    theme.elevation[elevation],
    padded === true && styles.padded,
    padded === 'horizontal' && styles.paddedX,
    selected && { borderColor: theme.service.accent, borderWidth: theme.size.focusBorder },
    invalid && { borderColor: theme.colors.danger, borderWidth: theme.size.focusBorder },
    style,
  ];
  if (!onPress) return <View style={frame}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [frame, pressed && { backgroundColor: theme.colors.surfaceSunk }]}>
      {children}
    </Pressable>
  );
};

export default Card;
