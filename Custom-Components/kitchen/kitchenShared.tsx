// ═══════════════════════════════════════════════════════
// Kitchen components: the shared pieces
// ═══════════════════════════════════════════════════════
// A tone's colours (from the theme), the tinted icon well that carries a
// card's severity (never a coloured strip down its side), content text that
// reads right to left when it is Urdu, and whether a screen reader is on
// (charts then show their list instead).

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText, type AppTextProps } from '../AppText';
import { IonIcon, type IonName } from '../Icon';
import { directionOf } from '../../utils/script';
import type { KitchenTone } from '../../models/kitchen/kitchenStatusModel';

export const useToneColors = () => {
  const { colors, service } = useTheme();
  return (tone: KitchenTone): { fg: string; bg: string } =>
    ({
      neutral: { fg: colors.inkMuted, bg: colors.surfaceSunk },
      accent: { fg: service.accentDeep, bg: service.accentSoft },
      success: { fg: colors.success, bg: colors.successSoft },
      warning: { fg: colors.warning, bg: colors.warningSoft },
      danger: { fg: colors.danger, bg: colors.dangerSoft },
    })[tone];
};

const makeStyles = ({ size, radius }: Theme) =>
  StyleSheet.create({
    well: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  });

/** A glyph in a small square tinted by its tone. */
export const ToneWell: React.FC<{ icon: IonName; tone: KitchenTone }> = ({ icon, tone }) => {
  const styles = useStyles(makeStyles);
  const c = useToneColors()(tone);
  return (
    <View style={[styles.well, { backgroundColor: c.bg }]}>
      <IonIcon name={icon} size="md" color={c.fg} />
    </View>
  );
};

/**
 * Content (not UI copy) that may be Urdu: what was said, an Urdu
 * description, a recipe step. Urdu script reads right to left.
 */
export const ContentText: React.FC<AppTextProps & { children: string }> = ({ children, style, ...rest }) => {
  const rtl = directionOf(children) === 'rtl';
  return (
    <AppText {...rest} style={[rtl ? { writingDirection: 'rtl', textAlign: 'right' } : null, style]}>
      {children}
    </AppText>
  );
};

/** True while TalkBack or VoiceOver runs (the web can't tell: false there). */
export const useScreenReader = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .catch(() => false)
      .then(v => live && setOn(v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return on;
};
