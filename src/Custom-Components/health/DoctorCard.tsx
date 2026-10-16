// ═══════════════════════════════════════════════════════
// DoctorCard — what a patient needs to choose a doctor, at a glance
// ═══════════════════════════════════════════════════════
// Photo, name with the verified tick, specialty (in the accent, as the FYP's), one line
// of qualifications, then rating · experience · measured wait (only when
// the API has it), when they're next free and the starting fee. Footer
// buttons only for what the doctor offers. `compact` is the rail card.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorCardData } from '../../types/health';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { AvailabilityChip } from './AvailabilityChip';
import { DoctorPhoto } from './DoctorPhoto';

export interface DoctorCardProps {
  doctor: DoctorCardData;
  onPress: () => void;
  onVideo?: () => void;
  onVisit?: () => void;
  compact?: boolean;
}

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.s16,
      gap: space.s12,
      ...elevation.none,
    },
    compact: { width: size.doctorRailCard },
    main: { gap: space.s12 },
    head: { flexDirection: 'row', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    name: { flexShrink: 1 },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: space.s8,
      rowGap: space.s4,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    meta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s8,
    },
    buttons: { flexDirection: 'row', gap: space.s8 },
    button: { flex: 1 },
  });

export const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor: d,
  onPress,
  onVideo,
  onVisit,
  compact,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, opacity } = useTheme();
  const verified = d.badges.includes('pmdc_verified');
  const label = [
    d.name,
    d.specialty.name,
    d.rating !== null ? `rated ${d.rating} from ${d.reviewCount} reviews` : null,
    d.yearsExperience ? `${d.yearsExperience} years experience` : null,
    d.availability.label,
    `fee from ${formatPKR(d.fromFee)}`,
  ]
    .filter(Boolean)
    .join(', ');
  // The buttons are the card's siblings, not its children: one button may not hold another.
  return (
    <View style={[styles.root, compact && styles.compact]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the doctor's profile"
        style={({ pressed }) => [styles.main, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.head}>
          <DoctorPhoto name={d.name} uri={d.photoUrl} size={compact ? 'sm' : 'md'} />
          <View style={styles.text}>
            <View style={styles.nameRow}>
              <AppText variant="title" numberOfLines={compact ? 1 : 2} style={styles.name}>
                {d.name}
              </AppText>
              {verified ? (
                <IonIcon name="checkmark-circle" size="sm" color={service.accent} />
              ) : null}
            </View>
            <AppText variant="small" tone="accentDeep" numberOfLines={1}>
              {d.specialty.name}
            </AppText>
            {d.qualifications && !compact ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {d.qualifications}
              </AppText>
            ) : null}
            <View style={styles.stats}>
              {d.rating !== null ? (
                <View style={styles.stat}>
                  <IonIcon name="star" size="sm" color={colors.star} />
                  <AppText variant="caption">
                    {d.rating.toFixed(1)}{' '}
                    <AppText variant="caption" tone="muted">{`(${d.reviewCount.toLocaleString(
                      'en-US',
                    )})`}</AppText>
                  </AppText>
                </View>
              ) : null}
              {d.yearsExperience ? (
                <AppText variant="caption" tone="muted">{`${d.yearsExperience} yrs`}</AppText>
              ) : null}
              {d.waitMinutes !== null && !compact ? (
                <AppText variant="caption" tone="muted">{`~${d.waitMinutes} min wait`}</AppText>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.meta}>
          <AvailabilityChip availability={d.availability} />
          <AppText variant="small" tone="muted">
            from <AppText variant="bodyStrong">{formatPKR(d.fromFee)}</AppText>
          </AppText>
        </View>
      </Pressable>
      {!compact && (onVideo || onVisit) && (d.offersVideo || d.offersClinic) ? (
        <View style={styles.buttons}>
          {d.offersVideo && onVideo ? (
            <View style={styles.button}>
              <Button
                label="Video consult"
                variant="secondary"
                size="sm"
                leftIcon="videocam-outline"
                onPress={onVideo}
                fullWidth
              />
            </View>
          ) : null}
          {d.offersClinic && onVisit ? (
            <View style={styles.button}>
              <Button
                label="Book visit"
                size="sm"
                leftIcon="calendar-outline"
                onPress={onVisit}
                fullWidth
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default DoctorCard;
