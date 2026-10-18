// ═══════════════════════════════════════════════════════
// ChoiceCard — the FYP's role / provider card
// ═══════════════════════════════════════════════════════
// White card, radius 20, hairline border, soft lift; a 64 pt tinted icon
// tile, an 18 pt title over a muted description, and a trailing affordance:
// a chevron in a round well (navigates), a check (selected), or a
// chevron-down (expands to sub-types, which the caller passes as children).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon } from '../../Custom-Components/Icon';

export interface ChoiceCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  onPress: () => void;
  trailing?: 'chevron' | 'expand';
  selected?: boolean;
  expanded?: boolean;
  /** Colour of the selected check / border. */
  accent?: string;
  children?: React.ReactNode;
}

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: size.border,
      borderColor: colors.line,
      ...elevation.raised,
    },
    content: { flexDirection: 'row', alignItems: 'center', padding: space.s24, gap: space.s20 },
    tile: {
      width: size.tile,
      height: size.tile,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    well: {
      width: size.chevronWell,
      height: size.chevronWell,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
      borderWidth: size.border,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  icon,
  iconBg,
  title,
  description,
  onPress,
  trailing = 'chevron',
  selected = false,
  expanded = false,
  accent,
  children,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size, opacity } = useTheme();
  const tint = accent ?? service.accent;
  return (
    <View style={[styles.card, selected && { borderColor: tint, borderWidth: size.focusBorder }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        aria-selected={selected}
        aria-expanded={trailing === 'expand' ? expanded : undefined}
        style={({ pressed }) => [styles.content, pressed && { opacity: opacity.pressed }]}>
        <View style={[styles.tile, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={styles.text}>
          <AppText variant="barTitle">
            {title}
          </AppText>
          <AppText variant="small" tone="muted">
            {description}
          </AppText>
        </View>
        <View style={styles.actions}>
          {selected ? <IonIcon name="checkmark-circle" size="lg" color={tint} /> : null}
          {trailing === 'expand' ? (
            <IonIcon name={expanded ? 'chevron-up' : 'chevron-down'} size="lg" color={colors.inkMuted} />
          ) : !selected ? (
            <View style={styles.well}>
              <IonIcon name="chevron-forward" size="md" color={colors.inkMuted} />
            </View>
          ) : null}
        </View>
      </Pressable>
      {children}
    </View>
  );
};

export default ChoiceCard;
