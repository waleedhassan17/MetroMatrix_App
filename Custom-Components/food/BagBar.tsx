// BagBar — "View your bag", pinned at the bottom of a Food screen once
// something is in it: how many dishes, from which kitchen, and the subtotal
// so far (the server's). Delivery and any deal are worked out at checkout.
// FoodBagDock (Components/food/FoodParts) shows it wherever the customer is;
// inside a tab (`inTab`) it sits on the tab bar, so it drops the bottom inset.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../../theme';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';

const makeStyles = ({ space, radius, size, gutter, elevation }: Theme) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: space.s0, right: space.s0, bottom: space.s0, paddingHorizontal: gutter, paddingTop: space.s8 },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      minHeight: size.control.lg,
      paddingHorizontal: space.s16,
      paddingVertical: space.s8,
      borderRadius: radius.lg,
      ...elevation.float,
    },
    // A pill that grows with large text instead of clipping the number.
    count: {
      minWidth: size.icon.lg,
      minHeight: size.icon.lg,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: size.border,
    },
    grow: { flex: 1, minWidth: 0 },
  });

export interface BagBarProps {
  count: number;
  subtotal: number;
  onPress: () => void;
  /** The kitchen the bag is from ("Kababjees · 3 items"). */
  kitchen?: string | null;
  /** The bag is still being changed (a dish going in). */
  busy?: boolean;
  /** Inside a tab: the tab bar already keeps clear of the home indicator. */
  inTab?: boolean;
}

export const BagBar: React.FC<BagBarProps> = ({ count, subtotal, onPress, kitchen, busy, inTab }) => {
  const styles = useStyles(makeStyles);
  const { service, space } = useTheme();
  const insets = useSafeAreaInsets();
  const items = `${count} ${count === 1 ? 'item' : 'items'}`;
  const ink = { color: service.onAccent };
  return (
    <View style={[styles.wrap, { paddingBottom: inTab ? space.s12 : Math.max(insets.bottom, space.s12) }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [styles.bar, { backgroundColor: pressed ? service.accentDeep : service.accent }]}
        accessibilityRole="button"
        accessibilityLabel={`View your bag, ${items}${kitchen ? ` from ${kitchen}` : ''}, ${formatPKR(subtotal)}`}
      >
        <View style={[styles.count, { borderColor: service.onAccent }]}>
          <AppText variant="label" style={ink}>
            {String(count)}
          </AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="bodyStrong" style={ink} numberOfLines={1}>
            View your bag
          </AppText>
          {kitchen ? (
            <AppText variant="caption" style={ink} numberOfLines={1}>
              {kitchen}
            </AppText>
          ) : null}
        </View>
        <AppText variant="bodyStrong" style={ink}>
          {formatPKR(subtotal)}
        </AppText>
      </Pressable>
    </View>
  );
};

export default BagBar;
