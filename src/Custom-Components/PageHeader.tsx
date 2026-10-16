// ═══════════════════════════════════════════════════════
// PageHeader — the FYP's module-page header
// ═══════════════════════════════════════════════════════
// One surface from the very top of the screen: the service's deep accent
// sweeping toward ink (theme.header.gradient — both stops carry white text at
// AA), under the status bar, with a rounded bottom. A large leading white
// title with its subtitle under it, the back glyph and actions in white, and
// room for a search pill or chips inside (children). Shopping and Health
// pages wear it; ScreenShell and ShopTopBar choose it from the theme, so a
// screen never decides.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { useBarStyle } from '../hooks/useBarStyle';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { OnGradientContext } from './headerInk';

export interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Actions on the trailing edge, painted for the gradient (tone="onScrim"). */
  right?: React.ReactNode;
  /** Inside the header, under the title: a search pill, chips, a segment. */
  children?: React.ReactNode;
  /** False when something else already clears the status bar (a header that scrolls under a fixed band). */
  safeTop?: boolean;
}

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const makeStyles = ({ space, radius, size, gutter }: Theme) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: gutter - space.s8,
      paddingBottom: space.s24,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
      overflow: 'hidden',
      gap: space.s16,
    },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: size.headerBar, gap: space.s4 },
    text: { flex: 1, gap: space.s4, paddingHorizontal: space.s8 },
    right: { flexDirection: 'row', alignItems: 'center' },
    inner: { paddingHorizontal: space.s8, gap: space.s12 },
  });

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, eyebrow, onBack, backLabel = 'Back', right, children, safeTop = true }) => {
  const styles = useStyles(makeStyles);
  const { header, colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  useBarStyle(true);
  return (
    <LinearGradient
      colors={header.gradient}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.root, { paddingTop: (safeTop ? insets.top : 0) + space.s12 }]}>
      <View style={styles.row}>
        {onBack ? <IconButton icon="chevron-back" tone="onScrim" onPress={onBack} accessibilityLabel={backLabel} /> : null}
        <View style={styles.text}>
          {eyebrow ? (
            <AppText variant="micro" style={{ color: colors.onScrimSoft }}>
              {eyebrow}
            </AppText>
          ) : null}
          {title ? (
            <AppText variant="heading" tone="onScrim" numberOfLines={2} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="small" numberOfLines={2} style={{ color: colors.onScrimSoft }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? (
          <OnGradientContext.Provider value>
            <View style={styles.right}>{right}</View>
          </OnGradientContext.Provider>
        ) : null}
      </View>
      {children ? (
        <OnGradientContext.Provider value>
          <View style={styles.inner}>{children}</View>
        </OnGradientContext.Provider>
      ) : null}
    </LinearGradient>
  );
};

export default PageHeader;
