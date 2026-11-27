// SegmentTabs — two looks, one control:
// - on a page (auth's Sign In / Sign Up): the FYP's sunk track with the selected
//   segment raised on white and an accent label;
// - inside the gradient page header: section tabs, the enterprise pattern
//   (Fluent / Material primary tabs) — white labels on the brand gradient over
//   a faint baseline, the selected one bold with a short white underline. No
//   boxes, no borders: the owner found the boxed version heavy (2026-11-27).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { useOnGradient } from './headerInk';

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

const makeStyles = ({ colors, space, radius, size, elevation, opacity }: Theme) =>
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
    // On the gradient header: underline tabs on a faint baseline.
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: size.hairline,
      borderBottomColor: colors.onScrimLine,
    },
    tab: {
      flex: 1,
      minHeight: size.touch,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.s4,
    },
    pressed: { opacity: opacity.pressed },
    indicator: {
      position: 'absolute',
      left: space.s12,
      right: space.s12,
      bottom: 0,
      height: size.tabIndicator,
      borderTopLeftRadius: size.tabIndicator,
      borderTopRightRadius: size.tabIndicator,
      backgroundColor: colors.onScrim,
    },
  });

export function SegmentTabs<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentTabsProps<K>) {
  const styles = useStyles(makeStyles);
  const { colors, space } = useTheme();
  const onGradient = useOnGradient();

  if (onGradient) {
    return (
      <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
        {options.map(option => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              accessibilityRole="tab"
              aria-selected={selected}
              accessibilityLabel={option.label}
              hitSlop={{ top: space.s4, bottom: space.s4 }}
              style={({ pressed }) => [styles.tab, pressed && !selected && styles.pressed]}>
              <AppText
                variant={selected ? 'bodyStrong' : 'label'}
                tone="onScrim"
                style={selected ? undefined : { color: colors.onScrimSoft }}
                numberOfLines={1}>
                {option.label}
              </AppText>
              {selected ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map(option => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            aria-selected={selected}
            accessibilityLabel={option.label}
            style={[styles.segment, selected && styles.selected]}>
            <AppText variant={selected ? 'bodyStrong' : 'label'} tone={selected ? 'accent' : 'muted'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentTabs;
