// ═══════════════════════════════════════════════════════
// ScreenShell — every screen's frame
// ═══════════════════════════════════════════════════════
// Safe area, canvas ground, keyboard avoidance, scroll (with pull-to-refresh)
// and the page header, plus an optional StickyCTA footer. Content gets the
// 24 px gutter and a 16 px rhythm unless `padded={false}`.
//
// The header follows the module (theme.header): a white bar whose large
// title collapses into it on scroll, or — on Shopping and Health pages — the
// FYP's gradient PageHeader with the title and subtitle inside it.

import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { useBarStyle } from '../hooks/useBarStyle';
import { LargeTitleBlock, LargeTitleHeader } from './LargeTitleHeader';
import { PageHeader } from './PageHeader';
import { StickyCTA } from './StickyCTA';

export interface ScreenShellProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  /** Gradient header only: content inside it, under the title (search pill, chips, segments). */
  headerContent?: React.ReactNode;
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
  headerContent,
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
  const { service, colors, header, space } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.set(e.contentOffset.y);
  });
  const gradient = !bare && header.tone === 'gradient';
  useBarStyle(gradient);

  const titleBlock =
    title && !gradient ? <LargeTitleBlock title={title} subtitle={subtitle} eyebrow={eyebrow} scrollY={scrollY} /> : null;
  const body = <View style={padded ? styles.padded : null}>{children}</View>;

  return (
    <View style={[styles.root, { paddingTop: bare || gradient ? 0 : insets.top }]} testID={testID}>
      {bare ? null : gradient ? (
        <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} onBack={onBack} right={headerRight}>
          {headerContent}
        </PageHeader>
      ) : (
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
            contentContainerStyle={[styles.content, gradient && { paddingTop: space.s20 }]}
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
          <View style={[styles.flex, styles.content, gradient && { paddingTop: space.s16 }]}>
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
