// BagBar — "View your bag" pinned under a vendor's menu once something is in
// it: how many dishes, and the subtotal so far (the server's). Delivery and
// any deal are worked out at checkout.

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
      borderRadius: radius.lg,
      ...elevation.float,
    },
    count: { minWidth: size.icon.lg, height: size.icon.lg, paddingHorizontal: space.s4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: size.border },
    grow: { flex: 1 },
  });

export interface BagBarProps {
  count: number;
  subtotal: number;
  onPress: () => void;
  /** The bag is still being changed (a dish going in). */
  busy?: boolean;
}

export const BagBar: React.FC<BagBarProps> = ({ count, subtotal, onPress, busy }) => {
  const styles = useStyles(makeStyles);
  const { service, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.s12) }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [styles.bar, { backgroundColor: pressed ? service.accentDeep : service.accent }]}
        accessibilityRole="button"
        accessibilityLabel={`View your bag, ${count} ${count === 1 ? 'item' : 'items'}, ${formatPKR(subtotal)}`}
      >
        <View style={[styles.count, { borderColor: service.onAccent }]}>
          <AppText variant="label" style={{ color: service.onAccent }}>
            {String(count)}
          </AppText>
        </View>
        <AppText variant="bodyStrong" style={[styles.grow, { color: service.onAccent }]}>
          View your bag
        </AppText>
        <AppText variant="bodyStrong" style={{ color: service.onAccent }}>
          {formatPKR(subtotal)}
        </AppText>
      </Pressable>
    </View>
  );
};

export default BagBar;
