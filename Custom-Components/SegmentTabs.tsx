// SegmentTabs — the app's one tab control: underline tabs, the enterprise
// pattern (Fluent, Material, Atlassian, Carbon). Equal-width labels over a
// faint baseline; the selected one bold with a short bar under it. No boxes
// and no borders: the owner found the boxed segmented look odd (2026-11-27).
// - On a page (auth's Sign In / Sign Up, a screen's Write / Preview): the
//   selected label and its bar in the service's accent, the others muted.
// - Inside the gradient page header: the same in white.

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

const makeStyles = ({ space, size, opacity }: Theme) =>
  StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: size.hairline,
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
    },
  });

export function SegmentTabs<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentTabsProps<K>) {
  const styles = useStyles(makeStyles);
  const { colors, service, space } = useTheme();
  const onGradient = useOnGradient();
  // White on the brand gradient; the service's accent on a page.
  const ink = onGradient
    ? { on: colors.onScrim, off: colors.onScrimSoft, bar: colors.onScrim, base: colors.onScrimLine }
    : { on: service.accentDeep, off: colors.inkMuted, bar: service.accent, base: colors.line };

  return (
    <View style={[styles.tabs, { borderBottomColor: ink.base }]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
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
            <AppText variant={selected ? 'bodyStrong' : 'label'} style={{ color: selected ? ink.on : ink.off }} numberOfLines={1}>
              {option.label}
            </AppText>
            {selected ? <View style={[styles.indicator, { backgroundColor: ink.bar }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentTabs;
