// ═══════════════════════════════════════════════════════
// PageHeader — the FYP's module-page header
// ═══════════════════════════════════════════════════════
// One surface from the very top of the screen: the service's accent sweeping
// to its deep step (theme.header.gradient — both stops carry white text at
// AA), under the status bar, with a rounded bottom. A large leading white
// title with its subtitle under it, the back glyph and actions in white
// (Shopping's actions in white circles, theme.header.actions), and room for a
// search field or chips inside (children). Every module's pages wear it;
// ScreenShell and ShopTopBar choose it from the theme, so a screen never
// decides.

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
  /** Before the title, after the back glyph: a store's mark on its dashboard. */
  leading?: React.ReactNode;
  /** Actions on the trailing edge, painted for the gradient (glyphs or Shopping's white circles). */
  right?: React.ReactNode;
  /** Inside the header, under the title: a search field, chips, a segment. */
  children?: React.ReactNode;
  /** False when something else already clears the status bar (a header that scrolls under a fixed band). */
  safeTop?: boolean;
}

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// The FYP's module header (AppBar's gradient tone, ShoppingHeader): 20 under
// the status bar, the gutter on both sides, a 26 / 700 title on one line with
// a 13 / 500 line under it, 32 below (24 when a field sits inside), and a
// radius-20 foot.
const makeStyles = ({ space, radius, size, gutter }: Theme) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: gutter,
      borderBottomLeftRadius: radius.header,
      borderBottomRightRadius: radius.header,
      overflow: 'hidden',
      gap: space.s16,
    },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: size.headerWell, gap: space.s12 },
    // The chevron's glyph lines up with the gutter, not its 44 pt target.
    back: { marginLeft: -space.s12, marginRight: -space.s8 },
    text: { flex: 1, gap: space.s4 },
    right: { flexDirection: 'row', alignItems: 'center' },
    // Bare glyphs keep their 44 pt targets; the gutter lines up with the glyph.
    rightGlyph: { marginRight: -space.s12 },
    rightCircle: { gap: space.s8 },
    inner: { gap: space.s12 },
  });

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = 'Back',
  leading,
  right,
  children,
  safeTop = true,
}) => {
  const styles = useStyles(makeStyles);
  const { header, space } = useTheme();
  const insets = useSafeAreaInsets();
  useBarStyle(true);
  return (
    <LinearGradient
      colors={header.gradient}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[
        styles.root,
        { paddingTop: (safeTop ? insets.top : 0) + space.s20, paddingBottom: children ? space.s24 : space.s32 },
      ]}>
      <View style={styles.row}>
        {onBack ? (
          <View style={styles.back}>
            <IconButton icon="chevron-back" tone="onScrim" onPress={onBack} accessibilityLabel={backLabel} />
          </View>
        ) : null}
        {leading}
        <View style={styles.text}>
          {eyebrow ? (
            <AppText variant="micro" tone="onScrim" numberOfLines={1}>
              {eyebrow}
            </AppText>
          ) : null}
          {title ? (
            <AppText variant="pageTitle" tone="onScrim" numberOfLines={1} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            // Full white: the 90% tint misses AA on the lighter stops at 13 pt.
            <AppText variant="pageSubtitle" tone="onScrim" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? (
          <OnGradientContext.Provider value>
            <View style={[styles.right, header.actions === 'circle' ? styles.rightCircle : styles.rightGlyph]}>{right}</View>
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
