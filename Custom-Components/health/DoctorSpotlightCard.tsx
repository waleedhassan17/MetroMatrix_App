// ═══════════════════════════════════════════════════════
// DoctorSpotlightCard — a top doctor on the Health home
// ═══════════════════════════════════════════════════════
// A deep-blue card: the doctor's photo in a white ring, the verified tick,
// name, specialty, experience and rating, the starting fee as a pill, and
// "Book" (a white button on the colour). The card opens the profile; Book
// opens it too, ready to choose a time — the two are siblings, never one
// button inside another.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorCardData } from '../../types/health';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { OnGradientContext } from '../headerInk';
import { DoctorPhoto } from './DoctorPhoto';

const makeStyles = ({ colors, space, radius, size, service }: Theme) =>
  StyleSheet.create({
    root: { width: size.spotlightCard, borderRadius: radius.lg, padding: space.s16, gap: space.s16, backgroundColor: service.accentDeep },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    ring: { borderRadius: radius.lg, borderWidth: size.portraitRing, borderColor: colors.onScrim, padding: size.portraitRing },
    text: { flex: 1, gap: space.s4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    name: { flexShrink: 1 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    metaText: { flexShrink: 1 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    fee: { paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.onScrimTint },
  });

export const DoctorSpotlightCard: React.FC<{ doctor: DoctorCardData; onPress: () => void; onBook: () => void }> = ({ doctor: d, onPress, onBook }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
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
        <View style={styles.ring}>
          <DoctorPhoto name={d.name} uri={d.photoUrl} size="md" />
        </View>
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText variant="title" tone="onScrim" numberOfLines={1} style={styles.name}>
              {d.name}
            </AppText>
            {verified ? <IonIcon name="checkmark-circle" size="sm" color={colors.onScrim} /> : null}
          </View>
          <AppText variant="small" numberOfLines={1} style={{ color: colors.onScrimSoft }}>
            {d.specialty.name}
          </AppText>
          <View style={styles.meta}>
            {d.rating !== null ? <IonIcon name="star" size="sm" color={colors.star} /> : null}
            <AppText variant="caption" numberOfLines={1} style={[styles.metaText, { color: colors.onScrimSoft }]}>
              {[d.rating !== null ? `${d.rating.toFixed(1)} (${d.reviewCount})` : null, d.yearsExperience ? `${d.yearsExperience} yrs` : null].filter(Boolean).join('  ·  ')}
            </AppText>
          </View>
        </View>
      </Pressable>
      <View style={styles.foot}>
        <View style={styles.fee}>
          <AppText variant="chip" tone="onScrim">{`from ${formatPKR(d.fromFee)}`}</AppText>
        </View>
        <OnGradientContext.Provider value>
          <Button label="Book" size="sm" leftIcon="calendar-outline" onPress={onBook} />
        </OnGradientContext.Provider>
      </View>
    </View>
  );
};

export default DoctorSpotlightCard;
