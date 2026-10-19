// BadgeRow — the small facts on a kitchen or a dish: signature recipe,
// hygiene verified (or self-declared), home kitchen, Bachat Box today,
// under 600 kcal, high protein. Outlined, quiet, never more than a line.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

export type BadgeKey = 'signature' | 'hygiene_verified' | 'hygiene_self_declared' | 'home_kitchen' | 'bachat_today' | 'under_600' | 'high_protein';

export const BADGES: Record<BadgeKey, { label: string; icon: IonName }> = {
  signature: { label: 'Signature recipe', icon: 'ribbon-outline' },
  hygiene_verified: { label: 'Hygiene verified', icon: 'shield-checkmark-outline' },
  hygiene_self_declared: { label: 'Hygiene self-declared', icon: 'shield-outline' },
  home_kitchen: { label: 'Home kitchen', icon: 'home-outline' },
  bachat_today: { label: 'Bachat Box today', icon: 'gift-outline' },
  under_600: { label: 'Under 600 kcal', icon: 'leaf-outline' },
  high_protein: { label: 'High protein', icon: 'barbell-outline' },
};

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill, borderWidth: size.border, borderColor: colors.line },
  });

export const BadgeRow: React.FC<{ badges: BadgeKey[] }> = ({ badges }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (!badges.length) return null;
  return (
    <View style={styles.row}>
      {badges.map(b => (
        <View key={b} style={styles.badge} accessible accessibilityLabel={BADGES[b].label}>
          <IonIcon name={BADGES[b].icon} size="sm" color={colors.inkMuted} />
          <AppText variant="chip" tone="muted">
            {BADGES[b].label}
          </AppText>
        </View>
      ))}
    </View>
  );
};

export default BadgeRow;
