// ═══════════════════════════════════════════════════════
// ModalSheet — a bottom sheet built on React Native's Modal
// ═══════════════════════════════════════════════════════
// Same props and look as Sheet: a scrim that dismisses, a panel anchored to
// the bottom (centred and capped in width on a wide window), the handle,
// title, close, body and footer. It is Sheet on web, where
// @gorhom/bottom-sheet never presents, and every picker on every platform
// (BottomSheetPicker, SearchPicker): a plain Modal opens wherever the app
// runs, Expo Go on Android included. `tall` keeps the panel one height while
// its content changes, so a search field at the top stays where it is.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { makeSheetStyles, type SheetProps } from './sheetShared';

export interface ModalSheetProps extends SheetProps {
  /** A fixed, tall panel (a search list) instead of one sized to its content. */
  tall?: boolean;
}

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    panel: {
      width: '100%',
      maxWidth: size.prose + space.s56 * 2,
      maxHeight: '88%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: space.s8,
      ...elevation.float,
    },
    tall: { height: '88%' },
    scrollTall: { flex: 1 },
    handle: {
      alignSelf: 'center',
      width: size.chevronWell + space.s8,
      height: size.sheetHandle,
      borderRadius: radius.pill,
      backgroundColor: colors.lineStrong,
      marginBottom: space.s8,
    },
  });

export const ModalSheet: React.FC<ModalSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tall = false,
}) => {
  const styles = useStyles(makeStyles);
  const parts = useStyles(makeSheetStyles);
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, space.s16);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.panel, tall && styles.tall]} accessibilityViewIsModal accessibilityLabel={title}>
          <View style={styles.handle} />
          <View style={parts.head}>
            <View style={parts.headText}>
              <AppText variant="h2" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="body" tone="muted">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" tone="muted" />
          </View>
          <ScrollView
            style={tall ? styles.scrollTall : undefined}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={parts.body}>{children}</View>
            {footer ? null : <View style={{ height: bottom }} />}
          </ScrollView>
          {footer ? <View style={[parts.footer, { paddingBottom: bottom }]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
};

export default ModalSheet;
