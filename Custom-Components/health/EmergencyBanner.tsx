// ═══════════════════════════════════════════════════════
// EmergencyBanner — the one red thing in Health
// ═══════════════════════════════════════════════════════
// A call button for each number the API gives (1122, 115…). `quiet` is the
// collapsed row at the bottom of Health home that opens the Emergency
// screen; `full` is the red strip with the call buttons.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { EmergencyNumber } from '../../models/health';
import { callNumber } from '../../utils/maps/maps';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    quiet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      minHeight: size.touch,
      paddingHorizontal: space.s16,
      paddingVertical: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.dangerLine,
      backgroundColor: colors.dangerSoft,
    },
    grow: { flex: 1, gap: space.s0 },
    full: { gap: space.s12, padding: space.s16, borderRadius: radius.lg, backgroundColor: colors.danger },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    call: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s8,
      minHeight: size.control.md,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
  });

export const EmergencyBanner: React.FC<{ numbers: EmergencyNumber[]; variant?: 'quiet' | 'full'; onOpen?: () => void }> = ({
  numbers,
  variant = 'full',
  onOpen,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  if (variant === 'quiet') {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Emergency. Call for help now"
        style={({ pressed }) => [styles.quiet, pressed && { opacity: opacity.pressed }]}>
        <IonIcon name="alert-circle-outline" size="lg" color={colors.danger} />
        <View style={styles.grow}>
          <AppText variant="bodyStrong" tone="danger">
            Emergency?
          </AppText>
          <AppText variant="small" tone="muted">
            Call {numbers[0]?.number ?? '1122'} now. Don’t wait for an appointment.
          </AppText>
        </View>
        <IonIcon name="chevron-forward" size="md" color={colors.danger} />
      </Pressable>
    );
  }
  return (
    <View style={styles.full}>
      <AppText variant="title" tone="onDanger">
        In an emergency, call now
      </AppText>
      <View style={styles.buttons}>
        {numbers.map(n => (
          <Pressable
            key={n.number}
            onPress={() => void callNumber(n.number)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${n.label}, ${n.number}`}
            style={({ pressed }) => [styles.call, pressed && { opacity: opacity.pressed }]}>
            <IonIcon name="call" size="md" color={colors.danger} />
            <AppText variant="button" tone="danger">
              {`Call ${n.number}`}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default EmergencyBanner;
