// AvailabilityChip — "Available today, 6:00 PM" tinted green; tomorrow or
// later stays neutral. The words are the server's.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Availability } from '../../models/health';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';

const makeStyles = ({ space, radius }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexShrink: 1,
      gap: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    text: { flexShrink: 1 },
  });

export const AvailabilityChip: React.FC<{ availability: Availability }> = ({ availability }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (!availability.label) return null;
  const today = availability.today;
  return (
    <View style={[styles.root, { backgroundColor: today ? colors.successSoft : colors.surfaceSunk }]}>
      <IonIcon name={today ? 'time' : 'time-outline'} size="sm" color={today ? colors.success : colors.inkMuted} />
      <AppText variant="caption" tone={today ? 'success' : 'muted'} style={styles.text}>
        {availability.label}
      </AppText>
    </View>
  );
};

export default AvailabilityChip;
