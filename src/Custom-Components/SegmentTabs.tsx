// SegmentTabs — a sunk track with the selected segment raised on surface.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../theme';
import { AppText } from './AppText';

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

export interface SegmentTabsProps<K extends string> {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}

// The FYP's Sign In / Sign Up switcher: a sunk track, the selected segment
// raised on white with a soft shadow and an accent label.
const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSunk,
      borderRadius: radius.sm,
      padding: space.s4,
      gap: space.s4,
    },
    segment: {
      flex: 1,
      minHeight: size.touch,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      paddingHorizontal: space.s8,
    },
    selected: { backgroundColor: colors.surface, ...elevation.raised },
  });

export function SegmentTabs<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentTabsProps<K>) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map(option => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.segment, selected && styles.selected]}>
            <AppText
              variant={selected ? 'bodyStrong' : 'label'}
              tone={selected ? 'accent' : 'muted'}
              numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentTabs;
