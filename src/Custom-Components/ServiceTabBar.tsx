// ═══════════════════════════════════════════════════════
// ServiceTabBar — the FYP's per-service bottom bars
// ═══════════════════════════════════════════════════════
// One bar, three looks, chosen by the service (theme.tabBar.variant):
//   gradientPill  Health: a white bar with a blue hairline; the selected
//                 icon sits white on a small gradient pill, its label bold
//                 in the accent.
//   tint          Shopping: a lifted bar with rounded top corners; the
//                 selected tab is the accent, filled icon, bold label.
//   softPill      Food Court (the FYP's Home services bar): the selected
//                 icon on a soft accent pill.
// Icons are Ionicons pairs — outline at rest, filled when selected. A tab
// can carry a count (the Bag).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon, type IonName } from './Icon';

export interface ServiceTabItem {
  key: string;
  label: string;
  icon: IonName;
  iconActive: IonName;
  /** A count on the icon (the Bag); hidden at 0. */
  badge?: number;
}

export interface ServiceTabBarProps {
  items: ServiceTabItem[];
  activeIndex: number;
  onPress: (index: number) => void;
  onLongPress?: (index: number) => void;
}

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const makeStyles = ({ colors, service, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', backgroundColor: colors.surface, paddingTop: space.s8 },
    gradientPill: { borderTopWidth: size.border, borderTopColor: service.accentLine, ...elevation.tabBar },
    tint: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...elevation.tabBar },
    softPill: { borderTopWidth: size.hairline, borderTopColor: colors.line, ...elevation.tabBar },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s4, minHeight: size.touch },
    iconBox: { width: size.tabPill.width, height: size.tabPill.height, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    soft: { paddingHorizontal: space.s16, paddingVertical: space.s4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: -space.s4,
      right: -space.s8,
      minWidth: size.countBadge,
      height: size.countBadge,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const ServiceTabBar: React.FC<ServiceTabBarProps> = ({ items, activeIndex, onPress, onLongPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, space, tabBar } = useTheme();
  const insets = useSafeAreaInsets();
  const variant = tabBar.variant === 'pill' ? 'softPill' : tabBar.variant;

  return (
    <View style={[styles.bar, styles[variant], { paddingBottom: Math.max(insets.bottom, space.s8) }]} accessibilityRole="tablist">
      {items.map((item, i) => {
        const focused = i === activeIndex;
        const tint = focused ? (variant === 'softPill' ? service.accentDeep : service.accent) : colors.inkFaint;
        const glyph = (
          <View>
            <IonIcon
              name={focused ? item.iconActive : item.icon}
              size={variant === 'gradientPill' ? 'md' : 'lg'}
              color={focused && variant === 'gradientPill' ? service.onAccent : tint}
            />
            {item.badge ? (
              <View style={styles.badge}>
                <AppText variant="micro" style={{ color: colors.onScrim }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </AppText>
              </View>
            ) : null}
          </View>
        );
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(i)}
            onLongPress={onLongPress ? () => onLongPress(i) : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label}
            style={styles.item}>
            {variant === 'gradientPill' ? (
              <View style={styles.iconBox}>
                {focused ? <LinearGradient colors={tabBar.gradient} start={GRADIENT_START} end={GRADIENT_END} style={StyleSheet.absoluteFill} /> : null}
                {glyph}
              </View>
            ) : variant === 'softPill' ? (
              <View style={[styles.soft, focused && { backgroundColor: service.accentSoft }]}>{glyph}</View>
            ) : (
              glyph
            )}
            <AppText
              variant={variant === 'tint' ? 'tabSmall' : variant === 'softPill' ? (focused ? 'chip' : 'caption') : focused ? 'tabActive' : 'tab'}
              style={{ color: tint }}
              numberOfLines={1}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};

export default ServiceTabBar;
