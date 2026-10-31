// Stars — a rating out of five in the one star colour, halves included.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { IonIcon } from '../Icon';

const makeStyles = ({ space }: Theme) => StyleSheet.create({ row: { flexDirection: 'row', gap: space.s0 } });

export const Stars: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({ rating, size = 'sm' }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const r = Math.max(0, Math.min(5, rating));
  return (
    <View style={styles.row} accessible accessibilityLabel={`Rated ${r.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <IonIcon
          key={i}
          name={r >= i - 0.25 ? 'star' : r >= i - 0.75 ? 'star-half' : 'star-outline'}
          size={size}
          color={colors.star}
        />
      ))}
    </View>
  );
};

export default Stars;
