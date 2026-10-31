// MetroMatrix — Five tappable stars with the word for the rating under them
// ("Very good"). Each tap is a small tick; screen readers hear "4 stars,
// Very good" and can adjust it.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, IonIcon } from '../index';
import { RATING_WORDS } from '../../models/food/reviewModel';
import { haptics } from '../../utils/haptics/haptics';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s4, alignItems: 'center' },
    stars: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    star: { minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' },
  });

export const StarInput: React.FC<{ label: string; value: number; onChange: (n: number) => void; error?: string }> = ({ label, value, onChange, error }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      <View
        style={styles.stars}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} of 5, ${RATING_WORDS[value]}` : 'Not rated' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => onChange(Math.max(1, Math.min(5, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable
            key={n}
            onPress={() => {
              haptics.press();
              onChange(n);
            }}
            style={styles.star}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_WORDS[n]}`}
            aria-selected={value === n}>
            <IonIcon name={n <= value ? 'star' : 'star-outline'} size="xl" color={n <= value ? colors.star : colors.lineStrong} />
          </Pressable>
        ))}
      </View>
      <AppText variant="small" tone={error ? 'danger' : 'muted'}>
        {value ? RATING_WORDS[value] : (error ?? 'Tap to rate')}
      </AppText>
    </View>
  );
};

export default StarInput;
