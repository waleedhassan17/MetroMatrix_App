// ═══════════════════════════════════════════════════════
// AppointmentCard — one visit, and the one thing to do about it now
// ═══════════════════════════════════════════════════════
// The date block on the left (day number large, month small); doctor,
// specialty, where (or video), how soon it starts, the status; and a
// context action the screen chooses from the server's flags (Join,
// Directions, Pay, Rate).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { AppointmentSummary } from '../../models/health';
import { APPOINTMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { dateBlock, formatSlot, relativeStart } from '../../utils/health-time/healthTime';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon, type IonName } from '../Icon';
import { StatusPill } from '../StatusPill';

export interface AppointmentAction {
  label: string;
  icon: IonName;
  onPress: () => void;
  primary?: boolean;
}

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.s16, gap: space.s12, ...elevation.card },
    main: { flexDirection: 'row', gap: space.s12 },
    block: { width: size.dateBlock, minHeight: size.dateBlock, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: space.s4 },
    text: { flex: 1, gap: space.s4 },
    where: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    whereText: { flexShrink: 1 },
    status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
  });

export const AppointmentCard: React.FC<{
  appointment: AppointmentSummary;
  onPress: () => void;
  action?: AppointmentAction | null;
  now?: number;
}> = ({ appointment: a, onPress, action, now }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  const block = dateBlock(a.startAt, a.timezone);
  const status = APPOINTMENT_STATUS[a.status];
  const soon = relativeStart(a.startAt, now, a.endAt);
  const upcoming = status.tone !== 'success' && a.status !== 'cancelled' && a.status !== 'no_show';
  const where = a.kind === 'video' ? 'Video consultation' : [a.location.name, a.location.area].filter(Boolean).join(', ');
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${a.doctor.name}, ${a.doctor.specialty.name}, ${block.weekday} ${block.day} ${block.month} at ${formatSlot(a.startAt, a.timezone)}, ${where}, ${status.label}${a.patientName ? `, for ${a.patientName}` : ''}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: opacity.pressed }]}>
        <View style={[styles.block, { backgroundColor: upcoming ? service.accentSoft : colors.surfaceSunk }]}>
          <AppText variant="micro" tone={upcoming ? 'accentDeep' : 'muted'}>
            {block.weekday.toUpperCase()}
          </AppText>
          <AppText variant="h2" tone={upcoming ? 'accentDeep' : 'ink'}>
            {block.day}
          </AppText>
          <AppText variant="micro" tone={upcoming ? 'accentDeep' : 'muted'}>
            {block.month.toUpperCase()}
          </AppText>
        </View>
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={2}>
            {a.doctor.name}
          </AppText>
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {a.doctor.specialty.name} · {formatSlot(a.startAt, a.timezone)}
            {a.patientName ? ` · for ${a.patientName.split(' ')[0]}` : ''}
          </AppText>
          <View style={styles.where}>
            <IonIcon name={a.kind === 'video' ? 'videocam-outline' : 'location-outline'} size="sm" color={colors.inkMuted} />
            <AppText variant="small" tone="muted" numberOfLines={2} style={styles.whereText}>
              {where}
            </AppText>
          </View>
          <View style={styles.status}>
            <StatusPill label={status.label} tone={status.tone} />
            {upcoming && soon ? (
              <AppText variant="small" tone="accentDeep">
                {soon}
              </AppText>
            ) : null}
          </View>
        </View>
      </Pressable>
      {action ? <Button label={action.label} leftIcon={action.icon} variant={action.primary ? 'primary' : 'secondary'} size="sm" onPress={action.onPress} fullWidth /> : null}
    </View>
  );
};

export default AppointmentCard;
