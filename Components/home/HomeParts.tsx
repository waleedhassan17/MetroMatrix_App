// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home parts (presentational)
// ═══════════════════════════════════════════════════════
// The FYP home's header (userHome.tsx): the menu at the left (it opens the
// side menu, as the FYP's hamburger opened its SlideOutSidebar), 28 pt bold
// "MetroMatrix" over 14 pt "Smart City Services" centred, and the bell at the
// right — plain glyphs on 44 pt targets, as in the FYP mockup. Holds no state.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon } from '../../Custom-Components/Icon';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.s12,
      paddingTop: space.s8,
      paddingBottom: space.s8,
    },
    // Plain glyphs on 44 pt targets, as in the FYP mockup — no wells or discs.
    action: {
      width: size.touch,
      height: size.touch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      position: 'absolute',
      top: space.s8 + space.s4 / 2,
      right: space.s8 + space.s4 / 2,
      width: space.s8,
      height: space.s8,
      borderRadius: space.s4,
      borderWidth: size.focusBorder / 2,
    },
    brand: { alignItems: 'center' },
  });

// ─── Header (the FYP's: menu · brand · notifications) ──
export const HomeHeader: React.FC<{
  onMenu: () => void;
  onNotifications: () => void;
  /** Unread notifications: shows a dot on the bell. */
  unread?: number;
}> = ({ onMenu, onNotifications, unread = 0 }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onMenu}
        style={({ pressed }) => [styles.action, pressed && { opacity: opacity.pressed }]}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={6}>
        <IonIcon name="menu" size="lg" color={colors.ink} />
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
        style={({ pressed }) => [styles.action, pressed && { opacity: opacity.pressed }]}
        accessibilityRole="button"
        accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        hitSlop={6}>
        <IonIcon name="notifications" size="lg" color={colors.ink} />
        {unread ? (
          <View
            style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.canvas }]}
          />
        ) : null}
      </Pressable>
    </View>
  );
};
