// ═══════════════════════════════════════════════════════
// SlotGrid — a day's free times, by part of the day
// ═══════════════════════════════════════════════════════
// Morning / Afternoon / Evening / Night, each a grid of time pills (3 across,
// 4 on a tablet). The picked time fills with the accent. Every pill reads
// "Thursday 15 October, 6:15 PM, available" to a screen reader. An empty day
// offers the next day that has time.

import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Slot, SlotPeriod } from '../../types/health';
import { formatDayShort, formatSlot, slotA11yLabel } from '../../utils/healthTime';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';
import { Skeleton } from '../Skeleton';
import { TextAction } from '../TextAction';

const PERIODS: { key: SlotPeriod; label: string; icon: IonName }[] = [
  { key: 'morning', label: 'Morning', icon: 'partly-sunny-outline' },
  { key: 'afternoon', label: 'Afternoon', icon: 'sunny-outline' },
  { key: 'evening', label: 'Evening', icon: 'cloudy-night-outline' },
  { key: 'night', label: 'Night', icon: 'moon-outline' },
];

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s16 },
    section: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.s4 },
    cell: { padding: space.s4 },
    pill: {
      minHeight: size.touch,
      paddingVertical: space.s8,
      paddingHorizontal: space.s4,
      borderRadius: radius.sm,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { gap: space.s8, padding: space.s16, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

export const SlotGrid: React.FC<{
  slots: Slot[];
  timezone: string;
  selected: string | null;
  onSelect: (startAt: string) => void;
  loading?: boolean;
  /** When the day is empty: the next day with time, and how to jump to it. */
  nextAvailable?: { date: string } | null;
  onNextAvailable?: (date: string) => void;
}> = ({ slots, timezone, selected, onSelect, loading, nextAvailable, onNextAvailable }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 4 : 3;

  if (loading) {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.cell, { width: `${100 / cols}%` }]}>
            <Skeleton height={size.touch} shape="sm" />
          </View>
        ))}
      </View>
    );
  }

  if (!slots.length) {
    return (
      <View style={styles.empty}>
        <AppText variant="bodyStrong">No times this day</AppText>
        {nextAvailable && onNextAvailable ? (
          <TextAction label={`Next available ${formatDayShort(nextAvailable.date)}`} icon="arrow-forward" onPress={() => onNextAvailable(nextAvailable.date)} />
        ) : (
          <AppText variant="small" tone="muted">
            Try another day, or another location.
          </AppText>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {PERIODS.map(p => {
        const list = slots.filter(s => s.period === p.key);
        if (!list.length) return null;
        return (
          <View key={p.key} style={styles.section}>
            <View style={styles.head}>
              <IonIcon name={p.icon} size="sm" color={colors.inkMuted} />
              <AppText variant="small" tone="muted">
                {p.label}
              </AppText>
            </View>
            <View style={styles.grid}>
              {list.map(s => {
                const on = s.startAt === selected;
                return (
                  <View key={s.startAt} style={[styles.cell, { width: `${100 / cols}%` }]}>
                    <Pressable
                      onPress={() => onSelect(s.startAt)}
                      accessibilityRole="button"
                      aria-selected={on}
                      accessibilityLabel={slotA11yLabel(s.startAt, timezone)}
                      style={[styles.pill, on && { backgroundColor: service.accent, borderColor: service.accent }]}>
                      <AppText variant="bodyStrong" tone={on ? 'onAccent' : 'ink'}>
                        {formatSlot(s.startAt, timezone)}
                      </AppText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default SlotGrid;
