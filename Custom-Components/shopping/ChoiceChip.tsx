// ChoiceChip — one selectable option: a size, a filter, a reason. Selected
// fills with the accent; an unavailable option is struck through and can't
// be chosen (but stays readable, so a shopper knows it exists). `option` is a
// product page's size chip (44 tall, the FYP's rounded square); `count` puts
// a small count in the chip ("To ship 3").

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';
import { useOnGradient } from '../headerInk';

export interface ChoiceChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** A recent search: hold to remove it. */
  onLongPress?: () => void;
  icon?: IonName;
  /** A colour dot before the label (a colour option). */
  swatch?: string;
  /** A count after the label (the store's order filters). */
  count?: number;
  /** `option`: a product's size chip, 44 tall and rounded square. */
  size?: 'md' | 'option';
  accessibilityHint?: string;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      minHeight: size.control.sm,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    option: { minHeight: size.touch, minWidth: space.s56, justifyContent: 'center', borderRadius: radius.md },
    count: {
      minWidth: size.countBadge,
      height: size.countBadge,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onGradient: { backgroundColor: colors.onScrimTint, borderColor: colors.onScrimLine },
    selectedOnGradient: { backgroundColor: colors.surface, borderColor: colors.surface },
    struck: { textDecorationLine: 'line-through' },
    dot: { width: size.icon.md, height: size.icon.md, borderRadius: radius.pill, borderWidth: size.hairline, borderColor: colors.lineStrong },
  });

export const ChoiceChip: React.FC<ChoiceChipProps> = ({
  label,
  selected,
  disabled,
  onPress,
  onLongPress,
  icon,
  swatch,
  count,
  size: chipSize = 'md',
  accessibilityHint,
}) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  // Inside the gradient page header: a white wash, and white when chosen.
  const onGradient = useOnGradient();
  const ink = selected ? (onGradient ? service.accentDeep : service.onAccent) : onGradient ? colors.onScrim : colors.inkMuted;
  const countLook = selected
    ? onGradient
      ? { bg: service.accentSoft, fg: service.accentDeep }
      : { bg: colors.onScrimTint, fg: service.onAccent }
    : onGradient
      ? { bg: colors.onScrimTint, fg: colors.onScrim }
      : { bg: colors.surfaceSunk, fg: colors.inkMuted };
  const shown = count !== undefined && count > 0;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}, unavailable` : shown ? `${label}, ${count}` : label}
      accessibilityHint={accessibilityHint}
      aria-selected={!!selected}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        styles.root,
        chipSize === 'option' && styles.option,
        onGradient && styles.onGradient,
        selected && (onGradient ? styles.selectedOnGradient : { backgroundColor: service.accent, borderColor: service.accent }),
        disabled && { backgroundColor: colors.surfaceSunk, borderColor: colors.lineSoft },
        pressed && { opacity: opacity.pressed },
      ]}>
      {swatch ? <View style={[styles.dot, { backgroundColor: swatch }]} /> : null}
      {icon ? <IonIcon name={icon} size="sm" color={ink} /> : null}
      <AppText
        variant="small"
        tone={selected ? (onGradient ? 'accentDeep' : 'onAccent') : disabled ? 'faint' : onGradient ? 'onScrim' : 'ink'}
        style={disabled ? styles.struck : undefined}
        numberOfLines={1}>
        {label}
      </AppText>
      {shown ? (
        <View style={[styles.count, { backgroundColor: countLook.bg }]}>
          <AppText variant="micro" style={{ color: countLook.fg }}>
            {count > 99 ? '99+' : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
};

export default ChoiceChip;
