// MoneyRows — the label … amount rows under an order or a store's part of it
// (items, delivery, a coupon, what to pay). One look everywhere; money only
// through formatPKR. A free delivery reads "Free", a discount "− Rs 200",
// and the total row is the strong one.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';

export interface MoneyRow {
  label: string;
  value: number;
  /** `free`: 0 reads "Free"; `discount`: shown as "− Rs …"; `total`: the strong last row. */
  kind?: 'free' | 'discount' | 'total';
}

const makeStyles = ({ space, colors, size }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.s12 },
    total: { paddingTop: space.s8, borderTopWidth: size.hairline, borderTopColor: colors.line },
  });

export const MoneyRows: React.FC<{ rows: (MoneyRow | null | false | undefined)[] }> = ({ rows }) => {
  const styles = useStyles(makeStyles);
  const shown = rows.filter((r): r is MoneyRow => !!r);
  return (
    <View style={styles.list}>
      {shown.map(r => {
        const total = r.kind === 'total';
        const free = r.kind === 'free' && r.value === 0;
        const value = free ? 'Free' : r.kind === 'discount' ? `− ${formatPKR(r.value)}` : formatPKR(r.value);
        return (
          <View key={r.label} style={[styles.row, total && styles.total]} accessible accessibilityLabel={`${r.label}: ${value}`}>
            <AppText variant={total ? 'bodyStrong' : 'body'} tone={total ? 'ink' : 'muted'}>
              {r.label}
            </AppText>
            <AppText variant={total ? 'title' : 'body'} tone={free || r.kind === 'discount' ? 'success' : 'ink'}>
              {value}
            </AppText>
          </View>
        );
      })}
    </View>
  );
};

export default MoneyRows;
