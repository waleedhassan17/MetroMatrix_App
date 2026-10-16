// ═══════════════════════════════════════════════════════
// MetroMatrix — Pieces the Health screens share
// ═══════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, IonIcon, type AppointmentAction, type IonName } from '@custom/index';
import type { AppointmentSummary, HealthBrowseParamList, ShopBrowseParamList } from '@/types';
import { openDirections } from '@utils/maps';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    section: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.s12 },
    sectionText: { flex: 1, gap: space.s4 },
    link: { minHeight: size.touch, justifyContent: 'center' },
    tile: {
      flex: 1,
      gap: space.s8,
      padding: space.s16,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      minHeight: size.touch,
      ...elevation.card,
    },
    well: { width: size.specialtyWell, height: size.specialtyWell, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s16, borderRadius: radius.lg, minHeight: size.touch },
    grow: { flex: 1, gap: space.s4 },
  });

/** A section title with an optional "See all". */
export const HealthSection: React.FC<{ title: string; subtitle?: string; onSeeAll?: () => void; seeAllLabel?: string }> = ({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel = 'See all',
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionText}>
        <AppText variant="sectionTitle" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} accessibilityRole="link" accessibilityLabel={`${seeAllLabel}: ${title}`} style={styles.link} hitSlop={8}>
          <AppText variant="small" tone="accentDeep">
            {seeAllLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
};

/** A big choice tile: icon, title, one line. */
export const ActionTile: React.FC<{ icon: IonName; title: string; body: string; onPress: () => void }> = ({ icon, title, body, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [styles.tile, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.well, { backgroundColor: service.accentSoft }]}>
        <IonIcon name={icon} size="lg" color={service.accentDeep} />
      </View>
      <AppText variant="title">{title}</AppText>
      <AppText variant="small" tone="muted">
        {body}
      </AppText>
    </Pressable>
  );
};

/** A tinted row that leads somewhere (the symptom checker card). */
export const PromptRow: React.FC<{ icon: IonName; title: string; body: string; onPress: () => void }> = ({ icon, title, body, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [styles.row, { backgroundColor: service.accentSoft }, pressed && { opacity: opacity.pressed }]}>
      <IonIcon name={icon} size="xl" color={service.accentDeep} />
      <View style={styles.grow}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="small" tone="muted">
          {body}
        </AppText>
      </View>
      <IonIcon name="chevron-forward" size="md" color={service.accentDeep} />
    </Pressable>
  );
};

type Nav = NativeStackNavigationProp<HealthBrowseParamList & ShopBrowseParamList>;

/**
 * The one thing to do about an appointment now, from the server's flags:
 * Join (video, inside the window), Pay (a transfer owed), Rate visit, or
 * Directions to an upcoming clinic visit.
 */
export const useAppointmentAction = () => {
  const navigation = useNavigation<Nav>();
  return useCallback(
    (a: AppointmentSummary): AppointmentAction | null => {
      if (a.canJoinVideo) return { label: 'Join consultation', icon: 'videocam', primary: true, onPress: () => navigation.navigate('VideoPrecheck', { code: a.code }) };
      if (a.canPay) return { label: 'Pay and send proof', icon: 'card-outline', primary: true, onPress: () => navigation.navigate('PaymentProof', { appointmentCode: a.code }) };
      if (a.canReview) return { label: 'Rate visit', icon: 'star-outline', onPress: () => navigation.navigate('PostConsultReview', { code: a.code }) };
      const upcoming = a.status === 'confirmed' || a.status === 'checked_in';
      if (upcoming && a.kind === 'clinic') return { label: 'Directions', icon: 'navigate-outline', onPress: () => void openDirections(a.location) };
      return null;
    },
    [navigation],
  );
};
