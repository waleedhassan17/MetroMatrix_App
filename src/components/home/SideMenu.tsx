// ═══════════════════════════════════════════════════════
// MetroMatrix — Side menu (the FYP's SlideOutSidebar, premium)
// ═══════════════════════════════════════════════════════
// Slides in from the left over a dimmed backdrop (85% of the window, at
// most size.sideMenu). A solid brand header with the account; then the
// menu in grouped cards; sign out; the version. Only items that work today
// are listed — no placeholder stats, wallet or dead links.
// Presentational: the home owns `visible` and the actions.

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { initialsOf } from '../../Custom-Components/Avatar';
import { Divider } from '../../Custom-Components/Divider';
import { IonIcon, type IonName } from '../../Custom-Components/Icon';
import { ListRow } from '../../Custom-Components/ListRow';

export interface SideMenuItem {
  key: string;
  label: string;
  icon: IonName;
  onPress: () => void;
}

export interface SideMenuSection {
  title: string;
  items: SideMenuItem[];
}

const makeStyles = ({ colors, space, size, radius, elevation, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    panel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.canvas,
      ...elevation.float,
    },
    head: { paddingHorizontal: space.s20, paddingBottom: space.s24, gap: space.s16 },
    headTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    close: {
      width: size.touch,
      height: size.touch,
      marginRight: -space.s8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.pill,
      borderWidth: size.focusBorder,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    verified: {
      position: 'absolute',
      right: -space.s4 / 2,
      bottom: -space.s4 / 2,
      width: size.icon.lg,
      height: size.icon.lg,
      borderRadius: radius.pill,
      borderWidth: size.focusBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
    },
    who: { gap: space.s4 },
    body: { paddingHorizontal: gutter - space.s8, paddingTop: space.s20, gap: space.s20 },
    section: { gap: space.s8 },
    sectionTitle: { marginLeft: space.s4 },
    card: {
      paddingHorizontal: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    version: { paddingTop: space.s8 },
  });

export const SideMenu: React.FC<{
  visible: boolean;
  onClose: () => void;
  name: string;
  email: string;
  avatarUrl: string | null | undefined;
  verified: boolean;
  sections: SideMenuSection[];
  onSignOut: () => void;
  version: string;
}> = ({ visible, onClose, name, email, avatarUrl, verified, sections, onSignOut, version }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, size, motion, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth * 0.85, size.sideMenu);
  // `shown` follows the animation's end: the panel stays mounted while it
  // slides out, and unmounts only once it is gone.
  const [shown, setShown] = useState(false);
  const mounted = visible || shown;
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motion.sheet.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setShown(visible);
    });
    return () => anim.stop();
  }, [visible, progress, motion.sheet.duration]);

  // Close first, then act — the tap reads as "go there", not "menu flickers".
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              width,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width, 0],
                  }),
                },
              ],
            },
          ]}
          accessibilityViewIsModal>
          {/* Account */}
          <View
            style={[
              styles.head,
              { paddingTop: insets.top + space.s8, backgroundColor: service.accent },
            ]}>
            <View style={styles.headTop}>
              <View>
                <View
                  style={[
                    styles.avatar,
                    { borderColor: colors.onScrimSoft, backgroundColor: service.accentDeep },
                  ]}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <AppText variant="h2" tone="onAccent">
                      {initialsOf(name || '?')}
                    </AppText>
                  )}
                </View>
                {verified ? (
                  <View
                    style={[styles.verified, { borderColor: service.accent }]}
                    accessibilityLabel="Verified account">
                    <IonIcon name="checkmark" size="sm" color={colors.onScrim} />
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                hitSlop={8}>
                <IonIcon name="close" size="lg" color={service.onAccent} />
              </Pressable>
            </View>
            <View style={styles.who}>
              <AppText variant="h2" tone="onAccent" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="small" style={{ color: colors.onScrimSoft }} numberOfLines={1}>
                {email}
              </AppText>
            </View>
          </View>

          {/* Menu */}
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s24 }]}
            showsVerticalScrollIndicator={false}>
            {sections.map(section => (
              <View key={section.title} style={styles.section}>
                <AppText variant="tag" tone="muted" style={styles.sectionTitle}>
                  {section.title.toUpperCase()}
                </AppText>
                <View style={styles.card}>
                  {section.items.map((item, i) => (
                    <React.Fragment key={item.key}>
                      {i > 0 ? <Divider /> : null}
                      <ListRow
                        title={item.label}
                        leftIcon={item.icon}
                        onPress={run(item.onPress)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.card}>
              <ListRow
                title="Sign out"
                leftIcon="log-out-outline"
                destructive
                chevron={false}
                onPress={run(onSignOut)}
              />
            </View>

            <AppText variant="caption" tone="faint" align="center" style={styles.version}>
              MetroMatrix v{version}
            </AppText>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default SideMenu;
