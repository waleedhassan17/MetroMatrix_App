// IconWell — a glyph in a soft round well, for the few places where the icon
// IS the element: a quick action, a specialty, an empty state, a list card's
// mark, a notice. Neutral everywhere (slate on the sunk grey); a status tone
// only where the well says a status (a notice, a toast), and the accent only
// for a selected tile. Never a categorical colour: the owner found coloured
// icon wells odd and machine-made (2026-11-27). Rows, stats and menus show a
// plain glyph instead, with no well at all.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { IonIcon, MciIcon, type IonName, type MciName } from './Icon';

export type WellTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success' | 'info';
export type WellSize = 'sm' | 'md' | 'lg' | 'xl';

export interface IconWellProps {
  /** An Ionicons glyph (the app's set). */
  icon?: IonName;
  /** A MaterialCommunityIcons glyph, only where Ionicons has none (a specialty, a provider type). */
  mci?: MciName;
  tone?: WellTone;
  size?: WellSize;
}

const GLYPH: Record<WellSize, 'sm' | 'md' | 'lg' | 'xl'> = { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' };

const makeStyles = ({ radius }: Theme) =>
  StyleSheet.create({
    well: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  });

/** The well's colours for a tone. */
export const useWellColours = (tone: WellTone): { bg: string; fg: string } => {
  const { colors, service } = useTheme();
  switch (tone) {
    case 'accent':
      return { bg: service.accentSoft, fg: service.accentDeep };
    case 'danger':
      return { bg: colors.dangerSoft, fg: colors.danger };
    case 'warning':
      return { bg: colors.warningSoft, fg: colors.warning };
    case 'success':
      return { bg: colors.successSoft, fg: colors.success };
    case 'info':
      return { bg: colors.infoSoft, fg: colors.info };
    default:
      return { bg: colors.surfaceSunk, fg: colors.inkMuted };
  }
};

export const IconWell: React.FC<IconWellProps> = ({ icon, mci, tone = 'neutral', size = 'md' }) => {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const c = useWellColours(tone);
  const side = theme.size.well[size];
  return (
    <View
      style={[styles.well, { width: side, height: side, backgroundColor: c.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {mci ? <MciIcon name={mci} size={GLYPH[size]} color={c.fg} /> : icon ? <IonIcon name={icon} size={GLYPH[size]} color={c.fg} /> : null}
    </View>
  );
};

export default IconWell;
