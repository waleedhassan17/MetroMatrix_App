// ═══════════════════════════════════════════════════════
// NextVisitCard — the patient's next appointment, first on Health home
// ═══════════════════════════════════════════════════════
// A white card like every other: the doctor's photo, who and what (and who
// it's for when it's a family member's), when in the practice's time with
// ONE status pill, where, how soon, and the one thing to do now (join, pay,
// directions) as the card's single button. The card opens the appointment;
// the action is its sibling (a button can't hold a button).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { AppointmentSummary } from '../../models/health';
import { APPOINTMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { forFamilyLabel } from '../../models/health/familyMemberModel';
import { formatWhen, relativeStart } from '../../utils/health-time/healthTime';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { IonIcon } from '../Icon';
import { StatusPill } from '../StatusPill';
import type { AppointmentAction } from './AppointmentCard';
import { DoctorPhoto } from './DoctorPhoto';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    main: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    text: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
  });

export const NextVisitCard: React.FC<{ appointment: AppointmentSummary; onPress: () => void; action?: AppointmentAction | null; now?: number }> = ({
  appointment: a,
  onPress,
  action,
  now,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const soon = relativeStart(a.startAt, now, a.endAt, a.timezone);
  const where = a.kind === 'video' ? 'Video consultation' : [a.location.name, a.location.area].filter(Boolean).join(', ');
  const status = APPOINTMENT_STATUS[a.status];
  return (
    <Card>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Your next visit: ${a.doctor.name}, ${a.doctor.specialty.name}, ${formatWhen(a.startAt, a.timezone)}, ${where}, ${status.label}${soon ? `, ${soon}` : ''}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: opacity.pressed }]}>
        <DoctorPhoto name={a.doctor.name} uri={a.doctor.photoUrl} size="sm" />
        <View style={styles.text}>
          <View style={styles.head}>
            <AppText variant="title" numberOfLines={1} style={styles.text}>
              {a.doctor.name}
            </AppText>
            <StatusPill label={status.label} tone={status.tone} />
          </View>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {a.doctor.specialty.name}
            {a.forFamily ? ` · for ${forFamilyLabel(a.forFamily)}` : ''}
          </AppText>
          <View style={styles.row}>
            <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="bodyStrong" numberOfLines={1}>
              {formatWhen(a.startAt, a.timezone)}
              {soon ? ` · ${soon}` : ''}
            </AppText>
          </View>
          <View style={styles.row}>
            <IonIcon name={a.kind === 'video' ? 'videocam-outline' : 'location-outline'} size="sm" color={colors.inkMuted} />
            <AppText variant="small" tone="muted" numberOfLines={1}>
              {where}
            </AppText>
          </View>
        </View>
      </Pressable>
      {action ? <Button label={action.label} leftIcon={action.icon} size="sm" variant={action.primary ? 'primary' : 'secondary'} onPress={action.onPress} fullWidth /> : null}
    </Card>
  );
};

export default NextVisitCard;
