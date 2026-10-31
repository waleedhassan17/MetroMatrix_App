// TiffinPlanCard — a kitchen's tiffin plan: its name, the meal and days, the
// price for the week or month, what the rotation looks like and how many
// places are left.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { StatusPill } from '../StatusPill';

export interface TiffinPlanCardData {
  id: string;
  name: string;
  /** "Lunch · Mon to Fri". */
  scheduleLabel: string;
  /** "Rs 3,500 a week". */
  priceLabel: string;
  /** A few days of the rotation: "Mon: Daal chawal". */
  rotation: string[];
  placesLeft: number | null;
  vendorName?: string | null;
}

const makeStyles = ({ space, size, radius, colors, elevation }: Theme) =>
  StyleSheet.create({
    root: { padding: space.s16, gap: space.s8, borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    rail: { width: size.tiffinCard },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    day: { flexDirection: 'row', gap: space.s8, alignItems: 'center' },
  });

export const TiffinPlanCard: React.FC<{ plan: TiffinPlanCardData; onPress: () => void; rail?: boolean }> = ({ plan, onPress, rail }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const full = plan.placesLeft === 0;
  return (
    <Pressable onPress={onPress} style={[styles.root, rail && styles.rail]} accessibilityRole="button" accessibilityLabel={`${plan.name}, ${plan.scheduleLabel}, ${plan.priceLabel}${full ? ', full' : ''}`}>
      <View style={styles.head}>
        <IonIcon name="calendar-outline" size="md" color={service.accentDeep} />
        <AppText variant="title" numberOfLines={1} style={styles.grow}>
          {plan.name}
        </AppText>
        {plan.placesLeft !== null ? <StatusPill label={full ? 'Full' : `${plan.placesLeft} places left`} tone={full ? 'neutral' : 'accent'} /> : null}
      </View>
      {plan.vendorName ? (
        <AppText variant="small" tone="muted">
          {plan.vendorName}
        </AppText>
      ) : null}
      <AppText variant="small" tone="muted">
        {plan.scheduleLabel}
      </AppText>
      <AppText variant="bodyStrong">{plan.priceLabel}</AppText>
      {plan.rotation.slice(0, 3).map(r => (
        <View key={r} style={styles.day}>
          <IonIcon name="ellipse" size="sm" color={service.accentSoft} />
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.grow}>
            {r}
          </AppText>
        </View>
      ))}
    </Pressable>
  );
};

export default TiffinPlanCard;
