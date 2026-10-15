// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home parts (presentational)
// ═══════════════════════════════════════════════════════
// The FYP home's header (userHome.tsx): two 40 pt wells, radius 12, on the
// sunk grey (profile, notifications) around the centred brand — 28 pt bold
// "MetroMatrix" over 14 pt "Smart City Services" — 20 pt from the edges.
// Holds no state.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon } from '../../Custom-Components/Icon';
import { initialsOf } from '../../Custom-Components/Avatar';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.s20,
      paddingTop: space.s8,
      paddingBottom: space.s8,
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
      <Pressable
        onPress={onProfile}
        style={styles.well}
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        hitSlop={6}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.wellImage}
            contentFit="cover"
            transition={motion.press.duration}
          />
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
        <AppText variant="body" tone="muted">
          Smart City Services
        </AppText>
      </View>
      <Pressable
        onPress={onNotifications}
        style={styles.well}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={6}>
        <IonIcon name="notifications-outline" size="md" color={colors.ink} />
      </Pressable>
    </View>
  );
};
