// ═══════════════════════════════════════════════════════
// Sheet — a themed bottom sheet with a title (@gorhom/bottom-sheet)
// ═══════════════════════════════════════════════════════
// Controlled by `visible` so a slice can own whether it is open. Sizes to its
// content; the backdrop dismisses. Requires BottomSheetModalProvider at the
// root (App.tsx).

import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: gutter,
      paddingBottom: space.s12,
      gap: space.s8,
    },
    headText: { flex: 1, gap: space.s4, paddingTop: space.s8 },
    body: { paddingHorizontal: gutter, gap: space.s16 },
    footer: { paddingHorizontal: gutter, paddingTop: space.s16, gap: space.s8 },
  });

export const Sheet: React.FC<SheetProps> = ({ visible, onClose, title, subtitle, children, footer }) => {
  const styles = useStyles(makeStyles);
  const { colors, radius, size, space } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.lineStrong, height: size.sheetHandle }}
      accessibilityLabel={title}>
      <BottomSheetScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.headText}>
            <AppText variant="h2" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="body" tone="muted">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <IconButton icon="x" onPress={onClose} accessibilityLabel="Close" tone="muted" />
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.s16) }]}>{footer}</View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, space.s16) }} />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export default Sheet;
