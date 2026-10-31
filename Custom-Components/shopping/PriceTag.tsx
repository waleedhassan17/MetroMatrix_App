// PriceTag — what you pay now, the struck "was" price, and (large) the
// saving. Money only ever through formatPKR.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { discountPercent, formatPKR } from '../../utils/money';
import { AppText } from '../AppText';

export interface PriceTagProps {
  price: number;
  compareAtPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const makeStyles = ({ space, colors, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.s8, rowGap: space.s4 },
    was: { textDecorationLine: 'line-through' },
    save: {
      alignSelf: 'center',
      paddingHorizontal: space.s8,
      paddingVertical: space.s0,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
    },
  });

export const PriceTag: React.FC<PriceTagProps> = ({ price, compareAtPrice, size = 'sm' }) => {
  const styles = useStyles(makeStyles);
  const off = discountPercent(price, compareAtPrice);
  const was = off > 0 && compareAtPrice ? compareAtPrice : null;
  const label = `${formatPKR(price)}${was ? `, was ${formatPKR(was)}` : ''}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <AppText variant={size === 'lg' ? 'h1' : size === 'md' ? 'title' : 'bodyStrong'}>{formatPKR(price)}</AppText>
      {was ? (
        <AppText variant={size === 'lg' ? 'body' : 'caption'} tone="muted" style={styles.was}>
          {formatPKR(was)}
        </AppText>
      ) : null}
      {was && size === 'lg' ? (
        <View style={styles.save}>
          <AppText variant="chip" tone="success">
            Save {formatPKR(was - price)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
};

export default PriceTag;
