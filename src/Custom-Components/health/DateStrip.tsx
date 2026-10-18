// ═══════════════════════════════════════════════════════
// DateStrip — the next two weeks, one chip a day
// ═══════════════════════════════════════════════════════
// Weekday over the day number; a day with no free time is dimmed and says
// so; the selected day fills with the accent. It scrolls itself to the
// selected (or first available) day.

import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DayAvailability } from '../../types/health';
import { formatDayChip } from '../../utils/healthTime';
import { AppText } from '../AppText';
import { Skeleton } from '../Skeleton';

const makeStyles = ({ colors, space, radius, size, gutter }: Theme) =>
  StyleSheet.create({
    row: { paddingHorizontal: gutter, gap: space.s8 },
    chip: {
      width: size.dayChip.width,
      minHeight: size.dayChip.height,
      paddingVertical: space.s8,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s0,
    },
    dim: { backgroundColor: colors.surfaceSunk, borderColor: colors.lineSoft },
  });

export const DateStrip: React.FC<{
  days: DayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
  loading?: boolean;
}> = ({ days, selected, onSelect, loading }) => {
  const styles = useStyles(makeStyles);
  const { service, size, space } = useTheme();
  const ref = useRef<ScrollView>(null);
  const pitch = size.dayChip.width + space.s8;

  const target = days.findIndex(d => d.date === selected);
  useEffect(() => {
    if (target > 1) ref.current?.scrollTo({ x: (target - 1) * pitch, animated: true });
  }, [target, pitch]);

  if (loading && !days.length) {
    return (
      <View style={[styles.row, { flexDirection: 'row' }]}>
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} width={size.dayChip.width} height={size.dayChip.height} shape="md" />
        ))}
      </View>
    );
  }

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map(d => {
        const chip = formatDayChip(d.date);
        const on = d.date === selected;
        const none = d.slotCount === 0;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="button"
            aria-selected={on}
            accessibilityLabel={`${chip.long}, ${none ? 'no times' : `${d.slotCount} ${d.slotCount === 1 ? 'time' : 'times'} free`}`}
            style={[styles.chip, none && styles.dim, on && { backgroundColor: service.accent, borderColor: service.accent }]}>
            <AppText variant="micro" tone={on ? 'onAccent' : none ? 'faint' : 'muted'}>
              {chip.weekday.toUpperCase()}
            </AppText>
            <AppText variant="h2" tone={on ? 'onAccent' : none ? 'faint' : 'ink'}>
              {chip.day}
            </AppText>
            <AppText variant="micro" tone={on ? 'onAccent' : 'faint'}>
              {none ? 'No slots' : chip.month}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default DateStrip;
