// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home parts (presentational)
// ═══════════════════════════════════════════════════════
// The FYP home's header (two 40 pt wells around the centred brand), the
// greeting, the launch spotlight and the trust strip. CustomerHomeScreen
// composes them; none holds state.

import React from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type MciName } from '../../Custom-Components/Icon';
import { initialsOf } from '../../Custom-Components/Avatar';

const makeStyles = ({ colors, space, size, radius, gutter, elevation }: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingTop: space.s8,
    },
    well: {
      width: size.headerWell,
      height: size.headerWell,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSunk,
      overflow: 'hidden',
    },
    wellImage: { width: size.headerWell, height: size.headerWell },
    brand: { alignItems: 'center' },
    greeting: { paddingHorizontal: gutter, gap: space.s8 },
    location: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingLeft: space.s8,
      paddingRight: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    spotlight: {
      marginHorizontal: gutter,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s16,
      padding: space.s16,
      borderRadius: radius.xl,
      backgroundColor: colors.ink,
      ...elevation.raised,
    },
    spotThumb: { width: size.avatar.lg, height: size.avatar.lg, borderRadius: radius.lg },
    spotText: { flex: 1, gap: space.s4 },
    code: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      marginTop: space.s4,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4 / 2,
      borderRadius: radius.sm,
      borderWidth: size.border,
      borderStyle: 'dashed',
    },
    spotGo: {
      width: size.chevronWell,
      height: size.chevronWell,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trust: {
      marginHorizontal: gutter,
      gap: space.s16,
      padding: space.s20,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceSunk,
    },
    trustRow: { flexDirection: 'row', gap: space.s12 },
    trustItem: { flex: 1, alignItems: 'center', gap: space.s8 },
    trustIcon: {
      width: size.control.md,
      height: size.control.md,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  });

// ─── Header (the FYP's: well · brand · well) ──────────
export const HomeHeader: React.FC<{
  name: string;
  avatarUrl: string | null | undefined;
  onProfile: () => void;
  onNotifications: () => void;
}> = ({ name, avatarUrl, onProfile, onNotifications }) => {
  const styles = useStyles(makeStyles);
  const { colors, motion } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onProfile} style={styles.well} accessibilityRole="button" accessibilityLabel="Your profile" hitSlop={6}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.wellImage} contentFit="cover" transition={motion.press.duration} />
        ) : name ? (
          <AppText variant="bodyStrong" tone="brand">
            {initialsOf(name)}
          </AppText>
        ) : (
          <IonIcon name="person-outline" size="md" color={colors.ink} />
        )}
      </Pressable>
      <View style={styles.brand} accessibilityRole="header">
        <AppText variant="logo" tone="brand">
          MetroMatrix
        </AppText>
        <AppText variant="small" tone="muted">
          Smart City Services
        </AppText>
      </View>
      <Pressable onPress={onNotifications} style={styles.well} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={6}>
        <IonIcon name="notifications-outline" size="md" color={colors.ink} />
      </Pressable>
    </View>
  );
};

// ─── Greeting ─────────────────────────────────────────
export const HomeGreeting: React.FC<{ firstName: string | null; area: string | null }> = ({ firstName, area }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <View style={styles.greeting}>
      <View>
        <AppText variant="h1">{firstName ? `${part}, ${firstName}` : part}</AppText>
        <AppText variant="body" tone="muted">
          What can we bring you today?
        </AppText>
      </View>
      {area ? (
        <View style={styles.location} accessible accessibilityLabel={`Your area: ${area}`}>
          <MciIcon name="map-marker" size="sm" color={service.accent} />
          <AppText variant="small" numberOfLines={1}>
            {area}
          </AppText>
          <IonIcon name="checkmark-circle" size="sm" color={colors.success} />
        </View>
      ) : null}
    </View>
  );
};

// ─── Spotlight (the launch offer) ─────────────────────
export const HomeSpotlight: React.FC<{
  image: ImageSourcePropType;
  eyebrow: string;
  title: string;
  code: string;
  accent: string;
  onAccent: string;
  onPress: () => void;
}> = ({ image, eyebrow, title, code, accent, onAccent, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, motion, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.spotlight, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${title}. Use code ${code}.`}>
      <Image source={image} style={styles.spotThumb} contentFit="cover" transition={motion.press.duration} />
      <View style={styles.spotText}>
        <AppText variant="micro" style={{ color: colors.onScrimSoft }}>
          {eyebrow}
        </AppText>
        <AppText variant="title" tone="onScrim" numberOfLines={2}>
          {title}
        </AppText>
        <View style={[styles.code, { borderColor: colors.onScrimSoft }]}>
          <MciIcon name="ticket-percent-outline" size="sm" color={colors.onScrim} />
          <AppText variant="caption" tone="onScrim">
            Code {code}
          </AppText>
        </View>
      </View>
      <View style={[styles.spotGo, { backgroundColor: accent }]}>
        <IonIcon name="arrow-forward" size="sm" color={onAccent} />
      </View>
    </Pressable>
  );
};

// ─── Why MetroMatrix ──────────────────────────────────
const TRUST: { icon: MciName; title: string; body: string }[] = [
  { icon: 'hand-coin-outline', title: 'Zero commission', body: 'Partners keep what they earn' },
  { icon: 'shield-check-outline', title: 'Verified', body: 'Every partner is checked' },
  { icon: 'account-circle-outline', title: 'One account', body: 'Food, health and shopping' },
];

export const HomeTrust: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={styles.trust}>
      <AppText variant="title" accessibilityRole="header">
        Why MetroMatrix
      </AppText>
      <View style={styles.trustRow}>
        {TRUST.map(t => (
          <View key={t.title} style={styles.trustItem} accessible accessibilityLabel={`${t.title}. ${t.body}`}>
            <View style={styles.trustIcon}>
              <MciIcon name={t.icon} size="lg" color={service.accent} />
            </View>
            <AppText variant="small" align="center">
              {t.title}
            </AppText>
            <AppText variant="caption" tone="muted" align="center">
              {t.body}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
};
