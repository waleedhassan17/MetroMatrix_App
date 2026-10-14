// ═══════════════════════════════════════════════════════
// ScreenShell — every screen's frame
// ═══════════════════════════════════════════════════════
// Safe area, canvas ground, keyboard avoidance, scroll (with pull-to-refresh)
// and the collapsing large title, plus an optional StickyCTA footer. Content
// gets the 24 px gutter and a 16 px rhythm unless `padded={false}`.

import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { LargeTitleBlock, LargeTitleHeader } from './LargeTitleHeader';
import { StickyCTA } from './StickyCTA';

export interface ScreenShellProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  /** Hide the bar entirely (full-bleed screens such as onboarding). */
  bare?: boolean;
  scroll?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children?: React.ReactNode;
  testID?: string;
}

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1 },
    content: { paddingBottom: space.s32 },
    padded: { paddingHorizontal: gutter, gap: space.s16 },
  });

export const ScreenShell: React.FC<ScreenShellProps> = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  headerRight,
  bare = false,
  scroll = true,
  padded = true,
  footer,
  refreshing,
  onRefresh,
  children,
  testID,
}) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.set(e.contentOffset.y);
  });

  const titleBlock = title ? (
    <LargeTitleBlock title={title} subtitle={subtitle} eyebrow={eyebrow} scrollY={scrollY} />
  ) : null;
  const body = <View style={padded ? styles.padded : null}>{children}</View>;

  return (
    <View style={[styles.root, { paddingTop: bare ? 0 : insets.top }]} testID={testID}>
      {bare ? null : (
        <LargeTitleHeader title={title} scrollY={scrollY} onBack={onBack} right={headerRight} />
      )}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        {scroll ? (
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={service.accent}
                  colors={[service.accent]}
                  progressBackgroundColor={colors.surface}
                />
              ) : undefined
            }>
            {titleBlock}
            {body}
          </Animated.ScrollView>
        ) : (
          <View style={[styles.flex, styles.content]}>
            {titleBlock}
            <View style={[styles.flex, padded ? styles.padded : null]}>{children}</View>
          </View>
        )}
        {footer ? <StickyCTA>{footer}</StickyCTA> : null}
      </KeyboardAvoidingView>
    </View>
  );
};

export default ScreenShell;
