// ═══════════════════════════════════════════════════════
// DoctorSpotlightCard — a top doctor on the Health home
// ═══════════════════════════════════════════════════════
// A white card like the rest of the page: the doctor's photo, the verified
// tick, name, specialty, rating and experience, the starting fee, and
// "Book" (the one primary button). The card opens the profile; Book
// opens it too, ready to choose a time — the two are siblings, never one
// button inside another.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorCardData } from '../../models/health';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { DoctorPhoto } from './DoctorPhoto';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: { width: size.spotlightCard, borderRadius: radius.lg, padding: space.s16, gap: space.s16, backgroundColor: colors.surface, ...elevation.card },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    name: { flexShrink: 1 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    metaText: { flexShrink: 1 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    fee: { gap: space.s0 },
  });

export const DoctorSpotlightCard: React.FC<{ doctor: DoctorCardData; onPress: () => void; onBook: () => void }> = ({ doctor: d, onPress, onBook }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, opacity } = useTheme();
  const verified = d.badges.includes('pmdc_verified');
  const years = d.yearsExperience ? `${d.yearsExperience} yrs experience` : null;
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[d.name, d.specialty.name, years, d.rating !== null ? `rated ${d.rating} from ${d.reviewCount} reviews` : null, `fee from ${formatPKR(d.fromFee)}`]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint="Opens the doctor's profile"
        style={({ pressed }) => [styles.head, pressed && { opacity: opacity.pressed }]}>
        <DoctorPhoto name={d.name} uri={d.photoUrl} size="md" />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText variant="title" numberOfLines={1} style={styles.name}>
              {d.name}
            </AppText>
            {verified ? <IonIcon name="checkmark-circle" size="sm" color={service.accent} accessibilityLabel="PMDC verified" /> : null}
          </View>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {d.specialty.name}
          </AppText>
          <View style={styles.meta}>
            {d.rating !== null ? <IonIcon name="star" size="sm" color={colors.star} /> : null}
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.metaText}>
              {[d.rating !== null ? `${d.rating.toFixed(1)} (${d.reviewCount})` : null, d.yearsExperience ? `${d.yearsExperience} yrs` : null].filter(Boolean).join('  ·  ')}
            </AppText>
          </View>
        </View>
      </Pressable>
      <View style={styles.foot}>
        <View style={styles.fee}>
          <AppText variant="caption" tone="muted">
            Fee from
          </AppText>
          <AppText variant="bodyStrong">{formatPKR(d.fromFee)}</AppText>
        </View>
        <Button label="Book" size="sm" leftIcon="calendar-outline" onPress={onBook} />
      </View>
    </View>
  );
};

export default DoctorSpotlightCard;
