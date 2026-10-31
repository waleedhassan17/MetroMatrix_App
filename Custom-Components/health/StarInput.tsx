// StarInput — tap a star to rate (each tap a small tick); 48 pt targets.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { haptics } from '../../utils/haptics/haptics';
import { IonIcon } from '../Icon';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s0 },
    star: { minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' },
  });

export const StarInput: React.FC<{ value: number; onChange: (n: number) => void; label: string; size?: 'lg' | 'xl'; words?: string[] }> = ({
  value,
  onChange,
  label,
  size = 'xl',
  words,
}) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable
          key={n}
          onPress={() => {
            haptics.select();
            onChange(n);
          }}
          style={styles.star}
          accessibilityRole="button"
          aria-selected={n <= value}
          accessibilityLabel={`${label}: ${n} ${n === 1 ? 'star' : 'stars'}${words?.[n] ? `, ${words[n]}` : ''}`}>
          <IonIcon name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.star : colors.lineStrong} />
        </Pressable>
      ))}
    </View>
  );
};

export default StarInput;
