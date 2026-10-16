// ═══════════════════════════════════════════════════════
// MetroMatrix — Pieces the Health screens share
// ═══════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, IonIcon, type AppointmentAction, type IonName } from '@custom/index';
import type { AppointmentSummary, HealthBanner, HealthBannerScreen, HealthBrowseParamList, ShopBrowseParamList } from '@/types';
import { openDirections } from '@utils/maps';

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s4 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    sectionTitle: { flex: 1 },
    link: { minHeight: size.touch, justifyContent: 'center', marginVertical: -space.s12 },
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
    card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    quick: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s12, minHeight: size.touch },
    quickWell: { width: size.icon.xl, height: size.icon.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    trust: { padding: space.s20, gap: space.s16 },
    trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 },
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
      <View style={styles.sectionRow}>
        <AppText variant="sectionTitle" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </AppText>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} accessibilityRole="link" accessibilityLabel={`${seeAllLabel}: ${title}`} style={styles.link} hitSlop={8}>
            <AppText variant="small" tone="accentDeep">
              {seeAllLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? (
        <AppText variant="small" tone="muted">
          {subtitle}
        </AppText>
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

/** A slim white row that leads somewhere ("My appointments"). */
export const QuickRow: React.FC<{ icon: IonName; title: string; body?: string; onPress: () => void }> = ({ icon, title, body, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={body ? `${title}. ${body}` : title}
      style={({ pressed }) => [styles.card, styles.quick, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.quickWell, { backgroundColor: service.accentSoft }]}>
        <IonIcon name={icon} size="md" color={service.accentDeep} />
      </View>
      <View style={styles.grow}>
        <AppText variant="bodyStrong">{title}</AppText>
        {body ? (
          <AppText variant="caption" tone="muted">
            {body}
          </AppText>
        ) : null}
      </View>
      <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
    </Pressable>
  );
};

const TRUST: { icon: IonName; title: string; body: string }[] = [
  { icon: 'shield-checkmark-outline', title: 'Verified doctors', body: "Every doctor's PMDC registration is checked before they can take a booking." },
  { icon: 'wallet-outline', title: 'No commission', body: 'You pay your doctor directly. MetroMatrix takes no cut of the fee.' },
  { icon: 'lock-closed-outline', title: 'Private records', body: 'Your reports are shared only with the doctors you choose.' },
];

/** "Why MetroMatrix Health": the three promises, each with its icon. */
export const TrustList: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={[styles.card, styles.trust]}>
      <AppText variant="sectionTitle" accessibilityRole="header">
        Why MetroMatrix Health
      </AppText>
      {TRUST.map(t => (
        <View key={t.title} style={styles.trustRow} accessible accessibilityLabel={`${t.title}. ${t.body}`}>
          <View style={[styles.quickWell, { backgroundColor: service.accentSoft }]}>
            <IonIcon name={t.icon} size="md" color={service.accentDeep} />
          </View>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{t.title}</AppText>
            <AppText variant="small" tone="muted">
              {t.body}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
};

const SCREEN_CTA: Record<HealthBannerScreen, string> = {
  video_consultation: 'Start a video visit',
  available_today: 'See who is free',
  symptom_checker: 'Check symptoms',
  emergency: 'Get help now',
  records: 'Open records',
};

/** The words on a home banner's button, from where it leads. */
export const bannerCta = ({ target: t }: HealthBanner): string | null => {
  switch (t.kind) {
    case 'specialty':
    case 'condition':
      return 'Find a doctor';
    case 'doctor':
      return 'See profile';
    case 'screen':
      return SCREEN_CTA[t.screen];
    case 'none':
      return null;
  }
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
