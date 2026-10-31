// ═══════════════════════════════════════════════════════
// NextVisitCard — the patient's next appointment, first on Health home
// ═══════════════════════════════════════════════════════
// A solid blue card (white words): the doctor's photo in a white ring, who
// and what, when (in the practice's time) and how soon, where, and the one
// thing to do now (join, pay, directions) as a white button. The card opens
// the appointment; the action is its sibling.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { AppointmentSummary } from '../../types/health';
import { formatWhen, relativeStart } from '../../utils/healthTime';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { OnGradientContext } from '../headerInk';
import type { AppointmentAction } from './AppointmentCard';
import { DoctorPhoto } from './DoctorPhoto';

const makeStyles = ({ colors, space, radius, size, service }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.lg, padding: space.s16, gap: space.s16, backgroundColor: service.accent },
    main: { flexDirection: 'row', gap: space.s12 },
    ring: { borderRadius: radius.lg, borderWidth: size.portraitRing, borderColor: colors.onScrim, padding: size.portraitRing, alignSelf: 'flex-start' },
    text: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    soon: { alignSelf: 'flex-start', paddingHorizontal: space.s8, paddingVertical: space.s0, borderRadius: radius.pill, backgroundColor: colors.onScrimTint },
  });

export const NextVisitCard: React.FC<{ appointment: AppointmentSummary; onPress: () => void; action?: AppointmentAction | null; now?: number }> = ({
  appointment: a,
  onPress,
  action,
  now,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const soon = relativeStart(a.startAt, now, a.endAt);
  const where = a.kind === 'video' ? 'Video consultation' : [a.location.name, a.location.area].filter(Boolean).join(', ');
  const soft = { color: colors.onScrimSoft };
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Your next visit: ${a.doctor.name}, ${a.doctor.specialty.name}, ${formatWhen(a.startAt, a.timezone)}, ${where}${soon ? `, ${soon}` : ''}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.ring}>
          <DoctorPhoto name={a.doctor.name} uri={a.doctor.photoUrl} size="sm" />
        </View>
        <View style={styles.text}>
          <AppText variant="title" tone="onScrim" numberOfLines={1}>
            {a.doctor.name}
          </AppText>
          <AppText variant="small" style={soft} numberOfLines={1}>
            {a.doctor.specialty.name}
            {a.patientName ? ` · for ${a.patientName}` : ''}
          </AppText>
          <View style={styles.row}>
            <IonIcon name="time-outline" size="sm" color={colors.onScrim} />
            <AppText variant="bodyStrong" tone="onScrim">
              {formatWhen(a.startAt, a.timezone)}
            </AppText>
          </View>
          <View style={styles.row}>
            <IonIcon name={a.kind === 'video' ? 'videocam-outline' : 'location-outline'} size="sm" color={colors.onScrim} />
            <AppText variant="small" style={soft} numberOfLines={1}>
              {where}
            </AppText>
          </View>
          {soon ? (
            <View style={styles.soon}>
              <AppText variant="chip" tone="onScrim">
                {soon}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {action ? (
        <OnGradientContext.Provider value>
          <Button label={action.label} leftIcon={action.icon} size="sm" onPress={action.onPress} fullWidth />
        </OnGradientContext.Provider>
      ) : null}
    </View>
  );
};

export default NextVisitCard;
