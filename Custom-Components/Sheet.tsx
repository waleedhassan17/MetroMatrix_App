// ═══════════════════════════════════════════════════════
// Sheet — a themed bottom sheet with a title (@gorhom/bottom-sheet)
// ═══════════════════════════════════════════════════════
// Controlled by `visible` so a slice can own whether it is open. Sizes to its
// content; the backdrop dismisses. Requires BottomSheetModalProvider at the
// root (App.tsx). The bottom-sheet library never presents in a browser, so
// web resolves Sheet.web.tsx (a Modal) behind the same props.

import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeScope, useStyles, useTheme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { makeSheetStyles as makeStyles, type SheetProps } from './sheetShared';

export type { SheetProps } from './sheetShared';

export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}) => {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { colors, radius, size, space } = theme;
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
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
      {/* The modal renders at the provider, outside this screen's ServiceScope:
          carry the caller's theme in, so a Health sheet stays blue. */}
      <ThemeScope theme={theme}>
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
            <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" tone="muted" />
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.s16) }]}>
              {footer}
            </View>
          ) : (
            <View style={{ height: Math.max(insets.bottom, space.s16) }} />
          )}
        </BottomSheetScrollView>
      </ThemeScope>
    </BottomSheetModal>
  );
};

export default Sheet;
